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

import { createApiClient, wasAnswered, type ApiClient } from '../api/client';

/** A request refused before sending: the session it was bound to is no longer this app's. */
export class SessionChanged extends Error {
  constructor() {
    super('session changed');
    this.name = 'SessionChanged';
  }
}

/** A client that speaks for one session only (see SessionContextValue.boundApi). */
export type BoundApi = ApiClient & { isCurrent: () => boolean };
import {
  endRegistrationIntent,
  loadDeviceId,
  loadRegistrationKey,
  type DeviceStorage,
} from '../device/device-storage';
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
  /**
   * A client bound to ONE credential (WO-009A S9): every request carries exactly that bearer,
   * and is refused before it is sent once that session is no longer this app's (signed out,
   * expired, or another sign-in). For work that starts in one session and may finish after
   * a session change: a guest's Save continuation, a Save tap, a page's saved-state read.
   */
  boundApi: (credential: string) => BoundApi;
  /** This install's persistent device id (sent in X-Adulis-Device and as verify's device_id). */
  deviceId: () => Promise<string>;
  /** Register this install with the server once (POST /v1/devices). True if it just did. */
  ensureDeviceRegistered: () => Promise<boolean>;
  /**
   * The phone this app run successfully asked a code for. Verify works only for it: a phone
   * in a route parameter proves nothing, and a link must never make the app text a number.
   * Memory only, so a cold start forgets it; never the code.
   */
  otpPhone: string | null;
  setOtpPhone: (phone: string | null) => void;
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
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
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
    useUiStore.getState().setPendingSave(null);
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

  // The server says this credential is dead (401 SESSION_EXPIRED / SESSION_REVOKED). Only the
  // session the request carried: a late answer for an earlier session must not end a newer
  // one. The app leaves it at once whatever storage does; a credential the delete failed to
  // remove is dead, and the next launch's bootstrap ends it again.
  const onSessionEnded = useCallback(
    (ended: string) => {
      if (ended !== token.current) return;
      forgetInMemory();
      storage.clear().catch((error: unknown) => {
        console.warn(
          '[session] could not delete an ended credential:',
          error instanceof Error ? error.message : 'unknown error',
        );
      });
    },
    [forgetInMemory, storage],
  );

  const api = useMemo(
    () => createApiClient({ deviceId: () => deviceId, token: () => token.current, onSessionEnded }),
    [deviceId, onSessionEnded],
  );

  const boundApi = useCallback(
    (credential: string): BoundApi => {
      const isCurrent = () => token.current === credential;
      const client = createApiClient({
        deviceId: () => deviceId,
        // Read right before the request is sent (no await in between): a session that changed
        // while this work waited refuses here, so nothing is ever sent under another Account.
        token: () => {
          if (!isCurrent()) throw new SessionChanged();
          return credential;
        },
        onSessionEnded,
      });
      return { ...client, isCurrent };
    },
    [deviceId, onSessionEnded],
  );

  // One registration at a time: a refetch (Send code) joins the attempt in flight instead of
  // racing it under the same key, where one answer would end the other's intent.
  const registering = useRef<Promise<boolean> | null>(null);
  const ensureDeviceRegistered = useCallback(() => {
    registering.current ??= (async () => {
      const id = await deviceId;
      if ((await deviceStorage.readRegistered().catch(() => null)) === id) return false;
      // The intent's own UUIDv7 key, kept across lost answers and restarts until it ends.
      const key = await loadRegistrationKey(deviceStorage);
      try {
        await api.registerDevice(id, key);
      } catch (failure) {
        // A server answer ends the intent: retrying under its key would replay a stored refusal.
        if (wasAnswered(failure)) await endRegistrationIntent(deviceStorage);
        throw failure;
      }
      await deviceStorage.writeRegistered(id).catch(() => undefined);
      await endRegistrationIntent(deviceStorage);
      return true;
    })().finally(() => {
      registering.current = null;
    });
    return registering.current;
  }, [api, deviceId, deviceStorage]);

  const signIn = useCallback(
    async (credential: string) => {
      // SecureStore first: a sign-in the next launch would forget is not a sign-in.
      await storage.write(credential);
      token.current = credential;
      setSession({ status: 'signedIn', token: credential });
      setOtpPhone(null); // the code flow is spent
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
    () => ({
      session,
      api,
      boundApi,
      deviceId: getDeviceId,
      ensureDeviceRegistered,
      otpPhone,
      setOtpPhone,
      signIn,
      clearSession,
      signOut,
    }),
    [session, api, boundApi, getDeviceId, ensureDeviceRegistered, otpPhone, signIn, clearSession, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
