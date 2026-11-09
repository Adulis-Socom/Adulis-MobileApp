import { am, en } from '@adulis/locale/mobile';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi } from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

// The real route tree under src/app, booted through the real root layout and providers.
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));

// The first walk through the real tree transforms expo-router on a cold cache (always, in CI).
jest.setTimeout(60_000);

const devGlobal = globalThis as unknown as { __DEV__: boolean };

/** Run a test as a release build: __DEV__ is false, as it is in a production bundle. */
async function asRelease(body: () => Promise<void>) {
  const dev = devGlobal.__DEV__;
  devGlobal.__DEV__ = false;
  try {
    await body();
  } finally {
    devGlobal.__DEV__ = dev;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});

describe('development builds', () => {
  it('reach the diagnostics from You, and every mode shell from there, without re-authenticating', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    const router = await renderRouter(APP_DIR, { initialUrl: '/account' });

    await fireEvent.press(await screen.findByRole('button', { name: 'Developer diagnostics' }));
    expect(await screen.findByText('Developer diagnostics', { exact: true })).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/dev');
    expect(screen.getByText('Session: signed in')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Open Seller Companion' }));
    expect(await screen.findByText('Seller Companion foundation ready')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/seller');
    expect(useUiStore.getState().activeMode).toBe('seller');

    await fireEvent.press(screen.getByRole('button', { name: 'Switch to Courier' }));
    expect(await screen.findByText('Courier foundation ready')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/courier');
    expect(useUiStore.getState().activeMode).toBe('courier');

    await fireEvent.press(screen.getByRole('button', { name: 'Switch to Buyer' }));
    expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/home/for-you');
    expect(useUiStore.getState().activeMode).toBe('buyer');

    // One credential read at startup; no mode switch touched the session.
    const tokenCalls = (fn: jest.Mock) => fn.mock.calls.filter(([key]) => key === TOKEN_KEY);
    expect(tokenCalls(jest.mocked(SecureStore.getItemAsync))).toHaveLength(1);
    expect(tokenCalls(jest.mocked(SecureStore.setItemAsync))).toHaveLength(0);
    expect(tokenCalls(jest.mocked(SecureStore.deleteItemAsync))).toHaveLength(0);
  });

  it('keep Amharic as a QA language: the diagnostics switch it, and the Buyer shell renders it', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/dev' });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Amharic' }));
    expect(screen.getByText(am['health.degraded'])).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: am['common.retry'] })).toBeOnTheScreen();
    expect(useUiStore.getState().locale).toBe('am');

    await renderRouter(APP_DIR, { initialUrl: '/home/for-you' });
    expect(await screen.findByText(am['buyer.home.for_you.coming'])).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: am['buyer.home.channel.for_you'] })).toBeOnTheScreen();
  });
});

describe('release builds', () => {
  it('open Buyer Home, with no diagnostics entry and no mode switcher', async () => {
    await asRelease(async () => {
      const router = await renderRouter(APP_DIR, { initialUrl: '/account' });
      expect(await screen.findByText(en['buyer.you.signed_out'])).toBeOnTheScreen();
      expect(router.getPathname()).toBe('/account');
      expect(screen.queryByRole('button', { name: 'Developer diagnostics' })).not.toBeOnTheScreen();
      expect(screen.queryByText(/Seller Companion|Courier/)).not.toBeOnTheScreen();
    });
  });

  it.each(['/dev', '/seller', '/courier', '/_sitemap'])('never render %s; it lands on Buyer Home', async (path) => {
    await asRelease(async () => {
      const router = await renderRouter(APP_DIR, { initialUrl: path });
      expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
      expect(router.getPathname()).toBe('/home/for-you');
      expect(screen.queryByText('Developer diagnostics')).not.toBeOnTheScreen();
      expect(screen.queryByText(/foundation ready/)).not.toBeOnTheScreen();
      expect(useUiStore.getState().activeMode).toBe('buyer');
    });
  });

  it('never let a leftover active mode open a mode the account does not have', async () => {
    useUiStore.setState({ activeMode: 'seller' }); // e.g. left over from an earlier account
    await asRelease(async () => {
      const router = await renderRouter(APP_DIR, { initialUrl: '/seller' });
      expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
      expect(router.getPathname()).toBe('/home/for-you');
      expect(screen.queryByText('Seller Companion foundation ready')).not.toBeOnTheScreen();
    });
  });

  it('render English even when Amharic was left selected', async () => {
    useUiStore.setState({ locale: 'am' });
    await asRelease(async () => {
      await renderRouter(APP_DIR);
      expect(await screen.findByText(en['buyer.home.for_you.coming'])).toBeOnTheScreen();
      expect(screen.queryByText(am['buyer.home.for_you.coming'])).not.toBeOnTheScreen();
      expect(screen.getByRole('tab', { name: en['buyer.home.channel.for_you'] })).toBeOnTheScreen();
    });
  });
});
