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

const base = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

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

  let res: Response;
  try {
    res = await fetch(`${base}/v1${path}`, {
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
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const parsed: unknown = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(parsed as AdulisProblem);
  return parsed as T;
}
