import { en } from '@adulis/locale/mobile';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { installFakeApi } from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * BUY-04D: a status line that appears on its own (a read in progress, a search that cannot be asked) is spoken
 * through `StatusText`, the one convention this app uses. A live region is not: iOS ignores it, so the line was
 * silent there, and on Android a live region plus an announcement reads the line twice. The line is spoken once,
 * and carries no live region.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

let api: ReturnType<typeof installFakeApi>;
let announce: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
});
afterEach(() => announce.mockRestore());

const spokenTimes = (text: string) => announce.mock.calls.filter(([said]) => said === text).length;

describe('status lines are announced once and are not live regions (BUY-04D)', () => {
  it('the shared list read in progress (Shop) is spoken once', async () => {
    api.on('GET /v1/shop/products', () => 'hang');
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    const line = await screen.findByText(en['buyer.shop.loading']);
    await act(() => jest.advanceTimersByTimeAsync(500));
    expect(spokenTimes(en['buyer.shop.loading'])).toBe(1);
    expect(line.props.accessibilityLiveRegion).toBeUndefined();
  });

  it('the For You read in progress is spoken once', async () => {
    api.on('GET /v1/fyp', () => 'hang');
    await renderRouter(APP_DIR);
    const line = await screen.findByText(en['buyer.for_you.loading']);
    await act(() => jest.advanceTimersByTimeAsync(500));
    expect(spokenTimes(en['buyer.for_you.loading'])).toBe(1);
    expect(line.props.accessibilityLiveRegion).toBeUndefined();
  });

  it('a Search query below the minimum says why, spoken once', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/search' });
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.search.input']), 'b');
    const line = await screen.findByText(en['buyer.search.too_short']);
    await act(() => jest.advanceTimersByTimeAsync(500));
    expect(spokenTimes(en['buyer.search.too_short'])).toBe(1);
    expect(line.props.accessibilityLiveRegion).toBeUndefined();
  });
});
