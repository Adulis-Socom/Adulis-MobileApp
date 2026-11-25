import { am, en } from '@adulis/locale/mobile';

import { createApiClient } from '../api/client';
import { claimsIn } from '../testing/discovery-rules';
import { productionSources, repoFile } from '../testing/source-scan';

/**
 * Home's Following, Nearby, Discounts and Locally Made channels have no server feed, no
 * eligibility fact and no flag, and the app asks the OS for nothing on their behalf. These
 * checks hold that: they fail the day the contract, the API client, the app or the manifest
 * gains a fact for one of these channels, so the change is made on purpose and never by
 * accident. Each scan is proved on synthetic input as well as on the real files, so a pattern
 * that stops matching cannot pass silently.
 *
 * When the contract scan fails, the contract gained a name that matches a channel fact. Decide
 * which it is. If it IS a channel fact, the channel's own states, the tests here and the
 * founder's ruling for that channel change in the same change as the code that uses it. If it
 * is unrelated (a Seller store location for another purpose, a commerce offer that is not a
 * discount), add its exact entry to ACKNOWLEDGED with the reason, in the same change as the API
 * addition. A pattern is never loosened to make a name pass.
 *
 * The contract scan covers every operation, not only the ones a Buyer can reach: the earliest
 * sign of a channel fact is on the Seller side (a Seller creating a discount, marking a Product
 * locally made, saving a store location), long before any Buyer feed exists.
 */

type Parameter = { name: string };
type Operation = { parameters?: Parameter[]; requestBody?: { content?: Record<string, { schema?: { properties?: Record<string, unknown> } }> } };
type Contract = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, { properties?: Record<string, unknown> } | undefined> };
};

/**
 * A word of a path segment that names the follow or feed resource, once the segment is split on `-`
 * and `_`: `/v1/feed`, `/v1/home-feed`, `/v1/me/followed-sellers`, `/v1/sellers/{handle}/follow-state`
 * match; `/v1/feedback` (the word is "feedback") and a `{parameter}` segment do not.
 */
const PATH_TOKEN = /^(feeds?|follows?|followed|following|followers?)$/i;
const PATH_WORD = /nearby|discount|locally|offer|promotion/i;
const PARAMETER_NAME = /follow|nearby|discount|locally|lat(itude)?$|lng|lon(gitude)?$|radius|distance|\barea\b|geo|location|market|country/i;
// "following", not "follow": the contract's Seller-verification and Seller-analytics counts
// (follower_count, followers) are not a Buyer follow relationship.
const PROPERTY_NAME = /discount|compare_at|original_price|sale_price|offer|promotion|locally|made_in|latitude|longitude|geo|distance|radius|nearby|following|ends_at/i;

/**
 * Names in the contract that are acknowledged as NOT being a Home channel fact: the exact entry
 * `channelFactsIn` reports, and why. Empty today. An entry whose name no longer exists in the
 * contract, or that has no reason, fails below.
 */
type Acknowledgement = { fact: string; reason: string };
const ACKNOWLEDGED: readonly Acknowledgement[] = [];

/** The facts nobody has acknowledged. */
const unacknowledged = (facts: readonly string[], list: readonly Acknowledgement[]) => facts.filter((fact) => !list.some((entry) => entry.fact === fact));
/** The acknowledgements that give no real reason. */
const withoutReason = (list: readonly Acknowledgement[]) => list.filter((entry) => entry.reason.trim().length < 12).map((entry) => entry.fact);
/** The acknowledgements whose name is no longer in the contract. */
const stale = (present: readonly string[], list: readonly Acknowledgement[]) => list.filter((entry) => !present.includes(entry.fact)).map((entry) => entry.fact);

// A `{parameter}` segment keeps its braces in the token, so it never matches the feed and follow words.
const pathMatches = (path: string) =>
  PATH_WORD.test(path) || path.split('/').some((segment) => segment.split(/[-_]/).some((token) => PATH_TOKEN.test(token)));

/** Every name in the contract that belongs to a Home channel fact, as `kind name`. */
function channelFactsIn(contract: Contract): string[] {
  const found: string[] = [];
  for (const [path, item] of Object.entries(contract.paths)) {
    if (pathMatches(path)) found.push(`path ${path}`);
    for (const [method, operation] of Object.entries(item)) {
      for (const parameter of operation.parameters ?? []) {
        if (PARAMETER_NAME.test(parameter.name)) found.push(`parameter ${method} ${path} ${parameter.name}`);
      }
      for (const body of Object.values(operation.requestBody?.content ?? {})) {
        for (const name of Object.keys(body.schema?.properties ?? {})) {
          if (PROPERTY_NAME.test(name)) found.push(`body ${method} ${path} ${name}`);
        }
      }
    }
  }
  for (const [schema, definition] of Object.entries(contract.components.schemas)) {
    for (const name of Object.keys(definition?.properties ?? {})) {
      if (PROPERTY_NAME.test(name)) found.push(`property ${schema}.${name}`);
    }
  }
  return found;
}

const contract = JSON.parse(repoFile('contracts/openapi.json')) as Contract;

describe('what the contract says about the four channels', () => {
  it('carries no Following, Nearby, Discounts or Locally Made fact in any path, parameter or property', () => {
    // A floor against an empty or truncated contract: 94 paths after migration 0063 retired the order family.
    expect(Object.keys(contract.paths).length).toBeGreaterThan(80);
    const open = unacknowledged(channelFactsIn(contract), ACKNOWLEDGED);
    if (open.length > 0) {
      throw new Error(
        `The contract names something that looks like a Home channel fact (Following, Nearby, Discounts, Locally Made):\n  ${open.join('\n  ')}\n` +
          'If it is a channel fact, update that channel (its states, these tests and the ruling that allows it) in the same change as the code that uses it. ' +
          'If it is unrelated, add the exact entry above to ACKNOWLEDGED in this file with the reason. Do not loosen a pattern.',
      );
    }
  });

  it('keeps no acknowledgement that has lost its name or its reason', () => {
    const present = channelFactsIn(contract);
    expect(withoutReason(ACKNOWLEDGED)).toEqual([]);
    expect(stale(present, ACKNOWLEDGED)).toEqual([]);
  });

  describe('the acknowledgement checks, on lists of their own', () => {
    const entry = (fact: string, reason: string): Acknowledgement => ({ fact, reason });
    const FACT = 'property CourierJobDto.offer_expires_at';
    it('an acknowledged fact is not reported, and an unknown one is', () => {
      expect(unacknowledged([FACT], [entry(FACT, 'A Courier job offer, not a Buyer discount')])).toEqual([]);
      expect(unacknowledged([FACT, 'path /v1/feed'], [entry(FACT, 'A Courier job offer, not a Buyer discount')])).toEqual(['path /v1/feed']);
      expect(unacknowledged([FACT], [])).toEqual([FACT]);
    });

    it('an entry with a short or blank reason is flagged, and one with a reason is not', () => {
      expect(withoutReason([entry(FACT, 'ok'), entry('path /v1/x', '   ')])).toEqual([FACT, 'path /v1/x']);
      expect(withoutReason([entry(FACT, 'A Courier job offer, not a Buyer discount')])).toEqual([]);
    });

    it('an entry whose name is no longer in the contract is flagged, and a present one is not', () => {
      const list = [entry(FACT, 'A Courier job offer, not a Buyer discount'), entry('property Gone.discount', 'Was a Seller promotion code')];
      expect(stale([FACT], list)).toEqual(['property Gone.discount']);
      expect(stale([FACT, 'property Gone.discount'], list)).toEqual([]);
    });
  });

  const synthetic = (extra: Partial<Contract>): Contract => ({ paths: {}, components: { schemas: {} }, ...extra });
  it.each([
    ['a feed path', synthetic({ paths: { '/v1/feed': { get: {} } } }), 'path /v1/feed'],
    ['a follow path', synthetic({ paths: { '/v1/sellers/{handle}/follow': { post: {} } } }), 'path /v1/sellers/{handle}/follow'],
    ['a plural feed path', synthetic({ paths: { '/v1/feeds': { get: {} } } }), 'path /v1/feeds'],
    ['a hyphenated feed path', synthetic({ paths: { '/v1/home-feed': { get: {} } } }), 'path /v1/home-feed'],
    ['a following-feed path', synthetic({ paths: { '/v1/following-feed': { get: {} } } }), 'path /v1/following-feed'],
    ['an underscored feed path', synthetic({ paths: { '/v1/scene_feed': { get: {} } } }), 'path /v1/scene_feed'],
    ['a followed path', synthetic({ paths: { '/v1/me/followed': { get: {} } } }), 'path /v1/me/followed'],
    ['a followed-sellers path', synthetic({ paths: { '/v1/me/followed-sellers': { get: {} } } }), 'path /v1/me/followed-sellers'],
    ['a follow-state path', synthetic({ paths: { '/v1/sellers/{handle}/follow-state': { get: {} } } }), 'path /v1/sellers/{handle}/follow-state'],
    ['a nearby parameter', synthetic({ paths: { '/v1/x': { get: { parameters: [{ name: 'nearby' }] } } } }), 'parameter get /v1/x nearby'],
    ['a discount property', synthetic({ components: { schemas: { Dto: { properties: { discounted_price_minor: {} } } } } }), 'property Dto.discounted_price_minor'],
    ['a latitude property', synthetic({ components: { schemas: { Dto: { properties: { latitude: {} } } } } }), 'property Dto.latitude'],
    ['a locally made property', synthetic({ components: { schemas: { Dto: { properties: { locally_made: {} } } } } }), 'property Dto.locally_made'],
    [
      'a request body that names a location',
      synthetic({ paths: { '/v1/x': { post: { requestBody: { content: { 'application/json': { schema: { properties: { geo: {} } } } } } } } } }),
      'body post /v1/x geo',
    ],
  ])('the scan finds %s', (_name, input, expected) => {
    expect(channelFactsIn(input)).toEqual([expected]);
  });

  it('does not take a feedback path, a path parameter named like a feed, or a follower count for a channel fact', () => {
    const near = synthetic({
      paths: { '/v1/feedback': { post: {} }, '/v1/things/{feed}/x': { get: {} }, '/v1/feedback-form': { get: {} } },
      components: { schemas: { Dto: { properties: { follower_count: {}, followers: {} } } } },
    });
    expect(channelFactsIn(near)).toEqual([]);
  });

  it('names no feature flag: bootstrap sends an open boolean map', () => {
    const flags = contract.components.schemas['BootstrapResponseDto']?.properties?.['feature_flags'];
    expect(flags).toEqual({ type: 'object', additionalProperties: { type: 'boolean' } });
  });
});

describe('what the app can do', () => {
  it('has no API client method for a Home channel', () => {
    const client = createApiClient({ deviceId: async () => 'device-1', token: () => null, onSessionEnded: () => undefined });
    const methods = Object.keys(client);
    expect(methods).toContain('fyp');
    expect(methods.filter((name) => /follow|feed|nearby|discount|locally/i.test(name))).toEqual([]);
  });
});

/**
 * The text of a source file without its comments. Only a comment that begins a line (`//`, or a
 * block comment) and a trailing `//` after code with balanced quotes are removed, so a string such
 * as 'image/*' can never open a comment and hide the code after it: what is not recognised as a
 * comment is scanned, which fails closed.
 */
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

describe('the comment stripper used by the scans below', () => {
  it('removes a comment line, a block comment and a trailing comment', () => {
    expect(stripComments('// expo-location\n/* PermissionsAndroid */\nconst a = 1; // NSLocation here\n')).toBe('\n\nconst a = 1;\n');
  });

  it('does not let a string that contains /* hide the code after it', () => {
    const source = "const accept = 'image/*';\nawait Location.getCurrentPositionAsync({});\n/* done */\n";
    expect(stripComments(source)).toContain('getCurrentPositionAsync');
  });

  it('keeps a URL string and the code after it', () => {
    expect(stripComments("const url = 'https://x.test/a'; const n = 'expo-location';")).toContain('expo-location');
  });

  it('keeps code after a spaced // that sits inside a string (the quote-count branch)', () => {
    const source = "const s = 'a // b'; await Location.getCurrentPositionAsync({});";
    expect(stripComments(source)).toContain('getCurrentPositionAsync');
  });
});

const LOCATION_API =
  /expo-location|expo-maps|react-native-maps|@rnmapbox\/maps|@react-native-community\/geolocation|react-native-geolocation-service|react-native-background-geolocation|expo-task-manager|expo-background-fetch|expo-background-task|requestForegroundPermissionsAsync|requestBackgroundPermissionsAsync|getCurrentPositionAsync|watchPositionAsync|getCurrentPosition\(|watchPosition\(|navigator\.geolocation|ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION|NSLocation/;

/** Whether a source file uses a listed location, map or background-task API, or asks Android for a location permission. */
function locationApiIn(text: string): boolean {
  const code = stripComments(text);
  return LOCATION_API.test(code) || (/PermissionsAndroid/.test(code) && /LOCATION/i.test(code));
}

describe('what the app asks the OS for', () => {
  it('no production source uses a listed location, map or background-task API', () => {
    const files = productionSources('.');
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter(({ text }) => locationApiIn(text)).map(({ file }) => file)).toEqual([]);
  });

  it.each([
    "import * as Location from 'expo-location';",
    'await Location.requestForegroundPermissionsAsync();',
    'await Location.requestBackgroundPermissionsAsync();',
    'await Location.getCurrentPositionAsync({});',
    'Location.watchPositionAsync({}, () => {});',
    "PermissionsAndroid.request('android.permission.ACCESS_COARSE_LOCATION');",
    'PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);',
    'navigator.geolocation.getCurrentPosition(ok);',
    "import Geolocation from '@react-native-community/geolocation';",
    "import Geolocation from 'react-native-geolocation-service';",
    'Geolocation.getCurrentPosition(ok, fail);',
    "const p = 'android.permission.ACCESS_FINE_LOCATION';",
    "const p = 'NSLocationWhenInUseUsageDescription';",
    "import MapView from 'react-native-maps';",
    "import Mapbox from '@rnmapbox/maps';",
    "import { MapView } from 'expo-maps';",
    "import * as TaskManager from 'expo-task-manager';",
    "import * as BackgroundTask from 'expo-background-task';",
    "const s = 'a // b'; await Location.getCurrentPositionAsync({});",
    "const accept = 'image/*';\nawait Location.getCurrentPositionAsync({});\n/* done */",
  ])('the scan finds %s', (sample) => {
    expect(locationApiIn(sample)).toBe(true);
  });

  it('does not take a comment for a call, or a camera permission for a location one', () => {
    expect(locationApiIn('// the app never calls PermissionsAndroid\n/* expo-location is not installed */')).toBe(false);
    expect(locationApiIn("PermissionsAndroid.request('android.permission.CAMERA');")).toBe(false);
  });
});

type Json = Record<string, unknown>;
const LOCATION_PACKAGES = [
  'expo-location',
  'expo-maps',
  'react-native-maps',
  '@rnmapbox/maps',
  '@react-native-community/geolocation',
  'react-native-geolocation-service',
  'react-native-background-geolocation',
  'expo-task-manager',
  'expo-background-fetch',
  'expo-background-task',
];

/** What in a package.json and an app.json would give the app a location capability. */
function locationCapabilityIn(pkg: Json, app: Json): string[] {
  const found: string[] = [];
  const dependencies = { ...((pkg['dependencies'] as Json | undefined) ?? {}), ...((pkg['devDependencies'] as Json | undefined) ?? {}) };
  for (const name of LOCATION_PACKAGES) if (name in dependencies) found.push(`dependency ${name}`);
  const expo = (app['expo'] as Json | undefined) ?? {};
  for (const plugin of (expo['plugins'] as unknown[] | undefined) ?? []) {
    const name = Array.isArray(plugin) ? String(plugin[0]) : String(plugin);
    if (LOCATION_PACKAGES.includes(name)) found.push(`plugin ${name}`);
  }
  const permissions = ((expo['android'] as Json | undefined) ?? {})['permissions'] as unknown[] | undefined;
  for (const permission of permissions ?? []) {
    if (/LOCATION/i.test(String(permission))) found.push(`android.permissions ${String(permission)}`);
  }
  const infoPlist = ((expo['ios'] as Json | undefined) ?? {})['infoPlist'] as Json | undefined;
  for (const key of Object.keys(infoPlist ?? {})) {
    if (key.startsWith('NSLocation')) found.push(`ios.infoPlist ${key}`);
  }
  return found;
}

describe('what the package and the manifest carry', () => {
  it('carry no listed location, map or background-task package, plugin or permission', () => {
    const pkg = JSON.parse(repoFile('apps/mobile/package.json')) as Json;
    const app = JSON.parse(repoFile('apps/mobile/app.json')) as Json;
    expect(Object.keys(pkg['dependencies'] as Json).length).toBeGreaterThan(10);
    expect(locationCapabilityIn(pkg, app)).toEqual([]);
  });

  it.each([
    ['a location dependency', { dependencies: { 'expo-location': '~58.0.0' } }, {}, ['dependency expo-location']],
    ['a maps dev dependency', { devDependencies: { 'react-native-maps': '1.0.0' } }, {}, ['dependency react-native-maps']],
    ['a geolocation dependency', { dependencies: { '@react-native-community/geolocation': '3.0.0' } }, {}, ['dependency @react-native-community/geolocation']],
    ['a background task dependency', { dependencies: { 'expo-background-task': '~1.0.0' } }, {}, ['dependency expo-background-task']],
    ['a location plugin', {}, { expo: { plugins: ['expo-router', ['expo-location', { isIosBackgroundLocationEnabled: false }]] } }, ['plugin expo-location']],
    ['an Android location permission', {}, { expo: { android: { permissions: ['CAMERA', 'ACCESS_COARSE_LOCATION'] } } }, ['android.permissions ACCESS_COARSE_LOCATION']],
    ['an iOS location usage string', {}, { expo: { ios: { infoPlist: { NSLocationWhenInUseUsageDescription: 'x' } } } }, ['ios.infoPlist NSLocationWhenInUseUsageDescription']],
  ])('the scan finds %s', (_name, pkg, app, expected) => {
    expect(locationCapabilityIn(pkg as Json, app as Json)).toEqual(expected);
  });

  it('does not take an Android camera or notification permission for a location one', () => {
    expect(locationCapabilityIn({}, { expo: { android: { permissions: ['CAMERA', 'POST_NOTIFICATIONS'] } } })).toEqual([]);
  });
});

const CHANNEL_FILES = [
  'buyer/ChannelScreen.tsx',
  'buyer/channels.ts',
  'app/(buyer)/(tabs)/home/following.tsx',
  'app/(buyer)/(tabs)/home/nearby.tsx',
  'app/(buyer)/(tabs)/home/discounts.tsx',
  'app/(buyer)/(tabs)/home/locally-made.tsx',
];
/**
 * What a channel that has no feed must not do: read data, a flag, a Market or an Account, keep
 * anything, or build a list on the device. (Reading the flag map for an unrelated purpose, a kill
 * switch for sharing say, is not banned elsewhere; only these channel files are held.)
 */
const CHANNEL_FORBIDDEN =
  /\b(useQuery|useInfiniteQuery|usePublicList|useForYouFeed|useSession|useBootstrap)\b|feature_flags|expo-sqlite|expo-secure-store|\.(filter|sort|toSorted|reverse|toReversed)\(|candidate_source|price_|category|market|country/i;

describe('the four channel files', () => {
  it('read no feed, list, flag, price, category, Market or Account, and keep nothing', () => {
    const files = productionSources('buyer', 'app').filter(({ file }) => CHANNEL_FILES.includes(file));
    expect(files.map(({ file }) => file).sort()).toEqual([...CHANNEL_FILES].sort());
    expect(files.filter(({ text }) => CHANNEL_FORBIDDEN.test(stripComments(text))).map(({ file }) => file)).toEqual([]);
  });

  it.each([
    'const feed = useForYouFeed();',
    'const list = usePublicList({ resource: [] });',
    'const session = useSession();',
    'const boot = useBootstrap();',
    'const flags = data.feature_flags;',
    "import * as SecureStore from 'expo-secure-store';",
    'const shown = units.filter((u) => u.candidate_source === x);',
    'const cheapest = items.sort((a, b) => a.price_min_minor - b.price_min_minor);',
    "const label = market.code === 'ET' ? a : b;",
    'const local = products.filter((p) => p.category === c);',
  ])('the scan finds %s', (sample) => {
    expect(CHANNEL_FORBIDDEN.test(stripComments(sample))).toBe(true);
  });

  it('is not fooled by a comment', () => {
    expect(CHANNEL_FORBIDDEN.test(stripComments('// no useSession, no market, no category, no feature_flags'))).toBe(false);
  });
});

describe('where the app reads a feed unit source', () => {
  it('no production file outside the test helpers reads candidate_source', () => {
    const files = productionSources('.').filter(({ file }) => !file.startsWith('testing/'));
    expect(files.length).toBeGreaterThan(100);
    // A feed unit's source is the server's ranking detail; the app never classifies on it.
    expect(files.filter(({ text }) => /candidate_source/.test(stripComments(text))).map(({ file }) => file)).toEqual([]);
  });
});

describe('the channel sentences', () => {
  const KEYS = [
    'buyer.home.following.coming',
    'buyer.home.nearby.coming',
    'buyer.home.discounts.coming',
    'buyer.home.locally_made.coming',
  ] as const;
  const slots = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('make no claim of popularity, trust, price or stock, and each has the same slots in both languages', () => {
    const english = KEYS.map((key) => en[key]);
    expect(english.every((text) => text.length > 0)).toBe(true);
    expect(claimsIn(english)).toEqual([]);
    for (const key of KEYS) {
      expect(am[key].length).toBeGreaterThan(0);
      expect(slots(am[key])).toEqual(slots(en[key]));
    }
  });
});
