import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { useUiStore } from '../state/ui-store';

// The real route tree under src/app, booted through the real root layout and providers.
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(async () => undefined),
}));

// The first walk through the real tree transforms expo-router on a cold cache (always, in CI).
jest.setTimeout(60_000);

const TABS = [en['buyer.tab.home'], en['buyer.tab.shop'], en['buyer.tab.saved'], en['buyer.tab.orders'], en['buyer.tab.you']];
const CHANNEL_LABELS = [
  en['buyer.home.channel.for_you'],
  en['buyer.home.channel.following'],
  en['buyer.home.channel.nearby'],
  en['buyer.home.channel.discounts'],
  en['buyer.home.channel.locally_made'],
];

// Home channels are tabs everywhere. The stock bottom tab bar marks its items role="tab"
// on Android and role="button" with aria-selected on iOS (the platform jest-expo renders).
const tab = (name: string) => screen.getByRole('tab', { name });
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const signedIn = () => jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('opaque-token');

beforeEach(() => {
  jest.clearAllMocks();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en' });
});

describe('Buyer shell', () => {
  it('opens on Home, For You, with exactly the five Buyer tabs', async () => {
    const r = await renderRouter(APP_DIR);
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
    expect(useUiStore.getState().activeMode).toBe('buyer');

    for (const name of TABS) expect(bottomTab(name)).toBeOnTheScreen();
    expect(bottomTab(en['buyer.tab.home'])).toBeSelected();
    // Every selectable control, minus the Home header's two buttons and its channels, is
    // exactly the five Buyer tabs in order: no Seller Companion or Courier tab exists.
    const label = (el: { props: Record<string, unknown> }) => el.props['aria-label'] ?? el.props.accessibilityLabel;
    const others: unknown[] = [en['buyer.search'], en['buyer.notifications'], ...CHANNEL_LABELS];
    const primary = screen
      .getAllByRole(Platform.OS === 'ios' ? 'button' : 'tab')
      .filter((el) => !others.includes(label(el)));
    expect(primary.map(label)).toEqual(TABS);
    expect(screen.queryByText(/Seller Companion|Courier/)).not.toBeOnTheScreen();
  });

  it('exposes all five Home channels, For You selected by default', async () => {
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.home.for_you.coming']);
    expect(screen.getByLabelText(en['buyer.home.channels'])).toHaveProp('accessibilityRole', 'tablist');
    for (const name of CHANNEL_LABELS) expect(tab(name)).toBeOnTheScreen();
    expect(tab(en['buyer.home.channel.for_you'])).toBeSelected();
    expect(tab(en['buyer.home.channel.nearby'])).not.toBeSelected();
  });

  it('switches Home channels by route, and Back returns to For You', async () => {
    const r = await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.home.for_you.coming']);

    await fireEvent.press(tab(en['buyer.home.channel.nearby']));
    expect(await screen.findByText(en['buyer.home.nearby.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/nearby');
    expect(tab(en['buyer.home.channel.nearby'])).toBeSelected();
    expect(tab(en['buyer.home.channel.for_you'])).not.toBeSelected();

    await fireEvent.press(tab(en['buyer.home.channel.locally_made']));
    expect(await screen.findByText(en['buyer.home.locally_made.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/locally-made');

    await act(() => router.back());
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it('deep-links straight to a channel, with For You under it for Back', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: '/home/discounts' });
    expect(await screen.findByText(en['buyer.home.discounts.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/discounts');
    expect(tab(en['buyer.home.channel.discounts'])).toBeSelected();

    await act(() => router.back());
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it('opens For You for a link to /home', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: '/home' });
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(tab(en['buyer.home.channel.for_you'])).toBeSelected();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it.each(['/search', '/notifications'])('opens %s cold with the tabs under it, so Back returns Home', async (path) => {
    const r = await renderRouter(APP_DIR, { initialUrl: path });
    expect(r.getPathname()).toBe(path);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
    expect(bottomTab(en['buyer.tab.home'])).toBeOnTheScreen();
  });

  it('sends an unknown path to Buyer Home', async () => {
    const r = await renderRouter(APP_DIR, { initialUrl: '/no/such/place' });
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/for-you');
  });

  it('keeps each tab where it was, and Back from a tab returns to Home', async () => {
    const r = await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.home.for_you.coming']);
    await fireEvent.press(tab(en['buyer.home.channel.following']));
    await screen.findByText(en['buyer.home.following.coming']);

    await fireEvent.press(bottomTab(en['buyer.tab.shop']));
    expect(await screen.findByText(en['buyer.shop.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/shop');
    expect(bottomTab(en['buyer.tab.shop'])).toBeSelected();

    // Home comes back on the channel it was left on.
    await fireEvent.press(bottomTab(en['buyer.tab.home']));
    expect(await screen.findByText(en['buyer.home.following.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/home/following');

    await fireEvent.press(bottomTab(en['buyer.tab.orders']));
    await screen.findByText(en['buyer.orders.signed_out']);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.home.following.coming'])).toBeOnTheScreen();
  });

  it('opens Search and Notifications over the tabs, and Back returns to Home', async () => {
    const r = await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.home.for_you.coming']);

    await fireEvent.press(screen.getByRole('button', { name: en['buyer.search'] }));
    expect(await screen.findByText(en['buyer.search.coming'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/search');
    // No input field and no results until marketplace search exists.
    expect(screen.queryByRole('search')).not.toBeOnTheScreen();
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: en['buyer.notifications'] }));
    expect(await screen.findByText(en['buyer.notifications.signed_out'])).toBeOnTheScreen();
    expect(r.getPathname()).toBe('/notifications');
  });
});

describe('guest and signed-in destinations', () => {
  it('a guest sees why Saved, Orders and You need an Account, with no sign-in prompt fired', async () => {
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.home.for_you.coming']);

    await fireEvent.press(bottomTab(en['buyer.tab.saved']));
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.orders']));
    expect(await screen.findByText(en['buyer.orders.signed_out'])).toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    expect(screen.getAllByText(en['buyer.sign_in.coming']).length).toBeGreaterThan(0);

    // No Account was created and no credential was written or read again.
    expect(screen.queryByRole('button', { name: en['common.signOut'] })).not.toBeOnTheScreen();
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('a signed-in Buyer sees placeholders, not sign-in prompts, across tab switches', async () => {
    signedIn();
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.home.for_you.coming']);

    await fireEvent.press(bottomTab(en['buyer.tab.saved']));
    expect(await screen.findByText(en['buyer.saved.coming'])).toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.orders']));
    expect(await screen.findByText(en['buyer.orders.coming'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.orders.signed_out'])).not.toBeOnTheScreen();
    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    expect(await screen.findByRole('button', { name: en['common.signOut'] })).toBeOnTheScreen();
    expect(useUiStore.getState().activeMode).toBe('buyer');
    expect(SecureStore.getItemAsync).toHaveBeenCalledTimes(1);
  });

  it('Sign out forgets the session on the device and revokes it on the server', async () => {
    const fetchMock = jest.fn(async () => ({ status: 204 }) as Response);
    const savedFetch = globalThis.fetch;
    const savedOrigin = process.env.EXPO_PUBLIC_API_BASE_URL;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';
    try {
      signedIn();
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.test/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer opaque-token' },
          signal: expect.any(AbortSignal),
        }),
      );
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    } finally {
      globalThis.fetch = savedFetch;
      process.env.EXPO_PUBLIC_API_BASE_URL = savedOrigin;
    }
  });

  it('Sign out forgets the session at once even when the server never answers', async () => {
    const savedFetch = globalThis.fetch;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    // A stalled network: the request never settles while the test runs.
    globalThis.fetch = jest.fn(() => new Promise<Response>(() => undefined)) as unknown as typeof fetch;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';
    try {
      signedIn();
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
    } finally {
      globalThis.fetch = savedFetch;
      warn.mockRestore();
    }
  });

  it('logs a failed revoke by its reason, never by the credential', async () => {
    const savedFetch = globalThis.fetch;
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    globalThis.fetch = jest.fn(async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.example.test';
    try {
      signedIn();
      await renderRouter(APP_DIR, { initialUrl: '/account' });
      await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
      await waitFor(() => expect(warn).toHaveBeenCalled());
      expect(JSON.stringify(warn.mock.calls)).toContain('Network request failed');
      expect(JSON.stringify(warn.mock.calls)).not.toContain('opaque-token');
    } finally {
      globalThis.fetch = savedFetch;
      warn.mockRestore();
    }
  });
});

describe('appearance', () => {
  it('switches Light, Dark and System from You', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('radio', { name: en['buyer.you.appearance.dark'] }));
    expect(useUiStore.getState().themePreference).toBe('dark');
    expect(screen.getByRole('radio', { name: en['buyer.you.appearance.dark'] })).toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: en['buyer.you.appearance.light'] }));
    expect(useUiStore.getState().themePreference).toBe('light');
    await fireEvent.press(screen.getByRole('radio', { name: en['buyer.you.appearance.system'] }));
    expect(useUiStore.getState().themePreference).toBe('system');
    expect(screen.getByRole('radio', { name: en['buyer.you.appearance.dark'] })).not.toBeChecked();
  });
});
