// What a sign-in refusal says. The server's own message (a catalogue KEY) wins; otherwise the code picks a generic sentence.
// Nothing here says whether a number belongs to an Operator or to anyone at all (no enumeration): every other code is generic.
import type { SignInRefusal } from '../contracts/gap-mob-session';
import { serverText, type UiMessageKey } from '../i18n/messages';

export function refusalKey(code: SignInRefusal['code']): UiMessageKey {
  switch (code) {
    case 'OTP_INVALID':
      return 'mobile.auth.refused.otp_invalid';
    case 'OTP_EXPIRED':
      return 'mobile.auth.refused.otp_expired';
    case 'RATE_LIMITED':
      return 'mobile.auth.refused.rate_limited';
    case 'NETWORK':
    case 'TIMEOUT':
      return 'mobile.auth.refused.network';
    default:
      return 'mobile.auth.refused.generic';
  }
}

/**
 * A response that is not an ordinary MOBILE principal (an Operator identifier, say) gets the SAME sentence as an unknown
 * number gets: the screen never states or implies what kind of identity the identifier belongs to (no enumeration).
 */
export const SURFACE_REFUSAL_KEY: UiMessageKey = refusalKey('OTP_INVALID');

export const refusalText =(refusal: SignInRefusal): string => serverText(refusal.message, refusalKey(refusal.code));
