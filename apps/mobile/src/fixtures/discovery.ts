// DEVELOPMENT ONLY. The deterministic discovery world: two Sellers, eight Products, six Scenes, five channels. Server order is
// the order written here and the app never re-sorts it. Pages are three items long and the cursor is opaque. Nothing here is a
// rule: no ranking, no Nearby basis, no discount, no Locally Made membership. Reserved `fx_` identifiers throughout; media refs
// resolve to nothing (a fixture opens no network and bundles no image), so every picture is the neutral placeholder.
import type {
  Category,
  Channel,
  Money,
  ProductDetail,
  ProductTile,
  PublicScene,
  SceneCardUnit,
  SceneTag,
  SearchItem,
  SearchType,
  SellerProfile,
  SellerSummary,
} from '../contracts/gap-mob-discovery';
import { FIXTURE_IDS } from './ids';

export const PAGE_SIZE = 3;

const alem: SellerSummary = { sellerRef: FIXTURE_IDS.seller, storeName: 'Demo Store Alem' };
const bete: SellerSummary = { sellerRef: 'fx_seller_demo_bete', storeName: 'Demo Store Bete' };
const money = (minor: number): Money => ({ minor, currency: 'ETB' });
const media = (ref: string, alt: string, aspect = 4 / 3) => ({ ref: `fx_media_demo_${ref}`, aspect, alt });

interface FixtureProduct extends ProductTile {
  readonly category: string;
  readonly description: string;
}
const product = (n: number, seller: SellerSummary, name: string, minor: number, available: boolean, category: string): FixtureProduct => ({
  productRef: `fx_product_demo_${n}`,
  seller,
  name,
  priceMin: money(minor),
  priceMax: money(minor + (n % 2 === 0 ? 5000 : 0)),
  available,
  image: media(`p${n}`, name, 1),
  category,
  description: `Demonstration description for ${name}.`,
});

// Newest first, as the server would send it.
export const PRODUCTS: readonly FixtureProduct[] = [
  product(1, alem, 'Woven basket', 45000, true, 'home'),
  product(2, bete, 'Cotton scarf', 80000, true, 'fashion'),
  product(3, alem, 'Clay coffee pot', 120000, false, 'home'),
  product(4, bete, 'Leather satchel', 350000, true, 'fashion'),
  product(5, alem, 'Brass tray', 90000, true, 'home'),
  product(6, bete, 'Embroidered shawl', 210000, true, 'fashion'),
  product(7, alem, 'Wooden stool', 150000, true, 'home'),
  product(8, bete, 'Silver cuff', 260000, true, 'fashion'),
];
const productByRef = new Map(PRODUCTS.map((p) => [p.productRef, p]));
const tile = (p: FixtureProduct): ProductTile => ({ productRef: p.productRef, seller: p.seller, name: p.name, priceMin: p.priceMin, priceMax: p.priceMax, available: p.available, image: p.image });

const tag = (position: number, n: number, hotspot: { x: number; y: number } | null): SceneTag => {
  const p = productByRef.get(`fx_product_demo_${n}`) as FixtureProduct;
  return { position, productRef: p.productRef, name: p.name, available: p.available, hotspot, priceMin: p.priceMin, priceMax: p.priceMax };
};

const LONG = 'A long demonstration caption that keeps going to prove the card truncates safely and the explorer shows it whole. '.repeat(6).trim();
const scene = (n: number, seller: SellerSummary, caption: string, tags: SceneTag[], aspect = 4 / 3): SceneCardUnit => ({
  type: 'SCENE_POST',
  sceneRef: `fx_scene_demo_${n}`,
  caption,
  seller,
  image: media(`s${n}`, `Photo for scene ${n}`, aspect),
  tags,
});

// Scene 3 carries an unavailable Product tag; scene 5 a very long caption; scene 6 no hotspot data (list only); scene 4 is portrait.
export const SCENES: readonly SceneCardUnit[] = [
  scene(1, alem, 'Demonstration scene: a corner with a basket and a stool.', [tag(1, 1, { x: 0.3, y: 0.7 }), tag(2, 7, { x: 0.7, y: 0.6 })]),
  scene(2, bete, 'Demonstration scene: scarves on a line.', [tag(1, 2, { x: 0.5, y: 0.4 })]),
  scene(3, alem, 'Demonstration scene: coffee time.', [tag(1, 3, { x: 0.4, y: 0.5 }), tag(2, 5, { x: 0.8, y: 0.8 })]),
  scene(4, bete, 'Demonstration scene: a satchel by the door.', [tag(1, 4, { x: 0.5, y: 0.5 })], 3 / 4),
  scene(5, alem, LONG, [tag(1, 1, { x: 0.2, y: 0.2 })]),
  scene(6, bete, 'Demonstration scene: shawls and a cuff, no hotspots.', [tag(1, 6, null), tag(2, 8, null)]),
];
const sceneByRef = new Map(SCENES.map((s) => [s.sceneRef, s]));

export const CHANNELS: readonly Channel[] = [
  { key: 'FOR_YOU', state: 'AVAILABLE' },
  { key: 'FOLLOWING', state: 'AVAILABLE' },
  // Unresolved product decisions (Nearby basis, Locally Made eligibility, discount fact): not available, never invented.
  { key: 'NEARBY', state: 'NOT_AVAILABLE' },
  { key: 'DISCOUNTS', state: 'NOT_AVAILABLE' },
  { key: 'LOCALLY_MADE', state: 'NOT_AVAILABLE' },
];

export const CATEGORIES: readonly Category[] = [
  { code: 'home', label: 'Home' },
  { code: 'fashion', label: 'Fashion' },
];

export function pageOf<T>(items: readonly T[], cursor: string | null): { items: readonly T[]; nextCursor: string | null } {
  const start = cursor === null ? 0 : Number.parseInt(cursor.replace('fx_cursor_demo_', ''), 10);
  const from = Number.isFinite(start) && start >= 0 ? start : 0;
  const end = from + PAGE_SIZE;
  return { items: items.slice(from, end), nextCursor: end < items.length ? `fx_cursor_demo_${end}` : null };
}

export const visibleScenes = (withdrawn: ReadonlySet<string>, sellerRef?: string): SceneCardUnit[] =>
  SCENES.filter((s) => !withdrawn.has(s.sceneRef) && (sellerRef === undefined || s.seller.sellerRef === sellerRef));

export function publicScene(ref: string, withdrawn: ReadonlySet<string>): PublicScene | null {
  const unit = sceneByRef.get(ref);
  if (unit === undefined || withdrawn.has(ref)) return null;
  return { ...unit, publishedAt: '2026-01-01T00:00:00.000Z', trustLevel: 'ESTABLISHED', related: visibleScenes(withdrawn, unit.seller.sellerRef).filter((s) => s.sceneRef !== ref) };
}

export function productDetail(ref: string): ProductDetail | null {
  const p = productByRef.get(ref);
  if (p === undefined) return null;
  return {
    ...tile(p),
    description: p.description,
    trustLevel: 'ESTABLISHED',
    variants: [
      { variantRef: `fx_variant_demo_${p.productRef.slice(-1)}a`, label: 'Standard', price: p.priceMin, available: p.available },
      { variantRef: `fx_variant_demo_${p.productRef.slice(-1)}b`, label: 'Large', price: p.priceMax, available: false },
    ],
  };
}

export function sellerProfile(ref: string): SellerProfile | null {
  const seller = [alem, bete].find((s) => s.sellerRef === ref);
  return seller ? { sellerRef: seller.sellerRef, storeName: seller.storeName, description: `Demonstration profile for ${seller.storeName}.`, trustLevel: 'ESTABLISHED', isOpen: seller === alem } : null;
}

export const productsOf = (sellerRef: string): ProductTile[] => PRODUCTS.filter((p) => p.seller.sellerRef === sellerRef).map(tile);
export const shopProducts = (category: string | null): ProductTile[] => PRODUCTS.filter((p) => category === null || p.category === category).map(tile);
export const knownCategory = (code: string) => CATEGORIES.some((c) => c.code === code);

/** Case-insensitive substring match after NFKC, in the server's (fixture) order: no relevance score exists. */
export function search(q: string, type: SearchType, withdrawn: ReadonlySet<string>): SearchItem[] {
  const needle = q.normalize('NFKC').toLowerCase();
  if (needle === '') return [];
  const has = (text: string) => text.normalize('NFKC').toLowerCase().includes(needle);
  const products: SearchItem[] = PRODUCTS.filter((p) => has(p.name)).map((p) => ({ kind: 'PRODUCT_POST', product: tile(p) }));
  const scenes: SearchItem[] = visibleScenes(withdrawn).filter((s) => has(s.caption)).map((s) => ({ kind: 'SCENE_POST', scene: s }));
  const sellers: SearchItem[] = [alem, bete].filter((s) => has(s.storeName)).map((s) => ({ kind: 'SELLER', seller: s }));
  switch (type) {
    case 'PRODUCT_POST':
      return products;
    case 'SCENE_POST':
      return scenes;
    case 'SELLER':
      return sellers;
    case 'TOP':
      return [...products.slice(0, 2), ...scenes.slice(0, 2), ...sellers.slice(0, 1)];
  }
}

/** Following: what the persona follows. The owner follows Bete; everyone else follows nobody. */
export const followedSellerRefs = (personaKey: string): readonly string[] => (personaKey === 'owner' ? [bete.sellerRef] : []);
