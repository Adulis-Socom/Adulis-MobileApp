import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createApiClient, type ApiClient } from '../api/client';
import { loadDeviceId, type DeviceStorage } from '../device/device-storage';
import { useUiStore } from '../state/ui-store';
import type { SessionStorage } from './session-storage';

/** One session for the whole app. Modes are never sessions: switching mode reads nothing here. */
export type SessionState =
  | { status: 'restoring' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string };

type SessionContextValue = {
  session: SessionState;
  /** The typed API client, carrying this session's bearer and this install's device id. */
  api: ApiClient;
  /** This install's persistent device id (sent in X-Adulis-Device and as verify's device_id). */
  deviceId: () => Promise<string>;
  /** Register this install with the server once (POST /v1/devices). True if it just did. */
  ensureDeviceRegistered: () => Promise<boolean>;
  /** Persist a credential from a successful sign-in, then switch the app to signed in. */
  signIn: (token: string) => Promise<void>;
  /**
   * THE local sign-out boundary: credential, server cache and mode, in one place. Alone it
   * forgets the session on this device only (e.g. after a 401).
   */
  clearSession: () => Promise<void>;
  /**
   * Sign out: clearSession, with the server revoke (WO-API-001A) running alongside. Rejects
   * only if the device could not forget the credential.
   */
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Startup hydration. A credential that cannot be read starts this launch signed out rather
 * than crashing. It is NOT deleted: the failure may be transient (a keychain read before
 * first unlock), and the next sign-in overwrites a genuinely broken entry. Only
 * clearSession ever removes the credential. Whether a stored credential is still live is
 * the server's answer to the first bootstrap, not this function's.
 */
export async function restoreSession(storage: SessionStorage): Promise<SessionState> {
  try {
    const token = await storage.read();
    return token ? { status: 'signedIn', token } : { status: 'signedOut' };
  } catch (error) {
    console.warn(
      '[session] stored credential unreadable; starting signed out:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return { status: 'signedOut' };
  }
}

export function SessionProvider({
  storage,
  deviceStorage,
  children,
}: {
  storage: SessionStorage;
  deviceStorage: DeviceStorage;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<SessionState>({ status: 'restoring' });
  // The client reads the bearer when it sends, so it never holds a stale one.
  const token = useRef<string | null>(null);
  token.current = session.status === 'signedIn' ? session.token : null;

  useEffect(() => {
    let cancelled = false;
    void restoreSession(storage).then((restored) => {
      if (!cancelled) setSession(restored);
    });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  // Everything this run holds for the session: the bearer, every cached answer, the mode.
  const forgetInMemory = useCallback(() => {
    token.current = null;
    queryClient.clear();
    useUiStore.getState().setActiveMode(null);
    setSession({ status: 'signedOut' });
  }, [queryClient]);

  const clearSession = useCallback(async () => {
    // Storage first: if the delete fails the caller sees the error and the app does not
    // claim a sign-out that the next launch would undo.
    await storage.clear();
    forgetInMemory();
  }, [storage, forgetInMemory]);

  // useState, not useMemo: React may drop a memo, and the id must not change mid-run.
  const [deviceId] = useState(() => loadDeviceId(deviceStorage));

  const api = useMemo(
    () =>
      createApiClient({
        deviceId: () => deviceId,
        token: () => token.current,
        // The server says this credential is dead (401 SESSION_EXPIRED / SESSION_REVOKED).
        // Only the session the request carried: a late answer for an earlier session must
        // not end a newer one. The app leaves it at once whatever storage does; a credential
        // the delete failed to remove is dead, and the next launch's bootstrap ends it again.
        onSessionEnded: (ended) => {
          if (ended !== token.current) return;
          forgetInMemory();
          storage.clear().catch((error: unknown) => {
            console.warn(
              '[session] could not delete an ended credential:',
              error instanceof Error ? error.message : 'unknown error',
            );
          });
        },
      }),
    [deviceId, forgetInMemory, storage],
  );

  const ensureDeviceRegistered = useCallback(async () => {
    const id = await deviceId;
    if ((await deviceStorage.readRegistered().catch(() => null)) === id) return false;
    await api.registerDevice(id);
    await deviceStorage.writeRegistered(id).catch(() => undefined);
    return true;
  }, [api, deviceId, deviceStorage]);

  const signIn = useCallback(
    async (credential: string) => {
      // SecureStore first: a sign-in the next launch would forget is not a sign-in.
      await storage.write(credential);
      token.current = credential;
      setSession({ status: 'signedIn', token: credential });
    },
    [storage],
  );

  const signOut = useCallback(async () => {
    // The revoke runs alongside, never in front: the device forgets the credential at once
    // even on a stalled network, and a credential left on the device because the local
    // delete failed is still dead on the server. The client's timeout bounds the revoke.
    if (session.status === 'signedIn') {
      api.logout(session.token).catch((error: unknown) => {
        // Offline or a server error: the server session expires or is revoked later.
        console.warn(
          '[session] server sign-out failed; this device has forgotten the session:',
          error instanceof Error ? error.message : 'unknown error',
        );
      });
    }
    await clearSession();
  }, [session, api, clearSession]);

  const getDeviceId = useCallback(() => deviceId, [deviceId]);

  const value = useMemo(
    () => ({ session, api, deviceId: getDeviceId, ensureDeviceRegistered, signIn, clearSession, signOut }),
    [session, api, getDeviceId, ensureDeviceRegistered, signIn, clearSession, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
