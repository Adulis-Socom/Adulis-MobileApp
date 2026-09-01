/**
 * features/catalogue/Stock.tsx -- SC-11, ADU-CON-03 v1.2 S8.
 *
 * Route /s/:sellerId/products/:productId/stock, and inline on SC-09.
 * POST /v1/seller/variants/{id}/stock - POST .../confirm-stock -
 * GET .../stock-events. Permissions seller.stock:write / seller.stock:read.
 *
 * ==========================================================================
 * TWO DISTINCT ACTIONS THAT MUST NEVER BE CONFLATED (S8)
 * ==========================================================================
 * SET THE COUNT writes a stock event and changes the number.
 * CONFIRM STOCK IS ACCURATE changes no number -- it resets stock_confirmed_at
 * and clears the confidence warning.
 *
 * "A seller whose count is right but stale needs the second, and if the UI
 * only offers the first they will re-enter the same number to clear the
 * warning -- which works, but teaches them the wrong model." So the two are
 * separate controls with separate copy, never one field that does both.
 *
 * STOCK IS EVENTS, NEVER A NUMBER THE CLIENT COMPUTES (S8, T7 rule 1). The
 * count shown is the server's `stock_count`; a set sends a delta or an
 * absolute count and the SERVER writes the event and returns the new count.
 * This screen never adds or subtracts to guess the result.
 *
 * WHAT THE CONTRACT DOES NOT SUPPLY, stated rather than faked: the confidence
 * LEVEL (1-5) and its per-tier consequences are the server's v_stock_confidence
 * and entitlement, and neither the product read nor these endpoints return
 * them. So this screen shows stock_confirmed_at as a plain fact ("confirmed at
 * <time>" / "not confirmed yet") and does NOT derive a level or promise a
 * consequence -- deriving one would be computing business state, and naming a
 * consequence the seller's tier cannot experience is what S4.3 forbids.
 * Registered.
 */
import { useCallback, useEffect, useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import { ProblemBanner } from '../../components/Feedback';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useIdempotencyKey } from '../../lib/idempotency';
import { useMarketContext } from '../../lib/market';
import { timeFormatter, fillTemplate } from '../../lib/intl';
import type { StockEventPage, StockEvent } from './types';

interface Props {
  readonly sellerId: string;
  readonly variantId: string;
  readonly stockCount: number;
  readonly stockConfirmedAt: string | null;
  /** Called after a set or a confirm so the parent can refetch the product. */
  readonly onChanged: () => void;
}

export function Stock({ sellerId, variantId, stockCount, stockConfirmedAt, onChanged }: Props) {
  const market = useMarketContext();
  const [count, setCount] = useState<string>(String(stockCount));
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const setKey = useIdempotencyKey();
  const confirmKey = useIdempotencyKey();

  // History
  const [histState, setHistState] = useState<UiState>('LOADING');
  const [events, setEvents] = useState<readonly StockEvent[]>([]);

  useEffect(() => {
    setCount(String(stockCount));
  }, [stockCount]);

  const loadHistory = useCallback(async () => {
    setHistState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const r = await api<StockEventPage>(`/seller/variants/${variantId}/stock-events`, { sellerId });
      setEvents(r.data);
      setHistState(r.data.length === 0 ? 'EMPTY' : 'READY');
    } catch (e) {
      setHistState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
    }
  }, [sellerId, variantId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const setStock = async () => {
    setFieldError(null);
    if (count.trim() === '' || Number.isNaN(Number(count))) {
      setFieldError(en['console.catalogue.stock.count_required']);
      return;
    }
    const n = Number(count);
    if (!Number.isInteger(n) || n < 0) {
      setFieldError(en['console.catalogue.stock.count_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      // An ABSOLUTE count. The server computes the delta and writes the event.
      await api(`/seller/variants/${variantId}/stock`, {
        method: 'POST',
        sellerId,
        idempotencyKey: setKey.current(),
        body: { count: n },
      });
      setKey.remint();
      onChanged();
      void loadHistory();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const confirmStock = async () => {
    setBusy(true);
    setProblem(null);
    try {
      // Changes NO number: resets stock_confirmed_at only.
      await api(`/seller/variants/${variantId}/confirm-stock`, {
        method: 'POST',
        sellerId,
        idempotencyKey: confirmKey.current(),
      });
      confirmKey.remint();
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const time = market ? timeFormatter(market) : null;
  const fmt = (iso: string): string => (time ? time.format(new Date(iso)) : iso);

  return (
    <div className="stock" data-screen="SC-11">
      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}

      <div className="stock-set">
        <label htmlFor={`stock-${variantId}`}>{en['console.catalogue.stock.count_label']}</label>
        <input
          id={`stock-${variantId}`}
          type="number"
          min={0}
          inputMode="numeric"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
        <button type="button" className="button primary" disabled={busy} onClick={() => void setStock()}>
          {en['console.catalogue.stock.set']}
        </button>
      </div>

      {/* The SECOND action, visibly separate. It changes no number. */}
      <div className="stock-confirm">
        <p className="stock-confirmed-at">
          {stockConfirmedAt
            ? fillTemplate(en['console.catalogue.stock.confirmed_at'], { time: fmt(stockConfirmedAt) })
            : en['console.catalogue.stock.never_confirmed']}
        </p>
        <button type="button" className="button" disabled={busy} onClick={() => void confirmStock()}>
          {en['console.catalogue.stock.confirm']}
        </button>
        <p className="hint">{en['console.catalogue.stock.confidence_owed']}</p>
      </div>

      <section aria-labelledby={`hist-${variantId}`} className="stock-history">
        <h3 id={`hist-${variantId}`}>{en['console.catalogue.stock.history_heading']}</h3>
        {histState === 'EMPTY' ? (
          <ScreenState state="EMPTY" emptyText={en['console.catalogue.stock.history_empty']} />
        ) : histState === 'READY' || histState === 'STALE' ? (
          <ScreenState state={histState}>
            <ul className="stock-events">
              {events.map((ev) => (
                <li key={ev.id}>
                  <span className="stock-delta">{ev.delta > 0 ? `+${ev.delta}` : String(ev.delta)}</span>
                  <span className="stock-reason">{ev.reason}</span>
                  <span className="stock-result">{ev.resulting_count}</span>
                  <span className="stock-when">{fmt(ev.occurred_at)}</span>
                </li>
              ))}
            </ul>
          </ScreenState>
        ) : (
          <ScreenState state={histState} onRetry={() => void loadHistory()} />
        )}
      </section>
    </div>
  );
}
