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
 * THE CONSOLE HAS NO DEVICE ID, and that is the point (ADU-RUL-03 S2).
 *
 * It used to mint one -- VITE_DEVICE_ID, or a uuid per load -- and both arms
 * were broken: a build constant is shared by every browser loading the
 * bundle, so the new-device payout lock read "known device" for a machine it
 * had never seen; a per-load uuid had no core.device row and verify rejected
 * it before sign-in could start (D-102).
 *
 * The server mints the row at /v1/bootstrap and returns the identity in an
 * httpOnly __Host- cookie. This file cannot read it, does not need to, and
 * must not try: a value JavaScript can read is a value XSS can forge, and
 * this one gates a payout lock. The browser sends it because the browser
 * sends cookies; every request already rides credentials: 'include'.
 */

/**
 * ADU-API-01 S3: X-Adulis-Client is sent on every request, formatted
 * `surface/version`. It is the signal that tells the server which device
 * mechanism this request uses, so it is not optional decoration.
 */
const CLIENT_ID = `web/${__APP_VERSION__}`;

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
    'X-Adulis-Client': CLIENT_ID,
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

/**
 * apiBlob -- the ONE endpoint that returns bytes rather than JSON:
 * GET /v1/seller/orders/{id}/payment-evidence (SC-05).
 *
 * It lives here rather than as a bare `fetch` in the screen so that the base
 * URL, the credentials mode, X-Adulis-Client, X-Adulis-Seller, the 401
 * handler and the idle clock all behave identically for it. A screen that
 * reaches past this wrapper gets none of those, and the one that would have
 * done it is the screen showing payment evidence.
 *
 * THE CALLER OWNS THE BLOB AND MUST REVOKE IT. This returns a Blob, not an
 * object URL, precisely so the revoke is visible at the call site where the
 * unmount is (ADU-SEC-01 S7): a helper that minted the URL would put the
 * createObjectURL and the revokeObjectURL in different files, and the leak
 * that follows keeps decrypted payment evidence alive in the tab for as long
 * as the tab lives.
 */
export async function apiBlob(path: string, opts: RequestOptions = {}): Promise<Blob> {
  const headers: Record<string, string> = { 'X-Adulis-Client': CLIENT_ID };
  if (opts.sellerId) headers['X-Adulis-Seller'] = opts.sellerId;
  if (opts.locale) headers['Accept-Language'] = opts.locale;

  let root: string;
  try {
    root = apiBase();
  } catch {
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
      method: 'GET',
      credentials: 'include',
      headers,
      signal: opts.signal ?? null,
    });
  } catch {
    throw new ApiError({
      type: 'about:blank',
      title_key: 'error.request.internal',
      status: 0,
      code: 'NETWORK',
      request_id: '',
      retryable: true,
    });
  }
  requestClock.last = Date.now();
  if (res.status === 401 && onUnauthorized) onUnauthorized();

  if (!res.ok) {
    // The error path IS json -- the problem envelope (ADU-API-01 S7) -- even
    // though the success path is bytes. Parsed defensively: a proxy's HTML
    // error page must not reach a screen as an unhandled SyntaxError.
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(await res.text());
    } catch {
      parsed = null;
    }
    throw new ApiError(
      (parsed as AdulisProblem | null) ?? {
        type: 'about:blank',
        title_key: 'error.request.internal',
        status: res.status,
        code: 'MALFORMED_RESPONSE',
        request_id: res.headers.get('X-Request-Id') ?? '',
        retryable: res.status >= 500,
      },
    );
  }
  return await res.blob();
}
