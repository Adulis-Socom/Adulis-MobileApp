import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import { requestingDevice } from '../../common/http/cookies';
import type { AuthedRequest } from '../../common/auth/auth.guard';

/**
 * The requester's Market for a public read (WO-CAT-001; OVN-016, OVN-077).
 *
 * Seller handles are unique per Market only (0005: UNIQUE (market_id, handle)), so a handle
 * names a Seller only once the Market is known. The backend resolves Market context; a client
 * never names one (MKT-01 :132; no Market header exists in API-01). The evidence is the
 * mechanism the For You feed already uses, read from the database: the signed-in Account's
 * Market, else the registered device's (`core.device.market_id`, set at its first bootstrap).
 * The device header only picks a row; it cannot choose the Market that row holds.
 *
 * Null means the request carries no Market evidence (an anonymous browser with no registered
 * device, an unregistered device, a device not yet bootstrapped). No document says how such a
 * request picks a Market (STOREFRONT-02 has one host and `/s/:handle`), so callers resolve a
 * handle for it only when exactly one ACTIVE Market has that handle, and otherwise answer the
 * neutral 404: never the first matching row.
 *
 * NOT ACCESS CONTROL. Everything these reads return is public; the Market keeps an honest
 * client inside its own Market and keeps an ambiguous handle from resolving to the wrong
 * Seller. A client that sends another device's id sees that device's Market's public content.
 */
export async function requesterMarket(
  trx: Transaction<Database>,
  req: Pick<AuthedRequest, 'ctx' | 'headers'>,
): Promise<string | null> {
  const accountId = req.ctx?.accountId ?? null;
  if (accountId) {
    const r = await sql<{ market_id: string }>`
      SELECT market_id FROM core.account WHERE id = ${accountId}`.execute(trx);
    return r.rows[0]?.market_id ?? null;
  }
  const device = requestingDevice(req.headers);
  if (!device) return null;
  const r = await sql<{ market_id: string | null }>`
    SELECT market_id FROM core.device WHERE id = ${device}`.execute(trx);
  return r.rows[0]?.market_id ?? null;
}
