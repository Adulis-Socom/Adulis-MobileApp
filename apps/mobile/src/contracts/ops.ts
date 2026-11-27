// The gap list as data (GOV-06 S2), in the spirit of the archived REAL_ADAPTER_GAPS: every operation is declared once, with
// its gap id, who may call it and how the fixture treats it. A Record over MobileOpId makes a missing entry a compile error.
// PROVISIONAL: not a final API contract.
import type { MobileOpId } from './gap-mob-session';

/** PUBLIC never carries the bearer; OPTIONAL_AUTH carries it when there is one; AUTHENTICATED needs one. */
export type OpAccess = 'PUBLIC' | 'OPTIONAL_AUTH' | 'AUTHENTICATED';
export interface OpSpec {
  readonly gap: 'GAP-L2-01' | 'GAP-L2-02' | 'SC-BE-05S';
  readonly access: OpAccess;
  /** Input paths that hold IDENTIFIERS (refused by the live guard when reserved). Free text is never listed. */
  readonly refFields: readonly (readonly string[])[];
  /** BLOCKED is the fixture's deny-list backstop. */
  readonly fixture: 'SERVED_READ' | 'SERVED_WRITE' | 'BLOCKED';
  /** The named work order that authorises a fixture write (GOV-06 S2 Writes). */
  readonly writeAuthorisedBy: string | null;
}

const read = (access: OpAccess, refFields: readonly (readonly string[])[] = [], gap: OpSpec['gap'] = 'GAP-L2-02'): OpSpec => ({ gap, access, refFields, fixture: 'SERVED_READ', writeAuthorisedBy: null });

const write = (refFields: readonly (readonly string[])[]): OpSpec => ({ gap: 'GAP-L2-02', access: 'AUTHENTICATED', refFields, fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-03' });

export const OP_SPECS: Readonly<Record<MobileOpId, OpSpec>> = {
  // MOB-FE-01 session, device and bootstrap (GAP-L2-01)
  'device.register': { gap: 'GAP-L2-01', access: 'PUBLIC', refFields: [['deviceId']], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
  'bootstrap.get': read('OPTIONAL_AUTH', [], 'GAP-L2-01'),
  'session.requestCode': { gap: 'GAP-L2-01', access: 'PUBLIC', refFields: [], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
  'session.verifyCode': { gap: 'GAP-L2-01', access: 'PUBLIC', refFields: [['challengeRef']], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
  'session.signOut': { gap: 'GAP-L2-01', access: 'AUTHENTICATED', refFields: [], fixture: 'SERVED_WRITE', writeAuthorisedBy: 'MOB-FE-01' },
  // MOB-FE-02 discovery reads (GAP-L2-02): reads only, so no fixture write is authorised here
  'home.channels.get': read('OPTIONAL_AUTH'),
  'feed.forYou.page': read('OPTIONAL_AUTH'),
  'feed.following.page': read('AUTHENTICATED'),
  'scene.get': read('PUBLIC', [['sceneRef']]),
  'search.query': read('PUBLIC'),
  'shop.products.page': read('PUBLIC'),
  'categories.list': read('PUBLIC'),
  'product.get': read('PUBLIC', [['productRef']]),
  'seller.get': read('PUBLIC', [['sellerRef']]),
  'seller.scenes.page': read('PUBLIC', [['sellerRef']]),
  'seller.products.page': read('PUBLIC', [['sellerRef']]),
  // MOB-FE-02S Buyer Stories (SC-BE-05S is the authoritative owner; its live implementation is not a prerequisite for fixtures)
  'stories.row.get': read('PUBLIC', [], 'SC-BE-05S'),
  'stories.group.get': read('PUBLIC', [['sellerRef']], 'SC-BE-05S'),
  // MOB-FE-03 engagement (GAP-L2-02): Account-bound; the writes carry the desired state and are authorised for the fixture by this order
  'engagement.state.get': read('AUTHENTICATED', [['sceneRefs'], ['productRefs'], ['sellerRefs']]),
  'saved.list.get': read('AUTHENTICATED'),
  'collections.list.get': read('AUTHENTICATED'),
  'scene.like.set': write([['sceneRef']]),
  'scene.save.set': write([['sceneRef']]),
  'product.save.set': write([['productRef']]),
  'seller.follow.set': write([['sellerRef']]),
  'collection.create': write([]),
  'collection.get': read('AUTHENTICATED', [['collectionRef']]),
  'collection.rename': write([['collectionRef']]),
  'collection.delete': write([['collectionRef']]),
  'collection.item.add': write([['collectionRef'], ['item', 'ref']]),
  'collection.item.remove': write([['collectionRef'], ['item', 'ref']]),
};
