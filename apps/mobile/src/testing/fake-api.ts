import type { components } from '@adulis/api-client';

/**
 * A fake Adulis API for tests: the contract's real shapes (generated types), problem
 * envelopes like the server's, and a record of every request so tests can assert headers,
 * bodies and what was never sent. Each route can be overridden per test.
 */
type S = components['schemas'];
export type Bootstrap = S['BootstrapResponseDto'];

export const ORIGIN = 'https://api.example.test';
/** Shaped like a real credential (43 base64url characters). */
export const GOOD_TOKEN = 'Fake_credential_for_tests_0123456789abcdefg';
export const SIGN_IN_CODE = '123456';

export interface Recorded {
  method: string;
  /** The path without its query string; routes match on this. */
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: Record<string, unknown> | undefined;
}

export type Reply = { status: number; body?: unknown } | 'offline' | 'hang';
// A promise lets a test hold a reply and release it later (a response that lands late).
export type Handler = (call: Recorded) => Reply | Promise<Reply>;

export function problem(status: number, code: S['ProblemDto']['code'], group: string, slots?: Record<string, unknown>) {
  return {
    status,
    body: {
      type: 'about:blank',
      title_key: `error.${group}.${code.toLowerCase()}`,
      status,
      code,
      request_id: 'test',
      retryable: false,
      ...(slots ? { slots } : {}),
    } satisfies S['ProblemDto'],
  };
}

export function bootstrapBody(overrides: Partial<Bootstrap> = {}): Bootstrap {
  return {
    server_time: '2026-11-09T12:00:00.000Z',
    min_supported_client: '0.0.0',
    client_status: 'OK',
    market: { code: 'ET', display_currency: 'ETB', timezone: 'Africa/Addis_Ababa' },
    locales: ['en', 'am'],
    feature_flags: {},
    media_public_origin: '',
    environment: 'development',
    account_context: null,
    ...overrides,
  };
}

export type FypPage = S['FypPageDto'];
export type FypUnit = S['ScenePostFeedUnitDto'];

/** A Scene unit shaped exactly like the contract's; `n` makes it distinct. */
export function fypUnit(n: number, overrides: Partial<FypUnit> = {}): FypUnit {
  return {
    type: 'SCENE_POST',
    serve_id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`,
    position: n,
    candidate_source: 'RECENT',
    public_ref: `scene-ref-${String(n).padStart(12, '0')}`,
    revision_version: 1,
    published_at: '2026-11-09T12:00:00.000Z',
    caption: `Scene caption ${n}`,
    caption_truncated: false,
    image: { thumb_key: `scenes/${n}/thumb.webp`, card_key: `scenes/${n}/card.webp` },
    seller: { handle: `seller-${n}`, store_name: `Store ${n}` },
    products: [{ position: 1, slug: `item-${n}`, name: `Item ${n}`, available: true }],
    ...overrides,
  };
}

export function fypPage(items: FypUnit[], next_cursor: string | null = null, feed_session_id = 'feed-session-1'): FypPage {
  return {
    feed_session_id: items.length ? feed_session_id : null,
    algorithm_version: 'technical-baseline-recent-v1',
    items,
    next_cursor,
  };
}

export type PublicScene = S['PublicScenePostDto'];
export type SceneProduct = S['PublicSceneProductDto'];
export type StorefrontProduct = S['StorefrontProductDto'];

/** The public Scene read for fypUnit(n)'s Scene, shaped exactly like the contract's. */
export function publicScene(n: number, overrides: Partial<PublicScene> = {}): PublicScene {
  return {
    public_ref: fypUnit(n).public_ref,
    published_at: '2026-11-09T12:00:00.000Z',
    revision_version: 1,
    caption: `Scene caption ${n}`,
    image: {
      thumb_key: `scenes/${n}/thumb.webp`,
      card_key: `scenes/${n}/card.webp`,
      full_key: `scenes/${n}/full.webp`,
    },
    seller: { handle: `seller-${n}`, store_name: `Store ${n}` },
    products: [sceneProduct(1, `item-${n}`, `Item ${n}`)],
    ...overrides,
  };
}

export function sceneProduct(
  position: number,
  slug: string,
  name: string,
  overrides: Partial<SceneProduct> = {},
): SceneProduct {
  return {
    position,
    slug,
    name,
    base_price_minor: 80000,
    base_price_currency: 'ETB',
    price_min_minor: 80000,
    price_max_minor: 80000,
    price_currency: 'ETB',
    image_key: `products/${slug}/card.webp`,
    available: true,
    ...overrides,
  };
}

/** The public Product read, shaped exactly like the contract's. */
export function storefrontProduct(
  slug: string,
  name: string,
  overrides: Partial<StorefrontProduct> = {},
): StorefrontProduct {
  return {
    id: '0b6f1a3e-2222-4222-8222-222222222222',
    slug,
    name,
    description: `About ${name}`,
    base_price_minor: 80000,
    base_price_currency: 'ETB',
    price_min_minor: 80000,
    price_max_minor: 80000,
    price_currency: 'ETB',
    category_id: null,
    available: true,
    seller: { handle: 'seller-1', store_name: 'Store 1' },
    variants: [
      {
        id: '0b6f1a3e-3333-4333-8333-333333333333',
        variant_key: 'Default',
        price_minor: 80000,
        price_currency: 'ETB',
        stock_count: 4,
        stock_confirmed_at: '2026-11-09T12:00:00.000Z',
        status: 'ACTIVE',
        available: true,
      },
    ],
    attributes: [],
    images: [
      {
        position: 1,
        thumb_key: `products/${slug}/thumb.webp`,
        card_key: `products/${slug}/card.webp`,
        full_key: `products/${slug}/full.webp`,
      },
    ],
    ...overrides,
  };
}

export const SIGNED_IN_CONTEXT: NonNullable<Bootstrap['account_context']> = {
  buyer: { available: true },
  seller_companion: { available: false },
  courier: { available: false },
};

const bearer = (call: Recorded) => call.headers.Authorization;

const defaults: Record<string, Handler> = {
  'POST /v1/devices': (call) => ({ status: 201, body: { id: call.body?.id } }),
  'GET /v1/bootstrap': (call) => {
    if (bearer(call) === undefined) return { status: 200, body: bootstrapBody() };
    if (bearer(call) === `Bearer ${GOOD_TOKEN}`) {
      return { status: 200, body: bootstrapBody({ account_context: SIGNED_IN_CONTEXT }) };
    }
    return problem(401, 'SESSION_EXPIRED', 'auth');
  },
  'POST /v1/auth/otp/request': () => ({ status: 202, body: {} }),
  'POST /v1/auth/otp/resend': () => ({ status: 202, body: {} }),
  'POST /v1/auth/otp/verify': (call) =>
    call.body?.code === SIGN_IN_CODE
      ? {
          status: 200,
          body: {
            account_id: '0b6f1a3e-1111-4111-8111-111111111111',
            audience: 'MOBILE',
            roles: [],
            expires_at: '2026-12-09T12:00:00.000Z',
            token: GOOD_TOKEN,
          } satisfies S['OtpVerifyResponseDto'],
        }
      : problem(401, 'OTP_INVALID', 'auth'),
  'POST /v1/auth/logout': () => ({ status: 204 }),
  // An empty feed unless a test serves Scenes: no runtime fixture ever reaches the app.
  'GET /v1/fyp': () => ({ status: 200, body: fypPage([]) }),
  // WO-009: a signed-in Buyer with an empty Saved Collection and nothing saved, unless a test
  // installs the stateful fake (testing/fake-collections.ts).
  'GET /v1/collections': () => ({
    status: 200,
    body: {
      default_collection_ref: DEFAULT_COLLECTION_REF,
      data: [{ ref: DEFAULT_COLLECTION_REF, kind: 'DEFAULT', name: null, product_count: 0, scene_count: 0, created_at: '2026-11-11T08:00:00.000000Z', updated_at: '2026-11-11T08:00:00.000000Z' }],
      next_cursor: null,
    },
  }),
  'GET /v1/collections/saves': () => ({ status: 200, body: { data: [], next_cursor: null } }),
  // WO-010: no category enabled in the Market unless a test serves some.
  'GET /v1/categories': () => ({ status: 200, body: { market_resolved: true, data: [] } }),
  'POST /v1/collections/saved-state:batch': (call) => ({
    status: 200,
    body: {
      default_collection_ref: DEFAULT_COLLECTION_REF,
      items: ((call.body?.targets ?? []) as Array<{ type: string; ref: string }>).map((t) => ({ ...t, saved: false, default_item_ref: null, memberships: [] })),
    },
  }),
};

export const DEFAULT_COLLECTION_REF = '0c000000-0000-4000-8000-000000000001';

export function installFakeApi() {
  const calls: Recorded[] = [];
  const handlers: Record<string, Handler> = { ...defaults };
  // Routes with path parameters: a method and a pattern over the path, tried after exact routes.
  const patterns: Array<{ method: string; pattern: RegExp; handler: Handler }> = [];
  const fetchMock = jest.fn(async (url: string, init: RequestInit = {}): Promise<Response> => {
    const method = init.method ?? 'GET';
    const full = url.startsWith(ORIGIN) ? url.slice(ORIGIN.length) : url;
    const [path = full, search = ''] = full.split('?');
    const call: Recorded = {
      method,
      path,
      query: Object.fromEntries(new URLSearchParams(search)),
      headers: { ...(init.headers as Record<string, string>) },
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined,
    };
    calls.push(call);
    const handler = handlers[`${method} ${path}`] ?? patterns.find((p) => p.method === method && p.pattern.test(path))?.handler;
    const reply: Reply = handler ? await handler(call) : problem(404, 'NOT_FOUND', 'request');
    if (reply === 'offline') throw new TypeError('Network request failed');
    if (reply === 'hang') return new Promise<Response>(() => undefined);
    return { status: reply.status, json: async () => reply.body } as Response;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_API_BASE_URL = ORIGIN;

  return {
    calls,
    fetchMock,
    /** Replace one route, e.g. on('GET /v1/bootstrap', () => 'offline'). */
    on(route: string, handler: Handler) {
      handlers[route] = handler;
    },
    /** A route with path parameters, e.g. onPattern('GET', /^\/v1\/collections\/[^/]+$/, ...). */
    onPattern(method: string, pattern: RegExp, handler: Handler) {
      patterns.unshift({ method, pattern, handler });
    },
    callsTo(route: string) {
      return calls.filter((c) => `${c.method} ${c.path}` === route);
    },
  };
}

// ---------------------------------------------------------------- WO-006 Seller Profile
export type Storefront = S['StorefrontDto'];
export type SellerScene = S['SellerSceneDto'];
export type SellerProduct = S['StorefrontProductListItemDto'];
export type SellerReview = S['StorefrontReviewDto'];

/** GET /v1/storefronts/{handle}, shaped exactly like the contract's. */
export function storefront(handle: string, overrides: Partial<Storefront> = {}): Storefront {
  return {
    seller_id: '0b6f1a3e-9999-4999-8999-999999999999',
    store_name: 'Store 1',
    handle,
    description: 'Baskets woven in Addis Ababa.',
    status: 'ACTIVE',
    member_since: '2026-03-01',
    stats: {
      level: 'ESTABLISHED',
      completed_handoff_count: 12,
      cancellation_rate: '0.0000',
      confirmation_rate: null,
      scan_completion_rate: null,
      unresolved_claim_count: 0,
      missed_confirmation_windows: 0,
    },
    availability: { is_open: true, reason: 'SCHEDULE', note: null },
    review_summary: {
      count: 3,
      average_rating: 4,
      basis_counts: { FINAL_HANDOFF: 2, VERIFIED_ORDER_FAILURE: 1 },
    },
    fulfilment_methods: ['BUYER_COLLECTION'],
    ...overrides,
  };
}

export function sellerScene(n: number, overrides: Partial<SellerScene> = {}): SellerScene {
  return {
    public_ref: fypUnit(n).public_ref,
    published_at: '2026-11-09T12:00:00.000Z',
    caption: `Seller scene ${n}`,
    caption_truncated: false,
    image: { thumb_key: `scenes/${n}/thumb.webp`, card_key: `scenes/${n}/card.webp` },
    ...overrides,
  };
}

/** A stable, distinct uuid per slug: a list de-duplicates Products by id (WO-007B). */
const productIdFor = (slug: string) =>
  `0b6f1a3e-aaaa-4aaa-8aaa-${[...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 0xffffffffffff, 7).toString(16).padStart(12, '0')}`;

export function sellerProduct(slug: string, name: string, overrides: Partial<SellerProduct> = {}): SellerProduct {
  return {
    id: productIdFor(slug),
    slug,
    name,
    base_price_minor: 1,
    base_price_currency: 'ETB',
    price_min_minor: 50000,
    price_max_minor: 50000,
    price_currency: 'ETB',
    available: true,
    display_order: 0,
    image_key: `products/${slug}/card.webp`,
    ...overrides,
  };
}

export function sellerReview(n: number, overrides: Partial<SellerReview> = {}): SellerReview {
  return {
    id: `0b6f1a3e-bbbb-4bbb-8bbb-${n.toString(16).padStart(12, '0')}`,
    seller_rating: 5,
    body: `Review ${n}`,
    evidence_basis: 'FINAL_HANDOFF',
    published_at: '2026-11-08T10:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------- WO-007 Shop
export type ShopProduct = S['ShopProductDto'];

export function shopProduct(slug: string, name: string, handle = 'seller-1', overrides: Partial<ShopProduct> = {}): ShopProduct {
  return {
    id: productIdFor(`${handle}/${slug}`),
    slug,
    name,
    base_price_minor: 1,
    base_price_currency: 'ETB',
    price_min_minor: 50000,
    price_max_minor: 50000,
    price_currency: 'ETB',
    available: true,
    seller: { handle, store_name: `Store ${handle}` },
    image_key: `products/${slug}/card.webp`,
    ...overrides,
  };
}
