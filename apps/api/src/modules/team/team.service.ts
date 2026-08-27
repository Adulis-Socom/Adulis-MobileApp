import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';
import type { AuthedRequest } from '../../common/auth/auth.guard';

/**
 * C6 — team (12.12). Business tier; Owner/Admin only, which is exactly
 * what the matrix's seller.staff:admin grant says, and the entitlement is
 * billing.fn_effective_limit('TEAM_SEATS') — never a stored boolean.
 *
 * Invitation is by phone and requires the invitee to hold an account: a
 * team member authenticates with their OWN number (ADU-AUTH-01 section 12),
 * so an account is the thing being granted a role, and a phone Adulis has
 * never seen has no account to grant it to (404 — recorded; the invite-
 * before-first-sign-in flow is not written in any document).
 */

const first = <T>(rows: readonly T[]): T | undefined => rows[0];

const ctxOf = (req: AuthedRequest): { accountId: string; sellerId: string; audience: string } => ({
  accountId: req.ctx?.accountId as string,
  sellerId: req.ctx?.sellerId as string,
  audience: (req.ctx?.audience as string) ?? '',
});

@Injectable()
export class TeamService {
  async list(trx: Transaction<Database>, req: AuthedRequest): Promise<unknown> {
    const { accountId, sellerId, audience } = ctxOf(req);
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.staff:admin', ${audience}::core.session_audience)`.execute(trx);
    const r = await sql<Record<string, unknown>>`
      SELECT tm.id, tm.role, tm.suspended_at, tm.created_at,
             a.phone_e164 AS phone
        FROM core.seller_team_member tm
        JOIN core.account a ON a.id = tm.account_id
       WHERE tm.seller_id = ${sellerId} AND tm.revoked_at IS NULL
       ORDER BY tm.created_at`.execute(trx);
    const seats = await sql<{ limit: { allowed: boolean; cap: number | null } }>`
      SELECT billing.fn_effective_limit(${sellerId}, 'TEAM_SEATS') AS "limit"`.execute(trx);
    return { data: r.rows, seats: first(seats.rows)?.limit ?? null };
  }

  async invite(
    trx: Transaction<Database>,
    req: AuthedRequest,
    body: { phone: string; role: string; step_up_challenge_id: string },
  ): Promise<unknown> {
    const { accountId, sellerId, audience } = ctxOf(req);
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.staff:admin', ${audience}::core.session_audience)`.execute(trx);
    await sql`
      SELECT core.fn_assert_step_up(${body.step_up_challenge_id},
        ${accountId}, 'TEAM_CHANGE')`.execute(trx);

    // The entitlement gate: seats come from the tier, and zero seats is
    // the non-Business answer. The error must not name a tier on mobile
    // (S18.1) — and cannot: this group is CONSOLE-only by surface.
    const seats = await sql<{ limit: { allowed: boolean; cap: number | null } }>`
      SELECT billing.fn_effective_limit(${sellerId}, 'TEAM_SEATS') AS "limit"`.execute(trx);
    const limit = first(seats.rows)?.limit;
    if (!limit?.allowed) throw new AdulisException('TIER_LIMIT_REACHED');
    const live = await sql<{ n: number }>`
      SELECT count(*)::int AS n FROM core.seller_team_member
       WHERE seller_id = ${sellerId} AND revoked_at IS NULL`.execute(trx);
    if (limit.cap !== null && (first(live.rows)?.n ?? 0) >= limit.cap) {
      throw new AdulisException('TIER_LIMIT_REACHED');
    }

    const invitee = await sql<{ id: string }>`
      SELECT id FROM core.account
       WHERE phone_e164 = ${body.phone} AND status = 'ACTIVE'`.execute(trx);
    const account = first(invitee.rows);
    if (!account) throw new AdulisException('NOT_FOUND');
    if (account.id === accountId) {
      // The Owner is owner_account_id and never a member row; inviting
      // yourself is the same shape one step removed.
      throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'phone' } });
    }

    const id = randomUUID();
    await sql`
      INSERT INTO core.seller_team_member
        (id, seller_id, account_id, role, invited_by)
      VALUES (${id}, ${sellerId}, ${account.id},
              ${body.role}::core.team_role, ${accountId})`.execute(trx);
    return { id, role: body.role };
  }

  async revoke(
    trx: Transaction<Database>,
    req: AuthedRequest,
    memberId: string,
    stepUpChallengeId: string,
  ): Promise<void> {
    const { accountId, sellerId, audience } = ctxOf(req);
    await sql`
      SELECT core.fn_has_permission(${accountId}, ${sellerId},
        'seller.staff:admin', ${audience}::core.session_audience)`.execute(trx);
    await sql`
      SELECT core.fn_assert_step_up(${stepUpChallengeId},
        ${accountId}, 'TEAM_CHANGE')`.execute(trx);
    const r = await sql`
      UPDATE core.seller_team_member SET revoked_at = now()
       WHERE id = ${memberId} AND seller_id = ${sellerId}
         AND revoked_at IS NULL`.execute(trx);
    if (Number(r.numAffectedRows ?? 0) === 0) {
      throw new AdulisException('NOT_FOUND');
    }
    // R28 needs no session revocation here: the membership lookup runs on
    // every request, so the revoked member loses every permission on the
    // next one.
  }
}
