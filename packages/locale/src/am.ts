import type { Catalogue } from './en';

/**
 * Amharic catalogue.
 *
 * The `Catalogue` annotation is the gate: it is `Record<MessageKey, string>`, so
 * deleting a key here or adding one to en.ts without adding it here FAILS THE
 * BUILD. See test/am-completeness.test-d.ts for the negative case.
 *
 * ---------------------------------------------------------------------------
 * THESE ARE MACHINE-TRANSLATION PLACEHOLDERS. NOT HUMAN-TRANSLATED COPY.
 *
 * ADU-CON-02 v3.0 section 9 separates two gates and this file passes only the
 * first:
 *   PRESENCE gate      — satisfied by machine translation. The type check.
 *   HUMAN-TRANSLATION  — NOT satisfied. Until it is, AM_ENABLED hides the
 *   gate                 language switcher, so no seller sees these strings.
 *
 * Do not ship the switcher on the strength of this file compiling.
 * ---------------------------------------------------------------------------
 *
 * Rendering note (ADU-PROJ-01 section 12 makes it a release gate): the mixed
 * Latin/Ethiopic render is verified with Inter + Noto Sans Ethiopic, self-hosted,
 * with per-family unicode-range — an Ethiopic-only family drops every Latin
 * glyph, so a page with one English product name renders half-blank without it.
 */
export const am: Catalogue = {
  'app.title': 'የአዱሊስ ሻጭ ኮንሶል',
  'health.ok': 'ሁሉም ሲስተሞች በመደበኛ ሁኔታ እየሠሩ ናቸው።',
  'health.degraded': 'አንዳንድ ሲስተሞች አይገኙም። እየተመለከትነው ነው።',
  'common.retry': 'እንደገና ይሞክሩ',
  'common.signOut': 'ውጣ',
};
