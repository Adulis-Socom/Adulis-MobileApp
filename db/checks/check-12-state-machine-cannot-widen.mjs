import { grepMigrations, ok, bad } from './_lib.mjs';

/**
 * Appendix C check 12 — the state machine cannot widen at runtime.
 *
 * Guards ADU-DB-01 v1.8 section 12.2. `core.order_state_transition_legal` and
 * `core.reservation_state_transition_legal` are writable only by
 * `adulis_migrate`:
 *
 *     REVOKE INSERT, UPDATE, DELETE ON core.order_state_transition_legal FROM adulis_app;
 *
 * "A legal set the application can INSERT into is a state machine that widens at
 * runtime with no migration and no diff. Adding a transition is a reviewed schema
 * change or it does not happen."
 *
 * The check looks for a GRANT of a write privilege on either legal table to
 * `adulis_app`. A REVOKE naming the same tables and role is correct and must not
 * trip it, so the pattern requires GRANT specifically.
 */
export default {
  id: 12,
  title: 'No app-role write on *_state_transition_legal',
  source: 'ADU-DB-01 v1.8 section 12.2',
  kind: 'grep',
  liveAtTier: 1,
  expected: '0 occurrences',
  run({ migrations }) {
    const hits = grepMigrations(
      migrations,
      /GRANT[^;]*\b(INSERT|UPDATE|DELETE|ALL)\b[^;]*_state_transition_legal[^;]*adulis_app/i,
    );
    return hits.length === 0
      ? ok('0 write grants to adulis_app')
      : bad(`${hits.length} write grant(s): ${hits.slice(0, 3).join(' | ')}`);
  },
};
