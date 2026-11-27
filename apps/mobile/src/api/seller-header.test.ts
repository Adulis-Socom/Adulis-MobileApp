import { productionSources } from '../testing/source-scan';
import { installFakeApi } from '../testing/fake-api';
import { createApiClient, type ApiClient } from './client';

/**
 * X-Adulis-Seller names the store a request speaks for. The server takes it as part of what a request
 * means: a retry that adds or drops it is another request, and on the two routes a Buyer and a store
 * share (a chat message, claims evidence) it chooses the side. So only the calls made for a store send
 * it, and no Buyer call does, even from an Account that also holds a store.
 */
const DEVICE = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const STORE = 'aaaaaaaa-0000-4000-8000-00000000000a';
const ID = '0b6f1a3e-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const KEY = '018f0000-0000-7000-8000-000000000000';
const TOKEN = 'Credential_for_tests_0123456789abcdef';

type Entry = { store: boolean; call: (api: ApiClient) => Promise<unknown> };
const buyer = (call: Entry['call']): Entry => ({ store: false, call });
const store = (call: Entry['call']): Entry => ({ store: true, call });

/** Every call of the client, and whether it is made for a store. A new call must be decided here. */
const CALLS: Record<keyof ApiClient, Entry> = {
  bootstrap: buyer((a) => a.bootstrap()),
  fyp: buyer((a) => a.fyp(null, false)),
  scene: buyer((a) => a.scene(ID)),
  product: buyer((a) => a.product('store-1', 'basket')),
  storefront: buyer((a) => a.storefront('store-1')),
  sellerScenes: buyer((a) => a.sellerScenes('store-1', null)),
  sellerProducts: buyer((a) => a.sellerProducts('store-1', null)),
  sellerReviews: buyer((a) => a.sellerReviews('store-1', null)),
  shopProducts: buyer((a) => a.shopProducts(null)),
  search: buyer((a) => a.search('basket', 'TOP', null)),
  categories: buyer((a) => a.categories()),
  collections: buyer((a) => a.collections(null)),
  createCollection: buyer((a) => a.createCollection('Gifts', KEY)),
  collection: buyer((a) => a.collection(ID, 'ALL', null)),
  renameCollection: buyer((a) => a.renameCollection(ID, 'Gifts')),
  deleteCollection: buyer((a) => a.deleteCollection(ID)),
  savedItems: buyer((a) => a.savedItems('ALL', null)),
  addToCollection: buyer((a) => a.addToCollection(ID, {} as never, KEY)),
  removeFromCollection: buyer((a) => a.removeFromCollection(ID, ID)),
  savedState: buyer((a) => a.savedState([])),
  registerDevice: buyer((a) => a.registerDevice(DEVICE, KEY)),
  requestOtp: buyer((a) => a.requestOtp('+251911234567', KEY)),
  resendOtp: buyer((a) => a.resendOtp('+251911234567')),
  verifyOtp: buyer((a) => a.verifyOtp({} as never, KEY)),
  sessions: buyer((a) => a.sessions()),
  requestDeletionOtp: buyer((a) => a.requestDeletionOtp('+251911234567', KEY)),
  verifyDeletionOtp: buyer((a) => a.verifyDeletionOtp('+251911234567', '123456')),
  deletionPreview: buyer((a) => a.deletionPreview(ID)),
  confirmDeletion: buyer((a) => a.confirmDeletion(ID, KEY)),
  notifications: buyer((a) => a.notifications(null)),
  sellerNotifications: store((a) => a.sellerNotifications(STORE, null)),
  markNotificationRead: buyer((a) => a.markNotificationRead(ID, KEY)),
  // The one store path that asks WHICH stores the Account holds, so it names none.
  sellerList: buyer((a) => a.sellerList()),
  sellerOverview: store((a) => a.sellerOverview(STORE)),
  sellerOrders: store((a) => a.sellerOrders(STORE, 'active', null)),
  sellerOrder: store((a) => a.sellerOrder(STORE, ID)),
  openConversation: buyer((a) => a.openConversation(ID, KEY)),
  conversations: buyer((a) => a.conversations(null)),
  conversationMessages: buyer((a) => a.conversationMessages(ID, null)),
  sendMessage: buyer((a) => a.sendMessage(ID, 'Is this in stock?', KEY)),
  escalateConversation: buyer((a) => a.escalateConversation(ID, KEY)),
  sellerConversations: store((a) => a.sellerConversations(STORE, null)),
  sellerConversationMessages: store((a) => a.sellerConversationMessages(STORE, ID, null)),
  sendSellerMessage: store((a) => a.sendSellerMessage(STORE, ID, 'Yes, two left.', KEY)),
  logout: buyer((a) => a.logout(TOKEN)),
};

const names = Object.keys(CALLS) as Array<keyof ApiClient>;
const storeCalls = names.filter((name) => CALLS[name].store);
const buyerCalls = names.filter((name) => !CALLS[name].store);

/** What one call of the client puts on the wire: every request it made, recorded by the fake API. */
async function requestsOf(name: keyof ApiClient) {
  const fake = installFakeApi();
  const api = createApiClient({
    deviceId: async () => DEVICE,
    token: () => TOKEN,
    onSessionEnded: jest.fn(),
  });
  // The fake answers 404 to a route nobody set up; only what was sent matters here.
  await CALLS[name].call(api).catch(() => undefined);
  return fake.calls;
}

describe('the X-Adulis-Seller header on the wire', () => {
  it('is decided for every call of the client, and for no call that does not exist', () => {
    const api = createApiClient({
      deviceId: async () => DEVICE,
      token: () => TOKEN,
      onSessionEnded: jest.fn(),
    });
    expect(Object.keys(api).sort()).toEqual([...names].sort());
    expect(storeCalls).toEqual([
      'sellerNotifications',
      'sellerOverview',
      'sellerOrders',
      'sellerOrder',
      'sellerConversations',
      'sellerConversationMessages',
      'sendSellerMessage',
    ]);
  });

  it.each(buyerCalls)('%s sends no store header and asks for no store scope', async (name) => {
    const calls = await requestsOf(name);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(call.headers['X-Adulis-Seller']).toBeUndefined();
      expect(call.query.as).not.toBe('seller');
      expect(call.query.seller_id).toBeUndefined();
    }
  });

  it.each(storeCalls)('%s names the one store it was made for, on every request', async (name) => {
    const calls = await requestsOf(name);
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call.headers['X-Adulis-Seller']).toBe(STORE);
  });
});

describe('where the header is set and who may make a store call', () => {
  const sources = productionSources('.');

  it('is attached in one place, the client, and nothing else reaches the network', () => {
    const named = sources
      .filter((s) => /['"`]x-adulis-seller['"`]/i.test(s.text))
      .map((s) => s.file);
    expect(named).toEqual(['api/client.ts']);
    const direct = sources.filter((s) => /\bfetch\(/.test(s.text)).map((s) => s.file);
    expect(direct).toEqual(['api/client.ts']);
  });

  it('is asked for only by the Seller Companion and the two scope-switching hooks it shares with the Buyer', () => {
    const callers = sources
      .filter(
        (s) =>
          s.file !== 'api/client.ts' &&
          storeCalls.some((name) => new RegExp(`\\b${name}\\b`).test(s.text)),
      )
      .map((s) => s.file)
      .sort();
    expect(callers.filter((file) => !file.startsWith('seller/'))).toEqual([
      'buyer/chat.ts',
      'buyer/notifications.ts',
    ]);
    expect(callers.some((file) => file.startsWith('seller/'))).toBe(true);
  });
});
