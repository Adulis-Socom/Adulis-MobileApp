import { grepMigrations, ok, bad } from './_lib.mjs';

/**
 * Appendix C check 3 — entitlements are resolved at read time, never stored.
 *
 * Guards ADU-DB-01 v1.8 section 18.3. The effective limit for any capability is
 * the intersection of tier entitlement and trust level, computed by
 * `billing.fn_effective_limit`. A stored boolean drifts from the subscription
 * that justified it, and the drift is silent: the seller keeps a capability they
 * stopped paying for, or loses one they did not.
 *
 * Live at Tier 2: `billing` is migration 14.
 */
export default {
  id: 3,
  title: 'No has_chatbot / can_broadcast / is_pro / blue_tick boolean',
  source: 'ADU-DB-01 v1.8 section 18.3',
  kind: 'grep',
  liveAtTier: 2,
  expected: '0 occurrences',
  run({ migrations }) {
    const hits = grepMigrations(
      migrations,
      /\b(has_chatbot|can_broadcast|is_pro)\b|\bblue_tick\s+bool/i,
    );
    return hits.length === 0
      ? ok('0 occurrences')
      : bad(`${hits.length} occurrence(s): ${hits.slice(0, 3).join(' | ')}`);
  },
};
