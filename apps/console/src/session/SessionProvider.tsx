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
  /**
   * A request found the session gone: drop everything that belonged to it. Bound to the session that was current when this value was
   * read, so a late AUTHENTICATION_REQUIRED for a request of an EARLIER session (signed out, expired, signed in again since) is not this
   * session's failure and changes nothing, while the current session's own failure still ends it.
   */
  readonly expire: () => void;
  /** Changes whenever a session ends, so anything keyed by it (retry identity) starts fresh for the next session. */
  readonly epoch: number;
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
  // The session epoch moves on whenever a session ends (sign-out, expiry, the server saying there is none).
  const [epoch, setEpoch] = useState(0);
  const epochRef = useRef(0);
  const endEpoch = useCallback(() => {
    epochRef.current += 1;
    setEpoch(epochRef.current);
  }, []);

  const refresh = useCallback(async (): Promise<SessionState['status']> => {
    const mine = ++generation.current;
    try {
      const context = await selected.transport.send('account.context.get', {});
      if (mine === generation.current) setState({ status: 'READY', context });
      return 'READY';
    } catch (error) {
      const code = asTransportError(error).code;
      const next: SessionState = code === 'AUTHENTICATION_REQUIRED' ? { status: 'SIGNED_OUT', justSignedOut: false } : code === 'UNAVAILABLE' ? { status: 'UNAVAILABLE' } : { status: 'ERROR' };
      if (mine === generation.current) {
        if (next.status === 'SIGNED_OUT') endEpoch();
        setState(next);
      }
      return next.status;
    }
  }, [selected.transport, endEpoch]);

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
    endEpoch();
    setState({ status: 'SIGNED_OUT', justSignedOut: true });
    return true;
  }, [selected.transport, endEpoch]);

  const expire = useCallback(() => {
    if (epoch !== epochRef.current) return;
    generation.current += 1;
    endEpoch();
    setState((current) => (current.status === 'READY' ? { status: 'EXPIRED' } : current));
  }, [epoch, endEpoch]);

  const api = useMemo<SessionApi>(() => ({ state, selected, refresh, signOut, expire, epoch }), [state, selected, refresh, signOut, expire, epoch]);
  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}
