/**
 * mt-keys-lib.mjs -- how a catalogue file is read, in ONE place.
 *
 * The generator and the gate both have to answer the same two questions --
 * which keys are HUMAN-REQUIRED, and what is a key's value -- and a second
 * copy of either answer is how one of them drifts. Both were separately
 * wrong in the first version, in the same two ways:
 *
 *  1. Slicing from one key to the NEXT key attributes a JSDoc block written
 *     ABOVE key N to key N-1. A comment mentioning HUMAN-REQUIRED above a
 *     key silently gated its innocent neighbour.
 *  2. Pulling quoted strings out of raw source picks up apostrophes inside
 *     comments, so "the translator's note" became part of the value and the
 *     gate failed a byte-identical string while accusing it of being a
 *     machine translation.
 */

const KEY_RE = /^ {2}'([^']+)':/gm;

/** Every key in a catalogue, in file order, with the span of its entry. */
export function entries(source) {
  const keys = [...source.matchAll(KEY_RE)];
  return keys.map((m, i) => {
    const start = m.index ?? 0;
    const rawEnd = i + 1 < keys.length ? (keys[i + 1].index ?? source.length) : source.length;
    // Trim the trailing comment block: it belongs to the NEXT key, not this one.
    const lines = source.slice(start, rawEnd).split('\n');
    let last = lines.length;
    while (last > 0) {
      const l = lines[last - 1].trim();
      if (l === '' || l.startsWith('*') || l.startsWith('/*') || l.startsWith('//')) last -= 1;
      else break;
    }
    return { key: m[1], text: lines.slice(0, last).join('\n') };
  });
}

/** Comments removed, so a value is read as code rather than as text. */
export function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** The concatenated string literals of one key, or null. */
export function valueOf(source, key) {
  const hit = entries(source).find((e) => e.key === key);
  if (!hit) return null;
  const body = stripComments(hit.text.slice(hit.text.indexOf(':') + 1));
  const literals = [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
  return literals.length ? literals.join('') : null;
}

/** Keys whose am.ts entry carries the HUMAN-REQUIRED marker. */
export function markedHumanRequired(amSource) {
  return entries(amSource)
    .filter((e) => e.text.includes('HUMAN-REQUIRED'))
    .map((e) => e.key);
}
