import { en } from '@adulis/locale/mobile';
import { act, renderRouter, screen } from 'expo-router/testing-library';

import { useUiStore } from '../state/ui-store';
import { GOOD_TOKEN, installFakeApi, publicScene, shopProduct, storefrontProduct } from '../testing/fake-api';
import { installFakeCollections } from '../testing/fake-collections';
import { TOKEN_KEY, resetSecureStore } from '../testing/secure-store-mock';
import { accountB, afterSignOut, asB, flush, naming, open, switchToB } from '../testing/saved-accounts';

/**
 * Private Saved and Collection data across sessions: what a screen kept in the stack, a delayed answer, a
 * dialog left open, an ended session or a changed Collection may show or ask for after the Account changes.
 * Every test runs on the real route tree against the in-memory Collections server, which answers the first
 * Account's Collections to anyone: a request under another credential is visible, never assumed refused.
 */
const APP_DIR = 'src/app';
jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
jest.setTimeout(60_000);

const PRODUCT_ID = '0b6f1a3e-2222-4222-8222-222222222222';
const SCENE = publicScene(1);
const PRODUCT_TARGET = { type: 'PRODUCT_POST' as const, ref: PRODUCT_ID };
const SCENE_TARGET = { type: 'SCENE_POST' as const, ref: SCENE.public_ref };

let api: ReturnType<typeof installFakeApi>;
let fc: ReturnType<typeof installFakeCollections>;
const signedIn = () => resetSecureStore({ [TOKEN_KEY]: GOOD_TOKEN });

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

describe('a Collection kept in the stack when the Account changes', () => {
  it('asks for nothing under the second Account, draws nothing of the first, and returning to it lands on the second Account\'s Saved', async () => {
    signedIn();
    accountB(api, fc);
    const outfit = fc.named('First Account private list');
    fc.saveElsewhere(PRODUCT_TARGET, outfit);
    await renderRouter(APP_DIR, { initialUrl: `/collections/${outfit}` });
    expect(await screen.findByRole('header', { name: 'First Account private list' })).toBeOnTheScreen();
    expect(await screen.findByText('Woven basket')).toBeOnTheScreen();

    await switchToB();
    await flush();
    const later = afterSignOut(api);
    expect(later.filter(naming(outfit))).toEqual([]);
    expect(later.filter((c) => c.headers.Authorization !== undefined).every(asB)).toBe(true);
    expect(screen.queryByText('First Account private list')).toBeNull();
    expect(screen.queryByText('Woven basket')).toBeNull();

    // Back to the retained Collection: it leaves for the second Account's Saved and shows only that.
    await open(`/collections/${outfit}`);
    expect(await screen.findByRole('button', { name: 'Saved, Products: 0, Scenes: 0' })).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTimeAsync(1000));
    expect(screen.queryByText('First Account private list')).toBeNull();
    expect(afterSignOut(api).filter(naming(outfit))).toEqual([]);
    expect(en['buyer.collection.gone']).toBeTruthy();
  });
});
