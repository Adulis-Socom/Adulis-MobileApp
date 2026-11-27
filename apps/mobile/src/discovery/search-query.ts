// What a typed search query becomes, and whether it may be sent. Folded to NFKC on the device (Unicode search reliability,
// carried from the archive), whitespace collapsed, characters (not UTF-16 units) counted. The bounds are PROVISIONAL named
// constants: launch search settings await the founder (DEC-IJ-09). They guard the request; they are not product policy.
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 100;

export type QueryProblem = 'too_short' | 'too_long';

export function prepareQuery(raw: string): { readonly q: string; readonly problem: QueryProblem | null } {
  const q = raw.normalize('NFKC').trim().replace(/\s+/g, ' ');
  const length = [...q].length;
  if (length < SEARCH_MIN_CHARS) return { q, problem: 'too_short' };
  if (length > SEARCH_MAX_CHARS) return { q, problem: 'too_long' };
  return { q, problem: null };
}
