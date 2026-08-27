import { ok, bad } from './_lib.mjs';

/**
 * Appendix C check 5 — append-only means the grant says so.
 *
 * ADU-DB-01 v1.10 §4: every table marked append-only in Appendix B carries BOTH
 * mechanisms — the `trg_append_only` trigger and the revoked UPDATE/DELETE —
 * "two mechanisms because the first is invisible in a migration diff and the
 * second is invisible in a permissions audit." Appendix B counts 22.
 *
 * CORRECTED AT TIER 2, BEFORE ITS FIRST LIVE RUN. The original implementation
 * asserted the two sets were IDENTICAL: every trigger-carrying table revoked,
 * and every revoked table trigger-carrying. The second direction is not the
 * invariant, and it fails on tables that are deliberately STRICTER than
 * append-only:
 *
 *   - verification.* and financial.* — adulis_app holds NO table privilege at
 *     all (check 10's invariant), so UPDATE and DELETE both read as absent;
 *   - core.order_state_transition_legal / reservation_state_transition_legal —
 *     writable only by adulis_migrate (§12.2), so the app lacks everything;
 *   - core.seller_level_state — written only by fn_recompute_seller_level
 *     (§8.1 mechanism 1: "no UPDATE grant to adulis_app").
 *
 * None of those is append-only, and none carries the trigger — a legal-table
 * UPDATE by adulis_migrate is a reviewed migration, not a forbidden mutation.
 * The doctrine is "append-only ⇒ trigger AND revoke", not "revoked ⇒
 * append-only". The check now asserts exactly that: 22 triggers, and every
 * trigger-carrying table revoked. Appendix B remains the count's source.
 */
export default {
  id: 5,
  title: 'Append-only: 22 triggers, every one with the REVOKE',
  source: 'ADU-DB-01 v1.10 section 4, Appendix B',
  kind: 'database',
  liveAtTier: 2,
  expected: '22 triggers; adulis_app holds UPDATE/DELETE on none of them',
  async run({ sql }) {
    const trig = await sql(`
      SELECT n.nspname || '.' || c.relname AS t,
             has_table_privilege('adulis_app', c.oid, 'UPDATE') AS can_update,
             has_table_privilege('adulis_app', c.oid, 'DELETE') AS can_delete
        FROM pg_trigger g
        JOIN pg_class     c ON c.oid = g.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE g.tgname = 'trg_append_only' AND NOT g.tgisinternal
       ORDER BY 1`);

    const writable = trig.filter((r) => r.can_update || r.can_delete).map((r) => r.t);
    if (trig.length === 22 && writable.length === 0) {
      return ok('22 append-only tables, every one with both mechanisms');
    }
    const parts = [];
    if (trig.length !== 22) parts.push(`${trig.length} trg_append_only trigger(s), expected 22`);
    if (writable.length > 0) {
      parts.push(`app can still write: ${writable.slice(0, 5).join(', ')}`);
    }
    return bad(parts.join('; '));
  },
};
