import { en, type MobileMessageKey } from '@adulis/locale/mobile';

import { ApiError } from './client';

const isMobileKey = (key: unknown): key is MobileMessageKey => typeof key === 'string' && key in en;

/** Fill a catalogue sentence's {slots}; null if any slot has no value. */
export function fillSlots(template: string, slots: Record<string, unknown> | undefined): string | null {
  let missing = false;
  const filled = template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const value = slots?.[name];
    if (value === undefined || value === null) {
      missing = true;
      return '';
    }
    return String(value);
  });
  return missing ? null : filled;
}

/**
 * What to tell the Buyer about a failed request, from the catalogue only: connectivity
 * failures by kind, server problems by their own message key and slots (never by English
 * text). A key outside the mobile catalogue, or a sentence whose slots the server did not
 * fill, falls back to the generic error rather than showing a raw key or a gap.
 */
export function failureMessage(t: (key: MobileMessageKey) => string, error: unknown): string {
  if (error instanceof ApiError) {
    const { failure } = error;
    if (failure.kind === 'offline') return t('common.offline');
    if (failure.kind === 'timeout') return t('common.timeout');
    if (failure.kind === 'problem' && isMobileKey(failure.problem.title_key)) {
      const message = fillSlots(t(failure.problem.title_key), failure.problem.slots);
      if (message) return message;
    }
  }
  return t('error.request.internal');
}
