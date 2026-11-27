import { formatClock, t } from '../i18n/t';
import type { TransportError } from '../transport/port';

/**
 * One place that turns a transport problem into a sentence. Codes the replacement API already publishes use its
 * catalogue keys; OTP_*, RATE_LIMITED and the client-side codes use console keys (RB-B02A-02: the RATE_LIMITED error
 * contract is assigned to SC-BE-02). The retry time is the server's absolute instant, never a duration we invented.
 */
export function problemText(error: TransportError): string {
  switch (error.code) {
    case 'AUTHENTICATION_REQUIRED':
      return t('error.auth.authentication_required');
    case 'PERMISSION_DENIED':
      return t('error.rbac.permission_denied');
    case 'VALIDATION_FAILED':
      return t('error.request.validation_failed');
    case 'NOT_FOUND':
      return t('error.request.not_found');
    case 'OTP_INVALID':
      return t('error.otp.invalid');
    case 'OTP_EXPIRED':
      return t('error.otp.expired');
    case 'RATE_LIMITED':
      return error.retryAt ? t('error.rate_limited', { time: formatClock(error.retryAt) }) : t('error.rate_limited_no_time');
    case 'UNAVAILABLE':
      return t('error.unavailable');
    case 'NETWORK':
      return t('error.network');
    case 'CONTEXT_MISMATCH':
      return t('error.context_mismatch');
    case 'CONFLICT':
      return t('error.conflict');
    case 'REFUSED':
      return t('error.refused');
    case 'RETRY_STORE_FULL':
      return t('error.retry_store_full');
    case 'INTERNAL':
      return t('error.request.internal');
    default:
      // A code a newer client/server pair adds: say something rather than render an empty alert.
      return t('error.request.internal');
  }
}
