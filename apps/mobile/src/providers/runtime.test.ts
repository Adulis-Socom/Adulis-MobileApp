// Runtime behaviour that needs the server to misbehave: offline cold start, a credential refused for the surface, the same
// credential naming a different Account, a relationship revoked while inside the mode, and a per-request denial. The fixture
// transport is wrapped so one operation lies; everything else is the fixture world.
import type { BootstrapView, MobileOpId, MobileOps, Stamped } from '../contracts/gap-mob-session';
import { createFixtureTransport, PERSONAS } from '../fixtures';
import { createMemoryCredentialStore } from '../session/credential-store';
import { makeRuntime, settle, signIn } from '../testing/harness';
import { TransportError, type CallContext, type MobileTransport } from '../transport/port';

type Interceptor = (next: () => Promise<Stamped<unknown>>) => Promise<Stamped<unknown>>;

/** The fixture transport, with some operations intercepted. */
function intercepting(base: MobileTransport, hooks: Partial<Record<MobileOpId, Interceptor>>): MobileTransport {
  return {
    kind: 'fixture',
    json: <K extends MobileOpId>(op: K, input: MobileOps[K]['in'], ctx: CallContext) => {
      const hook = hooks[op];
      const next = () => base.json(op, input, ctx) as Promise<Stamped<unknown>>;
      return (hook ? hook(next) : next()) as Promise<Stamped<MobileOps[K]['out']>>;
    },
  };
}

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;

async function ownerToken(world: ReturnType<typeof createFixtureTransport>): Promise<string> {
  const first = await makeRuntime(world.transport);
  await first.runtime.start();
  await signIn(first.runtime, phone('owner'));
  await settle();
  return first.credentials.peek() as string;
}

describe('offline cold start', () => {
  it('a stored credential with no network stays RESTORED_UNCONFIRMED: offline is never unauthenticated', async () => {
    const world = createFixtureTransport();
    const token = await ownerToken(world);
    const offline = intercepting(world.transport, { 'bootstrap.get': () => Promise.reject(new TransportError('NETWORK')) });
    const { runtime } = await makeRuntime(offline, { credentials: createMemoryCredentialStore({ token }) });
    expect(await runtime.start()).toEqual({ kind: 'FAILED', cause: 'OFFLINE' });
    expect(runtime.session.state().kind).toBe('RESTORED_UNCONFIRMED');
    expect(runtime.eligibility.get()).toBeNull(); // no private data without the server's answer
  });

  it('recovers when the network returns: the next bootstrap confirms the session', async () => {
    const world = createFixtureTransport();
    const token = await ownerToken(world);
    let online = false;
    const flaky = intercepting(world.transport, { 'bootstrap.get': (next) => (online ? next() : Promise.reject(new TransportError('NETWORK'))) });
    const { runtime } = await makeRuntime(flaky, { credentials: createMemoryCredentialStore({ token }) });
    await runtime.start();
    online = true;
    expect((await runtime.refresh()).kind).toBe('OK');
    expect(runtime.session.state().kind).toBe('AUTHENTICATED');
  });
});

describe('credentials the server will not accept', () => {
  it('a stored credential refused for the surface ends as CREDENTIAL_REJECTED and is deleted', async () => {
    const world = createFixtureTransport();
    const token = await ownerToken(world);
    const credentials = createMemoryCredentialStore({ token });
    const refusing = intercepting(world.transport, { 'bootstrap.get': (next) => (credentials.peek() === null ? next() : Promise.reject(new TransportError('AUDIENCE_NOT_PERMITTED'))) });
    const { runtime } = await makeRuntime(refusing, { credentials });
    await runtime.start();
    await runtime.session.idle();
    expect(runtime.session.state()).toMatchObject({ kind: 'GUEST', lastEnd: { reason: 'CREDENTIAL_REJECTED' } });
    expect(credentials.peek()).toBeNull();
  });

  it('the same credential naming a DIFFERENT Account ends the session and adopts nothing', async () => {
    const world = createFixtureTransport();
    const token = await ownerToken(world);
    let lying = false;
    const switching = intercepting(world.transport, {
      'bootstrap.get': async (next) => {
        const answer = (await next()) as Stamped<BootstrapView>;
        if (!lying || !answer.value.account) return answer;
        return { ...answer, value: { ...answer.value, account: { ...answer.value.account, accountRef: 'fx_acct_someone_else' as never } } };
      },
    });
    const credentials = createMemoryCredentialStore({ token });
    const { runtime } = await makeRuntime(switching, { credentials });
    await runtime.start();
    expect(runtime.session.state().kind).toBe('AUTHENTICATED');
    lying = true;
    await runtime.refresh();
    expect(runtime.session.state()).toMatchObject({ kind: 'GUEST', lastEnd: { reason: 'CREDENTIAL_REJECTED' } });
    expect(runtime.eligibility.get()).toBeNull();
    await runtime.session.idle();
    expect(credentials.peek()).toBeNull();
  });
});

describe('modes and denial', () => {
  it('a mode the server ends while the person is inside it unmounts, purges and says so once', async () => {
    const world = createFixtureTransport();
    let revoked = false;
    const live = intercepting(world.transport, {
      'bootstrap.get': async (next) => {
        const answer = (await next()) as Stamped<BootstrapView>;
        if (!revoked || !answer.value.account) return answer;
        return { ...answer, value: { ...answer.value, account: { ...answer.value.account, eligibility: { SELLER_COMPANION: { status: 'REVOKED' } } } } };
      },
    });
    const { runtime } = await makeRuntime(live);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    expect(runtime.enterMode('SELLER_COMPANION')).toEqual({ kind: 'ENTERED' });
    expect(runtime.activeMode.get()).toBe('SELLER_COMPANION');
    const epoch = runtime.session.state().epoch;

    revoked = true;
    await runtime.refresh();
    expect(runtime.activeMode.get()).toBe('BUYER');
    expect(runtime.modeEnded.get()).toBe('SELLER_COMPANION');
    expect(runtime.session.state().epoch).toBe(epoch); // a mode change is never an identity change
    expect(runtime.enterMode('SELLER_COMPANION')).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('mode entry never re-authenticates and never creates an Account', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    const before = runtime.session.state();
    const signedInCalls = world.handle.opLog.filter((e) => e.op === 'session.requestCode' || e.op === 'session.verifyCode').length;
    runtime.enterMode('SELLER_COMPANION');
    runtime.enterMode('BUYER');
    expect(runtime.session.state()).toEqual(before);
    expect(world.handle.opLog.filter((e) => e.op === 'session.requestCode' || e.op === 'session.verifyCode')).toHaveLength(signedInCalls);
  });

  it('entering a mode as a guest asks for sign-in; before the answer it is CHECKING, not "no"', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    expect(runtime.enterMode('COURIER')).toEqual({ kind: 'SIGN_IN_REQUIRED' });
    await signIn(runtime, phone('second'));
    runtime.eligibility.set(null);
    expect(runtime.enterMode('COURIER')).toEqual({ kind: 'CHECKING' });
  });

  it('a pending Courier relationship is shown, not entered', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    await signIn(runtime, phone('second'));
    await settle();
    expect(runtime.eligibility.get()?.modes.COURIER).toMatchObject({ status: 'PENDING', message: { key: 'mobile.mode.pending' } });
    expect(runtime.enterMode('COURIER')).toEqual({ kind: 'UNAVAILABLE' });
  });

  it('a per-request 403 is a denial: the mode stays and eligibility is refetched', async () => {
    const world = createFixtureTransport();
    const denying = intercepting(world.transport, { 'device.register': () => Promise.reject(new TransportError('PERMISSION_DENIED')) });
    const { runtime } = await makeRuntime(denying);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    runtime.enterMode('SELLER_COMPANION');
    const before = world.handle.opLog.filter((e) => e.op === 'bootstrap.get').length;
    await expect(runtime.session.call('device.register', { deviceId: runtime.device.context().deviceId, platform: 'android' })).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await settle();
    expect(world.handle.opLog.filter((e) => e.op === 'bootstrap.get').length).toBe(before + 1);
    expect(runtime.activeMode.get()).toBe('SELLER_COMPANION');
    expect(runtime.session.state().kind).toBe('AUTHENTICATED');
  });
});

describe('sign-in flow', () => {
  it('verify refuses a challenge this run did not create', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const outcome = await runtime.session.verifyCode({ challenge: { ref: 'fx_otp_demo_999', destination: '+1', inputHint: null }, code: '246810', intentKey: 'ik-1' });
    expect(outcome).toMatchObject({ kind: 'REFUSED', refusal: { code: 'OTP_EXPIRED' } });
  });

  it('the credential is on disk before the app is told it is signed in', async () => {
    const { runtime, credentials } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const seen: (string | null)[] = [];
    runtime.session.onIdentityChange((_prev, next) => {
      if (next.kind === 'AUTHENTICATED') seen.push(credentials.peek());
    });
    await signIn(runtime, phone('owner'));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^fx_cred_/);
  });

  it('the challenge is memory-only and is cleared by any identity change', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const sent = await runtime.session.requestCode({ destination: phone('owner') });
    if (sent.kind === 'SENT') runtime.challenge.set(sent.challenge);
    expect(runtime.challenge.get()).not.toBeNull();
    await signIn(runtime, phone('second'));
    expect(runtime.challenge.get()).toBeNull();
  });
});

