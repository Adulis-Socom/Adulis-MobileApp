import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo, Alert, AppState, type AppStateStatus } from 'react-native';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, problem, type installFakeApi } from '../testing/fake-api';
import type { installFakeCollections } from '../testing/fake-collections';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';
import { accountB, afterSignOut, asA, asB, flush, naming, open, switchToB } from '../testing/saved-accounts';
import { PICKER, PRODUCT_ID, PRODUCT_TARGET, SCENE_TARGET, held, installSavedApp } from '../testing/saved-app';

/**
 * Private Saved and Collection data across sessions: what a screen kept in the stack, a delayed answer, a
 * dialog left open, an ended session, a changed or foreign Collection and a target that stopped being
 * public may show or ask for. Every test runs on the real route tree against the in-memory Collections
 * server, which answers the first Account's Collections to anyone: a request under another credential is
 * visible, never assumed refused.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const FIRST = 'First Account private list';

let api: ReturnType<typeof installFakeApi>;
let fc: ReturnType<typeof installFakeCollections>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const removes = () => api.calls.filter((c) => c.method === 'DELETE' && /\/items\//.test(c.path));
const privateCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/collections'));
const emptySaves = { status: 200, body: { data: [], next_cursor: null } };
// The whole rendered tree, screens hidden under others and header titles included: a text query skips those.
type Json = string | { props?: Record<string, unknown>; children?: Json[] | null } | null;
const everything = () => {
  const out: string[] = [];
  const walk = (node: Json | Json[]) => {
    if (node === null) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === 'string') return void out.push(node);
    for (const value of Object.values(node.props ?? {})) if (typeof value === 'string') out.push(value);
    walk(node.children ?? null);
  };
  walk(screen.toJSON() as Json | Json[]);
  return out.join(' | ');
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  ({ api, fc } = installSavedApp());
});

afterEach(() => {
  // Nothing here touches commerce.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('a Collection kept in the stack when the Account changes', () => {
  it("asks for nothing under the second Account, draws nothing of the first, and returning to it lands on the second Account's Saved", async () => {
    signedIn();
    accountB(api, fc);
    const outfit = fc.named(FIRST);
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    expect(await screen.findByRole('header', { name: FIRST })).toBeOnTheScreen();
    expect(await screen.findByText('Woven basket')).toBeOnTheScreen();

    await switchToB();
    await flush();
    const later = afterSignOut(api);
    expect(later.filter(naming(outfit))).toEqual([]);
    expect(later.filter((c) => c.headers.Authorization !== undefined).every(asB)).toBe(true);
    expect(screen.queryByText(FIRST)).toBeNull();
    expect(screen.queryByText('Woven basket')).toBeNull();
    // Not in a hidden screen or in a header title either.
    expect(everything()).not.toContain(FIRST);
    expect(everything()).not.toContain('Woven basket');

    // Back to the retained Collection: it leaves for the second Account's Saved and shows only that.
    await open(`/collections/${outfit}`);
    expect(await screen.findByRole('button', { name: 'Saved, Products: 0, Scenes: 0' })).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(screen.queryByText(FIRST)).toBeNull();
    expect(afterSignOut(api).filter(naming(outfit))).toEqual([]);
  });

  it('a read for the first Account that lands after the second one signed in is never drawn or asked for again', async () => {
    signedIn();
    accountB(api, fc);
    const outfit = fc.named(FIRST);
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    const gate = held();
    fc.intercept('detail', async (call) => {
      if (asA(call)) await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    await waitFor(() => expect(api.calls.filter(naming(outfit)).filter(asA)).toHaveLength(1));
    await switchToB();
    await act(async () => gate.release());
    await flush();
    expect(screen.queryByText(FIRST)).toBeNull();
    expect(screen.queryByText('Woven basket')).toBeNull();
    await open(`/collections/${outfit}`);
    expect(await screen.findByRole('button', { name: 'Saved, Products: 0, Scenes: 0' })).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(afterSignOut(api).filter(naming(outfit))).toEqual([]);
    expect(screen.queryByText(FIRST)).toBeNull();
  });

  it('a Delete confirmed in a dialog that stayed open across the switch sends nothing', async () => {
    signedIn();
    accountB(api, fc);
    const gifts = fc.named('Gifts');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await renderRouter(APP_DIR, { initialUrl: `/collections/${gifts}` });
      await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.delete'] }));
      const confirm = alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!;
      await switchToB();
      await act(async () => {
        await confirm.onPress!();
      });
      await flush();
      expect(api.calls.filter((c) => c.method === 'DELETE')).toEqual([]);
      expect(fc.collections.some((c) => c.ref === gifts)).toBe(true);
    } finally {
      alert.mockRestore();
    }
  });

  it('a Rename still in flight at the switch changes nothing on screen and asks for nothing after it', async () => {
    signedIn();
    accountB(api, fc);
    const gifts = fc.named('Gifts');
    const gate = held();
    fc.intercept('rename', async (call) => {
      if (asA(call)) await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: `/collections/${gifts}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.rename'] }));
    await fireEvent.changeText(screen.getByLabelText(en['buyer.saved.name']), 'Renamed list');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.save_name'] }));
    await waitFor(() => expect(api.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1));
    await switchToB();
    await act(async () => gate.release());
    await flush();
    expect(screen.queryByText('Renamed list')).toBeNull();
    expect(afterSignOut(api).filter(naming(gifts))).toEqual([]);
  });
});

describe('the other private screens of the family when the Account changes', () => {
  it('the Saved tab draws nothing of the first Account for the second while the second one is still loading', async () => {
    signedIn();
    accountB(api, fc);
    fc.named(FIRST);
    fc.saveElsewhere(PRODUCT_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByText('Woven basket')).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: /^First Account private list, / })).toBeOnTheScreen();

    const gate = held();
    fc.intercept('saves', async (call) => {
      if (!asB(call)) return undefined;
      await gate.gate;
      return emptySaves;
    });
    await switchToB();
    await act(() => router.navigate('/saved'));
    await waitFor(() => expect(api.calls.filter((c) => c.path === '/v1/collections/saves').filter(asB)).toHaveLength(1));
    // B's Recent Saves have not arrived: nothing of A's is drawn in their place.
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(screen.queryByText(FIRST)).toBeNull();
    await act(async () => gate.release());
    expect(await screen.findByText(en['buyer.saved.empty'])).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(afterSignOut(api).filter(asA)).toEqual([]);
  });

  it("the picker kept in the stack asks only for the second Account's own Collections, and never for the first Account's", async () => {
    signedIn();
    accountB(api, fc);
    const outfit = fc.named(FIRST);
    const app = await renderRouter(APP_DIR, { initialUrl: PICKER });
    expect(await screen.findByRole('checkbox', { name: FIRST })).toBeOnTheScreen();
    await switchToB();
    await flush();
    const later = afterSignOut(api);
    expect(later.filter(naming(outfit))).toEqual([]);
    expect(later.filter((c) => c.headers.Authorization !== undefined).every(asB)).toBe(true);
    // Back on the retained picker: only the second Account's Saved is offered.
    for (let i = 0; i < 6 && app.getPathname() !== '/save-to'; i++) await act(() => router.back());
    expect(screen).toHavePathname('/save-to');
    expect(await screen.findByRole('checkbox', { name: en['buyer.saved.default_name'] })).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: FIRST })).toBeNull();
    expect(afterSignOut(api).filter(naming(outfit))).toEqual([]);
  });

  it('signing out clears the guest Save armed in memory', async () => {
    signedIn();
    useUiStore.setState({ pendingSave: { nonce: '11111111-1111-4111-8111-111111111111', target: PRODUCT_TARGET, surface: 'PRODUCT_DETAIL', sceneRef: null } });
    await renderRouter(APP_DIR, { initialUrl: '/account' });
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await screen.findByText(en['buyer.you.signed_out']);
    expect(useUiStore.getState().pendingSave).toBeNull();
  });
});

describe('an expired session', () => {
  it('on a Collection read signs out, leaves nothing of the Collection on screen and asks for nothing more', async () => {
    signedIn();
    const outfit = fc.named(FIRST);
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    fc.intercept('detail', () => problem(401, 'SESSION_EXPIRED', 'auth'));
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    await waitFor(() => expect(memory.has(TOKEN_KEY)).toBe(false));
    await flush();
    const after = privateCalls().length;
    await act(() => jest.advanceTimersByTimeAsync(120_000));
    expect(privateCalls().length).toBe(after);
    expect(screen.queryByText(FIRST)).toBeNull();
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(everything()).not.toContain(FIRST);
  });

  it('on the Saved list signs out and leaves no Collection or saved item on screen', async () => {
    signedIn();
    fc.named(FIRST);
    fc.saveElsewhere(PRODUCT_TARGET);
    fc.intercept('saves', () => problem(401, 'SESSION_EXPIRED', 'auth'));
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    await waitFor(() => expect(memory.has(TOKEN_KEY)).toBe(false));
    await flush();
    expect(screen.queryByText(FIRST)).toBeNull();
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(screen.queryByRole('button', { name: /^First Account private list, / })).toBeNull();
  });

  it('on a Remove signs out, says nothing about the removal and asks for nothing more', async () => {
    signedIn();
    const outfit = fc.named(FIRST);
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    fc.intercept('remove', () => problem(401, 'SESSION_EXPIRED', 'auth'));
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    try {
      await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
      await fireEvent.press(await screen.findByRole('button', { name: 'Remove Woven basket from this collection' }));
      expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
      await flush();
      const after = privateCalls().length;
      await act(() => jest.advanceTimersByTimeAsync(120_000));
      expect(privateCalls().length).toBe(after);
      expect(removes()).toHaveLength(1);
      expect(announce).not.toHaveBeenCalledWith(expect.stringMatching(/^Removed from/));
      expect(screen.queryByText('Woven basket')).toBeNull();
    } finally {
      announce.mockRestore();
    }
  });
});

describe('a target that stopped being public', () => {
  it('a Scene that turned private is one neutral sentence with no caption or image, on the Saved list and in its Collection, and can be removed', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    fc.saveElsewhere(SCENE_TARGET, outfit);
    fc.hide(SCENE_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByText(en['buyer.saved.scene_unavailable'])).toBeOnTheScreen();
    expect(screen.getByText('Woven basket')).toBeOnTheScreen();
    expect(screen.queryByText('Morning baskets')).toBeNull();
    expect(screen.queryByTestId('search-scene-tile')).toBeNull();

    await fireEvent.press(await screen.findByRole('button', { name: /^Outfit ideas, / }));
    expect(await screen.findByText(en['buyer.saved.scene_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('Morning baskets')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.remove_unavailable'] }));
    await waitFor(() => expect(screen.queryByText(en['buyer.saved.scene_unavailable'])).toBeNull());
    expect(removes()).toHaveLength(1);
    expect(screen.getByText('Woven basket')).toBeOnTheScreen();
  });

  it('a Product and a Scene that are gone show no name, store or caption in a Collection, whatever they once were', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    fc.saveElsewhere(SCENE_TARGET, outfit);
    fc.hide(PRODUCT_TARGET);
    fc.hide(SCENE_TARGET);
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    expect(await screen.findByText(en['buyer.saved.product_unavailable'])).toBeOnTheScreen();
    expect(screen.getByText(en['buyer.saved.scene_unavailable'])).toBeOnTheScreen();
    for (const text of ['Woven basket', 'Morning baskets', 'Store seller-1']) expect(screen.queryByText(text)).toBeNull();
    expect(screen.getAllByRole('button', { name: en['buyer.collection.remove_unavailable'] })).toHaveLength(2);
  });

  it('a Saved item that stopped being public is neutral once the list is read again on returning to it', async () => {
    signedIn();
    fc.saveElsewhere(PRODUCT_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Woven basket/ }));
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    fc.hide(PRODUCT_TARGET);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.saved.product_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
  });

  it('the picker says the item can no longer be saved and changes no Collection', async () => {
    signedIn();
    fc.named('Gifts');
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    const gifts = await screen.findByRole('checkbox', { name: 'Gifts' });
    fc.hide(PRODUCT_TARGET);
    await fireEvent.press(gifts);
    expect(await screen.findByText(en['buyer.save.target_gone'])).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Gifts' })).toBeEnabled());
    expect(screen.getByRole('checkbox', { name: 'Gifts' })).not.toBeChecked();
    expect(fc.items).toEqual([]);
  });
});

describe('a Collection that is gone, foreign or malformed', () => {
  it('deleted on another device: the open screen shows one neutral sentence when it is shown again, and Saved drops the row', async () => {
    signedIn();
    const gifts = fc.named('Gifts');
    fc.saveElsewhere(PRODUCT_TARGET, gifts);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Gifts, / }));
    await fireEvent.press(await screen.findByRole('button', { name: /^Woven basket/ }));
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    fc.collections.splice(fc.collections.findIndex((c) => c.ref === gifts), 1);
    await act(() => router.back());
    expect(await screen.findByText(en['buyer.collection.gone'])).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(screen.queryByRole('header', { name: 'Gifts' })).toBeNull();
    expect(screen.queryByRole('button', { name: en['buyer.collection.rename'] })).toBeNull();
    expect(screen.queryByRole('button', { name: en['buyer.collection.delete'] })).toBeNull();
    await act(() => router.back());
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Gifts, / })).toBeNull());
  });

  it("another Account's Collection ref (the server owns nothing under it) is one neutral sentence with no name or item", async () => {
    signedIn();
    fc.saveElsewhere(PRODUCT_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/collections/0c000000-0000-4000-8000-0000000009ff' });
    expect(await screen.findByText(en['buyer.collection.gone'])).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
    expect(screen.queryByRole('button', { name: en['buyer.collection.rename'] })).toBeNull();
    expect(privateCalls().map((c) => `${c.method} ${c.path}`)).toEqual(['GET /v1/collections/0c000000-0000-4000-8000-0000000009ff']);
  });

  it.each([['not-a-ref'], ['..%2F..%2Fsaves'], ['0C000000-0000-4000-8000-000000000100'], ['0c000000-0000-4000-8000-000000000100%00']])(
    'a malformed Collection ref (%s) is one neutral sentence and nothing is requested for it',
    async (ref) => {
      signedIn();
      await renderRouter(APP_DIR, { initialUrl: `/collections/${ref}` });
      expect(await screen.findByText(en['buyer.collection.gone'])).toBeOnTheScreen();
      await flush();
      expect(privateCalls()).toEqual([]);
    },
  );

  it('a Rename of a Collection that is already gone leaves its open screen on the neutral sentence', async () => {
    signedIn();
    const gifts = fc.named('Gifts');
    await renderRouter(APP_DIR, { initialUrl: `/collections/${gifts}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.rename'] }));
    await fireEvent.changeText(screen.getByLabelText(en['buyer.saved.name']), 'Renamed list');
    fc.collections.splice(fc.collections.findIndex((c) => c.ref === gifts), 1);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.save_name'] }));
    expect(await screen.findByText(en['buyer.collection.gone'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.collection.save_name'] })).toBeNull();
  });

  it('a Delete of a Collection that is already gone is the outcome asked for: back on Saved', async () => {
    signedIn();
    const gifts = fc.named('Gifts');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await renderRouter(APP_DIR, { initialUrl: '/saved' });
      await fireEvent.press(await screen.findByRole('button', { name: /^Gifts, / }));
      await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.delete'] }));
      fc.collections.splice(fc.collections.findIndex((c) => c.ref === gifts), 1);
      const confirm = alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!;
      await act(async () => {
        await confirm.onPress!();
      });
      await waitFor(() => expect(screen).toHavePathname('/saved'));
      await waitFor(() => expect(screen.queryByRole('button', { name: /^Gifts, / })).toBeNull());
    } finally {
      alert.mockRestore();
    }
  });
});

describe('forged picker links', () => {
  it.each([
    ['a Product ref that is not a uuid', 'type=PRODUCT_POST&ref=not-a-uuid&surface=PRODUCT_DETAIL'],
    ['a surface the API does not know', `type=PRODUCT_POST&ref=${PRODUCT_ID}&surface=EVIL`],
    ['a target type the API does not know', `type=SELLER&ref=${PRODUCT_ID}&surface=SHOP`],
    ['a Scene ref with a path in it', 'type=SCENE_POST&ref=..%2Fsaves&surface=SCENE_EXPLORER'],
    ['no parameters at all', ''],
  ])('%s says the item can no longer be saved and requests nothing', async (_name, query) => {
    signedIn();
    fc.named('Gifts');
    await renderRouter(APP_DIR, { initialUrl: `/save-to?${query}` });
    expect(await screen.findByText(en['buyer.save.target_gone'])).toBeOnTheScreen();
    await flush();
    expect(privateCalls()).toEqual([]);
  });
});

/**
 * Returning from the background: what a Collection showed may no longer be public, so the items are
 * withheld while it is read again, and the new answer replaces them.
 */
describe('a Collection read again after the app was in the background', () => {
  let listeners: ((state: AppStateStatus) => void)[] = [];
  let appState: jest.SpyInstance | undefined;
  let original: ((...args: never[]) => unknown) | undefined;
  beforeEach(() => {
    listeners = [];
    appState = jest.spyOn(AppState, 'addEventListener');
    original = appState.getMockImplementation();
    appState.mockImplementation((type, listener) => {
      if (type === 'change') listeners.push(listener as (state: AppStateStatus) => void);
      return {
        remove: () => {
          listeners = listeners.filter((l) => l !== listener);
        },
      } as ReturnType<typeof AppState.addEventListener>;
    });
  });
  afterEach(() => {
    if (appState && original) appState.mockImplementation(original);
  });
  const goTo = (state: AppStateStatus) =>
    act(() => {
      for (const listener of [...listeners]) listener(state);
    });

  it('withholds the items while it is read again and then shows what is public now', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    expect(await screen.findByText('Woven basket')).toBeOnTheScreen();
    const gate = held();
    fc.intercept('detail', async () => {
      await gate.gate;
      return undefined;
    });
    fc.hide(PRODUCT_TARGET);
    await goTo('background');
    await act(() => jest.advanceTimersByTimeAsync(6 * 60_000));
    await goTo('active');
    // The re-read is in flight: the item that may have stopped being public is not on screen.
    await waitFor(() => expect(api.calls.filter((c) => c.path === `/v1/collections/${outfit}`)).toHaveLength(2));
    expect(screen.queryByText('Woven basket')).toBeNull();
    await act(async () => gate.release());
    expect(await screen.findByText(en['buyer.saved.product_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).toBeNull();
  });
});
