import { grepMigrations, ok, bad } from './_lib.mjs';

/**
 * Appendix C check 2 — the model never generates a response.
 *
 * Guards ADU-DB-01 v1.8 section 17.1. `chat.bot_turn` carries an `intent_id` and
 * NO `generated_text` column; the body sent to a buyer is always rendered from
 * `nlu.answer_template`. There is nowhere to put model-generated prose, so none
 * can be stored or sent.
 *
 * NOTE ON CLASSIFICATION. Work order T1 section 3 lists checks 1, 3, 6, 11, 12
 * and 15 as greps and 4, 5, 7, 8, 9, 10, 13 and 14 as database queries, and omits
 * check 2 from both lists. It is a grep — Appendix C writes it as one. Reported.
 *
 * Live at Tier 2: the `chat` schema is migration 13.
 */
export default {
  id: 2,
  title: 'No generated_text / response_text on chat.bot_turn',
  source: 'ADU-DB-01 v1.8 section 17.1',
  kind: 'grep',
  liveAtTier: 2,
  expected: '0 in bot_turn',
  run({ migrations }) {
    const hits = grepMigrations(migrations, /\b(generated_text|response_text)\b/i);
    return hits.length === 0
      ? ok('0 occurrences')
      : bad(`${hits.length} occurrence(s): ${hits.slice(0, 3).join(' | ')}`);
  },
};
