import { useUiStore } from '../state/ui-store';
import { installFakeApi, publicScene, shopProduct, storefrontProduct } from './fake-api';
import { installFakeCollections } from './fake-collections';

/** One Product and one Scene on the in-memory Collections server, with their public reads, for the Saved tests. */
export const PRODUCT_ID = '0b6f1a3e-2222-4222-8222-222222222222';
export const SCENE = publicScene(1);
export const PRODUCT_TARGET = { type: 'PRODUCT_POST' as const, ref: PRODUCT_ID };
export const SCENE_TARGET = { type: 'SCENE_POST' as const, ref: SCENE.public_ref };
export const PICKER = `/save-to?type=PRODUCT_POST&ref=${PRODUCT_ID}&surface=PRODUCT_DETAIL`;

export function installSavedApp() {
  const api = installFakeApi();
  const fc = installFakeCollections(api, {
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
  return { api, fc };
}

/** A reply the test releases when it chooses: a request that is still in flight. */
export function held() {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  return { gate, release };
}
