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
 * 2. SERVER-SIDE BUCKETS (T15, D-154 answered). `GET /v1/seller/orders`
 *    now takes a `bucket` parameter and the server owns its membership --
 *    "needs action" is a SET of states and which states belong is a product
 *    decision, not the console's. The tab sends a bucket NAME and renders
 *    what returns; the page-local grouping and its sentence are gone.
 *
 * ==========================================================================
 * PAGINATION IS A CURSOR, NEVER AN OFFSET (S7)
 * ==========================================================================
 * The server returns `next_cursor`; this screen sends it back. It never
 * computes a page number, and there is no page size in this file that the
 * server does not also know.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { formatMinor, fillTemplate } from '../../lib/intl';
import { useMarketContext } from '../../lib/market';
import { Deadline, clockFor } from '../../lib/clock';
import type { OrderPage, OrderRow } from './types';
import { StateBadge } from './StateBadge';

/**
 * The tab NAMES. The server owns which states each contains (D-154); the
 * console sends a name and renders the page it gets back. `all` sends no
 * bucket. The tabs deliberately overlap (needs_action is a subset of
 * active) -- they are tabs, not a partition, which is exactly why the
 * membership could not live on the client.
 */
type Bucket = 'needs_action' | 'active' | 'completed' | 'cancelled';
type Filter = Bucket | 'all';

const FILTERS: readonly Filter[] = ['all', 'needs_action', 'active', 'completed', 'cancelled'];

const FILTER_LABEL: Readonly<Record<Filter, string>> = {
  all: en['console.trade.filter.all'],
  needs_action: en['console.trade.filter.needs_action'],
  active: en['console.trade.filter.active'],
  completed: en['console.trade.filter.completed'],
  cancelled: en['console.trade.filter.cancelled'],
};

export function Orders() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [state, setState] = useState<UiState>('LOADING');
  const [rows, setRows] = useState<readonly OrderRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  // Only the LATEST load may commit: two quick tab clicks race, and whichever
  // RESPONSE lands last would otherwise win setRows (the C-7 pass class).
  const loadGen = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);

  /**
   * `append` is the pagination flag. A reload (or a countdown reaching zero)
   * REPLACES; "load more" appends. They are one function because they are one
   * request, and because a refetch that appended would duplicate every row on
   * screen the moment a deadline passed.
   */
  const load = useCallback(
    async (append: boolean, from: string | null, bucket: Filter) => {
      if (!sellerId) return;
      const gen = ++loadGen.current;
      if (append) setLoadingMore(true);
      setState((s) => (s === 'READY' && !append ? 'STALE' : append ? 'STALE' : 'LOADING'));
      try {
        const params = new URLSearchParams();
        if (bucket !== 'all') params.set('bucket', bucket);
        if (from) params.set('cursor', from);
        const q = params.toString() ? `?${params.toString()}` : '';
        const r = await api<OrderPage>(`/seller/orders${q}`, { sellerId });
        if (gen !== loadGen.current) return; // a newer load owns the screen
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
      } finally {
        if (append) setLoadingMore(false);
      }
    },
    [sellerId],
  );

  useEffect(() => {
    void load(false, null, filter);
  }, [load, filter]);

  const reload = useCallback(() => void load(false, null, filter), [load, filter]);

  // No page-local filter: the server returns exactly the bucket asked for.
  const shown = rows;

  // EMPTY is mandatory on every list (S3.2), and it is about the REQUEST,
  // not about the tab: an empty BUCKET is not "no orders". The account-empty
  // EMPTY state (which hides the tabs) fires ONLY on the 'all' bucket -- a
  // seller told "no orders" while holding twelve cancelled ones has been
  // told something false, and hiding the tabs would trap them there. An
  // empty narrow bucket keeps the tabs and shows the in-bucket empty note.
  const listState: UiState = state === 'READY' && rows.length === 0 && filter === 'all' ? 'EMPTY' : state;

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
        {shown.length === 0 && state === 'READY' && filter !== 'all' ? (
          <p className="empty" data-empty="bucket">
            {en['console.trade.orders.none_in_bucket']}
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
          <button
            type="button"
            className="load-more"
            disabled={loadingMore}
            onClick={() => void load(true, cursor, filter)}
          >
            {en['console.trade.orders.load_more']}
          </button>
        ) : null}
      </ScreenState>
    </main>
  );
}
