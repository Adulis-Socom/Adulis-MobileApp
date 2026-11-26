import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router';
import { Shell } from '../layout/Shell';
import { Skeleton } from '../components/Skeleton';
import { StatePanel } from '../components/StatePanel';
import { t } from '../i18n/t';
import { useSession } from '../session/SessionProvider';
import { SellerContext, type SellerContextValue } from './context';
import { authorize, failureFor, generationOf, grantFor, type Outcome } from './grant';

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
  const accountId = session.state.status === 'READY' ? session.state.context.account.id : '';
  const [stored, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { transport } = session.selected;
  const expire = session.expire;
  const member = membership !== undefined;
  // What the server said is valid for this account, this Seller and this navigation only. A grant stamped with an
  // earlier generation is not served: while the question for THIS screen is open, nothing protected mounts or fetches.
  const generation = generationOf(accountId, sellerId, location.pathname);
  // The generation is a key, not a token: going A -> B -> A returns to a key whose old answer is still stored. So every
  // move clears the stored answer (during render, before anything is served) and nothing is served until it is asked again.
  const [seen, setSeen] = useState(generation);
  const outcome = seen === generation ? stored : null;
  if (seen !== generation) {
    setSeen(generation);
    setOutcome(null);
  }
  const access = grantFor(outcome, generation);
  const failure = failureFor(outcome, generation);

  // Capabilities are re-resolved by the server on every navigation inside the Seller, so a change in what the
  // account may do shows up on the next move instead of being believed from an old answer.
  useEffect(() => {
    if (!member) return;
    let live = true;
    authorize({ transport, sellerId, generation, live: () => live, apply: setOutcome, expire });
    return () => {
      live = false;
    };
  }, [member, transport, sellerId, generation, attempt, expire]);

  const retry = useCallback(() => {
    setOutcome(null);
    setAttempt((n) => n + 1);
  }, []);
  const value = useMemo<SellerContextValue | null>(() => (membership && access ? { sellerId, membership, access } : null), [sellerId, membership, access]);

  if (!membership) return <NotYours />;
  // Fail closed: if we cannot tell what this account may do, show nothing of the Seller.
  if (failure) {
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
  return (
    <SellerContext.Provider value={value}>
      <Shell>
        <Outlet />
      </Shell>
    </SellerContext.Provider>
  );
}
