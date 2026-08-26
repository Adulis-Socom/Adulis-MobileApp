/**
 * ADU-CON-02 v3.0 section 9 — the typed catalogue.
 *
 * en.ts DEFINES THE KEY UNION. am.ts is `Record<MessageKey, string>`, so a
 * missing Amharic string is a COMPILE ERROR, not a runtime fallback to English.
 *
 * Two rules that are easy to get wrong and expensive to undo:
 *
 * 1. WHOLE SENTENCES WITH NAMED SLOTS, NEVER FRAGMENTS. Word order differs
 *    between English and Amharic, so a sentence assembled from concatenated
 *    fragments cannot be translated correctly — it can only be translated
 *    into English word order.
 *
 * 2. NO FORMATTING IN THE CATALOGUE. All dates, numbers and currency are
 *    formatted client-side with Intl against the market timezone from
 *    /bootstrap. The wire carries {amount_minor, currency} and RFC 3339 UTC
 *    only.
 *
 * TIER 0 — a five-key starter set. The real catalogue grows one entry per
 * screen, and ADU-CON-02 section 14.5 makes both locale entries part of the
 * definition of done for every PR.
 */
export const en = {
  'app.title': 'Adulis Seller Console',
  'health.ok': 'All systems operating normally.',
  'health.degraded': 'Some systems are unavailable. We are looking into it.',
  'common.retry': 'Try again',
  'common.signOut': 'Sign out',
} as const;

/** The key union. Every other locale must satisfy exactly this set. */
export type MessageKey = keyof typeof en;

export type Catalogue = Record<MessageKey, string>;
