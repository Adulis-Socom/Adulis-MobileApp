import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useQuery } from '@tanstack/react-query';

import { ApiError, isTransient, type AccountSession, type ProblemItem } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { hasMessage } from '../i18n/i18n';
import { keepIfCurrent } from './saved';

/**
 * The You tab's server reads and the Account deletion boundary (WO-011).
 *
 * Sessions: GET /v1/auth/sessions, bound to the session on screen (a late answer for an earlier
 * session is refused, never shown under another Account) and cleared with the whole cache by
 * clearSession.
 *
 * Deletion: the existing deletion-ticket flow (ADU-API-01 v1.11 S12.18). The contract publishes
 * no schemas for it (ON-20261111-135), so each answer is checked here and anything else is a
 * contract failure, never a guess. The ticket lives in the flow's memory only.
 */

const SESSIONS = 'account-sessions';
const retry = (failures: number, error: unknown) => isTransient(error) && failures < 2;

export function useAccountSessions() {
  const { session, boundApi } = useSession();
  const token = session.status === 'signedIn' ? session.token : null;
  return useQuery<AccountSession[]>({
    queryKey: [SESSIONS],
    queryFn: async () => (await keepIfCurrent(boundApi(token!), (api) => api.sessions())).data,
    enabled: token !== null,
    staleTime: 0,
    gcTime: 60_000,
    retry,
  });
}

/** A device line for a session: the platform the server recorded, never a guess. */
export function sessionDeviceKey(session: AccountSession): MobileMessageKey {
  switch (session.device_platform) {
    case 'ANDROID':
      return 'buyer.you.session.platform.android';
    case 'IOS':
      return 'buyer.you.session.platform.ios';
    case 'WEB':
      return 'buyer.you.session.platform.web';
    default:
      return 'buyer.you.session.platform.unknown';
  }
}

/** An answer that is not what the deletion endpoints return: a contract failure. */
const contractFailure = () => new ApiError({ kind: 'unexpected', status: 200 });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The server's own ticket lifetime (deletion.controller: fifteen minutes). */
export const TICKET_LIFETIME_MS = 15 * 60 * 1000;

export type DeletionTicket = { ticket: string; deadline: number };

/**
 * POST /v1/deletion/otp/verify's answer: `{ ticket, expires_at, scope: 'ACCOUNT_DELETION' }`. The
 * deadline is the earlier of the server's expiry and fifteen minutes from receipt, so a device
 * clock that runs behind never stretches the ticket; one that runs ahead only ends it sooner.
 */
export function parseTicket(body: unknown, receivedAt: number): DeletionTicket {
  const b = body as { ticket?: unknown; expires_at?: unknown; scope?: unknown } | null;
  if (!b || typeof b.ticket !== 'string' || !UUID.test(b.ticket) || b.scope !== 'ACCOUNT_DELETION') {
    throw contractFailure();
  }
  const expires = typeof b.expires_at === 'string' ? Date.parse(b.expires_at) : NaN;
  if (Number.isNaN(expires)) throw contractFailure();
  return { ticket: b.ticket, deadline: Math.min(expires, receivedAt + TICKET_LIFETIME_MS) };
}

export type DeletionLine = { key: MobileMessageKey; text: string };
export type DeletionPreview = {
  blockers: DeletionLine[];
  effects: DeletionLine[];
  /** A blocker or effect the app cannot render: confirmation is withheld (never a raw key). */
  incomplete: boolean;
};

type Translate = (key: MobileMessageKey) => string;

/** One server line (a blocker item or an effect) as a catalogue sentence, or null. */
function line(t: Translate, item: { message_key?: unknown; slots?: unknown }): DeletionLine | null {
  const key = typeof item.message_key === 'string' ? item.message_key : null;
  if (!hasMessage(key)) return null;
  const slots = item.slots && typeof item.slots === 'object' ? (item.slots as Record<string, unknown>) : undefined;
  const text = fillSlots(t(key), slots);
  return text === null ? null : { key, text };
}

function lines(t: Translate, items: readonly { message_key?: unknown; slots?: unknown }[]) {
  const rendered = items.map((item) => line(t, item));
  return { lines: rendered.filter((l): l is DeletionLine => l !== null), complete: rendered.every((l) => l !== null) };
}

/**
 * GET /v1/deletion/preview's answer: `{ items: blockers[], effects: [{ code, message_key }] }`.
 * The consequences are the server's (ADU-MOB-02 R-11: Mobile and the website share the policy's
 * wording, never re-author it). Every line must render before the Buyer may confirm.
 */
export function parsePreview(t: Translate, body: unknown): DeletionPreview {
  const b = body as { items?: unknown; effects?: unknown } | null;
  if (!b || !Array.isArray(b.items) || !Array.isArray(b.effects)) throw contractFailure();
  const blockers = lines(t, b.items as ProblemItem[]);
  const effects = lines(t, b.effects as { message_key?: unknown }[]);
  return {
    blockers: blockers.lines,
    effects: effects.lines,
    incomplete: !blockers.complete || !effects.complete || effects.lines.length === 0,
  };
}

/** The blockers a 409 DELETION_BLOCKED carries in its items[], rendered the same way. */
export function blockersOf(t: Translate, error: unknown): DeletionPreview | null {
  if (!(error instanceof ApiError) || error.failure.kind !== 'problem' || error.failure.problem.code !== 'DELETION_BLOCKED') {
    return null;
  }
  const blockers = lines(t, error.failure.problem.items ?? []);
  return { blockers: blockers.lines, effects: [], incomplete: !blockers.complete };
}

/** POST /v1/deletion/confirm's answer: `{ deleted: true }`. Anything else is not a deletion. */
export function confirmedDeletion(body: unknown): boolean {
  return (body as { deleted?: unknown } | null)?.deleted === true;
}
