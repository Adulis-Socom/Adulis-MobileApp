import type { NextFunction, Response } from 'express';
import type { AuthedRequest } from '../auth/auth.guard';

/**
 * The locale stage (section 5). Two locales exist (ADU-PRD-01 S19): `en`
 * and `am`. The server RESOLVES and ECHOES the locale on every response
 * (ADU-API-01 section 14) and never renders with it — every string on the
 * wire is a message_key, and formatting is the client's per-locale job.
 *
 * Resolution is deliberately dumb: the first supported tag wins, English
 * otherwise. A missing Amharic CATALOGUE entry is the client build's
 * compile error (packages/locale), not a server concern.
 */

export type Locale = 'en' | 'am';

export interface LocalizedRequest extends AuthedRequest {
  locale?: Locale;
}

export function localeMiddleware(
  req: LocalizedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers['accept-language'] ?? '';
  const resolved: Locale = /(^|[,;\s])am\b/i.test(header) && !/^en\b/i.test(header.trim())
    ? 'am'
    : 'en';
  req.locale = resolved;
  res.setHeader('Content-Language', resolved);
  next();
}
