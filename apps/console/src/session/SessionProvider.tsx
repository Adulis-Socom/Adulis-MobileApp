import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccountContext } from '../contracts/gap-sc';
import { asTransportError } from '../transport/port';
import type { Selected } from '../transport/select';

/**
 * The session boundary. The server is the only authority on whether there is a session: the state is derived from
 * `account.context.get`, never from anything remembered in the browser (no web storage, no token in JavaScript).
 *
 *  LOADING      asking the server
 *  UNAVAILABLE  the Seller services are not connected (release build today): nothing to sign in to, say so honestly
 *  SIGNED_OUT   no session (first visit, or the person signed out)
 *  EXPIRED      the server ended a session the person was using
 *  ERROR        the question itself failed: not the same as signed out, offered a retry
 *  READY        a session and its account context
 */
export type SessionState =
  | { readonly status: 'LOADING' }
  | { readonly status: 'UNAVAILABLE' }
  | { readonly status: 'SIGNED_OUT'; readonly justSignedOut: boolean }
  | { readonly status: 'EXPIRED' }
  | { readonly status: 'ERROR' }
  | { readonly status: 'READY'; readonly context: AccountContext };

export interface SessionApi {
  readonly state: SessionState;
  readonly selected: Selected;
  /** Re-ask the server (after sign-in, after creating a Seller, or to retry). */
  readonly refresh: () => Promise<SessionState['status']>;
  /** Ends the session on the server; resolves false when the server could not be told (the person stays signed in). */
  readonly signOut: () => Promise<boolean>;
  /** A request found the session gone: drop everything that belonged to it. */
  readonly expire: () => void;
}

const SessionContext = createContext<SessionApi | null>(null);

export function useSession(): SessionApi {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}

export function SessionProvider({ selected, children }: { selected: Selected; children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'LOADING' });
  // Each ask gets a number; only the newest ask may change state, so a slow answer from before a sign-out cannot
  // resurrect the session it belonged to.
  const generation = useRef(0);

  const refresh = useCallback(async (): Promise<SessionState['status']> => {
    const mine = ++generation.current;
    try {
      const context = await selected.transport.send('account.context.get', {});
      if (mine === generation.current) setState({ status: 'READY', context });
      return 'READY';
    } catch (error) {
      const code = asTransportError(error).code;
      const next: SessionState = code === 'AUTHENTICATION_REQUIRED' ? { status: 'SIGNED_OUT', justSignedOut: false } : code === 'UNAVAILABLE' ? { status: 'UNAVAILABLE' } : { status: 'ERROR' };
      if (mine === generation.current) setState(next);
      return next.status;
    }
  }, [selected.transport]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await selected.transport.send('auth.session.end', {});
    } catch (error) {
      // A session the server already ended IS signed out. Any other failure leaves the person signed in, and says so,
      // rather than showing a signed-out screen over a live session.
      if (asTransportError(error).code !== 'AUTHENTICATION_REQUIRED') return false;
    }
    generation.current += 1;
    setState({ status: 'SIGNED_OUT', justSignedOut: true });
    return true;
  }, [selected.transport]);

  const expire = useCallback(() => {
    generation.current += 1;
    setState((current) => (current.status === 'READY' ? { status: 'EXPIRED' } : current));
  }, []);

  const api = useMemo<SessionApi>(() => ({ state, selected, refresh, signOut, expire }), [state, selected, refresh, signOut, expire]);
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}
