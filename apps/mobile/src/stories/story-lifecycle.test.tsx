// M01-R05 / R06 / R07 (ISS-016 reopened): the Story lifecycle. Fixture semantics run through the real session boundary with an
// injected server clock; the viewer runs with Jest fake timers and controlled reads, so every boundary is exact.
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, AppState } from 'react-native';

import type { StoryView } from '../contracts/gap-mob-stories';
import { createFixtureTransport } from '../fixtures';
import { t } from '../i18n/messages';
import { makeRuntime } from '../testing/harness';
import { TransportError } from '../transport/port';
import { StoryViewerBody, type StoryRead } from './StoryViewerBody';
import { timeLeft } from './viewer-state';

const HOUR = 60 * 60 * 1000;
const T0 = Date.parse('2026-11-27T12:00:00.000Z');
const ALEM = 'fx_seller_demo_alem';

describe('fixture Story semantics (M01-R06)', () => {
  async function world() {
    let now = T0;
    const fixture = createFixtureTransport();
    fixture.handle.setNow(() => now);
    fixture.handle.reset(); // re-take publication and expiry from the injected clock
    const { runtime } = await makeRuntime(fixture.transport);
    await runtime.start();
    return { fixture, runtime, setNow: (ms: number) => void (now = ms) };
  }

  it('keeps publication and expiry stable across repeated reads: reading again never extends a Story', async () => {
    const { runtime, setNow } = await world();
    const first = await runtime.session.call('stories.group.get', { sellerRef: ALEM });
    setNow(T0 + HOUR);
    const second = await runtime.session.call('stories.group.get', { sellerRef: ALEM });
    expect(second.stories.map((s) => [s.storyRef, s.publishedAt, s.expiresAt])).toEqual(first.stories.map((s) => [s.storyRef, s.publishedAt, s.expiresAt]));
    expect(Date.parse(first.stories[0]?.expiresAt ?? '')).toBe(T0 + 23 * HOUR);
  });

  it('a Story past its expiry is absent from the next read, and a group with nothing left is the neutral NOT_FOUND', async () => {
    const { runtime, setNow } = await world();
    setNow(T0 + 2 * HOUR + 1);
    expect((await runtime.session.call('stories.group.get', { sellerRef: ALEM })).stories.map((s) => s.storyRef)).toEqual(['fx_story_demo_1']);
    setNow(T0 + 24 * HOUR);
    await expect(runtime.session.call('stories.group.get', { sellerRef: ALEM })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await runtime.session.call('stories.row.get', {})).groups).toEqual([]);
  });

  it('linked content that became private suppresses its Story; a withdrawn or restricted Seller is the same neutral answer', async () => {
    const { fixture, runtime } = await world();
    fixture.handle.makeStoryTargetPrivate('fx_product_demo_1');
    expect((await runtime.session.call('stories.group.get', { sellerRef: ALEM })).stories.map((s) => s.storyRef)).toEqual(['fx_story_demo_2']);
    fixture.handle.expireStories(ALEM);
    await expect(runtime.session.call('stories.group.get', { sellerRef: ALEM })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('the viewer (M01-R05 / R07)', () => {
  const seller = { sellerRef: ALEM, storeName: 'Demo Store Alem' };
  const story = (n: number, expiresInMs: number, text: string | null = `Text ${n}`): StoryView => ({
    storyRef: `s${n}`,
    publishedAt: new Date(T0 - HOUR).toISOString(),
    expiresAt: new Date(T0 + expiresInMs).toISOString(),
    photo: { ref: `m${n}`, aspect: 0.75, alt: `Photo ${n}` },
    text,
    target: { kind: 'PRODUCT', ref: 'p1', label: 'Basket' },
  });
  const ok = (stories: StoryView[], receivedAt = T0): StoryRead => ({ status: 'success', data: { seller, stories }, error: null, dataUpdatedAt: receivedAt, refetch: jest.fn() });
  const props = (read: StoryRead, openedAt = T0) => ({ read, openedAt, onClose: jest.fn(), onOpenTarget: jest.fn() });

  beforeEach(() => {
    jest.useFakeTimers({ now: T0 });
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the Story with its time left, and nothing advances by itself', async () => {
    await render(<StoryViewerBody {...props(ok([story(1, 23 * HOUR + 5 * 60_000), story(2, 23 * HOUR)]))} />);
    expect(screen.getByText('Text 1')).toBeTruthy();
    expect(screen.getByText(t('mobile.stories.time_left.hours', { hours: 23 }))).toBeTruthy();
    await act(() => jest.advanceTimersByTime(2 * HOUR));
    expect(screen.getByText(t('mobile.stories.position', { n: 1, total: 2 }))).toBeTruthy();
  });

  it('at the known expiry, while open: photo, text and link go at once, it is announced, and a fresh read is asked for', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const read = ok([story(1, 10 * 60_000), story(2, 5 * HOUR)]);
    await render(<StoryViewerBody {...props(read)} />);
    expect(screen.getByText(t('mobile.stories.time_left.less_than_hour'))).toBeTruthy();
    expect(screen.getByRole('image', { name: 'Photo 1' })).toBeTruthy();
    await act(() => jest.advanceTimersByTime(10 * 60_000));
    expect(screen.queryByText('Text 1')).toBeNull();
    expect(screen.queryByRole('image', { name: 'Photo 1' })).toBeNull();
    expect(screen.queryByRole('button', { name: t('mobile.scene.view_product') })).toBeNull();
    expect(screen.getByText(t('mobile.stories.gone'))).toBeTruthy();
    expect(read.refetch).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(t('mobile.stories.gone'));
  });

  it('a later read, pending, failed, offline or even contradictory, never brings expired content back', async () => {
    const view = await render(<StoryViewerBody {...props(ok([story(1, 10 * 60_000), story(2, 5 * HOUR)]))} />);
    await act(() => jest.advanceTimersByTime(10 * 60_000));
    // The server answer arrives late and (wrongly) carries the Story with a later expiry: still hidden for this opening.
    await view.rerender(<StoryViewerBody {...props(ok([story(1, 3 * HOUR), story(2, 5 * HOUR)], T0 + 11 * 60_000))} />);
    expect(screen.queryByText('Text 1')).toBeNull();
    // The read failed offline: nothing of the Story is drawn either.
    await view.rerender(<StoryViewerBody {...props({ ...ok([story(1, 3 * HOUR)]), status: 'error', error: new TransportError('NETWORK') })} />);
    expect(screen.queryByText('Text 1')).toBeNull();
    expect(screen.getAllByText(t('mobile.state.offline')).length).toBeGreaterThan(0);
  });

  it('expiry during a slow read: a Story that arrives already past its expiry is never drawn', async () => {
    const pending: StoryRead = { status: 'pending', data: undefined, error: null, dataUpdatedAt: 0, refetch: jest.fn() };
    const view = await render(<StoryViewerBody {...props(pending)} />);
    expect(screen.getByText(t('mobile.state.loading'))).toBeTruthy();
    await act(() => jest.advanceTimersByTime(20 * 60_000));
    await view.rerender(<StoryViewerBody {...props(ok([story(1, 10 * 60_000)], T0 + 20 * 60_000))} />);
    expect(screen.queryByText('Text 1')).toBeNull();
    expect(screen.getByText(t('mobile.stories.gone'))).toBeTruthy();
  });

  it('opening with an already expired Story shows the neutral sentence and a Close, never the content', async () => {
    const p = props(ok([story(1, -60_000)]));
    await render(<StoryViewerBody {...p} />);
    expect(screen.getByText(t('mobile.stories.gone'))).toBeTruthy();
    expect(screen.queryByText('Text 1')).toBeNull();
    expect(screen.getByRole('button', { name: t('mobile.stories.close') })).toBeTruthy();
  });

  it('presentation gate: an answer received before this opening (cached) is not drawn; the fresh one is', async () => {
    const view = await render(<StoryViewerBody {...props(ok([story(1, 5 * HOUR)], T0 - 1), T0)} />);
    expect(screen.queryByText('Text 1')).toBeNull();
    expect(screen.getByText(t('mobile.state.loading'))).toBeTruthy();
    await view.rerender(<StoryViewerBody {...props(ok([story(1, 5 * HOUR)], T0 + 1), T0)} />);
    expect(screen.getByText('Text 1')).toBeTruthy();
  });

  it('back from the background after the expiry: re-checked at once (timers do not run while suspended) and re-read', async () => {
    let onChange: ((state: string) => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      onChange = handler as (state: string) => void;
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    const read = ok([story(1, 10 * 60_000), story(2, 5 * HOUR)]);
    await render(<StoryViewerBody {...props(read)} />);
    expect(screen.getByText('Text 1')).toBeTruthy();
    jest.setSystemTime(T0 + 30 * 60_000); // the clock moved while suspended; no timer has fired
    await act(() => onChange?.('active'));
    expect(screen.queryByText('Text 1')).toBeNull();
    expect(read.refetch).toHaveBeenCalled();
  });

  it('a withdrawn, restricted or private-target Story (the server answers 404) is one neutral sentence with Close', async () => {
    await render(<StoryViewerBody {...props({ status: 'error', data: undefined, error: new TransportError('NOT_FOUND'), dataUpdatedAt: 0, refetch: jest.fn() })} />);
    expect(screen.getByText(t('mobile.stories.gone'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('mobile.stories.close') })).toBeTruthy();
  });
});

describe('time left', () => {
  it('is coarse words, never a countdown, and nothing once expired', () => {
    expect(timeLeft(new Date(T0 + 30 * 60_000).toISOString(), T0)).toEqual({ key: 'mobile.stories.time_left.less_than_hour' });
    expect(timeLeft(new Date(T0 + 90 * 60_000).toISOString(), T0)).toEqual({ key: 'mobile.stories.time_left.one_hour' });
    expect(timeLeft(new Date(T0 + 5 * HOUR).toISOString(), T0)).toEqual({ key: 'mobile.stories.time_left.hours', hours: 5 });
    expect(timeLeft(new Date(T0 - 1).toISOString(), T0)).toBeNull();
  });
});
