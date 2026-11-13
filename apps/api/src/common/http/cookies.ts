/**
 * common/http/cookies.ts -- one place that knows what a __Host- cookie is.
 *
 * ADU-SEC-01 S4: the __Host- prefix REQUIRES Secure, Path=/ and no Domain,
 * and a browser silently refuses a cookie whose name claims the prefix
 * without them. The helper existed inside auth.controller; bootstrap needs
 * the same rules now, and two copies of a security-relevant format string is
 * how one of them drifts.
 */

import { AdulisException } from '../errors/adulis-exception';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The console's session credential (ADU-API-01 S3). */
export const SESSION_COOKIE = '__Host-adulis_session';

/** The browser's device identity (ADU-RUL-03 S2). */
export const BROWSER_DEVICE_COOKIE = '__Host-adulis_browser';

/**
 * DELIBERATELY NOT the same cookie as R17's __Host-adulis_device, and the
 * distinction is load-bearing: that one is opt-in, revocable, and selects a
 * session lifetime; this one is always present and says which browser this
 * is. Collapsing them would make "forget this device" also forget that it is
 * the same device -- which is the signal the new-device payout lock reads.
 */
export const REMEMBERED_DEVICE_COOKIE = '__Host-adulis_device';

/** __Host- prefix requires Secure, Path=/, no Domain (ADU-SEC-01 S4). */
export const hostCookie = (name: string, value: string, maxAgeSeconds: number): string =>
  `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=/; Secure; HttpOnly; SameSite=Strict`;

/**
 * Expires a __Host- cookie now: logout, or a refused session cookie. Same
 * attributes, so the browser matches it. JavaScript cannot remove an HttpOnly
 * cookie, so the server is the only party that can.
 */
export const clearedHostCookie = (name: string): string =>
  `${name}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Strict`;

/**
 * The same cookie with no Max-Age: the browser keeps it for the session and
 * forgets it on restart. Used where there is no configured lifetime to state
 * honestly -- a cookie that lasts one session is still a cookie the browser
 * sends back, where omitting it entirely would silently disable the flow
 * that depends on it.
 */
export const sessionHostCookie = (name: string, value: string): string =>
  `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict`;

/** Read one cookie out of a request's Cookie header, or null. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * The surface a request came from, per ADU-API-01 S3's X-Adulis-Client
 * header: `android/1.6.2`, `ios/1.4.0`, `web/2026-08-24`. Always sent.
 *
 * This is the signal that tells the two device mechanisms apart, and it is
 * transcribed from the contract rather than invented: the token before the
 * slash is the surface.
 */
export type ClientSurface = 'web' | 'android' | 'ios' | 'unknown';

export function clientSurface(header: unknown): ClientSurface {
  if (typeof header !== 'string') return 'unknown';
  const token = header.split('/', 1)[0]?.trim().toLowerCase();
  return token === 'web' || token === 'android' || token === 'ios' ? token : 'unknown';
}

/**
 * Which device a request speaks for, BY SURFACE (ADU-RUL-03 S2).
 *
 * A web caller's identity is the httpOnly cookie /v1/bootstrap minted and
 * nothing else: its X-Adulis-Device is ignored here exactly as bootstrap and
 * otp/verify ignore it. An app presents its keystore id in the header. Both
 * are uuid-validated, because both reach uuid columns.
 *
 * Lives here rather than in a controller because two controllers need the
 * same answer, and a second copy of a security-relevant rule is how one of
 * them drifts.
 */
export function requestingDevice(headers: {
  cookie?: string | undefined;
  'x-adulis-device'?: string | string[] | undefined;
  'x-adulis-client'?: string | string[] | undefined;
}): string | null {
  const cookie = readCookie(headers.cookie, BROWSER_DEVICE_COOKIE);
  const fromCookie = cookie && UUID_RE.test(cookie) ? cookie : null;
  if (clientSurface(headers['x-adulis-client']) === 'web') return fromCookie;
  const header = headers['x-adulis-device'];
  if (typeof header === 'string' && UUID_RE.test(header)) return header;
  // An app that sent no header, or a caller naming no surface, may still be a
  // browser -- the cookie is httpOnly, so its presence is evidence.
  return fromCookie;
}

/**
 * The X-Adulis-Device header as sent: null when absent or empty, the id when
 * it is a uuid, and 400 VALIDATION_FAILED otherwise -- where the value is
 * used as given rather than resolved by surface, it reaches a uuid column,
 * and a malformed one used to answer 500 to an anonymous caller.
 */
export function deviceHeader(header: unknown): string | null {
  if (header === undefined || header === '') return null;
  if (typeof header !== 'string' || !UUID_RE.test(header)) {
    throw new AdulisException('VALIDATION_FAILED', { slots: { path: 'X-Adulis-Device' } });
  }
  return header;
}
