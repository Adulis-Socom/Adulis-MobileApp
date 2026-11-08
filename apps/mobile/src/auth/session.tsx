import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useUiStore } from '../state/ui-store';
import type { SessionStorage } from './session-storage';

/** One session for the whole app. Modes are never sessions: switching mode reads nothing here. */
export type SessionState =
  | { status: 'restoring' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string };

type SessionContextValue = {
  session: SessionState;
  /** THE sign-out boundary: credential, server cache and mode, in one place. */
  clearSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Startup hydration. A credential that cannot be read starts this launch signed out rather
 * than crashing. It is NOT deleted: the failure may be transient (a keychain read before
 * first unlock), and the next sign-in overwrites a genuinely broken entry. Only
 * clearSession ever removes the credential.
 */
export async function restoreSession(storage: SessionStorage): Promise<SessionState> {
  try {
    const token = await storage.read();
    return token ? { status: 'signedIn', token } : { status: 'signedOut' };
  } catch (error) {
    console.warn('[session] stored credential unreadable; starting signed out', error);
    return { status: 'signedOut' };
  }
}

export function SessionProvider({
  storage,
  children,
}: {
  storage: SessionStorage;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ status: 'restoring' });

  useEffect(() => {
    let cancelled = false;
    void restoreSession(storage).then((restored) => {
      if (!cancelled) setSession(restored);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const clearSession = useCallback(async () => {
    // Storage first: if the delete fails the caller sees the error and the app does not
    // claim a sign-out that the next launch would undo.
    await storage.clear();
    queryClient.clear();
    useUiStore.getState().setActiveMode(null);
    setSession({ status: 'signedOut' });
  }, [storage, queryClient]);

  const value = useMemo(() => ({ session, clearSession }), [session, clearSession]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
