// Mobile-local adapter over @adulis/tokens (values only, root-owned). The tokens carry rem and px strings for the web; React
// Native wants numbers. One rem is 16 points here. Colour roles pass through untouched. No hex literal appears in the app:
// colour comes from the tokens, never from a screen.
import { color, font, radius, space, touchTarget } from '@adulis/tokens';

const px = (value: string): number => (value.endsWith('px') ? Number.parseFloat(value) : Math.round(Number.parseFloat(value) * 16));

export const theme = {
  color,
  space: { xs: px(space.xs), sm: px(space.sm), smd: px(space.smd), md: px(space.md), lg: px(space.lg), xl: px(space.xl), xxl: px(space.xxl) },
  radius: { sm: px(radius.sm), md: px(radius.md), lg: px(radius.lg), full: px(radius.full) },
  /** Minimum touch target on both axes (ADU-CON-03 S15). */
  touch: px(touchTarget.min),
  // Line heights are generous on purpose (Ge'ez glyphs are tall) and NO text container fixes a height.
  text: {
    body: { fontSize: px(font.size.base), lineHeight: Math.round(px(font.size.base) * font.lineHeight.base) },
    small: { fontSize: px(font.size.sm), lineHeight: Math.round(px(font.size.sm) * font.lineHeight.base) },
    title: { fontSize: px(font.size.xl), lineHeight: Math.round(px(font.size.xl) * font.lineHeight.heading), fontWeight: '600' as const },
    heading: { fontSize: px(font.size.lg), lineHeight: Math.round(px(font.size.lg) * font.lineHeight.heading), fontWeight: '600' as const },
  },
} as const;
