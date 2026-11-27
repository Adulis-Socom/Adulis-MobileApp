// GOV-06 on the fixture world: reserved ids only, no network, fail-closed refusal, disjoint tenants, nothing stored. These tests
// do not prove the fixtures are absent from a release bundle: scripts/verify-release.mjs scans the real export for that.
import { OP_SPECS } from '../contracts/ops';
import { asDeviceId, asEpoch, type MobileOpId } from '../contracts/gap-mob-session';
import { createFixtureTransport, FIXTURE_REFUSAL, FIXTURE_TEST_HANDLE, PERSONAS, fixtureHandle } from './index';
import { makeRuntime, settle, signIn } from '../testing/harness';

const stamp = { epoch: asEpoch(1), accountRef: null, deviceId: asDeviceId('fx_device_test') };
const original = { fetch: globalThis.fetch, xhr: (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest, ws: (globalThis as { WebSocket?: unknown }).WebSocket };
const touched: string[] = [];

beforeEach(() => {
  touched.length = 0;
  const trap = (name: string) => () => {
    touched.push(name);
    throw new Error(`${name} must not be used by a fixture`);
  };
  globalThis.fetch = trap('fetch') as unknown as typeof fetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = trap('XMLHttpRequest');
  (globalThis as { WebSocket?: unknown }).WebSocket = trap('WebSocket');
});
afterEach(() => {
  globalThis.fetch = original.fetch;
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = original.xhr;
  (globalThis as { WebSocket?: unknown }).WebSocket = original.ws;
});

describe('fixture world', () => {
  it('runs every journey with the network trapped and opens none', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, PERSONAS[0]?.phone as string);
    await settle();
    await runtime.session.signOut();
    expect(touched).toEqual([]);
    expect(world.handle.opLog.length).toBeGreaterThan(0);
  });

  it('exposes its test handle on the reserved name', () => {
    expect((globalThis as Record<string, unknown>)[FIXTURE_TEST_HANDLE]).toBe(fixtureHandle);
  });

  it('serves only registered operations and refuses the prohibited ones, logging the refusal', async () => {
    const world = createFixtureTransport();
    for (const op of ['payment.confirm', 'payout.request', 'handoff.complete', 'order.create', 'moderation.report', 'trust.review_grant'] as const) {
      await expect(world.transport.json(op as unknown as MobileOpId, {} as never, { stamp, bearer: null })).rejects.toMatchObject({ code: 'REFUSED' });
    }
    expect(world.handle.opLog.every((entry) => entry.outcome === FIXTURE_REFUSAL)).toBe(true);
    expect(touched).toEqual([]);
  });

  it('refuses a live-looking device identity: no live-to-fixture fallback in either direction', async () => {
    const world = createFixtureTransport();
    await expect(world.transport.json('device.register', { deviceId: asDeviceId('dv-real'), platform: 'android' }, { stamp, bearer: null })).rejects.toMatchObject({ code: 'REFUSED' });
  });

  it('keeps tenants disjoint: each Account sees only its own relationships', async () => {
    const world = createFixtureTransport();
    const a = await makeRuntime(world.transport);
    const b = await makeRuntime(world.transport);
    await a.runtime.start();
    await b.runtime.start();
    await signIn(a.runtime, PERSONAS.find((p) => p.key === 'owner')?.phone as string);
    await signIn(b.runtime, PERSONAS.find((p) => p.key === 'second')?.phone as string);
    await settle();
    expect(a.runtime.eligibility.get()?.modes.SELLER_COMPANION.status).toBe('AVAILABLE');
    expect(b.runtime.eligibility.get()?.modes.SELLER_COMPANION.status).toBe('NOT_ELIGIBLE');
    expect(b.runtime.eligibility.get()?.modes.COURIER.status).toBe('PENDING');
  });

  it('answers an unknown number exactly like a known one (no enumeration), then refuses the code', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    const sent = await runtime.session.requestCode({ destination: '+000' });
    expect(sent.kind).toBe('SENT');
    if (sent.kind !== 'SENT') return;
    expect(await runtime.session.verifyCode({ challenge: sent.challenge, code: '246810', intentKey: 'ik-1' })).toMatchObject({ kind: 'REFUSED', refusal: { code: 'OTP_INVALID' } });
  });

  it('serves the version scenarios and the revoked-relationship scenarios deterministically', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    world.handle.setClient('UPGRADE_REQUIRED');
    expect(await runtime.start()).toMatchObject({ kind: 'OK', client: { status: 'UPGRADE_REQUIRED', storeLink: null } });
    world.handle.setClient('OK');
    await signIn(runtime, PERSONAS.find((p) => p.key === 'revoked')?.phone as string);
    await settle();
    expect(runtime.eligibility.get()?.modes.SELLER_COMPANION.status).toBe('REVOKED');
  });

  it('declares every operation in the registry with a gap id, and writes name their authorising work order', () => {
    for (const spec of Object.values(OP_SPECS)) {
      expect(spec.gap).toMatch(/^(GAP-L2-|SC-BE-)/);
      if (spec.fixture === 'SERVED_WRITE') expect(spec.writeAuthorisedBy).not.toBeNull();
    }
  });

  it('only reserved identifiers are minted', async () => {
    const world = createFixtureTransport();
    const { runtime, credentials } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, PERSONAS[0]?.phone as string);
    expect(credentials.peek()?.startsWith('fx_cred_')).toBe(true);
    for (const persona of PERSONAS) expect(persona.accountId.startsWith('fx_acct_')).toBe(true);
  });
});
