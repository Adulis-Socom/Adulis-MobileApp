// The runtime: everything the app builds once at start, wired so an identity change purges private state SYNCHRONOUSLY,
// before any subscriber renders (MOB-FE-01 s7). Plain TypeScript, no React, so it is testable without a renderer.
import type { QueryClient } from '@tanstack/react-query';

import type { CodeChallenge, GatedMode, Mode, ModeEligibility, SessionState } from '../contracts/gap-mob-session';
import { DeviceController, loadDeviceId, type DeviceStorage } from '../device/device';
import { createStore, type Store } from '../lib/store';
import { PrivateStateRegistry, purgeImages, purgePrivateQueries, type ImageCacheControl } from '../session/private-state';
import type { CredentialStore } from '../session/credential-store';
import { SessionManager } from '../session/session-manager';
import type { MobileTransport } from '../transport/port';
import { runBootstrap, type BootstrapResult } from './bootstrap';

export type EnterModeResult =
  | { readonly kind: 'ENTERED' }
  | { readonly kind: 'SIGN_IN_REQUIRED' }
  | { readonly kind: 'CHECKING' } // unconfirmed or not loaded: unknown is never "no"
  | { readonly kind: 'UNAVAILABLE' };

export interface RuntimeOptions {
  readonly transport: MobileTransport;
  readonly credentials: CredentialStore;
  readonly deviceStorage: DeviceStorage;
  readonly platform: 'android' | 'ios';
  readonly queryClient: QueryClient;
  readonly imageCache: ImageCacheControl;
  /** Fixture sessions pass their own reserved device id; a live session always creates a real one. */
  readonly deviceId?: string;
  readonly now?: () => number;
}

export interface Runtime {
  readonly transport: MobileTransport;
  readonly session: SessionManager;
  readonly device: DeviceController;
  readonly queryClient: QueryClient;
  readonly privateState: PrivateStateRegistry;
  readonly eligibility: Store<ModeEligibility | null>;
  readonly activeMode: Store<Mode>;
  /** A mode the server ended while the person was in it: shown once, then cleared. */
  readonly modeEnded: Store<GatedMode | null>;
  /** The sign-in challenge this run created: memory only, cleared on every identity change. Verify opens only for one. */
  readonly challenge: Store<CodeChallenge | null>;
  /** Diagnostics: purge hooks that failed. A failed purge is never silent. */
  readonly diagnostics: { imagePurgeFailures: number };
  /** Register the device once (shared in flight), then run one bootstrap and apply it. */
  start(): Promise<BootstrapResult>;
  refresh(): Promise<BootstrapResult>;
  enterMode(mode: Mode): EnterModeResult;
}

export async function createRuntime(options: RuntimeOptions): Promise<Runtime> {
  const deviceId = await loadDeviceId(options.deviceStorage, options.deviceId === undefined ? undefined : () => options.deviceId as string);
  const session = new SessionManager({
    credentials: options.credentials,
    transport: options.transport,
    deviceId,
    onPermissionDenied: () => void refresh(),
    ...(options.now ? { now: options.now } : {}),
  });
  const device = new DeviceController(deviceId, options.platform, options.deviceStorage);
  const privateState = new PrivateStateRegistry(() => session.state().epoch);
  const eligibility = createStore<ModeEligibility | null>(null);
  const activeMode = createStore<Mode>('BUYER');
  const modeEnded = createStore<GatedMode | null>(null);
  const challenge = createStore<CodeChallenge | null>(null);
  const diagnostics = { imagePurgeFailures: 0 };

  // The identity hook: runs inside the transition, before any subscriber renders.
  session.onIdentityChange((prev, next) => {
    eligibility.set(null);
    activeMode.set('BUYER');
    modeEnded.set(null);
    challenge.set(null);
    privateState.onIdentityChange(prev, next);
    purgePrivateQueries(options.queryClient);
    purgeImages(options.imageCache, () => {
      diagnostics.imagePurgeFailures += 1;
    });
  });

  // After the person becomes someone (sign-in, switch), the new Account's eligibility is fetched; a restore-and-confirm
  // keeps its epoch and is applied by the bootstrap that confirmed it, so this cannot loop.
  session.subscribe((next: SessionState, prev: SessionState) => {
    if (next.kind === 'AUTHENTICATED' && next.epoch !== prev.epoch) void refresh();
  });

  async function refresh(): Promise<BootstrapResult> {
    const result = await runBootstrap(session, options.now);
    if (result.kind === 'OK') {
      eligibility.set(result.eligibility);
      const mode = activeMode.get();
      if (mode !== 'BUYER') {
        const answer = result.eligibility?.modes[mode];
        if (answer === undefined || answer.status !== 'AVAILABLE') {
          // ELIGIBILITY_CHANGED: unmount the mode, drop its caches and the active Seller, say so once.
          const state = session.state();
          if (state.kind === 'AUTHENTICATED') privateState.purgeMode(state.accountRef, mode);
          activeMode.set('BUYER');
          modeEnded.set(mode);
        }
      }
    }
    return result;
  }

  return {
    transport: options.transport,
    session,
    device,
    queryClient: options.queryClient,
    privateState,
    eligibility,
    activeMode,
    modeEnded,
    challenge,
    diagnostics,
    refresh,
    async start() {
      await session.restore();
      await device.ensureRegistered(() => session.call('device.register', { deviceId, platform: options.platform }));
      return refresh();
    },
    enterMode(mode) {
      if (mode === 'BUYER') {
        const from = activeMode.get();
        const state = session.state();
        if (from !== 'BUYER' && state.kind === 'AUTHENTICATED') privateState.purgeMode(state.accountRef, from);
        activeMode.set('BUYER');
        return { kind: 'ENTERED' };
      }
      const state = session.state();
      if (state.kind === 'GUEST') return { kind: 'SIGN_IN_REQUIRED' };
      const current = eligibility.get();
      if (state.kind !== 'AUTHENTICATED' || current === null || current.epoch !== state.epoch) return { kind: 'CHECKING' };
      if (current.modes[mode].status !== 'AVAILABLE') return { kind: 'UNAVAILABLE' };
      const from = activeMode.get();
      if (from !== 'BUYER' && from !== mode) privateState.purgeMode(state.accountRef, from); // leaving a mode drops its caches
      activeMode.set(mode); // no re-authentication, no epoch change
      modeEnded.set(null);
      return { kind: 'ENTERED' };
    },
  };
}
