import { useState, type ReactNode } from 'react';
import { Problem } from '../components/Problem';
import { t } from '../i18n/t';
import { useSession } from '../session/SessionProvider';
import { TransportError } from '../transport/port';

/** The frame for pages outside a Seller (sign-in, chooser, become-a-Seller): brand, and sign-out when there is a session. */
export function PlainFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const session = useSession();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const signedIn = session.state.status === 'READY';
  return (
    <div className="plain">
      <header className="plain-head">
        <p className="brand">
          <strong>Adulis</strong> <span>Seller Console</span>
        </p>
        {signedIn ? (
          <button
            type="button"
            className="btn btn-quiet"
            aria-disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              const ok = await session.signOut();
              setFailed(!ok);
              setBusy(false);
            }}
          >
            {busy ? t('account.signing_out') : t('account.sign_out')}
          </button>
        ) : null}
      </header>
      {failed ? (
        <div className="page narrow-page">
          <Problem error={new TransportError('NETWORK')} />
        </div>
      ) : null}
      <main id="main" className={wide ? 'page' : 'page narrow-page'}>
        {children}
      </main>
    </div>
  );
}
