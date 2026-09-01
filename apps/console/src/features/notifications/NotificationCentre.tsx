/**
 * features/notifications/NotificationCentre.tsx -- SC-30 (v1.2 S12).
 * Chronological, unread marked in TEXT (never colour alone), each row
 * deep-linking to its object; read state is the SERVER's (read_at), so it
 * syncs with the Companion by construction -- the same rows, two surfaces.
 *
 * Titles render from template_key through the catalogue. The server's
 * template vocabulary is two-voiced -- dotted catalogue keys
 * (notification.chat.escalated) and UPPER enum keys (NEW_DEVICE_SIGNIN,
 * PAYOUT_CHANGE_*) -- so the UPPER family gets a transcribed label map (the
 * ITEM_LABEL rule: the keys are the server's verbatim, a key without a label
 * renders AS ITSELF, visible and greppable, never dropped).
 *
 * Deep links: order_id -> the order; slots.conversation_id -> the thread.
 * A row with neither carries no link, and that is the truth of the row.
 *
 * Both read POSTs are runIdempotent -- keys minted on mount, reminted after
 * each success (the Stock.tsx per-action pattern).
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en, type MessageKey } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { ScreenState } from '../../components/ScreenState';
import { useIdempotencyKey } from '../../lib/idempotency';
import type { UiState, AdulisProblem } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useMarketContext } from '../../lib/market';
import { timeFormatter } from '../../lib/intl';
import type { NotificationPage, NotificationRow } from '../conversation/types';

/** The UPPER template enums, labelled; the server's keys verbatim. */
const NOTIF_LABEL: Readonly<Record<string, string>> = {
  NEW_DEVICE_SIGNIN: en['console.notifications.tpl.new_device_signin'],
  PAYOUT_CHANGE_REQUESTED: en['console.notifications.tpl.payout_requested'],
  PAYOUT_CHANGE_ACTIVATED: en['console.notifications.tpl.payout_activated'],
  PAYOUT_CHANGE_CANCELLED: en['console.notifications.tpl.payout_cancelled'],
  OWNERSHIP_TRANSFER_REQUESTED: en['console.notifications.tpl.transfer_requested'],
  OWNERSHIP_TRANSFER_ACTIVATED: en['console.notifications.tpl.transfer_activated'],
  OWNERSHIP_TRANSFER_CANCELLED: en['console.notifications.tpl.transfer_cancelled'],
  STOCK_CONFIDENCE_NUDGE: en['console.notifications.tpl.stock_nudge'],
  TRIAL_ENDING: en['console.notifications.tpl.trial_ending'],
};

function title(row: NotificationRow): string {
  if (NOTIF_LABEL[row.template_key]) return NOTIF_LABEL[row.template_key] as string;
  const catalogue = en as Record<string, string>;
  return catalogue[row.template_key as MessageKey] ?? row.template_key;
}

export function NotificationCentre() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [rows, setRows] = useState<readonly NotificationRow[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<UiState>('LOADING');
  const [loadProblem, setLoadProblem] = useState<AdulisProblem | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const readKey = useIdempotencyKey();
  const readAllKey = useIdempotencyKey();

  const load = useCallback(async () => {
    if (!sellerId) return;
    setState((s) => (s === 'READY' || s === 'EMPTY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<NotificationPage>(`/notifications?as=seller&seller_id=${sellerId}`, {
        sellerId,
      });
      setRows(r.data);
      setNextCursor(r.next_cursor);
      setLoadProblem(null);
      setState(r.data.length === 0 ? 'EMPTY' : 'READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setLoadProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/notifications/${id}/read`, {
        method: 'POST',
        sellerId,
        idempotencyKey: readKey.current(),
      });
      readKey.remint();
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    if (!sellerId) return;
    setBusy(true);
    setProblem(null);
    try {
      await api(`/notifications/read-all`, {
        method: 'POST',
        sellerId,
        idempotencyKey: readAllKey.current(),
      });
      readAllKey.remint();
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'NO_PERMISSION') return null;
  if (rows === null) {
    return (
      <ScreenState
        state={state}
        onRetry={() => void load()}
        {...(loadProblem ? { problem: loadProblem } : {})}
      />
    );
  }

  const fmt = market ? timeFormatter(market) : null;

  const link = (row: NotificationRow) => {
    if (row.order_id) {
      return (
        <Link to={`/s/${sellerId}/orders/${row.order_id}`}>
          {en['console.notifications.open_order']}
        </Link>
      );
    }
    const conv = row.slots?.['conversation_id'];
    if (typeof conv === 'string') {
      return (
        <Link to={`/s/${sellerId}/inbox/${conv}`}>
          {en['console.notifications.open_conversation']}
        </Link>
      );
    }
    return null;
  };

  return (
    <section aria-labelledby="notifications-heading" data-screen="SC-30" className="notification-centre">
      <div className="notifications-header">
        <h1 id="notifications-heading">{en['console.notifications.heading']}</h1>
        {rows.length > 0 ? (
          <button type="button" className="button" disabled={busy} onClick={() => void markAllRead()}>
            {en['console.notifications.mark_all_read']}
          </button>
        ) : null}
      </div>

      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {state !== 'READY' && state !== 'STALE' && state !== 'EMPTY' ? (
        loadProblem ? (
          <ProblemBanner problem={loadProblem} />
        ) : (
          <p className="problem" role="alert">
            {en['console.common.refetch_failed']}
          </p>
        )
      ) : null}

      {rows.length === 0 ? (
        <div className="empty" data-state="EMPTY">
          <h3>{en['console.notifications.empty_heading']}</h3>
          <p>{en['console.notifications.empty_body']}</p>
          <Link className="button primary" to={`/s/${sellerId}`}>
            {en['console.notifications.open_home']}
          </Link>
        </div>
      ) : (
        <>
          <ul className="notification-list">
            {rows.map((n) => (
              <li key={n.id} className="notification-row">
                {/* Unread is TEXT (S14): state never rides colour alone. */}
                <span className={`badge badge-${n.read_at ? 'read' : 'unread'}`}>
                  {n.read_at
                    ? en['console.notifications.read']
                    : en['console.notifications.unread']}
                </span>
                <span className="notification-title">{title(n)}</span>
                <span className="notification-time">
                  {fmt ? fmt.format(new Date(n.scheduled_for)) : n.scheduled_for}
                </span>
                {link(n)}
                {!n.read_at ? (
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => void markRead(n.id)}
                  >
                    {en['console.notifications.mark_read']}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {nextCursor ? <p className="hint">{en['console.notifications.more_exist']}</p> : null}
        </>
      )}
    </section>
  );
}
