import type { ChatMessage } from './chat';

/**
 * Relating an unconfirmed send to the conversation's history, with no clock of the device in it.
 *
 * A message row carries no key and no client id, so a row can never be proven to be one particular
 * attempt's: a match is a hint for the person, never a settlement. What the server's history held just
 * before the first attempt (its newest `sent_at`, and the ids that share it) is kept with the attempt;
 * a Buyer row with the same text that is newer than that watermark is a candidate. `sent_at` is the
 * server's clock and is only ever compared with another `sent_at`.
 */

/** The history as the server held it before the attempt began; null when it had not been read. */
export type Baseline = { newestSentAt: string | null; edgeIds: readonly string[] } | null;

export type PendingSend = { text: string; aboutProduct: boolean; baseline: Baseline };

/** `items` are newest first (as `useConversationMessages` returns them). */
export function captureBaseline(history: { read: boolean; items: readonly ChatMessage[] }): Baseline {
  if (!history.read) return null;
  const newest = history.items[0]?.sentAt ?? null;
  if (newest === null) return { newestSentAt: null, edgeIds: [] };
  const at = Date.parse(newest);
  return { newestSentAt: newest, edgeIds: history.items.filter((m) => Date.parse(m.sentAt) === at).map((m) => m.id) };
}

/**
 * The Buyer's own rows that could be this send: same sender, exactly the same text (the server stores
 * the trimmed text unchanged), the same kind of anchor, and newer than the baseline (or at its newest
 * instant under an id the baseline did not hold: a message and its automated answer share one instant).
 * `accepted` are ids the server already answered a send with: such a row is that earlier message, never
 * this one, whatever the baseline held (a read can land after the next message has begun).
 */
export function candidatesFor(
  pending: PendingSend,
  items: readonly ChatMessage[],
  accepted: readonly string[] = [],
): ChatMessage[] {
  const { baseline } = pending;
  if (baseline === null) return [];
  const mark = baseline.newestSentAt === null ? null : Date.parse(baseline.newestSentAt);
  return items.filter((m) => {
    if (m.kind !== 'BUYER' || m.body !== pending.text || m.aboutProduct !== pending.aboutProduct) return false;
    if (accepted.includes(m.id)) return false;
    if (mark === null) return true;
    const at = Date.parse(m.sentAt);
    return at > mark || (at === mark && !baseline.edgeIds.includes(m.id));
  });
}
