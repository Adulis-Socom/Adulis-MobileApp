/**
 * @adulis/tokens/native -- the 4-point scale (ADU-MOB-03 S2.4), in dp.
 * Nothing between the steps. There is NO height token here or anywhere in this
 * package (D4): a container holding text never has a fixed height, and
 * `minHeight` is the only vertical floor a component may set.
 */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
} as const;

/**
 * Touch targets (ADU-MOB-02 S17, ADU-MOB-03 S6): 44 x 44 minimum on both axes
 * and at least 8 between adjacent targets -- the rule that keeps sign-out and
 * delete apart (ADU-MOB-02 M11).
 */
export const target = { min: 44, gap: 8 } as const;
