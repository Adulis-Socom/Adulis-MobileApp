/**
 * features/catalogue/Products.tsx -- SC-07, ADU-CON-03 v1.2 S8.
 *
 * Route /s/:sellerId/products - GET /v1/seller/products - seller.products:read.
 *
 * ==========================================================================
 * THREE REGIONS S8 ASKS FOR THAT THE CONTRACT DOES NOT SUPPLY
 * ==========================================================================
 * `GET /v1/seller/products` returns {id, name, visibility, base_price,
 * display_order} and nothing more (catalogue.service.ts listProducts). S8
 * asks each row to carry a variant count, aggregate stock and its confidence,
 * and a primary image; and it asks the header for a publication counter that
 * NAMES WHICH LIMIT BINDS -- tier or level. None of that is in the response.
 *
 * The console computes no business state (T7 S7.3 rule 1), so it cannot derive
 * the cap from the tier, and it will not fetch each product to count variants
 * (an N+1 the payload budget forbids). ADU-CON-03 v1.2 S17's rule governs:
 * "a region that depends on a contract names the endpoint and the field."
 * So each missing region says what it is waiting for, and each is a register
 * entry (D-155 family, D-CON-* below) rather than a fabricated number.
 *
 *   - THE CAP COUNTER cannot say "8 of 10" without an effective-limit field,
 *     and "8 of unlimited" is the bug report S8 warns about. It is not drawn
 *     as a number; it links to where a product is created and states plainly
 *     that the limit is resolved by the server and not yet reported here.
 *   - THE PER-ROW variant count / stock confidence / image are absent from
 *     the list shape; the row renders name, publication state and price, and
 *     the editor (SC-08) carries the rest, which the list links to.
 *
 * Registered rather than invented, and registered rather than silently
 * dropped -- a row that just omits a field reads as a screen nobody finished.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { formatMinor } from '../../lib/intl';
import { useMarketContext } from '../../lib/market';
import type { ProductPage, ProductRow } from './types';

type StatusFilter = 'all' | 'PUBLISHED' | 'DRAFT' | 'UNPUBLISHED';
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'PUBLISHED', 'DRAFT', 'UNPUBLISHED'];
const STATUS_LABEL: Readonly<Record<StatusFilter, string>> = {
  all: en['console.catalogue.filter.all'],
  PUBLISHED: en['console.catalogue.filter.published'],
  DRAFT: en['console.catalogue.filter.draft'],
  UNPUBLISHED: en['console.catalogue.filter.unpublished'],
};

export function Products() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const [state, setState] = useState<UiState>('LOADING');
  const [rows, setRows] = useState<readonly ProductRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const load = useCallback(
    async (append: boolean, from: string | null) => {
      if (!sellerId) return;
      setState((s) => (s === 'READY' || append ? 'STALE' : 'LOADING'));
      try {
        const q = from ? `?cursor=${encodeURIComponent(from)}` : '';
        const r = await api<ProductPage>(`/seller/products${q}`, { sellerId });
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

  // Filtering is over WHAT HAS LOADED, and the note under the filter row says
  // so -- the endpoint carries no status parameter (same shape as SC-03's
  // buckets, D-154). A filter that reads empty while a matching product sits
  // on the next page is worse than no filter.
  const shown = filter === 'all' ? rows : rows.filter((r) => r.visibility === filter);

  return (
    <section aria-labelledby="products-heading" data-screen="SC-07">
      <header className="screen-header">
        <h1 id="products-heading">{en['console.catalogue.products.heading']}</h1>
        {/*
          THE CAP COUNTER, honest about the field it lacks (S8, S17). No number
          is invented: the server resolves the effective limit as the
          intersection of tier and level, and the list response does not carry
          it. When allowed_actions / an effective-limit field lands (D-155),
          this becomes "N of M -- <what binds>".
        */}
        <p className="cap-note">
          {en['console.catalogue.products.cap_unreported']}
        </p>
        <Link className="button primary" to="new">
          {en['console.catalogue.products.new']}
        </Link>
      </header>

      <div className="filter-row" role="group" aria-label={en['console.catalogue.filter.label']}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            className={filter === f ? 'filter active' : 'filter'}
            onClick={() => setFilter(f)}
          >
            {STATUS_LABEL[f]}
          </button>
        ))}
      </div>
      <p className="filter-note">{en['console.catalogue.products.filter_note']}</p>

      {state === 'EMPTY' || (state === 'READY' && rows.length === 0) ? (
        <ScreenState state="EMPTY" emptyText={en['console.catalogue.products.empty']} />
      ) : state === 'READY' || state === 'STALE' ? (
        <ScreenState state={state}>
          <ul className="product-list">
            {shown.map((p) => (
              <li key={p.id} className="product-row" data-product={p.id}>
                <Link to={p.id} className="product-link">
                  <span className="product-name">{p.name}</span>
                  <span className={`badge badge-${p.visibility.toLowerCase()}`}>
                    {STATUS_LABEL[p.visibility]}
                  </span>
                  <span className="product-price">
                    {market ? formatMinor(market, p.base_price.amount_minor) : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <button type="button" className="button" onClick={() => void load(true, cursor)}>
              {en['console.catalogue.products.load_more']}
            </button>
          ) : null}
        </ScreenState>
      ) : (
        <ScreenState
          state={state}
          onRetry={() => void load(false, null)}
          {...(problem ? { problem: problem.problem } : {})}
        />
      )}
    </section>
  );
}
