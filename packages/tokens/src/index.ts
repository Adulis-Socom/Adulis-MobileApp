/**
 * @adulis/tokens -- the design system's values. NO LONGER a placeholder
 * (T14 Part B). T7 S7.2's "populate from wireframes, invent nothing" is
 * withdrawn: twenty-two screens built on a placeholder is twenty-two to
 * revisit, so the real thing is defined now.
 *
 * DESIGNED FOR THE CONDITIONS, NOT A PORTFOLIO (T14 S7.1):
 *  - Sunlight and cheap mid-range Android: HIGH CONTRAST throughout. Body text
 *    is near-black; the lightest text token clears 4.5:1 on white. No grey on
 *    grey, nothing at 40% opacity that vanishes at low brightness.
 *  - Trust is the product: restraint over personality. One accent, for action,
 *    never decoration -- if it appears where nothing is clickable it is wrong.
 *  - Amharic arrives later, runs 30-50% longer, and has taller glyphs: the type
 *    scale is generous in line-height and NO layout may fix a height on text.
 *  - Data density is fine; cramped is not -- a real spacing scale, not ad-hoc px.
 *  - One thumb: 44px minimum targets.
 *
 * NO STATE IS CARRIED BY COLOUR ALONE (ADU-CON-03 S15). The semantic triples
 * below (text / bg / border) exist so a status chip reads with an icon or a
 * word in greyscale; the colour is reinforcement, never the signal.
 *
 * VALUES ONLY -- no component (root CLAUDE.md, the three seams): a web button
 * and a React Native button share values, not code. tokens.css mirrors this
 * file for the web surfaces; keep the two in step until a build step derives
 * one from the other.
 *
 * SUPERSET, NOT A RENAME: every key the placeholder exported is still here, so
 * nothing that consumed a token loses it. The design system is the ADDITIONS
 * (the ramp, the accent states, the semantic triples, focus) and the roles now
 * derive from the ramp rather than being five unrelated greys.
 */

/**
 * The neutral ramp -- REAL steps, warm (a hair of yellow reads calmer than
 * pure grey on a cheap panel). 0 is the page, 900 is body text; every step is a
 * distinguishable move, and the roles below are named positions on it.
 */
export const neutral = {
  0: '#ffffff',
  50: '#f7f6f4',
  100: '#eceae6',
  200: '#dbd8d2',
  300: '#c1bdb4',
  400: '#9c968b',
  500: '#78726a', // lightest text permitted on white (~5.3:1)
  600: '#57524b',
  700: '#3d3a34',
  800: '#272420',
  900: '#17150f', // body text (~17:1 on white)
} as const;

export const color = {
  bg: neutral[0],
  surface: neutral[50],
  surfaceMuted: neutral[100], // the console already referenced this; now defined
  surfaceSunk: neutral[100],
  border: neutral[200],
  borderStrong: neutral[300],
  textMuted: neutral[500],
  textSecondary: neutral[700],
  text: neutral[900],

  /**
   * THE one accent -- action only. A deep blue reads as trustworthy and clears
   * ~8:1 both as text on white and as white on the fill, so one hue serves
   * links and buttons. hover/active darken it; subtle is the selected-row wash.
   */
  accent: '#1e40af',
  accentHover: '#1a3a9c',
  accentActive: '#16327f',
  accentText: '#ffffff',
  accentSubtle: '#eef2ff',

  /**
   * Semantic state -- each a triple (text on white, subtle bg, border), and
   * NEVER the only carrier of the state. `text` clears 4.5:1 on white; the bg
   * and border build a chip that still reads with an icon in greyscale.
   */
  danger: '#b42318',
  dangerBg: '#fef3f2',
  dangerBorder: '#fda29b',
  success: '#05603a',
  successBg: '#ecfdf3',
  successBorder: '#a6e9c6',
  warn: '#b54708',
  warnBg: '#fffaeb',
  warnBorder: '#fedf89',
  info: '#1e40af',
  infoBg: '#eef2ff',
  infoBorder: '#c7d2fe',
} as const;

export const font = {
  // Latin first, Ethiopic second. Each family carries its own unicode-range
  // when self-hosted (ADU-CON-02 S9); until the files land this names Noto Sans
  // Ethiopic so an installed copy renders Amharic. An Ethiopic-only family is
  // never the PRIMARY.
  family:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Sans', 'Noto Sans Ethiopic', sans-serif",
  // For request ids, tokens, and amounts a person compares digit by digit.
  mono: "ui-monospace, 'SF Mono', 'Cascadia Code', 'Roboto Mono', monospace",
  size: {
    xs: '0.8125rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    xxl: '1.75rem',
    '3xl': '2.125rem',
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  // GENEROUS ON PURPOSE. Ge'ez glyphs are tall; heading 1.3 / base 1.5 keeps
  // ascenders and descenders clear at Amharic without fixing a height. `tight`
  // stays for the callers that had it.
  lineHeight: { tight: 1.25, heading: 1.3, base: 1.5, relaxed: 1.65 },
} as const;

export const space = {
  // 4px base. The placeholder's six steps are kept at their values (the console
  // renders against them); this is not the place a rescale belongs.
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
  xxl: '3rem',
} as const;

export const radius = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  full: '9999px',
} as const;

/** ADU-CON-03 S15 / T7 S7.2: minimum touch target, both axes. */
export const touchTarget = { min: '44px' } as const;

/**
 * A VISIBLE focus indicator is a11y from the first primitive, not a retrofit
 * (T14 S7.2). A 2px accent ring at 2px offset reads on every surface, and it is
 * the accent because focus is where an action is about to happen. Applied
 * keyboard-only (:focus-visible) in tokens.css so a mouse click does not ring.
 */
export const focus = {
  ringWidth: '2px',
  ringOffset: '2px',
  ringColor: color.accent,
} as const;

export const breakpoint = {
  /** ADU-CON-02: sidebar at and above; bottom bar below. */
  desktop: 1024,
} as const;
