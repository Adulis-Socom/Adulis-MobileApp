import { formatCalendarDay, formatDate, formatDateTime } from './i18n';

/**
 * Server dates are shown through one helper that never throws and never prints "Invalid Date" (BUY-04). A
 * value that is not a date is null, and a sentence whose slot is null is left out by fillSlots.
 */

const BAD: readonly (string | null | undefined)[] = ['not-a-date', '', '2026-13-45T99:99:99Z', 'Invalid Date', null, undefined];

describe('formatDateTime, formatDate and formatCalendarDay', () => {
  it.each(BAD)('give null, not a throw and not "Invalid Date", for %p', (value) => {
    for (const locale of ['en', 'am'] as const) {
      expect(() => formatDateTime(locale, value)).not.toThrow();
      expect(formatDateTime(locale, value)).toBeNull();
      expect(formatDate(locale, value)).toBeNull();
      expect(formatCalendarDay(locale, value)).toBeNull();
    }
  });

  it('format a real instant in both locales', () => {
    for (const locale of ['en', 'am'] as const) {
      const dateTime = formatDateTime(locale, '2026-11-08T10:00:00.000Z');
      expect(dateTime).toEqual(expect.any(String));
      expect(dateTime).not.toMatch(/Invalid/);
      expect(formatDate(locale, '2026-11-08T10:00:00.000Z')).toEqual(expect.any(String));
    }
  });

  it('read a calendar day as that day (UTC; Jest sets no time zone, so a device west of UTC is not exercised here)', () => {
    expect(formatCalendarDay('en', '2026-03-01')).toBe('Mar 1, 2026');
    expect(formatCalendarDay('en', '2024-02-29')).toBe('Feb 29, 2024');
  });

  it('refuse a malformed day and a day that does not exist (it would roll over into the next month)', () => {
    expect(formatCalendarDay('en', '2026-03-01T00:00:00Z')).toBeNull();
    expect(formatCalendarDay('en', '2026-3-1')).toBeNull();
    expect(formatCalendarDay('en', '2026-02-30')).toBeNull();
    expect(formatCalendarDay('en', '2026-13-01')).toBeNull();
    expect(formatCalendarDay('en', '2025-02-29')).toBeNull();
  });
});
