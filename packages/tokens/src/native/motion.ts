/**
 * @adulis/tokens/native -- motion (ADU-MOB-03 S2.5).
 * Three durations in milliseconds; one easing for entrances, one for exits,
 * as cubic-bezier control points so the app builds its own Easing from them.
 * D8: no animation gates a state change, and the OS reduce-motion setting turns
 * every transition into a cross-fade -- that is the consumer's rule, and these
 * values are all it may use.
 */
export const duration = { fast: 120, base: 200, slow: 320 } as const;

export const easing = {
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const motion = { duration, easing } as const;
