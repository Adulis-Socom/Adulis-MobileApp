import { am, en } from '@adulis/locale/mobile';

import { createApiClient } from '../api/client';
import { claimsIn } from '../testing/discovery-rules';
import { productionSources, repoFile } from '../testing/source-scan';

/**
 * Home's Following, Nearby, Discounts and Locally Made channels have no server feed, no
 * eligibility fact and no flag, and the app asks the OS for nothing on their behalf. These
 * checks hold that: they fail the day the contract, the API client, the app or the manifest
 * gains a fact for one of these channels, so the change is made on purpose, with the channel's
 * capability record updated, and never by accident. Each scan is proved on synthetic input as
 * well as on the real files, so a pattern that stops matching cannot pass silently.
 */

type Parameter = { name: string };
type Operation = { parameters?: Parameter[]; requestBody?: { content?: Record<string, { schema?: { properties?: Record<string, unknown> } }> } };
type Contract = {
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, { properties?: Record<string, unknown> } | undefined> };
};

const PATH_NAME = /follow|feed|nearby|discount|locally|offer|promotion/i;
const PARAMETER_NAME = /follow|nearby|discount|locally|lat(itude)?$|lng|lon(gitude)?$|radius|distance|\barea\b|geo|location|market|country/i;
// "following", not "follow": the contract's Seller-verification and Seller-analytics counts
// (follower_count, followers) are not a Buyer follow relationship.
const PROPERTY_NAME = /discount|compare_at|original_price|sale_price|offer|promotion|locally|made_in|latitude|longitude|geo|distance|radius|nearby|following|ends_at/i;

/** Every name in the contract that belongs to a Home channel fact, as `kind name`. */
function channelFactsIn(contract: Contract): string[] {
  const found: string[] = [];
  for (const [path, item] of Object.entries(contract.paths)) {
    if (PATH_NAME.test(path)) found.push(`path ${path}`);
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
    expect(Object.keys(contract.paths).length).toBeGreaterThan(100);
    // A name here means a channel fact exists: update the capability record and the channel's own
    // states before using it, and change this check in the same change.
    expect(channelFactsIn(contract)).toEqual([]);
  });

  const synthetic = (extra: Partial<Contract>): Contract => ({ paths: {}, components: { schemas: {} }, ...extra });
  it.each([
    ['a feed path', synthetic({ paths: { '/v1/feed': { get: {} } } }), 'path /v1/feed'],
    ['a follow path', synthetic({ paths: { '/v1/sellers/{handle}/follow': { post: {} } } }), 'path /v1/sellers/{handle}/follow'],
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

const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const LOCATION_API =
  /expo-location|requestForegroundPermissionsAsync|requestBackgroundPermissionsAsync|getCurrentPositionAsync|watchPositionAsync|PermissionsAndroid|navigator\.geolocation|ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION|NSLocation|react-native-maps|expo-task-manager/;

describe('what the app asks the OS for', () => {
  it('no production source uses a location, map or background-task API', () => {
    const files = productionSources('.');
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter(({ text }) => LOCATION_API.test(code(text))).map(({ file }) => file)).toEqual([]);
  });

  it.each([
    "import * as Location from 'expo-location';",
    'await Location.requestForegroundPermissionsAsync();',
    'await Location.requestBackgroundPermissionsAsync();',
    'await Location.getCurrentPositionAsync({});',
    'Location.watchPositionAsync({}, () => {});',
    "PermissionsAndroid.request('android.permission.ACCESS_COARSE_LOCATION');",
    'navigator.geolocation.getCurrentPosition(ok);',
    "const p = 'android.permission.ACCESS_FINE_LOCATION';",
    "const p = 'NSLocationWhenInUseUsageDescription';",
    "import MapView from 'react-native-maps';",
    "import * as TaskManager from 'expo-task-manager';",
  ])('the scan finds %s', (sample) => {
    expect(LOCATION_API.test(code(sample))).toBe(true);
  });

  it('the scan does not take a comment for a call', () => {
    expect(LOCATION_API.test(code('// the app never calls PermissionsAndroid\n/* expo-location is not installed */'))).toBe(false);
  });
});

type Json = Record<string, unknown>;
const LOCATION_PACKAGES = ['expo-location', 'react-native-maps', 'expo-task-manager', 'expo-background-fetch'];

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
  if (((expo['android'] as Json | undefined) ?? {})['permissions'] !== undefined) found.push('android.permissions');
  const infoPlist = ((expo['ios'] as Json | undefined) ?? {})['infoPlist'] as Json | undefined;
  for (const key of Object.keys(infoPlist ?? {})) {
    if (key.startsWith('NSLocation')) found.push(`ios.infoPlist ${key}`);
  }
  return found;
}

describe('what the package and the manifest carry', () => {
  it('carry no location, map or background-task capability', () => {
    const pkg = JSON.parse(repoFile('apps/mobile/package.json')) as Json;
    const app = JSON.parse(repoFile('apps/mobile/app.json')) as Json;
    expect(Object.keys(pkg['dependencies'] as Json).length).toBeGreaterThan(10);
    expect(locationCapabilityIn(pkg, app)).toEqual([]);
  });

  it.each([
    ['a location dependency', { dependencies: { 'expo-location': '~58.0.0' } }, {}, ['dependency expo-location']],
    ['a maps dev dependency', { devDependencies: { 'react-native-maps': '1.0.0' } }, {}, ['dependency react-native-maps']],
    ['a location plugin', {}, { expo: { plugins: ['expo-router', ['expo-location', { isIosBackgroundLocationEnabled: false }]] } }, ['plugin expo-location']],
    ['an Android permission list', {}, { expo: { android: { permissions: ['ACCESS_COARSE_LOCATION'] } } }, ['android.permissions']],
    ['an iOS location usage string', {}, { expo: { ios: { infoPlist: { NSLocationWhenInUseUsageDescription: 'x' } } } }, ['ios.infoPlist NSLocationWhenInUseUsageDescription']],
  ])('the scan finds %s', (_name, pkg, app, expected) => {
    expect(locationCapabilityIn(pkg as Json, app as Json)).toEqual(expected);
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
/** What a channel that has no feed must not do: read data, a Market or an Account, keep anything, or build a list on the device. */
const CHANNEL_FORBIDDEN =
  /\b(useQuery|useInfiniteQuery|usePublicList|useForYouFeed|useSession|useBootstrap)\b|expo-sqlite|expo-secure-store|\.(filter|sort|toSorted|reverse|toReversed)\(|candidate_source|price_|category|market|country/i;

describe('the four channel files', () => {
  it('read no feed, list, price, category, Market or Account, and keep nothing', () => {
    const files = productionSources('buyer', 'app').filter(({ file }) => CHANNEL_FILES.includes(file));
    expect(files.map(({ file }) => file).sort()).toEqual([...CHANNEL_FILES].sort());
    expect(files.filter(({ text }) => CHANNEL_FORBIDDEN.test(code(text))).map(({ file }) => file)).toEqual([]);
  });

  it.each([
    'const feed = useForYouFeed();',
    'const list = usePublicList({ resource: [] });',
    'const session = useSession();',
    'const flags = useBootstrap().data?.feature_flags;',
    "import * as SecureStore from 'expo-secure-store';",
    'const shown = units.filter((u) => u.candidate_source === x);',
    'const cheapest = items.sort((a, b) => a.price_min_minor - b.price_min_minor);',
    "const label = market.code === 'ET' ? a : b;",
    'const local = products.filter((p) => p.category === c);',
  ])('the scan finds %s', (sample) => {
    expect(CHANNEL_FORBIDDEN.test(code(sample))).toBe(true);
  });

  it('is not fooled by a comment', () => {
    expect(CHANNEL_FORBIDDEN.test(code('// no useSession, no market, no category'))).toBe(false);
  });
});

describe('where the app reads the feed and the flags', () => {
  it('no production file reads candidate_source or feature_flags', () => {
    const files = productionSources('.').filter(({ file }) => !file.startsWith('testing/'));
    expect(files.length).toBeGreaterThan(100);
    // When a later change reads a flag or a feed's source, it updates this check on purpose.
    expect(files.filter(({ text }) => /candidate_source|feature_flags/.test(code(text))).map(({ file }) => file)).toEqual([]);
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
