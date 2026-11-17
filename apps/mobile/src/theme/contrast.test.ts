import { productionSources } from '../testing/source-scan';
import { themes } from './theme';

/**
 * WCAG 2.x contrast, computed from the colours the two themes actually produce (never copies).
 * The pairs are the foreground/background combinations the Buyer UI really draws: each row names where.
 */

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
};
const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};

type Role = keyof typeof themes.light.color;
type Pair = readonly [foreground: Role, background: Role, where: string];

/** Text: 4.5:1 (WCAG 1.4.3). Every Text the Buyer UI draws is body size, none is large text. */
const TEXT_PAIRS: readonly Pair[] = [
  ['text', 'bg', 'AppText on a Screen, Loading, fields, Checkbox and ChoiceGroup labels'],
  ['text', 'surface', 'cards, the Home header, the tab bar'],
  ['text', 'surfaceMuted', 'a pressed row or secondary Button; the empty photo frame'],
  ['text', 'accentSubtle', 'the selected ChoiceGroup option, own message bubble, unread notification'],
  ['text', 'infoBg', 'the automated message bubble, the update notice'],
  ['textSecondary', 'bg', 'hints, secondary lines, empty and loading states'],
  ['textSecondary', 'surface', 'secondary lines on cards, the inactive tab label'],
  ['textSecondary', 'surfaceMuted', 'the empty photo frame message'],
  ['textSecondary', 'accentSubtle', 'secondary lines on an unread notification and an own message'],
  ['textSecondary', 'infoBg', 'secondary lines on an automated message'],
  ['textMuted', 'bg', 'the TextField placeholder'],
  ['danger', 'bg', 'a field error, the verification and deletion errors'],
  ['accent', 'bg', 'the current-session label'],
  ['accent', 'surface', 'the active tab, Remove on a Saved card'],
  ['accent', 'accentSubtle', 'the unread label on a notification'],
  ['accentText', 'accent', 'a primary Button, the Checkbox tick, a selected Scene Product number'],
  ['accentText', 'accentActive', 'a primary Button while pressed'],
];

/**
 * Non-text a Buyer needs to see: selected, unread and error outlines, the checked box, icons, the
 * spinner and the selected tab rule (WCAG 1.4.11, 3:1).
 */
const STATE_PAIRS: readonly Pair[] = [
  ['accent', 'bg', 'selected and unread outlines, the checked Checkbox, the spinner'],
  ['accent', 'surface', 'the selected Home channel rule, the active tab icon'],
  ['accent', 'accentSubtle', 'the outline of a selected option beside its own wash'],
  ['danger', 'bg', 'the error outline of a field'],
  ['text', 'surface', 'header, tab and save icons'],
  ['text', 'bg', 'icons on the page'],
  ['textSecondary', 'bg', 'search field icons'],
  ['textSecondary', 'surface', 'the inactive tab icon'],
];

/** Separators and resting outlines: no contrast target has been set for these by a token decision. */
const OUTLINE_ROLES: readonly Role[] = ['border', 'borderStrong', 'infoBorder'];

const MODES = ['light', 'dark'] as const;

describe('contrast function', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBe(1);
    // #767676 on white is the well-known smallest grey that clears 4.5:1.
    expect(contrast('#767676', '#ffffff')).toBeGreaterThan(4.5);
    expect(contrast('#777777', '#ffffff')).toBeLessThan(4.5);
  });
});

describe('colour roles', () => {
  it.each(MODES)('every role in %s is a six-digit hex colour', (mode) => {
    for (const [role, value] of Object.entries(themes[mode].color)) {
      expect({ role, value }).toEqual({ role, value: expect.stringMatching(/^#[0-9a-f]{6}$/i) });
    }
  });

  it('defines every role in both themes, with the dark theme a second value rather than a second name', () => {
    expect(Object.keys(themes.dark.color).sort()).toEqual(Object.keys(themes.light.color).sort());
    // The two themes are not the same set of colours under one set of names.
    const differing = (Object.keys(themes.light.color) as Role[]).filter(
      (role) => themes.light.color[role] !== themes.dark.color[role],
    );
    expect(differing.length).toBeGreaterThan(Object.keys(themes.light.color).length / 2);
    expect(themes.dark.color.bg).not.toBe(themes.light.color.bg);
    expect(themes.dark.color.text).not.toBe(themes.light.color.text);
  });

  it('keeps the page and its text apart in both themes (light page with dark text, dark page with light text)', () => {
    expect(luminance(themes.light.color.bg)).toBeGreaterThan(luminance(themes.light.color.text));
    expect(luminance(themes.dark.color.bg)).toBeLessThan(luminance(themes.dark.color.text));
  });
});

describe.each(MODES)('contrast in the %s theme', (mode) => {
  const color = themes[mode].color;

  it.each(TEXT_PAIRS)('text: %s on %s (%s) is at least 4.5:1', (foreground, background) => {
    expect(contrast(color[foreground], color[background])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(STATE_PAIRS)('state and icon: %s against %s (%s) is at least 3:1', (foreground, background) => {
    expect(contrast(color[foreground], color[background])).toBeGreaterThanOrEqual(3);
  });
});

describe('the pairs cover what the Buyer UI uses', () => {
  const sources = productionSources('buyer', 'components', 'app');
  const used = new Set(sources.flatMap(({ text }) => [...text.matchAll(/theme\.color\.(\w+)/g)].map((m) => m[1]!)));
  const covered = new Set<string>([...TEXT_PAIRS, ...STATE_PAIRS].flatMap(([fg, bg]) => [fg, bg]));

  it('finds the roles the screens draw with (the scan is not vacuous)', () => {
    expect(sources.length).toBeGreaterThan(40);
    expect(used.has('textSecondary')).toBe(true);
    expect(used.has('accentText')).toBe(true);
    expect(used.size).toBeGreaterThan(10);
  });

  it('has a contrast pair for every colour role a screen or shared component uses, or marks it an outline', () => {
    const unexamined = [...used].filter((role) => !covered.has(role) && !OUTLINE_ROLES.includes(role as Role)).sort();
    expect(unexamined).toEqual([]);
  });

  it('only uses roles the themes define', () => {
    expect([...used].filter((role) => !(role in themes.light.color))).toEqual([]);
  });
});
