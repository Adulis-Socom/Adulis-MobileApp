/**
 * @adulis/tokens/native -- elevation (ADU-MOB-03 S2.4).
 * Two levels and no more: `raised` for a card, `overlay` for a sheet. Android
 * renders `elevation`; iOS renders a shadow; the token holds both. A third
 * level is a design using depth to say what a border should say.
 */
import { neutral } from '../index.ts';

export const elevation = {
  raised: {
    android: { elevation: 2 },
    ios: {
      shadowColor: neutral[900],
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
  },
  overlay: {
    android: { elevation: 8 },
    ios: {
      shadowColor: neutral[900],
      shadowOpacity: 0.16,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
  },
} as const;
