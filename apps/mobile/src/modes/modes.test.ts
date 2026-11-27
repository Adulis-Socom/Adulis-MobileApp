// Mode eligibility, the route guard, route/link parsing and the AppGate: all pure, all server-authoritative. Rows H-008..H-016.
import { asAccountRef, asDeviceId, asEpoch, type ModeEligibility, type SessionState, type UpgradeRequired } from '../contracts/gap-mob-session';
import { initialGate, reduceGate, type AppGateState } from '../gate/gate';
import { resolveLink, parseLink } from './deep-link';
import { adoptEligibility } from './eligibility';
import { evaluateRoute, type GuardContext } from './route-guard';
import { matchRoute, pathOf, ROUTES } from './routes';

const ACCOUNT = asAccountRef('acct-1');
const stamp = (epoch: number) => ({ epoch: asEpoch(epoch), accountRef: ACCOUNT, deviceId: asDeviceId('dv-1') });
const adopt = (wire: Record<string, unknown>) => adoptEligibility(wire, ACCOUNT, stamp(2), () => true, 0) as ModeEligibility;
const READY: AppGateState = { kind: 'READY', market: { status: 'UNRESOLVED' }, upgradeRecommended: false };
const auth: SessionState = { kind: 'AUTHENTICATED', epoch: asEpoch(2), accountRef: ACCOUNT, confirmedAt: 0 };
const ctx = (over: Partial<GuardContext>): GuardContext => ({ app: READY, session: auth, eligibility: null, ...over });
const UPGRADE: UpgradeRequired = { status: 'UPGRADE_REQUIRED', message: null, storeLink: null };

describe('eligibility is parsed fail-closed and only from a server answer (H-011)', () => {
  it('adopts AVAILABLE, PENDING, REVOKED and RESTRICTED as sent', () => {
    const e = adopt({ SELLER_COMPANION: { status: 'AVAILABLE' }, COURIER: { status: 'PENDING', message: { key: 'mobile.mode.pending' } } });
    expect(e.modes.SELLER_COMPANION).toEqual({ status: 'AVAILABLE' });
    expect(e.modes.COURIER).toEqual({ status: 'PENDING', message: { key: 'mobile.mode.pending' } });
    expect(e.modes.BUYER).toEqual({ status: 'AVAILABLE' });
  });
  it.each([[undefined], [null], ['AVAILABLE'], [{ status: 'available' }], [{ status: 'SOMETHING_NEW' }], [{}], [{ available: true }]])('treats %j as NOT_ELIGIBLE, never AVAILABLE', (raw) => {
    expect(adopt({ SELLER_COMPANION: raw, COURIER: raw }).modes.SELLER_COMPANION.status).toBe('NOT_ELIGIBLE');
  });
  it('gives a RESTRICTED answer the server message, or a generic one when it sent none', () => {
    expect(adopt({ SELLER_COMPANION: { status: 'RESTRICTED' } }).modes.SELLER_COMPANION).toEqual({ status: 'RESTRICTED', message: { key: 'mobile.mode.restricted' } });
  });
  it('refuses an answer for a session that is no longer current', () => {
    expect(adoptEligibility({}, ACCOUNT, stamp(1), () => false, 0)).toBeNull();
  });
});

describe('route guard (H-003, H-008..H-010, H-012, H-014)', () => {
  const home = { template: '/home', params: {} } as const;
  const saved = { template: '/saved', params: {} } as const;
  const companion = { template: '/companion', params: {} } as const;
  const courier = { template: '/courier', params: {} } as const;
  const guest: SessionState = { kind: 'GUEST', epoch: asEpoch(1), lastEnd: null };

  it('lets a guest see public routes and sends private ones to sign-in with the route held', () => {
    expect(evaluateRoute(home, ctx({ session: guest })).kind).toBe('ALLOW');
    expect(evaluateRoute(saved, ctx({ session: guest }))).toEqual({ kind: 'SIGN_IN_REQUIRED', returnTo: saved });
  });
  it('waits, drawing nothing private, while the session or the bootstrap is unsettled', () => {
    expect(evaluateRoute(saved, ctx({ session: { kind: 'RESTORING', epoch: asEpoch(0) } }))).toEqual({ kind: 'WAIT', waitingFor: 'SESSION' });
    expect(evaluateRoute(saved, ctx({ session: { kind: 'RESTORED_UNCONFIRMED', epoch: asEpoch(1) } }))).toEqual({ kind: 'WAIT', waitingFor: 'BOOTSTRAP' });
  });
  it('shows nothing to a guest behind the mode gate and offers sign-in', () => {
    expect(evaluateRoute(companion, ctx({ session: guest })).kind).toBe('SIGN_IN_REQUIRED');
  });
  it('allows a mode only when the server said AVAILABLE for THIS session', () => {
    expect(evaluateRoute(companion, ctx({ eligibility: adopt({ SELLER_COMPANION: { status: 'AVAILABLE' } }) })).kind).toBe('ALLOW');
    expect(evaluateRoute(courier, ctx({ eligibility: adopt({ SELLER_COMPANION: { status: 'AVAILABLE' } }) }))).toMatchObject({ kind: 'MODE_UNAVAILABLE', unavailable: { status: 'NOT_ELIGIBLE' } });
    // An answer stamped for another epoch is never trusted.
    expect(evaluateRoute(companion, ctx({ session: { ...auth, epoch: asEpoch(3) }, eligibility: adopt({ SELLER_COMPANION: { status: 'AVAILABLE' } }) }))).toEqual({ kind: 'WAIT', waitingFor: 'ELIGIBILITY' });
  });
  it('maps pending, revoked and restricted without computing anything', () => {
    for (const status of ['PENDING', 'REVOKED', 'RESTRICTED'] as const) {
      expect(evaluateRoute(companion, ctx({ eligibility: adopt({ SELLER_COMPANION: { status } }) }))).toMatchObject({ kind: 'MODE_UNAVAILABLE', unavailable: { status } });
    }
  });
  it('treats unloaded eligibility as unknown, never as revoked: waiting online, UNCONFIRMED offline', () => {
    expect(evaluateRoute(companion, ctx({}))).toEqual({ kind: 'WAIT', waitingFor: 'ELIGIBILITY' });
    expect(evaluateRoute(companion, ctx({ app: { kind: 'READY_OFFLINE', cause: 'OFFLINE' } }))).toMatchObject({ kind: 'MODE_UNAVAILABLE', unavailable: { status: 'UNCONFIRMED', cause: 'OFFLINE' } });
  });
  it('the version floor outranks everything, including a public route', () => {
    expect(evaluateRoute(home, ctx({ app: { kind: 'UPGRADE_REQUIRED', verdict: UPGRADE } })).kind).toBe('UPGRADE_REQUIRED');
  });
});

describe('routes and deep links (cold start, H-003)', () => {
  it('has no Order, delivery, handoff, claim, Reservation or Operator template', () => {
    expect(Object.keys(ROUTES).filter((r) => /order|deliver|handoff|claim|reserv|operator|checkout/i.test(r)).filter((r) => r !== '/orders')).toEqual([]);
  });
  it('classifies a link by the same table the screens are guarded by and rebuilds the path from validated parts', () => {
    const route = matchRoute('/product/p-123');
    expect(route).toEqual({ template: '/product/[productRef]', params: { productRef: 'p-123' } });
    expect(pathOf(route as NonNullable<typeof route>)).toBe('/product/p-123');
    expect(parseLink('adulis://sellers/s_9?x=1#y')).toEqual({ template: '/sellers/[sellerRef]', params: { sellerRef: 's_9' } });
  });
  it.each([['/product/..%2F..'], ['/product/a b'], ['/product/'], ['//evil.example/home'], ['/' + 'a'.repeat(600)], ['javascript:alert(1)'], [42], [null], ['']])('rejects %j locally and forwards nothing', (raw) => {
    expect(parseLink(raw)).toBeNull();
    expect(['REJECTED_INPUT', 'NOT_AVAILABLE']).toContain(resolveLink(raw, ctx({})).kind);
  });
  it('an Order or Operator link is NOT_AVAILABLE or rejected: no such ordinary route', () => {
    expect(resolveLink('adulis://orders/o-1', ctx({})).kind).toBe('NOT_AVAILABLE');
    expect(resolveLink('https://operator.example/login', ctx({})).kind).toBe('REJECTED_INPUT');
  });
  it('parks before the session settles, asks a guest to sign in without sending a code, and obeys the version floor', () => {
    expect(resolveLink('adulis://saved', ctx({ session: { kind: 'RESTORING', epoch: asEpoch(0) } }))).toEqual({ kind: 'PARKED', until: 'SESSION' });
    expect(resolveLink('adulis://saved', ctx({ session: { kind: 'GUEST', epoch: asEpoch(1), lastEnd: null } }))).toEqual({ kind: 'SIGN_IN_REQUIRED', returnTo: { template: '/saved', params: {} } });
    expect(resolveLink('adulis://home', ctx({ app: { kind: 'UPGRADE_REQUIRED', verdict: UPGRADE } })).kind).toBe('UPGRADE_REQUIRED');
  });
});

describe('AppGate (H-023, H-024)', () => {
  const ok = { type: 'BOOTSTRAP_OK', client: { status: 'OK' }, market: { status: 'UNRESOLVED' } } as const;
  const run = (events: Parameters<typeof reduceGate>[1][]) => events.reduce(reduceGate, initialGate);

  it('boots, restores, bootstraps and becomes READY', () => {
    expect(run([{ type: 'APP_START' }, { type: 'RESTORE_DONE' }, ok]).kind).toBe('READY');
  });
  it('a failed first bootstrap is the honest offline state, with its cause', () => {
    expect(run([{ type: 'APP_START' }, { type: 'RESTORE_DONE' }, { type: 'BOOTSTRAP_FAILED', cause: 'UNAVAILABLE' }])).toEqual({ kind: 'READY_OFFLINE', cause: 'UNAVAILABLE' });
  });
  it('UPGRADE_REQUIRED blocks and cannot be left by a failed re-check (an offline phone cannot walk past the floor)', () => {
    const blocked = run([{ type: 'APP_START' }, { type: 'RESTORE_DONE' }, { type: 'BOOTSTRAP_OK', client: { status: 'UPGRADE_REQUIRED', message: null, storeLink: null }, market: { status: 'UNRESOLVED' } }]);
    expect(blocked.kind).toBe('UPGRADE_REQUIRED');
    const checking = reduceGate(blocked, { type: 'CHECK_AGAIN' });
    expect(checking.kind).toBe('BOOTSTRAPPING');
    expect(reduceGate(checking, { type: 'BOOTSTRAP_FAILED', cause: 'OFFLINE' }).kind).toBe('UPGRADE_REQUIRED');
    expect(reduceGate(checking, ok).kind).toBe('READY');
  });
  it('a later background failure shows offline, and success clears it, without passing through a loading state', () => {
    const ready = run([{ type: 'APP_START' }, { type: 'RESTORE_DONE' }, ok]);
    const offline = reduceGate(ready, { type: 'BOOTSTRAP_FAILED', cause: 'OFFLINE' });
    expect(offline.kind).toBe('READY_OFFLINE');
    expect(reduceGate(offline, ok).kind).toBe('READY');
  });
  it('a misconfigured install stops with a fixed state', () => {
    expect(run([{ type: 'APP_START' }, { type: 'MISCONFIGURED' }]).kind).toBe('INIT_FAILED');
  });
});
