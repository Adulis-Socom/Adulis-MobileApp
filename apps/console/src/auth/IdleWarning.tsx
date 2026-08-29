/**
 * auth/IdleWarning.tsx -- "warned before idle expiry" (stage C-2's done
 * clause). Fires 5 minutes before the idle limit (ADU-CON-02 v3.1 S4.3);
 * see session.tsx for why the limits are the shipped defaults (D-93).
 *
 * "Stay signed in" makes a real request -- server-side idle runs from the
 * last REQUEST, so only a request resets it. Announced via role="alert":
 * a state change a screen reader must hear (S15).
 */
import { en } from '@adulis/locale';
import { keepAlive, useSession } from './session';
import { fillTemplate, timeFormatter } from '../lib/intl';

export function IdleWarning({ timezone }: { timezone: string }) {
  const { idleWarningAt, touch, signedOut } = useSession();
  if (idleWarningAt === null) return null;
  const at = timeFormatter({ timezone, currency: 'ETB', locale: 'en' }).format(
    new Date(idleWarningAt),
  );
  return (
    <div role="alert" className="idle-warning">
      <p>{fillTemplate(en['console.idle.warning'], { time: at })}</p>
      <button
        type="button"
        onClick={() => {
          keepAlive().then(touch, () => signedOut());
        }}
      >
        {en['console.idle.continue']}
      </button>
    </div>
  );
}
