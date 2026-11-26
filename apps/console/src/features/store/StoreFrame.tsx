import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import type { StoreView } from '../../contracts/gap-sc-store';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';

export interface StoreProps {
  readonly view: StoreView;
  /** Adopt the server's answer to a write. */
  readonly onChange: (next: StoreView) => void;
  /** Fetch again and re-initialise the forms from it (a stale version). */
  readonly onReload: () => void;
  readonly editable: boolean;
}

/** The six parts of the Store, as links, shown BELOW the page title like the Content switcher. The router marks the current one with aria-current. */
export function StoreNav() {
  const { sellerId } = useSeller();
  const link = (path: string, text: string, end = false) => (
    <NavLink className="btn btn-quiet" to={sellerPath(sellerId, path === '' ? 'store' : `store/${path}`)} end={end}>
      {text}
    </NavLink>
  );
  return (
    <>
      <nav aria-label={t('store.nav_label')} className="actions">
        {link('', t('store.nav_profile'), true)}
        {link('location', t('store.nav_location'))}
        {link('coverage', t('store.nav_coverage'))}
        {link('hours', t('store.nav_hours'))}
        {link('fulfilment', t('store.nav_fulfilment'))}
        {link('couriers', t('store.nav_couriers'))}
      </nav>
    </>
  );
}

/** The Store pages render their own title and switcher, so the layout is only the place the router puts them. */
export function StoreLayout() {
  return <Outlet />;
}

/**
 * Loads the Store, keeps the latest server answer, and hands it to one page. Forms re-initialise only when the Seller asked
 * for a reload (a stale version), so a quiet refresh never wipes typing. A failed load is its own state, never an empty form.
 */
export function StoreFrame({ title, lead, children }: { title: string; lead?: string | undefined; children: (props: StoreProps) => ReactNode }) {
  const query = useSellerQuery('store.get', {});
  const [view, setView] = useState<StoreView | null>(null);
  const [epoch, setEpoch] = useState(0);
  const reloading = useRef(false);
  const retry = query.retry;

  useEffect(() => {
    if (query.state.status !== 'ready' || query.state.refreshing) return;
    setView(query.state.data);
    if (reloading.current) {
      reloading.current = false;
      setEpoch((n) => n + 1);
    }
  }, [query.state]);
  const onReload = useCallback(() => {
    reloading.current = true;
    retry();
  }, [retry]);

  return (
    <>
      <PageTitle title={title}>{title}</PageTitle>
      {lead ? <p className="lead">{lead}</p> : null}
      <StoreNav />
      {query.state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('store.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {query.state.status === 'loading' || (query.state.status === 'ready' && view === null) ? <Skeleton rows={4} /> : null}
      {view ? <Fragment key={epoch}>{children({ view, onChange: setView, onReload, editable: view.allowed_actions.includes('EDIT') })}</Fragment> : null}
    </>
  );
}
