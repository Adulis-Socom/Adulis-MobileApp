// MOB-FE-01 session, device and private-state behaviour, against the fixture world (injected, never imported by app code).
// Acceptance rows covered are named in the test titles (H-xxx, 04_MOB_FE_01_ACCEPTANCE_MATRIX.csv).
import { SessionChanged, asAccountRef } from '../contracts/gap-mob-session';
import { createFixtureTransport, FIXTURE_IDS, PERSONAS } from '../fixtures';
import { createMemoryCredentialStore } from './credential-store';
import { makeRuntime, settle, signIn } from '../testing/harness';
import { liveTransport } from '../transport/live';

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;
const OWNER = asAccountRef(FIXTURE_IDS.account);

describe('restore (H-001, H-004, H-006)', () => {
  it('starts as a guest with no stored credential and sends no private request', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    const state = await runtime.session.restore();
    expect(state).toMatchObject({ kind: 'GUEST', epoch: 1, lastEnd: null });
    expect(world.handle.opLog).toHaveLength(0);
  });

  it('restores a stored credential as UNCONFIRMED (no account, no private data) and never puts it in state', async () => {
    const world = createFixtureTransport();
    const credentials = createMemoryCredentialStore({ token: 'fx_cred_demo_owner_9' });
    const { runtime } = await makeRuntime(world.transport, { credentials });
    const state = await runtime.session.restore();
    expect(state.kind).toBe('RESTORED_UNCONFIRMED');
    expect(JSON.stringify(state)).not.toContain('fx_cred_demo_owner_9');
  });

  it('an unreadable store starts as a guest and deletes nothing (it may be transient)', async () => {
    const credentials = createMemoryCredentialStore({ token: 'fx_cred_demo_owner_9' });
    credentials.fail.read = true;
    const { runtime } = await makeRuntime(createFixtureTransport().transport, { credentials });
    expect((await runtime.session.restore()).kind).toBe('GUEST');
    expect(credentials.peek()).toBe('fx_cred_demo_owner_9');
  });

  it('a fixture credential never restores into a LIVE session and is removed', async () => {
    const credentials = createMemoryCredentialStore({ token: 'fx_cred_demo_owner_9' });
    const { runtime } = await makeRuntime(liveTransport, { credentials, deviceId: 'dv-real' });
    expect((await runtime.session.restore()).kind).toBe('GUEST');
    await runtime.session.idle();
    expect(credentials.peek()).toBeNull();
  });

  it('bootstrap confirmation moves RESTORED_UNCONFIRMED to AUTHENTICATED with the server account, without a new epoch', async () => {
    const world = createFixtureTransport();
    const first = await makeRuntime(world.transport);
    await first.runtime.session.restore();
    await signIn(first.runtime, phone('owner'));
    const token = first.credentials.peek() as string;
    const second = await makeRuntime(world.transport, { credentials: createMemoryCredentialStore({ token }) });
    await second.runtime.start();
    expect(second.runtime.session.state()).toMatchObject({ kind: 'AUTHENTICATED', epoch: 1, accountRef: OWNER });
    expect(second.runtime.eligibility.get()?.modes.SELLER_COMPANION.status).toBe('AVAILABLE');
  });
});

describe('sign-out and failed credential deletion (H-017)', () => {
  it('signs out locally first, deletes the credential and revokes server-side', async () => {
    const world = createFixtureTransport();
    const { runtime, credentials } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    const result = await runtime.session.signOut();
    expect(result.credentialCleared).toBe(true);
    expect(runtime.session.state()).toMatchObject({ kind: 'GUEST', epoch: 3, lastEnd: { reason: 'SIGNED_OUT' } });
    expect(credentials.peek()).toBeNull();
    expect(credentials.peekFlag()).toBe(false);
    expect(world.handle.sessionAccounts()).toHaveLength(0);
  });

  it('fails CLOSED when the delete fails: signed out now, and the credential never silently restores', async () => {
    const world = createFixtureTransport();
    const { runtime, credentials } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    credentials.fail.delete = true;
    const result = await runtime.session.signOut();
    expect(result.credentialCleared).toBe(false);
    expect(runtime.session.hasPendingCredentialDeletion()).toBe(true);
    expect(runtime.session.state().kind).toBe('GUEST');
    expect(credentials.peek()).not.toBeNull(); // still on disk
    expect(credentials.peekFlag()).toBe(true); // ...but flagged signed out

    // The next launch: the token is still readable, and must NOT restore.
    credentials.fail.delete = false;
    const next = await makeRuntime(world.transport, { credentials });
    expect((await next.runtime.session.restore()).kind).toBe('GUEST');
    await next.runtime.session.idle();
    expect(credentials.peek()).toBeNull(); // the delete was retried
    expect(credentials.peekFlag()).toBe(false);
  });

  it('stays guest even if the flag and the delete both fail (nothing proves it live), and is honest about it', async () => {
    const world = createFixtureTransport();
    const { runtime, credentials } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    credentials.fail.delete = true;
    credentials.fail.writeFlag = true;
    const result = await runtime.session.signOut();
    expect(result.credentialCleared).toBe(false);
    expect(runtime.session.state().kind).toBe('GUEST');
  });
});

describe('account switching and private state (H-018)', () => {
  it('purges the first Account before the second renders, advances the epoch and revokes the first', async () => {
    const world = createFixtureTransport();
    const { runtime, queryClient } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    const owner = runtime.session.state();
    expect(owner.kind).toBe('AUTHENTICATED');

    const store = runtime.privateState.create<string>('drafts', 'ACCOUNT_PRIVATE');
    const scope = { accountRef: OWNER, epoch: owner.epoch };
    expect(store.write(scope, 'k', 'owner-private')).toBe(true);
    queryClient.setQueryData(['acct', OWNER, 'saved'], ['owner-private']);
    queryClient.setQueryData(['public', 'feed'], ['public-item']);

    const seen: string[] = [];
    runtime.session.onIdentityChange((prev, next) => {
      // At this moment, before any subscriber renders, the old Account's private state is already gone.
      seen.push(`${prev.kind}>${next.kind}:${store.size()}:${queryClient.getQueryData(['acct', OWNER, 'saved']) === undefined}`);
    });
    const outcome = await signIn(runtime, phone('second'));
    expect(outcome).toMatchObject({ kind: 'SIGNED_IN', accountRef: 'fx_acct_demo_second' });
    await settle();

    const second = runtime.session.state();
    expect(second.epoch).toBeGreaterThan(owner.epoch);
    expect(seen).toEqual(['AUTHENTICATED>AUTHENTICATED:0:true']);
    expect(store.read({ accountRef: OWNER, epoch: second.epoch }, 'k')).toBeUndefined();
    expect(queryClient.getQueryData(['public', 'feed'])).toEqual(['public-item']); // the public namespace survives
    expect(world.handle.sessionAccounts()).toEqual(['fx_acct_demo_second']); // the first session was revoked best-effort
    expect(runtime.eligibility.get()?.accountRef).toBe('fx_acct_demo_second'); // eligibility refetched for the new Account
  });

  it('a store write under a stale epoch is dropped (late response cannot repopulate)', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const store = runtime.privateState.create<string>('s', 'ACCOUNT_PRIVATE');
    const stale = { accountRef: OWNER, epoch: runtime.session.state().epoch };
    await signIn(runtime, phone('owner')); // epoch advances
    expect(store.write(stale, 'k', 'late')).toBe(false);
  });
});

describe('stale responses (H-019)', () => {
  it('rejects a response that arrives after sign-out and adopts nothing', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    const release = world.handle.hold('bootstrap.get');
    const pending = runtime.session.call('bootstrap.get', {});
    const caught = pending.catch((error: unknown) => error);
    await runtime.session.signOut();
    release();
    expect(await caught).toBeInstanceOf(SessionChanged);
    expect(runtime.eligibility.get()).toBeNull();
  });

  it('adoptEligibility refuses an answer stamped for an older session', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    const release = world.handle.hold('bootstrap.get');
    const refreshing = runtime.refresh();
    await runtime.session.signOut();
    release();
    expect((await refreshing).kind).toBe('STALE');
    expect(runtime.eligibility.get()).toBeNull();
  });

  it('a late session-ended answer for an earlier epoch does not end a newer session', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    const oldEpoch = runtime.session.state().epoch;
    await runtime.session.signOut();
    await signIn(runtime, phone('owner'));
    await runtime.session.endFromServer(oldEpoch, 'EXPIRED', null);
    expect(runtime.session.state().kind).toBe('AUTHENTICATED');
  });
});

describe('session expiry, revocation and Operator credentials (H-020, H-021, H-022)', () => {
  it('SESSION_EXPIRED ends the session, shows one notice state and deletes the credential', async () => {
    const world = createFixtureTransport();
    const { runtime, credentials } = await makeRuntime(world.transport);
    await runtime.start();
    await signIn(runtime, phone('expired'));
    await settle();
    expect(runtime.session.state()).toMatchObject({ kind: 'GUEST', lastEnd: { reason: 'EXPIRED' } });
    await runtime.session.idle();
    expect(credentials.peek()).toBeNull();
  });

  it('SESSION_REVOKED ends the session with its own reason', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    await signIn(runtime, phone('sessionrevoked'));
    await settle();
    expect(runtime.session.state()).toMatchObject({ kind: 'GUEST', lastEnd: { reason: 'REVOKED' } });
  });

  it('a network failure is not an ended session: the session is kept and the gate is offline, not signed out', async () => {
    const { runtime } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    await signIn(runtime, phone('offline'));
    await settle();
    expect(runtime.session.state().kind).toBe('AUTHENTICATED');
    expect((await runtime.refresh()).kind).toBe('FAILED');
    expect(runtime.session.state().kind).toBe('AUTHENTICATED');
  });

  it('a verify response that is not an ordinary MOBILE principal is refused: nothing stored, no state or epoch change', async () => {
    const { runtime, credentials } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const before = runtime.session.state();
    const outcome = await signIn(runtime, phone('operator'));
    expect(outcome).toEqual({ kind: 'REJECTED_FOR_SURFACE' });
    expect(credentials.peek()).toBeNull();
    expect(runtime.session.state()).toEqual(before);
  });

  it('a credential the storage cannot write means the person is NOT signed in', async () => {
    const { runtime, credentials } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    credentials.fail.write = true;
    const outcome = await signIn(runtime, phone('owner'));
    expect(outcome).toMatchObject({ kind: 'REFUSED' });
    expect(runtime.session.state().kind).toBe('GUEST');
  });

  it('a wrong code is refused with the server vocabulary and stores nothing', async () => {
    const { runtime, credentials } = await makeRuntime(createFixtureTransport().transport);
    await runtime.start();
    const outcome = await signIn(runtime, phone('owner'), '000000');
    expect(outcome).toMatchObject({ kind: 'REFUSED', refusal: { code: 'OTP_INVALID' } });
    expect(credentials.peek()).toBeNull();
  });
});

describe('typed ports (AUTO-R03)', () => {
  it('the live transport fails closed for every operation and sends nothing', async () => {
    const { runtime } = await makeRuntime(liveTransport, { deviceId: 'dv-real' });
    const result = await runtime.start();
    expect(result).toEqual({ kind: 'FAILED', cause: 'UNAVAILABLE' });
    expect(runtime.session.state().kind).toBe('GUEST');
  });

  it('refusing a reserved identifier is a REFUSED, never a send', async () => {
    const { runtime } = await makeRuntime(liveTransport, { deviceId: 'fx_device_x' });
    await expect(runtime.session.call('device.register', { deviceId: runtime.device.context().deviceId, platform: 'android' })).rejects.toMatchObject({ code: 'REFUSED' });
  });
});

