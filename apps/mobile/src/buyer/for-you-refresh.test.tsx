import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { act, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { fypPage, fypUnit, installFakeApi, type Reply } from '../testing/fake-api';
import { resetSecureStore } from '../testing/secure-store-mock';

/**
 * BUY-05D: For You has its own hook and footer wiring, separate from the shared list that
 * PR #169 corrected. A pull whose new session has not answered must never say the feed has
 * ended (the pending session has no next page of its own), an empty feed pulled offline must
 * say the Buyer is offline, and the pending-pull offline line is one announcement.
 */
const APP_DIR = 'src/app';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const FEED = 'GET /v1/fyp';
let api: ReturnType<typeof installFakeApi>;

function serveByCursor(routes: Record<string, Array<Reply | Promise<Reply>>>) {
  const seen: Record<string, number> = {};
  api.on(FEED, (call) => {
    const cursor = call.query.cursor ?? '';
    const replies = routes[cursor] ?? [];
    const i = seen[cursor] ?? 0;
    seen[cursor] = i + 1;
    return replies[Math.min(i, replies.length - 1)]!;
  });
}
const ok = (body: unknown): Reply => ({ status: 200, body });
const feedCalls = () => api.callsTo(FEED);
const pullToRefresh = () =>
  act(() => (screen.getByTestId('for-you-list').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
// An empty feed is a state panel, not the list: its own refresh control.
const pullEmpty = () =>
  act(() => (screen.getByTestId('for-you-state').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});
afterEach(() => onlineManager.setOnline(true));

describe('a pull whose new session is pending never says the feed ended (BUY-05D)', () => {
  it('offline: the old cards stay, the Buyer is told they are offline, and no end sentence or Load more stands under them', async () => {
    serveByCursor({ '': [ok(fypPage([fypUnit(1)], null, 'session-old')), ok(fypPage([fypUnit(4)], null, 'session-new'))] });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    expect(screen.getByText(en['buyer.for_you.end'])).toBeOnTheScreen(); // a settled, complete feed says so

    await act(async () => onlineManager.setOnline(false));
    await pullToRefresh();
    await act(() => jest.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.load_more'])).not.toBeOnTheScreen();
    expect(feedCalls()).toHaveLength(1);

    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByText('Store 4')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.for_you.end'])).toBeOnTheScreen(); // the new, complete session ends honestly
    expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
  });

  it('online and in flight: the end sentence is withheld until the new session answers', async () => {
    let release!: (r: Reply) => void;
    const held = new Promise<Reply>((resolve) => (release = resolve));
    serveByCursor({ '': [ok(fypPage([fypUnit(1)], null, 'session-old')), held] });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    expect(screen.getByText(en['buyer.for_you.end'])).toBeOnTheScreen();

    await pullToRefresh();
    await act(() => jest.advanceTimersByTimeAsync(10));
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen();

    await act(async () => release(ok(fypPage([fypUnit(4)], null, 'session-new'))));
    expect(await screen.findByText('Store 4')).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.for_you.end'])).toBeOnTheScreen();
  });

  it('a feed with more pages offline: the old Load more is not offered for a session that is pending', async () => {
    serveByCursor({
      '': [ok(fypPage(Array.from({ length: 20 }, (_, i) => fypUnit(i + 1, { position: i + 1 })), 'cursor-A', 'session-old')), ok(fypPage([fypUnit(40)], null, 'session-new'))],
      'cursor-A': [ok(fypPage([fypUnit(30, { position: 21 })], 'cursor-B'))],
    });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await act(async () => onlineManager.setOnline(false));
    await pullToRefresh();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen();
  });

  it('a refresh that fails still drops the old cards and shows the failure (unchanged)', async () => {
    serveByCursor({ '': [ok(fypPage([fypUnit(1)], null, 'session-old')), { status: 500, body: {} }] });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await pullToRefresh();
    await act(() => jest.advanceTimersByTimeAsync(5000));
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['common.retry'] })).toBeOnTheScreen();
  });
});

describe('an empty feed pulled offline says so (BUY-05D)', () => {
  it('shows the offline line, keeps the empty sentence and Refresh, spends no request, and resolves on reconnect', async () => {
    serveByCursor({ '': [ok(fypPage([], null, 'session-empty')), ok(fypPage([fypUnit(7)], null, 'session-new'))] });
    await renderRouter(APP_DIR);
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();

    await act(async () => onlineManager.setOnline(false));
    await pullEmpty();
    await act(() => jest.advanceTimersByTimeAsync(1000));

    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(feedCalls()).toHaveLength(1);

    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByText('Store 7')).toBeOnTheScreen();
    expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
  });

  it('is announced once, not on every re-render', async () => {
    serveByCursor({ '': [ok(fypPage([], null, 'session-empty')), ok(fypPage([fypUnit(7)], null, 'session-new'))] });
    await renderRouter(APP_DIR);
    await screen.findByText(en['buyer.for_you.empty']);
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await act(async () => onlineManager.setOnline(false));
    await pullEmpty();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    await screen.findByText(en['common.offline']);
    await act(() => jest.advanceTimersByTimeAsync(3000));
    const offlineCalls = spy.mock.calls.filter(([text]) => text === en['common.offline']);
    expect(offlineCalls).toHaveLength(1);
  });
});
