// The sign-in return destination is read from a link, so it is attacker-controlled input. Recovered from the archived
// auth/return-to.test.ts (recovery/legacy-dev-20261125) and adapted to opaque references: the handle/slug Product cases become
// one-segment refs; every hostile shape the archive pinned is still refused.
import { parseReturnTo, pathOf } from './routes';

const ok = (raw: string) => {
  const route = parseReturnTo(raw);
  return route === null ? null : pathOf(route);
};

describe('parseReturnTo', () => {
  it.each(['/home', '/shop', '/saved', '/orders', '/account', '/notifications', '/messages'])('keeps the Buyer destination %s', (path) => {
    expect(ok(path)).toBe(path);
  });

  it('keeps a Product, a Scene and a Seller it can validate, as the same in-app path', () => {
    expect(ok('/product/fx_product_demo_1')).toBe('/product/fx_product_demo_1');
    expect(ok('/scenes/AbCdEfGhIjKlMnOpQrSt_-')).toBe('/scenes/AbCdEfGhIjKlMnOpQrSt_-');
    expect(ok('/sellers/s-1')).toBe('/sellers/s-1');
    expect(ok(`/product/${'a'.repeat(128)}`)).toBe(`/product/${'a'.repeat(128)}`);
  });

  const hostile: [string, string][] = [
    ['Seller Companion', '/companion'],
    ['a nested Companion route', '/companion/messages/c1'],
    ['Courier mode', '/courier'],
    ['diagnostics', '/dev'],
    ['the route sitemap', '/_sitemap'],
    ['Delete Account', '/account/delete'],
    ['a conversation', '/chat/c1'],
    ['a private Collection', '/collections/c1'],
    ['the save picker', '/save-to'],
    ['the sign-in screen itself', '/auth/sign-in'],
    ['the verify screen', '/auth/verify'],
    ['Search', '/search'],
    ['a protocol-relative link', '//evil.example'],
    ['a protocol-relative link to a Buyer path', '//evil.example/saved'],
    ['an https link', 'https://evil.example'],
    ['an http link to a Buyer path', 'http://evil.example/saved'],
    ['a javascript link', 'javascript:alert(1)'],
    ['an app-scheme link', 'adulis://companion'],
    ['a backslash host', '/\\evil.example'],
    ['a double backslash host', '\\\\evil.example'],
    ['a relative path', 'saved'],
    ['a dot-relative path', './saved'],
    ['a parent-relative path', '../saved'],
    ['a dot-dot Product ref', '/product/..'],
    ['an encoded slash in the ref', '/product/a%2Fb'],
    ['an encoded dot-dot', '/product/%2e%2e'],
    ['an empty Product ref', '/product/'],
    ['a Product with an extra segment', '/product/a/b'],
    ['a Product ref with a dot', '/product/a.b'],
    ['a Product ref over its length limit', `/product/${'a'.repeat(129)}`],
    ['a query on a tab', '/saved?next=/companion'],
    ['a fragment on a tab', '/saved#/companion'],
    ['an Order', '/orders/o-1'],
    ['an empty string', ''],
  ];
  it.each(hostile)('refuses %s', (_name, raw) => {
    expect(parseReturnTo(raw)).toBeNull();
  });

  it('refuses anything that is not a string', () => {
    for (const raw of [undefined, null, 7, ['/saved'], { path: '/saved' }]) expect(parseReturnTo(raw)).toBeNull();
  });
});
