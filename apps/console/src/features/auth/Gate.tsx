import { Link, Navigate, Outlet, useLocation } from 'react-router';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { PlainFrame } from '../../layout/PlainFrame';
import { useSession } from '../../session/SessionProvider';
import { AuthFlowProvider, safeReturnPath, useAuthFlow } from './flow';

function Unavailable() {
  return (
    <PlainFrame>
      <StatePanel page kind="neutral" title={t('state.unavailable_title')}>
        <p>{t('state.unavailable_body')}</p>
      </StatePanel>
    </PlainFrame>
  );
}

function ContextError() {
  const session = useSession();
  return (
    <PlainFrame>
      <StatePanel
        page
        kind="danger"
        alert
        title={t('state.transport_error_title')}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => void session.refresh()}>
            {t('state.retry')}
          </button>
        }
      >
        <p>{t('state.transport_error_body')}</p>
      </StatePanel>
    </PlainFrame>
  );
}

function Loading() {
  return (
    <PlainFrame>
      <Skeleton rows={4} />
    </PlainFrame>
  );
}

/** Everything behind the session boundary. Each non-READY session state has its own honest screen. */
export function RequireSession() {
  const session = useSession();
  const location = useLocation();
  const { state } = session;
  switch (state.status) {
    case 'LOADING':
      return <Loading />;
    case 'UNAVAILABLE':
      return <Unavailable />;
    case 'SIGNED_OUT':
      return <Navigate to="/sign-in" replace state={{ from: state.justSignedOut ? null : location.pathname, justSignedOut: state.justSignedOut }} />;
    case 'EXPIRED':
      return (
        <PlainFrame>
          <StatePanel
            page
            kind="warn"
            alert
            title={t('state.expired_title')}
            actions={
              <Link className="btn btn-primary" to="/sign-in" state={{ from: location.pathname }}>
                {t('state.sign_in')}
              </Link>
            }
          >
            <p>{t('state.expired_body')}</p>
          </StatePanel>
        </PlainFrame>
      );
    case 'ERROR':
      return (
        <PlainFrame>
          <StatePanel
            page
            kind="danger"
            alert
            title={t('state.transport_error_title')}
            actions={
              <button type="button" className="btn btn-primary" onClick={() => void session.refresh()}>
                {t('state.retry')}
              </button>
            }
          >
            <p>{t('state.transport_error_body')}</p>
          </StatePanel>
        </PlainFrame>
      );
    case 'READY':
      return <Outlet />;
  }
}

function AuthGate() {
  const session = useSession();
  const flow = useAuthFlow();
  const location = useLocation();
  const { state } = session;
  if (state.status === 'LOADING') return <Loading />;
  if (state.status === 'UNAVAILABLE') return <Unavailable />;
  if (state.status === 'ERROR') return <ContextError />;
  if (state.status === 'READY') return <Navigate to={flow.returnTo ?? safeReturnPath((location.state as { from?: unknown } | null)?.from) ?? '/sellers'} replace />;
  return (
    <PlainFrame>
      <Outlet />
    </PlainFrame>
  );
}

/** The sign-in routes. Already signed in: straight to where the person was heading. */
export function AuthLayout() {
  return (
    <AuthFlowProvider>
      <AuthGate />
    </AuthFlowProvider>
  );
}
