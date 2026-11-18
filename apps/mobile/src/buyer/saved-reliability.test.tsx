import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { GOOD_TOKEN, problem, shopProduct, type installFakeApi, type Reply } from '../testing/fake-api';
import type { installFakeCollections } from '../testing/fake-collections';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';
import { PICKER, PRODUCT_TARGET, SCENE, SCENE_TARGET, held, installSavedApp } from '../testing/saved-app';

/**
 * Saves, Collections and their members after an uncertain outcome: a connection lost or timed out after the
 * server stored the change, a gateway page, a 5xx, a 429, a 409, a refusal, repeated taps and a late
 * confirmation. The in-memory Collections server stores the change first and loses the answer on request
 * (fc.loseAnswer), keeps one membership per Collection and target, and replays a Create's key like the
 * API's idempotency store, so a duplicate shows as a second Collection. The Buyer is never told something
 * the server has not confirmed, and nothing is sent again behind the Buyer's back.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const GATEWAY: Reply = { status: 502, unreadable: true };
let api: ReturnType<typeof installFakeApi>;
let fc: ReturnType<typeof installFakeCollections>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const adds = () => api.calls.filter((c) => c.method === 'POST' && /^\/v1\/collections\/[^/]+\/items$/.test(c.path));
const removes = () => api.calls.filter((c) => c.method === 'DELETE' && /\/items\//.test(c.path));
const creates = () => api.callsTo('POST /v1/collections');
const keys = () => creates().map((c) => c.headers['Idempotency-Key']);
const named = (name: string) => fc.collections.filter((c) => c.name === name);
const once = (reply: Reply) => {
  let used = false;
  return () => (used ? undefined : ((used = true), reply));
};
const timeOut = () => act(() => jest.advanceTimersByTimeAsync(11_000));
const flush = async () => {
  for (let i = 0; i < 20; i++) await act(() => Promise.resolve());
};
// Time passes, so the turn that dispatches a failed Save has run while the read after it is still held.
const settle = () => act(() => jest.advanceTimersByTimeAsync(100));

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  ({ api, fc } = installSavedApp());
});

afterEach(() => {
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('creating a Collection after an uncertain outcome', () => {
  const createButton = () => screen.getByRole('button', { name: en['buyer.saved.create'] });
  async function start(name = 'Gifts') {
    signedIn();
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.saved.new'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.saved.name']), name);
  }
  const settled = () => waitFor(() => expect(createButton()).toBeEnabled());
  const rows = (name: string) => screen.queryAllByRole('button', { name: new RegExp(`^${name}, `) });

  /** Stored by the server, answer lost: the list is read again, the retry carries the same key, and one Collection exists. */
  async function lostAfterStore(reply: Reply, wait: () => Promise<unknown> = () => Promise.resolve()) {
    await start();
    fc.loseAnswer('create', reply);
    await fireEvent.press(createButton());
    await waitFor(() => expect(creates()).toHaveLength(1));
    await wait();
    await settled();
    // Reconciled from the server: the Collection that was stored is in the list, once, before any retry.
    await waitFor(() => expect(rows('Gifts')).toHaveLength(1));
    await fireEvent.press(createButton());
    await waitFor(() => expect(screen.queryByTestId('new-collection')).toBeNull());
    expect(keys()).toHaveLength(2);
    expect(keys()[1]).toBe(keys()[0]);
    expect(named('Gifts')).toHaveLength(1);
    await flush();
    expect(rows('Gifts')).toHaveLength(1);
  }

  it.each([
    ['the connection is lost', 'offline' as Reply],
    ['a gateway page answers', GATEWAY],
    ['a 500 answers', problem(500, 'INTERNAL', 'request')],
    ['a 503 answers', problem(503, 'INTERNAL', 'request')],
  ])('%s after the Collection was stored: the list is read again and the retry keeps the key, so there is one Collection', async (_name, reply) => {
    await lostAfterStore(reply);
  });

  it('the request times out after the Collection was stored: the same, at ten seconds', async () => {
    await lostAfterStore('hang', timeOut);
  });

  it.each([
    ['a 429', problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 5 })],
    ['a 500 before anything was stored', problem(500, 'INTERNAL', 'request')],
    ['a gateway page before anything was stored', GATEWAY],
  ])('%s: the retry keeps the key and creates exactly one Collection', async (_name, reply) => {
    await start();
    fc.intercept('create', once(reply));
    await fireEvent.press(createButton());
    await waitFor(() => expect(creates()).toHaveLength(1));
    await settled();
    expect(named('Gifts')).toHaveLength(0);
    await fireEvent.press(createButton());
    await waitFor(() => expect(screen.queryByTestId('new-collection')).toBeNull());
    expect(keys()[1]).toBe(keys()[0]);
    expect(named('Gifts')).toHaveLength(1);
  });

  it('a 409 on the key is not replayed: the list is read again, the reason is said, and only a new Create is a new attempt', async () => {
    await start();
    fc.intercept('create', once(problem(409, 'IDEMPOTENCY_KEY_REUSED', 'request')));
    const before = api.callsTo('GET /v1/collections').length;
    await fireEvent.press(createButton());
    expect(await screen.findByText(en['error.request.idempotency_key_reused'])).toBeOnTheScreen();
    await settled();
    await waitFor(() => expect(api.callsTo('GET /v1/collections').length).toBeGreaterThan(before));
    expect(creates()).toHaveLength(1);
    await fireEvent.press(createButton());
    await waitFor(() => expect(screen.queryByTestId('new-collection')).toBeNull());
    expect(keys()[1]).not.toBe(keys()[0]);
    expect(named('Gifts')).toHaveLength(1);
  });

  it("an API refusal is final: nothing was stored, so the next attempt is a new one with a new key", async () => {
    await start();
    fc.intercept('create', once(problem(400, 'VALIDATION_FAILED', 'request', { path: 'name' })));
    await fireEvent.press(createButton());
    expect(await screen.findByText(en['buyer.saved.name_invalid'])).toBeOnTheScreen();
    await settled();
    expect(api.callsTo('GET /v1/collections')).toHaveLength(1);
    await fireEvent.press(createButton());
    await waitFor(() => expect(screen.queryByTestId('new-collection')).toBeNull());
    expect(keys()[1]).not.toBe(keys()[0]);
    expect(named('Gifts')).toHaveLength(1);
  });

  it('a name changed after an uncertain outcome is a different Collection and gets its own key', async () => {
    await start();
    fc.loseAnswer('create', 'offline');
    await fireEvent.press(createButton());
    await settled();
    await fireEvent.changeText(screen.getByLabelText(en['buyer.saved.name']), 'Gifts for mum');
    await fireEvent.press(createButton());
    await waitFor(() => expect(screen.queryByTestId('new-collection')).toBeNull());
    expect(keys()[1]).not.toBe(keys()[0]);
  });

  it('repeated taps while the first Create is in flight send one request', async () => {
    await start();
    const gate = held();
    fc.intercept('create', async () => {
      await gate.gate;
      return undefined;
    });
    await fireEvent.press(createButton());
    await waitFor(() => expect(creates()).toHaveLength(1));
    await fireEvent.press(createButton());
    await fireEvent.press(createButton());
    await act(async () => gate.release());
    await waitFor(() => expect(screen.queryByTestId('new-collection')).toBeNull());
    expect(creates()).toHaveLength(1);
    expect(named('Gifts')).toHaveLength(1);
  });
});

describe('one-tap Save and Remove after an uncertain outcome', () => {
  const PRODUCT = '/product/seller-1/basket';
  const saveButton = () => screen.findByRole('button', { name: en['buyer.save.save'] });
  const savedButton = () => screen.findByRole('button', { name: en['buyer.save.saved'] });
  const notChanged = () => screen.queryByText(new RegExp(`^${en['buyer.save.failed']}`));
  const stateCalls = () => api.callsTo('POST /v1/collections/saved-state:batch');

  it.each([
    ['the connection is lost', 'offline' as Reply],
    ['a gateway page answers', GATEWAY],
    ['a 500 answers', problem(500, 'INTERNAL', 'request')],
  ])('%s after the Save was stored: Product Detail shows what the server holds, and does not say it was not changed', async (_name, reply) => {
    signedIn();
    fc.loseAnswer('add', reply);
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await saveButton());
    expect(await savedButton()).toBeOnTheScreen();
    await flush();
    expect(notChanged()).toBeNull();
    expect(adds()).toHaveLength(1);
    expect(fc.items).toHaveLength(1);
  });

  it('the Save times out after it was stored: the same, and nothing is claimed before the server is read', async () => {
    signedIn();
    fc.loseAnswer('add', 'hang');
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await saveButton());
    await waitFor(() => expect(adds()).toHaveLength(1));
    // Waiting on the server: still Save, never drawn as saved by a guess.
    await waitFor(() => expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeDisabled());
    await timeOut();
    expect(await savedButton()).toBeOnTheScreen();
    await flush();
    expect(notChanged()).toBeNull();
    expect(fc.items).toHaveLength(1);
  });

  it.each([
    ['the connection is lost', 'offline' as Reply],
    ['a gateway page answers', GATEWAY],
    ['a 500 answers', problem(500, 'INTERNAL', 'request')],
    ['a 429 answers', problem(429, 'RATE_LIMITED', 'request', { retry_after_seconds: 5 })],
    ['a 409 answers', problem(409, 'IDEMPOTENCY_KEY_REUSED', 'request')],
  ])('%s before the Save was stored: the server is read again, it says so, and the next tap saves once', async (_name, reply) => {
    signedIn();
    fc.intercept('add', once(reply));
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await saveButton());
    expect(await screen.findByText(new RegExp(`^${en['buyer.save.failed']}`))).toBeOnTheScreen();
    expect(await saveButton()).toBeOnTheScreen();
    // The state read on opening and the one after the failure.
    await waitFor(() => expect(stateCalls().length).toBeGreaterThanOrEqual(2));
    await fireEvent.press(await saveButton());
    expect(await savedButton()).toBeOnTheScreen();
    expect(fc.items).toHaveLength(1);
  });

  it('a Remove whose answer was lost after it was stored shows the item as not saved, without a failure sentence', async () => {
    signedIn();
    fc.saveElsewhere(PRODUCT_TARGET);
    fc.loseAnswer('remove', 'offline');
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await savedButton());
    expect(await saveButton()).toBeOnTheScreen();
    await flush();
    expect(notChanged()).toBeNull();
    expect(removes()).toHaveLength(1);
    expect(fc.items).toEqual([]);
  });

  it('a Scene Save whose answer was lost after it was stored shows Saved', async () => {
    signedIn();
    fc.loseAnswer('add', 'offline');
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${SCENE.public_ref}` });
    await fireEvent.press(await saveButton());
    expect(await savedButton()).toBeOnTheScreen();
    expect(fc.items.map((i) => i.target)).toEqual([SCENE_TARGET]);
  });

  it('repeated taps while a Save is in flight send one request', async () => {
    signedIn();
    const gate = held();
    fc.intercept('add', async () => {
      await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await saveButton());
    await waitFor(() => expect(adds()).toHaveLength(1));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.save.save'] }));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.save.save'] }));
    await act(async () => gate.release());
    expect(await savedButton()).toBeOnTheScreen();
    expect(adds()).toHaveLength(1);
  });

  it('a Save confirmed after the Buyer left the screen is kept once, and opening the Product again shows it', async () => {
    signedIn();
    const gate = held();
    fc.intercept('add', async () => {
      await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await saveButton());
    await waitFor(() => expect(adds()).toHaveLength(1));
    await act(() => router.back());
    await waitFor(() => expect(screen).not.toHavePathname(PRODUCT));
    await act(async () => gate.release());
    await flush();
    expect(fc.items).toHaveLength(1);
    await act(() => router.push(PRODUCT));
    expect(await savedButton()).toBeOnTheScreen();
    expect(adds()).toHaveLength(1);
  });

  it('the failure of a Save is not said while the read that follows it is on its way, and never if that read shows it was stored', async () => {
    signedIn();
    fc.loseAnswer('add', 'offline');
    const gate = held();
    fc.intercept('state', async () => {
      if (stateCalls().length > 1) await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await saveButton());
    await waitFor(() => expect(stateCalls().length).toBeGreaterThanOrEqual(2));
    await settle();
    expect(notChanged()).toBeNull();
    expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeOnTheScreen();
    await act(async () => gate.release());
    expect(await savedButton()).toBeOnTheScreen();
    await flush();
    expect(notChanged()).toBeNull();
  });

  it('the failure of a Save that was not stored is said once that read has answered', async () => {
    signedIn();
    fc.intercept('add', once(problem(500, 'INTERNAL', 'request')));
    const gate = held();
    fc.intercept('state', async () => {
      if (stateCalls().length > 1) await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: PRODUCT });
    await fireEvent.press(await saveButton());
    await waitFor(() => expect(stateCalls().length).toBeGreaterThanOrEqual(2));
    await settle();
    expect(notChanged()).toBeNull();
    await act(async () => gate.release());
    expect(await screen.findByText(new RegExp(`^${en['buyer.save.failed']}`))).toBeOnTheScreen();
    expect(await saveButton()).toBeOnTheScreen();
  });
});

describe('the Add to collection picker after an uncertain outcome', () => {
  const box = (name: string) => screen.getByRole('checkbox', { name });

  it('a tick whose answer was lost after it was stored is drawn as ticked, without a failure sentence', async () => {
    signedIn();
    fc.named('Gifts');
    fc.loseAnswer('add', 'offline');
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Gifts' }));
    await waitFor(() => expect(box('Gifts')).toBeChecked());
    await waitFor(() => expect(box('Gifts')).toBeEnabled());
    await flush();
    expect(screen.queryByText(new RegExp(`^${en['buyer.save.failed']}`))).toBeNull();
    expect(fc.items).toHaveLength(1);
  });

  it('a tick that was not stored stays unticked and says so', async () => {
    signedIn();
    fc.named('Gifts');
    fc.intercept('add', once(problem(500, 'INTERNAL', 'request')));
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Gifts' }));
    expect(await screen.findByText(new RegExp(`^${en['buyer.save.failed']}`))).toBeOnTheScreen();
    await waitFor(() => expect(box('Gifts')).toBeEnabled());
    expect(box('Gifts')).not.toBeChecked();
    expect(fc.items).toEqual([]);
  });

  it('a New collection whose Create answer was lost is read again, and its retry keeps the key', async () => {
    signedIn();
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.saved.new'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.saved.name']), 'Gift ideas');
    fc.loseAnswer('create', GATEWAY);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.saved.create'] }));
    await waitFor(() => expect(creates()).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: en['buyer.saved.create'] })).toBeEnabled());
    // It is already in the picker's list, stored once.
    expect(await screen.findByRole('checkbox', { name: 'Gift ideas' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.saved.create'] }));
    await waitFor(() => expect(box('Gift ideas')).toBeChecked());
    expect(keys()[1]).toBe(keys()[0]);
    expect(named('Gift ideas')).toHaveLength(1);
  });
});

describe('a Save on a discovery card after an uncertain outcome', () => {
  const BASKET = shopProduct('basket', 'Basket', 'seller-1', { id: PRODUCT_TARGET.ref });
  const card = () => screen.getByRole('togglebutton', { name: 'Save Basket' });
  const isOn = () => card().props.accessibilityState?.checked === true;
  const isIdle = () => card().props.accessibilityState?.disabled !== true;
  async function openShop() {
    api.on('GET /v1/shop/products', () => ({ status: 200, body: { market_resolved: true, data: [BASKET], next_cursor: null } }));
    await renderRouter(APP_DIR, { initialUrl: '/shop' });
    await screen.findByRole('togglebutton', { name: 'Save Basket' });
    await waitFor(() => expect(isIdle()).toBe(true));
  }

  it('a Save whose answer was lost after it was stored shows the bookmark filled and does not say it was not changed', async () => {
    signedIn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      fc.loseAnswer('add', 'offline');
      await openShop();
      await fireEvent.press(card());
      await waitFor(() => expect(isOn()).toBe(true));
      await flush();
      expect(fc.items).toHaveLength(1);
      expect(alert).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });

  it('a Save that was not stored says so once and the bookmark stays empty', async () => {
    signedIn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      fc.intercept('add', once(problem(500, 'INTERNAL', 'request')));
      await openShop();
      await fireEvent.press(card());
      await waitFor(() => expect(alert).toHaveBeenCalledWith(en['buyer.save.failed'], expect.stringMatching(/./)));
      await flush();
      expect(alert).toHaveBeenCalledTimes(1);
      expect(isOn()).toBe(false);
      expect(fc.items).toEqual([]);
    } finally {
      alert.mockRestore();
    }
  });

  it('no Alert while the read that follows the failure is on its way, and none if it shows the Save was stored', async () => {
    signedIn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      fc.loseAnswer('add', 'offline');
      const gate = held();
      fc.intercept('state', async () => {
        if (api.callsTo('POST /v1/collections/saved-state:batch').length > 1) await gate.gate;
        return undefined;
      });
      await openShop();
      await fireEvent.press(card());
      await waitFor(() => expect(api.callsTo('POST /v1/collections/saved-state:batch').length).toBeGreaterThanOrEqual(2));
      await settle();
      expect(alert).not.toHaveBeenCalled();
      expect(isOn()).toBe(false);
      await act(async () => gate.release());
      await waitFor(() => expect(isOn()).toBe(true));
      await flush();
      expect(alert).not.toHaveBeenCalled();
    } finally {
      alert.mockRestore();
    }
  });

  it('the Alert for a Save that was not stored comes once that read has answered', async () => {
    signedIn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      fc.intercept('add', once(problem(500, 'INTERNAL', 'request')));
      const gate = held();
      fc.intercept('state', async () => {
        if (api.callsTo('POST /v1/collections/saved-state:batch').length > 1) await gate.gate;
        return undefined;
      });
      await openShop();
      await fireEvent.press(card());
      await waitFor(() => expect(api.callsTo('POST /v1/collections/saved-state:batch').length).toBeGreaterThanOrEqual(2));
      await settle();
      expect(alert).not.toHaveBeenCalled();
      await act(async () => gate.release());
      await waitFor(() => expect(alert).toHaveBeenCalledWith(en['buyer.save.failed'], expect.stringMatching(/./)));
      expect(alert).toHaveBeenCalledTimes(1);
      expect(isOn()).toBe(false);
    } finally {
      alert.mockRestore();
    }
  });
});

describe('changes inside a Collection after an uncertain outcome', () => {
  const failed = () => screen.queryByText(new RegExp(`^${en['buyer.collection.action_failed']}`));
  const removeBasket = () => screen.queryByRole('button', { name: 'Remove Woven basket from this collection' });

  it('a Remove whose answer was lost after it was stored: the item is gone from the list and "Nothing was changed" is not said', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    fc.loseAnswer('remove', 'offline');
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Woven basket from this collection' }));
    await waitFor(() => expect(removeBasket()).toBeNull());
    await flush();
    expect(failed()).toBeNull();
    expect(await screen.findByText(en['buyer.collection.empty'])).toBeOnTheScreen();
    expect(fc.items).toEqual([]);
  });

  it('a Remove that was not stored keeps the item, says nothing was changed, and the next Remove works', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    fc.intercept('remove', once(problem(500, 'INTERNAL', 'request')));
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Woven basket from this collection' }));
    expect(await screen.findByText(new RegExp(`^${en['buyer.collection.action_failed']}`))).toBeOnTheScreen();
    await flush();
    expect(removeBasket()).not.toBeNull();
    expect(failed()).not.toBeNull();
    await fireEvent.press(removeBasket()!);
    await waitFor(() => expect(removeBasket()).toBeNull());
    expect(failed()).toBeNull();
    expect(fc.items).toEqual([]);
  });

  it('a Rename whose answer was lost after it was stored: the title is the server\'s new name, and the retry is the same rename', async () => {
    signedIn();
    const gifts = fc.named('Gifts');
    fc.loseAnswer('rename', 'offline');
    await renderRouter(APP_DIR, { initialUrl: `/collections/${gifts}` });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.rename'] }));
    await fireEvent.changeText(screen.getByLabelText(en['buyer.saved.name']), 'Gifts for mum');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.save_name'] }));
    expect(await screen.findByRole('header', { name: 'Gifts for mum' })).toBeOnTheScreen();
    expect(screen.getByText(en['common.offline'])).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.save_name'] }));
    await waitFor(() => expect(screen.queryByTestId('rename-collection')).toBeNull());
    expect(api.calls.filter((c) => c.method === 'PATCH')).toHaveLength(2);
    expect(fc.collections.find((c) => c.ref === gifts)?.name).toBe('Gifts for mum');
  });

  it('a Delete whose answer was lost after it was stored: the retry finds it gone, which is the outcome asked for', async () => {
    signedIn();
    const gifts = fc.named('Gifts');
    fc.loseAnswer('delete', 'offline');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await renderRouter(APP_DIR, { initialUrl: '/saved' });
      await fireEvent.press(await screen.findByRole('button', { name: /^Gifts, / }));
      await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.delete'] }));
      await act(async () => {
        await alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!.onPress!();
      });
      expect(await screen.findByText(new RegExp(en['common.offline']))).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.delete'] }));
      await act(async () => {
        await alert.mock.calls[1]![2]!.find((b) => b.style === 'destructive')!.onPress!();
      });
      await waitFor(() => expect(screen).toHavePathname('/saved'));
      expect(fc.collections.some((c) => c.ref === gifts)).toBe(false);
      await act(() => router.navigate('/saved'));
    } finally {
      alert.mockRestore();
    }
  });
});

describe('read failures and loading states', () => {
  /** The server is unreachable for this route until the test brings it back. */
  const outage = () => {
    const state = { down: true };
    return { state, answer: () => (state.down ? ('offline' as Reply) : undefined) };
  };
  const wait = { timeout: 15_000 };

  it('the Collections on the Saved tab: a failed read says why and Try again brings them back', async () => {
    signedIn();
    fc.named('Gifts');
    const out = outage();
    fc.intercept('collections', out.answer);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByText(new RegExp(`^${en['buyer.saved.collections_failed']}`), {}, wait)).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(en['common.offline']))).toBeOnTheScreen();
    out.state.down = false;
    // The Collections section's own Try again (the Recent Saves list below has its own).
    await fireEvent.press(screen.getAllByRole('button', { name: en['common.retry'] })[0]!);
    expect(await screen.findByRole('button', { name: /^Gifts, / })).toBeOnTheScreen();
  });

  it('a Collection: loading is announced, a failed read says why, and Try again shows the items', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    const out = outage();
    fc.intercept('detail', out.answer);
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    expect(await screen.findByText(en['buyer.collection.loading'])).toBeOnTheScreen();
    expect(await screen.findByText(en['common.offline'], {}, wait)).toBeOnTheScreen();
    out.state.down = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('Woven basket')).toBeOnTheScreen();
  });

  it('the Saved list: loading is announced before the first answer', async () => {
    signedIn();
    const gate = held();
    fc.intercept('saves', async () => {
      await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByText(en['buyer.saved.loading'])).toBeOnTheScreen();
    await act(async () => gate.release());
    expect(await screen.findByText(en['buyer.saved.empty'])).toBeOnTheScreen();
  });

  it('Product Detail: a failed read of the saved state keeps Save off, says why, and Try again enables it', async () => {
    signedIn();
    const out = outage();
    fc.intercept('state', out.answer);
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    expect(await screen.findByText(new RegExp(en['common.offline']), {}, wait)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeDisabled();
    expect(screen.getByRole('button', { name: en['buyer.save.add'] })).toBeDisabled();
    out.state.down = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    await waitFor(() => expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeEnabled());
    expect(adds()).toEqual([]);
  });

  it('the picker: a failed read says why, offers nothing to tick, and Try again brings the Collections back', async () => {
    signedIn();
    fc.named('Gifts');
    const out = outage();
    fc.intercept('state', out.answer);
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    expect(await screen.findByText(en['common.offline'], {}, wait)).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: 'Gifts' })).toBeNull();
    out.state.down = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByRole('checkbox', { name: 'Gifts' })).toBeOnTheScreen();
    expect(adds()).toEqual([]);
  });
});
