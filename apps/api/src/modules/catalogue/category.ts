import { createHash } from 'node:crypto';
import { sql, type Transaction } from 'kysely';
import type { Database } from '../../common/db/database.types';
import { AdulisException } from '../../common/errors/adulis-exception';

/**
 * The Catalogue category taxonomy as the public reads use it (WO-010; ADU-CATINV-01 v3.3 S40;
 * migration 0062). A category is named by its stable code (FASHION, COSMETICS, ELECTRONICS) and is
 * usable in a Market only when core.category_market_availability says it is available there.
 */

/** A category code as the taxonomy spells it. */
export const CATEGORY_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

const invalidCategory = () => new AdulisException('VALIDATION_FAILED', { slots: { path: 'category' } });

/** A malformed code is refused before anything is read. */
export function categoryCode(raw: unknown): string | null {
  if (raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' || !CATEGORY_CODE.test(raw)) throw invalidCategory();
  return raw;
}

/**
 * The id of the category `code`, if it is presentable (a label key, as GET /v1/categories lists
 * only those) and available in `market`; otherwise the governed refusal (VALIDATION_FAILED, path
 * category): an unknown, unlabelled, disabled or other-Market category reads alike.
 */
export async function categoryInMarket(trx: Transaction<Database>, market: string, code: string): Promise<string> {
  const r = await sql<{ id: string }>`
    SELECT c.id
      FROM core.category c
      JOIN core.category_market_availability a
        ON a.category_id = c.id AND a.market_id = ${market}::uuid AND a.is_available
     WHERE c.code = ${code} AND c.label_key IS NOT NULL`.execute(trx);
  const row = r.rows[0];
  if (!row) throw invalidCategory();
  return row.id;
}

/** Binds a category-filtered cursor to its list, Market and category: another filter refuses it. */
export function categoryBinding(scope: string, market: string, code: string): string {
  return createHash('sha256').update(`${scope}\u0000${market}\u0000${code}`).digest('base64url').slice(0, 22);
}
