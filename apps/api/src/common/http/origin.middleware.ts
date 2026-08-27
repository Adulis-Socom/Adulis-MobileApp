import type { NextFunction, Response } from 'express';
import { AdulisException } from '../errors/adulis-exception';
import type { AuthedRequest } from '../auth/auth.guard';

/**
 * The Origin half of the CSRF pair (ADU-API-01 section 5.1). Two
 * INDEPENDENT controls guard the console's state-changing requests:
 * SameSite=Strict (browser behaviour) and this exact-match Origin check
 * (ours). Neither is trusted alone.
 *
 * The check binds to the requests a browser makes AS the console — the
 * ones carrying the session cookie. A bearer-token request (the mobile
 * app) sends no Origin and no cookie, and is not this control's subject:
 * CSRF rides ambient credentials, and a bearer header is never ambient.
 *
 * INVARIANT — the allow-list is exact, never a wildcard, never a suffix
 * match. Absent Origin on a cookie-carried write -> 403 (S5.1).
 */

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function makeOriginMiddleware(consoleOrigin: string) {
  return function originMiddleware(
    req: AuthedRequest,
    res: Response,
    next: NextFunction,
  ): void {
    if (!WRITE_METHODS.has(req.method)) return next();

    const carriesCookie = (req.headers.cookie ?? '').includes('__Host-adulis_session=');
    if (!carriesCookie) return next();

    const origin = req.headers.origin;
    if (origin !== consoleOrigin) {
      // 403 with the standing code; the body does not say which control
      // fired (the same reasoning as the U0001 uniformity rule).
      next(new AdulisException('PERMISSION_DENIED'));
      return;
    }
    next();
  };
}
