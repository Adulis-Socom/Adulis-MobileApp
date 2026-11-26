import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import type { StoreView } from '../../contracts/gap-sc-store';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { DirtyProvider, newer, UnsavedNote } from '../shared/dirty';

export interface StoreProps {
  readonly view: StoreView;
  /** Adopt the server's answer to a write. */
  readonly onChange: (next: StoreView) => void;
  /** Fetch again and re-initialise the forms from it (a stale version). */
  readonly onReload: () => void;
  readonly editable: boolean;
}

/**
 * The parts of the Store, BELOW the page title like the Content switcher. On wide screens they are links (the router marks the current one
 * with aria-current); on phone widths the same destinations are one labelled picker instead of wrapped rows of buttons. Only one of the two is
 * shown at a time (CSS), so assistive technology meets exactly one. Company details exist only for a Company Seller, as the server says.
 */
export function StoreNav() {
  const { sellerId, membership } = useSeller();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const company = membership.seller.seller_type === 'COMPANY';
  const parts: { path: string; label: string; end?: boolean }[] = [
    { path: '', label: t('store.nav_profile'), end: true },
    ...(company ? [{ path: 'company', label: t('store.nav_company') }] : []),
    { path: 'location', label: t('store.nav_location') },
    { path: 'coverage', label: t('store.nav_coverage') },
    { path: 'hours', label: t('store.nav_hours') },
    { path: 'fulfilment', label: t('store.nav_fulfilment') },
    { path: 'couriers', label: t('store.nav_couriers') },
  ];
  const base = sellerPath(sellerId, 'store');
  const here = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : '';
  const to = (path: string) => (path === '' ? base : `${base}/${path}`);
  return (
    <>
      <nav aria-label={t('store.nav_label')} className="actions subnav-wide">
        {parts.map((p) => (
          <NavLink key={p.path} className="btn btn-quiet" to={to(p.path)} end={p.end ?? false}>
            {p.label}
          </NavLink>
        ))}
      </nav>
      <div className="subnav-narrow">
        <label htmlFor="store-section">{t('store.nav_picker')}</label>
        <select id="store-section" className="text-input" value={here} onChange={(e) => void navigate(to(e.target.value))}>
          {parts.map((p) => (
            <option key={p.path} value={p.path}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
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
    const incoming = query.state.data;
    setView((prev) => newer(prev, incoming));
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
    <DirtyProvider>
      <PageTitle title={title}>{title}</PageTitle>
      <UnsavedNote />
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
      {view ? <Fragment key={epoch}>{children({ view, onChange: (next) => setView((prev) => newer(prev, next)), onReload, editable: view.allowed_actions.includes('EDIT') })}</Fragment> : null}
    </DirtyProvider>
  );
}
