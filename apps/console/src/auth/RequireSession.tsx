/** auth/RequireSession.tsx -- boot gate: signed out lands on /sign-in. */
import { Navigate, Outlet } from 'react-router';
import { en } from '@adulis/locale';
import { useSession } from './session';

export function RequireSession() {
  const { session, booting } = useSession();
  if (booting) {
    return (
      <div className="skeleton" aria-hidden="true">
        <div className="skeleton-row" />
      </div>
    );
  }
  if (!session) return <Navigate to="/sign-in" replace />;
  return <Outlet />;
}

export function SignedInBadge() {
  const { session } = useSession();
  if (!session) return null;
  return <span className="badge">{en['console.shell.signed_in']}</span>;
}
