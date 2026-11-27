// AppGate: the initialisation state machine (MOB-FE-01 s9). A pure reducer; effects (restore, bootstrap) live in the runtime.
// UPGRADE_REQUIRED can never be left by a failure: a failed re-check keeps the blocking screen (an offline phone must not be
// able to walk past the version floor).
import type { ClientVerdict, MarketContext, UpgradeRequired } from '../contracts/gap-mob-session';

export type UnavailableCause = 'OFFLINE' | 'UNAVAILABLE';

export type AppGateState =
  | { readonly kind: 'BOOTING' }
  | { readonly kind: 'RESTORING_SESSION' }
  | { readonly kind: 'BOOTSTRAPPING'; readonly first: boolean; readonly fromUpgrade: UpgradeRequired | null }
  | { readonly kind: 'READY'; readonly market: MarketContext; readonly upgradeRecommended: boolean }
  | { readonly kind: 'READY_OFFLINE'; readonly cause: UnavailableCause }
  | { readonly kind: 'UPGRADE_REQUIRED'; readonly verdict: UpgradeRequired }
  | { readonly kind: 'INIT_FAILED'; readonly cause: 'MISCONFIGURED' };

export type GateEvent =
  | { readonly type: 'APP_START' }
  | { readonly type: 'RESTORE_DONE' }
  | { readonly type: 'BOOTSTRAP_OK'; readonly client: ClientVerdict; readonly market: MarketContext }
  | { readonly type: 'BOOTSTRAP_FAILED'; readonly cause: UnavailableCause }
  | { readonly type: 'MISCONFIGURED' }
  | { readonly type: 'CHECK_AGAIN' };

export const initialGate: AppGateState = { kind: 'BOOTING' };

function afterBootstrap(event: Extract<GateEvent, { type: 'BOOTSTRAP_OK' }>): AppGateState {
  if (event.client.status === 'UPGRADE_REQUIRED') return { kind: 'UPGRADE_REQUIRED', verdict: event.client };
  return { kind: 'READY', market: event.market, upgradeRecommended: event.client.status === 'UPGRADE_RECOMMENDED' };
}

export function reduceGate(state: AppGateState, event: GateEvent): AppGateState {
  if (event.type === 'MISCONFIGURED') return { kind: 'INIT_FAILED', cause: 'MISCONFIGURED' };
  switch (state.kind) {
    case 'BOOTING':
      return event.type === 'APP_START' ? { kind: 'RESTORING_SESSION' } : state;
    case 'RESTORING_SESSION':
      return event.type === 'RESTORE_DONE' ? { kind: 'BOOTSTRAPPING', first: true, fromUpgrade: null } : state;
    case 'BOOTSTRAPPING':
      if (event.type === 'BOOTSTRAP_OK') return afterBootstrap(event);
      if (event.type === 'BOOTSTRAP_FAILED') return state.fromUpgrade ? { kind: 'UPGRADE_REQUIRED', verdict: state.fromUpgrade } : { kind: 'READY_OFFLINE', cause: event.cause };
      return state;
    case 'READY':
    case 'READY_OFFLINE':
      if (event.type === 'BOOTSTRAP_OK') return afterBootstrap(event);
      if (event.type === 'BOOTSTRAP_FAILED') return { kind: 'READY_OFFLINE', cause: event.cause };
      return state;
    case 'UPGRADE_REQUIRED':
      if (event.type === 'CHECK_AGAIN') return { kind: 'BOOTSTRAPPING', first: false, fromUpgrade: state.verdict };
      return state;
    case 'INIT_FAILED':
      return state;
  }
}
