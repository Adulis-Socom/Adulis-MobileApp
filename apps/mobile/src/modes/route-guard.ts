// The route guard: a PURE function of state (MOB-FE-01 s7, s9, s10). No I/O, no navigation, no network.
// Precedence, highest first: UPGRADE_REQUIRED, WAIT(SESSION), access class (SIGN_IN_REQUIRED / WAIT), MODE_UNAVAILABLE, ALLOW.
// "Unknown" is never "no": an offline or unloaded eligibility is UNCONFIRMED and is never shown as a revoked relationship.
import type { GatedMode, ModeAvailability, ModeEligibility, SessionState, UpgradeRequired } from '../contracts/gap-mob-session';
import type { AppGateState } from '../gate/gate';
import { ROUTES, type RouteSpec, type RouteTemplate, type SafeRoute } from './routes';

export type ModeUnavailable =
  | Exclude<ModeAvailability, { status: 'AVAILABLE' }>
  | { readonly status: 'UNCONFIRMED'; readonly cause: 'OFFLINE' | 'ERROR' | 'NOT_LOADED' }; // CLIENT-ONLY: never from the server

export type RouteGuardResult =
  | { readonly kind: 'ALLOW' }
  | { readonly kind: 'WAIT'; readonly waitingFor: 'SESSION' | 'BOOTSTRAP' | 'ELIGIBILITY' }
  | { readonly kind: 'SIGN_IN_REQUIRED'; readonly returnTo: SafeRoute | null }
  | { readonly kind: 'MODE_UNAVAILABLE'; readonly mode: GatedMode; readonly unavailable: ModeUnavailable }
  | { readonly kind: 'UPGRADE_REQUIRED'; readonly verdict: UpgradeRequired };

export interface GuardContext {
  readonly app: AppGateState;
  readonly session: SessionState;
  readonly eligibility: ModeEligibility | null; // null until the server answered for the CURRENT epoch
}

export const specOf = (template: RouteTemplate): RouteSpec => ROUTES[template];

export function evaluateRoute(route: SafeRoute, ctx: GuardContext): RouteGuardResult {
  const spec = specOf(route.template);
  if (ctx.app.kind === 'UPGRADE_REQUIRED') return { kind: 'UPGRADE_REQUIRED', verdict: ctx.app.verdict };
  if (ctx.session.kind === 'RESTORING' || ctx.app.kind === 'BOOTING' || ctx.app.kind === 'RESTORING_SESSION') return { kind: 'WAIT', waitingFor: 'SESSION' };
  if (spec.access === 'PUBLIC') return { kind: 'ALLOW' };
  if (ctx.session.kind === 'GUEST') return { kind: 'SIGN_IN_REQUIRED', returnTo: route };
  // Credential found but the server has not answered: private data is not drawn, and offline is not "unauthenticated".
  if (ctx.session.kind === 'RESTORED_UNCONFIRMED') return { kind: 'WAIT', waitingFor: 'BOOTSTRAP' };
  if (spec.access !== 'MODE_GATED' || spec.mode === undefined) return { kind: 'ALLOW' };

  const offline = ctx.app.kind === 'READY_OFFLINE';
  const { eligibility } = ctx;
  if (eligibility === null || eligibility.epoch !== ctx.session.epoch) {
    return offline ? { kind: 'MODE_UNAVAILABLE', mode: spec.mode, unavailable: { status: 'UNCONFIRMED', cause: 'OFFLINE' } } : { kind: 'WAIT', waitingFor: 'ELIGIBILITY' };
  }
  const answer = eligibility.modes[spec.mode];
  return answer.status === 'AVAILABLE' ? { kind: 'ALLOW' } : { kind: 'MODE_UNAVAILABLE', mode: spec.mode, unavailable: answer };
}

