import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router';
import type { SellerAccess } from '../contracts/gap-sc';
import { Shell } from '../layout/Shell';
import { Skeleton } from '../components/Skeleton';
import { StatePanel } from '../components/StatePanel';
import { t } from '../i18n/t';
import { useSession } from '../session/SessionProvider';
import { asTransportError, type TransportError } from '../transport/port';
import { SellerContext, type SellerContextValue } from './context';
import { runScoped } from './scoped';

/**
 * `/s/:sellerId/*`. KEYED by the id: switching Seller (the switcher, a link, Back or Forward) unmounts the whole
 * Seller subtree, so no component state, in-flight request or open dialog of one Seller can be seen under another.
 */
export function SellerRoute() {
  const { sellerId } = useParams();
  return <SellerScope key={sellerId} sellerId={sellerId ?? ''} />;
}

function NotYours() {
  return (
    <main id="main" className="page narrow-page">
      <StatePanel
        page
        kind="warn"
        title={t('state.no_permission_title')}
        actions={
          <Link className="btn btn-quiet" to="/sellers">
            {t('state.back_to_sellers')}
          </Link>
        }
      >
        <p>{t('state.no_permission_body')}</p>
      </StatePanel>
    </main>
  );
}

function SellerScope({ sellerId }: { sellerId: string }) {
  const session = useSession();
  const location = useLocation();
  const membership = session.state.status === 'READY' ? session.state.context.memberships.find((m) => m.seller.id === sellerId) : undefined;
  const [access, setAccess] = useState<SellerAccess | null>(null);
  const [failure, setFailure] = useState<TransportError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { transport } = session.selected;
  const expire = session.expire;
  const member = membership !== undefined;

  // Capabilities are re-resolved by the server on every navigation inside the Seller, so a change in what the
  // account may do shows up on the next move instead of being believed from an old answer.
  useEffect(() => {
    if (!member) return;
    let live = true;
    runScoped(transport, 'seller.access.get', sellerId, {})
      .then((next) => {
        if (!live) return;
        setAccess(next);
        setFailure(null);
      })
      .catch((error: unknown) => {
        if (!live) return;
        const e = asTransportError(error);
        if (e.code === 'AUTHENTICATION_REQUIRED') expire();
        else {
          // Fail closed: if the account's access cannot be re-confirmed, the old grants are not served.
          setAccess(null);
          setFailure(e);
        }
      });
    return () => {
      live = false;
    };
  }, [member, transport, sellerId, location.pathname, attempt, expire]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo<SellerContextValue | null>(() => (membership && access ? { sellerId, membership, access } : null), [sellerId, membership, access]);

  if (!membership) return <NotYours />;
  if (failure && !access) {
    // Fail closed: if we cannot tell what this account may do, show nothing of the Seller.
    return failure.code === 'PERMISSION_DENIED' ? (
      <NotYours />
    ) : (
      <main id="main" className="page narrow-page">
        <StatePanel
          page
          kind="danger"
          alert
          title={t('state.unknown_access_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.unknown_access_body')}</p>
        </StatePanel>
      </main>
    );
  }
  if (!value) {
    return (
      <main id="main" className="page narrow-page">
        <Skeleton rows={4} />
      </main>
    );
  }
  if (failure?.code === 'PERMISSION_DENIED') return <NotYours />;
  return (
    <SellerContext.Provider value={value}>
      <Shell>
        <Outlet />
      </Shell>
    </SellerContext.Provider>
  );
}
