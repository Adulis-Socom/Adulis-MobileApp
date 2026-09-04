/**
 * features/catalogue/Products.tsx -- SC-07, ADU-CON-03 v1.2 S8.
 *
 * Route /s/:sellerId/products - GET /v1/seller/products - seller.products:read.
 *
 * ==========================================================================
 * TWO OF S8'S THREE OWED REGIONS HAVE LANDED (T22 Phase 4)
 * ==========================================================================
 * This screen spent three orders saying what it was waiting for, because
 * ADU-CON-03 S17 rules that "a region that depends on a contract names the
 * endpoint and the field" -- and naming it is what got them built.
 *
 *   - THE IMAGE is here. GET /v1/seller/products now carries `image_key`, the
 *     CARD derivative of the lowest-position image, or null. A bare key: the
 *     origin comes from /v1/bootstrap and the two are joined here, exactly as
 *     Media.tsx does it.
 *   - THE CAP COUNTER is a number now, and it NAMES WHICH LIMIT BINDS. The
 *     response carries `publication` = {used, cap, tier_cap, level_cap,
 *     binding, level}. S8 is explicit that "10 of unlimited" is a bug report
 *     waiting to be filed, so a null cap renders as no number at all and the
 *     word "unlimited" appears nowhere.
 *   - STILL OWED, and still said out loud: the per-row VARIANT COUNT and
 *     AGGREGATE STOCK WITH ITS CONFIDENCE. The list shape carries neither, the
 *     console will not fetch each product to count them (an N+1 the payload
 *     budget forbids), and it computes no business state -- so the row says so
 *     once, above the list, rather than omitting the fields silently. A row
 *     that just drops a field reads as a screen nobody finished.
 *
 * THE COUNTER STILL COMPUTES NOTHING. `used`, `cap` and `binding` are all
 * resolved server-side by billing.fn_effective_limit; this renders them.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { formatMinor, fillTemplate } from '../../lib/intl';
import { useMarket, useMarketContext } from '../../lib/market';
import type { ProductPage, ProductRow, PublicationLimit } from './types';

type StatusFilter = 'all' | 'PUBLISHED' | 'DRAFT' | 'UNPUBLISHED';
const STATUS_FILTERS: readonly StatusFilter[] = ['all', 'PUBLISHED', 'DRAFT', 'UNPUBLISHED'];
const STATUS_LABEL: Readonly<Record<StatusFilter, string>> = {
  all: en['console.catalogue.filter.all'],
  PUBLISHED: en['console.catalogue.filter.published'],
  DRAFT: en['console.catalogue.filter.draft'],
  UNPUBLISHED: en['console.catalogue.filter.unpublished'],
};

/**
 * WHICH LIMIT BINDS, as a sentence (ADU-CON-03 S8).
 *
 * One key per binding, because each names a DIFFERENT action that lifts the
 * cap: a LEVEL cap lifts by trading to Established, a TIER cap lifts by paying,
 * and BOTH lifts by neither alone. A single string with a "{what}" slot would
 * have to read "your tier or level", which is the sentence S8 exists to forbid.
 *
 * `cap: null` is NONE. The number is not rendered at all and the word
 * "unlimited" appears nowhere -- S8:415 forbids the screen printing it, because
 * "10 of unlimited" is the bug report the whole region exists to avoid.
 *
 * An unresolved limit (the fail-closed NO_TIER_DEFINITION / NO_LADDER_CONFIG
 * branches) reaches here as binding NONE with a null cap AND used 0, so it is
 * told apart by the server having refused rather than guessed.
 */
const CAP_SENTENCE = (pub: PublicationLimit): string => {
  // The server refused to resolve a limit. Say that, rather than "no limit is
  // in force" -- the two look alike in the payload and mean opposite things.
  if (!pub.resolved) return en['console.catalogue.products.cap_unknown'];
  const cap = pub.cap === null ? '' : String(pub.cap);
  switch (pub.binding) {
    case 'LEVEL':
      return fillTemplate(en['console.catalogue.products.cap_binding_level'], { cap });
    case 'TIER':
      return fillTemplate(en['console.catalogue.products.cap_binding_tier'], { cap });
    case 'BOTH':
      return fillTemplate(en['console.catalogue.products.cap_binding_both'], { cap });
    default:
      return en['console.catalogue.products.cap_binding_none'];
  }
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
  const [publication, setPublication] = useState<PublicationLimit | null>(null);
  // The origin lives on the bootstrap value, not on the market row -- same
  // source Media.tsx reads, so the two screens cannot disagree about it.
  const { mediaPublicOrigin } = useMarket();

  const load = useCallback(
    async (append: boolean, from: string | null) => {
      if (!sellerId) return;
      setState((s) => (s === 'READY' || append ? 'STALE' : 'LOADING'));
      try {
        const q = from ? `?cursor=${encodeURIComponent(from)}` : '';
        const r = await api<ProductPage>(`/seller/products${q}`, { sellerId });
        setRows((prev) => (append ? [...prev, ...r.data] : r.data));
        // The counter is a property of the STORE, not of the page, so a
        // "load more" must not leave a stale one on screen.
        setPublication(r.publication ?? null);
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

  // S3.4: an absent permission renders NOTHING -- not a shell with a dead
  // list slot. The pass's M2: header, cap note and New-product link were
  // rendering around a null list on a 403.
  if (state === 'NO_PERMISSION') return null;

  return (
    <section aria-labelledby="products-heading" data-screen="SC-07">
      <header className="screen-header">
        <h1 id="products-heading">{en['console.catalogue.products.heading']}</h1>
        {/*
          THE CAP COUNTER (S8). Two sentences, deliberately: the count, then
          WHICH limit produced it and what lifts it. One string with a slot
          would have to say "your tier or level", which is the sentence S8
          exists to forbid.
        */}
        {publication ? (
          <p className="cap-note" data-cap-binding={publication.binding}>
            {publication.cap === null ? null : (
              <strong data-cap-count>
                {fillTemplate(en['console.catalogue.products.cap_count'], {
                  used: String(publication.used),
                  cap: String(publication.cap),
                })}{' '}
              </strong>
            )}
            {CAP_SENTENCE(publication)}
          </p>
        ) : null}
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
      <p className="row-summary-note">{en['console.catalogue.products.row_summary_owed']}</p>

      {state === 'EMPTY' || (state === 'READY' && rows.length === 0) ? (
        <ScreenState state="EMPTY" emptyText={en['console.catalogue.products.empty']} />
      ) : state === 'READY' || state === 'STALE' ? (
        <ScreenState state={state}>
          {shown.length === 0 ? (
            <p className="empty" data-state="EMPTY">
              {en['console.catalogue.products.filter_empty']}
            </p>
          ) : null}
          <ul className="product-list">
            {shown.map((p) => (
              <li key={p.id} className="product-row" data-product={p.id}>
                <Link to={p.id} className="product-link">
                  {/*
                    THE PRIMARY IMAGE (T22 Phase 4.1). A bare key joined to the
                    origin bootstrap supplies -- never a URL from the server.
                    The placeholder is a real element rather than nothing, so a
                    product without a photograph does not silently collapse the
                    row it shares a grid with. alt="" because the product name
                    is the label and is right beside it; a repeated name is
                    noise to a screen reader.
                  */}
                  {mediaPublicOrigin && p.image_key ? (
                    <img
                      className="product-thumb"
                      src={`${mediaPublicOrigin}/${p.image_key}`}
                      alt=""
                      data-product-image
                      loading="lazy"
                    />
                  ) : (
                    <span className="product-thumb product-thumb-empty" aria-hidden="true" />
                  )}
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
