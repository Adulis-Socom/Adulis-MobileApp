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
type Handler = (call: Recorded) => Reply;

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
    impression_id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`,
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
};

export function installFakeApi() {
  const calls: Recorded[] = [];
  const handlers: Record<string, Handler> = { ...defaults };
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
    const handler = handlers[`${method} ${path}`];
    const reply: Reply = handler ? handler(call) : problem(404, 'NOT_FOUND', 'request');
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
    callsTo(route: string) {
      return calls.filter((c) => `${c.method} ${c.path}` === route);
    },
  };
}
