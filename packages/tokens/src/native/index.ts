/**
 * @adulis/tokens/native -- the React Native token set, authored from
 * ADU-MOB-03 v1.0 S2 at WO-0b (ADU-MOB-WO-01 v1.2). Values only; this
 * package imports nothing (dependency-cruiser rule `tokens-import-nothing`,
 * ADU-MOB-03 S2.1 / R-6).
 *
 * WHY A SUB-ENTRY AND NOT THE ROOT. ADU-MOB-03 S0.1 / F2 found that the
 * console had imported `@adulis/tokens` for months from a file no design
 * document had authored. That file (../index.ts) is web-shaped -- rem strings,
 * a font STACK, the console's role names -- and `ops/scripts/verify-tokens.mjs`
 * compares it to tokens.css by parsing it in place. The mobile set therefore
 * lives beside it, DERIVES its hues from it, and is exported as
 * `@adulis/tokens/native`; the console's reconciliation onto the S2.2 role
 * names is the console's work (ADU-MOB-03 Q5) and is not performed here.
 */
export { bg, text, border, brand, state, scan, skeleton, overlay, color } from './color.ts';
export { family, weight, face, metrics, scale, typography } from './typography.ts';
export { space, target } from './space.ts';
export { radius } from './radius.ts';
export { duration, easing, motion } from './motion.ts';
export { elevation } from './elevation.ts';
