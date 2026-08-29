/**
 * @adulis/tokens -- PLACEHOLDER AWAITING DESIGN.
 *
 * T7 S7.2: there is no designer, and that is a constraint rather than a
 * licence. These values come from the v2 wireframes' own conventions and
 * NOTHING more: greyscale with one accent, a system font stack that
 * includes Noto Sans Ethiopic, 44x44px minimum touch targets, and small
 * spacing/radius scales. No brand, no palette, no personality -- an
 * aesthetic chosen by an agent and then inherited is harder to remove than
 * an obviously provisional one. Every value here expects to be replaced.
 *
 * VALUES ONLY -- no component (root CLAUDE.md, the three seams): a web
 * button and a React Native button share values, not code. tokens.css
 * mirrors this file as custom properties for the web surfaces.
 */

export const color = {
  // Greyscale ramp. Provisional: evenly-stepped neutral greys.
  bg: '#ffffff',
  surface: '#f6f6f6',
  border: '#d9d9d9',
  textMuted: '#5c5c5c',
  text: '#1a1a1a',
  // THE one accent. Provisional: a plain accessible blue; contrast on
  // white 8.6:1. Chosen for being obviously nobody's brand.
  accent: '#1d4ed8',
  accentText: '#ffffff',
  // State colours -- never the ONLY carrier of a state (ADU-CON-03 S15:
  // no state conveyed by colour alone).
  danger: '#b91c1c',
  success: '#15803d',
  warn: '#a16207',
} as const;

export const font = {
  // Latin first, Ethiopic second -- each family carries its own
  // unicode-range when self-hosted (ADU-CON-02 v3.1 S9); until the
  // self-hosted files land this is the system stack with Noto Sans
  // Ethiopic named so an installed copy is used for Amharic glyphs.
  family:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif",
  size: { sm: '0.875rem', base: '1rem', lg: '1.125rem', xl: '1.375rem', xxl: '1.75rem' },
  weight: { regular: 400, medium: 500, bold: 700 },
  lineHeight: { tight: 1.25, base: 1.5 },
} as const;

export const space = {
  // 4px base scale.
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '3rem',
} as const;

export const radius = { sm: '0.25rem', md: '0.5rem', lg: '0.75rem' } as const;

/** ADU-CON-03 S15 / T7 S7.2: minimum touch target, both axes. */
export const touchTarget = { min: '44px' } as const;

export const breakpoint = {
  /** ADU-CON-02: desktop sidebar at and above this; bottom bar below. */
  desktop: 1024,
} as const;
