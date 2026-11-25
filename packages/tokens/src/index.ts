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
 * The neutral ramp, re-based on the CTO palette (B02-D03, DS-TOK-01). Cool greys, and the roles keep
 * their positions: 0 is the PAGE (the CTO background #F5F5F7), 50 is the RAISED surface (white, an
 * authorised variant, B02-D04), 100 is the secondary fill (#F4F5F7), 200 the border (#E5E7EB), 400 the
 * gray (#7E8494), 900 the primary (#111111). The base colours are the CTO's, unchanged; 300 and 500 to
 * 800 are derived and measured (verify:tokens fails if a pair stops clearing its target).
 */
export const neutral = {
  0: '#f5f5f7', // the page
  50: '#ffffff', // the raised surface
  100: '#f4f5f7', // secondary
  200: '#e5e7eb', // border (decorative separation)
  300: '#c8ccd5',
  400: '#7e8494', // the edge of a control: 3.4:1 on the page, 3.7:1 on white (>= 3:1 non-text)
  500: '#5b6272', // lightest text permitted (5.6:1 on the page, 6.1:1 on white)
  600: '#454b5b',
  700: '#333846',
  800: '#1f232d',
  900: '#111111', // primary and body text (17.3:1 on the page)
} as const;

export const color = {
  bg: neutral[0],
  surface: neutral[50],
  surfaceMuted: neutral[100], // the console already referenced this; now defined
  surfaceSunk: neutral[100],
  border: neutral[200],
  // The boundary of a control with no other outline (a field, a quiet button, an unchosen
  // option, an unchecked box) is how it is found, so it clears 3:1; `border` only separates.
  borderStrong: neutral[400],
  textMuted: neutral[500],
  textSecondary: neutral[700],
  text: neutral[900],

  /**
   * THE CTO PALETTE ROLES (B02-D03, DS-TOK-01), ADDED beside the legacy accent so a consumer that has
   * not migrated is not broken:
   *  - primary: the main button, headings, active states (#111111). primaryText is white on it.
   *  - secondary: secondary buttons, inputs, chips, icon buttons (#F4F5F7). Dark text on it.
   *  - highlight: the lime accent (#C4FE29) -- ONE standout action per screen, never text and never
   *    decoration. Its text is dark (#111111, 15.8:1); white on lime is 1.2:1 and forbidden. A lime
   *    fill is 1.1:1 against the page, so it is always drawn with highlightBorder.
   *  - like / dangerSolid: the CTO red (#EF4444) for destructive emphasis, hearts and indicators. It is
   *    3.5:1 on the page, so it is NEVER body text: use `danger` (the accessible #B91C1C) for text.
   */
  primary: neutral[900],
  primaryHover: neutral[800],
  primaryActive: neutral[700],
  primaryText: '#ffffff',
  secondary: neutral[100],
  secondaryHover: neutral[200],
  secondaryActive: neutral[300],
  secondaryText: neutral[900],
  highlight: '#c4fe29',
  highlightHover: '#b5ef18',
  highlightActive: '#a5dd0a',
  highlightText: '#111111',
  highlightBorder: neutral[900],
  like: '#ef4444',
  dangerSolid: '#ef4444',

  /**
   * LEGACY ACCENT -- the action blue every surface was built on. Kept, unchanged, so the unmigrated
   * surfaces (Mobile reads it as link and active-state colour) are not changed by a shared-token PR.
   * New work uses primary, secondary and highlight; this role is retired when the last surface moves.
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
  danger: '#b91c1c', // the accessible danger TEXT (B02-D04): 6.5:1 on white, 5.9:1 on the page
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

/**
 * THE DARK RAMP (T20 S6.3). Warm like the light one, and NOT an inversion of
 * it: pure black under a bright panel produces halation around text on the
 * cheap OLED and LCD panels this is built for, so 0 is a very dark warm grey
 * rather than #000000, and the steps compress at the top because the eye
 * separates light values on a dark field less well than the reverse.
 *
 * The roles below map onto it with the SAME NAMES as the light set. That is the
 * whole requirement: a mode is a second value for a name, never a second name.
 * A `colorDark.textMuted` that had no `color.textMuted` twin would be a token
 * no design tool could express as a mode and no component could switch on.
 */
export const neutralDark = {
  0: '#14120f', // the page
  50: '#1c1a16', // raised surface
  100: '#26231e',
  200: '#332f28', // border
  300: '#453f36',
  400: '#746d61', // the edge of a control: at least 3:1 on the page and on a raised surface
  500: '#8b8478', // lightest text permitted on the page (~4.9:1)
  600: '#a9a296',
  700: '#c8c2b7',
  800: '#e2ddd4',
  900: '#f5f2ec', // body text (~16:1 on the page)
} as const;

/**
 * The dark mode's values, key for key with `color` above.
 *
 * TWO THINGS INVERT THAT ARE EASY TO MISS, and both are why this is a hand-made
 * set rather than a computed inversion:
 *
 * 1. `accentText` FLIPS TO NEAR-BLACK. On a dark page the accent has to be
 *    light enough to read as link text against the page (~9:1), and a fill that
 *    light cannot carry white text. The same token name therefore means "white"
 *    in one mode and "almost black" in the other, which is correct: it is
 *    defined as *the text that sits on the accent*, not as a colour.
 * 2. HOVER AND ACTIVE GET LIGHTER, not darker. Darkening a control on a dark
 *    ground moves it toward the background -- the affordance reads as the
 *    control receding when it should advance.
 *
 * The semantic triples keep their meaning and none of them is the sole carrier
 * of a state (ADU-CON-03 S15); they are re-tuned rather than re-hued, so a
 * danger chip is recognisably the same chip in either mode.
 */
export const colorDark = {
  bg: neutralDark[0],
  surface: neutralDark[50],
  surfaceMuted: neutralDark[100],
  surfaceSunk: neutralDark[100],
  border: neutralDark[200],
  borderStrong: neutralDark[400],
  textMuted: neutralDark[500],
  textSecondary: neutralDark[700],
  text: neutralDark[900],

  // The CTO roles in the dark mode that already existed (B02-D03 adds no new dark theme; it gives each
  // new role the twin that mode parity requires). Hover and active get lighter on a dark ground.
  primary: neutralDark[900],
  primaryHover: '#ffffff',
  primaryActive: '#ffffff',
  primaryText: '#14120f',
  secondary: neutralDark[100],
  secondaryHover: neutralDark[200],
  secondaryActive: neutralDark[300],
  secondaryText: neutralDark[900],
  highlight: '#c4fe29',
  highlightHover: '#d3ff5c',
  highlightActive: '#dcff80',
  highlightText: '#111111',
  highlightBorder: '#c4fe29',
  like: '#f87171',
  dangerSolid: '#f87171',

  accent: '#8ab0ff',
  accentHover: '#a4c2ff',
  accentActive: '#bcd3ff',
  accentText: '#14120f',
  accentSubtle: '#1b2740',

  danger: '#ff9a90',
  dangerBg: '#2b1512',
  dangerBorder: '#7d2a22',
  success: '#58d29b',
  successBg: '#0e2419',
  successBorder: '#1f5c3f',
  warn: '#fbbf5c',
  warnBg: '#2a1d09',
  warnBorder: '#7a5314',
  info: '#8ab0ff',
  infoBg: '#1b2740',
  infoBorder: '#33509c',
} as const;

/**
 * The two modes, addressable by name. `light` is `color`; nothing is duplicated.
 * A consumer that needs to enumerate modes (a design-tool export, a theme
 * switcher, the test that asserts the two sets have identical keys) reads this.
 */
export const colorModes = { light: color, dark: colorDark } as const;

export type ColorMode = keyof typeof colorModes;
export type ColorRole = keyof typeof color;

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
  /**
   * 12px, ADDED T20 S6.3, and it is a gap being closed rather than a step being
   * invented. The scale ran 4, 8, 16 -- so the console's storefront preview,
   * needing the step between sm and md, wrote `var(--space-3, 0.75rem)` against
   * a variable that does not exist in this package or anywhere else. It did
   * that twenty-two times. Twenty-two authored uses of a value is the evidence
   * that the scale was missing a step, not that the author was careless.
   */
  smd: '0.75rem',
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
 * (T14 S7.2). A 2px ring at 2px offset reads on every surface; since DS-TOK-01 it is the PRIMARY
 * (#111111: 17.3:1 on the page, 15.8:1 on lime), because the lime accent cannot be seen on white. Applied
 * keyboard-only (:focus-visible) in tokens.css so a mouse click does not ring.
 */
export const focus = {
  ringWidth: '2px',
  ringOffset: '2px',
  ringColor: color.primary,
} as const;

/**
 * THE DARK MODE'S FOCUS RING (T21 S2, D-271), and it is a correction rather
 * than an addition.
 *
 * `focus.ringColor` above is `color.accent`, which TypeScript evaluates to the
 * LIGHT accent (#1e40af) at the point of definition and freezes there. The CSS
 * twin wrote `--adu-focus-ring-color: var(--adu-color-accent)` and kept the
 * reference LIVE, so the dark blocks' accent moved it. The two files therefore
 * disagreed in dark mode, and the disagreement was the whole point of the
 * token: a 2px ring of #1e40af on a #14120f page is a focus indicator the
 * colour of the ground it sits on -- rule 5's "visible" failing in exactly the
 * mode the ring is hardest to see.
 *
 * The web surfaces read tokens.css and were never wrong. ANYTHING READING THIS
 * FILE WAS, and React Native has no other source -- which is the same shape as
 * D-259, where the console referenced variables that existed nowhere and every
 * fallback rendered a literal that looked fine until a mode existed.
 *
 * Same names, second values -- the `colorModes` shape, for the same reason: a
 * mode is a second VALUE for a name, never a second name, and a design tool
 * cannot express as a mode anything that does not have a twin.
 */
export const focusDark = {
  ringWidth: focus.ringWidth,
  ringOffset: focus.ringOffset,
  ringColor: colorDark.primary,
} as const;

/** The two modes, addressable by name -- the `colorModes` precedent. */
export const focusModes = { light: focus, dark: focusDark } as const;

export const breakpoint = {
  /** ADU-CON-02: sidebar at and above; bottom bar below. */
  desktop: 1024,
} as const;
