import { productionSources } from '../testing/source-scan';

/**
 * Source guards for BUY-04 (design foundation). Each lists what exists today with the reason it is allowed, so a
 * new one cannot arrive without somebody reading the rule it touches.
 *
 * - A control with no outline of its own draws its edge in borderStrong (3:1, WCAG 1.4.11; the token's comment and
 *   components/control-outline.test.tsx). The plain `border` token (about 1.4:1) is for decoration: dividers and
 *   cards whose text identifies them.
 * - Dates come from the one helper in i18n/i18n.ts, which cannot throw in render.
 * - A spinner is named or hidden, never an unnamed element beside the text that already says "Loading".
 * - Motion the app asks for follows the reduced-motion setting.
 */

const BUYER_UI = productionSources('buyer', 'components', 'app');
const counts = (files: typeof BUYER_UI, pattern: RegExp) =>
  Object.fromEntries(
    files
      .map(({ file, text }) => [file, [...text.matchAll(pattern)].length] as const)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

describe('control edges', () => {
  it('draws no control edge in the plain border token: only these decorative edges remain', () => {
    expect(counts(BUYER_UI, /borderColor:[^,}\n]*\btheme\.color\.border\b/g)).toEqual({
      // Dividers (a rule between regions) and the tab strip underline.
      'app/(buyer)/search.tsx': 1,
      'buyer/ProductPicker.tsx': 2,
      'buyer/SavedScreen.tsx': 2, // one divider, one Collection card
      // Cards and rows whose text and spacing identify them; the edge is decoration, not the control.
      'buyer/AccountSessions.tsx': 1,
      'buyer/BuyerNotifications.tsx': 1,
      'buyer/Conversation.tsx': 2, // the composer's top rule and the Product context card
      'buyer/Conversations.tsx': 1,
      'buyer/MessageBubble.tsx': 1,
      'buyer/SceneCard.tsx': 2, // the card, and an unavailable tag's quieter edge (an available tag uses borderStrong)
      'buyer/SceneExplorer.tsx': 1,
      'buyer/SellerProfile.tsx': 2,
    });
  });

  it('would notice a control drawn in the plain token (proved on a sample)', () => {
    const sample = [{ file: 'x.tsx', text: 'style={{ borderColor: selected ? theme.color.accent : theme.color.border }}' }];
    expect(counts(sample, /borderColor:[^,}\n]*\btheme\.color\.border\b/g)).toEqual({ 'x.tsx': 1 });
    const strong = [{ file: 'x.tsx', text: 'style={{ borderColor: theme.color.borderStrong }}' }];
    expect(counts(strong, /borderColor:[^,}\n]*\btheme\.color\.border\b/g)).toEqual({});
  });
});

describe('dates', () => {
  it('are formatted only by the helpers in i18n/i18n.ts (Buyer sources; the frozen Seller sources are not read)', () => {
    expect(counts(productionSources('buyer', 'components', 'app', 'modes', 'auth'), /Intl\.DateTimeFormat/g)).toEqual({});
  });
});

describe('spinners', () => {
  it('every ActivityIndicator is named or hidden from assistive technology', () => {
    const bare = BUYER_UI.flatMap(({ file, text }) =>
      [...text.matchAll(/<ActivityIndicator\b[^>]*?\/>/g)]
        .filter((m) => !/accessibilityLabel=|importantForAccessibility="no"/.test(m[0]))
        .map(() => file),
    );
    expect(bare).toEqual([]);
  });

  it('would notice a bare spinner (proved on a sample)', () => {
    const m = '<ActivityIndicator color={c} />'.match(/<ActivityIndicator\b[^>]*?\/>/);
    expect(m && /accessibilityLabel=|importantForAccessibility="no"/.test(m[0])).toBe(false);
  });
});

describe('motion', () => {
  it('asks for no fixed modal animation: the picker follows the reduced-motion setting', () => {
    expect(counts(BUYER_UI, /animationType=["'][a-z]+["']/g)).toEqual({});
    const picker = BUYER_UI.find(({ file }) => file === 'buyer/ProductPicker.tsx');
    expect(picker?.text).toMatch(/useReduceMotion\(\)/);
    expect(picker?.text).toMatch(/animationType=\{reduceMotion \? 'none' : 'slide'\}/);
  });
});
