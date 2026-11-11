import { isPathName, isPublicRef } from '../buyer/public-read';

/**
 * Where a finished sign-in returns the Buyer: only these Buyer destinations, because a
 * route parameter is untrusted input (ADU-MOB-02 v4.3 S54) and must never steer navigation
 * somewhere it names. Anything else returns to You.
 *
 * Besides the fixed tabs, a guest Save (WO-009) returns to the Product or Scene it was tapped
 * on: an in-app path rebuilt here from parts each checked against the public read's own
 * patterns -- never a scheme, host, query or anything else the parameter carried.
 */
const RETURN_TO = ['/home/for-you', '/saved', '/orders', '/account', '/notifications', '/messages'] as const;
export type ReturnTo = (typeof RETURN_TO)[number] | `/product/${string}/${string}` | `/scenes/${string}`;

export function parseReturnTo(value: unknown): ReturnTo {
  if (typeof value !== 'string') return '/account';
  if ((RETURN_TO as readonly string[]).includes(value)) return value as ReturnTo;
  const product = /^\/product\/([^/]+)\/([^/]+)$/.exec(value);
  if (product && isPathName(product[1]) && isPathName(product[2])) return `/product/${product[1]}/${product[2]}`;
  const scene = /^\/scenes\/([^/]+)$/.exec(value);
  if (scene && isPublicRef(scene[1])) return `/scenes/${scene[1]}`;
  return '/account';
}

/**
 * The guest Save continuation (WO-009 S16): the nonce of the Save this app run armed in memory
 * when the guest tapped it. A link cannot know it, so a link alone never saves anything.
 */
export function parseSaveNonce(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value) ? value : null;
}

/**
 * The phone as the user typed it, without the spaces, dashes and brackets people type for
 * readability. Nothing else is rewritten: the backend owns normalisation and validates
 * E.164, so the app neither guesses a country code nor reformats digits.
 */
export function cleanPhone(input: string): string {
  return input.replace(/[\s\-().]/g, '');
}

// The contract's own pattern for `phone` (OtpRequestBodyDto, E.164) and for `code`.
export const isE164 = (phone: string) => /^\+[1-9][0-9]{7,14}$/.test(phone);
export const isOtpCode = (code: string) => /^[0-9]{6}$/.test(code);
