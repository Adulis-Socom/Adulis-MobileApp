/**
 * Where a finished sign-in returns the Buyer: only these Buyer destinations, because a
 * route parameter is untrusted input (ADU-MOB-02 v4.3 S54) and must never steer navigation
 * somewhere it names. Anything else returns to You.
 */
const RETURN_TO = ['/home/for-you', '/saved', '/orders', '/account', '/notifications'] as const;
export type ReturnTo = (typeof RETURN_TO)[number];

export function parseReturnTo(value: unknown): ReturnTo {
  return typeof value === 'string' && (RETURN_TO as readonly string[]).includes(value)
    ? (value as ReturnTo)
    : '/account';
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
