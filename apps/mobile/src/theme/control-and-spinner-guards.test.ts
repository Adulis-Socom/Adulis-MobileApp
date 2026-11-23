import { productionSources, uiSources } from '../testing/source-scan';

/**
 * Source guards for BUY-04 (design foundation). Each lists what exists today with the reason it is allowed, so a
 * new one cannot arrive without somebody reading the rule it touches.
 *
 * - The rule for edges: a control whose edge is how it is found and chosen (an input, an option, a chip, an icon
 *   button, a row the person chooses among) draws it in borderStrong (3:1, WCAG 1.4.11; the token's own comment and
 *   components/control-outline.test.tsx). The plain \`border\` token (about 1.4:1) is for decoration only: rules
 *   between regions, and cards or rows that open something and are identified by their text.
 * - Dates come from the helpers in i18n/i18n.ts, which cannot throw in render (the frozen Seller sources are not read).
 * - A spinner is named, or hidden from both screen readers, never an unnamed element beside the text that already
 *   says "Loading".
 * - Motion the app asks for follows the reduced-motion setting, read by the parent before the picker mounts.
 * - A status line is spoken through StatusText/AlertText (an announcement), never a live region: iOS ignores a
 *   live region (the line is silent there) and Android reads it twice beside an announcement (BUY-04D).
 */

const BUYER_UI = productionSources('buyer', 'components', 'app');
const counts = (files: readonly { file: string; text: string }[], pattern: RegExp) =>
  Object.fromEntries(
    files
      .map(({ file, text }) => [file, [...text.matchAll(pattern)].length] as const)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/** A border edge (all sides, top or bottom) drawn in the plain token, across lines (Prettier wraps ternaries). */
const PLAIN_EDGE = /border(?:Top|Bottom)?Color:\s*[^,}]*?\btheme\.color\.border\b/g;

describe('control edges', () => {
  it('draws no choosable control in the plain border token: only these decorative edges remain', () => {
    expect(counts(BUYER_UI, PLAIN_EDGE)).toEqual({
      // Rules between regions (header, tab bar, composer, picker header and footer, tab strips) and the tab strip underline.
      'app/(buyer)/(tabs)/_layout.tsx': 1,
      'app/(buyer)/search.tsx': 1,
      'buyer/HomeHeader.tsx': 1,
      'buyer/ProductPicker.tsx': 2,
      'buyer/SavedScreen.tsx': 2, // one tab strip rule, one Collection card (opens a Collection; named by its text)
      'buyer/SceneExplorer.tsx': 1, // the rule above the selected Product's preview (the Product rows themselves are radios in borderStrong)
      // Cards and rows that open something or only show something, identified by their text.
      'buyer/AccountSessions.tsx': 1,
      'buyer/BuyerNotifications.tsx': 1,
      'buyer/Conversation.tsx': 2, // the composer's top rule and the Product context card
      'buyer/Conversations.tsx': 1, // a row that opens a conversation
      'buyer/MessageBubble.tsx': 1,
      'buyer/SceneCard.tsx': 2, // the card, and an unavailable tag's quieter edge (an available tag uses borderStrong)
      'buyer/SellerProfile.tsx': 2,
    });
  });

  it('would notice a control drawn in the plain token, also across lines (proved on samples)', () => {
    const wrapped = [{ file: 'x.tsx', text: 'style={{ borderColor: selected\n  ? theme.color.accent\n  : theme.color.border }}' }];
    expect(counts(wrapped, PLAIN_EDGE)).toEqual({ 'x.tsx': 1 });
    const bottom = [{ file: 'x.tsx', text: 'style={{ borderBottomColor: theme.color.border }}' }];
    expect(counts(bottom, PLAIN_EDGE)).toEqual({ 'x.tsx': 1 });
    const strong = [{ file: 'x.tsx', text: 'style={{ borderColor: theme.color.borderStrong }}' }];
    expect(counts(strong, PLAIN_EDGE)).toEqual({});
  });
});

describe('dates', () => {
  it('are formatted only by the helpers in i18n/i18n.ts (every UI source except the frozen Seller ones)', () => {
    const files = uiSources().filter(({ file }) => !file.startsWith('seller/'));
    expect(files.length).toBeGreaterThan(50);
    expect(counts(files, /Intl\.DateTimeFormat/g)).toEqual({});
  });
});

describe('spinners', () => {
  const SPINNER = /<ActivityIndicator\b[\s\S]*?\/>/g;
  /** Named, or hidden from both Android (importantForAccessibility) and iOS (accessibilityElementsHidden) screen readers. */
  const named = (element: string) =>
    /accessibilityLabel=/.test(element) || (/importantForAccessibility="no"/.test(element) && /accessibilityElementsHidden\b/.test(element));

  it('every ActivityIndicator is named or hidden from both platforms', () => {
    const bad = BUYER_UI.flatMap(({ file, text }) => [...text.matchAll(SPINNER)].filter((m) => !named(m[0])).map(() => file));
    expect(bad).toEqual([]);
  });

  it('would notice a bare spinner and one hidden on one platform only (proved on samples)', () => {
    expect(named('<ActivityIndicator color={c} />')).toBe(false);
    expect(named('<ActivityIndicator color={c} importantForAccessibility="no" />')).toBe(false);
    expect(named('<ActivityIndicator color={c} importantForAccessibility="no" accessibilityElementsHidden />')).toBe(true);
    expect(named('<ActivityIndicator color={c} accessibilityLabel={t("x")} />')).toBe(true);
  });
});

describe('motion', () => {
  it('asks for no fixed modal animation: the picker follows the reduced-motion setting its parent read', () => {
    expect(counts(BUYER_UI, /animationType=["'][a-z]+["']/g)).toEqual({});
    const picker = BUYER_UI.find(({ file }) => file === 'buyer/ProductPicker.tsx');
    expect(picker?.text).toMatch(/animationType=\{reduceMotion \? 'none' : 'slide'\}/);
    const parent = BUYER_UI.find(({ file }) => file === 'buyer/Conversation.tsx');
    expect(parent?.text).toMatch(/useReduceMotion\(\)/);
    expect(parent?.text).toMatch(/reduceMotion=\{reduceMotion\}/);
  });
});

describe('announcements', () => {
  /** A live region by either spelling: the React Native prop and the web-style alias. */
  const LIVE_REGION = /\baccessibilityLiveRegion\b|\baria-live\b/g;

  it('no screen draws a live region: status lines are StatusText or AlertText, which announce on both platforms', () => {
    const files = uiSources();
    expect(files.length).toBeGreaterThan(50);
    expect(counts(files, LIVE_REGION)).toEqual({});
  });

  it('would notice a live region on either spelling, and not an announced line (proved on samples)', () => {
    const prop = [{ file: 'x.tsx', text: '<AppText accessibilityLiveRegion="polite">{t(loading)}</AppText>' }];
    expect(counts(prop, LIVE_REGION)).toEqual({ 'x.tsx': 1 });
    const alias = [{ file: 'x.tsx', text: '<Text aria-live="polite">{x}</Text>' }];
    expect(counts(alias, LIVE_REGION)).toEqual({ 'x.tsx': 1 });
    const announced = [{ file: 'x.tsx', text: '<StatusText style={s}>{t(loading)}</StatusText><AlertText>{e}</AlertText>' }];
    expect(counts(announced, LIVE_REGION)).toEqual({});
  });
});
