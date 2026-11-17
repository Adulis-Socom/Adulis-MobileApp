/**
 * Ge'ez-script text for layout and presentation tests, written as code points so the repository
 * files stay ASCII. These are display fixtures only: no product string is added or changed here.
 */
const text = (codePoints: string) => codePoints.split(' ').map((hex) => String.fromCodePoint(parseInt(hex, 16))).join('');

/** "selam" */
export const WORD = text('1230 120b 121d');
/** "selam shop": a store name of two words */
export const STORE_NAME = text('1230 120b 121d 20 1231 1245');
/** A person's name, three syllables */
export const NAME = text('12a0 1260 1260');
/** A caption of 57 characters, several words ("a very long Amharic text that takes many lines on a small phone") */
export const SENTENCE = text(
  '12ed 1205 20 1260 1323 121d 20 1228 1305 121d 20 12e8 1206 1290 20 12e8 12a0 121b 122d 129b 20 133d 1211 134d 20 1290 12cd 20 12a5 1293 20 1260 1275 1295 123d 20 1235 120d 12ad 20 120b 12ed 20 1265 12d9 20 1218 1235 1218 122e 127d 1295 20 12ed 12ed 12db 120d',
);
/** Several lines of text at 360dp and large type: the sentence, six times over. */
export const LONG = Array.from({ length: 6 }, () => SENTENCE).join(' ');
/** One unbroken run with no space to wrap at: the sentence's letters, repeated. */
export const UNBROKEN = SENTENCE.replace(/ /g, '').repeat(8);
/** Ethiopic digits 1 2 3, and twelve (ten, two). */
export const GEEZ_DIGITS = text('1369 136a 136b');
export const GEEZ_TWELVE = text('1372 136a');

/** Latin letters and digits among Ge'ez, as store names and captions really mix them. */
export const MIXED = `ADULIS ${STORE_NAME} 2026 / TikTok @selam.shop 3x`;

/** True when the text holds an Ethiopic digit (U+1369 to U+137C): the digits Intl would use for a Ge'ez numbering system. */
export const hasEthiopicDigit = (value: string) => [...value].some((c) => c.codePointAt(0)! >= 0x1369 && c.codePointAt(0)! <= 0x137c);
