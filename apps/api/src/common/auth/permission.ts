import { sql, type Transaction } from 'kysely';
import type { Database } from '../db/database.types';
import type { AuthedRequest } from './auth.guard';
import { AdulisException } from '../errors/adulis-exception';

/**
 * The permission gate — `core.fn_has_permission(account, seller, code,
 * audience)` as THE FIRST STATEMENT of every seller-scoped writing handler
 * (ADU-API-01 section 13, ADU-DB-01 S6.9a).
 *
 * It returns void and raises: U0001 (suspended/revoked relationship, role
 * failure, surface failure — all identically) -> 403; U0002 (never held a
 * relationship) -> 404. The translator carries both to the wire; nothing
 * here inspects or softens them.
 *
 * Surface enforcement lives in `core.permission.surfaces`, below the
 * endpoint — a mobile session presenting at a console-only capability is
 * refused by the database, not by a guard someone forgets on the seventh
 * endpoint. The audience passed is the SESSION's, read from the row this
 * request authenticated against.
 */
export async function assertPermission(
  trx: Transaction<Database>,
  req: AuthedRequest,
  code: string,
): Promise<void> {
  const accountId = req.ctx?.accountId;
  const sellerId = req.ctx?.sellerId;
  const audience = req.auth?.audience;
  if (!accountId || !sellerId || !audience) {
    // The pipeline should have refused earlier; reaching here without a
    // full context is our defect, not the caller's.
    throw new AdulisException('INTERNAL');
  }
  await sql`SELECT core.fn_has_permission(
    ${accountId}, ${sellerId}, ${code}, ${audience})`.execute(trx);
}
