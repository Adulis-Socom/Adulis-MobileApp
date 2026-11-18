import { productionSources, repoFile } from '../testing/source-scan';

/**
 * Sharing and links. The app has no sharing: nothing builds a link, hands one to the system share sheet,
 * copies one, or names a web address, and a private Collection has no address outside the signed-in app.
 * Only the `adulis` scheme is declared, so there are no verified HTTPS app links and none may be claimed.
 * These tests pin that boundary; adding sharing is a product decision (which destinations, which domain)
 * and changes them on purpose.
 */
describe('what the app can link to and share', () => {
  // The app's own code: the test helpers (testing/) are not shipped.
  const sources = productionSources('.').filter((s) => !s.file.startsWith('testing/'));

  const FORBIDDEN: ReadonlyArray<[string, RegExp]> = [
    ['the system share sheet', /\bShare\.share\b|expo-sharing/],
    ['the clipboard', /expo-clipboard|\bClipboard\./],
    ['building or opening a link', /expo-linking|\bLinking\.|\bcreateURL\(/],
    ['a web address', /https?:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i],
  ];

  it.each(FORBIDDEN)('no source of the app uses %s', (_what, pattern) => {
    const offenders = sources.filter((s) => pattern.test(s.text)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it('the source scan looks at the app: it sees the Saved screens and the route files', () => {
    const files = sources.map((s) => s.file);
    expect(files).toEqual(expect.arrayContaining(['buyer/CollectionScreen.tsx', 'buyer/SavedScreen.tsx', 'buyer/SaveToCollection.tsx', 'app/(buyer)/collections/[collectionRef].tsx']));
  });

  it('only the adulis scheme is declared: no associated domains and no Android intent filters', () => {
    const { expo } = JSON.parse(repoFile('apps/mobile/app.json')) as {
      expo: { scheme?: string; ios?: { associatedDomains?: unknown }; android?: { intentFilters?: unknown } };
    };
    expect(expo.scheme).toBe('adulis');
    expect(expo.ios?.associatedDomains).toBeUndefined();
    expect(expo.android?.intentFilters).toBeUndefined();
  });
});
