import { en, format, type MessageKey } from '@adulis/locale';

/** The only message accessor: typed keys, typed slots, English-first (a missing Amharic key is a compile error). */
export const t = format;
export type { MessageKey };

/**
 * Text for a key built from a SERVER CODE (reason, alert, notification...). A code a newer server adds is shown
 * through the `unknown` sibling with the code itself, never dropped, because dropping hides a blocker or an alert.
 */
export function codeText(prefix: string, code: string): string | null {
  const key = `${prefix}.${code}`;
  return Object.hasOwn(en, key) ? en[key as MessageKey] : null;
}

/** A label for a server value (status, role, platform...): the catalogue entry, or the raw code when this version does not know it. */
export function label(prefix: string, code: string): string {
  return codeText(prefix, code) ?? code;
}

/** Whole-instant formatting. UTC instants from the API are shown in the Market's IANA timezone when it is known. */
export function formatInstant(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    // timeStyle cannot be combined with timeZoneName (a TypeError): the 'long' style carries the zone name itself.
    timeStyle: timeZone ? 'short' : 'long',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en', { timeStyle: 'long' }).format(date);
}
