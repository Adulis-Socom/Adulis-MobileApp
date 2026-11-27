// MOB-FE-02S: the pure viewer rules, the Story fixture through the real session boundary, and the Story card. Rules asserted as
// absences too: no engagement control, no auto-advance, no local expiry verdict, no stale Story.
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { StoryView } from '../contracts/gap-mob-stories';
import { createFixtureTransport } from '../fixtures';
import { makeRuntime, settle, signIn } from '../testing/harness';
import { PERSONAS } from '../fixtures';
import { MAX_TIMER_MS, msUntilReread, step } from './viewer-state';
import { StoryCard } from './StoryCard';

const story = (over: Partial<StoryView> = {}): StoryView => ({
  storyRef: 's1',
  publishedAt: '2026-01-01T00:00:00.000Z',
  expiresAt: '2026-01-02T00:00:00.000Z',
  photo: { ref: 'm1', aspect: 0.75, alt: 'Story from Store One' },
  text: 'Fresh stock today.',
  target: { kind: 'PRODUCT', ref: 'p1', label: 'Basket' },
  ...over,
});

describe('viewer rules', () => {
  it('moves one Story at a time and stays at either end (no wrap, no auto-advance to another Seller)', () => {
    expect(step(0, 3, 'next')).toBe(1);
    expect(step(2, 3, 'next')).toBe(2);
    expect(step(0, 3, 'previous')).toBe(0);
    expect(step(1, 3, 'previous')).toBe(0);
    expect(step(5, 0, 'next')).toBe(0);
  });

  it('asks again at the server-authored expiry, and never declares expiry itself', () => {
    const now = Date.parse('2026-01-01T12:00:00.000Z');
    expect(msUntilReread('2026-01-02T00:00:00.000Z', now)).toBe(12 * 3_600_000);
    // Already past, or unreadable: no local verdict, no timer; the fresh read that produced it stands.
    expect(msUntilReread('2025-12-31T00:00:00.000Z', now)).toBeNull();
    expect(msUntilReread('not a date', now)).toBeNull();
    expect(msUntilReread('2999-01-01T00:00:00.000Z', now)).toBe(MAX_TIMER_MS);
  });
});

describe('Story fixtures', () => {
  it('serves the row in the server order, and the group chronologically, to a guest and an Account alike (Stories are public)', async () => {
    const world = createFixtureTransport();
    const guest = await makeRuntime(world.transport);
    const account = await makeRuntime(world.transport);
    await guest.runtime.start();
    await account.runtime.start();
    await signIn(account.runtime, PERSONAS[0]?.phone as string);
    await settle();
    const a = await guest.runtime.session.call('stories.row.get', {});
    const b = await account.runtime.session.call('stories.row.get', {});
    expect(a.groups.map((g) => g.seller.sellerRef)).toEqual(['fx_seller_demo_bete', 'fx_seller_demo_alem']);
    expect(b).toEqual(a);
    const group = await guest.runtime.session.call('stories.group.get', { sellerRef: 'fx_seller_demo_alem' });
    expect(group.stories.map((s) => s.storyRef)).toEqual(['fx_story_demo_1', 'fx_story_demo_2']);
  });

  it('answers one neutral 404 for an expired, withdrawn, restricted or unknown Seller, and drops it from the row', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    world.handle.expireStories('fx_seller_demo_bete');
    const row = await runtime.session.call('stories.row.get', {});
    expect(row.groups.map((g) => g.seller.sellerRef)).toEqual(['fx_seller_demo_alem']);
    for (const sellerRef of ['fx_seller_demo_bete', 'fx_seller_demo_unknown']) {
      await expect(runtime.session.call('stories.group.get', { sellerRef })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('carries no state, count, viewer list, seen state, reply or reaction field, and no original media key', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const payloads = [await runtime.session.call('stories.row.get', {}), await runtime.session.call('stories.group.get', { sellerRef: 'fx_seller_demo_alem' })];
    const keys = new Set<string>();
    const walk = (node: unknown) => {
      if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          keys.add(k);
          walk(v);
        }
      }
    };
    payloads.forEach(walk);
    expect([...keys].filter((k) => /state|count|viewer|seen|reply|reaction|comment|like|share|moderation|public|original|score|rank|discount/i.test(k))).toEqual([]);
  });

  it('a Story fixture expiry is a future server instant, so a fixture Story is never already expired under a real clock', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const { stories } = await runtime.session.call('stories.group.get', { sellerRef: 'fx_seller_demo_alem' });
    for (const s of stories) expect(Date.parse(s.expiresAt)).toBeGreaterThan(Date.now());
  });
});

describe('StoryCard', () => {
  it('shows the photo with its description, real text, and exactly one navigating action', async () => {
    const onOpenTarget = jest.fn();
    await render(<StoryCard story={story()} sellerName="Store One" onOpenTarget={onOpenTarget} />);
    expect(screen.getByRole('image', { name: 'Story from Store One' })).toBeTruthy();
    expect(screen.getByText('Fresh stock today.')).toBeTruthy();
    const actions = screen.getAllByRole('button');
    expect(actions).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'View product' }));
    expect(onOpenTarget).toHaveBeenCalledTimes(1);
  });

  it('a Scene link says Explore the Scene; no link means no call to action; no text means no text and no placeholder', async () => {
    await render(<StoryCard story={story({ target: { kind: 'SCENE', ref: 's1', label: 'x' }, text: null })} sellerName="Store One" onOpenTarget={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Explore the Scene' })).toBeTruthy();
    expect(screen.queryByText('Fresh stock today.')).toBeNull();
    await render(<StoryCard story={story({ target: null })} sellerName="Store One" onOpenTarget={() => undefined} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('draws no reply, comment, reaction, Like, share, viewer list or count', async () => {
    await render(<StoryCard story={story()} sellerName="Store One" onOpenTarget={() => undefined} />);
    expect(screen.queryByText(/reply|comment|react|like|share|viewer|views?\b|seen/i)).toBeNull();
  });
});
