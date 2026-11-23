import { productionSources } from '../testing/source-scan';

/**
 * Static guards over the Buyer UI's sources. Each one lists what exists today with the reason it is
 * allowed, so a new colour literal, fixed height, text clamp, font setting or animation cannot arrive
 * without somebody reading the rule it touches (no height on text, theme colours only, text scales
 * with the system, motion is named).
 */

const UI_DIRS = ['buyer', 'components', 'app'];
const sources = productionSources(...UI_DIRS);
const WIDER = productionSources(...UI_DIRS, 'theme', 'providers', 'modes', 'auth');

/** Every match of `pattern` (capture group 1, or the whole match) as `file :: text`, sorted. */
function found(files: typeof sources, pattern: RegExp) {
  return files
    .flatMap(({ file, text }) => [...text.matchAll(pattern)].map((m) => `${file} :: ${(m[1] ?? m[0]).trim()}`))
    .sort();
}
const listed = (entries: readonly (readonly [file: string, value: string, why: string])[]) =>
  entries.map(([file, value]) => `${file} :: ${value}`).sort();

describe('the scan itself', () => {
  it('reads the Buyer UI sources', () => {
    expect(sources.length).toBeGreaterThan(40);
    expect(sources.every(({ file }) => !/\.test\./.test(file))).toBe(true);
    expect(sources.some(({ file }) => file === 'components/Button.tsx')).toBe(true);
    expect(sources.some(({ file }) => file.startsWith('app/'))).toBe(true);
  });
});

describe('colour', () => {
  it('has no hex, rgb or hsl literal: every colour is a theme role', () => {
    expect(found(WIDER, /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\(/g)).toEqual([]);
  });

  it('has no named colour (transparent excepted) given to a colour property', () => {
    expect(found(WIDER, /[cC]olor\s*[:=]\s*[^,}\n]*['"](?!transparent['"])[a-z]+['"]/g)).toEqual([]);
  });

  it('has no elevation or shadow: the tokens define no elevation scale', () => {
    expect(found(WIDER, /\b(elevation|shadowColor|shadowOffset|shadowOpacity|shadowRadius|boxShadow)\b/g)).toEqual([]);
  });
});

describe('type', () => {
  it('sets no font family: Latin and Ge\'ez text both use the platform default', () => {
    expect(found(WIDER, /fontFamily|font-family/g)).toEqual([]);
  });

  it('never opts text out of system font scaling, caps it or shrinks it to fit', () => {
    expect(found(WIDER, /allowFontScaling|maxFontSizeMultiplier|adjustsFontSizeToFit|minimumFontScale/g)).toEqual([]);
  });
});

/**
 * Every fixed `height` or `maxHeight`, and every `minHeight` that is not the touch target. A fixed
 * height on text is the failure (Ge'ez runs longer and taller, and large type grows both); these hold
 * an icon, an image, a spacer, or text that cannot outgrow its box. A new one must be added here with
 * its reason, which is the moment to check it against that rule.
 */
const FIXED_HEIGHTS = [
  ['buyer/CardSaveButton.tsx', 'height: size', 'icon-only round button: its size already grows with the system text size'],
  ['buyer/Conversation.tsx', 'maxHeight: COMPOSER_MAX', 'cap on a ScrollView, so a long composer scrolls inside it rather than clipping'],
  ['buyer/Conversation.tsx', 'minHeight: HISTORY_MIN', 'a minimum, grows'],
  ['buyer/ForYouFeed.tsx', 'height: theme.space.md', 'list separator, no content'],
  ['buyer/ProductPicker.tsx', 'height: 56', 'product thumbnail (image)'],
  ['buyer/ProductPicker.tsx', 'height: 56', 'product thumbnail placeholder (empty)'],
  ['buyer/ProductPicker.tsx', 'minHeight: 64', 'a minimum, grows with the name and availability'],
  ['buyer/SceneCard.tsx', 'height: theme.touchTarget', 'seller avatar: a fixed circle holding at most two initials'],
  ['buyer/SceneExplorer.tsx', 'height: PREVIEW_SIZE', 'product preview (image)'],
  ['buyer/SceneExplorer.tsx', 'minHeight: PREVIEW_SIZE', 'the note for a preview photo that failed: a minimum, grows with the text'],
  ['buyer/SceneExplorer.tsx', 'minHeight: 28', 'a minimum for the number badge, grows'],
  ['buyer/SearchResults.tsx', 'height: theme.touchTarget * 1.25', 'result thumbnail (image)'],
  ['components/Checkbox.tsx', 'height: box', 'the box itself, holding one tick'],
] as const;

describe('fixed heights', () => {
  it('are exactly the listed ones, none of which sizes a block of text', () => {
    const written = sources
      .flatMap(({ file, text }) =>
        [...text.matchAll(/(?<![.\w])(height|maxHeight|minHeight)[ \t]*:[ \t]*([^,}\n]+)/g)].map((m) => ({ file, property: m[1]!, value: m[2]!.trim() })),
      )
      .filter(({ property, value }) => property !== 'minHeight' || value !== 'theme.touchTarget')
      .map(({ file, property, value }) => `${file} :: ${property}: ${value}`)
      .sort();
    expect(written).toEqual(listed(FIXED_HEIGHTS));
  });
});

describe('touch targets', () => {
  it('are never written as the number 44: the minimum size comes from theme.touchTarget', () => {
    expect(found(sources, /(?<![.\w])min(?:Height|Width)[ \t]*:[ \t]*44\b/g)).toEqual([]);
  });
});

/**
 * Numbers written straight into a size, spacing or radius rather than taken from a scale. Spacing,
 * font sizes, line heights and ordinary radii come from the theme; these are the component-private
 * sizes that have no token.
 */
const NUMERIC_LAYOUT = [
  ['buyer/ProductPicker.tsx', 'minHeight: 64', 'row minimum'],
  ['buyer/ProductPicker.tsx', 'width: 56', 'thumbnail'],
  ['buyer/ProductPicker.tsx', 'width: 56', 'thumbnail placeholder'],
  ['buyer/ProductPicker.tsx', 'height: 56', 'thumbnail'],
  ['buyer/ProductPicker.tsx', 'height: 56', 'thumbnail placeholder'],
  ['buyer/SceneExplorer.tsx', 'minWidth: 28', 'number badge'],
  ['buyer/SceneExplorer.tsx', 'minHeight: 28', 'number badge'],
  ['buyer/SceneExplorer.tsx', 'borderRadius: 14', 'number badge: half of its 28dp minimum'],
] as const;

describe('numeric layout literals', () => {
  it('are exactly the listed component-private sizes; spacing, type and radius come from the theme', () => {
    const written = sources
      .flatMap(({ file, text }) =>
        [...text.matchAll(/(?<![.\w])((?:padding|margin|gap|rowGap|columnGap|borderRadius|fontSize|lineHeight|minWidth|minHeight|width|height|maxWidth|maxHeight|top|left|right|bottom)\w*)[ \t]*:[ \t]*(-?[0-9][0-9.]*)[ \t]*(?=[,}\n])/g)].map(
          (m) => `${file} :: ${m[1]}: ${m[2]}`,
        ),
      )
      .sort();
    expect(written).toEqual(listed(NUMERIC_LAYOUT));
  });
});

/**
 * Text clamps. Each is a summary of text whose whole is also the control's accessible name and is
 * shown in full on the screen it opens; the two that lift at large type are the Product names,
 * which the 130% rule shows in full.
 */
const CLAMPS = [
  ['buyer/SceneCard.tsx', '2', 'store name on a For You card; the card label carries it whole'],
  ['buyer/SceneCard.tsx', '2', 'caption on a For You card; the card label carries it whole'],
  ['buyer/SearchResults.tsx', 'largeText ? undefined : 2', 'Product name: in full from 130% type'],
  ['buyer/SearchResults.tsx', '2', 'Scene caption in a result row; the row label carries it whole'],
  ['buyer/SearchResults.tsx', '2', 'Scene caption in a result tile; the tile label carries it whole'],
  ['buyer/SellerProfile.tsx', '2', 'Scene caption in a profile tile; the tile label carries it whole'],
  ['buyer/SellerProfile.tsx', 'largeText ? undefined : 2', 'Product name: in full from 130% type'],
] as const;

describe('text clamps', () => {
  it('are exactly the listed summaries', () => {
    expect(found(sources, /numberOfLines=\{([^}]+)\}/g)).toEqual(listed(CLAMPS));
  });
});

/**
 * Motion the app itself starts. Spinners and pull-to-refresh are drawn by the platform, scrolling to a
 * channel is not animated, and screen transitions are the navigator's. The Product picker's modal slide
 * (animationType) is the one transition the app asks for by name, and a Modal opened with a presentation style is
 * drawn by the platform; anything new must say how it follows the reduced-motion setting.
 */
// The Product picker's slide now follows the reduced-motion setting (useReduceMotion), pinned in control-and-spinner-guards.test.ts: no fixed animationType literal is allowed.
const MOTION = [] as const;

describe('motion', () => {
  it('is exactly the listed transitions, and no animation library is used', () => {
    expect(
      found(
        sources,
        /(Animated\.[A-Za-z]+|LayoutAnimation|react-native-reanimated|animationType=\{?["'][a-z]+["']|useNativeDriver|withTiming|withSpring|Easing\b|animated:\s*true|\banimation:\s*['"][a-zA-Z_]+['"])/g,
      ),
    ).toEqual(listed(MOTION));
  });

  it('never animates the channel scroll', () => {
    const scrolls = found(sources, /scrollTo\(\{[^}]*animated:\s*(?:true|false)/g);
    expect(scrolls.length).toBeGreaterThan(0);
    expect(scrolls.filter((entry) => entry.includes('animated: true'))).toEqual([]);
  });
});
