import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo, Alert, Platform } from 'react-native';

import { useUiStore } from '../state/ui-store';
import {
  DEFAULT_COLLECTION_REF,
  GOOD_TOKEN,
  SIGNED_IN_CONTEXT,
  SIGN_IN_CODE,
  bootstrapBody,
  installFakeApi,
  problem,
  publicScene,
  shopProduct,
  storefrontProduct,
  type Reply,
} from '../testing/fake-api';
import { installFakeCollections } from '../testing/fake-collections';
import { TOKEN_KEY, memory, resetSecureStore } from '../testing/secure-store-mock';

/**
 * WO-009: Saved and Collections on the real route tree against an in-memory server on the API's
 * rules (testing/fake-collections.ts). Matrix numbers are the work order's section 23 (33-51);
 * the API suite (wo-009-collections.e2e) proves the authorization and eligibility behind them.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const PHONE = '+251911234567';
const PRODUCT_ID = '0b6f1a3e-2222-4222-8222-222222222222';
const SCENE = publicScene(1);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PRODUCT_TARGET = { type: 'PRODUCT_POST' as const, ref: PRODUCT_ID };
const SCENE_TARGET = { type: 'SCENE_POST' as const, ref: SCENE.public_ref };

let api: ReturnType<typeof installFakeApi>;
let fc: ReturnType<typeof installFakeCollections>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });
const bottomTab = (name: string) => screen.getByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name });
const adds = () => api.calls.filter((c) => c.method === 'POST' && /^\/v1\/collections\/[^/]+\/items$/.test(c.path));
const removes = () => api.calls.filter((c) => c.method === 'DELETE' && /\/items\//.test(c.path));
const saveButton = () => screen.findByRole('button', { name: en['buyer.save.save'] });
const savedButton = () => screen.findByRole('button', { name: en['buyer.save.saved'] });
const held = () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
};

beforeEach(() => {
  jest.clearAllMocks();
  resetSecureStore();
  api = installFakeApi();
  fc = installFakeCollections(api, {
    products: { [PRODUCT_ID]: shopProduct('basket', 'Woven basket', 'seller-1', { id: PRODUCT_ID }) },
    scenes: {
      [SCENE.public_ref]: {
        public_ref: SCENE.public_ref,
        caption: 'Morning baskets',
        caption_truncated: false,
        image: { thumb_key: SCENE.image.thumb_key, card_key: SCENE.image.card_key },
        seller: SCENE.seller,
      },
    },
  });
  api.on('GET /v1/storefronts/seller-1/products/basket', () => ({ status: 200, body: storefrontProduct('basket', 'Woven basket') }));
  api.on(`GET /v1/scene-posts/${SCENE.public_ref}`, () => ({ status: 200, body: SCENE }));
  useUiStore.setState({ activeMode: null, themePreference: 'system', locale: 'en', upgradeNoticeDismissed: false, pendingSave: null });
});

afterEach(() => {
  // 51: saving never touches commerce.
  expect(api.calls.filter((c) => /cart|order|checkout|payment|reservation/i.test(c.path))).toEqual([]);
});

describe('the Saved tab', () => {
  it('33, 43. a signed-in Buyer sees Saved first, their own Collections, and Recent Saves; a Product opens', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET);
    fc.saveElsewhere(SCENE_TARGET, outfit);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });

    expect(await screen.findByText(en['buyer.saved.private'])).toBeOnTheScreen();
    const rows = await screen.findAllByTestId(/collection-row-/);
    expect(rows.map((r) => r.props.testID)).toEqual(['collection-row-default', 'collection-row-named']);
    expect(screen.getByRole('button', { name: `Saved, Products: 1, Scenes: 0` })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: `Outfit ideas, Products: 0, Scenes: 1` })).toBeOnTheScreen();
    expect(await screen.findByText('Woven basket')).toBeOnTheScreen();
    expect(screen.getByText('Morning baskets')).toBeOnTheScreen();
    // No owner, account or device id is ever sent: the bearer decides.
    expect(api.callsTo('GET /v1/collections')[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    expect(api.callsTo('GET /v1/collections/saves')[0]?.query).toEqual({ type: 'ALL', limit: '30' });

    await fireEvent.press(screen.getByRole('button', { name: /^Woven basket/ }));
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
  });

  it('44. the Scenes tab lists saved Scenes only; a Scene opens Explore the Scene', async () => {
    signedIn();
    fc.saveElsewhere(PRODUCT_TARGET);
    fc.saveElsewhere(SCENE_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await screen.findByText('Woven basket');
    await fireEvent.press(screen.getByTestId('filter-tab-SCENE_POST'));
    await waitFor(() => expect(screen.queryByText('Woven basket')).not.toBeOnTheScreen());
    expect(api.callsTo('GET /v1/collections/saves').at(-1)?.query.type).toBe('SCENE_POST');
    await fireEvent.press(await screen.findByTestId('search-scene-tile'));
    await waitFor(() => expect(screen).toHavePathname(`/scenes/${SCENE.public_ref}`));
  });

  it('34. a guest is asked to sign in; nothing private is requested', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    expect(api.calls.filter((c) => c.path.startsWith('/v1/collections'))).toEqual([]);
  });

  it('empty and unavailable: a hidden target is one neutral sentence, with Remove', async () => {
    signedIn();
    fc.saveElsewhere(PRODUCT_TARGET);
    fc.hide(PRODUCT_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Saved, / }));
    expect(await screen.findByText(en['buyer.saved.product_unavailable'])).toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.remove_unavailable'] }));
    expect(await screen.findByText(en['buyer.collection.empty'])).toBeOnTheScreen();
    expect(removes()).toHaveLength(1);
    // Saved, the DEFAULT, offers neither Rename nor Delete.
    expect(screen.queryByRole('button', { name: en['buyer.collection.rename'] })).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: en['buyer.collection.delete'] })).not.toBeOnTheScreen();
  });

  it('49. a failed read says why and recovers on Try again', async () => {
    signedIn();
    fc.saveElsewhere(PRODUCT_TARGET);
    let offline = true;
    fc.intercept('saves', () => (offline ? 'offline' : undefined));
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByText(en['common.offline'], {}, { timeout: 10_000 })).toBeOnTheScreen();
    offline = false;
    await fireEvent.press(screen.getByRole('button', { name: en['common.retry'] }));
    expect(await screen.findByText('Woven basket')).toBeOnTheScreen();
  });
});

describe('Collection management', () => {
  it('40. creates a named Collection: the name is checked, the request keyed, the list read again', async () => {
    signedIn();
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.saved.new'] }));
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.saved.create'] }));
    expect(await screen.findByText(en['buyer.saved.name_invalid'])).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/collections')).toHaveLength(0);
    await fireEvent.changeText(screen.getByLabelText(en['buyer.saved.name']), '  Gifts   for  mum ');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.saved.create'] }));
    expect(await screen.findByRole('button', { name: 'Gifts for mum, Products: 0, Scenes: 0' })).toBeOnTheScreen();
    const [create] = api.callsTo('POST /v1/collections');
    expect(create?.body).toEqual({ name: 'Gifts for mum' });
    expect(create?.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('41, 42. renames and deletes a named Collection, deletion only after confirmation', async () => {
    signedIn();
    const ref = fc.named('Old name');
    const alert = jest.spyOn(Alert, 'alert');
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await fireEvent.press(await screen.findByRole('button', { name: /^Old name, / }));
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.rename'] }));
    await fireEvent.changeText(screen.getByLabelText(en['buyer.saved.name']), 'New name');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.save_name'] }));
    expect(await screen.findByRole('header', { name: 'New name' })).toBeOnTheScreen();
    expect(api.calls.find((c) => c.method === 'PATCH')).toMatchObject({ path: `/v1/collections/${ref}`, body: { name: 'New name' } });

    await fireEvent.press(screen.getByRole('button', { name: en['buyer.collection.delete'] }));
    expect(alert).toHaveBeenCalledWith('Delete New name?', en['buyer.collection.delete_body'], expect.any(Array));
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0); // nothing until confirmed
    const buttons = alert.mock.calls[0]![2]!;
    expect(buttons[0]).toMatchObject({ text: en['buyer.saved.cancel'], style: 'cancel' });
    await act(async () => {
      await buttons[1]!.onPress!();
    });
    expect(api.calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual([`/v1/collections/${ref}`]);
    await waitFor(() => expect(screen).toHavePathname('/saved'));
    await waitFor(() => expect(screen.queryByRole('button', { name: /^New name, / })).not.toBeOnTheScreen());
  });
});

describe('one-tap Save', () => {
  it('35, 36. saves a Product into Saved only once the server accepts it, with Scene provenance; Saved removes it', async () => {
    signedIn();
    const gate = held();
    fc.intercept('add', async () => {
      await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: `/product/seller-1/basket?from=${SCENE.public_ref}` });
    await fireEvent.press(await saveButton());
    // In flight: still "Save", and disabled -- never drawn as saved before the answer.
    await waitFor(() => expect(adds()).toHaveLength(1));
    await waitFor(() => expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeDisabled());
    await act(async () => gate.release());
    expect(await savedButton()).toBeOnTheScreen();
    expect(adds()[0]).toMatchObject({
      path: `/v1/collections/${DEFAULT_COLLECTION_REF}/items`,
      body: { target: PRODUCT_TARGET, source_surface: 'PRODUCT_DETAIL', context: { scene_ref: SCENE.public_ref } },
    });
    expect(adds()[0]?.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);

    await fireEvent.press(await savedButton());
    expect(await saveButton()).toBeOnTheScreen();
    expect(removes()[0]?.path).toMatch(new RegExp(`^/v1/collections/${DEFAULT_COLLECTION_REF}/items/`));
    expect(fc.items).toHaveLength(0);
  });

  it('a refused Save stays unsaved and says so; the next tap saves once (the membership is idempotent)', async () => {
    signedIn();
    let answer: Reply | undefined = 'offline';
    fc.intercept('add', () => answer);
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await fireEvent.press(await saveButton());
    expect(await screen.findByText(/^Saved was not changed\./, {}, { timeout: 10_000 })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['buyer.save.save'] })).toBeOnTheScreen();
    answer = undefined;
    await fireEvent.press(await saveButton());
    expect(await savedButton()).toBeOnTheScreen();
    // Each tap is its own key (review D3); the server keeps one membership whatever was lost.
    expect(new Set(adds().map((c) => c.headers['Idempotency-Key'])).size).toBe(adds().length);
    expect(fc.items).toHaveLength(1);
  });

  it('37, 38. saves and removes a whole Scene from Explore the Scene', async () => {
    signedIn();
    await renderRouter(APP_DIR, { initialUrl: `/scenes/${SCENE.public_ref}` });
    await fireEvent.press(await saveButton());
    expect(await savedButton()).toBeOnTheScreen();
    expect(adds()[0]?.body).toEqual({ target: SCENE_TARGET, source_surface: 'SCENE_EXPLORER' });
    await fireEvent.press(await savedButton());
    expect(await saveButton()).toBeOnTheScreen();
    expect(removes()).toHaveLength(1);
  });

  it('shows what another device saved: the state is the server\'s, read on opening', async () => {
    signedIn();
    fc.saveElsewhere(PRODUCT_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    expect(await savedButton()).toBeOnTheScreen();
    expect(api.callsTo('POST /v1/collections/saved-state:batch')[0]?.body).toEqual({ targets: [PRODUCT_TARGET] });
  });

  it('39. Add to collection: ticks follow the server; a target sits in several Collections independently', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.save.add'] }));
    await waitFor(() => expect(screen).toHavePathname('/save-to'));
    const box = (name: string) => screen.findByRole('checkbox', { name });
    expect(await box('Saved')).not.toBeChecked();
    await fireEvent.press(await box('Outfit ideas'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Outfit ideas' })).toBeChecked());
    await fireEvent.press(await box('Saved'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Saved' })).toBeChecked());
    expect(adds().map((c) => c.path)).toEqual([`/v1/collections/${outfit}/items`, `/v1/collections/${DEFAULT_COLLECTION_REF}/items`]);
    await fireEvent.press(await box('Outfit ideas'));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Outfit ideas' })).not.toBeChecked());
    expect(fc.items.map((i) => i.collection)).toEqual([DEFAULT_COLLECTION_REF]);
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.save.done'] }));
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    expect(await savedButton()).toBeOnTheScreen(); // back on the Product, read again
  });
});

describe('a guest Save', () => {
  const signInFromPrompt = async () => {
    await fireEvent.press(await saveButton());
    expect(await screen.findByText(en['buyer.save.sign_in'])).toBeOnTheScreen();
    expect(adds()).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.sign_in'] }));
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
  };
  const completeSignIn = async () => {
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
  };

  it('45. explains, signs in, returns to the Product, and finishes the Save in the new session', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await signInFromPrompt();
    expect(screen).toHaveSearchParams(expect.objectContaining({ returnTo: '/product/seller-1/basket', save: expect.stringMatching(UUID) }));
    await completeSignIn();
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    expect(await savedButton()).toBeOnTheScreen();
    expect(adds()).toHaveLength(1);
    expect(adds()[0]?.headers.Authorization).toBe(`Bearer ${GOOD_TOKEN}`);
    expect(adds()[0]?.body).toMatchObject({ target: PRODUCT_TARGET, source_surface: 'PRODUCT_DETAIL' });
    expect(useUiStore.getState().pendingSave).toBeNull();
  });

  it('46. a cancelled sign-in saves nothing, and a later sign-in elsewhere does not finish it', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await signInFromPrompt();
    await act(() => router.back());
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    expect(adds()).toHaveLength(0);
    // Leave the Product (its prompt is gone with it) and sign in from Orders instead.
    await act(() => router.back());
    await fireEvent.press(await screen.findByRole(Platform.OS === 'ios' ? 'button' : 'tab', { name: en['buyer.tab.orders'] }));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await completeSignIn();
    await screen.findByText(en['buyer.orders.coming']);
    await act(() => Promise.resolve());
    expect(adds()).toHaveLength(0);
  });

  it('a link cannot save: an unknown continuation nonce does nothing after sign-in', async () => {
    useUiStore.setState({ pendingSave: { nonce: '11111111-1111-4111-8111-111111111111', target: PRODUCT_TARGET, surface: 'PRODUCT_DETAIL', sceneRef: null } });
    await renderRouter(APP_DIR, {
      initialUrl: '/auth/sign-in?returnTo=/product/seller-1/basket&save=22222222-2222-4222-8222-222222222222',
    });
    await completeSignIn();
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    expect(await saveButton()).toBeOnTheScreen();
    expect(adds()).toHaveLength(0);
  });

  it('an unsafe returnTo still becomes You', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/auth/sign-in?returnTo=https://evil.example/product/a/b' });
    await completeSignIn();
    await waitFor(() => expect(screen).toHavePathname('/account'));
  });
});

describe('the guest Save continuation is bound to the session that signed in (WO-009A S9)', () => {
  // A second Account: the first sign-in answers A's credential, the next one B's.
  const TOKEN_B = 'Fake_credential_for_tests_B123456789abcdefg';
  const twoAccounts = () => {
    let verified = 0;
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.code === SIGN_IN_CODE
        ? {
            status: 200,
            body: {
              account_id: verified === 0 ? '0b6f1a3e-1111-4111-8111-111111111111' : '0b6f1a3e-1111-4111-8111-11111111111b',
              audience: 'MOBILE',
              roles: [],
              expires_at: '2026-12-09T12:00:00.000Z',
              token: verified++ === 0 ? GOOD_TOKEN : TOKEN_B,
            },
          }
        : problem(401, 'OTP_INVALID', 'auth'),
    );
    api.on('GET /v1/bootstrap', (call) => ({
      status: 200,
      body: bootstrapBody(call.headers.Authorization ? { account_context: SIGNED_IN_CONTEXT } : {}),
    }));
  };
  const signIn = async () => {
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
  };
  const startGuestSave = async () => {
    await renderRouter(APP_DIR, { initialUrl: '/product/seller-1/basket' });
    await fireEvent.press(await saveButton());
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await waitFor(() => expect(screen).toHavePathname('/auth/sign-in'));
  };
  const asA = (c: { headers: Record<string, string> }) => c.headers.Authorization === `Bearer ${GOOD_TOKEN}`;
  const stateCalls = () => api.callsTo('POST /v1/collections/saved-state:batch');

  it('25, 26. A delayed answer for Account A sends nothing after sign-out and Account B signing in', async () => {
    twoAccounts();
    const gate = held();
    fc.intercept('state', async (call) => {
      if (asA(call)) await gate.gate; // every answer for A lands late
      return undefined;
    });
    await startGuestSave();
    await signIn();
    await waitFor(() => expect(screen).toHavePathname('/product/seller-1/basket'));
    await waitFor(() => expect(stateCalls().filter(asA).length).toBeGreaterThanOrEqual(1));

    // A signs out; B signs in on the same device; only then does A's answer arrive.
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await signIn();
    await waitFor(() => expect(screen).toHavePathname('/account'));
    await act(async () => gate.release());
    // Let every late answer, and anything it would trigger, run to completion.
    for (let i = 0; i < 20; i++) await act(() => Promise.resolve());

    // No membership request at all: not for B, and not for A after A left.
    expect(adds()).toEqual([]);
    expect(fc.items).toEqual([]);
    expect(useUiStore.getState().pendingSave).toBeNull();
  });

  it('24. an expired session stops the continuation: signed out, nothing saved', async () => {
    twoAccounts();
    fc.intercept('state', (call) => (asA(call) ? problem(401, 'SESSION_EXPIRED', 'auth') : undefined));
    await startGuestSave();
    await signIn();
    await act(() => router.navigate('/saved'));
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    expect(adds()).toEqual([]);
  });

  it('22. a cancelled sign-in drops the armed Save at the next sign-in, whatever screen it starts from', async () => {
    twoAccounts();
    await startGuestSave();
    expect(useUiStore.getState().pendingSave).not.toBeNull();
    await act(() => router.back());
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await signIn();
    await waitFor(() => expect(screen).toHavePathname('/account'));
    expect(useUiStore.getState().pendingSave).toBeNull();
    expect(adds()).toEqual([]);
  });
});

describe('Collections screens are bound to the session that started each request (WO-010, ON-112)', () => {
  // Account A is restored from storage; the next sign-in on this device is Account B.
  const TOKEN_B = 'Fake_credential_for_tests_B123456789abcdefg';
  const asA = (c: { headers: Record<string, string> }) => c.headers.Authorization === `Bearer ${GOOD_TOKEN}`;
  const asB = (c: { headers: Record<string, string> }) => c.headers.Authorization === `Bearer ${TOKEN_B}`;
  const privateCalls = () => api.calls.filter((c) => c.path.startsWith('/v1/collections'));
  // Screens still open after the switch read B's own state (the server answers a foreign ref 404); never a write.
  const writesAsB = () => privateCalls().filter((c) => asB(c) && c.method !== 'GET' && c.path !== '/v1/collections/saved-state:batch');
  const accountB = () => {
    api.on('POST /v1/auth/otp/verify', (call) =>
      call.body?.code === SIGN_IN_CODE
        ? { status: 200, body: { account_id: '0b6f1a3e-1111-4111-8111-11111111111b', audience: 'MOBILE', roles: [], expires_at: '2026-12-09T12:00:00.000Z', token: TOKEN_B } }
        : problem(401, 'OTP_INVALID', 'auth'),
    );
    api.on('GET /v1/bootstrap', (call) => ({ status: 200, body: bootstrapBody(call.headers.Authorization ? { account_context: SIGNED_IN_CONTEXT } : {}) }));
    // B has only its own empty Saved.
    fc.intercept('collections', (call) =>
      asB(call)
        ? { status: 200, body: { default_collection_ref: '0c000000-0000-4000-8000-0000000000bb', data: [{ ref: '0c000000-0000-4000-8000-0000000000bb', kind: 'DEFAULT', name: null, product_count: 0, scene_count: 0, created_at: '2026-11-11T08:00:00.000000Z', updated_at: '2026-11-11T08:00:00.000000Z' }], next_cursor: null } }
        : undefined,
    );
  };
  const switchToB = async () => {
    await act(() => router.navigate('/account'));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await fireEvent.press(await screen.findByRole('button', { name: en['auth.sign_in'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.phone.label']), PHONE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.send_code'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['auth.code.label']), SIGN_IN_CODE);
    await fireEvent.press(screen.getByRole('button', { name: en['auth.verify'] }));
    await waitFor(() => expect(screen).toHavePathname('/account'));
  };
  const flush = async () => {
    for (let i = 0; i < 20; i++) await act(() => Promise.resolve());
  };

  it('the picker: a tick sent for Account A is followed by nothing for A or B after the switch', async () => {
    signedIn();
    accountB();
    fc.named('Outfit ideas');
    const gate = held();
    fc.intercept('add', async (call) => {
      if (asA(call)) await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: `/save-to?type=PRODUCT_POST&ref=${PRODUCT_ID}&surface=PRODUCT_DETAIL` });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Outfit ideas' }));
    await waitFor(() => expect(adds()).toHaveLength(1));
    await switchToB();
    const before = privateCalls().length;
    await act(async () => gate.release());
    await flush();
    // The tick itself was A's, sent in A's session; its follow-up reads are never sent afterwards.
    expect(privateCalls().slice(before)).toEqual([]);
    expect(writesAsB()).toEqual([]);
    expect(adds().every(asA)).toBe(true);
  });

  it('the Collection screen: a Remove sent for Account A is followed by nothing after the switch', async () => {
    signedIn();
    accountB();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    const gate = held();
    fc.intercept('remove', async (call) => {
      if (asA(call)) await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Woven basket from this collection' }));
    await waitFor(() => expect(removes()).toHaveLength(1));
    await switchToB();
    const before = privateCalls().length;
    await act(async () => gate.release());
    await flush();
    expect(privateCalls().slice(before)).toEqual([]);
    expect(writesAsB()).toEqual([]);
  });

  it('the Saved tab: a delayed read for Account A never shows after Account B signs in', async () => {
    signedIn();
    accountB();
    fc.named('Private list');
    const gate = held();
    fc.intercept('collections', async (call) => {
      if (asA(call)) {
        await gate.gate;
        return undefined;
      }
      return { status: 200, body: { default_collection_ref: '0c000000-0000-4000-8000-0000000000bb', data: [{ ref: '0c000000-0000-4000-8000-0000000000bb', kind: 'DEFAULT', name: null, product_count: 0, scene_count: 0, created_at: '2026-11-11T08:00:00.000000Z', updated_at: '2026-11-11T08:00:00.000000Z' }], next_cursor: null } };
    });
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    await waitFor(() => expect(api.callsTo('GET /v1/collections').filter(asA)).toHaveLength(1));
    await switchToB();
    await act(() => router.navigate('/saved'));
    expect(await screen.findByRole('button', { name: 'Saved, Products: 0, Scenes: 0' })).toBeOnTheScreen();
    await act(async () => gate.release());
    await flush();
    expect(screen.queryByText('Private list')).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Private list, / })).not.toBeOnTheScreen();
  });

  it('without a session the Collection screen and the picker ask for a sign-in and read nothing (review R1)', async () => {
    const outfit = fc.named('Outfit ideas');
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en['auth.sign_in'] })).toBeOnTheScreen();
    await act(() => router.navigate(`/save-to?type=PRODUCT_POST&ref=${PRODUCT_ID}&surface=PRODUCT_DETAIL`));
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    expect(privateCalls()).toEqual([]);
  });

  it('an expired session fails safely: a refused tick signs out and sends nothing more', async () => {
    signedIn();
    fc.named('Outfit ideas');
    fc.intercept('add', () => problem(401, 'SESSION_EXPIRED', 'auth'));
    await renderRouter(APP_DIR, { initialUrl: `/save-to?type=PRODUCT_POST&ref=${PRODUCT_ID}&surface=PRODUCT_DETAIL` });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Outfit ideas' }));
    await waitFor(() => expect(adds()).toHaveLength(1));
    await flush();
    const after = privateCalls().length;
    // The picker itself now asks for a sign-in (never a load that cannot finish).
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    await act(() => router.navigate('/saved'));
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    expect(privateCalls().length).toBe(after);
  });
});

describe('sign-out', () => {
  it('47, 48. clears private Collections at once, and a late answer from the old session shows nothing', async () => {
    signedIn();
    fc.named('Private list');
    fc.saveElsewhere(PRODUCT_TARGET);
    await renderRouter(APP_DIR, { initialUrl: '/saved' });
    expect(await screen.findByRole('button', { name: /^Private list, / })).toBeOnTheScreen();

    // The next read of Saved is held while the Buyer signs out.
    const gate = held();
    fc.intercept('saves', async () => {
      await gate.gate;
      return undefined;
    });
    await fireEvent.press(bottomTab(en['buyer.tab.you']));
    await fireEvent.press(await screen.findByRole('button', { name: en['common.signOut'] }));
    await fireEvent.press(bottomTab(en['buyer.tab.saved']));
    expect(await screen.findByText(en['buyer.saved.signed_out'])).toBeOnTheScreen();
    await act(async () => gate.release());
    expect(screen.queryByText('Private list')).not.toBeOnTheScreen();
    expect(screen.queryByText('Woven basket')).not.toBeOnTheScreen();
  });
});

describe('WO-018 (A-006): one Collection change at a time, announced', () => {
  const PICKER = `/save-to?type=PRODUCT_POST&ref=${PRODUCT_ID}&surface=PRODUCT_DETAIL`;
  const box = (name: string) => screen.getByRole('checkbox', { name });
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  });
  afterEach(() => announce.mockRestore());

  it('while a tick is in flight every box and New collection are disabled and that box is busy; then the result is spoken', async () => {
    signedIn();
    fc.named('Outfit ideas');
    fc.named('Gifts');
    const gate = held();
    fc.intercept('add', async () => {
      await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Outfit ideas' }));
    await waitFor(() => expect(adds()).toHaveLength(1));
    await waitFor(() => expect(box('Outfit ideas')).toBeBusy());
    // The server has not answered: the box still shows the server's state, not a guess.
    expect(box('Outfit ideas')).not.toBeChecked();
    expect(box('Outfit ideas')).toBeDisabled();
    for (const other of ['Saved', 'Gifts']) {
      expect(box(other)).toBeDisabled();
      expect(box(other)).not.toBeBusy();
    }
    expect(screen.getByRole('button', { name: en['buyer.saved.new'] })).toBeDisabled();
    // A tap on another box changes nothing while the first is in flight.
    await fireEvent.press(box('Gifts'));
    expect(adds()).toHaveLength(1);
    await act(async () => gate.release());
    await waitFor(() => expect(box('Outfit ideas')).toBeChecked());
    expect(announce).toHaveBeenCalledWith('Added to Outfit ideas.');
    for (const name of ['Saved', 'Outfit ideas', 'Gifts']) {
      expect(box(name)).toBeEnabled();
      expect(box(name)).not.toBeBusy();
    }
    expect(screen.getByRole('button', { name: en['buyer.saved.new'] })).toBeEnabled();
    // Removal: the same states, and the result named.
    await fireEvent.press(box('Outfit ideas'));
    await waitFor(() => expect(box('Outfit ideas')).not.toBeChecked());
    expect(announce).toHaveBeenCalledWith('Removed from Outfit ideas.');
    expect(fc.items).toEqual([]);
  });

  it('a refused tick changes nothing, says why, and every box is usable again', async () => {
    signedIn();
    fc.named('Gifts');
    let refuse = true;
    fc.intercept('add', () => (refuse ? ((refuse = false), problem(500, 'INTERNAL', 'request')) : undefined));
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Gifts' }));
    const alert = await screen.findByText(new RegExp(`^${en['buyer.save.failed']}`));
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(announce).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`^${en['buyer.save.failed']}`)));
    expect(announce).not.toHaveBeenCalledWith('Added to Gifts.');
    await waitFor(() => expect(box('Gifts')).toBeEnabled());
    expect(box('Gifts')).not.toBeChecked();
    expect(fc.items).toEqual([]);
    // The next tap is a new, ordinary change.
    await fireEvent.press(box('Gifts'));
    await waitFor(() => expect(box('Gifts')).toBeChecked());
    expect(announce).toHaveBeenCalledWith('Added to Gifts.');
  });

  it('a tick that times out says so, keeps the server state, and frees the boxes', async () => {
    signedIn();
    fc.named('Gifts');
    fc.intercept('add', () => 'hang');
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Gifts' }));
    await waitFor(() => expect(box('Gifts')).toBeBusy());
    // The client's 10 s timeout (renderRouter runs fake timers).
    await act(() => jest.advanceTimersByTimeAsync(11_000));
    expect(await screen.findByText(`${en['buyer.save.failed']} ${en['common.timeout']}`)).toBeOnTheScreen();
    await waitFor(() => expect(box('Gifts')).toBeEnabled());
    expect(box('Gifts')).not.toBeChecked();
  });

  it('the Collection screen, in Dark: while a Remove is in flight the other Removes, Rename and Delete are disabled; the result names the Collection', async () => {
    signedIn();
    useUiStore.setState({ themePreference: 'dark' });
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    fc.saveElsewhere(SCENE_TARGET, outfit);
    const gate = held();
    fc.intercept('remove', async () => {
      await gate.gate;
      return undefined;
    });
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    const removeBasket = () => screen.getByRole('button', { name: 'Remove Woven basket from this collection' });
    const removeScene = () => screen.getByRole('button', { name: 'Remove Morning baskets from this collection' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Remove Woven basket from this collection' }));
    await waitFor(() => expect(removeBasket()).toBeBusy());
    expect(removeBasket()).toBeDisabled();
    expect(removeScene()).toBeDisabled();
    expect(removeScene()).not.toBeBusy();
    expect(screen.getByRole('button', { name: en['buyer.collection.rename'] })).toBeDisabled();
    expect(screen.getByRole('button', { name: en['buyer.collection.delete'] })).toBeDisabled();
    await fireEvent.press(removeScene());
    expect(removes()).toHaveLength(1);
    await act(async () => gate.release());
    await waitFor(() => expect(announce).toHaveBeenCalledWith('Removed from Outfit ideas.'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove Woven basket from this collection' })).toBeNull());
    expect(removeScene()).toBeEnabled();
    expect(screen.getByRole('button', { name: en['buyer.collection.rename'] })).toBeEnabled();
    expect(screen.getByRole('button', { name: en['buyer.collection.delete'] })).toBeEnabled();
    expect(fc.items.map((i) => i.target)).toEqual([SCENE_TARGET]);
  });
});

describe('WO-018 security review fixes (F1-F3)', () => {
  const PICKER = `/save-to?type=PRODUCT_POST&ref=${PRODUCT_ID}&surface=PRODUCT_DETAIL`;
  const box = (name: string) => screen.getByRole('checkbox', { name });
  const deletes = () => api.calls.filter((c) => c.method === 'DELETE' && /^\/v1\/collections\/[^/]+$/.test(c.path));
  let announce: jest.SpyInstance;
  beforeEach(() => {
    announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  });
  afterEach(() => announce.mockRestore());

  it('F1. a session that ends during the re-read after a tick hears nothing about it', async () => {
    signedIn();
    fc.named('Outfit ideas');
    let added = false;
    fc.intercept('add', () => {
      added = true;
      return undefined;
    });
    // The re-read that follows the tick finds the session expired.
    fc.intercept('state', () => (added ? problem(401, 'SESSION_EXPIRED', 'auth') : undefined));
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('checkbox', { name: 'Outfit ideas' }));
    await waitFor(() => expect(adds()).toHaveLength(1));
    await waitFor(() => expect(memory.has(TOKEN_KEY)).toBe(false));
    for (let i = 0; i < 20; i++) await act(() => Promise.resolve());
    expect(announce).not.toHaveBeenCalledWith('Added to Outfit ideas.');
  });

  it('F2. while a New collection Create is in flight every box is disabled; the new Collection is then filled', async () => {
    signedIn();
    const gate = held();
    api.on('POST /v1/collections', async (call) => {
      await gate.gate;
      return { status: 201, body: { ref: fc.named(String(call.body?.name)) } };
    });
    await renderRouter(APP_DIR, { initialUrl: PICKER });
    await fireEvent.press(await screen.findByRole('button', { name: en['buyer.saved.new'] }));
    await fireEvent.changeText(await screen.findByLabelText(en['buyer.saved.name']), 'Gift ideas');
    await fireEvent.press(screen.getByRole('button', { name: en['buyer.saved.create'] }));
    await waitFor(() => expect(box('Saved')).toBeDisabled());
    await fireEvent.press(box('Saved'));
    expect(adds()).toHaveLength(0);
    await act(async () => gate.release());
    await waitFor(() => expect(box('Gift ideas')).toBeChecked());
    expect(announce).toHaveBeenCalledWith('Added to Gift ideas.');
    expect(box('Saved')).toBeEnabled();
    expect(box('Saved')).not.toBeChecked();
    expect(adds()).toHaveLength(1);
  });

  it('F3. a Delete confirmed while a Remove is in flight sends nothing', async () => {
    signedIn();
    const outfit = fc.named('Outfit ideas');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    const gate = held();
    fc.intercept('remove', async () => {
      await gate.gate;
      return undefined;
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    try {
      await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
      // The dialog opens with nothing in flight; a Remove starts while it is open.
      await fireEvent.press(await screen.findByRole('button', { name: en['buyer.collection.delete'] }));
      const confirm = alert.mock.calls[0]![2]!.find((b) => b.style === 'destructive')!;
      await fireEvent.press(screen.getByRole('button', { name: 'Remove Woven basket from this collection' }));
      await waitFor(() => expect(removes()).toHaveLength(1));
      await act(async () => {
        await confirm.onPress!();
      });
      expect(deletes()).toEqual([]);
      await act(async () => gate.release());
      await waitFor(() => expect(announce).toHaveBeenCalledWith('Removed from Outfit ideas.'));
      expect(deletes()).toEqual([]);
    } finally {
      alert.mockRestore();
    }
  });
});
