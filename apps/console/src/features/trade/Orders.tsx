/**
 * features/trade/Orders.tsx -- SC-03, ADU-CON-03 v1.1 S7.
 *
 * Route /s/:sellerId/orders - GET /v1/seller/orders - seller.orders:read.
 *
 * ==========================================================================
 * THE CLOCK IS THE SCREEN
 * ==========================================================================
 * S7: "The clock changes meaning with state, and the row must not use one
 * countdown for all of them." Every row therefore asks lib/clock.tsx which
 * deadline governs, and renders that one or none. This screen owns no clock
 * logic of its own -- SC-04 asks the same module the same question, and the
 * two agreeing is not a coincidence to be maintained by care.
 *
 * ==========================================================================
 * TWO THINGS S7 ASKS FOR THAT THE SERVER CANNOT ANSWER, STATED ON SCREEN
 * ==========================================================================
 * 1. THE BUYER'S FIRST NAME. There is no name anywhere in the data model.
 *    `core.person` holds a keyed hash and nothing else, deliberately -- the
 *    migration says so: a date of birth "would be data collected for no
 *    purpose, and data minimisation is a live obligation." `core.account`
 *    holds a phone number. `core.buyer_profile` is an anchor with no payload.
 *    So the row cannot name the buyer, and S7's own rule forbids the obvious
 *    substitute: "Never a raw phone number where a conversation exists."
 *    Registered as D-153. NOT invented, and not silently dropped either --
 *    a row that just omits it reads as a screen nobody finished.
 *
 * 2. SERVER-SIDE FILTERING. `GET /v1/seller/orders` takes `limit` and
 *    `cursor` and nothing else. The filter row S7 lists therefore filters
 *    WHAT HAS BEEN LOADED, and says so, because a "cancelled" tab that reads
 *    empty while a cancelled order sits on page three is worse than no tab.
 *    Registered as D-154.
 *
 * ==========================================================================
 * PAGINATION IS A CURSOR, NEVER AN OFFSET (S7)
 * ==========================================================================
 * The server returns `next_cursor`; this screen sends it back. It never
 * computes a page number, and there is no page size in this file that the
 * server does not also know.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { formatMinor, fillTemplate } from '../../lib/intl';
import { useMarketContext } from '../../lib/market';
import { Deadline, clockFor, type OrderState } from '../../lib/clock';
import type { OrderPage, OrderRow } from './types';
import { StateBadge } from './StateBadge';

/**
 * The four buckets S7 names, over the nine order states. A GROUPING OF
 * SERVER-RESOLVED STATES, which is presentation; it decides nothing and
 * unlocks nothing. Every state appears in exactly one bucket, and the
 * exhaustiveness is checked below rather than assumed.
 */
const BUCKET = {
  needs_action: ['PAYMENT_SUBMITTED'],
  active: ['CREATED', 'NOTIFIED', 'PAYMENT_CONFIRMED', 'HANDED_OFF'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED_BY_BUYER', 'CANCELLED_BY_SELLER', 'EXPIRED_UNCLAIMED'],
} as const satisfies Record<string, readonly OrderState[]>;

type Filter = keyof typeof BUCKET | 'all';

const FILTERS: readonly Filter[] = ['all', 'needs_action', 'active', 'completed', 'cancelled'];

const FILTER_LABEL: Readonly<Record<Filter, string>> = {
  all: en['console.trade.filter.all'],
  needs_action: en['console.trade.filter.needs_action'],
  active: en['console.trade.filter.active'],
  completed: en['console.trade.filter.completed'],
  cancelled: en['console.trade.filter.cancelled'],
};

function inBucket(state: OrderState, f: Filter): boolean {
  if (f === 'all') return true;
  return (BUCKET[f] as readonly string[]).includes(state);
}

export function Orders() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [state, setState] = useState<UiState>('LOADING');
  const [rows, setRows] = useState<readonly OrderRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  /**
   * `append` is the pagination flag. A reload (or a countdown reaching zero)
   * REPLACES; "load more" appends. They are one function because they are one
   * request, and because a refetch that appended would duplicate every row on
   * screen the moment a deadline passed.
   */
  const load = useCallback(
    async (append: boolean, from: string | null) => {
      if (!sellerId) return;
      setState((s) => (s === 'READY' && !append ? 'STALE' : append ? 'STALE' : 'LOADING'));
      try {
        const q = from ? `?cursor=${encodeURIComponent(from)}` : '';
        const r = await api<OrderPage>(`/seller/orders${q}`, { sellerId });
        setRows((prev) => (append ? [...prev, ...r.data] : r.data));
        setCursor(r.next_cursor);
        setHasMore(r.has_more);
        setProblem(null);
        setState('READY');
      } catch (e) {
        if (e instanceof ApiError) {
          setProblem(e);
          setState(stateFromProblem(e.problem));
        } else {
          setProblem(null);
          setState('TRANSPORT_ERROR');
        }
      }
    },
    [sellerId],
  );

  useEffect(() => {
    void load(false, null);
  }, [load]);

  const reload = useCallback(() => void load(false, null), [load]);

  const shown = useMemo(() => rows.filter((r) => inBucket(r.state, filter)), [rows, filter]);

  // EMPTY is mandatory on every list (S3.2), and it is about the REQUEST,
  // not about the filter: zero orders and zero orders matching a tab are
  // different facts and a seller told "no orders" while holding twelve
  // cancelled ones has been told something false.
  const listState: UiState = state === 'READY' && rows.length === 0 ? 'EMPTY' : state;

  return (
    <main className="screen orders">
      <h1>{en['console.trade.orders.title']}</h1>

      <ScreenState
        state={listState}
        {...(problem ? { problem: problem.problem } : {})}
        onRetry={reload}
        emptyText={en['console.trade.orders.empty']}
      >
        {/* D-153. Stated once, above the list, rather than per row: a row is
            not the place to explain a data-model absence, and repeating it
            nine times makes the list unreadable. */}
        <p className="hint" data-gap="D-153">
          {en['console.trade.orders.no_buyer_name']}
        </p>

        <div className="filter-row" role="group" aria-label={en['console.trade.filter.legend']}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              data-filter={f}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
        {/* D-154 -- and it is deliberately NOT hidden behind the "all" tab.
            The limitation is true of every tab; it is only VISIBLE on the
            narrow ones. */}
        <p className="hint" data-gap="D-154">
          {en['console.trade.orders.filter_is_local']}
        </p>

        {shown.length === 0 && rows.length > 0 ? (
          <p className="empty" data-empty="filter">
            {en['console.trade.orders.none_in_filter']}
          </p>
        ) : (
          <ul className="order-list">
            {shown.map((o) => (
              <li key={o.id} className="order-row" data-order={o.id} data-order-state={o.state}>
                <Link className="order-link" to={o.id}>
                  <StateBadge state={o.state} />
                  <span className="order-lines">
                    {fillTemplate(en['console.trade.orders.line_count'], {
                      count: String(o.line_count),
                    })}
                  </span>
                  <span className="order-total">
                    {market ? formatMinor(market, o.total.amount_minor) : ''}
                  </span>
                  {/*
                    THE CLOCK THAT MATTERS, and for a paid order that is no
                    clock: <Deadline> renders null for kind NONE, so the row
                    has no clock region at all rather than a stopped one.
                    onElapsed refetches -- the row never decides.
                  */}
                  <Deadline clock={clockFor(o)} onElapsed={reload} />
                </Link>
                {/*
                  "A single primary action if one is available." Without
                  `allowed_actions` (which no endpoint returns -- D-155) the
                  only action this screen can offer honestly is NAVIGATION to
                  where the decision is made. It is not an outcome-bearing
                  control and does not claim to be.
                */}
                {o.state === 'PAYMENT_SUBMITTED' ? (
                  <Link className="order-primary" to={o.id} data-primary="review_payment">
                    {en['console.trade.orders.review_payment']}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {hasMore ? (
          <button type="button" className="load-more" onClick={() => void load(true, cursor)}>
            {en['console.trade.orders.load_more']}
          </button>
        ) : null}
      </ScreenState>
    </main>
  );
}
