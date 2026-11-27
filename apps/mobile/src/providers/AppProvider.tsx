// The React face of the runtime: selects the transport once, builds the runtime, drives the AppGate, and exposes state to
// screens through one hook. It never unmounts the navigator after the first settle (a re-bootstrap is a background refresh).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { asEpoch, type GatedMode, type Mode, type ModeEligibility, type SessionState } from '../contracts/gap-mob-session';
import { createMemoryDeviceStorage } from '../device/device';
import { secureDeviceStorage } from '../device/secure-device-storage';
import { initialGate, reduceGate, type AppGateState } from '../gate/gate';
import { createStore } from '../lib/store';
import { createMemoryCredentialStore } from '../session/credential-store';
import type { ImageCacheControl } from '../session/private-state';
import { secureCredentialStore } from '../session/secure-credential-store';
import { selectTransport } from '../transport/select';
import type { FixtureUi } from '../transport/port';
import type { BootstrapResult } from './bootstrap';
import { createRuntime, type EnterModeResult, type Runtime } from './runtime';

const expoImageCache: ImageCacheControl = {
  clear: async () => {
    await Image.clearMemoryCache();
    await Image.clearDiskCache();
  },
};

export interface AppValue {
  readonly runtime: Runtime | null;
  readonly gate: AppGateState;
  readonly session: SessionState;
  readonly eligibility: ModeEligibility | null;
  readonly activeMode: Mode;
  readonly modeEnded: GatedMode | null;
  readonly fixtureUi: FixtureUi | null;
  /** True after a sign-out whose credential delete failed (the app is signed out and fails closed on restart). */
  readonly signOutIncomplete: boolean;
  retry(): void;
  checkAgain(): void;
  enterMode(mode: Mode): EnterModeResult;
  signOut(): void;
}

const RESTORING: SessionState = { kind: 'RESTORING', epoch: asEpoch(0) };
const NEVER = () => () => undefined;
// What screens read before the runtime exists (the first frames): no eligibility, Buyer mode, nothing ended.
const emptyEligibility = createStore<ModeEligibility | null>(null);
const emptyMode = createStore<Mode>('BUYER');
const emptyEnded = createStore<GatedMode | null>(null);
const Context = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const value = useContext(Context);
  if (value === null) throw new Error('useApp outside AppProvider');
  return value;
}

export function AppProvider({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [boot, setBoot] = useState<{ readonly runtime: Runtime; readonly fixtureUi: FixtureUi | null } | null>(null);
  const [gate, dispatch] = useReducer(reduceGate, initialGate);
  const [signOutIncomplete, setSignOutIncomplete] = useState(false);
  const gateRef = useRef(gate);
  gateRef.current = gate;
  const runtime = boot?.runtime ?? null;

  const apply = useCallback((result: BootstrapResult) => {
    if (result.kind === 'OK') dispatch({ type: 'BOOTSTRAP_OK', client: result.client, market: result.market });
    else if (result.kind === 'FAILED') dispatch({ type: 'BOOTSTRAP_FAILED', cause: result.cause });
  }, []);

  const refresh = useCallback(async () => {
    if (runtime === null) return;
    let result = await runtime.refresh();
    if (result.kind === 'STALE') result = await runtime.refresh(); // the session changed under it: ask once more as the new session
    apply(result);
  }, [runtime, apply]);

  useEffect(() => {
    let alive = true;
    dispatch({ type: 'APP_START' });
    void (async () => {
      const selection = await selectTransport();
      const fixture = selection.fixtureEnv;
      const created = await createRuntime({
        transport: selection.transport,
        // A fixture session is memory only: nothing it mints may reach the secure storage a release build restores from.
        credentials: fixture ? createMemoryCredentialStore() : secureCredentialStore,
        deviceStorage: fixture ? createMemoryDeviceStorage() : secureDeviceStorage,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        queryClient,
        imageCache: expoImageCache,
        ...(fixture ? { deviceId: fixture.deviceId } : {}),
      });
      if (!alive) return;
      setBoot({ runtime: created, fixtureUi: selection.fixtureUi });
      let result = await created.start();
      if (result.kind === 'STALE') result = await created.refresh();
      if (!alive) return;
      dispatch({ type: 'RESTORE_DONE' });
      apply(result);
    })();
    return () => {
      alive = false;
    };
  }, [queryClient, apply]);

  // Connectivity and foreground return: a re-bootstrap runs only when the app is showing the offline state. What counts as a
  // "meaningful" foreground return for a ready app is an open decision and is not invented here.
  useEffect(() => {
    if (runtime === null) return undefined;
    const subscription = Network.addNetworkStateListener((state) => {
      runtime.device.setNetwork(state.isConnected ? 'ONLINE' : 'OFFLINE');
      if (state.isConnected && gateRef.current.kind === 'READY_OFFLINE') void refresh();
    });
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active' && gateRef.current.kind === 'READY_OFFLINE') void refresh();
    });
    return () => {
      subscription.remove();
      appState.remove();
    };
  }, [runtime, refresh]);

  const session = useSyncExternalStore(
    runtime ? (cb) => runtime.session.subscribe(() => cb()) : NEVER,
    () => (runtime ? runtime.session.state() : RESTORING),
  );
  const eligibilityStore = runtime ? runtime.eligibility : emptyEligibility;
  const modeStore = runtime ? runtime.activeMode : emptyMode;
  const endedStore = runtime ? runtime.modeEnded : emptyEnded;
  const eligibility = useSyncExternalStore(eligibilityStore.subscribe, eligibilityStore.get);
  const activeMode = useSyncExternalStore(modeStore.subscribe, modeStore.get);
  const modeEnded = useSyncExternalStore(endedStore.subscribe, endedStore.get);

  const value = useMemo<AppValue>(
    () => ({
      runtime,
      gate,
      session,
      eligibility,
      activeMode,
      modeEnded,
      fixtureUi: boot?.fixtureUi ?? null,
      signOutIncomplete,
      retry: () => void refresh(),
      checkAgain: () => {
        dispatch({ type: 'CHECK_AGAIN' });
        void refresh();
      },
      enterMode: (mode) => (runtime ? runtime.enterMode(mode) : { kind: 'CHECKING' }),
      signOut: () => {
        if (runtime === null) return;
        setSignOutIncomplete(false);
        void runtime.session.signOut().then((result) => setSignOutIncomplete(!result.credentialCleared));
      },
    }),
    [runtime, gate, session, eligibility, activeMode, modeEnded, boot, signOutIncomplete, refresh],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <Context.Provider value={value}>{children}</Context.Provider>
    </QueryClientProvider>
  );
}
