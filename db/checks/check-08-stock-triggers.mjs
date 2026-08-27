import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 8 — stock never moves without an event.
 *
 * Guards ADU-DB-01 v1.8 section 10.1, "the single most important pair of triggers
 * in the schema". `product_variant.stock_count` is not writable at all: it is
 * maintained only by `fn_apply_stock_event` firing AFTER INSERT on
 * `core.stock_event`, and `fn_guard_stock_count` raises on any UPDATE that moves
 * the column without coming from that path.
 *
 * ADU-PROJ-01 section 13.5 names "AI-generated code wrong under concurrency" as a
 * live risk, and stock decrement under concurrency is where it would first show.
 * Both functions must exist AND be attached — a function nothing calls guards
 * nothing.
 *
 * Live at Tier 2: migration 7.
 */
export default {
  id: 8,
  title: 'fn_guard_stock_count and fn_apply_stock_event present and attached',
  source: 'ADU-DB-01 v1.8 section 10.1',
  kind: 'database',
  liveAtTier: 2,
  expected: 'both present, both attached',
  async run({ sql }) {
    const fns = await sql(`
      SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'core'
         AND p.proname IN ('fn_guard_stock_count','fn_apply_stock_event')`);
    const trg = await sql(`
      SELECT p.proname, n.nspname || '.' || c.relname AS on_table
        FROM pg_trigger g
        JOIN pg_proc      p ON p.oid = g.tgfoid
        JOIN pg_class     c ON c.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE NOT g.tgisinternal
         AND p.proname IN ('fn_guard_stock_count','fn_apply_stock_event')`);
    const have = new Set(fns.map((r) => r.proname));
    const attached = new Set(trg.map((r) => r.proname));
    const missing = ['fn_guard_stock_count', 'fn_apply_stock_event'].filter((f) => !have.has(f));
    const unattached = ['fn_guard_stock_count', 'fn_apply_stock_event'].filter((f) => !attached.has(f));
    if (missing.length === 0 && unattached.length === 0) {
      return ok(`both present and attached (${trg.map((r) => `${r.proname}@${r.on_table}`).join(', ')})`);
    }
    return bad(
      (missing.length ? `missing: ${missing.join(', ')}` : '') +
        (unattached.length ? ` not attached: ${unattached.join(', ')}` : ''),
    );
  },
};
