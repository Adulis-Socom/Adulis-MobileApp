import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely, type Transaction } from 'kysely';
import { APP_DATABASE, FINANCIAL_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
import { grantSet, allowedActions } from '../../common/auth/grant-set';
import { AdulisException } from '../../common/errors/adulis-exception';
import {
  decryptFramed,
  decryptValue,
  encryptFramed,
  encryptValue,
  keyForRef,
} from '../../common/crypto/aead';
import {
  FINANCIAL_STORAGE_ADAPTER,
  type FinancialStorageAdapter,
} from './financial-storage.adapter';
import type { PayoutChangeBody } from './financial.schemas';

/**
 * C4 — the financial boundary, surfaced. This module is the complete list
 * of code that touches payment evidence and payout credentials: it alone
 * imports FINANCIAL_DATABASE (the audit pool) and the evidence storage
 * adapter, and every read goes through the SECURITY DEFINER functions that
 * log in the same transaction. The endpoint performs none of the
 * authorization checks itself — duplicating them creates a second place to
 * get them wrong and a first place to skip the log.
 */

const EVIDENCE_CAP_BYTES = 5 * 1024 * 1024;

@Injectable()
export class FinancialService {
  constructor(
    @Inject(APP_DATABASE) private readonly db: Kysely<Database>,
    @Inject(FINANCIAL_DATABASE) private readonly financialDb: Kysely<Database>,
    @Inject(FINANCIAL_STORAGE_ADAPTER) private readonly storage: FinancialStorageAdapter,
  ) {}

  /**
   * GET /v1/orders/{id}/payment-instructions — the C3 disclosure path
   * (§12.5). One function call; the API's only contribution is R15's
   * decryption, with a key Postgres never held.
   */
  async paymentInstructions(req: AuthedRequest, orderId: string): Promise<unknown> {
    const r = await sql<{
      bank_code: string;
      account_ciphertext: Buffer;
      account_name_ciphertext: Buffer;
      encryption_key_ref: string;
    }>`
      SELECT * FROM financial.render_payment_instructions(
        ${orderId}, ${req.ctx?.accountId})`.execute(this.financialDb);
    const row = r.rows[0];
    if (!row) throw new AdulisException('NOT_FOUND');

    const key = keyForRef(row.encryption_key_ref);
    const o = await sql<{ total_minor: string; total_currency: string }>`
      SELECT total_minor, total_currency FROM core."order"
       WHERE id = ${orderId} AND buyer_account_id = ${req.ctx?.accountId}`.execute(this.db);

    return {
      bank_code: row.bank_code,
      account_number: decryptValue(row.account_ciphertext, key).toString('utf8'),
      account_name: decryptValue(row.account_name_ciphertext, key).toString('utf8'),
      amount_minor: Number(o.rows[0]?.total_minor ?? 0),
      currency: o.rows[0]?.total_currency,
      reference: `ADU-${orderId.slice(0, 8).toUpperCase()}`,
    };
  }

  /**
   * POST /v1/orders/{id}/payment-evidence — upload via signed URL, then
   * commit. The commit fetches the raw upload, enforces the 5 MB cap,
   * encrypts to R18 frames, stores the framed object, DELETES the raw,
   * registers through the boundary's writer, and moves the order to
   * PAYMENT_SUBMITTED with its submission row — one transaction.
   */
  async requestEvidenceUpload(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    const owner = await sql<{ id: string }>`
      SELECT id FROM core."order"
       WHERE id = ${orderId} AND buyer_account_id = ${req.ctx?.accountId}`.execute(trx);
    if (!owner.rows[0]) throw new AdulisException('NOT_FOUND');
    const upload = await this.storage.signPut(
      `evidence/raw/${orderId}/${randomUUID()}`,
      'image/*',
      EVIDENCE_CAP_BYTES,
    );
    return { upload };
  }

  async commitEvidence(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    rawKey: string,
  ): Promise<unknown> {
    const order = await sql<{ state: string }>`
      SELECT state::text FROM core."order"
       WHERE id = ${orderId} AND buyer_account_id = ${req.ctx?.accountId}
       FOR UPDATE`.execute(trx);
    if (!order.rows[0]) throw new AdulisException('NOT_FOUND');
    if (!['CREATED', 'NOTIFIED'].includes(order.rows[0].state)) {
      throw new AdulisException('ORDER_NOT_PAYABLE', {
        slots: { state: order.rows[0].state },
      });
    }
    if (!rawKey.startsWith(`evidence/raw/${orderId}/`)) {
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'key' } });
    }

    const raw = await this.storage.getObject(rawKey);
    if (!raw) {
      throw new AdulisException('EVIDENCE_REQUIRED', {
        slots: { reason: 'OBJECT_NOT_UPLOADED' },
      });
    }
    if (raw.length > EVIDENCE_CAP_BYTES) {
      throw new AdulisException('EVIDENCE_TOO_LARGE', {
        slots: { max_bytes: EVIDENCE_CAP_BYTES, bytes: raw.length },
      });
    }

    const framed = encryptFramed(raw, keyForRef('EVID_V1'));
    const storedKey = `evidence/framed/${orderId}/${randomUUID()}`;
    await this.storage.putObject(storedKey, framed.payload);
    await this.storage.deleteObject(rawKey);

    const evidence = await sql<{ id: string }>`
      SELECT financial.write_payment_evidence(
        ${orderId}, ${storedKey}, 'EVID_V1',
        ${framed.frameSize}, ${framed.frameCount}) AS id`.execute(trx);

    await sql`UPDATE core."order" SET state = 'PAYMENT_SUBMITTED'
               WHERE id = ${orderId}`.execute(trx);
    const submission = await sql`
      INSERT INTO core.payment_submission
        (id, order_id, submitted_at, evidence_ref, state, sla_deadline)
      SELECT ${randomUUID()}, ${orderId}, now(), ${evidence.rows[0]?.id}, 'SUBMITTED',
             now() + tc.payment_confirmation_window
        FROM core."order" o
        JOIN core.timing_config tc
          ON tc.market_id = o.market_id AND tc.effective @> now()
       WHERE o.id = ${orderId}`.execute(trx);
    if (Number(submission.numAffectedRows ?? 0) === 0) {
      // T16 pass F2: with no timing_config in force, this INSERT..SELECT used
      // to write ZERO rows AFTER the state flip -- a PAYMENT_SUBMITTED order
      // with no submission, invisible to the confirmation clock and the
      // obligations list while the lapse job (which derives its own deadline
      // from the transition time) would still open the SLA claim: the purest
      // false negative. A missing config is OUR defect; fail loudly, roll the
      // whole commit back (500, the 42501 doctrine's spirit).
      throw new AdulisException('INTERNAL');
    }

    return { evidence_id: evidence.rows[0]?.id, state: 'PAYMENT_SUBMITTED' };
  }

  /**
   * GET /v1/seller/orders/{id}/payment-evidence — logged access, derived
   * role, no justification required (S10.3). Streamed with constant
   * memory; `private, no-store`; never at a predictable URL.
   */
  async streamEvidence(
    req: AuthedRequest,
    orderId: string,
    write: (chunk: Buffer) => void,
  ): Promise<void> {
    // Permission first, on the app pool, like every seller-scoped read.
    await this.db.transaction().execute(async (trx) => {
      await assertPermission(trx, req, 'seller.payment_evidence:read');
    });

    const ref = await sql<{ evidence_ref: string }>`
      SELECT ps.evidence_ref
        FROM core.payment_submission ps
        JOIN core."order" o ON o.id = ps.order_id
       WHERE ps.order_id = ${orderId} AND o.seller_id = ${req.ctx?.sellerId}
       ORDER BY ps.submitted_at DESC LIMIT 1`.execute(this.db);
    if (!ref.rows[0]) throw new AdulisException('NOT_FOUND');

    const ev = await sql<{
      object_key: string;
      encryption_key_ref: string;
      frame_count: number;
    }>`
      SELECT (e).object_key, (e).encryption_key_ref, (e).frame_count
        FROM financial.read_payment_evidence(
          ${ref.rows[0].evidence_ref}, ${req.ctx?.accountId},
          'seller payment review') e`.execute(this.financialDb);
    const row = ev.rows[0];
    if (!row) throw new AdulisException('NOT_FOUND');

    const payload = await this.storage.getObject(row.object_key);
    if (!payload) throw new AdulisException('INTERNAL');
    for (const chunk of decryptFramed(payload, keyForRef(row.encryption_key_ref), row.frame_count)) {
      write(chunk);
    }
  }

  // ------------------------------------------------------------------ payout

  /**
   * GET /v1/seller/payout — account_last4 only; core holds nothing more.
   *
   * THIS READ NO LONGER ACTIVATES (T21 S1, D-268). It used to run
   * `core.fn_activate_due_payout` here, inside the handler's transaction, which
   * made it D-74's twin: a failure later in the read rolled back an activation
   * it had just performed (D-255, registered in T20 S6.1 and ruled on here).
   *
   * THE RULING DROPPED THE CALL RATHER THAN MOVING IT TO ITS OWN CONNECTION.
   * A separate connection fixes the rollback and leaves a GET whose side effect
   * depends on whether anyone opened a screen — the shape that made the
   * interval unbounded in the first place — and a write outside the request's
   * transaction cannot be rolled back when the request SHOULD fail, which is
   * the mirror of the same bug. `payout.activate_due` (ADU-AUTH-01 v2.8 S20.1,
   * registered through RULED_JOBS) owns activation, every five minutes, in its
   * own transaction, per seller. Against a twenty-four hour delay the lazy path
   * bought freshness nobody can perceive.
   *
   * THE DOCUMENT DEBT IS DISCHARGED (T22 Phase 1). T21 shipped this against an
   * installed sentence that said the opposite -- v2.7 S20.1's "The lazy path
   * stays" -- and registered the disagreement as D-268 because the code and the
   * document may not silently differ. ADU-AUTH-01 v2.8 WITHDRAWS that sentence
   * in terms, so the document now says what this code does and D-268 is closed.
   */
  async getPayout(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.payout:read');
    const r = await sql<Record<string, unknown>>`
      SELECT id, bank_code, account_last4, state::text, requested_at,
             activates_at, activated_at
        FROM core.payout_details
       WHERE seller_id = ${req.ctx?.sellerId} AND state IN ('ACTIVE', 'PENDING')
       ORDER BY state`.execute(trx);
    const grants = await grantSet(trx, req);
    const lock = await this.payoutLockState(trx, req);
    return {
      active: r.rows.find((row) => row['state'] === 'ACTIVE') ?? null,
      pending: r.rows.find((row) => row['state'] === 'PENDING') ?? null,
      // ADU-API-01 v1.9 S15.0c: the lock was discovered on a 409 today, so
      // SC-24 could not draw a proactive panel. These two fields let it.
      payout_locked_until: lock.until,
      reason: lock.reason,
      // D-155: change and cancel share seller.payout:update; R21's render
      // condition (cancel only beside a real pending row) stays the row's,
      // so the code is present whenever the caller may change payout at all.
      allowed_actions: allowedActions(grants, { 'seller.payout:update': true }),
    };
  }

  /**
   * The payout lock state, READ-ONLY, for SC-24's proactive panel (v1.9
   * S15.0c). It is the render-side twin of the three checks
   * `core.fn_request_payout_change` (0022) makes before it writes, IN THE SAME
   * ORDER and reading THE SAME rows -- fail-closed when no timing config, then
   * recovery cooling (the horizon lives on the recovery case), then the
   * new-device lock (a device first seen within the window). It NEVER
   * authorizes: the write function remains the authority that raises U0008;
   * this returns a hint and raises nothing (the grant-set precedent, D-230).
   * The `reason` vocabulary is the write function's own DETAIL, verbatim, so
   * the panel and the 409 speak one language.
   */
  private async payoutLockState(
    trx: Transaction<Database>,
    req: AuthedRequest,
  ): Promise<{ until: string | null; reason: string | null }> {
    const r = await sql<{
      no_config: boolean;
      recovery_until: Date | null;
      new_device_until: Date | null;
    }>`
      WITH cfg AS (
        SELECT tc.new_device_payout_lock
          FROM core.timing_config tc
          JOIN core.seller s ON s.market_id = tc.market_id
         WHERE s.id = ${req.ctx?.sellerId} AND tc.effective @> now()
      ),
      rec AS (
        SELECT max(rc.payout_locked_until) AS until
          FROM core.account_recovery_case rc
         WHERE rc.account_id = ${req.ctx?.accountId} AND rc.payout_locked_until > now()
      ),
      dev AS (
        SELECT min(sn.created_at) AS first_seen
          FROM core.session sn
         WHERE sn.account_id = ${req.ctx?.accountId}
           AND sn.device_id = ${req.auth?.deviceId ?? null}
      ),
      -- T18 Phase 4: the new-device lock has a SUBJECT. The render-side twin
      -- of 0047's predicate, and it must stay identical -- ANY payout row in
      -- ANY state, not just ACTIVE. A CANCELLED row still counts, because
      -- cancelling is free (fn_cancel_payout_change needs no step-up and
      -- checks no lock) and an ACTIVE-only test would let an attacker cancel
      -- a seller's pending first set and walk through the carve-out.
      ever AS (
        SELECT 1 AS present
          FROM core.payout_details pd
         WHERE pd.seller_id = ${req.ctx?.sellerId}
         LIMIT 1
      )
      SELECT
        (SELECT count(*) FROM cfg) = 0 AS no_config,
        (SELECT until FROM rec) AS recovery_until,
        CASE
          WHEN (SELECT new_device_payout_lock FROM cfg) IS NOT NULL
           AND EXISTS (SELECT 1 FROM ever)
           AND (SELECT first_seen FROM dev) IS NOT NULL
           AND (SELECT first_seen FROM dev)
               > now() - (SELECT new_device_payout_lock FROM cfg)
          THEN (SELECT first_seen FROM dev) + (SELECT new_device_payout_lock FROM cfg)
          ELSE NULL
        END AS new_device_until`.execute(trx);
    const row = r.rows[0];
    if (!row) return { until: null, reason: null };
    // Same order the write path fails in: NO_TIMING_CONFIG, then RECOVERY,
    // then NEW_DEVICE. NO_TIMING_CONFIG has no lift horizon (it is a config
    // gap, not a timed lock), so `until` stays null there.
    if (row.no_config) return { until: null, reason: 'NO_TIMING_CONFIG' };
    if (row.recovery_until) {
      return { until: row.recovery_until.toISOString(), reason: 'RECOVERY_COOLING' };
    }
    if (row.new_device_until) {
      return { until: row.new_device_until.toISOString(), reason: 'NEW_DEVICE' };
    }
    return { until: null, reason: null };
  }

  /** POST /v1/seller/payout — every S10.4 control, then the ciphertext. */
  async requestPayoutChange(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: PayoutChangeBody,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.payout:update');
    const r = await sql<{ payout_details_id: string; activates_at: Date }>`
      SELECT * FROM core.fn_request_payout_change(
        ${req.ctx?.sellerId}, ${req.ctx?.accountId}, ${body.bank_code},
        ${body.account_number.slice(-4)}, ${body.step_up_challenge_id},
        ${req.auth?.sessionId}, ${req.auth?.deviceId})`.execute(trx);
    const row = r.rows[0];
    if (!row) throw new AdulisException('INTERNAL');

    const key = keyForRef('PAYOUT_V1');
    await sql`SELECT financial.write_payout_credential(
      ${row.payout_details_id},
      ${encryptValue(Buffer.from(body.account_number, 'utf8'), key)},
      ${encryptValue(Buffer.from(body.account_name, 'utf8'), key)},
      'PAYOUT_V1')`.execute(trx);

    return {
      payout_details_id: row.payout_details_id,
      state: 'PENDING',
      activates_at: row.activates_at.toISOString(),
    };
  }

  /** DELETE /v1/seller/payout/pending — no step-up; reverting is easier. */
  async cancelPayoutChange(trx: Transaction<Database>, req: AuthedRequest): Promise<void> {
    await assertPermission(trx, req, 'seller.payout:update');
    await sql`SELECT core.fn_cancel_payout_change(
      ${req.ctx?.sellerId}, ${req.ctx?.accountId})`.execute(trx);
  }

  /** GET /v1/seller/payout/history — masked, append-only (S10.4). */
  async payoutHistory(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.payout:read');
    const r = await sql<Record<string, unknown>>`
      SELECT id, previous_last4, new_last4, outcome, occurred_at
        FROM core.payout_change_log
       WHERE seller_id = ${req.ctx?.sellerId}
       ORDER BY occurred_at DESC
       LIMIT 100`.execute(trx);
    return { data: r.rows };
  }

  /** POST /v1/seller/orders/{id}/reissue-instructions — one named order. */
  async reissueInstructions(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    stepUpChallengeId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.orders:reissue_instructions');
    const r = await sql<{ fn_reissue_instructions: string }>`
      SELECT core.fn_reissue_instructions(
        ${orderId}, ${req.ctx?.sellerId}, ${req.ctx?.accountId},
        ${stepUpChallengeId})`.execute(trx);
    return { snapshot_id: r.rows[0]?.fn_reissue_instructions };
  }
}
