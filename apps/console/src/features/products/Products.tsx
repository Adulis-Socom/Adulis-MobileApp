import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ProductFilter, ProductSummary } from '../../contracts/gap-sc-catalogue';
import { Field } from '../../components/Form';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { label, t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { AvailabilityBadge, StateBadge } from './badges';

const FILTERS: readonly ProductFilter[] = ['ALL', 'DRAFT', 'PUBLISHED', 'WITHDRAWN', 'RESTRICTED'];

function Row({ product, sellerId }: { product: ProductSummary; sellerId: string }) {
  return (
    <li>
      <Link className="ledger-link" to={sellerPath(sellerId, `products/${product.id}`)}>
        <span className="ledger-main">
          <span className="ledger-title">{product.title.trim() === '' ? t('products.untitled') : product.title}</span>
          <span className="ledger-meta">{product.category_label ?? t('products.no_category')}</span>
          <span className="ledger-meta">{t('products.variant_count', { count: product.variant_count })}</span>
        </span>
        <span className="badges">
          <StateBadge state={product.publication_state} />
          {product.variant_count > 0 ? <AvailabilityBadge availability={product.availability} /> : null}
        </span>
      </Link>
    </li>
  );
}

/** Products (CONSOLE-02 S47-S49): a searchable, filterable, cursor-paginated list. Every row is the server's answer; nothing is computed here. */
export function Products() {
  const { sellerId } = useSeller();
  const navigate = useNavigate();
  const run = useSellerCommand();
  const create = useAction();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('ALL');
  const [cursor, setCursor] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<readonly ProductSummary[]>([]);
  const { state, retry } = useSellerQuery('products.list', { query, filter, cursor });

  // A page is only trusted once its own answer is in; while the next one loads, the pages already shown stay put.
  const current = state.status === 'ready' && !state.refreshing ? state.data : null;
  const shown = current ? [...earlier, ...current.items] : earlier;
  const canCreate = state.status === 'ready' && state.data.allowed_actions.includes('CREATE');

  function restart(next: { query?: string; filter?: ProductFilter }) {
    setEarlier([]);
    setCursor(null);
    if (next.query !== undefined) setQuery(next.query);
    if (next.filter !== undefined) setFilter(next.filter);
  }
  function more() {
    if (!current?.next_cursor) return;
    setEarlier(shown);
    setCursor(current.next_cursor);
  }
  async function add() {
    await create.run(async () => {
      const product = await run('products.create', {});
      void navigate(sellerPath(sellerId, `products/${product.id}`));
    });
  }

  return (
    <>
      <PageTitle title={t('products.title')}>{t('products.title')}</PageTitle>
      <p className="lead">{t('products.lead')}</p>
      <div className="row">
        <form
          role="search"
          className="row"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            restart({ query: draft });
          }}
        >
          <Field id="product-search" label={t('products.search_label')}>
            {(control) => <input {...control} className="text-input" type="search" value={draft} onChange={(e) => setDraft(e.target.value)} />}
          </Field>
          <button type="submit" className="btn btn-quiet">
            {t('products.search_submit')}
          </button>
        </form>
        <Field id="product-filter" label={t('products.filter_label')}>
          {(control) => (
            <select {...control} className="text-input" value={filter} onChange={(e) => restart({ filter: e.target.value as ProductFilter })}>
              {FILTERS.map((f) => (
                <option key={f} value={f}>
                  {f === 'ALL' ? t('products.filter_all') : label('product.state', f)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {canCreate ? (
        <div className="actions">
          <button type="button" className="btn btn-highlight" aria-disabled={create.busy} onClick={() => void add()}>
            {t('products.add')}
          </button>
        </div>
      ) : null}
      <ActionProblem action={create} />
      {state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('products.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'loading' || (state.status === 'ready' && state.refreshing && shown.length === 0) ? <Skeleton rows={4} /> : null}
      {current && shown.length === 0 ? <StatePanel kind="neutral" title={query !== '' || filter !== 'ALL' ? t('products.empty_filtered') : t('products.empty')} /> : null}
      {shown.length > 0 ? (
        <ul className="ledger" aria-label={t('products.list_label')} aria-busy={state.status === 'ready' && state.refreshing}>
          {shown.map((p) => (
            <Row key={p.id} product={p} sellerId={sellerId} />
          ))}
        </ul>
      ) : null}
      {current?.next_cursor ? (
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={more}>
            {t('products.more')}
          </button>
        </div>
      ) : null}
      {state.status === 'ready' && state.refreshing && shown.length > 0 ? <p className="hint">{t('products.loading_more')}</p> : null}
    </>
  );
}
