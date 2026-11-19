import { am, en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Dimensions, Linking, PermissionsAndroid, Platform, StyleSheet, Text } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { controlsShown } from '../testing/discovery-rules';
import { GOOD_TOKEN, bootstrapBody, fypPage, fypUnit, installFakeApi, shopProduct } from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * Home's Following, Nearby, Discounts and Locally Made channels on the real route tree. None of
 * them has a server feed, so each is one honest sentence: it shows nothing the server did not
 * send, requests nothing, keeps nothing, asks the OS for nothing, and ignores every flag. A
 * Buyer sees the same panel signed in or not, because there is no feed for an Account to unlock.
 * When a channel gains a feed, the tests that say so here change with it, on purpose.
 */
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
// The first walk through the real tree transforms expo-router on a cold cache (always, in CI).
jest.setTimeout(60_000);

const CHANNELS = [
  ['following', 'buyer.home.channel.following', 'buyer.home.following.coming', '/home/following'],
  ['nearby', 'buyer.home.channel.nearby', 'buyer.home.nearby.coming', '/home/nearby'],
  ['discounts', 'buyer.home.channel.discounts', 'buyer.home.discounts.coming', '/home/discounts'],
  ['locally-made', 'buyer.home.channel.locally_made', 'buyer.home.locally_made.coming', '/home/locally-made'],
] as const;
const AUDIENCES = [
  ['a guest', false],
  ['a signed-in Buyer', true],
] as const;

const TAB_LABELS = [en['buyer.tab.home'], en['buyer.tab.shop'], en['buyer.tab.saved'], en['buyer.tab.orders'], en['buyer.tab.you']];
const CHANNEL_LABELS = [
  en['buyer.home.channel.for_you'],
  en['buyer.home.channel.following'],
  en['buyer.home.channel.nearby'],
  en['buyer.home.channel.discounts'],
  en['buyer.home.channel.locally_made'],
];
// The controls Home draws around a channel's panel, in order. If Home's shell gains or loses a
// control (a header entry, a sixth tab), update these two lists; every channel test then follows.
const HOME_CONTROLS: string[] = [en['buyer.search'], en['buyer.notifications'], ...CHANNEL_LABELS, ...TAB_LABELS];
/** For You's empty panel has one control of its own (Refresh): the scan sees a panel's controls, so a channel's absence of one means something. */
const FOR_YOU_CONTROLS: string[] = [
  en['buyer.search'],
  en['buyer.notifications'],
  ...CHANNEL_LABELS,
  en['buyer.for_you.refresh'],
  ...TAB_LABELS,
];
/** The header's two buttons and the channel tabs carry these roles; the tab bar's items carry none under Jest. */
const rolesOnScreen = () => controlsShown().map((control) => control.role);

const tab = (name: string) => screen.getByRole('tab', { name });
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
/** Let any request a screen would make on its own happen, including one on a short timer (renderRouter runs fake timers). */
const settle = () => act(() => jest.advanceTimersByTimeAsync(10_000));
/**
 * Every control a Buyer can reach on a channel, by name and in order: Home's own header, the five
 * channel tabs and the five tabs. A channel's panel adds none (found by behaviour, so a control with
 * no role would be listed too).
 */
const controlsOnScreen = () => controlsShown().map((control) => control.name);
/**
 * Every sentence and label drawn on a channel, in order: the wordmark, the five channel labels, the
 * channel's own sentence, the five tab labels. Anything else a channel drew (a note, a count, an
 * item) would be listed, so the panel is exactly its one sentence.
 */
const textsOnChannel = (sentence: string) => [
  en['buyer.wordmark'],
  ...CHANNEL_LABELS,
  sentence,
  ...TAB_LABELS,
];
/** The text a Text draws, as the screen shows it: strings, numbers and nested Text joined; a missing or boolean child draws nothing. */
function drawn(children: unknown): string {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(drawn).join('');
  return drawn((children as { props?: { children?: unknown } }).props?.children);
}
/** Icon glyphs sit in the Unicode private-use area: they are drawn by a font, and are not text a Buyer reads. */
const isGlyph = (text: string) => text.replace(/[\uE000-\uF8FF]/g, '').trim() === '';
const visibleTexts = () =>
  screen
    .queryAllByText(/[\s\S]+/)
    .map((node) => drawn(node.props.children))
    .filter((text) => !isGlyph(text));

let api: ReturnType<typeof installFakeApi>;

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('the drawn-text helper', () => {
  it('lists a number, a mixed Text and a sentence, and skips an icon glyph and an empty Text', async () => {
    await render(
      <>
        <Text>A sentence.</Text>
        <Text>{3}</Text>
        <Text>{4} items</Text>
        <Text>{'\uF123'}</Text>
        <Text>{null}</Text>
      </>,
    );
    expect(visibleTexts()).toEqual(['A sentence.', '3', '4 items']);
  });
});

/** For You is on screen and the app is quiet: the point after which a channel must add nothing. */
async function startedOnForYou() {
  const r = await renderRouter(APP_DIR);
  await screen.findByText(en['buyer.for_you.empty']);
  await settle();
  return r;
}

describe.each(AUDIENCES)('%s on the four channels', (_audience, isSignedIn) => {
  beforeEach(() => {
    if (isSignedIn) signedIn();
  });

  it.each(CHANNELS)('%s opens by tab press and shows its sentence and no control of its own', async (_name, label, coming, path) => {
    const r = await startedOnForYou();
    // The scan sees a panel's own control on For You, so its absence on a channel is a result, not an empty scan.
    expect(controlsOnScreen()).toEqual(FOR_YOU_CONTROLS);

    await fireEvent.press(tab(en[label]));
    expect(await screen.findByText(en[coming])).toBeOnTheScreen();
    expect(r.getPathname()).toBe(path);
    expect(tab(en[label])).toBeSelected();
    expect(controlsOnScreen()).toEqual(HOME_CONTROLS);
    expect(visibleTexts()).toEqual(textsOnChannel(en[coming]));
    expect(rolesOnScreen().slice(0, 7)).toEqual(['button', 'button', 'tab', 'tab', 'tab', 'tab', 'tab']);
    // For You is still mounted underneath (hidden, not gone), so the absence checks below mean it is not showing.
    expect(screen.queryByTestId('for-you-state', { includeHiddenElements: true })).not.toBeNull();
    expect(screen.queryByTestId('for-you-state')).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.empty'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['auth.sign_in'])).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['auth.sign_in'] })).not.toBeOnTheScreen();
  });
});

describe('what a channel may and may not read', () => {
  it('a server that serves Scenes, Products, categories and search results fills no channel and is read only by For You', async () => {
    api.on('GET /v1/fyp', () => ({
      status: 200,
      // The schema lists FOLLOWING as a candidate source; a channel never filters on it.
      body: fypPage([fypUnit(1), fypUnit(2, { candidate_source: 'FOLLOWING' })]),
    }));
    api.on('GET /v1/shop/products', () => ({
      status: 200,
      body: { market_resolved: true, data: [shopProduct('cup', 'Clay cup')], next_cursor: null },
    }));
    api.on('GET /v1/categories', () => ({
      status: 200,
      body: {
        market_resolved: true,
        data: [{ id: 'ca7e0000-0000-4000-8000-000000000001', code: 'FASHION', parent_id: null, label_key: 'catalogue.category.fashion', display_order: 10 }],
      },
    }));
    api.on('GET /v1/search', () => ({
      status: 200,
      body: {
        market_resolved: true,
        type: 'TOP',
        algorithm_version: 'lexical-trgm-v1',
        items: [
          { type: 'PRODUCT_POST', payload: shopProduct('cup', 'Clay cup') },
          { type: 'SELLER', payload: { handle: 'seller-1', store_name: 'Basket House', trust_level: 'ESTABLISHED' } },
        ],
        next_cursor: null,
      },
    }));
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Store 1')).toBeOnTheScreen();
    expect(screen.getByText('Store 2')).toBeOnTheScreen();
    await settle();
    const before = api.calls.length;

    for (const [, label, coming] of CHANNELS) {
      await fireEvent.press(tab(en[label]));
      expect(await screen.findByText(en[coming])).toBeOnTheScreen();
      await settle();
      // Whatever is drawn is the sentence and Home's own labels: not a caption, handle, count or name taken from the Scenes
      // For You still holds (mounted, hidden, with its list), and no control beyond Home's own.
      expect(visibleTexts()).toEqual(textsOnChannel(en[coming]));
      expect(controlsOnScreen()).toEqual(HOME_CONTROLS);
      expect(screen.queryByTestId('for-you-list', { includeHiddenElements: true })).not.toBeNull();
      expect(screen.queryByTestId('for-you-list')).not.toBeOnTheScreen();
      expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
      expect(screen.queryByText('Store 2')).not.toBeOnTheScreen();
      expect(screen.queryByText('Clay cup')).not.toBeOnTheScreen();
      expect(api.calls.slice(before).map((call) => `${call.method} ${call.path}`)).toEqual([]);
    }
    expect(api.callsTo('GET /v1/fyp')).toHaveLength(1);
  });

  it('flags named for each channel leave all four channels unavailable and ask for nothing', async () => {
    const names = ['following', 'nearby', 'discounts', 'locally_made', 'locally-made', 'home.following', 'home.nearby', 'market_collections'];
    api.on('GET /v1/bootstrap', () => ({
      status: 200,
      body: bootstrapBody({ feature_flags: Object.fromEntries(names.map((name) => [name, true])) }),
    }));
    await startedOnForYou();
    const before = api.calls.length;

    for (const [, label, coming] of CHANNELS) {
      await fireEvent.press(tab(en[label]));
      expect(await screen.findByText(en[coming])).toBeOnTheScreen();
      await settle();
      expect(controlsOnScreen()).toEqual(HOME_CONTROLS);
      expect(visibleTexts()).toEqual(textsOnChannel(en[coming]));
    }
    expect(api.calls.slice(before).map((call) => `${call.method} ${call.path}`)).toEqual([]);
  });

  it('the channels say nothing about the connection and ask for nothing offline or on reconnecting', async () => {
    await startedOnForYou();
    const mark = api.calls.length;
    try {
      await act(async () => onlineManager.setOnline(false));
      expect(onlineManager.isOnline()).toBe(false);
      for (const [, label, coming] of CHANNELS) {
        await fireEvent.press(tab(en[label]));
        expect(await screen.findByText(en[coming])).toBeOnTheScreen();
        await settle();
        // The sentence and Home's labels, in any wording of "offline" or none.
        expect(visibleTexts()).toEqual(textsOnChannel(en[coming]));
        expect(controlsOnScreen()).toEqual(HOME_CONTROLS);
        expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
      }
      expect(api.calls.slice(mark)).toEqual([]);
    } finally {
      await act(async () => onlineManager.setOnline(true));
    }
    await settle();
    // Coming back online makes no channel read anything either.
    expect(onlineManager.isOnline()).toBe(true);
    expect(api.calls.slice(mark)).toEqual([]);
    expect(visibleTexts()).toEqual(textsOnChannel(en['buyer.home.locally_made.coming']));
  });

  it('signing out leaves Following as it was and sends nothing with the old credential', async () => {
    signedIn();
    await startedOnForYou();
    await fireEvent.press(tab(en['buyer.home.channel.following']));
    expect(await screen.findByText(en['buyer.home.following.coming'])).toBeOnTheScreen();

    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    const afterSignOut = api.calls.length;

    await fireEvent.press(bottomTab(en['buyer.tab.home']));
    expect(await screen.findByText(en['buyer.home.following.coming'])).toBeOnTheScreen();
    await settle();
    const later = api.calls.slice(afterSignOut);
    // Home may read again as a guest; the old credential is never sent, and no read is a channel's own.
    expect(later.filter((call) => call.headers.Authorization !== undefined && call.path !== '/v1/auth/logout')).toEqual([]);
    const mark = api.calls.length;
    await fireEvent.press(tab(en['buyer.home.channel.nearby']));
    expect(await screen.findByText(en['buyer.home.nearby.coming'])).toBeOnTheScreen();
    await fireEvent.press(tab(en['buyer.home.channel.following']));
    expect(await screen.findByText(en['buyer.home.following.coming'])).toBeOnTheScreen();
    await settle();
    expect(api.calls.slice(mark)).toEqual([]);
  });
});

describe('how a channel reads', () => {
  it.each(CHANNELS)('%s in Amharic shows the Amharic sentence and not the English one', async (_name, label, coming) => {
    useUiStore.setState({ locale: 'am' });
    await renderRouter(APP_DIR);
    await screen.findByText(am['buyer.for_you.empty']);
    await fireEvent.press(tab(am[label]));
    expect(await screen.findByText(am[coming])).toBeOnTheScreen();
    expect(screen.queryByText(en[coming])).not.toBeOnTheScreen();
  });

  describe('at 360 dp and 200% type', () => {
    const WINDOW = Dimensions.get('window');
    const SCREEN = Dimensions.get('screen');
    beforeEach(() =>
      Dimensions.set({
        window: { ...WINDOW, width: 360, height: 640, fontScale: 2 },
        screen: { ...SCREEN, width: 360, height: 640, fontScale: 2 },
      }),
    );
    afterEach(() => act(async () => Dimensions.set({ window: WINDOW, screen: SCREEN })));

    type Node = { parent: Node | null; props: Record<string, unknown>; type: unknown };
    const flat = (node: Node) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
    /** A fixed-height box around the text, up to the screen's own scroll view. */
    const fixedBox = (node: Node) => {
      for (let up = node.parent; up; up = up.parent) {
        if (typeof up.type !== 'string') continue;
        if (String(up.type) === 'RCTScrollView') return null;
        const style = flat(up);
        if (style.height !== undefined || style.maxHeight !== undefined) return up;
      }
      return null;
    };

    it('no channel sentence is clamped, boxed or cut', async () => {
      await startedOnForYou();
      for (const [, label, coming] of CHANNELS) {
        await fireEvent.press(tab(en[label]));
        const sentence = await screen.findByText(en[coming]);
        expect(sentence.props.numberOfLines).toBeUndefined();
        expect(sentence.props.adjustsFontSizeToFit).toBeUndefined();
        expect(fixedBox(sentence as never)).toBeNull();
      }
    });
  });

  it.each(CHANNELS)('a link to %s opens it cold, and Back goes to For You', async (_name, label, coming, path) => {
    const r = await renderRouter(APP_DIR, { initialUrl: path });
    expect(await screen.findByText(en[coming])).toBeOnTheScreen();
    expect(r.getPathname()).toBe(path);
    expect(tab(en[label])).toBeSelected();

    await act(() => router.back());
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });
});

describe('what a channel asks of the device', () => {
  const spies: jest.SpyInstance[] = [];
  beforeEach(() => {
    spies.push(
      jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue('denied'),
      jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({} as never),
      jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false),
      jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined),
      jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined),
    );
  });
  afterEach(() => {
    while (spies.length) spies.pop()!.mockRestore();
  });
  const asked = () => spies.map((spy) => spy.mock.calls.length);

  it.each(AUDIENCES)('Nearby asks the OS for nothing for %s', async (_audience, isSignedIn) => {
    if (isSignedIn) signedIn();
    await startedOnForYou();
    await fireEvent.press(tab(en['buyer.home.channel.nearby']));
    expect(await screen.findByText(en['buyer.home.nearby.coming'])).toBeOnTheScreen();
    await fireEvent.press(tab(en['buyer.home.channel.for_you']));
    await screen.findByText(en['buyer.for_you.empty']);
    await fireEvent.press(tab(en['buyer.home.channel.nearby']));
    expect(await screen.findByText(en['buyer.home.nearby.coming'])).toBeOnTheScreen();
    await settle();
    expect(asked()).toEqual([0, 0, 0, 0, 0]);
  });

  it('a link straight to Nearby asks the OS for nothing', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/home/nearby' });
    expect(await screen.findByText(en['buyer.home.nearby.coming'])).toBeOnTheScreen();
    await settle();
    expect(asked()).toEqual([0, 0, 0, 0, 0]);
  });

  it.each(AUDIENCES)('visiting the channels stores nothing of their own for %s', async (_audience, isSignedIn) => {
    if (isSignedIn) signedIn();
    await startedOnForYou();
    for (const [, label, coming] of CHANNELS) {
      await fireEvent.press(tab(en[label]));
      await screen.findByText(en[coming]);
    }
    await settle();
    // The device's own id and the session credential are the only things the app keeps.
    const allowed = ['adulis.device.id', 'adulis.device.registered', 'adulis.device.registration_key', TOKEN_KEY];
    const written = jest.mocked(SecureStore.setItemAsync).mock.calls.map(([key]) => key);
    expect(written.filter((key) => !allowed.includes(key))).toEqual([]);
  });
});
