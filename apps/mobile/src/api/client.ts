import type { components, paths } from '@adulis/api-client';
import { uuid } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiOrigin } from './config';

/**
 * The Mobile API boundary (WO-003). Every request and response type comes from the
 * generated contract (`@adulis/api-client`); nothing here is a hand-written DTO. It owns
 * the request plumbing once: the client and device headers, the bearer, the idempotency
 * key, a timeout, and one decoding of failures into four kinds that callers can act on
 * without reading English:
 *
 *   offline     the request never reached the server (no connection, DNS, refused)
 *   timeout     no answer within TIMEOUT_MS (React Native's Android client never times out)
 *   problem     the server answered with its problem envelope (code, title_key, slots)
 *   unexpected  any other non-success answer
 *
 * Offline and timeout never end a session: offline is not unauthenticated. Only a 401
 * whose code is SESSION_EXPIRED or SESSION_REVOKED, on a request that carried the bearer,
 * calls onSessionEnded - the one path back to the guest state.
 */

type Problem = components['schemas']['ProblemDto'];
type Json<R> = R extends { content: { 'application/json': infer B } } ? B : never;

export type Bootstrap = Json<paths['/v1/bootstrap']['get']['responses'][200]>;
export type AccountContext = NonNullable<Bootstrap['account_context']>;
type DeviceRegisterBody = Json<paths['/v1/devices']['post']['requestBody']>;
type DeviceRef = Json<paths['/v1/devices']['post']['responses'][201]>;
type OtpRequestBody = Json<paths['/v1/auth/otp/request']['post']['requestBody']>;
export type OtpVerifyBody = Json<paths['/v1/auth/otp/verify']['post']['requestBody']>;
export type OtpVerified = Json<paths['/v1/auth/otp/verify']['post']['responses'][200]>;
export type FypPage = Json<paths['/v1/fyp']['get']['responses'][200]>;
export type FypUnit = FypPage['items'][number];
export type PublicScene = Json<paths['/v1/scene-posts/{publicRef}']['get']['responses'][200]>;
export type SceneProduct = PublicScene['products'][number];
export type StorefrontProduct = Json<paths['/v1/storefronts/{handle}/products/{slug}']['get']['responses'][200]>;
export type Storefront = Json<paths['/v1/storefronts/{handle}']['get']['responses'][200]>;
export type SellerScenePage = Json<paths['/v1/storefronts/{handle}/scenes']['get']['responses'][200]>;
export type SellerScene = SellerScenePage['data'][number];
export type SellerProductPage = Json<paths['/v1/storefronts/{handle}/products']['get']['responses'][200]>;
export type SellerProduct = SellerProductPage['data'][number];
export type SellerReviewPage = Json<paths['/v1/storefronts/{handle}/reviews']['get']['responses'][200]>;
export type SellerReview = SellerReviewPage['data'][number];

export type ApiFailure =
  | { kind: 'offline' }
  | { kind: 'timeout' }
  | { kind: 'problem'; status: number; problem: Problem }
  | { kind: 'unexpected'; status: number };

export class ApiError extends Error {
  constructor(readonly failure: ApiFailure) {
    // Never the body or a credential: kind, status and code only.
    super(
      failure.kind === 'problem'
        ? `api problem ${failure.status} ${failure.problem.code}`
        : failure.kind === 'unexpected'
          ? `api unexpected ${failure.status}`
          : `api ${failure.kind}`,
    );
  }
}

/** True for a failure worth retrying automatically: the network, never the server's answer. */
export function isTransient(error: unknown): boolean {
  return error instanceof ApiError && (error.failure.kind === 'offline' || error.failure.kind === 'timeout');
}

/**
 * True when the server definitely answered (a problem or another non-success). The outcome
 * is known, so a retry is a new attempt and gets a new idempotency key: a stored refusal
 * (a 429, a 500) would otherwise be replayed for as long as the key lives. Offline and
 * timeout leave the outcome unknown, so the retry keeps the key.
 */
export function wasAnswered(error: unknown): boolean {
  return error instanceof ApiError && !isTransient(error);
}

/**
 * An idempotency key: the client-generated UUIDv7 ADU-API-01 S8 asks for. The random bits
 * come from the platform's secure generator (a v4 from `expo`); the first 48 bits become
 * epoch milliseconds and the version nibble 7. The v4 variant bits are already correct.
 */
export function newIdempotencyKey(): string {
  const hex = Date.now().toString(16).padStart(12, '0') + '7' + uuid.v4().replace(/-/g, '').slice(13);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function problemCode(error: unknown): Problem['code'] | null {
  return error instanceof ApiError && error.failure.kind === 'problem' ? error.failure.problem.code : null;
}

const TIMEOUT_MS = 10_000;

// `<surface>/<version>` (the contract's X-Adulis-Client): the version the bootstrap floor reads.
export const CLIENT_HEADER = `${Platform.OS}/${Constants.expoConfig?.version ?? '0.0.0'}`;

export interface ApiDeps {
  /** The persistent device id (src/device/device-storage.ts). */
  deviceId(): Promise<string>;
  /** The current bearer, or null for a guest. */
  token(): string | null;
  /** The server says this credential (the one the request carried) is dead. */
  onSessionEnded(ended: string): void;
}

type Call = {
  body?: unknown;
  idempotencyKey?: string;
  /** Send the current bearer (default). An explicit string sends that one instead. */
  bearer?: boolean | string;
  /** Query parameters; an undefined value is left out. */
  query?: Record<string, string | undefined>;
  /** Values for the path's {name} segments, each URL-encoded so it stays one segment. */
  params?: Record<string, string>;
  ok: number;
};

async function readProblem(res: Response): Promise<Problem | null> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === 'object' && typeof (body as Problem).code === 'string') {
      return body as Problem;
    }
  } catch {
    // Not JSON: a proxy's error page, an empty body.
  }
  return null;
}

export function createApiClient(deps: ApiDeps) {
  async function call<T>(method: 'GET' | 'POST', path: keyof paths, init: Call): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Adulis-Client': CLIENT_HEADER,
      'X-Adulis-Device': await deps.deviceId(),
    };
    const sessionToken = init.bearer === undefined || init.bearer === true ? deps.token() : null;
    const bearer = typeof init.bearer === 'string' ? init.bearer : sessionToken;
    if (bearer) headers.Authorization = `Bearer ${bearer}`;
    if (init.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    // Outside the try: a misconfigured origin is a build error, not "offline".
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(init.query ?? {})) if (value !== undefined) params.set(name, value);
    const search = params.toString();
    const resolved = path.replace(/\{(\w+)\}/g, (_match, name: string) => {
      const value = init.params?.[name];
      // encodeURIComponent keeps '.' and '..', which a URL parser resolves away: refuse them,
      // and a missing value, here rather than trust every caller to have validated.
      if (!value || value === '.' || value === '..') throw new Error(`invalid path parameter: ${name}`);
      return encodeURIComponent(value);
    });
    const url = `${apiOrigin()}${resolved}${search ? `?${search}` : ''}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: init.body === undefined ? null : JSON.stringify(init.body),
        signal: controller.signal,
      });
    } catch {
      throw new ApiError(controller.signal.aborted ? { kind: 'timeout' } : { kind: 'offline' });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === init.ok) {
      if (res.status === 204) return undefined as T;
      try {
        return (await res.json()) as T;
      } catch {
        throw new ApiError({ kind: 'unexpected', status: res.status });
      }
    }
    const problem = await readProblem(res);
    if (!problem) throw new ApiError({ kind: 'unexpected', status: res.status });
    if (
      sessionToken &&
      res.status === 401 &&
      (problem.code === 'SESSION_EXPIRED' || problem.code === 'SESSION_REVOKED')
    ) {
      deps.onSessionEnded(sessionToken);
    }
    throw new ApiError({ kind: 'problem', status: res.status, problem });
  }

  return {
    /** GET /v1/bootstrap: with the bearer when signed in, which also proves the session live. */
    bootstrap: () => call<Bootstrap>('GET', '/v1/bootstrap', { ok: 200 }),

    /**
     * GET /v1/fyp. Without a cursor the server starts a new feed session; with one it
     * continues that session. The subject is the server's (bearer, else this device): no
     * account, target or Market is ever sent.
     */
    fyp: (cursor: string | null, asGuest: boolean) =>
      call<FypPage>('GET', '/v1/fyp', {
        query: { cursor: cursor ?? undefined },
        // A guest feed's request stays a guest's even if a sign-in lands mid-flight.
        bearer: asGuest ? false : true,
        ok: 200,
      }),

    /**
     * GET /v1/scene-posts/{publicRef}: the Scene's current public representation, the
     * Explorer's only authority (never a feed unit). Public, and Market-scoped since WO-CAT-001:
     * it presents the session when there is one, as the feed does, so the server resolves the
     * same Market for both (the Account's when signed in, else this device's). Never a token
     * the guest state does not hold.
     */
    scene: (publicRef: string) =>
      call<PublicScene>('GET', '/v1/scene-posts/{publicRef}', { params: { publicRef }, ok: 200 }),

    /**
     * GET /v1/storefronts/{handle}/products/{slug}: the public Product, read now. `revalidate`
     * marks a technical re-read of a Product already on screen, which the server does not count
     * as a view (OVN-073); an opening never sets it.
     */
    product: (handle: string, slug: string, revalidate = false) =>
      call<StorefrontProduct>('GET', '/v1/storefronts/{handle}/products/{slug}', {
        params: { handle, slug },
        query: { revalidate: revalidate ? 'true' : undefined },
        // The session when there is one, as for the Scene: one Market for feed, Scene and Product.
        ok: 200,
      }),

    /**
     * The Seller Profile reads (WO-006): GET /v1/storefronts/{handle} and its Scenes, Products
     * and Reviews. Like the Scene and Product reads they present the session when one is held, so
     * the server resolves the handle in the same Market as the feed.
     */
    storefront: (handle: string) =>
      call<Storefront>('GET', '/v1/storefronts/{handle}', { params: { handle }, ok: 200 }),
    sellerScenes: (handle: string, cursor: string | null) =>
      call<SellerScenePage>('GET', '/v1/storefronts/{handle}/scenes', {
        params: { handle },
        query: { cursor: cursor ?? undefined, limit: '20' },
        ok: 200,
      }),
    sellerProducts: (handle: string, cursor: string | null) =>
      call<SellerProductPage>('GET', '/v1/storefronts/{handle}/products', {
        params: { handle },
        query: { cursor: cursor ?? undefined, limit: '30' },
        ok: 200,
      }),
    sellerReviews: (handle: string, cursor: string | null) =>
      call<SellerReviewPage>('GET', '/v1/storefronts/{handle}/reviews', {
        params: { handle },
        query: { cursor: cursor ?? undefined, limit: '25' },
        ok: 200,
      }),

    /** POST /v1/devices. The key is the registration intent's own UUIDv7, never the device id. */
    registerDevice: (id: string, idempotencyKey: string) => {
      const body: DeviceRegisterBody = { id, platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' };
      return call<DeviceRef>('POST', '/v1/devices', { body, idempotencyKey, bearer: false, ok: 201 });
    },

    requestOtp: (phone: string, idempotencyKey: string) => {
      const body: OtpRequestBody = { phone, purpose: 'SIGN_IN', audience: 'MOBILE' };
      return call<void>('POST', '/v1/auth/otp/request', { body, idempotencyKey, bearer: false, ok: 202 });
    },

    /** Not idempotency-keyed by contract: every resend is a new code that supersedes the old. */
    resendOtp: (phone: string) => {
      const body: OtpRequestBody = { phone, purpose: 'SIGN_IN', audience: 'MOBILE' };
      return call<void>('POST', '/v1/auth/otp/resend', { body, bearer: false, ok: 202 });
    },

    verifyOtp: (body: OtpVerifyBody, idempotencyKey: string) =>
      call<OtpVerified>('POST', '/v1/auth/otp/verify', { body, idempotencyKey, bearer: false, ok: 200 }),

    /** POST /v1/auth/logout with the credential being signed out (already off the device). */
    logout: (token: string) =>
      call<void>('POST', '/v1/auth/logout', { bearer: token, ok: 204 }).catch((error: unknown) => {
        // 401: that session is already dead, which is what sign-out wants.
        if (error instanceof ApiError && error.failure.kind === 'problem' && error.failure.status === 401) return;
        throw error;
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
