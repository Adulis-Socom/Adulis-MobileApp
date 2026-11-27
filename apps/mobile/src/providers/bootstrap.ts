// One bootstrap round trip, applied to the session (MOB-FE-01 s6, s9). The server's answer is the only source of: whether the
// restored credential is live (and for which Account), the version verdict, the Market and the mode eligibility. The client
// stamps the request before any await and drops the answer if the session changed meanwhile.
import { SessionChanged, type ClientVerdict, type MarketContext, type ModeEligibility } from '../contracts/gap-mob-session';
import type { UnavailableCause } from '../gate/gate';
import { adoptEligibility } from '../modes/eligibility';
import type { SessionManager } from '../session/session-manager';
import { TransportError } from '../transport/port';

export type BootstrapResult =
  | { readonly kind: 'OK'; readonly client: ClientVerdict; readonly market: MarketContext; readonly eligibility: ModeEligibility | null }
  | { readonly kind: 'FAILED'; readonly cause: UnavailableCause }
  | { readonly kind: 'STALE' };

const SESSION_ENDING = new Set(['SESSION_EXPIRED', 'SESSION_REVOKED', 'AUDIENCE_NOT_PERMITTED', 'AUTHENTICATION_REQUIRED']);

export async function runBootstrap(session: SessionManager, now: () => number = Date.now): Promise<BootstrapResult> {
  // Two attempts at most: if the server ends the session, the second runs as a guest.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stamp = session.stamp();
    let view;
    try {
      view = await session.call('bootstrap.get', {});
    } catch (error) {
      if (error instanceof SessionChanged) return { kind: 'STALE' };
      if (error instanceof TransportError) {
        if (SESSION_ENDING.has(error.code) && session.state().kind === 'GUEST' && attempt === 0) continue;
        return { kind: 'FAILED', cause: error.code === 'NETWORK' || error.code === 'TIMEOUT' ? 'OFFLINE' : 'UNAVAILABLE' };
      }
      return { kind: 'FAILED', cause: 'UNAVAILABLE' };
    }
    const state = session.state();
    if (view.account === null) {
      // The server knows no Account for this credential: a restored or current session that the server does not recognise has ended.
      if (state.kind === 'RESTORED_UNCONFIRMED' || state.kind === 'AUTHENTICATED') {
        await session.endFromServer(stamp.epoch, 'EXPIRED', null);
        if (attempt === 0) continue;
      }
      return { kind: 'OK', client: view.client, market: view.market, eligibility: null };
    }
    const confirmed = await session.confirmBootstrap(stamp, view.account.accountRef);
    if (confirmed === 'ANOMALY') {
      if (attempt === 0) continue;
      return { kind: 'OK', client: view.client, market: view.market, eligibility: null };
    }
    if (confirmed === 'STALE') return { kind: 'STALE' };
    const eligibility = adoptEligibility(view.account.eligibility, view.account.accountRef, stamp, (s) => session.isCurrent(s), now());
    return { kind: 'OK', client: view.client, market: view.market, eligibility };
  }
  return { kind: 'FAILED', cause: 'UNAVAILABLE' };
}
