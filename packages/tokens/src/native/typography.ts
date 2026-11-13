/**
 * @adulis/tokens/native -- typography for React Native.
 * ADU-MOB-03 v1.0 S2.3: D1 (`includeFontPadding` is banned and appears
 * nowhere), D2 (the default family is the LATIN one; no component sets an
 * Ethiopic-only family), D3 (three weights per family, no Light, no Italic;
 * the bundle is measured -- apps/mobile/assets/fonts/SOURCES.md), D10.
 *
 * LINE HEIGHT IS SET FROM THE ETHIOPIC METRICS, NOT THE LATIN ONES. Read from
 * the bundled files' hhea/OS/2 tables at WO-0b: Noto Sans Ethiopic content
 * height is 1.362 em (ascender 1069, descender 293, unitsPerEm 1000, no line
 * gap); Inter is 1.210 em. Every `lineHeight` below is at least
 * `size * 1.362`, rounded UP to an even number, and body sits at 1.5 to match
 * the web scale's base. A line height tuned to Latin (1.2) collides in Amharic.
 *
 * WEIGHTS ARE FAMILY NAMES, NOT `fontWeight`. React Native on Android picks a
 * custom weight by the name a file was loaded under, so `face` maps each
 * weight to the name `app/_layout.tsx` loads it as. No component sets
 * `fontWeight` against a custom family -- Android would synthesise it.
 */

/**
 * The two bundled families and the platform monospace. `mono` is the one place
 * a monospace family appears (the account number, the transaction reference,
 * the request id -- S2.3), and it is the PLATFORM face rather than a seventh
 * file: tabular digits are what the role needs and both platform monos have
 * them.
 */
export const family = {
  latin: 'Inter',
  ethiopic: 'NotoSansEthiopic',
  mono: { ios: 'Menlo', android: 'monospace' },
} as const;

/** Three, and only three (D3). */
export const weight = { regular: 400, medium: 500, bold: 700 } as const;

/** The loaded-font name for each weight of the Latin family. */
export const face = {
  regular: 'Inter',
  medium: 'Inter-Medium',
  bold: 'Inter-Bold',
} as const;

/** Measured from the bundled files. The derivation rule for `scale` reads this. */
export const metrics = {
  ethiopicContentHeight: 1.362,
  latinContentHeight: 1.21,
} as const;

/**
 * The seven size tokens of S2.3. Every size carries its own line height and no
 * component overrides it. Emphasis is WEIGHT, never colour (D6): `bodyStrong`
 * is `body` at medium.
 */
export const scale = {
  display: { size: 32, lineHeight: 44, weight: 'bold' },
  title: { size: 24, lineHeight: 34, weight: 'bold' },
  heading: { size: 20, lineHeight: 28, weight: 'medium' },
  body: { size: 16, lineHeight: 24, weight: 'regular' },
  bodyStrong: { size: 16, lineHeight: 24, weight: 'medium' },
  caption: { size: 13, lineHeight: 18, weight: 'regular' },
  mono: { size: 16, lineHeight: 24, weight: 'regular', tabular: true },
} as const;

export const typography = { family, weight, face, metrics, scale } as const;
