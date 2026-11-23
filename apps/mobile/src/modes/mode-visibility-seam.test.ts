import { productionSources, type SourceFile } from '../testing/source-scan';

/**
 * The seam where a release-visibility decision (founder decision D-08: should a Buyer-only release hide
 * Switch to Seller) would be applied, pinned so it stays ONE place (BUY-02). This test chooses no policy:
 * it only fails if a second button, a second route guard or a second reading of the server's
 * seller_companion fact appears, because each of those would have to be found and changed by hand when
 * the decision is made.
 *
 * Where the decision would go: `resolveAvailableModes` (modes/modes.ts) decides which modes exist, and
 * `useAvailableModes` (modes/ModeLayout.tsx) feeds it; both the Switch to Seller button and the /seller
 * and /courier route guards read that one answer. A build-mode input would be one more parameter beside
 * `devDiagnostics`.
 */

const sources = productionSources('.');
/** The code of a file: comments removed, so a sentence that names a function is not a use of it. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const filesWith = (files: readonly SourceFile[], pattern: RegExp) =>
  files.filter(({ text }) => pattern.test(code(text))).map(({ file }) => file).sort();

describe('the scan itself', () => {
  it('reads the app and finds a known site', () => {
    expect(sources.length).toBeGreaterThan(100);
    expect(filesWith(sources, /resolveAvailableModes/)).toContain('modes/modes.ts');
  });

  it('would notice a second site (proved on a sample)', () => {
    const sample: SourceFile[] = [
      { file: 'a.tsx', text: "t('seller.mode.switch_to_seller')" },
      { file: 'b.tsx', text: "t('seller.mode.switch_to_seller')" },
    ];
    expect(filesWith(sample, /seller\.mode\.switch_to_seller/)).toEqual(['a.tsx', 'b.tsx']);
  });
});

describe('release visibility of the other modes has one seam', () => {
  it('draws Switch to Seller in exactly one place: the You tab', () => {
    expect(filesWith(sources, /seller\.mode\.switch_to_seller/)).toEqual(['app/(buyer)/(tabs)/account.tsx']);
  });

  it('decides which modes exist in exactly one function, called from exactly one hook', () => {
    expect(filesWith(sources, /\bresolveAvailableModes\s*\(/)).toEqual(['modes/ModeLayout.tsx', 'modes/modes.ts']);
  });

  it('reads the server\'s seller_companion fact only in the hook, the bootstrap types and the development screen', () => {
    expect(filesWith(sources, /\.seller_companion\b|\bseller_companion\s*[:?]/)).toEqual([
      'app/dev/index.tsx',
      'modes/ModeLayout.tsx',
      'testing/fake-api.ts',
    ]);
  });

  it('asks which modes exist in four places only: the You tab, the dev screen, the hook and the mode shell', () => {
    expect(filesWith(sources, /\buseAvailableModes\s*\(/)).toEqual([
      'app/(buyer)/(tabs)/account.tsx',
      'app/dev/index.tsx',
      'modes/ModeLayout.tsx',
      'modes/ModeShell.tsx',
    ]);
  });

  it('has no build-mode or environment switch for it today (the only environment input is __DEV__)', () => {
    expect(filesWith(sources, /process\.env\.EXPO_PUBLIC_(?!API_BASE_URL)\w+/)).toEqual([]);
    expect(filesWith(productionSources('modes'), /__DEV__/)).toEqual(['modes/ModeLayout.tsx']);
  });
});
