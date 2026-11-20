import { router } from 'expo-router';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { en } from '@adulis/locale/mobile';
import { Text } from 'react-native';

import { parseReturnTo } from '../auth/sign-in-flow';
import { useUiStore } from '../state/ui-store';
import { installFakeApi } from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';
import { allSources, productionSources, type SourceFile } from '../testing/source-scan';
import { disabledCartAdapter } from './adapters/disabled';
import { createRealCartAdapter } from './adapters/real';
import type { CartAdapter, Scope } from './cart/port';
import { createFixtureWorld } from './testing/fixture/adapter';
import { renderWithCommerce } from './testing/harness';
import { stubAdapter } from './testing/stub-adapter';
import { SHIPPED_COMMERCE_MODE, resolveAdapter } from './runtime/mode';
import { useCarts } from './cart/hooks';

/**
 * The cart code is switched OFF by construction: nothing reaches it, nothing in it reaches the network or
 * the disk, and nothing beyond reading the carts, adding a line and changing or removing one exists in it. Each rule below fails the day
 * it is broken, so a change that turns commerce on is made on purpose and never by accident. Every scan is
 * proved on a sample it exists to catch, so a pattern that stops matching cannot pass silently.
 *
 * Limit: the scans read import specifiers written out in the source, in quotes or backticks, and a second
 * scan looks for a string that names the folder. A path that only running code can work out is invisible
 * to both (as it is to the repository's dependency checker); the other layers (the disabled default, the
 * release refusal and the exact surface) stand behind them.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

/** Source without comments, so a comment can neither trip nor hide a rule (a comment inside a string is kept). */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '');
  return withoutBlocks
    .split('\n')
    .map((line) => {
      if (/^\s*\/\//.test(line)) return '';
      const at = line.search(/\s\/\/\s/);
      if (at < 0) return line;
      const before = line.slice(0, at);
      const quotes = (before.match(/['"`]/g) ?? []).length;
      return quotes % 2 === 0 ? before : line;
    })
    .join('\n');
}

const SPECIFIER =
  /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s+)(['"`])([^'"`\n]+)\1/g;
const specifiersOf = (text: string): string[] =>
  [...stripComments(text).matchAll(SPECIFIER)].map((m) => m[2]!);

/** A specifier that names the commerce folder (a file in it, or the folder itself). */
const NAMES_COMMERCE = /(^|\/)commerce(\/|$)/;
/** A specifier that names a folder called testing. */
const NAMES_TESTING = /(^|\/)testing(\/|$)/;
const reachesCommerce = (text: string) => specifiersOf(text).some((s) => NAMES_COMMERCE.test(s));

const all = productionSources('.');
const inCommerce = (file: string) => file.startsWith('commerce/');
const commerceFiles = all.filter((s) => inCommerce(s.file));
/** The commerce code a build may contain: not the test-only folder. */
const isCore = (file: string) => inCommerce(file) && !file.startsWith('commerce/testing/');
const core = all.filter((s) => isCore(s.file));

const offenders = (files: SourceFile[], test: (text: string, file: string) => boolean) =>
  files.filter((s) => test(s.text, s.file)).map((s) => s.file);
const matching = (pattern: RegExp) => (text: string) => pattern.test(stripComments(text));

describe('the scans look at the cart code', () => {
  it('sees the production folders, the test-only folder and the route files', () => {
    const files = all.map((s) => s.file);
    expect(core.length).toBeGreaterThanOrEqual(10);
    expect(files).toEqual(
      expect.arrayContaining([
        'commerce/cart/model.ts',
        'commerce/cart/hooks.ts',
        'commerce/adapters/real.ts',
        'commerce/runtime/provider.tsx',
        'commerce/testing/harness.tsx',
        'app/_layout.tsx',
      ]),
    );
  });

  it('the specifier pattern bites on the forms it exists to catch', () => {
    const samples = [
      "import x from '../commerce'",
      "import { a } from '../../commerce/cart/model'",
      "const m = require('../commerce/runtime/mode')",
      "const m = await import('../commerce/cart/hooks')",
      "export * from '../commerce/cart/port'",
    ];
    for (const sample of samples)
      expect(specifiersOf(sample).some((s) => NAMES_COMMERCE.test(s))).toBe(true);
    expect(
      specifiersOf("import x from '../e-commerce-kit'").some((s) => NAMES_COMMERCE.test(s)),
    ).toBe(false);
    expect(specifiersOf("// import x from '../commerce'\nconst a = 1;").length).toBe(0);
  });

  it('the specifier pattern also bites on a specifier written with backticks, which the bundler resolves too', () => {
    const samples = [
      'const m = await import(`../commerce/cart/hooks`);',
      'const m = require(`../commerce/runtime/provider`);',
    ];
    for (const sample of samples) expect(reachesCommerce(sample)).toBe(true);
    expect(reachesCommerce('const m = await import(`../e-commerce-kit`);')).toBe(false);
  });

  it('a file that loads the folder with a backtick specifier is an offender of the same scans', () => {
    const probe: SourceFile = {
      file: 'buyer/Probe.ts',
      text: 'export const load = () => import(`../commerce/cart/hooks`);',
    };
    expect(offenders([probe], reachesCommerce)).toEqual(['buyer/Probe.ts']);
  });
});

describe('G1 and G2: nothing outside the cart code reaches it', () => {
  it('no route file imports the commerce folder', () => {
    const routes = all.filter((s) => s.file.startsWith('app/'));
    expect(routes.length).toBeGreaterThan(30);
    expect(offenders(routes, reachesCommerce)).toEqual([]);
  });

  it('no other source of the app imports the commerce folder', () => {
    const others = all.filter((s) => !inCommerce(s.file));
    expect(others.length).toBeGreaterThan(100);
    expect(offenders(others, reachesCommerce)).toEqual([]);
  });

  describe('second layer: no string outside the folder names it', () => {
    // A bundler resolves a path built from constants, which no import grammar sees; a string that names the folder is enough to look at.
    const NAMES_FOLDER_IN_A_STRING = /['"`](?:[^'"`\n]*\/)?commerce(?:\/[^'"`\n]*)?['"`]/;

    it('no source outside the folder has a string literal that names it', () => {
      const others = all.filter((s) => !inCommerce(s.file));
      expect(offenders(others, matching(NAMES_FOLDER_IN_A_STRING))).toEqual([]);
    });

    it('bites on a path built from parts, and leaves ordinary words alone', () => {
      for (const sample of [
        "const dir = '../' + 'commerce';",
        "load('../commerce/cart/hooks')",
        'const p = `commerce/runtime`;',
      ]) {
        expect(NAMES_FOLDER_IN_A_STRING.test(sample)).toBe(true);
      }
      for (const sample of ["const t = 'e-commerce';", "const t = 'commerce is a word';"])
        expect(NAMES_FOLDER_IN_A_STRING.test(sample)).toBe(false);
    });
  });
});

describe('G3: the test-only folder is reached only by tests and by itself', () => {
  it('no production file of the cart code imports a folder called testing', () => {
    expect(
      offenders(core, (text) => specifiersOf(text).some((s) => NAMES_TESTING.test(s))),
    ).toEqual([]);
  });

  it('no file outside the commerce folder imports commerce/testing', () => {
    const others = all.filter((s) => !inCommerce(s.file));
    expect(
      offenders(others, (text) => specifiersOf(text).some((s) => /commerce\/testing/.test(s))),
    ).toEqual([]);
  });

  it('the pattern bites on a testing import from a production folder', () => {
    expect(
      specifiersOf("import { stubAdapter } from '../testing/stub-adapter'").some((s) =>
        NAMES_TESTING.test(s),
      ),
    ).toBe(true);
    expect(
      specifiersOf("import { x } from '../../commerce/testing/harness'").some((s) =>
        /commerce\/testing/.test(s),
      ),
    ).toBe(true);
    expect(
      specifiersOf('const m = await import(`../testing/stub-adapter`);').some((s) =>
        NAMES_TESTING.test(s),
      ),
    ).toBe(true);
  });

  it('covers every folder of the cart code except the test-only one, including a folder added later', () => {
    expect(isCore('commerce/ui/Screen.tsx')).toBe(true);
    expect(isCore('commerce/screens/Cart.tsx')).toBe(true);
    expect(isCore('commerce/index.ts')).toBe(true);
    expect(isCore('commerce/testing/harness.tsx')).toBe(false);
    expect(isCore('commerce/testing/fixture/server.ts')).toBe(false);
    expect(isCore('buyer/Home.tsx')).toBe(false);
  });
});

describe('G4: the cart code has no network binding', () => {
  const CLIENT_NAMES_ALLOWED = ['ApiError', 'isTransient', 'problemCode', 'newIdempotencyKey'];
  const IMPORT_FROM = /import\s+(type\s+)?([^;]*?)\s+from\s+(['"`])([^'"`\n]+)\3/g;

  /** What a file imports by name from a module whose specifier matches `from`. Type-only imports are skipped. */
  function valueNamesFrom(text: string, from: RegExp): string[] {
    const found: string[] = [];
    for (const m of stripComments(text).matchAll(IMPORT_FROM)) {
      if (m[1] || !from.test(m[4]!)) continue;
      const clause = m[2]!.trim();
      if (!clause.startsWith('{')) {
        found.push(clause);
        continue;
      }
      for (const part of clause.replace(/[{}]/g, '').split(',')) {
        const name = part.trim();
        if (name === '' || name.startsWith('type ')) continue;
        found.push(name.split(/\s+as\s+/)[0]!.trim());
      }
    }
    return found;
  }

  it('imports from the API client only the failure types and the key maker, and never the client itself', () => {
    const bad = core.flatMap((s) =>
      valueNamesFrom(s.text, /(^|\/)api\/client$/)
        .filter((n) => !CLIENT_NAMES_ALLOWED.includes(n))
        .map((n) => `${s.file}: ${n}`),
    );
    expect(bad).toEqual([]);
  });

  it('imports from the session only the hook that reads the session state', () => {
    const bad = core.flatMap((s) =>
      valueNamesFrom(s.text, /(^|\/)auth\/session$/)
        .filter((n) => n !== 'useSession')
        .map((n) => `${s.file}: ${n}`),
    );
    expect(bad).toEqual([]);
  });

  const FORBIDDEN =
    /\bcreateApiClient\b|\bApiClient\b|\bApiDeps\b|\bboundApi\b|@adulis\/api-client|\{[^}]*\bapi\b[^}]*\}\s*=\s*useSession\(|\.\s*api\b/;

  it('names no client constructor, no bound client and no generated client package', () => {
    expect(offenders(core, matching(FORBIDDEN))).toEqual([]);
  });

  it('does not reach the client through the session value either', () => {
    for (const sample of [
      'const s = useSession(); s.api.get(x);',
      'const { session } = useSession();\nsession.api\n  .post(y);',
    ])
      expect(FORBIDDEN.test(sample)).toBe(true);
    for (const sample of [
      "import { ApiError } from '../../api/client';",
      'const label = session.apiVersion;',
    ])
      expect(FORBIDDEN.test(sample)).toBe(false);
  });

  it('the checks bite on the forms they exist to catch', () => {
    expect(
      valueNamesFrom(
        "import { createApiClient, ApiError } from '../../api/client';",
        /(^|\/)api\/client$/,
      ),
    ).toEqual(['createApiClient', 'ApiError']);
    expect(
      valueNamesFrom("import type { ApiClient } from '../../api/client';", /(^|\/)api\/client$/),
    ).toEqual([]);
    expect(
      valueNamesFrom(
        "import { useSession, SessionProvider } from '../../auth/session';",
        /(^|\/)auth\/session$/,
      ),
    ).toEqual(['useSession', 'SessionProvider']);
    expect(
      /\{[^}]*\bapi\b[^}]*\}\s*=\s*useSession\(/.test('const { session, api } = useSession();'),
    ).toBe(true);
  });
});

describe('G5, G6, G7: no network, no storage and no ambient switch anywhere in the cart folder', () => {
  const NETWORK = /\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|['"`]\/v1\/|https?:\/\/|EXPO_PUBLIC/;
  const STORAGE =
    /expo-secure-store|expo-sqlite|async-storage|expo-file-system|\blocalStorage\b|\bsessionStorage\b|\bMMKV\b/;
  const AMBIENT =
    /\buseBootstrap\b|feature_flags|process\.env|expo-constants|expo-linking|\buseLocalSearchParams\b|\buseGlobalSearchParams\b|\bLinking\./;

  it('uses no network primitive, request path or web address', () => {
    expect(offenders(commerceFiles, matching(NETWORK))).toEqual([]);
  });

  it('keeps nothing on disk', () => {
    expect(offenders(commerceFiles, matching(STORAGE))).toEqual([]);
  });

  it('reads no flag, environment value, link or search parameter that could select an adapter', () => {
    expect(offenders(commerceFiles, matching(AMBIENT))).toEqual([]);
  });

  it('the patterns bite on the forms they exist to catch', () => {
    for (const sample of [
      "await fetch('x')",
      "const p = '/v1/cart'",
      'const u = "https://example.org"',
      'process.env.EXPO_PUBLIC_API_BASE_URL',
      'new WebSocket(u)',
    ]) {
      expect(NETWORK.test(sample) || AMBIENT.test(sample)).toBe(true);
    }
    for (const sample of [
      "import * as S from 'expo-secure-store'",
      "import { openDatabaseSync } from 'expo-sqlite'",
      'localStorage.setItem(a, b)',
    ])
      expect(STORAGE.test(sample)).toBe(true);
    for (const sample of [
      'useBootstrap()',
      'Linking.getInitialURL()',
      'const { slug } = useLocalSearchParams()',
    ])
      expect(AMBIENT.test(sample)).toBe(true);
    expect(NETWORK.test('const fetchStatus = 1; refetchOnReconnect: true')).toBe(false);
  });
});

describe('G8: no stock count', () => {
  it('no cart code reads a stock count, except the server simulator that answers for the server', () => {
    const files = commerceFiles.filter((s) => !s.file.startsWith('commerce/testing/fixture/'));
    expect(offenders(files, matching(/stock_count|stockCount/))).toEqual([]);
    expect(/stock_count|stockCount/.test('variant.stock_count > 0')).toBe(true);
  });
});

describe('G10: the surface is exactly reading the carts, adding a line, and changing or removing one', () => {
  /** Every string key of the object and of its prototype chain (a class cannot hide a method on its prototype). */
  function surface(value: object): string[] {
    const keys = new Set<string>();
    for (
      let o: object | null = value;
      o !== null && o !== Object.prototype;
      o = Object.getPrototypeOf(o) as object | null
    ) {
      for (const key of Reflect.ownKeys(o))
        if (typeof key === 'string' && key !== 'constructor') keys.add(key);
    }
    return [...keys].sort();
  }
  const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => true };
  const adapters: Array<[string, CartAdapter]> = [
    ['the disabled adapter', disabledCartAdapter],
    ['the real adapter slot', createRealCartAdapter()],
    ['a labelled fixture adapter', stubAdapter().adapter],
    ['the server simulator adapter', createFixtureWorld().adapter],
  ];

  it.each(adapters)(
    '%s has exactly the adapter surface and its port exactly the four cart methods',
    (_name, adapter) => {
      expect(surface(adapter)).toEqual(['availability', 'bind', 'mode', 'provenance']);
      expect(surface(adapter.bind(scope))).toEqual([
        'addLine',
        'getCarts',
        'removeLine',
        'setQuantity',
      ]);
    },
  );

  it('sees an own property beyond the four', () => {
    const ownExtra = Object.create(null) as Record<string, unknown>;
    Object.assign(ownExtra, disabledCartAdapter.bind(scope), { createOrder: () => undefined });
    expect(surface(ownExtra)).toEqual([
      'addLine',
      'createOrder',
      'getCarts',
      'removeLine',
      'setQuantity',
    ]);
  });

  it('sees a method beyond the four hidden on a prototype', () => {
    class Wider {
      getCarts() {}
      addLine() {}
      setQuantity() {}
      removeLine() {}
      acceptPrice() {}
    }
    expect(surface(new Wider())).toEqual([
      'acceptPrice',
      'addLine',
      'getCarts',
      'removeLine',
      'setQuantity',
    ]);
  });

  it('sees a method hidden on a prototype', () => {
    class Sneaky {
      getCarts() {}
      addLine() {}
      createOrder() {}
    }
    expect(surface(new Sneaky())).toEqual(['addLine', 'createOrder', 'getCarts']);
  });
});

describe('G10b: the provider that takes the build and the run as props stays inside', () => {
  const OWN_FILE = 'commerce/runtime/provider.tsx';
  const mentions = (text: string) => /\bCommerceProviderCore\b/.test(stripComments(text));

  it('only its own file and the test-only folder name it', () => {
    const named = all.filter((s) => mentions(s.text)).map((s) => s.file);
    expect(named).toContain(OWN_FILE);
    expect(
      named.filter((file) => file !== OWN_FILE && !file.startsWith('commerce/testing/')),
    ).toEqual([]);
  });

  it('bites on a mention in any other file, and ignores a comment', () => {
    expect(mentions("import { CommerceProviderCore } from '../runtime/provider';")).toBe(true);
    expect(mentions('// CommerceProviderCore is described here\nconst a = 1;')).toBe(false);
  });
});

describe('G11 and G12: off by default, and refused in a release run', () => {
  it('ships disabled, and the shipped mode refuses a fixture adapter even in a development run', () => {
    expect(SHIPPED_COMMERCE_MODE).toBe('disabled');
    expect(
      resolveAdapter({ requested: stubAdapter().adapter, build: SHIPPED_COMMERCE_MODE, dev: true }),
    ).toBe(disabledCartAdapter);
  });

  it('draws nothing from a fixture adapter in a release run, and sends nothing', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest.fn(() => Promise.reject(new Error('no network is allowed')));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const devGlobal = globalThis as unknown as { __DEV__: boolean };
    const dev = devGlobal.__DEV__;
    devGlobal.__DEV__ = false;
    try {
      const stub = stubAdapter();
      function Probe() {
        const { view } = useCarts({ focused: true });
        return <Text testID="probe">{view.kind}</Text>;
      }
      await renderWithCommerce(<Probe />, {
        adapter: stub.adapter,
        build: 'fixture',
        dev: __DEV__,
        token: 'token-a',
      });
      expect(screen.getByTestId('probe')).toHaveTextContent('DISABLED');
      expect(stub.calls).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      devGlobal.__DEV__ = dev;
      globalThis.fetch = original;
    }
  });
});

describe('G13: no route, tab or return path reaches it', () => {
  /** Every route file of the app at this commit. A new one fails this test until it is listed here on purpose. */
  const ROUTE_FILES = [
    '(buyer)/(tabs)/_layout.tsx',
    '(buyer)/(tabs)/account.tsx',
    '(buyer)/(tabs)/home/_layout.tsx',
    '(buyer)/(tabs)/home/discounts.tsx',
    '(buyer)/(tabs)/home/following.tsx',
    '(buyer)/(tabs)/home/for-you.tsx',
    '(buyer)/(tabs)/home/locally-made.tsx',
    '(buyer)/(tabs)/home/nearby.tsx',
    '(buyer)/(tabs)/orders.tsx',
    '(buyer)/(tabs)/saved.tsx',
    '(buyer)/(tabs)/shop.tsx',
    '(buyer)/_layout.tsx',
    '(buyer)/account/delete.tsx',
    '(buyer)/auth/sign-in.tsx',
    '(buyer)/auth/verify.tsx',
    '(buyer)/chat/[conversationRef].tsx',
    '(buyer)/collections/[collectionRef].tsx',
    '(buyer)/messages.tsx',
    '(buyer)/notifications.tsx',
    '(buyer)/product/[handle]/[slug].tsx',
    '(buyer)/save-to.tsx',
    '(buyer)/scenes/[scenePostRef].tsx',
    '(buyer)/search.tsx',
    '(buyer)/sellers/[handle].tsx',
    '+not-found.tsx',
    '_layout.tsx',
    '_sitemap.tsx',
    'courier/_layout.tsx',
    'courier/index.tsx',
    'dev/_layout.tsx',
    'dev/index.tsx',
    'index.tsx',
    'seller/_layout.tsx',
    'seller/index.tsx',
    'seller/messages/[conversationId].tsx',
    'seller/messages/index.tsx',
    'seller/notifications.tsx',
    'seller/orders/[orderId].tsx',
    'seller/orders/index.tsx',
  ];
  const routeFiles = allSources()
    .filter((s) => s.file.startsWith('app/'))
    .map((s) => s.file.slice('app/'.length))
    .sort();

  it('the route tree is exactly the listed files', () => {
    expect(routeFiles).toEqual([...ROUTE_FILES].sort());
  });

  it('no route file is named like a cart, a checkout or a purchase (a second check beside the list)', () => {
    const NAMED = /cart|checkout|commerce|basket|bag|purchase|order-now/i;
    expect(routeFiles.filter((file) => NAMED.test(file))).toEqual([]);
    expect(NAMED.test('(buyer)/cart.tsx')).toBe(true);
  });

  it('the tab bar is exactly Home, Shop, Saved, Orders and You', () => {
    const layout = all.find((s) => s.file === 'app/(buyer)/(tabs)/_layout.tsx')!;
    const names = [...layout.text.matchAll(/<Tabs\.Screen\s+name="(\w+)"/g)].map((m) => m[1]);
    expect(names).toEqual(['home', 'shop', 'saved', 'orders', 'account']);
  });

  it('a sign-in cannot return to a cart or checkout path', () => {
    for (const target of ['/cart', '/carts', '/checkout', '/cart/lines', '/commerce'])
      expect(parseReturnTo(target)).toBe('/account');
  });

  describe('opening a cart or checkout path', () => {
    let api: ReturnType<typeof installFakeApi>;
    beforeEach(() => {
      resetSecureStore();
      api = installFakeApi();
      useUiStore.setState({
        activeMode: null,
        themePreference: 'system',
        locale: 'en',
        upgradeNoticeDismissed: false,
        pendingSave: null,
      });
    });
    const HOME_CALLS = ['GET /v1/bootstrap', 'GET /v1/fyp', 'POST /v1/devices'];

    it.each(['/cart', '/carts', '/checkout'])(
      '%s cold lands on Buyer Home and sends nothing authenticated',
      async (path) => {
        await renderRouter(APP_DIR, { initialUrl: path });
        expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
        expect(screen).toHavePathname('/home/for-you');
        expect(api.calls.filter((c) => c.headers.Authorization !== undefined)).toEqual([]);
        expect(
          api.calls.map((c) => `${c.method} ${c.path}`).filter((c) => !HOME_CALLS.includes(c)),
        ).toEqual([]);
      },
    );

    it('/cart as a link into a running app lands on Buyer Home too', async () => {
      await renderRouter(APP_DIR, { initialUrl: '/home/for-you' });
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      await act(() => router.push('/cart' as never));
      expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
      expect(screen).toHavePathname('/home/for-you');
    });
  });
});

describe('G18 and G20: editing stays where it belongs', () => {
  const inFiles = (pattern: RegExp) => commerceFiles.filter((s) => pattern.test(s.file));
  const without = (files: SourceFile[], allowed: RegExp) =>
    files.filter((s) => !allowed.test(s.file));

  it('sees the editing files, so a rename or a deletion fails here instead of silently leaving them unscanned', () => {
    const names = commerceFiles.map((s) => s.file);
    expect(names).toEqual(
      expect.arrayContaining([
        'commerce/cart/edit.ts',
        'commerce/cart/edit-outcome.ts',
        'commerce/cart/edit-store.ts',
        'commerce/cart/edit-hooks.ts',
        'commerce/cart/variant-change.ts',
      ]),
    );
  });

  describe('G18: the editing modules never hold a price', () => {
    const MODULES = /^commerce\/cart\/(edit[\w-]*|variant-change)\.tsx?$/;
    const PRICE =
      /\b\w*Minor\b|\bMoney\b|\bunitPrice\b|\bpreviousUnitPrice\b|\bsubtotal\b|\btoFixed\b|\btoLocale\w*|\bIntl\b/;

    it('none of them names an amount, a currency formatter or a price field', () => {
      const modules = inFiles(MODULES);
      expect(modules.length).toBeGreaterThanOrEqual(5);
      expect(offenders(modules, matching(PRICE))).toEqual([]);
    });

    it('the pattern bites on the forms it exists to catch, and leaves the reference alone', () => {
      for (const sample of [
        'const a = line.unitPrice;',
        'if (m.amountMinor > 0) {}',
        'const total = a.nowMinor - b.wasMinor;',
        'import type { Money } from "./model";',
        'return (n / 100).toFixed(2);',
        'new Intl.NumberFormat()',
      ])
        expect(PRICE.test(sample)).toBe(true);
      expect(PRICE.test('const quantity = line.quantity;')).toBe(false);
    });
  });

  /**
   * G20: the two port methods are named in one place. Any access to the name counts, not only a call: a
   * call with optional chaining, `.call`, a copied function, a bracket and a destructuring all read it.
   * The scan reads source text, so a name built at run time evades it; the adapter-surface guard (G10) and
   * the behavioural tests (one request per decision) stand behind it.
   */
  describe('G20: an edit is sent only by the edit hook', () => {
    const READS_EDIT_METHOD =
      /\??\.\s*(?:setQuantity|removeLine)\b|\[\s*['"`](?:setQuantity|removeLine)['"`]\s*\]|\{[^}]*\b(?:setQuantity|removeLine)\b[^}]*\}\s*=/;
    const ALLOWED = /^commerce\/(cart\/edit-hooks\.ts|testing\/)/;

    it('no other file of the cart code reads setQuantity or removeLine off anything', () => {
      expect(offenders(without(commerceFiles, ALLOWED), matching(READS_EDIT_METHOD))).toEqual([]);
    });

    it('the edit hook is where they are called', () => {
      const hook = commerceFiles.find((s) => s.file === 'commerce/cart/edit-hooks.ts')!;
      const code = stripComments(hook.text);
      expect(/\.\s*setQuantity\s*\(/.test(code)).toBe(true);
      expect(/\.\s*removeLine\s*\(/.test(code)).toBe(true);
    });

    it('the hook the screens use names its method differently, so a screen never needs the port name', () => {
      const hook = commerceFiles.find((s) => s.file === 'commerce/cart/edit-hooks.ts')!;
      const code = stripComments(hook.text);
      const returned = code.slice(code.lastIndexOf('return {'));
      expect(/\bsetQuantity\b/.test(returned)).toBe(false);
      expect(/\bchangeQuantity\b/.test(returned)).toBe(true);
    });

    it('the pattern bites on every form that reads the method, and not on a similar name', () => {
      for (const sample of [
        'await port.setQuantity(request);',
        'adapter.bind(scope)\n  .removeLine(request)',
        'void bound.removeLine (request)',
        'await port.setQuantity?.(request);',
        'await port?.removeLine(request);',
        'await port.setQuantity.call(port, request);',
        'await port.removeLine.apply(port, [request]);',
        'const send = port.setQuantity; await send(request);',
        'Reflect.apply(port.setQuantity, port, [request]);',
        "await port['removeLine'](request);",
        'await port[`setQuantity`](request);',
        'const { removeLine } = port;',
        'const { getCarts, setQuantity: send } = port;',
      ])
        expect(READS_EDIT_METHOD.test(sample)).toBe(true);
      for (const sample of [
        'server.setQuantityAvailable(v, 1)',
        'setQuantity: () => Promise.reject(error)',
        'edit.changeQuantity(3)',
        'const quantity = line.quantity;',
        'const { lineId, quantity } = request;',
      ])
        expect(READS_EDIT_METHOD.test(sample)).toBe(false);
    });
  });
});

describe('G16: the cart code does no arithmetic on money', () => {
  // Any field that holds minor units (amountMinor, priceMinor, wasMinor, ...): beside an operator, in a
  // reduction, wrapped in a conversion, or reached through a name it was copied into.
  const MINOR = String.raw`\b\w*Minor\b`;
  const OP = String.raw`(?:\*\*|[-+*/%])`;
  const BEFORE = new RegExp(String.raw`${MINOR}\)?\s*${OP}`);
  const AFTER = new RegExp(String.raw`${OP}=?\s*(?:Number\s*\()?[\w$.?!]*${MINOR}`);
  const REDUCED = new RegExp(String.raw`\breduce\s*\([^;]*?${MINOR}`);
  const CONVERTED = new RegExp(
    String.raw`\b(?:Number|parseFloat|parseInt|BigInt|Math\.\w+)\s*\([^)]*${MINOR}`,
  );
  const boundFromMinor = (code: string): string[] => [
    ...[
      ...code.matchAll(
        new RegExp(String.raw`\b(?:const|let|var)\s+([A-Za-z_]\w*)\s*=[^;\n]*${MINOR}`, 'g'),
      ),
    ].map((m) => m[1]!),
    ...[
      ...code.matchAll(
        new RegExp(String.raw`\{[^}\n]*\b\w*Minor\s*:\s*([A-Za-z_]\w*)\s*[,}]`, 'g'),
      ),
    ].map((m) => m[1]!),
  ];
  const usedInArithmetic = (code: string, name: string) =>
    new RegExp(String.raw`\b${name}\b\s*${OP}|${OP}=?\s*[\w$.?!]*\b${name}\b`).test(code);
  const arithmetic = (text: string) => {
    const code = stripComments(text);
    return (
      [BEFORE, AFTER, REDUCED, CONVERTED].some((pattern) => pattern.test(code)) ||
      boundFromMinor(code).some((name) => usedInArithmetic(code, name))
    );
  };

  /** The one file that answers for the server and sums a Seller subtotal there. Every other cart file is scanned. */
  const EXEMPT = ['commerce/testing/fixture/server.ts'];

  it('has no sum, difference, product or reduction over an amount, except in the server simulator', () => {
    expect(
      offenders(
        commerceFiles.filter((s) => !EXEMPT.includes(s.file)),
        arithmetic,
      ),
    ).toEqual([]);
  });

  it('names its one exemption, which is a file of the server simulator that still needs it', () => {
    const exempt = commerceFiles.filter((s) => EXEMPT.includes(s.file));
    expect(exempt.map((s) => s.file)).toEqual(EXEMPT);
    for (const file of exempt) {
      expect(file.file.startsWith('commerce/testing/fixture/')).toBe(true);
      expect(arithmetic(file.text)).toBe(true);
    }
  });

  it('the patterns bite on the forms they exist to catch', () => {
    for (const sample of [
      'a.amountMinor + b.amountMinor',
      'x * line.amountMinor',
      'lines.reduce((s, l) => s + l.amountMinor, 0)',
      'total -= m.amountMinor',
      'const a = m.amountMinor; const t = a * q;',
      'const { amountMinor: a } = m;\nreturn a + b;',
      'return Number(m.amountMinor) * line.quantity;',
      'lines.reduce((s, l) => s + l.priceMinor * l.quantity, 0)',
      'const total = line.priceMinor * line.quantity;',
      'const n = Number(m.amountMinor);',
    ]) {
      expect(arithmetic(sample)).toBe(true);
    }
    for (const sample of [
      "const m = { amountMinor: 5, currency: 'ETB' };",
      'const { amountMinor } = money;',
      'next = { ...next, previousUnitPrice: { amountMinor: item.wasMinor, currency: item.currency } };',
      'if (item.wasMinor !== null) copy(item.wasMinor);',
    ]) {
      expect(arithmetic(sample)).toBe(false);
    }
  });
});
