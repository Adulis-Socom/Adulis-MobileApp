import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 4 — the two stores stay separated.
 *
 * Guards ADU-DB-01 v1.8 sections 3 and 17.2. `nlu` holds no foreign key, and no
 * column, referencing a buyer, a seller, a conversation or an order.
 * `nlu.answer_template.seller_id` is the ONE identifier permitted there, and it
 * is a bare uuid with no foreign key to `core.seller` — "stated explicitly
 * because it is the obvious place for a well-meaning agent to add a foreign key
 * and quietly join the two stores section 15.3 requires separated".
 *
 * "Separation enforced by a structural absence is checkable in five seconds by
 * reading the DDL; separation enforced by convention is checkable by nobody."
 *
 * Live at Tier 1 and VACUOUSLY TRUE until `nlu` exists (migration 13). It is kept
 * live rather than marked pending so that the first migration to violate it fails
 * on the commit that introduces it, not one tier later.
 */
export default {
  id: 4,
  title: 'No FK from nlu into core or chat',
  source: 'ADU-DB-01 v1.8 sections 3, 17.2',
  kind: 'database',
  liveAtTier: 1,
  expected: '0 foreign keys',
  async run({ sql }) {
    const rows = await sql(`
      SELECT n.nspname || '.' || c.relname || ' -> ' || fn.nspname || '.' || fc.relname AS fk
        FROM pg_constraint k
        JOIN pg_class      c  ON c.oid  = k.conrelid
        JOIN pg_namespace  n  ON n.oid  = c.relnamespace
        JOIN pg_class      fc ON fc.oid = k.confrelid
        JOIN pg_namespace  fn ON fn.oid = fc.relnamespace
       WHERE k.contype = 'f'
         AND n.nspname  = 'nlu'
         AND fn.nspname IN ('core', 'chat')`);
    return rows.length === 0
      ? ok('0 foreign keys from nlu into core/chat')
      : bad(`${rows.length}: ${rows.map((r) => r.fk).join(', ')}`);
  },
};
