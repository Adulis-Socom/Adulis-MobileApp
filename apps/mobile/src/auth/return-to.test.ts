import { parseReturnTo, parseSaveNonce } from './sign-in-flow';

/**
 * The sign-in return destination is read from a link, so it is attacker-controlled input. It may
 * only ever name a Buyer destination from a short allow-list, and anything else becomes You.
 */
const YOU = '/account';
const SCENE_REF = 'AbCdEfGhIjKlMnOpQrSt_-'; // 22 base64url characters, the public reference shape

describe('parseReturnTo', () => {
  it.each(['/home/for-you', '/saved', '/orders', '/account', '/notifications', '/messages'])('keeps the Buyer destination %s', (path) => {
    expect(parseReturnTo(path)).toBe(path);
  });

  it('keeps a Product and a Scene it can validate, as the same in-app path', () => {
    expect(parseReturnTo('/product/seller-1/woven-basket')).toBe('/product/seller-1/woven-basket');
    expect(parseReturnTo(`/scenes/${SCENE_REF}`)).toBe(`/scenes/${SCENE_REF}`);
    expect(parseReturnTo(`/product/${'a'.repeat(120)}/b`)).toBe(`/product/${'a'.repeat(120)}/b`);
  });

  const hostile: Array<[string, string]> = [
    // Other modes, diagnostics and screens that are not return destinations.
    ['Seller mode', '/seller'],
    ['a nested Seller route', '/seller/orders/f5b00000-0000-4000-8000-000000000001'],
    ['Courier mode', '/courier'],
    ['diagnostics', '/dev'],
    ['the route sitemap', '/_sitemap'],
    ['Delete Account', '/account/delete'],
    ['a conversation', '/chat/c0000000-0000-4000-8000-000000000001'],
    ['a conversation without its reference', '/chat/x'],
    ['a private Collection', '/collections/c0000000-0000-4000-8000-000000000001'],
    ['the sign-in screen itself', '/auth/sign-in'],
    ['the verify screen', '/auth/verify'],
    ['Search', '/search'],
    ['Home itself, not a channel', '/home'],
    // Other origins and schemes.
    ['a protocol-relative link', '//evil.example'],
    ['a protocol-relative link to a Buyer path', '//evil.example/saved'],
    ['an https link', 'https://evil.example'],
    ['an http link to a Buyer path', 'http://evil.example/saved'],
    ['a javascript link', 'javascript:alert(1)'],
    ['an app-scheme link to Seller', 'adulis://seller'],
    ['a backslash host', '/\\evil.example'],
    ['a double backslash host', '\\\\evil.example'],
    ['a relative path', 'saved'],
    ['a dot-relative path', './saved'],
    ['a parent-relative path', '../saved'],
    // Path tricks around the validated Product and Scene shapes.
    ['a dot-dot Product handle', '/product/../seller/x'],
    ['a dot Product handle', '/product/./x'],
    ['an encoded slash in the handle', '/product/a%2Fb/c'],
    ['an encoded dot-dot in the handle', '/product/%2e%2e/c'],
    ['an empty Product handle', '/product//b'],
    ['an empty Product slug', '/product/a/'],
    ['a Product with an extra segment', '/product/a/b/c'],
    ['a Product with a Seller path behind it', '/product/a/b/../../seller'],
    ['a Product with an uppercase handle', '/product/A/b'],
    ['a Product with an uppercase slug', '/product/a/B'],
    ['a Product handle starting with a hyphen', '/product/-a/b'],
    ['a Product handle with a dot', '/product/a.b/c'],
    ['a Product handle over its length limit', `/product/${'a'.repeat(121)}/b`],
    ['a Scene with an extra segment', `/scenes/${SCENE_REF}/x`],
    ['a Scene reference one character short', `/scenes/${SCENE_REF.slice(1)}`],
    ['a Scene reference one character long', `/scenes/${SCENE_REF}A`],
    ['a Scene reference with a dot', `/scenes/${SCENE_REF.slice(1)}.`],
    ['a Scene reference with an encoded character', `/scenes/${SCENE_REF.slice(0, 16)}%2e%2e`],
    ['a Scene path without a reference', '/scenes/'],
    // Anything appended to an allowed path makes it a different one.
    ['a query on a tab', '/saved?next=/seller'],
    ['a fragment on a tab', '/saved#/seller'],
    ['a query on a Product', '/product/a/b?x=1'],
    ['a fragment on a Scene', `/scenes/${SCENE_REF}#x`],
    ['a trailing slash', '/saved/'],
    ['a trailing newline', '/saved\n'],
    ['a leading space', ' /saved'],
    ['a trailing space', '/saved '],
    ['a null byte', '/saved\u0000'],
    ['an encoded slash prefix', '%2Fsaved'],
    ['an encoded path', '/saved%2F..%2Fseller'],
    // Case variants are different paths.
    ['an uppercase tab', '/Saved'],
    ['an uppercase channel', '/HOME/FOR-YOU'],
    ['an uppercase mode', '/SELLER'],
    ['an uppercase Product word', '/Product/a/b'],
    ['an uppercase Scene word', `/Scenes/${SCENE_REF}`],
    ['nothing', ''],
    ['only a slash', '/'],
  ];

  it.each(hostile)('turns %s (%j) into You', (_what, value) => {
    expect(parseReturnTo(value)).toBe(YOU);
  });

  it.each([[undefined], [null], [0], [1], [true], [false], [{}], [{ toString: () => '/seller' }], [{ toString: () => '/product/a/b' }], [['/product/a/b']], [['/saved']], [['/seller']], [['/saved', '/seller']], [[]], [() => '/saved'], [Symbol('x')]])(
    'turns the non-string %p into You',
    (value) => {
      expect(parseReturnTo(value)).toBe(YOU);
    },
  );

  it('never returns anything but the input unchanged or You, whatever the pieces of a link are', () => {
    const prefixes = ['', ' ', '\n', '/', '//', '\\', '/\\', 'http:', 'https:', 'javascript:', 'adulis://', '%2F', '/%2F', '/.', '/..', './', '../'];
    const targets = [
      'seller',
      'seller/orders/x',
      'courier',
      'dev',
      'account/delete',
      'account',
      'chat/x',
      'evil.example',
      '_sitemap',
      'saved',
      'product/a/b',
      `scenes/${SCENE_REF}`,
    ];
    const suffixes = ['', '/', '?x=1', '#f', '%00', ' ', '\n', '/..', '/../seller', '/./', '%2e%2e', '\\'];
    const allowed = [
      /^\/(home\/for-you|saved|orders|account|notifications|messages)$/,
      /^\/product\/[a-z0-9][a-z0-9-]{0,119}\/[a-z0-9][a-z0-9-]{0,119}$/,
      /^\/scenes\/[A-Za-z0-9_-]{22}$/,
    ];
    let kept = 0;
    for (const prefix of prefixes) {
      for (const target of targets) {
        for (const suffix of suffixes) {
          const input = `${prefix}${target}${suffix}`;
          const result = parseReturnTo(input);
          // Never rewritten into another path, never one of the frozen or hidden surfaces.
          expect(result === YOU || result === input).toBe(true);
          expect(allowed.some((pattern) => pattern.test(result))).toBe(true);
          if (result === input) kept++;
        }
      }
    }
    // The generator does reach the allowed shapes, so the loop above is not vacuous.
    expect(kept).toBeGreaterThan(0);
  });
});

describe('parseSaveNonce', () => {
  it('accepts only a string of the nonce shape', () => {
    expect(parseSaveNonce('0b6f1a3e-2222-4222-8222-222222222222')).toBe('0b6f1a3e-2222-4222-8222-222222222222');
    for (const value of [undefined, null, 5, ['0b6f1a3e-2222-4222-8222-222222222222'], '', ' ', '/seller', 'https://evil.example', '0b6f1a3e-2222-4222-8222-22222222222', '0B6F1A3E-2222-4222-8222-222222222222', '0b6f1a3e-2222-4222-8222-222222222222\n']) {
      expect(parseSaveNonce(value)).toBeNull();
    }
  });
});
