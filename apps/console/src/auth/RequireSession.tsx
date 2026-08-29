/** auth/RequireSession.tsx -- boot gate: signed out lands on /sign-in. */
import { Navigate, Outlet, useLocation } from 'react-router';
import { en } from '@adulis/locale';
import { useSession } from './session';

export function RequireSession() {
  const { session, booting } = useSession();
  const location = useLocation();
  if (booting) {
    // aria-busy + a live region: the skeleton itself is decorative, so
    // without this an assistive-technology user gets an empty document for
    // the whole boot probe, and permanently if it hangs.
    return (
      <div aria-busy="true" aria-live="polite">
        <span className="visually-hidden">{en['console.a11y.loading']}</span>
        <div className="skeleton" aria-hidden="true">
          <div className="skeleton-row" />
        </div>
      </div>
    );
  }
  // Carry the destination so sign-in can resume it: ADU-CON-03 S3 requires an
  // unauthenticated deep link to land on SC-00 and RESUME after sign-in.
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function SignedInBadge() {
  const { session } = useSession();
  if (!session) return null;
  return <span className="badge">{en['console.shell.signed_in']}</span>;
}
