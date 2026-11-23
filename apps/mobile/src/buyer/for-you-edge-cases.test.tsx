import { en } from '@adulis/locale/mobile';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, Platform } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, SIGN_IN_CODE, fypPage, fypUnit, installFakeApi, problem, type Reply } from '../testing/fake-api';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

/**
 * BUY-05E: the three For You edge cases left open by the BUY-05D review.
 *  1. A first page with nothing this build can show (units of a kind it has no word for, or Scenes found no longer
 *     public) but a next cursor is not an empty feed: discovery continues, boundedly, then by an explicit control.
 *  2. A retry made offline says the request is waiting for a connection, not the old failure.
 *  3. A second pull while the first is still pending keeps the cards that are still on screen (the same session's),
 *     and never brings back cards of an older generation than the ones shown.
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
const held = () => {
  let release!: (r: Reply) => void;
  const promise = new Promise<Reply>((resolve) => (release = resolve));
  return { promise, release };
};
/** A unit of a kind this build has no word for: dropped, never guessed. */
const foreign = (n: number) => fypUnit(n, { type: 'PRODUCT_POST' as never });
const emptyPage = (n: number, next: string | null) => ok(fypPage([foreign(n)], next, `session-${n}`));
const settle = () => act(() => jest.advanceTimersByTimeAsync(1000));
const pullList = () =>
  act(() => (screen.getByTestId('for-you-list').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());
const pullPanel = () =>
  act(() => (screen.getByTestId('for-you-state').props.refreshControl as { props: { onRefresh: () => void } }).props.onRefresh());

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false });
});
afterEach(() => onlineManager.setOnline(true));

describe('a first page with nothing to show but a next cursor continues, boundedly (BUY-05E, issue 1)', () => {
  it('walks to the next page by itself and shows its Scene; the empty sentence is never claimed', async () => {
    serveByCursor({ '': [emptyPage(1, 'c1')], c1: [ok(fypPage([fypUnit(5)], null, 'session-5'))] });
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Store 5')).toBeOnTheScreen();
    expect(screen.queryByText(en['buyer.for_you.empty'])).not.toBeOnTheScreen();
    expect(feedCalls().map((c) => c.query)).toEqual([{}, { cursor: 'c1' }]);
  });

  it('walks over several empty pages (page 2 and 3 empty too) until a Scene is found', async () => {
    serveByCursor({
      '': [emptyPage(1, 'c1')],
      c1: [emptyPage(2, 'c2')],
      c2: [emptyPage(3, 'c3')],
      c3: [ok(fypPage([fypUnit(9)], null, 'session-9'))],
    });
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Store 9')).toBeOnTheScreen();
    expect(feedCalls().map((c) => c.query)).toEqual([{}, { cursor: 'c1' }, { cursor: 'c2' }, { cursor: 'c3' }]);
  });

  it('is bounded: an endless chain of empty pages stops after three extra pages and offers Load more; one press asks for exactly one more', async () => {
    serveByCursor({
      '': [emptyPage(1, 'c1')],
      c1: [emptyPage(2, 'c2')],
      c2: [emptyPage(3, 'c3')],
      c3: [emptyPage(4, 'c4')],
      c4: [emptyPage(5, 'c5')],
      c5: [emptyPage(6, 'c6')],
    });
    await renderRouter(APP_DIR);
    const more = await screen.findByRole('button', { name: en['buyer.for_you.load_more'] });
    await settle();
    expect(feedCalls()).toHaveLength(4); // the first page and three extra, never more by itself
    expect(screen.queryByText(en['buyer.for_you.empty'])).not.toBeOnTheScreen(); // more pages exist: not claimed empty
    await settle();
    expect(feedCalls()).toHaveLength(4);
    await fireEvent.press(more);
    await settle();
    expect(feedCalls()).toHaveLength(5); // the person's press, one page
    expect(feedCalls().at(-1)?.query).toEqual({ cursor: 'c4' });
    await settle();
    expect(feedCalls()).toHaveLength(5);
  });

  it('an empty page after cards that are shown is not walked by itself: Load more stays the Buyer\'s', async () => {
    const first = Array.from({ length: 20 }, (_, i) => fypUnit(i + 1, { position: i + 1 }));
    serveByCursor({ '': [ok(fypPage(first, 'c1'))], c1: [emptyPage(30, 'c2')], c2: [emptyPage(31, 'c3')] });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await settle();
    expect(feedCalls()).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.for_you.load_more'] }));
    await settle();
    expect(feedCalls()).toHaveLength(2);
    expect(screen.getByRole('button', { name: en['buyer.for_you.load_more'] })).toBeOnTheScreen();
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
  });

  it('an empty page with no next cursor is the honest empty feed (unchanged)', async () => {
    serveByCursor({ '': [emptyPage(1, null)] });
    await renderRouter(APP_DIR);
    expect(await screen.findByText(en['buyer.for_you.empty'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.for_you.load_more'] })).not.toBeOnTheScreen();
    expect(feedCalls()).toHaveLength(1);
  });

  it('a failed page in the walk stops it and says so beside Try again; the walk never retries by itself', async () => {
    serveByCursor({ '': [emptyPage(1, 'c1')], c1: [problem(500, 'INTERNAL', 'request'), ok(fypPage([fypUnit(5)], null, 'session-5'))] });
    await renderRouter(APP_DIR);
    expect(await screen.findByText(new RegExp(en['buyer.for_you.more_failed']), {}, { timeout: 10_000 })).toBeOnTheScreen();
    await settle();
    expect(feedCalls()).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('Store 5')).toBeOnTheScreen();
    expect(feedCalls()).toHaveLength(3);
  });
});

// Withdrawn Scenes (a Scene read answered 404) are covered through the app by for-you-discovery.test.tsx, including the
// placeholder cards of a pull; they use the real Scene read, which a direct call to withdrawScene here would not.

describe('a retry made offline says it is waiting for a connection (BUY-05E, issue 2: already correct, pinned)', () => {
  it('replaces the stale failure with the offline line, spends no request, announces once, and loads on reconnect', async () => {
    serveByCursor({ '': [problem(500, 'INTERNAL', 'request'), ok(fypPage([fypUnit(4)], null, 'session-4'))] });
    await renderRouter(APP_DIR);
    const retry = await screen.findByRole('button', { name: en['common.retry'] }, { timeout: 10_000 });
    expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
    const failure = screen.getByRole('alert');
    const failureText = String((failure.props as { children?: unknown }).children);
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(retry);
    await settle();
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    expect(screen.queryByText(failureText)).not.toBeOnTheScreen(); // the stale failure gives way
    expect(feedCalls()).toHaveLength(1); // waiting, not spent
    await settle();
    expect(spy.mock.calls.filter(([said]) => said === en['common.offline'])).toHaveLength(1);
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByText('Store 4')).toBeOnTheScreen();
    expect(screen.queryByText(en['common.offline'])).not.toBeOnTheScreen();
  });

  it('a failure that was itself "offline" is one line, not two', async () => {
    // The network is retried twice by itself, so three offline answers settle into the failure.
    serveByCursor({ '': ['offline', 'offline', 'offline', ok(fypPage([fypUnit(4)], null, 'session-4'))] });
    await renderRouter(APP_DIR);
    await screen.findByRole('button', { name: en['common.retry'] }, { timeout: 20_000 });
    expect(screen.getAllByText(en['common.offline'])).toHaveLength(1);
    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await settle();
    expect(screen.getAllByText(en['common.offline'])).toHaveLength(1);
  });
});

describe('a second pull while the first is pending (BUY-05E, issue 3)', () => {
  it('keeps the cards still on screen, shows the newest answer, and ignores the older pull\'s late answer', async () => {
    const one = held();
    const two = held();
    serveByCursor({ '': [ok(fypPage([fypUnit(1)], null, 'session-old')), one.promise, two.promise] });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await pullList();
    await act(() => jest.advanceTimersByTimeAsync(10));
    await pullList();
    await act(() => jest.advanceTimersByTimeAsync(10));
    expect(screen.getByText('Store 1')).toBeOnTheScreen(); // not blanked by the second pull
    expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen(); // and still no end claim
    await act(async () => two.release(ok(fypPage([fypUnit(7)], null, 'session-two'))));
    expect(await screen.findByText('Store 7')).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await act(async () => one.release(ok(fypPage([fypUnit(8)], null, 'session-one'))));
    await settle();
    expect(screen.getByText('Store 7')).toBeOnTheScreen();
    expect(screen.queryByText('Store 8')).not.toBeOnTheScreen(); // a late answer of an older pull never lands
  });

  it('two pulls offline are one waiting refresh: the cards stay, one offline line, one request on reconnect', async () => {
    serveByCursor({ '': [ok(fypPage([fypUnit(1)], null, 'session-old')), ok(fypPage([fypUnit(4)], null, 'session-new'))] });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await act(async () => onlineManager.setOnline(false));
    await pullList();
    await settle();
    await pullList();
    await settle();
    expect(screen.getByText('Store 1')).toBeOnTheScreen();
    expect(screen.getAllByText(en['common.offline'])).toHaveLength(1);
    expect(screen.queryByText(en['buyer.for_you.end'])).not.toBeOnTheScreen();
    expect(feedCalls()).toHaveLength(1);
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByText('Store 4')).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    expect(feedCalls()).toHaveLength(2); // the first session and ONE new one, not one per pull
  });

  it('never brings back cards after a pull that failed: the old session is gone for good', async () => {
    const third = held();
    serveByCursor({ '': [ok(fypPage([fypUnit(1)], null, 'session-old')), problem(500, 'INTERNAL', 'request'), third.promise] });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await pullList();
    await screen.findByRole('button', { name: en['common.retry'] }, { timeout: 10_000 });
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await pullPanel();
    await act(() => jest.advanceTimersByTimeAsync(10));
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen(); // not a placeholder for the next generation
    await act(async () => third.release(ok(fypPage([fypUnit(6)], null, 'session-new'))));
    expect(await screen.findByText('Store 6')).toBeOnTheScreen();
  });

  it('never keeps the cards of a session the server ended', async () => {
    const first = Array.from({ length: 20 }, (_, i) => fypUnit(i + 1, { position: i + 1 }));
    const after = held();
    serveByCursor({
      '': [ok(fypPage(first, 'c1', 'session-old')), after.promise],
      c1: [problem(400, 'VALIDATION_FAILED', 'request', { reason: 'CURSOR_EXPIRED' })],
    });
    await renderRouter(APP_DIR);
    await screen.findByText('Store 1');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.for_you.load_more'] }));
    expect(await screen.findByText(en['buyer.for_you.session_ended'])).toBeOnTheScreen();
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await pullPanel();
    await act(() => jest.advanceTimersByTimeAsync(10));
    expect(screen.queryByText('Store 1')).not.toBeOnTheScreen();
    await act(async () => after.release(ok(fypPage([fypUnit(40)], null, 'session-new'))));
    expect(await screen.findByText('Store 40')).toBeOnTheScreen();
  });
});

describe('review findings (BUY-05E)', () => {
  const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });

  it('never lets a previous Account cards stand in after sign-out and a new sign-in', async () => {
    resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
    const second = held();
    let accountCalls = 0;
    api.on(FEED, (call): Reply | Promise<Reply> => {
      if (!call.headers.Authorization) return 'hang'; // the guest feed never answers
      accountCalls += 1;
      if (accountCalls === 1) return ok(fypPage([fypUnit(1, { seller: { handle: 'a', store_name: 'Account pick' } })], null, 'session-a'));
      if (accountCalls === 2) return new Promise<Reply>(() => undefined); // the pull that is pending when the Buyer signs out
      return second.promise; // the new Account's first page, held
    });
    await renderRouter(APP_DIR);
    expect(await screen.findByText('Account pick')).toBeOnTheScreen();
    await pullList();
    await act(() => jest.advanceTimersByTimeAsync(10));

    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    await fireEvent.press(bottomTab(en['buyer.tab.orders']));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), '+251911234567');
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    await screen.findByText(en['buyer.orders.coming']);
    await fireEvent.press(bottomTab(en['buyer.tab.home']));
    await act(() => jest.advanceTimersByTimeAsync(50));
    expect(screen.queryByText('Account pick')).not.toBeOnTheScreen(); // the earlier session's card is not the new answer
    await act(async () => second.release(ok(fypPage([fypUnit(9, { seller: { handle: 'n', store_name: 'New pick' } })], null, 'session-new'))));
    expect(await screen.findByText('New pick')).toBeOnTheScreen();
  });

  it('a pull pending over the walk panel does not claim the feed is empty, and offers no Load more for the old session', async () => {
    const pending = held();
    serveByCursor({
      '': [emptyPage(1, 'c1'), pending.promise],
      c1: [emptyPage(2, 'c2')],
      c2: [emptyPage(3, 'c3')],
      c3: [emptyPage(4, 'c4')],
    });
    await renderRouter(APP_DIR);
    await screen.findByRole('button', { name: en['buyer.for_you.load_more'] });
    await settle();
    await pullPanel();
    await act(() => jest.advanceTimersByTimeAsync(10));
    expect(screen.queryByText(en['buyer.for_you.empty'])).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.for_you.load_more'] })).not.toBeOnTheScreen();
    await act(async () => pending.release(ok(fypPage([fypUnit(5)], null, 'session-new'))));
    expect(await screen.findByText('Store 5')).toBeOnTheScreen();
  });

  it('the walk panel says "offline" once when Load more waits for a connection', async () => {
    serveByCursor({
      '': [emptyPage(1, 'c1')],
      c1: [emptyPage(2, 'c2')],
      c2: [emptyPage(3, 'c3')],
      c3: [emptyPage(4, 'c4')],
      c4: [ok(fypPage([fypUnit(8)], null, 'session-8'))],
    });
    await renderRouter(APP_DIR);
    const more = await screen.findByRole('button', { name: en['buyer.for_you.load_more'] });
    await settle();
    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(more);
    await settle();
    expect(await screen.findByText(en['common.offline'])).toBeOnTheScreen();
    expect(screen.getAllByText(en['common.offline'])).toHaveLength(1);
    expect(feedCalls()).toHaveLength(4);
    await act(async () => onlineManager.setOnline(true));
    expect(await screen.findByText('Store 8')).toBeOnTheScreen();
  });
});
