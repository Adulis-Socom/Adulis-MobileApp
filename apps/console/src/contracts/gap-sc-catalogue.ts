/**
 * PROVISIONAL fixture contracts GAP-SC-08..10: Catalogue, taxonomy and Inventory (SC-FE-04). Same status as gap-sc.ts:
 * NOT the API contract, never written into contracts/openapi.json or packages/api-client. The backend work orders confirm or
 * replace them. Sources: CONSOLE-02 S47-S57, CATINV-01 v3.3 S11-S23 and S40-S76, S99-S120 (routes there are
 * `/v1/sellers/{sellerId}/product-posts...` and `/variants/{variantId}/stock...`).
 *
 * GAP-SC-08 taxonomy: category tree and typed category-scoped attributes (CATINV S40-S41). The Console hard-codes no
 *           category, attribute, allowed value or required rule: all of them arrive here (docs/rebuild/SC-FE-04-06-ROOT-HANDOFF.md S1).
 * GAP-SC-09 Product Post, Variants, price, media and publication (CATINV S11, S42-S49, S112-S113, S119)
 * GAP-SC-10 Inventory: set stock, confirm stock, history (CATINV S57-S76, S114)
 *
 * Rules every shape below follows: the server resolves state and says what the caller may do (`allowed_actions`); the
 * Console never derives publishability, availability, a low-stock threshold or a confidence level (CATINV S67, CON S54).
 * Amounts are integer minor units plus an ISO currency the server chose from the Seller's Market (CATINV S44).
 * Instants are UTC ISO-8601. Every Seller-scoped answer echoes `seller_id`.
 */

// ---- GAP-SC-08 -----------------------------------------------------------------------------------------------------
/**
 * How much of a category is defined. The submitted taxonomy is incomplete and unratified: a category whose attributes are
 * not defined is still a real category, and the editor says so instead of showing an empty, apparently complete form.
 */
export type DefinitionStatus = 'DEFINED' | 'ATTRIBUTES_NOT_DEFINED' | 'NOT_DEFINED';

export interface CategoryNode {
  readonly id: string;
  readonly parent_id: string | null;
  /** Server data, not a locale key: category identity is stable and labels are presentation (CATINV S40). */
  readonly label: string;
  readonly definition_status: DefinitionStatus;
  /** Whether a Product may be assigned to this node. The server decides; a grouping node is not selectable. */
  readonly selectable: boolean;
}
export interface CategoryTree {
  readonly seller_id: string;
  readonly taxonomy_version: string;
  readonly categories: readonly CategoryNode[];
}

export type AttributeScope = 'PRODUCT' | 'VARIANT';
export type AttributeValueType = 'SINGLE' | 'MULTI' | 'TEXT';
export interface AttributeValue {
  readonly id: string;
  readonly label: string;
}
export interface AttributeDef {
  readonly id: string;
  readonly label: string;
  /** PRODUCT attributes describe the Product; VARIANT attributes define the sellable combination (CON S50). */
  readonly scope: AttributeScope;
  readonly value_type: AttributeValueType;
  /** Only ever what the governing taxonomy establishes. The submitted workbooks establish none of it (docs/rebuild report 16). */
  readonly required: boolean;
  readonly values: readonly AttributeValue[];
}
export interface CategoryAttributes {
  readonly seller_id: string;
  readonly category_id: string;
  readonly definition_status: DefinitionStatus;
  readonly attributes: readonly AttributeDef[];
}

// ---- GAP-SC-09 -----------------------------------------------------------------------------------------------------
/** CATINV S48. Publication is distinct from Inventory sellability (S22): a published Product may have zero stock. */
export type ProductState = 'DRAFT' | 'PUBLISHED' | 'WITHDRAWN' | 'RESTRICTED';
/** CATINV S66 approved public labels; the server resolves them, the Console never applies a threshold (S67). */
export type Availability = 'AVAILABLE' | 'LOW' | 'NOT_AVAILABLE';
export type StockVisibility = 'EXACT' | 'STATUS_ONLY';
export type ProductFilter = 'ALL' | ProductState;

export interface ProductSummary {
  readonly id: string;
  readonly title: string;
  readonly publication_state: ProductState;
  readonly category_label: string | null;
  readonly availability: Availability;
  readonly variant_count: number;
}
export interface ProductList {
  readonly seller_id: string;
  readonly items: readonly ProductSummary[];
  /** Cursor pagination, never an entire catalogue in one response (CATINV S53). The page size is the server's. */
  readonly next_cursor: string | null;
  readonly allowed_actions: readonly string[];
}

/** One publication blocker. All of them are returned at once (CON S49); `field` anchors the one the Seller can fix on screen. */
export interface Blocker {
  readonly code: string;
  readonly field: string | null;
}
export type MediaState = 'PROCESSING' | 'READY' | 'REJECTED';
export interface MediaItem {
  readonly id: string;
  readonly file_name: string;
  readonly state: MediaState;
  /**
   * A derivative the server serves once the image is READY (a CDN URL in reality). Null while processing or when the server holds no
   * bytes (fixture mode): the Console then shows the Seller's own selected file, in memory, for the session only.
   */
  readonly preview_url: string | null;
}
/**
 * Optional TikTok embed (CATINV S27-S38, S101, S111, S117; MEDIA-01): external, Product-detail-only, never a Seller video upload and never
 * in the Buyer For You feed. Attaching needs a connected, ownership-verified account; the failures are the canonical Media-domain codes
 * TIKTOK_NOT_CONNECTED, TIKTOK_OWNERSHIP_NOT_VERIFIED and TIKTOK_EMBED_UNAVAILABLE, returned as the `tiktok` field error. Provider access is
 * never activated from the Console: this state is the server's answer, not a claim.
 */
export interface TikTokState {
  readonly connection: 'NOT_CONNECTED' | 'CONNECTED';
  readonly embed: { readonly video_url: string } | null;
}
export interface StockConfidence {
  /** The Seller never chooses a confidence level (CON S54). Codes are rendered through the catalogue, with an unknown fallback. */
  readonly state: string;
  readonly reason_code: string;
  readonly effect_code: string;
  readonly last_confirmed_at: string | null;
}
export interface VariantView {
  readonly id: string;
  /** Server-built label for the combination, e.g. "Red / S". */
  readonly summary: string;
  /** attribute id to value id. */
  readonly options: Readonly<Record<string, string>>;
  readonly price_minor: number | null;
  readonly active: boolean;
  readonly quantity: number;
  readonly stock_version: number;
  readonly availability: Availability;
  readonly confidence: StockConfidence;
}
export interface ProductDetail {
  readonly seller_id: string;
  readonly id: string;
  /** Optimistic concurrency token (CATINV S119): a stale editor receives CONFLICT, never a silent overwrite. */
  readonly version: number;
  readonly title: string;
  readonly description: string;
  readonly category_id: string | null;
  readonly category_label: string | null;
  /** attribute id to value ids (SINGLE: one entry, MULTI: several) or the text entered (TEXT: one entry). */
  readonly attributes: Readonly<Record<string, readonly string[]>>;
  readonly stock_visibility_mode: StockVisibility;
  readonly currency: string;
  readonly publication: {
    readonly state: ProductState;
    readonly published_at: string | null;
    readonly blockers: readonly Blocker[];
  };
  readonly availability: Availability;
  readonly media: readonly MediaItem[];
  readonly variants: readonly VariantView[];
  readonly tiktok: TikTokState;
  /**
   * What THIS account may do to THIS Product right now, as the server resolved it (permission, role, state).
   * Known members: EDIT, PUBLISH, WITHDRAW, ADD_VARIANT, EDIT_VARIANT, ADJUST_STOCK, CONFIRM_STOCK, ADD_MEDIA, EDIT_TIKTOK.
   * A member this version does not know is ignored, never granted.
   */
  readonly allowed_actions: readonly string[];
}
export interface PublishOutcome {
  readonly seller_id: string;
  readonly result: 'PUBLISHED' | 'BLOCKED';
  readonly product: ProductDetail;
}

// ---- GAP-SC-10 -----------------------------------------------------------------------------------------------------
export interface StockEventView {
  readonly id: string;
  /** Signed change; 0 for a confirmation (CATINV S62: a confirmation creates no fake quantity movement). */
  readonly delta: number;
  readonly reason_code: string;
  readonly occurred_at: string;
}
export interface StockHistory {
  readonly seller_id: string;
  readonly variant_id: string;
  readonly events: readonly StockEventView[];
}

export interface CatalogueOperations {
  readonly 'catalogue.categories.get': { in: Record<string, never>; out: CategoryTree };
  readonly 'catalogue.category.attributes.get': { in: { category_id: string }; out: CategoryAttributes };
  readonly 'products.list': { in: { query: string; filter: ProductFilter; cursor: string | null }; out: ProductList };
  readonly 'products.create': { in: Record<string, never>; out: ProductDetail };
  readonly 'products.get': { in: { product_id: string }; out: ProductDetail };
  readonly 'products.update': {
    in: {
      product_id: string;
      version: number;
      title?: string;
      description?: string;
      category_id?: string | null;
      attributes?: Readonly<Record<string, readonly string[]>>;
      stock_visibility_mode?: StockVisibility;
    };
    out: ProductDetail;
  };
  readonly 'products.publish': { in: { product_id: string; version: number }; out: PublishOutcome };
  readonly 'products.withdraw': { in: { product_id: string; version: number }; out: ProductDetail };
  /**
   * PROVISIONAL collapse of grant, direct upload and bind (CON S55-S56) into one call. In fixture mode no image bytes leave
   * the browser: only the name and type are sent. The real flow is an upload grant, bytes straight to object storage, then bind.
   */
  readonly 'products.media.add': { in: { product_id: string; version: number; file_name: string; content_type: string }; out: ProductDetail };
  /** The full new order of the Product's image ids; the first is the primary image. One Product at a time. */
  readonly 'products.media.arrange': { in: { product_id: string; version: number; order: readonly string[] }; out: ProductDetail };
  readonly 'products.media.remove': { in: { product_id: string; version: number; media_id: string }; out: ProductDetail };
  readonly 'products.tiktok.attach': { in: { product_id: string; version: number; video_url: string }; out: ProductDetail };
  readonly 'products.tiktok.detach': { in: { product_id: string; version: number }; out: ProductDetail };
  readonly 'variants.create': { in: { product_id: string; version: number; options: Readonly<Record<string, string>>; price_minor: number | null }; out: ProductDetail };
  /** Deactivate, never delete (CATINV S113). */
  readonly 'variants.update': { in: { product_id: string; version: number; variant_id: string; price_minor?: number | null; active?: boolean }; out: ProductDetail };
  /** Seller Set Stock: the target quantity, one Variant at a time; the server computes the delta (CATINV S61). */
  readonly 'inventory.set': { in: { variant_id: string; stock_version: number; quantity: number }; out: ProductDetail };
  /** Refreshes stock confidence without changing the quantity (CON S53, CATINV S62). */
  readonly 'inventory.confirm': { in: { variant_id: string; stock_version: number }; out: ProductDetail };
  readonly 'inventory.history.get': { in: { variant_id: string }; out: StockHistory };
}
