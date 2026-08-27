import { grepMigrations, ok, bad } from './_lib.mjs';

/**
 * Appendix C check 1 — no identity or product original is ever stored.
 *
 * Guards ADU-DB-01 v1.8 sections 7.3 and 9.5. Both are enforced by a column that
 * does not exist: uploaded originals are resized on receipt and discarded, and no
 * identity image is ever uploaded at all. "There is no column for one. Not a
 * nullable column, not an `image_url` left empty — NO COLUMN EXISTS."
 *
 * An agent adding `original_key` to "make re-processing possible later" removes a
 * data-protection guarantee without removing a line of enforcement, because there
 * was never a line to remove.
 */
export default {
  id: 1,
  title: 'No original_key / image_url / photo_url',
  source: 'ADU-DB-01 v1.8 sections 7.3, 9.5',
  kind: 'grep',
  liveAtTier: 1,
  expected: '0 occurrences',
  run({ migrations }) {
    const hits = grepMigrations(migrations, /\b(original_key|image_url|photo_url)\b/i);
    return hits.length === 0
      ? ok('0 occurrences')
      : bad(`${hits.length} occurrence(s): ${hits.slice(0, 3).join(' | ')}`);
  },
};
