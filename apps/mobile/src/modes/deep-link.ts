// Cold-start and runtime deep links (MOB-FE-01 s9). Input is untrusted: a link never bypasses authentication, authorization,
// the version floor, moderation or availability, and never makes the app send a code. Pure: no I/O. Public targets are
// resolved to their canonical public status by their own screens (MOB-FE-02); this module decides what a link may reach.
import { evaluateRoute, type GuardContext, type ModeUnavailable } from './route-guard';
import { matchRoute, type SafeRoute } from './routes';
import type { GatedMode, UpgradeRequired } from '../contracts/gap-mob-session';

export type DeepLinkResolution =
  | { readonly kind: 'OPEN'; readonly route: SafeRoute }
  | { readonly kind: 'SIGN_IN_REQUIRED'; readonly returnTo: SafeRoute }
  | { readonly kind: 'UPGRADE_REQUIRED'; readonly verdict: UpgradeRequired }
  | { readonly kind: 'MODE_UNAVAILABLE'; readonly mode: GatedMode; readonly unavailable: ModeUnavailable }
  | { readonly kind: 'NOT_AVAILABLE' } // no such ordinary route (an Order, delivery, handoff, claim, operator link): one outcome
  | { readonly kind: 'REJECTED_INPUT' } // failed local validation; never forwarded
  | { readonly kind: 'PARKED'; readonly until: 'SESSION' | 'BOOTSTRAP' };

/** Only this app's scheme or an https link is considered; the host of an https link is the owner's (not checked here). */
const SCHEME = /^adulis:\/\/(?:\/)?([^?#]*)(?:\?[^#]*)?(?:#.*)?$/;

/** Pure parse. The raw input is not retained. Unknown templates and bad parameters are null. */
export function parseLink(raw: unknown): SafeRoute | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048) return null;
  const hit = SCHEME.exec(raw);
  const path = hit ? `/${hit[1] ?? ''}` : raw.startsWith('/') ? raw.split(/[?#]/)[0] ?? '' : null;
  return path === null ? null : matchRoute(path);
}

export function resolveLink(raw: unknown, ctx: GuardContext): DeepLinkResolution {
  const route = parseLink(raw);
  if (route === null) {
    // A well-formed link to something that is not an ordinary route (an Order, say) is not available; garbage is rejected.
    return typeof raw === 'string' && /^(adulis:\/\/\/?|\/)[A-Za-z0-9/_-]{0,200}$/.test(raw) ? { kind: 'NOT_AVAILABLE' } : { kind: 'REJECTED_INPUT' };
  }
  const verdict = evaluateRoute(route, ctx);
  switch (verdict.kind) {
    case 'ALLOW':
      return { kind: 'OPEN', route };
    case 'WAIT':
      return { kind: 'PARKED', until: verdict.waitingFor === 'SESSION' ? 'SESSION' : 'BOOTSTRAP' };
    case 'SIGN_IN_REQUIRED':
      return { kind: 'SIGN_IN_REQUIRED', returnTo: route };
    case 'UPGRADE_REQUIRED':
      return { kind: 'UPGRADE_REQUIRED', verdict: verdict.verdict };
    case 'MODE_UNAVAILABLE':
      return { kind: 'MODE_UNAVAILABLE', mode: verdict.mode, unavailable: verdict.unavailable };
  }
}
