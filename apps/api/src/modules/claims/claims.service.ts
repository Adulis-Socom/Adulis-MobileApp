import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import type { AuthedRequest } from '../../common/auth/auth.guard';

/**
 * C7 — claims (ADU-API-01 v1.6 section 12.4; ADU-PRD-01 S14; X15).
 *
 * The evidence bundle attaches at open, by trigger, from what Adulis
 * already holds — the endpoint inserts the claim and nothing else of
 * consequence. Later evidence is a BANK RECORD: a single transaction,
 * never a statement (X15), attached by reference to a record the system
 * already stores.
 *
 * INVARIANT (X15) — no endpoint returns another party's identity. The
 * evidence export carries the requesting buyer's OWN transaction: their
 * order, their chat, their payment record. Seller identity is disclosed
 * only to lawful process, through an operator path outside this contract.
 */

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

export type ClaimTrigger =
  | 'SLA_BREACH'
  | 'STOCK_NOT_UPDATED'
  | 'GOODS_NOT_RECEIVED'
  | 'NOT_AS_DESCRIBED'
  | 'REFUND_NOT_DELIVERED';

@Injectable()
export class ClaimsService {
  /** POST /v1/claims — buyer opens; the trigger attaches the bundle. */
  async openClaim(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: { order_id: string; reservation_id?: string | undefined; trigger: ClaimTrigger },
  ): Promise<unknown> {
    const buyer = req.ctx?.accountId as string;
    const order = await sql<{ id: string }>`
      SELECT id FROM core."order"
       WHERE id = ${body.order_id} AND buyer_account_id = ${buyer}`.execute(trx);
    // Not the buyer's order: it does not exist for them (S19).
    if (!first(order.rows)) throw new AdulisException('NOT_FOUND');

    try {
      const r = await sql<{ id: string; state: string; review_deadline: Date }>`
        INSERT INTO core.claim
          (id, order_id, reservation_id, opened_by_kind, opened_by_account_id,
           trigger, state, severity)
        VALUES (${randomUUID()}, ${body.order_id}, ${body.reservation_id ?? null},
                'BUYER', ${buyer}, ${body.trigger}::core.claim_trigger,
                'AWAITING_SELLER_EVIDENCE', 'ORDINARY')
        RETURNING id, state::text AS state, review_deadline`.execute(trx);
      const row = first(r.rows);
      return { claim_id: row?.id, state: row?.state, review_deadline: row?.review_deadline };
    } catch (e) {
      if (
        (e as { code?: string }).code === '23505' &&
        (e as { constraint?: string }).constraint === 'claim_one_open_per_scope'
      ) {
        throw new AdulisException('IDEMPOTENCY_KEY_REUSED', {
          status: 409,
          slots: { constraint: 'claim_one_open_per_scope' },
        });
      }
      throw e;
    }
  }

  /** GET /v1/claims — the buyer's own, newest first. */
  async listBuyer(
    trx: Transaction<Database>,
    req: AuthedRequest,
    cursor: string | undefined,
  ): Promise<unknown> {
    const buyer = req.ctx?.accountId as string;
    const limit = 25;
    const r = await sql<Record<string, unknown> & { opened_at: Date }>`
      SELECT c.id, c.order_id, c.reservation_id, c.trigger, c.state,
             c.remedy, c.outcome, c.opened_at, c.review_deadline
        FROM core.claim c
       WHERE c.opened_by_account_id = ${buyer}
         AND (${cursor ?? null}::timestamptz IS NULL
              OR c.opened_at < ${cursor ?? null}::timestamptz)
       ORDER BY c.opened_at DESC
       LIMIT ${limit + 1}`.execute(trx);
    const data = r.rows.slice(0, limit);
    return {
      data,
      next_cursor:
        r.rows.length > limit ? data[data.length - 1]?.opened_at.toISOString() : null,
    };
  }

  /** GET /v1/seller/claims — seller-scoped; GET /v1/claims is buyer-shaped. */
  async listSeller(
    trx: Transaction<Database>,
    req: AuthedRequest,
    cursor: string | undefined,
  ): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.claims:read',
        ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
    const limit = 25;
    const r = await sql<Record<string, unknown> & { opened_at: Date }>`
      SELECT c.id, c.order_id, c.reservation_id, c.trigger, c.state,
             c.remedy, c.outcome, c.opened_at, c.review_deadline
        FROM core.claim c
        JOIN core."order" o ON o.id = c.order_id
       WHERE o.seller_id = ${sellerId}
         AND (${cursor ?? null}::timestamptz IS NULL
              OR c.opened_at < ${cursor ?? null}::timestamptz)
       ORDER BY c.opened_at DESC
       LIMIT ${limit + 1}`.execute(trx);
    const data = r.rows.slice(0, limit);
    return {
      data,
      next_cursor:
        r.rows.length > limit ? data[data.length - 1]?.opened_at.toISOString() : null,
    };
  }

  /** The claim, from whichever side the caller stands on — or 404. */
  private async claimFor(
    trx: Transaction<Database>,
    req: AuthedRequest,
    claimId: string,
  ): Promise<{ id: string; order_id: string; seller_id: string; state: string; side: 'BUYER' | 'SELLER' }> {
    const accountId = req.ctx?.accountId as string;
    const r = await sql<{
      id: string;
      order_id: string;
      seller_id: string;
      state: string;
      opened_by_account_id: string | null;
    }>`
      SELECT c.id, c.order_id, o.seller_id, c.state::text AS state,
             c.opened_by_account_id
        FROM core.claim c JOIN core."order" o ON o.id = c.order_id
       WHERE c.id = ${claimId}`.execute(trx);
    const claim = first(r.rows);
    if (!claim) throw new AdulisException('NOT_FOUND');
    if (claim.opened_by_account_id === accountId && req.ctx?.sellerId !== claim.seller_id) {
      return { ...claim, side: 'BUYER' };
    }
    if (req.ctx?.sellerId === claim.seller_id) {
      await sql`
        SELECT core.fn_has_permission(${accountId}, ${claim.seller_id},
          'seller.claims:read',
          ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);
      return { ...claim, side: 'SELLER' };
    }
    throw new AdulisException('NOT_FOUND');
  }

  /** GET /v1/claims/{id} — with its evidence set. */
  async read(trx: Transaction<Database>, req: AuthedRequest, claimId: string): Promise<unknown> {
    const claim = await this.claimFor(trx, req, claimId);
    const detail = await sql<Record<string, unknown>>`
      SELECT c.id, c.order_id, c.reservation_id, c.trigger, c.state, c.severity,
             c.remedy, c.outcome, c.outcome_reason, c.opened_at,
             c.review_deadline, c.decided_at
        FROM core.claim c WHERE c.id = ${claimId}`.execute(trx);
    const evidence = await sql<Record<string, unknown>>`
      SELECT kind, reference_id, attached_at
        FROM core.claim_evidence_item
       WHERE claim_id = ${claimId}
       ORDER BY attached_at`.execute(trx);
    return { ...first(detail.rows), viewer: claim.side, evidence: evidence.rows };
  }

  /**
   * POST /v1/claims/{id}/evidence — the bank record: a single transaction,
   * not a statement (X15). It attaches BY REFERENCE to a record the system
   * already holds; there is no upload body to launder prose through.
   */
  async attachEvidence(
    trx: Transaction<Database>,
    req: AuthedRequest,
    claimId: string,
    referenceId: string,
  ): Promise<unknown> {
    const claim = await this.claimFor(trx, req, claimId);
    if (claim.state === 'RESOLVED') {
      throw new AdulisException('ORDER_ALREADY_TERMINAL', {
        slots: { subject: 'claim' },
      });
    }
    try {
      const r = await sql<{ id: string }>`
        INSERT INTO core.claim_evidence_item (id, claim_id, kind, reference_id)
        VALUES (${randomUUID()}, ${claimId}, 'BANK_RECORD', ${referenceId})
        RETURNING id`.execute(trx);
      return { evidence_item_id: first(r.rows)?.id, kind: 'BANK_RECORD' };
    } catch (e) {
      if (
        (e as { code?: string }).code === '23505' &&
        (e as { constraint?: string }).constraint === 'one_item_per_kind_per_reference'
      ) {
        throw new AdulisException('IDEMPOTENCY_KEY_REUSED', {
          status: 409,
          slots: { constraint: 'one_item_per_kind_per_reference' },
        });
      }
      throw e;
    }
  }

  /**
   * POST /v1/claims/{id}/evidence-export — the buyer's own transaction:
   * order card, their chat with this seller, their payment record, the
   * scans. Nothing about who the seller is (X15).
   */
  async evidenceExport(
    trx: Transaction<Database>,
    req: AuthedRequest,
    claimId: string,
  ): Promise<unknown> {
    const claim = await this.claimFor(trx, req, claimId);
    if (claim.side !== 'BUYER') throw new AdulisException('NOT_FOUND');
    const buyer = req.ctx?.accountId as string;

    const order = await sql<Record<string, unknown>>`
      SELECT o.id, o.state, o.created_at, o.expires_at, o.clock_stopped_at,
             o.total_minor, o.total_currency
        FROM core."order" o WHERE o.id = ${claim.order_id}`.execute(trx);
    const lines = await sql<Record<string, unknown>>`
      SELECT r.id, r.state, r.quantity, r.unit_price_minor, r.cancelled_at
        FROM core.reservation r WHERE r.order_id = ${claim.order_id}`.execute(trx);
    const transitions = await sql<Record<string, unknown>>`
      SELECT t.from_state, t.to_state, t.occurred_at
        FROM core.order_state_transition t
       WHERE t.order_id = ${claim.order_id}
       ORDER BY t.occurred_at`.execute(trx);
    const submissions = await sql<Record<string, unknown>>`
      SELECT ps.state, ps.submitted_at, ps.decided_at
        FROM core.payment_submission ps
       WHERE ps.order_id = ${claim.order_id}
       ORDER BY ps.submitted_at`.execute(trx);
    const scans = await sql<Record<string, unknown>>`
      SELECT hs.validity, hs.signed_at, hs.received_at
        FROM core.handoff_scan hs
       WHERE hs.order_id = ${claim.order_id}
       ORDER BY hs.received_at`.execute(trx);
    const chat = await sql<Record<string, unknown>>`
      SELECT m.sender_kind, m.body, m.sent_at
        FROM chat.message m
        JOIN chat.conversation c ON c.id = m.conversation_id
        JOIN core."order" o ON o.id = ${claim.order_id}
       WHERE c.buyer_account_id = ${buyer} AND c.seller_id = o.seller_id
       ORDER BY m.sent_at`.execute(trx);

    return {
      claim_id: claimId,
      exported_at: new Date(),
      order: first(order.rows),
      lines: lines.rows,
      order_transitions: transitions.rows,
      payment_submissions: submissions.rows,
      handoff_scans: scans.rows,
      chat_history: chat.rows,
    };
  }

  /** POST /v1/seller/claims/{id}/remedy — REFUND or FULFIL, the seller's choice. */
  async remedy(
    trx: Transaction<Database>,
    req: AuthedRequest,
    claimId: string,
    remedy: 'REFUND' | 'FULFIL',
  ): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.claims:respond',
        ${(req.ctx?.audience as string) ?? ''}::core.session_audience)`.execute(trx);

    const r = await sql<{ id: string; state: string }>`
      UPDATE core.claim c
         SET remedy = ${remedy}::core.claim_remedy,
             state = CASE WHEN c.state = 'AWAITING_SELLER_EVIDENCE'
                          THEN 'UNDER_REVIEW'::core.claim_state ELSE c.state END
        FROM core."order" o
       WHERE c.id = ${claimId} AND o.id = c.order_id
         AND o.seller_id = ${sellerId}
         AND c.state <> 'RESOLVED'
       RETURNING c.id, c.state::text AS state`.execute(trx);
    const row = first(r.rows);
    if (!row) {
      // Resolved, or not this seller's: for the second the claim does not
      // exist; for the first the terminal answer is a conflict.
      const exists = await sql<{ state: string }>`
        SELECT c.state::text AS state FROM core.claim c
          JOIN core."order" o ON o.id = c.order_id
         WHERE c.id = ${claimId} AND o.seller_id = ${sellerId}`.execute(trx);
      if (first(exists.rows)) {
        throw new AdulisException('ORDER_ALREADY_TERMINAL', { slots: { subject: 'claim' } });
      }
      throw new AdulisException('NOT_FOUND');
    }
    return { claim_id: row.id, remedy, state: row.state };
  }
}
