import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Kysely, type Transaction } from 'kysely';
import { APP_DATABASE, FINANCIAL_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
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
    await sql`
      INSERT INTO core.payment_submission
        (id, order_id, submitted_at, evidence_ref, state, sla_deadline)
      SELECT ${randomUUID()}, ${orderId}, now(), ${evidence.rows[0]?.id}, 'SUBMITTED',
             now() + tc.payment_confirmation_window
        FROM core."order" o
        JOIN core.timing_config tc
          ON tc.market_id = o.market_id AND tc.effective @> now()
       WHERE o.id = ${orderId}`.execute(trx);

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

  /** GET /v1/seller/payout — account_last4 only; core holds nothing more. */
  async getPayout(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    await assertPermission(trx, req, 'seller.payout:read');
    await sql`SELECT core.fn_activate_due_payout(${req.ctx?.sellerId})`.execute(trx);
    const r = await sql<Record<string, unknown>>`
      SELECT id, bank_code, account_last4, state::text, requested_at,
             activates_at, activated_at
        FROM core.payout_details
       WHERE seller_id = ${req.ctx?.sellerId} AND state IN ('ACTIVE', 'PENDING')
       ORDER BY state`.execute(trx);
    return {
      active: r.rows.find((row) => row['state'] === 'ACTIVE') ?? null,
      pending: r.rows.find((row) => row['state'] === 'PENDING') ?? null,
    };
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
