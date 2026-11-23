import { productionSources, type SourceFile } from '../testing/source-scan';

/**
 * Where a release-visibility decision for the other modes would be applied, pinned so it stays ONE place (BUY-02).
 * The decision is the founder's open D-08 in the Mobile roadmap (should a Buyer-only release hide Switch to Seller; not
 * the database register's D-08). This test chooses no policy.
 *
 * What it pins (and only this): the one product entry (the You tab's Switch to Seller), the one function that decides
 * which modes exist and its one caller, the one hook that reads the server's seller_companion fact, and that no
 * `__DEV__` check or `EXPO_PUBLIC_*` mode input exists in the Seller or Courier route and gate code. It does NOT
 * catch every possible second place (a constant imported into account.tsx, say); the seam is documented, not proven
 * closed.
 *
 * Where the decision would go: `resolveAvailableModes` (modes/modes.ts) decides which modes exist, and
 * `useAvailableModes` (modes/ModeLayout.tsx) feeds it; the Switch to Seller button, the /seller route guard
 * (seller/SellerGate.tsx via useModeActivation) and the /courier guard all read that one answer. A build-mode input
 * would be one more parameter beside `devDiagnostics`. NOT covered by one line: a deep link to /seller in a
 * Buyer-only release would reach SellerGate's server-state screens (offline, checking, unavailable) rather than a
 * silent redirect, so their behaviour needs the decision too.
 */

const sources = productionSources('.').filter(({ file }) => !file.startsWith('testing/'));

/**
 * The code of a file: comments removed, strings kept (a `//` or `/*` inside a string is not a comment), so a sentence
 * that names a function is not a use of it and a URL does not hide the rest of its line.
 */
const code = (text: string) =>
  text.replace(/('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`)|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (_m, str?: string) => str ?? '');
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

  it('ignores a comment but not code, keeps a URL string, and is not fooled by a // or /* inside a string', () => {
    const text = [
      '// resolveAvailableModes( in a comment',
      '/* useAvailableModes( in a block comment */',
      "const url = 'https://example.test/x'; resolveAvailableModes(a);",
      "const a = key.includes('//'); useAvailableModes();",
      "const mime = 'image/*'; seller_companion: true;",
    ].join('\n');
    const one: SourceFile[] = [{ file: 'x.ts', text }];
    expect(filesWith(one, /\bresolveAvailableModes\s*\(/)).toEqual(['x.ts']);
    expect(filesWith(one, /\buseAvailableModes\s*\(/)).toEqual(['x.ts']);
    expect(filesWith(one, /\bseller_companion\s*[:?]/)).toEqual(['x.ts']);
    const onlyComments: SourceFile[] = [{ file: 'c.ts', text: '// resolveAvailableModes(\n/* useAvailableModes( */' }];
    expect(filesWith(onlyComments, /resolveAvailableModes|useAvailableModes/)).toEqual([]);
  });
});

describe('release visibility of the other modes has one seam', () => {
  it('has one product entry to Seller: the You tab (the development screens and the Courier shell also navigate, development only)', () => {
    expect(filesWith(sources, /seller\.mode\.switch_to_seller/)).toEqual(['app/(buyer)/(tabs)/account.tsx']);
    expect(filesWith(sources, /MODE_HOME\.seller|MODE_HOME\[/)).toEqual([
      'app/(buyer)/(tabs)/account.tsx',
      'app/dev/index.tsx',
      'modes/ModeShell.tsx',
    ]);
  });

  it('defines which modes exist in one function and calls it from one hook', () => {
    expect(filesWith(sources, /\bresolveAvailableModes\s*\(/)).toEqual(['modes/ModeLayout.tsx', 'modes/modes.ts']);
  });

  it("reads the server's seller_companion fact only in the hook and the development screen", () => {
    expect(filesWith(sources, /\.seller_companion\b|\bseller_companion\s*[:?]/)).toEqual(['app/dev/index.tsx', 'modes/ModeLayout.tsx']);
  });

  it('asks which modes exist in four places only: the You tab, the dev screen, the hook and the mode shell', () => {
    expect(filesWith(sources, /\buseAvailableModes\s*\(/)).toEqual([
      'app/(buyer)/(tabs)/account.tsx',
      'app/dev/index.tsx',
      'modes/ModeLayout.tsx',
      'modes/ModeShell.tsx',
    ]);
  });

  it('has no build-mode input: no EXPO_PUBLIC_* mode variable, and no __DEV__ check in the Seller or Courier gates and routes', () => {
    expect(filesWith(sources, /process\.env\.EXPO_PUBLIC_(?!API_BASE_URL)\w+/)).toEqual([]);
    expect(filesWith(productionSources('modes'), /__DEV__/)).toEqual(['modes/ModeLayout.tsx']);
    expect(filesWith(productionSources('seller'), /__DEV__/)).toEqual([]);
    expect(filesWith(productionSources('app/seller', 'app/courier'), /__DEV__/)).toEqual([]);
  });
});
