// What a typed search query becomes, and whether it may be sent. Recovered from the archived Search guard
// (recovery/legacy-dev-20261125, search-discovery.test.tsx BUY-06A / B23-006 / B24-017): it judges the text as the server does
// (fold to NFKC, length first in characters, then "has a letter or a digit") but SENDS THE TEXT AS TYPED, so the server decides
// on what the person wrote. Where this runtime cannot normalise, the guard steps aside for the checks that need the fold and the
// server decides. The bounds are PROVISIONAL named constants (launch search settings await the founder, DEC-IJ-09).
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 100;

export type QueryProblem = 'empty' | 'too_short' | 'too_long' | 'no_terms';

/** A letter or a digit as the server counts them. Built defensively: an engine without property escapes skips the check. */
const TERM: RegExp | null = (() => {
  try {
    return new RegExp('[\\p{L}\\p{N}]', 'u');
  } catch {
    return null;
  }
})();

function fold(text: string): string | null {
  try {
    return typeof text.normalize === 'function' ? text.normalize('NFKC') : null;
  } catch {
    return null;
  }
}

const characters = (text: string) => [...text].length;

export function prepareQuery(raw: string): { readonly q: string; readonly problem: QueryProblem | null } {
  const q = raw.trim(); // what is sent: the typed text, without surrounding white space (no-break spaces included)
  if (q === '') return { q, problem: 'empty' };
  const folded = fold(q);
  if (folded === null) {
    // No fold: the too-short guard falls back to the typed length; too-long and no-terms need the fold, so the server decides.
    return { q, problem: characters(q) < SEARCH_MIN_CHARS ? 'too_short' : null };
  }
  const length = characters(folded);
  if (length < SEARCH_MIN_CHARS) return { q, problem: 'too_short' };
  if (length > SEARCH_MAX_CHARS) return { q, problem: 'too_long' };
  if (TERM !== null && !TERM.test(folded)) return { q, problem: 'no_terms' };
  return { q, problem: null };
}
