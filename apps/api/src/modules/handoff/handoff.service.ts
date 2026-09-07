import { Inject, Injectable } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import { sql, type Kysely, type Transaction } from 'kysely';
import { APP_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import { withRequestContext } from '../../common/db/request-context';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { assertPermission } from '../../common/auth/permission';
import { AdulisException } from '../../common/errors/adulis-exception';
import { resolveKey } from '../../common/crypto/aead';
import type { ScanItem } from './handoff.schemas';

/**
 * C5 — the handoff. Event B (the buyer's scan) is where A5's two clocks
 * separate, and every decision about a scan is the DATABASE's: the
 * validity trigger rules VALID/LATE/REJECTED_HORIZON, the composite FK
 * makes a courier scan structurally impossible, and the nonce UNIQUE is
 * the replay backstop. This service verifies the signature, discriminates
 * retries, and relays outcomes.
 *
 * THE SCAN SIGNATURE (register D-31 — the scheme is underdetermined by the
 * documents): the QR the seller displays carries an HMAC the SERVER minted
 * over (order_ref || nonce || signing_key_version); the buyer's device
 * captures it at the doorway and timestamps the blob. "The client signs
 * once and every retry transmits the identical bytes" (12.6.1) is
 * therefore literal: the signature proves the scan came from a genuinely
 * displayed QR, and the identical-blob rule makes a retry distinguishable
 * from an attack. The key is the versioned identity secret under a domain
 * prefix, so a QR digest can never collide with any other digest of the
 * same inputs.
 */

export function qrSignature(orderRef: string, nonce: string, keyVersion: number): string {
  const key = resolveKey(process.env['IDENTITY_HASH_KEY_V1'], 'QR_SIGNING');
  return createHmac('sha256', key)
    .update(`qr:${orderRef}:${nonce}:v${keyVersion}`)
    .digest('hex');
}

interface SyncOutcome {
  nonce: string;
  order_ref: string;
  outcome: string;
  counts_toward_level: boolean;
  replay: boolean;
  order_state?: string | undefined;
}

@Injectable()
export class HandoffService {
  constructor(@Inject(APP_DATABASE) private readonly db: Kysely<Database>) {}

  /**
   * GET /v1/seller/orders/{id}/qr — the seller displays; the buyer scans.
   * 409 ORDER_NOT_READYABLE before PAYMENT_CONFIRMED (R20): the token does
   * not exist earlier, and this endpoint refuses rather than minting one.
   * Cached by the app for offline display at a doorway.
   */
  async getQr(trx: Transaction<Database>, req: AuthedRequest, orderId: string): Promise<unknown> {
    await assertPermission(trx, req, 'seller.handoff:read');
    const r = await sql<{
      nonce: string;
      signing_key_version: number;
      state: string;
    }>`
      SELECT t.nonce, t.signing_key_version, o.state::text
        FROM core."order" o
        LEFT JOIN core.order_qr_token t ON t.order_id = o.id
       WHERE o.id = ${orderId} AND o.seller_id = ${req.ctx?.sellerId}`.execute(trx);
    const row = r.rows[0];
    if (!row) throw new AdulisException('NOT_FOUND');
    if (!row.nonce) throw new AdulisException('ORDER_NOT_READYABLE');
    return {
      order_ref: orderId,
      nonce: row.nonce,
      signing_key_version: row.signing_key_version,
      signature: qrSignature(orderId, row.nonce, row.signing_key_version),
    };
  }

  /**
   * POST /v1/handoffs/sync — batch, PER-ITEM TRANSACTIONS (a rollback on
   * item three cannot take items one and two with it), deterministic order
   * (ascending signed_at, ties by array position), 200 whenever the batch
   * was well-formed: a batch of six rejections is a successful request.
   */
  async sync(req: AuthedRequest, scans: readonly ScanItem[]): Promise<unknown> {
    const ordered = scans
      .map((s, i) => ({ s, i }))
      .sort((a, b) => a.s.signed_at - b.s.signed_at || a.i - b.i);

    const results: SyncOutcome[] = [];
    for (const { s } of ordered) {
      results.push(await this.processScan(req, s));
    }
    // return in the caller's order
    const byNonce = new Map(results.map((r) => [r.nonce, r]));
    return { results: scans.map((s) => byNonce.get(s.nonce)) };
  }

  private async processScan(req: AuthedRequest, scan: ScanItem): Promise<SyncOutcome> {
    const ctx = req.ctx ?? { accountId: null, actorRole: 'BUYER', sellerId: null };
    return withRequestContext(this.db, ctx, async (trx) => {
      // Replay discrimination first: a nonce we have seen, with the
      // IDENTICAL signed payload from the SAME account, is an idempotent
      // retry and returns the original stored outcome (12.6.1's
      // correction: a buyer must never see "rejected" for a handoff that
      // succeeded at the doorway).
      const existing = await sql<{
        validity: string;
        counts_toward_level: boolean;
        order_id: string;
        scanned_by_account_id: string;
        signed_at: Date;
        state: string;
      }>`
        SELECT hs.validity::text, hs.counts_toward_level, hs.order_id,
               hs.scanned_by_account_id, hs.signed_at, o.state::text
          FROM core.handoff_scan hs
          JOIN core."order" o ON o.id = hs.order_id
         WHERE hs.nonce = ${scan.nonce}`.execute(trx);
      const prior = existing.rows[0];
      if (prior) {
        const identical =
          prior.order_id === scan.order_ref &&
          prior.scanned_by_account_id === ctx.accountId &&
          prior.signed_at.getTime() === scan.signed_at;
        if (identical) {
          return {
            nonce: scan.nonce,
            order_ref: scan.order_ref,
            outcome: prior.validity,
            counts_toward_level: prior.counts_toward_level,
            replay: true,
            order_state: prior.state,
          };
        }
        return this.rejected(scan, 'REJECTED_REPLAY');
      }

      /*
       * OWNERSHIP FIRST, AND IT USED TO BE LAST (T26 Phase 1 ruling; register
       * D-360). The QR-token lookup below ran BEFORE this block, keyed on the
       * client-supplied `order_ref` with no buyer predicate, and
       * `core.order_qr_token` has no RLS and is readable by adulis_app in
       * full. So the three outcomes an arbitrary authenticated account could
       * read off a stranger's order id were:
       *
       *   an order past PAYMENT_CONFIRMED   REJECTED_SIGNATURE
       *   an order not yet there            REJECTED_UNKNOWN_ORDER
       *   an id that does not exist         REJECTED_UNKNOWN_ORDER
       *
       * A token exists only from PAYMENT_CONFIRMED (R20), so REJECTED_SIGNATURE
       * meant "that order is real AND it is being fulfilled right now" -- D-320
       * exactly, spelled as an outcome string inside a 200 body instead of a
       * status code, which is why the sweep's path-parameter table did not see
       * it: this endpoint takes its object id in the REQUEST BODY.
       *
       * COURIER_CANNOT_SCAN IS KEPT, AND NARROWED TO THE ACTOR IT NAMES. A
       * courier of the order's seller already knows the order exists -- it is
       * in their own list -- so telling them why their scan was refused
       * discloses nothing and is the message 12.6's invariant asks for. To
       * anyone else the answer is now identical to a nonexistent order.
       */
      const order = await sql<{ buyer_account_id: string; is_courier: boolean }>`
        SELECT o.buyer_account_id,
               EXISTS (SELECT 1 FROM core.seller_courier sc
                        WHERE sc.seller_id = o.seller_id
                          AND sc.account_id = ${ctx.accountId}
                          AND sc.revoked_at IS NULL) AS is_courier
          FROM core."order" o
         WHERE o.id = ${scan.order_ref}`.execute(trx);
      const owner = order.rows[0];
      if (!owner) return this.rejected(scan, 'REJECTED_UNKNOWN_ORDER');
      const isBuyer = owner.buyer_account_id === ctx.accountId;
      if (!isBuyer && !owner.is_courier) {
        // Indistinguishable from an order that does not exist.
        return this.rejected(scan, 'REJECTED_UNKNOWN_ORDER');
      }

      // The signature must verify against the QR the server minted.
      const token = await sql<{ nonce: string; signing_key_version: number }>`
        SELECT nonce, signing_key_version FROM core.order_qr_token
         WHERE order_id = ${scan.order_ref}`.execute(trx);
      const t = token.rows[0];
      if (!t) {
        return this.rejected(scan, 'REJECTED_UNKNOWN_ORDER');
      }
      // A nonce that is not the order's displayed QR fails as a SIGNATURE
      // problem: the blob does not correspond to anything the server
      // minted, whatever the reason.
      if (t.nonce !== scan.nonce) {
        return this.rejected(scan, 'REJECTED_SIGNATURE');
      }
      if (qrSignature(scan.order_ref, scan.nonce, t.signing_key_version) !== scan.signature) {
        return this.rejected(scan, 'REJECTED_SIGNATURE');
      }

      /*
       * COURIER_CANNOT_SCAN STAYS BELOW THE SIGNATURE, and that placement is
       * the batch contract rather than a preference. It THROWS -- it is a
       * catalogued 403 -- so it escapes processScan and aborts the whole
       * batch, discarding the per-item outcomes of every other scan in it,
       * against 12.6.1's "200 whenever the batch was well-formed".
       *
       * Above the signature check it would be reachable on an ORDER ID ALONE,
       * so one courier typo could destroy a queue of doorway scans collected
       * offline. Here it needs what it has always needed: the real nonce and
       * a signature over the QR the server minted -- which is exactly the
       * courier who pointed a scanner at a customer's code, and is the person
       * the message is written for.
       */
      if (!isBuyer) {
        throw new AdulisException('COURIER_CANNOT_SCAN');
      }

      try {
        const inserted = await sql<{
          validity: string;
          counts_toward_level: boolean;
        }>`
          INSERT INTO core.handoff_scan
            (id, order_id, scanned_by_account_id, nonce, signed_at,
             reported_clock_offset_ms)
          VALUES (${randomUUID()}, ${scan.order_ref}, ${ctx.accountId},
                  ${scan.nonce}, to_timestamp(${scan.signed_at / 1000.0}),
                  ${Number(req.headers['x-adulis-clock-offset'] ?? 0) || 0})
          RETURNING validity::text, counts_toward_level`.execute(trx);
        const row = inserted.rows[0];
        const state = await sql<{ state: string }>`
          SELECT state::text FROM core."order" WHERE id = ${scan.order_ref}`.execute(trx);
        return {
          nonce: scan.nonce,
          order_ref: scan.order_ref,
          outcome: row?.validity ?? 'REJECTED_HORIZON',
          counts_toward_level: row?.counts_toward_level ?? false,
          replay: false,
          order_state: state.rows[0]?.state,
        };
      } catch (e) {
        if ((e as { code?: string }).code === '23505') {
          // Lost the race to our own concurrent retry — read the winner.
          return this.processScan(req, scan);
        }
        throw e;
      }
    });
  }

  private rejected(scan: ScanItem, outcome: string): SyncOutcome {
    return {
      nonce: scan.nonce,
      order_ref: scan.order_ref,
      outcome,
      counts_toward_level: false,
      replay: false,
    };
  }

  // ----------------------------------------------------------------- Event A

  /** POST /v1/seller/orders/{id}/custody-transfer — the seller's side. */
  async custodyTransfer(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    courierAccountId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.handoff:custody_transfer');
    const assigned = await sql<{ id: string }>`
      SELECT a.id FROM core.order_courier_assignment a
        JOIN core."order" o ON o.id = a.order_id
       WHERE a.order_id = ${orderId} AND a.courier_account_id = ${courierAccountId}
         AND a.ended_at IS NULL AND o.seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!assigned.rows[0]) throw new AdulisException('NOT_FOUND');
    await sql`
      INSERT INTO core.courier_custody_transfer
        (id, order_id, courier_account_id, seller_confirmed_at)
      VALUES (${randomUUID()}, ${orderId}, ${courierAccountId}, now())
      ON CONFLICT DO NOTHING`.execute(trx);
    await sql`
      UPDATE core.courier_custody_transfer SET seller_confirmed_at = coalesce(seller_confirmed_at, now())
       WHERE order_id = ${orderId} AND courier_account_id = ${courierAccountId}`.execute(trx);
    return { seller_confirmed: true };
  }

  /** POST /v1/courier/orders/{id}/custody-accept — Event A, courier side. */
  async custodyAccept(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    // The courier's isolation is ROW-LEVEL SECURITY keyed on the actor
    // role, resolved per request — a WHERE clause in a service is exactly
    // what S6.9 forbids relying on. The read below returns rows only for
    // currently assigned orders.
    const visible = await sql<{ id: string }>`
      SELECT id FROM core."order" WHERE id = ${orderId}`.execute(trx);
    if (!visible.rows[0]) throw new AdulisException('NOT_FOUND');
    await sql`
      INSERT INTO core.courier_custody_transfer
        (id, order_id, courier_account_id, courier_confirmed_at)
      VALUES (${randomUUID()}, ${orderId}, ${req.ctx?.accountId}, now())
      ON CONFLICT DO NOTHING`.execute(trx);
    await sql`
      UPDATE core.courier_custody_transfer SET courier_confirmed_at = coalesce(courier_confirmed_at, now())
       WHERE order_id = ${orderId} AND courier_account_id = ${req.ctx?.accountId}`.execute(trx);
    return { courier_confirmed: true };
  }

  /** GET /v1/courier/orders — currently assigned only, by RLS. */
  async courierOrders(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    void req;
    const r = await sql<Record<string, unknown>>`
      SELECT o.id, o.state::text, o.expires_at, s.store_name
        FROM core."order" o
        JOIN core.seller s ON s.id = o.seller_id
       ORDER BY o.created_at DESC
       LIMIT 50`.execute(trx);
    return { data: r.rows };
  }

  /**
   * GET /v1/courier/orders/{id} — buyer name/phone for THAT order only;
   * the QR appears ONLY once custody has been accepted (R25): before the
   * courier holds the goods, the data is ABSENT, not hidden by a client.
   */
  async courierOrder(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
  ): Promise<unknown> {
    const r = await sql<Record<string, unknown>>`
      SELECT o.id, o.state::text, o.expires_at,
             a.phone_e164 AS buyer_phone,
             s.store_name
        FROM core."order" o
        JOIN core.account a ON a.id = o.buyer_account_id
        JOIN core.seller s ON s.id = o.seller_id
       WHERE o.id = ${orderId}`.execute(trx);
    const order = r.rows[0];
    if (!order) throw new AdulisException('NOT_FOUND');

    const custody = await sql<{ courier_confirmed_at: Date | null }>`
      SELECT courier_confirmed_at FROM core.courier_custody_transfer
       WHERE order_id = ${orderId}
         AND courier_account_id = ${req.ctx?.accountId}`.execute(trx);
    const hasCustody = custody.rows[0]?.courier_confirmed_at != null;

    let qr: unknown = null;
    if (hasCustody) {
      const t = await sql<{ nonce: string; signing_key_version: number }>`
        SELECT nonce, signing_key_version FROM core.order_qr_token
         WHERE order_id = ${orderId}`.execute(trx);
      if (t.rows[0]) {
        qr = {
          order_ref: orderId,
          nonce: t.rows[0].nonce,
          signing_key_version: t.rows[0].signing_key_version,
          signature: qrSignature(orderId, t.rows[0].nonce, t.rows[0].signing_key_version),
        };
      }
    }
    return { ...order, custody_accepted: hasCustody, qr };
  }

  /** POST /v1/seller/orders/{id}/courier-assignment */
  async assignCourier(
    trx: Transaction<Database>,
    req: AuthedRequest,
    orderId: string,
    courierAccountId: string,
  ): Promise<unknown> {
    await assertPermission(trx, req, 'seller.couriers:manage');
    const owns = await sql<{ id: string }>`
      SELECT o.id FROM core."order" o
       WHERE o.id = ${orderId} AND o.seller_id = ${req.ctx?.sellerId}`.execute(trx);
    if (!owns.rows[0]) throw new AdulisException('NOT_FOUND');
    const courier = await sql<{ account_id: string }>`
      SELECT account_id FROM core.seller_courier
       WHERE seller_id = ${req.ctx?.sellerId} AND account_id = ${courierAccountId}
         AND revoked_at IS NULL`.execute(trx);
    if (!courier.rows[0]) {
      throw new AdulisException('VALIDATION_FAILED', {
        status: 409,
        slots: { reason: 'NOT_A_COURIER_OF_THIS_SELLER' },
      });
    }
    await sql`
      INSERT INTO core.order_courier_assignment (id, order_id, courier_account_id)
      VALUES (${randomUUID()}, ${orderId}, ${courierAccountId})
      ON CONFLICT DO NOTHING`.execute(trx);
    return { assigned: courierAccountId };
  }
}
