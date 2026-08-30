/**
 * common/http/cookies.ts -- one place that knows what a __Host- cookie is.
 *
 * ADU-SEC-01 S4: the __Host- prefix REQUIRES Secure, Path=/ and no Domain,
 * and a browser silently refuses a cookie whose name claims the prefix
 * without them. The helper existed inside auth.controller; bootstrap needs
 * the same rules now, and two copies of a security-relevant format string is
 * how one of them drifts.
 */

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
