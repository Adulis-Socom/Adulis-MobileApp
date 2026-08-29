/**
 * api/client.ts -- the console's THIN wrapper over the contract seam.
 *
 * DO NOT hand-edit types into this file: the generated shapes live in
 * @adulis/api-client's schema.d.ts. The auth operations are schema-less in
 * the contract today (the API's Swagger decorators carry no bodies --
 * register D-98), so the request/response shapes here are typed LOCALLY
 * and marked as such; when the contract gains schemas, these interfaces
 * are deleted in favour of the generated ones, not reconciled.
 *
 * Session: an httpOnly __Host-adulis_session cookie the console CANNOT
 * read and does not need to (ADU-SEC-01 S4). Every request rides
 * credentials: 'include'; signed-in state is inferred from responses,
 * never from storage -- no localStorage, no sessionStorage, no token in
 * JavaScript, anywhere, ever.
 */
import { resolveApiBaseUrl } from '@adulis/api-client';
import type { AdulisProblem } from '../lib/states';

/**
 * The base URL is resolved on FIRST REQUEST, never at module scope. It used
 * to be a module-level const, and a build without VITE_API_BASE_URL therefore
 * threw during import -- before createRoot, so the page was blank and no
 * error boundary could exist yet. A misconfigured deployment must fail as a
 * screen the twelve-state vocabulary can render, not as a white page.
 */
let baseMemo: string | null = null;
function apiBase(): string {
  if (baseMemo === null) baseMemo = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  return baseMemo;
}

/**
 * The server's idle clock runs from the last REQUEST (session.service.ts
 * touches last_activity_at only inside authenticate()). The client therefore
 * measures the same thing the server does; stamping this on pointer or key
 * activity would let the warning drift hours past the real expiry.
 */
export const requestClock = { last: Date.now() };

/**
 * A 401 means the session is gone whatever any local timer believed. The
 * provider registers itself here so one handler covers every call site.
 */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

/**
 * The device identity, minted per app load. A web console has nowhere
 * PERMITTED to persist one (storage is banned wholesale) and no honest
 * platform value to register it with (core.device_platform is ANDROID|IOS
 * -- register D-95), so: VITE_DEVICE_ID carries the seeded device for
 * local development, and a fresh uuid otherwise. Both facts are the
 * register entry's, not this file's, to resolve.
 */
export const deviceId: string =
  (import.meta.env.VITE_DEVICE_ID as string | undefined) ?? crypto.randomUUID();

export class ApiError extends Error {
  constructor(readonly problem: AdulisProblem) {
    super(problem.code);
  }
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly idempotencyKey?: string;
  readonly sellerId?: string;
  readonly locale?: string;
  readonly signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Adulis-Device': deviceId,
  };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;
  if (opts.sellerId) headers['X-Adulis-Seller'] = opts.sellerId;
  if (opts.locale) headers['Accept-Language'] = opts.locale;

  let root: string;
  try {
    root = apiBase();
  } catch (e) {
    // Misconfiguration, not a network fault -- but it must still arrive as
    // the one error shape every screen knows how to render.
    throw new ApiError({
      type: 'about:blank',
      title_key: 'error.request.internal',
      status: 0,
      code: 'CONFIG',
      request_id: '',
      retryable: false,
    });
  }

  let res: Response;
  try {
    res = await fetch(`${root}/v1${path}`, {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers,
      body: opts.body === undefined ? null : JSON.stringify(opts.body),
      signal: opts.signal ?? null,
    });
  } catch (e) {
    // Network failure: surfaced as a synthetic TRANSPORT_ERROR problem so
    // every screen handles exactly one error shape.
    throw new ApiError({
      type: 'about:blank',
      title_key: 'error.request.internal',
      status: 0,
      code: 'NETWORK',
      request_id: '',
      retryable: true,
    });
  }
  // The request reached the server and came back: that is what the server's
  // idle clock counts, whatever the status.
  requestClock.last = Date.now();
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (res.status === 204) return undefined as T;

  let text: string;
  let parsed: unknown;
  try {
    text = await res.text();
    parsed = text ? JSON.parse(text) : {};
  } catch {
    // A proxy's HTML error page, a truncated body: previously a SyntaxError
    // that no `instanceof ApiError` catch site handled, so the button just
    // stopped spinning and nothing rendered.
    throw new ApiError({
      type: 'about:blank',
      title_key: 'error.request.internal',
      status: res.status,
      code: 'MALFORMED_RESPONSE',
      request_id: res.headers.get('X-Request-Id') ?? '',
      retryable: res.status >= 500,
    });
  }
  if (!res.ok) throw new ApiError(parsed as AdulisProblem);
  return parsed as T;
}
