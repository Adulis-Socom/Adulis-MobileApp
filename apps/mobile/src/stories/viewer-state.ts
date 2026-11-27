// Pure Story viewer rules (MOB-FE-02S MS-04, MS-08). No timer is specified for advancing, so none exists: movement is only ever
// a user action. Expiry is the SERVER's: this module only says when to ASK again, never that a Story has ended.
export type Direction = 'next' | 'previous';

/** Moves within one Seller's chronological Stories. At either end the index stays (no wrap, no auto-advance to another Seller). */
export function step(index: number, count: number, direction: Direction): number {
  if (count <= 0) return 0;
  const next = direction === 'next' ? index + 1 : index - 1;
  return Math.min(count - 1, Math.max(0, next));
}

/** A Story is presentable only before its known server expiry, measured on this device's clock (M01-R05). */
export const beforeExpiry = (expiresAt: string, now: number): boolean => {
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at > now;
};

/** Time left in coarse words: never a countdown that implies precision the device clock does not have. */
export type TimeLeft = { readonly key: 'mobile.stories.time_left.less_than_hour' | 'mobile.stories.time_left.one_hour' } | { readonly key: 'mobile.stories.time_left.hours'; readonly hours: number };
export function timeLeft(expiresAt: string, now: number): TimeLeft | null {
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return null;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return { key: 'mobile.stories.time_left.less_than_hour' };
  if (hours === 1) return { key: 'mobile.stories.time_left.one_hour' };
  return { key: 'mobile.stories.time_left.hours', hours };
}

/** The largest delay a platform timer accepts (a larger one fires immediately on some engines). */
export const MAX_TIMER_MS = 2_147_483_647;

/**
 * When to re-read so the server can say what is still public: the milliseconds until the server-authored expiry, or null when
 * the instant is unreadable or already past. A past instant is NOT "expired": the read that produced it was fresh and the
 * server's answer stands (device clocks are wrong often enough that a local verdict would hide a live Story).
 */
export function msUntilReread(expiresAt: string, now: number): number | null {
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at)) return null;
  const ms = at - now;
  return ms > 0 ? Math.min(ms, MAX_TIMER_MS) : null;
}
