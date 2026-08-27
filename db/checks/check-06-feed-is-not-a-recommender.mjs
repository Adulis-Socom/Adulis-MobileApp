import { grepMigrations, ok, bad } from './_lib.mjs';

/**
 * Appendix C check 6 — the feed is a query, not a recommender.
 *
 * Guards ADU-DB-01 v1.8 section 19. The following feed is a join from `follow` to
 * `seller_activity` ordered by `occurred_at DESC`. No ranking table, no score
 * column, no impression log, no candidate generator. "A recommender cannot be
 * built by accident on a schema with nowhere to store a score."
 *
 * Scoped to the follow and feed migration rather than the whole tree, because
 * `rank` and `weight` are ordinary English words that appear in unrelated DDL.
 *
 * Live at Tier 2: follows are migration 14.
 */
export default {
  id: 6,
  title: 'No score / rank / weight / affinity on feed and follow',
  source: 'ADU-DB-01 v1.8 section 19',
  kind: 'grep',
  liveAtTier: 2,
  expected: '0 occurrences',
  run({ migrations }) {
    const scoped = migrations.filter((m) => /follow|feed|broadcast|activity/i.test(m.ddl));
    const hits = grepMigrations(scoped, /\b(score|rank|weight|affinity)\b/i);
    return hits.length === 0
      ? ok('0 occurrences in the follow/feed migration')
      : bad(`${hits.length} occurrence(s): ${hits.slice(0, 3).join(' | ')}`);
  },
};
