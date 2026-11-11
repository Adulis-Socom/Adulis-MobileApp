import { en } from '@adulis/locale/mobile';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert, Platform } from 'react-native';

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
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';

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
