// DEVELOPMENT ONLY. Per-Account engagement state for the fixture world: Likes and Saves on Scenes, Saves on Products, Follows on
// Sellers, and private Collections. State is in memory and keyed by persona, so two Accounts never see each other's, and it is
// lost on restart by design. Writes are idempotent by desired state. No count exists anywhere.
import type { Collection, CollectionItemRef, EngagementState } from '../contracts/gap-mob-engagement';

interface StoredCollection {
  readonly collectionRef: string;
  name: string;
  items: CollectionItemRef[];
}

interface Book {
  likedScenes: Set<string>;
  savedScenes: Set<string>;
  savedProducts: Set<string>;
  following: Set<string>;
  collections: StoredCollection[];
}

export function createEngagementWorld() {
  const books = new Map<string, Book>();
  const book = (personaKey: string): Book => {
    let found = books.get(personaKey);
    if (found === undefined) {
      // The owner persona already follows Bete (so Following has something to show); every other Account follows nobody.
      found = { likedScenes: new Set(), savedScenes: new Set(), savedProducts: new Set(), following: new Set(personaKey === 'owner' ? ['fx_seller_demo_bete'] : []), collections: [] };
      books.set(personaKey, found);
    }
    return found;
  };
  const flag = (set: Set<string>, ref: string, on: boolean) => void (on ? set.add(ref) : set.delete(ref));
  let sequence = 0;

  return {
    state(personaKey: string, input: { sceneRefs: readonly string[]; productRefs: readonly string[]; sellerRefs: readonly string[] }): EngagementState {
      const b = book(personaKey);
      return {
        scenes: Object.fromEntries(input.sceneRefs.map((ref) => [ref, { liked: b.likedScenes.has(ref), saved: b.savedScenes.has(ref) }])),
        products: Object.fromEntries(input.productRefs.map((ref) => [ref, { saved: b.savedProducts.has(ref) }])),
        sellers: Object.fromEntries(input.sellerRefs.map((ref) => [ref, { following: b.following.has(ref) }])),
      };
    },
    like(personaKey: string, sceneRef: string, liked: boolean) {
      const b = book(personaKey);
      flag(b.likedScenes, sceneRef, liked);
      return { liked: b.likedScenes.has(sceneRef), saved: b.savedScenes.has(sceneRef) };
    },
    saveScene(personaKey: string, sceneRef: string, saved: boolean) {
      const b = book(personaKey);
      flag(b.savedScenes, sceneRef, saved);
      return { liked: b.likedScenes.has(sceneRef), saved: b.savedScenes.has(sceneRef) };
    },
    saveProduct(personaKey: string, productRef: string, saved: boolean) {
      flag(book(personaKey).savedProducts, productRef, saved);
      return { saved: book(personaKey).savedProducts.has(productRef) };
    },
    follow(personaKey: string, sellerRef: string, following: boolean) {
      flag(book(personaKey).following, sellerRef, following);
      return { following: book(personaKey).following.has(sellerRef) };
    },
    saved: (personaKey: string) => ({ scenes: [...book(personaKey).savedScenes], products: [...book(personaKey).savedProducts] }),
    collections: (personaKey: string): readonly Collection[] => book(personaKey).collections.map(({ collectionRef, name }) => ({ collectionRef, name })),
    /** Another Account's Collection is not found, exactly like one that never existed. */
    collection: (personaKey: string, collectionRef: string): StoredCollection | undefined => book(personaKey).collections.find((c) => c.collectionRef === collectionRef),
    rename(personaKey: string, collectionRef: string, name: string): Collection | 'NOT_FOUND' | 'INVALID' {
      const found = book(personaKey).collections.find((c) => c.collectionRef === collectionRef);
      if (found === undefined) return 'NOT_FOUND';
      if (name.trim() === '') return 'INVALID';
      found.name = name.trim();
      return { collectionRef, name: found.name };
    },
    remove(personaKey: string, collectionRef: string): boolean {
      const b = book(personaKey);
      const before = b.collections.length;
      b.collections = b.collections.filter((c) => c.collectionRef !== collectionRef);
      return b.collections.length < before;
    },
    setMember(personaKey: string, collectionRef: string, item: CollectionItemRef, member: boolean): boolean {
      const found = book(personaKey).collections.find((c) => c.collectionRef === collectionRef);
      if (found === undefined) return false;
      found.items = found.items.filter((i) => !(i.kind === item.kind && i.ref === item.ref));
      if (member) found.items.push({ kind: item.kind, ref: item.ref });
      return true;
    },
    createCollection(personaKey: string, name: string): Collection | null {
      const trimmed = name.trim();
      if (trimmed === '') return null;
      sequence += 1;
      const collection = { collectionRef: `fx_collection_demo_${sequence}`, name: trimmed };
      book(personaKey).collections.push({ ...collection, items: [] });
      return collection;
    },
    isFollowing: (personaKey: string, sellerRef: string) => book(personaKey).following.has(sellerRef),
    reset() {
      books.clear();
      sequence = 0;
    },
  };
}
