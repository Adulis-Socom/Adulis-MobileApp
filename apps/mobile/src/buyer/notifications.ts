import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { ApiError, isTransient, newIdempotencyKey, problemCode, wasAnswered } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { hasMessage } from '../i18n/i18n';
import { keepIfCurrent, usePrivateApi } from './saved';

/**
 * The Buyer notification inbox (WO-012; ADU-NOTIF-01 v3.3 S60-S61). Server state only:
 *
 * - GET /v1/notifications?as=buyer, bound to the session on screen (a late page for an earlier
 *   session is refused, never shown under another Account) and cleared with the whole cache by
 *   clearSession. Older pages load only when the Buyer asks (bounded, no polling); the query
 *   client refetches a stale inbox when the app returns to the foreground.
 * - POST /v1/notifications/{id}/read, one notification at a time, one key per notification kept
 *   across a lost connection. The read state shown is the server's answer, never assumed.
 * - A notification is never business truth (NOTIF-01 S2): nothing here acts on one, and no row
 *   opens a destination (the only reference rows carry is an Order, and Orders are not built).
 */

const NOTIFICATIONS = 'buyer-notifications';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const retry = (failures: number, error: unknown) => isTransient(error) && failures < 2;

export type BuyerNotification = {
  id: string;
  templateKey: string;
  slots: Record<string, unknown>;
  /** The Order the row is about, if any: presentation only, never authority. */
  aboutOrder: boolean;
  scheduledFor: string;
  readAt: string | null;
};
export type NotificationPage = { items: BuyerNotification[]; nextCursor: string | null };

const isIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));

/** One row as the server sends it, or null when it is not one (it is then not shown). */
function parseRow(row: unknown): BuyerNotification | null {
  const r = row as Record<string, unknown> | null;
  if (!r || typeof r.id !== 'string' || !UUID.test(r.id) || typeof r.template_key !== 'string') return null;
  if (!isIso(r.scheduled_for) || !(r.read_at === null || isIso(r.read_at))) return null;
  const slots = r.slots && typeof r.slots === 'object' && !Array.isArray(r.slots) ? (r.slots as Record<string, unknown>) : {};
  return {
    id: r.id,
    templateKey: r.template_key,
    slots,
    aboutOrder: typeof r.order_id === 'string' && r.order_id !== '',
    scheduledFor: r.scheduled_for,
    readAt: r.read_at,
  };
}

/** The page's shape is checked here (no published schema); a malformed row is dropped. */
export function parseNotificationPage(body: unknown): NotificationPage {
  const b = body as { data?: unknown; next_cursor?: unknown } | null;
  if (!b || !Array.isArray(b.data) || !(b.next_cursor === null || typeof b.next_cursor === 'string')) {
    throw new ApiError({ kind: 'unexpected', status: 200 });
  }
  return {
    items: b.data.map(parseRow).filter((n): n is BuyerNotification => n !== null),
    nextCursor: b.next_cursor,
  };
}

/** The only catalogue namespace a Buyer notification may render from (none is defined yet). */
const BUYER_TEMPLATES = 'notification.buyer.';

/**
 * The sentence a row shows: its template's catalogue sentence when the template key is a mobile
 * catalogue key in the Buyer notification namespace and every slot is present; otherwise the
 * generic sentence. A Seller sentence, an error string or any other catalogue key a row happens to
 * name is never rendered, and a raw template key or a sentence with holes is never shown.
 */
export function notificationText(t: (key: MobileMessageKey) => string, n: BuyerNotification): string {
  if (n.templateKey.startsWith(BUYER_TEMPLATES) && hasMessage(n.templateKey)) {
    const filled = fillSlots(t(n.templateKey), n.slots);
    if (filled) return filled;
  }
  return t('buyer.notifications.generic');
}

export function useBuyerNotifications() {
  const { session, boundApi } = useSession();
  const token = session.status === 'signedIn' ? session.token : null;
  const query = useInfiniteQuery({
    queryKey: [NOTIFICATIONS],
    queryFn: async ({ pageParam }: { pageParam: string | null }) =>
      parseNotificationPage(await keepIfCurrent(boundApi(token!), (api) => api.notifications(pageParam))),
    initialPageParam: null as string | null,
    // A cursor equal to the one just sent would page forever: treat it as the end.
    getNextPageParam: (last: NotificationPage, _all: NotificationPage[], lastParam: string | null) =>
      last.nextCursor !== null && last.nextCursor !== lastParam ? last.nextCursor : null,
    enabled: token !== null,
    retry,
  });
  // Pages are cut by timestamp: a row is shown once, in the first place it appears.
  const seen = new Set<string>();
  const items = (query.data?.pages ?? []).flatMap((p) => p.items).filter((n) => !seen.has(n.id) && seen.add(n.id));
  return { ...query, items };
}

/** Mark one notification read: the server's read_at, a key per notification, one request at a time. */
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const api = usePrivateApi();
  const keys = useRef(new Map<string, string>());
  const inFlight = useRef(new Set<string>());
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const toggle = (set: ReadonlySet<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
  };

  const mark = useCallback(
    async (id: string) => {
      if (!api || inFlight.current.has(id)) return;
      inFlight.current.add(id);
      setPending((s) => toggle(s, id, true));
      setFailed((s) => toggle(s, id, false));
      const key = keys.current.get(id) ?? newIdempotencyKey();
      keys.current.set(id, key);
      try {
        const body = (await api.markNotificationRead(id, key)) as { read_at?: unknown } | null;
        keys.current.delete(id);
        if (!api.isCurrent()) return;
        const readAt = body?.read_at;
        if (isIso(readAt)) {
          qc.setQueryData<InfiniteData<NotificationPage>>([NOTIFICATIONS], (data) =>
            data
              ? { ...data, pages: data.pages.map((p) => ({ ...p, items: p.items.map((n) => (n.id === id ? { ...n, readAt } : n)) })) }
              : data,
          );
        } else {
          // An answer without its read_at: read the inbox again rather than assume.
          void qc.invalidateQueries({ queryKey: [NOTIFICATIONS] });
        }
      } catch (error) {
        // A server answer ends the intent; offline or a timeout keeps the key for the retry.
        if (wasAnswered(error)) keys.current.delete(id);
        if (api.isCurrent()) {
          setFailed((s) => toggle(s, id, true));
          // Not this Account's (or gone): show what the server holds now instead of a stale row.
          if (problemCode(error) === 'NOT_FOUND') void qc.invalidateQueries({ queryKey: [NOTIFICATIONS] });
        }
      } finally {
        inFlight.current.delete(id);
        setPending((s) => toggle(s, id, false));
      }
    },
    [api, qc],
  );

  return { mark, pending, failed };
}
