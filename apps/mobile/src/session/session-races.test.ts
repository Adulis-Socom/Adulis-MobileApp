// M01-R01 / M01-R02: credential and session races, driven step by step through a store whose operations the test holds and
// releases. Each case names the work-order regression it covers. No timers: `flush()` only lets queued microtasks run.
import { createFixtureTransport, PERSONAS } from '../fixtures';
import { createControlledStore, flush } from '../testing/controlled-store';
import { makeRuntime, settle, signIn } from '../testing/harness';
import type { MobileOpId, MobileOps } from '../contracts/gap-mob-session';
import { TransportError, type CallContext, type MobileTransport } from '../transport/port';

const phone = (key: string) => PERSONAS.find((p) => p.key === key)?.phone as string;

/** The fixture transport with the server sign-out (revocation) failing. */
const revokeFails = (base: MobileTransport): MobileTransport => ({
  kind: 'fixture',
  json: <K extends MobileOpId>(op: K, input: MobileOps[K]['in'], ctx: CallContext) => (op === 'session.signOut' ? Promise.reject(new TransportError('NETWORK')) : base.json(op, input, ctx)),
});

async function signedInWith(transport: MobileTransport, store = createControlledStore()) {
  const h = await makeRuntime(transport, { credentials: store });
  await h.runtime.start();
  await signIn(h.runtime, phone('owner'));
  await settle();
  return { ...h, store };
}

describe('sign-out when persistence partly fails (M01-R01)', () => {
  it('flag written, delete fails: FLAGGED, durable, and a restart refuses the credential and retries the delete', async () => {
    const world = createFixtureTransport();
    const { runtime, store } = await signedInWith(world.transport);
    store.fail.delete = true;
    const result = await runtime.session.signOut();
    expect(result).toMatchObject({ local: 'FLAGGED', durable: true, credentialCleared: false });
    expect(store.peek()).not.toBeNull();
    expect(store.peekFlag()).toBe(true);
    store.fail.delete = false;
    const next = await makeRuntime(world.transport, { credentials: store });
    expect((await next.runtime.session.restore()).kind).toBe('GUEST');
    await next.runtime.session.idle();
    expect(store.peek()).toBeNull();
  });

  it('flag write fails, delete succeeds: CLEARED (nothing restorable is left)', async () => {
    const { runtime, store } = await signedInWith(createFixtureTransport().transport);
    store.fail.writeFlag = true;
    const result = await runtime.session.signOut();
    expect(result).toMatchObject({ local: 'CLEARED', durable: true, credentialCleared: true });
    expect(store.peek()).toBeNull();
  });

  it('both fail but the server revoked it: durable through the server, and says the device still holds it', async () => {
    const { runtime, store } = await signedInWith(createFixtureTransport().transport);
    store.fail.delete = true;
    store.fail.writeFlag = true;
    const result = await runtime.session.signOut();
    expect(result).toMatchObject({ local: 'FAILED', server: 'REVOKED', durable: true, credentialCleared: false });
  });

  it('both fail AND the server revocation fails: NOT durable, and the result says so instead of claiming a sign-out', async () => {
    const world = createFixtureTransport();
    const { runtime, store } = await signedInWith(revokeFails(world.transport));
    store.fail.delete = true;
    store.fail.writeFlag = true;
    const result = await runtime.session.signOut();
    expect(result).toMatchObject({ local: 'FAILED', server: 'FAILED', durable: false });
    expect(runtime.session.state().kind).toBe('GUEST'); // signed out in memory now
    // Honest about the restart: the credential is still on disk, unflagged, and the server still knows it.
    store.fail.delete = false;
    store.fail.writeFlag = false;
    const next = await makeRuntime(world.transport, { credentials: store });
    expect((await next.runtime.session.restore()).kind).toBe('RESTORED_UNCONFIRMED');
  });

  it('a later retry finishes the local clean-up', async () => {
    const world = createFixtureTransport();
    const { runtime, store } = await signedInWith(revokeFails(world.transport));
    store.fail.delete = true;
    store.fail.writeFlag = true;
    await runtime.session.signOut();
    store.fail.delete = false;
    store.fail.writeFlag = false;
    expect(await runtime.session.retryPendingDeletion()).toBe('CLEARED');
    expect(store.peek()).toBeNull();
    expect(runtime.session.retryPendingDeletion()).toBeNull();
  });
});

describe('sign-in persistence (M01-R01 / M01-R02)', () => {
  it('writes the credential BEFORE lowering the signed-out flag', async () => {
    const store = createControlledStore();
    const { runtime } = await makeRuntime(createFixtureTransport().transport, { credentials: store });
    await runtime.start();
    await signIn(runtime, phone('owner'));
    const write = store.log.findIndex((e) => e.startsWith('write:'));
    const lower = store.log.indexOf('writeFlag:false');
    expect(write).toBeGreaterThanOrEqual(0);
    expect(lower).toBeGreaterThan(write);
  });

  it('a new sign-in that cannot persist its credential leaves an earlier signed-out credential refused on restart', async () => {
    const world = createFixtureTransport();
    // An earlier sign-out left its credential on disk behind the flag.
    const store = createControlledStore({ token: 'fx_cred_demo_owner_old', flag: true });
    store.fail.delete = true; // the delete retried at restore fails too
    const { runtime } = await makeRuntime(world.transport, { credentials: store });
    await runtime.start();
    expect(runtime.session.state().kind).toBe('GUEST');
    expect(store.peek()).toBe('fx_cred_demo_owner_old');
    store.fail.write = true;
    const outcome = await signIn(runtime, phone('second'));
    expect(outcome).toMatchObject({ kind: 'REFUSED' });
    expect(store.peekFlag()).toBe(true); // never lowered without a written credential
    const next = await makeRuntime(world.transport, { credentials: store });
    expect((await next.runtime.session.restore()).kind).toBe('GUEST');
  });

  it('a failed credential REPLACEMENT keeps the current Account, in memory and on disk', async () => {
    const world = createFixtureTransport();
    const { runtime, store } = await signedInWith(world.transport);
    const before = runtime.session.state();
    const ownerToken = store.peek();
    store.fail.write = true;
    expect(await signIn(runtime, phone('second'))).toMatchObject({ kind: 'REFUSED' });
    expect(runtime.session.state()).toEqual(before);
    expect(store.peek()).toBe(ownerToken);
  });

  it('a sign-out requested while the credential is being written cancels the sign-in and removes what was written', async () => {
    const store = createControlledStore();
    const { runtime } = await makeRuntime(createFixtureTransport().transport, { credentials: store });
    await runtime.start();
    const held = store.hold('write');
    const pending = signIn(runtime, phone('owner'));
    await flush();
    const signingOut = runtime.session.signOut(); // still a guest: this cancels the sign-in in flight
    held.release();
    expect(await pending).toEqual({ kind: 'STALE' });
    // M02-R01: the result arrives only after the write finished and was rolled back, and says what that achieved.
    expect(await signingOut).toMatchObject({ local: 'CLEARED', credentialCleared: true, durable: true, server: 'NOT_ATTEMPTED' });
    await runtime.session.idle();
    expect(runtime.session.state().kind).toBe('GUEST');
    expect(store.peek()).toBeNull();
  });

  describe('M02-R01: sign-out during pending credential persistence when the roll-back also fails', () => {
    /** A guest signs in; the credential write is held; the person signs out; then storage is broken as given before the write lands. */
    async function signOutDuringWrite(breakStorage: (store: ReturnType<typeof createControlledStore>) => void) {
      const world = createFixtureTransport();
      const store = createControlledStore();
      const { runtime } = await makeRuntime(world.transport, { credentials: store });
      await runtime.start();
      const held = store.hold('write');
      const pending = signIn(runtime, phone('owner'));
      await flush();
      let reported = false;
      const signingOut = runtime.session.signOut().then((result) => {
        reported = true;
        return result;
      });
      await flush();
      expect(reported).toBe(false); // nothing is claimed while the write is still outstanding
      breakStorage(store);
      held.release();
      expect(await pending).toEqual({ kind: 'STALE' });
      return { world, store, runtime, result: await signingOut };
    }

    it('delete and flag both fail: NOT durable, not cleared, and the credential really is still on disk', async () => {
      const { store, runtime, result } = await signOutDuringWrite((s) => {
        s.fail.delete = true;
        s.fail.writeFlag = true;
      });
      expect(result).toMatchObject({ local: 'FAILED', credentialCleared: false, durable: false, server: 'NOT_ATTEMPTED' });
      expect(store.peek()).not.toBeNull(); // the report matches the completed storage operations
      expect(runtime.session.state().kind).toBe('GUEST');
      expect(runtime.session.hasPendingCredentialDeletion()).toBe(true);
      // The notice's retry finishes the job once storage works again.
      store.fail.delete = false;
      store.fail.writeFlag = false;
      expect(await runtime.session.retryPendingDeletion()).toBe('CLEARED');
      expect(store.peek()).toBeNull();
    });

    it('the flag is raised but the delete fails: FLAGGED, durable, and a restart refuses the stranded credential', async () => {
      const { world, store, result } = await signOutDuringWrite((s) => {
        s.fail.delete = true;
      });
      expect(result).toMatchObject({ local: 'FLAGGED', credentialCleared: false, durable: true });
      expect(store.peek()).not.toBeNull();
      expect(store.peekFlag()).toBe(true);
      store.fail.delete = false;
      const next = await makeRuntime(world.transport, { credentials: store });
      expect((await next.runtime.session.restore()).kind).toBe('GUEST');
    });

    it('the delete works but the flag cannot be raised: CLEARED, and nothing is left on disk', async () => {
      const { store, result } = await signOutDuringWrite((s) => {
        s.fail.writeFlag = true;
      });
      expect(result).toMatchObject({ local: 'CLEARED', credentialCleared: true, durable: true });
      expect(store.peek()).toBeNull();
    });
  });

  it('session expiry while a new sign-in is being written: the new sign-in never commits and nothing restorable is left', async () => {
    const world = createFixtureTransport();
    const { runtime, store } = await signedInWith(world.transport);
    const epoch = runtime.session.state().epoch;
    const seen: string[] = [];
    runtime.session.onIdentityChange((_prev, next) => seen.push(next.kind === 'AUTHENTICATED' ? `AUTH:${next.accountRef}` : next.kind));
    const held = store.hold('write');
    const pending = signIn(runtime, phone('second'));
    await flush();
    // The expiry's own credential delete queues behind the held write, so it is awaited only after the release.
    const ending = runtime.session.endFromServer(epoch, 'EXPIRED', null);
    held.release();
    await ending;
    expect(await pending).toEqual({ kind: 'STALE' });
    await runtime.session.idle();
    expect(seen).toEqual(['GUEST']); // the second Account was never adopted
    expect(store.peek()).toBeNull();
  });

  it('account switch overlapping a sign-out: storage operations run in order and the final state is signed out and empty', async () => {
    const world = createFixtureTransport();
    const { runtime, store } = await signedInWith(world.transport);
    const held = store.hold('write');
    const switching = signIn(runtime, phone('second'));
    await flush();
    const signingOut = runtime.session.signOut();
    await flush();
    // The sign-out's delete is queued behind the held write: nothing has interleaved with it.
    expect(store.log.filter((e) => e === 'delete')).toHaveLength(0);
    held.release();
    expect(await switching).toEqual({ kind: 'STALE' });
    await signingOut;
    await runtime.session.idle();
    expect(runtime.session.state().kind).toBe('GUEST');
    expect(store.peek()).toBeNull();
  });

  it('a stale authentication never leaves its credential on disk; the next real sign-in is the one stored', async () => {
    const world = createFixtureTransport();
    const { runtime, store } = await signedInWith(world.transport);
    const held = store.hold('write');
    const late = signIn(runtime, phone('second'));
    await flush();
    const ending = runtime.session.endFromServer(runtime.session.state().epoch, 'REVOKED', null);
    held.release();
    await ending;
    expect(await late).toEqual({ kind: 'STALE' });
    await runtime.session.idle();
    const again = await signIn(runtime, phone('owner'));
    expect(again).toMatchObject({ kind: 'SIGNED_IN', accountRef: 'fx_acct_demo_owner' });
    await runtime.session.idle();
    expect(store.peek()).toMatch(/^fx_cred_demo_owner_/); // never the stale second-Account credential
  });

  it('the Operator principal is still refused under every ordering: nothing is written', async () => {
    const store = createControlledStore();
    const { runtime } = await makeRuntime(createFixtureTransport().transport, { credentials: store });
    await runtime.start();
    expect(await signIn(runtime, phone('operator'))).toEqual({ kind: 'REJECTED_FOR_SURFACE' });
    expect(store.log.some((e) => e.startsWith('write:'))).toBe(false);
  });
});

describe('private state survives a failed image-cache clear (M01-R03)', () => {
  it('an image clear that rejects still purges private queries and advances the identity', async () => {
    const world = createFixtureTransport();
    const { runtime, queryClient } = await makeRuntime(world.transport, { imageCache: { clear: () => Promise.reject(new Error('disk')) } });
    await runtime.start();
    await signIn(runtime, phone('owner'));
    await settle();
    const state = runtime.session.state();
    if (state.kind !== 'AUTHENTICATED') throw new Error('expected a signed-in Account');
    queryClient.setQueryData(['acct', state.accountRef, 'saved'], ['private']);
    await runtime.session.signOut();
    await settle();
    expect(queryClient.getQueryData(['acct', state.accountRef, 'saved'])).toBeUndefined();
    expect(runtime.diagnostics.imagePurgeFailures).toBeGreaterThan(0);
    expect(runtime.session.state().kind).toBe('GUEST');
  });
});
