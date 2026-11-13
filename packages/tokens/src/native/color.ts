/**
 * @adulis/tokens/native -- colour ROLES for React Native.
 * ADU-MOB-03 v1.0 S2.2 (the role table), D5 (semantic names, no hue names,
 * no hex outside this package), D6 (no state by colour alone).
 *
 * DERIVED, NOT DUPLICATED. Every value here is a REFERENCE into the web set in
 * ../index.ts -- the neutral ramp, the one accent, the four state hues -- so a
 * hue cannot drift between the console and the app. test/native-derivation
 * .test.mjs asserts that every hex reachable from this module is a value the
 * web set already exports; the one non-hex value (the scrim) is checked to be
 * neutral[900] with an alpha. ADU-MOB-03 F2 records the console's token
 * reconciliation as the console's work; this file is the mobile half meeting
 * the console where it already is, not a second palette.
 *
 * LIGHT ONLY AT MVP (ADU-MOB-03 S7). Dark mode is a second value map behind
 * these same role names; ../index.ts's colorDark already holds the hues.
 *
 * CONTRAST IS MEASURED, NOT EYEBALLED (S2.2): test/native-contrast.test.mjs
 * asserts 4.5:1 for every text role on every background, 3:1 for every
 * meaning-carrying non-text element, and 7:1 for the outdoor scan set.
 */
import { color as web, neutral, neutralDark } from '../index.ts';

/** The screen, cards on it, and wells inside them. */
export const bg = {
  base: neutral[0],
  raised: neutral[50],
  sunken: neutral[100],
} as const;

/**
 * The three reading weights plus text on a filled control. `disabled` is
 * neutral[600], not the console's lightest text step neutral[500]: that step
 * measures 4.41:1 on bg.raised (#78726a on #f7f6f4) and fails S2.2's 4.5:1 --
 * the contrast test found it. D6 makes a disabled control disabled in the
 * accessibility tree, NOT merely faded: text that fails contrast is unreadable
 * in sunlight whether or not it is disabled.
 */
export const text = {
  primary: neutral[900],
  secondary: neutral[700],
  disabled: neutral[600],
  inverse: neutral[0],
} as const;

/**
 * `subtle` is a divider and carries no meaning, so it may sit below 3:1.
 * `strong` is the INPUT OUTLINE and `focus` is the focus ring -- both carry
 * meaning and S2.2 requires 3:1 for them. neutral[400] measures 2.94:1 on
 * white and is deliberately NOT used; neutral[500] is the first ramp step that
 * clears the line.
 */
export const border = {
  subtle: neutral[200],
  strong: neutral[500],
  focus: web.accent,
} as const;

/**
 * `base` is the PLACEHOLDER until the brand hue is ruled (ADU-MOB-03 Q1,
 * ADU-MOB-PLAN-01 D20): it is the console's one accent, so the two surfaces
 * agree today and move together when Q1 lands. The other three derive from it
 * by Q1's stated rule -- pressed one step darker, subtle the same hue at low
 * saturation, on whichever text passes 4.5:1 against it -- and the web set
 * already carries exactly those three values.
 */
export const brand = {
  base: web.accent,
  pressed: web.accentActive,
  subtle: web.accentSubtle,
  on: web.accentText,
} as const;

/**
 * Four state families, three tokens each: a coloured background needs a text
 * colour that passes on it, and a badge needs a border that reads at 3:1 on
 * the page. The border is the hue itself rather than the console's pale chip
 * border, because ADU-MOB-03 S2.2 names "the state badge's border" as a
 * meaning-carrying element and the pale border measures under 2:1 on white.
 */
export const state = {
  info: { fg: web.info, bg: web.infoBg, border: web.info },
  success: { fg: web.success, bg: web.successBg, border: web.success },
  warning: { fg: web.warn, bg: web.warnBg, border: web.warn },
  danger: { fg: web.danger, bg: web.dangerBg, border: web.danger },
} as const;

/**
 * THE OUTDOOR SET (ADU-MOB-03 S1 item 4, S4.1). The scan happens at a gate in
 * Addis at midday: maximum contrast, no subtle grey, 7:1 rather than 4.5:1.
 * White on the warm near-black of the dark ramp measures above 17:1.
 */
export const scan = {
  frame: neutral[0],
  bg: neutralDark[0],
  on: neutral[0],
} as const;

/** Loading. The sheen is the one animation reduced-motion stops (D8). */
export const skeleton = {
  base: neutral[100],
  sheen: neutral[50],
} as const;

/**
 * Behind sheets and modals. neutral[900] (#17150f = 23, 21, 15) at 60% -- the
 * only non-hex value in this module, and the derivation test checks the triple.
 */
export const overlay = {
  scrim: 'rgba(23, 21, 15, 0.6)',
} as const;

/** Every role, addressable as one object. */
export const color = { bg, text, border, brand, state, scan, skeleton, overlay } as const;
