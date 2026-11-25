import { describe, expect, it } from 'vitest';
import { codeText, formatClock, formatInstant, label, t } from './t';

/**
 * These exist because `Intl.DateTimeFormat` rejects `timeStyle` combined with `timeZoneName` with a TypeError, which blanked
 * the OTP screen in CI. Both formatting branches (with and without a Market timezone) are exercised on a fixed instant.
 */
describe('time formatting', () => {
  const instant = '2026-11-25T09:00:30.000Z';

  it('formats an instant in the Market timezone when it is known', () => {
    expect(formatInstant(instant, 'Africa/Addis_Ababa')).toMatch(/Nov 25, 2026/);
    expect(formatInstant(instant, 'Africa/Addis_Ababa')).toMatch(/12:00/); // UTC+3
    expect(formatInstant(instant, 'UTC')).toMatch(/9:00/);
  });

  it('formats an instant WITHOUT a timezone (the Market read failed) and names the zone instead of guessing', () => {
    expect(() => formatInstant(instant)).not.toThrow();
    expect(formatInstant(instant)).toMatch(/Nov 2[56], 2026/);
  });

  it('formats a clock time with its zone, and passes an unparseable value through rather than throwing', () => {
    expect(() => formatClock(instant)).not.toThrow();
    expect(formatClock(instant)).toMatch(/\d{1,2}:\d{2}:\d{2}/);
    expect(formatClock('not a date')).toBe('not a date');
    expect(formatInstant('not a date')).toBe('not a date');
  });
});

describe('server-code text', () => {
  it('shows the catalogue entry for a known code and null for an unknown one', () => {
    expect(codeText('reason', 'SOCIAL_ACCOUNT_REQUIRED')).toBe('Connect a TikTok or Instagram account.');
    expect(codeText('reason', 'BRAND_NEW_CODE')).toBeNull();
  });

  it('label() never throws on an unknown server value: it shows the raw code', () => {
    expect(label('seller.status', 'ACTIVE')).toBe('Active');
    expect(label('seller.status', 'ARCHIVED')).toBe('ARCHIVED');
    expect(label('platform', 'MASTODON')).toBe('MASTODON');
  });

  it('a slotted message fills its slots', () => {
    expect(t('readiness.summary', { met: 2, total: 6 })).toBe('2 of 6 requirements are met.');
  });
});
