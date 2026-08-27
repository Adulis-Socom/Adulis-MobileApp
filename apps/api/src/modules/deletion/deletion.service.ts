import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { sql, type Kysely, type Transaction } from 'kysely';
import { FINANCIAL_DATABASE } from '../../common/db/database.module';
import type { Database } from '../../common/db/database.types';
import { AdulisException, type ErrorItem } from '../../common/errors/adulis-exception';
import type { AuthedRequest } from '../../common/auth/auth.guard';
import { resolveKey } from '../../common/crypto/aead';

/**
 * C6 — seller deletion and closure (12.12), account deletion from the web
 * (12.18). The rules live in core.fn_deletion_blockers / fn_delete_seller /
 * fn_delete_account (migration 0023); this service calls them and carries
 * the one thing the database cannot compute — the keyed phone hash, whose
 * key never enters PostgreSQL (R15's doctrine).
 *
 * The ciphertext purge crosses the boundary on the FINANCIAL connection
 * (financial.purge_payout_credential), after the core transaction commits:
 * the ids are read first, the deletion commits, the purge follows. A crash
 * between the two leaves ciphertext no reader can reach (the core rows are
 * already PURGED) — recorded for the section 24 sweep.
 */

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

export function phoneHash(phone: string): Buffer {
  const key = resolveKey(process.env['IDENTITY_HASH_KEY_V1'], 'PHONE_HASH');
  return createHmac('sha256', key).update(`phone:${phone}`).digest();
}

/** The four deletion-ticket endpoints accept it; nothing else does (S11). */
export interface TicketAccount {
  readonly accountId: string;
  readonly phone: string;
  readonly ticketId: string;
}

interface BlockerRow {
  blocker: string;
  count: number;
  resolving_action: string;
}

/** The S16.9 rows in the envelope's items[] shape (section 7.2). */
const blockerItem = (row: BlockerRow, sellerId: string | null): ErrorItem => ({
  code: row.blocker,
  message_key: `deletion.blocker.${row.blocker.toLowerCase()}`,
  ...(sellerId ? { subject: { kind: 'SELLER', id: sellerId } } : {}),
  slots: { count: row.count },
  resolving_action: { kind: row.resolving_action },
});

@Injectable()
export class DeletionService {
  constructor(
    @Inject(FINANCIAL_DATABASE) private readonly financialDb: Kysely<Database>,
  ) {}

  /**
   * Resolve `Authorization: Ticket <id>` — a consumed ACCOUNT_DELETION
   * challenge within its fifteen minutes. Anything else is 401: the ticket
   * is not a session and never becomes one.
   */
  async ticketAccount(trx: Transaction<Database>, ticketId: string): Promise<TicketAccount> {
    const r = await sql<{ account_id: string; phone_e164: string }>`
      SELECT a.id AS account_id, a.phone_e164
        FROM core.otp_challenge c
        JOIN core.account a ON a.phone_e164 = c.phone_e164
       WHERE c.id = ${ticketId}
         AND c.purpose = 'ACCOUNT_DELETION'
         AND c.consumed_at IS NOT NULL
         AND c.consumed_at > now() - interval '15 minutes'
         AND a.status = 'ACTIVE'`.execute(trx);
    const row = first(r.rows);
    if (!row) throw new AdulisException('SESSION_EXPIRED');
    return { accountId: row.account_id, phone: row.phone_e164, ticketId };
  }

  /**
   * GET /v1/deletion/preview — blockers as items[], and what deletion does,
   * server-supplied so the page cannot drift from the behaviour
   * (ADU-WEB-01 S6.2).
   */
  async preview(trx: Transaction<Database>, account: TicketAccount): Promise<unknown> {
    const items = await this.accountBlockers(trx, account.accountId);
    const effects = [
      'IDENTITY_SCRUBBED',
      'RECORDS_ANONYMISED',
      'REVIEWS_ANONYMISED_NOT_DELETED',
      'VERIFICATION_RETAINED',
      'RESERVATIONS_RELEASED',
    ].map((code) => ({
      code,
      message_key: `deletion.effect.${code.toLowerCase()}`,
    }));
    return { items, effects };
  }

  /** The union the web page shows: every owned seller's S16.9 blockers,
   *  plus the buyer-side money gate (registered decision, 0023 header). */
  private async accountBlockers(
    trx: Transaction<Database>,
    accountId: string,
  ): Promise<ErrorItem[]> {
    const sellers = await sql<{ id: string; store_name: string }>`
      SELECT id, store_name FROM core.seller
       WHERE owner_account_id = ${accountId} AND status <> 'DELETED'`.execute(trx);
    const items: ErrorItem[] = [];
    for (const s of sellers.rows) {
      const b = await sql<BlockerRow>`
        SELECT * FROM core.fn_deletion_blockers(${s.id})`.execute(trx);
      for (const row of b.rows) {
        items.push(blockerItem(row, s.id));
      }
    }
    const money = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM core."order" o
       WHERE o.buyer_account_id = ${accountId}
         AND o.state IN ('PAYMENT_SUBMITTED', 'PAYMENT_CONFIRMED')`.execute(trx);
    const n = first(money.rows)?.n ?? 0;
    if (n > 0) {
      items.push(
        blockerItem(
          { blocker: 'BUYER_ORDERS_IN_PAYMENT', count: n, resolving_action: 'AWAIT_ORDER_SETTLEMENT' },
          null,
        ),
      );
    }
    return items;
  }

  /**
   * POST /v1/deletion/confirm — core.fn_delete_account re-verifies the
   * ticket and every blocker inside its own transaction; the API's own
   * read above is presentation, not enforcement.
   */
  async confirmAccountDeletion(
    trx: Transaction<Database>,
    account: TicketAccount,
  ): Promise<{ purge: () => Promise<void> }> {
    const details = await sql<{ id: string }>`
      SELECT pd.id FROM core.payout_details pd
        JOIN core.seller s ON s.id = pd.seller_id
       WHERE s.owner_account_id = ${account.accountId}`.execute(trx);
    const ids = details.rows.map((d) => d.id);

    const blockers = await this.accountBlockers(trx, account.accountId);
    if (blockers.length > 0) {
      throw new AdulisException('DELETION_BLOCKED', { items: blockers });
    }

    await sql`
      SELECT core.fn_delete_account(
        ${account.accountId}, ${account.ticketId},
        ${phoneHash(account.phone)})`.execute(trx);

    return { purge: () => this.purgeCredentials(ids) };
  }

  /** GET /v1/seller/deletion/blockers — 200 with items[], a state (S16.9). */
  async sellerBlockers(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(
        ${accountId}, ${sellerId}, 'seller.account:delete',
        ${req.ctx?.audience ?? ''}::core.session_audience)`.execute(trx);
    const b = await sql<BlockerRow>`
      SELECT * FROM core.fn_deletion_blockers(${sellerId})`.execute(trx);
    return { items: b.rows.map((row) => blockerItem(row, sellerId)) };
  }

  /** POST /v1/seller/deletion — Owner only, step-up SELLER_DELETION. */
  async deleteSeller(
    trx: Transaction<Database>,
    req: AuthedRequest,
    stepUpChallengeId: string,
  ): Promise<{ purge: () => Promise<void> }> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;

    const acc = await sql<{ phone_e164: string }>`
      SELECT phone_e164 FROM core.account WHERE id = ${accountId}`.execute(trx);
    const phone = first(acc.rows)?.phone_e164;
    if (!phone) throw new AdulisException('INTERNAL');

    const details = await sql<{ id: string }>`
      SELECT id FROM core.payout_details WHERE seller_id = ${sellerId}`.execute(trx);
    const ids = details.rows.map((d) => d.id);

    const blockers = await sql<BlockerRow>`
      SELECT * FROM core.fn_deletion_blockers(${sellerId})`.execute(trx);
    if (blockers.rows.length > 0) {
      // The function would raise 23001 anyway; surfacing the rows here
      // gives the 409 its items[] so the seller sees exactly which.
      throw new AdulisException('DELETION_BLOCKED', {
        items: blockers.rows.map((row) => blockerItem(row, sellerId)),
      });
    }

    await sql`
      SELECT core.fn_delete_seller(
        ${sellerId}, ${accountId},
        ${req.ctx?.audience ?? ''}::core.session_audience,
        ${stepUpChallengeId}, ${phoneHash(phone)})`.execute(trx);

    return { purge: () => this.purgeCredentials(ids) };
  }

  private async purgeCredentials(detailsIds: string[]): Promise<void> {
    if (detailsIds.length === 0) return;
    await sql`
      SELECT financial.purge_payout_credential(
        ${sql.val(detailsIds)}::uuid[])`.execute(this.financialDb);
  }

  /** POST /v1/seller/closure — ACTIVE -> CLOSING. New reservations stop
   *  because fn_create_order requires ACTIVE; existing orders are untouched. */
  async enterClosure(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(
        ${accountId}, ${sellerId}, 'seller.store:write',
        ${req.ctx?.audience ?? ''}::core.session_audience)`.execute(trx);
    const r = await sql<{ status: string }>`
      UPDATE core.seller SET status = 'CLOSING', updated_at = now()
       WHERE id = ${sellerId} AND status = 'ACTIVE'
       RETURNING status`.execute(trx);
    if (!first(r.rows)) {
      const cur = await sql<{ status: string }>`
        SELECT status FROM core.seller WHERE id = ${sellerId}`.execute(trx);
      const status = first(cur.rows)?.status;
      if (status === 'CLOSING') return { status: 'CLOSING' };
      throw new AdulisException('ILLEGAL_TRANSITION', {
        slots: { from: status ?? 'UNKNOWN', to: 'CLOSING' },
      });
    }
    return { status: 'CLOSING' };
  }

  /** DELETE /v1/seller/closure — reversible by design. */
  async leaveClosure(trx: Transaction<Database>, req: AuthedRequest): Promise<void> {
    const accountId = req.ctx?.accountId as string;
    const sellerId = req.ctx?.sellerId as string;
    await sql`
      SELECT core.fn_has_permission(
        ${accountId}, ${sellerId}, 'seller.store:write',
        ${req.ctx?.audience ?? ''}::core.session_audience)`.execute(trx);
    const r = await sql<{ status: string }>`
      UPDATE core.seller SET status = 'ACTIVE', updated_at = now()
       WHERE id = ${sellerId} AND status = 'CLOSING'
       RETURNING status`.execute(trx);
    if (!first(r.rows)) {
      const cur = await sql<{ status: string }>`
        SELECT status FROM core.seller WHERE id = ${sellerId}`.execute(trx);
      const status = first(cur.rows)?.status;
      if (status === 'ACTIVE') return; // idempotent: already open
      throw new AdulisException('ILLEGAL_TRANSITION', {
        slots: { from: status ?? 'UNKNOWN', to: 'ACTIVE' },
      });
    }
  }
}
