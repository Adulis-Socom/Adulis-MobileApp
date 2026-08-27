import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 13 — no live market on an unratified state machine.
 *
 * Guards ADU-DB-01 v1.8 section 12.2.1. `fn_guard_market_live` fires BEFORE
 * UPDATE on `core.market` and refuses to set `is_live` while any row in either
 * transition table has `ratified_at IS NULL`.
 *
 * "Same shape as the market_phase_gate trigger, and for the same reason: a review
 * that blocks a release is a gate, and a review that is merely scheduled is a
 * hope."
 *
 * The function must exist AND be attached to `core.market`. v1.7 ratifies all 23
 * rows, so this is now a regression check rather than an outstanding item.
 *
 * Live at Tier 2: the transition tables are migration 9.
 */
export default {
  id: 13,
  title: 'fn_guard_market_live present and attached to core.market',
  source: 'ADU-DB-01 v1.8 section 12.2.1',
  kind: 'database',
  liveAtTier: 2,
  expected: 'present and attached',
  async run({ sql }) {
    const rows = await sql(`
      SELECT n.nspname || '.' || c.relname AS on_table
        FROM pg_trigger g
        JOIN pg_proc      p ON p.oid = g.tgfoid
        JOIN pg_class     c ON c.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE NOT g.tgisinternal AND p.proname = 'fn_guard_market_live'`);
    const onMarket = rows.some((r) => r.on_table === 'core.market');
    if (onMarket) return ok('attached to core.market');
    const exists = await sql(
      `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname='core' AND p.proname='fn_guard_market_live'`,
    );
    return bad(
      exists.length === 0
        ? 'function fn_guard_market_live does not exist'
        : 'function exists but is not attached to core.market',
    );
  },
};
