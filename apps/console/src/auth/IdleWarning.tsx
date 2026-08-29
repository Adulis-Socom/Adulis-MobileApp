/**
 * auth/IdleWarning.tsx -- "warned before idle expiry" (stage C-2's done
 * clause). Fires 5 minutes before the idle limit (ADU-CON-02 v3.1 S4.3);
 * see session.tsx for why the limits are the shipped defaults (D-96).
 *
 * "Stay signed in" makes a real request -- server-side idle runs from the
 * last REQUEST, so only a request resets it. Announced via role="alert":
 * a state change a screen reader must hear (S15).
 */
import { useState } from 'react';
import { en } from '@adulis/locale';
import { ApiError } from '../api/client';
import { keepAlive, useSession } from './session';
import { fillTemplate, timeFormatter } from '../lib/intl';

export function IdleWarning({ timezone }: { timezone: string }) {
  const { idleWarningAt, touch, signedOut } = useSession();
  const [failed, setFailed] = useState(false);
  if (idleWarningAt === null) return null;
  const at = timeFormatter({ timezone, currency: 'ETB', locale: 'en' }).format(
    new Date(idleWarningAt),
  );
  return (
    <div role="alert" className="idle-warning">
      <p>{fillTemplate(en['console.idle.warning'], { time: at })}</p>
      {failed ? <p>{en['error.request.internal']}</p> : null}
      <button
        type="button"
        onClick={() => {
          setFailed(false);
          keepAlive().then(
            () => touch(),
            (e: unknown) => {
              // Only the server saying "you are signed out" signs the seller
              // out. A 500 or a dropped connection must leave the warning
              // standing: clearing it on a request the server never saw was
              // a promise of safety the session did not have.
              if (e instanceof ApiError && e.problem.status === 401) signedOut();
              else setFailed(true);
            },
          );
        }}
      >
        {en['console.idle.continue']}
      </button>
    </div>
  );
}
