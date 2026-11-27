// The one session boundary (MOB-FE-01, GAP-L2-01). The UI reads state and sends intents; it never sees the credential.
//
// Epoch rule: `epoch` is a monotonic integer (0 = no scope yet). It advances by one, SYNCHRONOUSLY and before any await,
// on every transition that changes who the app is acting as (guest <-> account, account A -> B, an end of session).
// Restoring a credential and then confirming it does NOT advance it, and a mode change never does.
import {
  asEpoch,
  MOBILE_AUDIENCE,
  ORDINARY_PRINCIPAL,
  SessionChanged,
  type AccountRef,
  type CodeChallenge,
  type DeviceId,
  type MobileOpId,
  type MobileOps,
  type RequestCodeOutcome,
  type RequestStamp,
  type SessionEndReason,
  type SessionState,
  type SignInRefusal,
  type VerifyInput,
  type VerifyOutcome,
  type ServerMessage,
  type Stamped,
  type Epoch,
} from '../contracts/gap-mob-session';
import { OP_SPECS } from '../contracts/ops';
import { isReservedId } from '../transport/guard';
import { TransportError, type CallContext, type MobileTransport } from '../transport/port';
import type { CredentialStore } from './credential-store';

export type SessionListener = (next: SessionState, prev: SessionState) => void;
export type IdentityListener = (prev: SessionState, next: SessionState) => void;

export interface SignOutResult {
  /** False when secure storage refused the delete: the app is signed out in memory and fails closed on restart. */
  readonly credentialCleared: boolean;
}
export type ConfirmResult = 'CONFIRMED' | 'ANOMALY' | 'STALE';

export interface SessionManagerDeps {
  readonly credentials: CredentialStore;
  readonly transport: MobileTransport;
  readonly deviceId: DeviceId;
  readonly now?: () => number;
}

const END_FOR: Partial<Record<TransportError['code'], Extract<SessionEndReason, 'EXPIRED' | 'REVOKED' | 'CREDENTIAL_REJECTED'>>> = {
  SESSION_EXPIRED: 'EXPIRED',
  SESSION_REVOKED: 'REVOKED',
  AUDIENCE_NOT_PERMITTED: 'CREDENTIAL_REJECTED',
};

export class SessionManager {
  private current: SessionState = { kind: 'RESTORING', epoch: asEpoch(0) };
  private credential: string | null = null;
  private deletionPending = false;
  private verifying = false;
  private forgetting: Promise<boolean> = Promise.resolve(true);
  private readonly listeners = new Set<SessionListener>();
  private readonly identityListeners = new Set<IdentityListener>();
  /** Count of purge hooks that threw. A failed purge is never silent: tests and diagnostics read this. */
  purgeFailures = 0;

  constructor(private readonly deps: SessionManagerDeps) {}

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  state(): SessionState {
    return this.current;
  }
  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  /** Called synchronously on every identity change, BEFORE any subscriber renders (the purge hook). */
  onIdentityChange(listener: IdentityListener): () => void {
    this.identityListeners.add(listener);
    return () => this.identityListeners.delete(listener);
  }
  /** True while a credential delete has failed in this process and not yet succeeded. */
  hasPendingCredentialDeletion(): boolean {
    return this.deletionPending;
  }
  /** Resolves when any credential delete started by a transition has settled (tests, sign-out screens). */
  idle(): Promise<boolean> {
    return this.forgetting;
  }

  // ---- stamps ---------------------------------------------------------------------------------------------------

  stamp(): RequestStamp {
    return { epoch: this.current.epoch, accountRef: this.current.kind === 'AUTHENTICATED' ? this.current.accountRef : null, deviceId: this.deps.deviceId };
  }
  isCurrent(stamp: RequestStamp): boolean {
    if (stamp.epoch !== this.current.epoch) return false;
    // A stamp taken before the restored credential was confirmed carries no account and stays valid inside its epoch.
    return stamp.accountRef === null || (this.current.kind === 'AUTHENTICATED' && this.current.accountRef === stamp.accountRef);
  }
  /** Transport-internal. Throws SessionChanged if the stamp is stale; the credential never leaves this class otherwise. */
  private bearerFor(stamp: RequestStamp): string | null {
    if (!this.isCurrent(stamp)) throw new SessionChanged();
    return this.current.kind === 'GUEST' || this.current.kind === 'RESTORING' ? null : this.credential;
  }

  // ---- transitions ----------------------------------------------------------------------------------------------

  private move(build: (epoch: Epoch) => SessionState, advance: boolean): void {
    const prev = this.current;
    this.current = build(advance ? asEpoch(prev.epoch + 1) : prev.epoch);
    const next = this.current;
    if (advance) {
      for (const hook of this.identityListeners) {
        try {
          hook(prev, next);
        } catch {
          this.purgeFailures += 1;
        }
      }
    }
    for (const listener of this.listeners) listener(next, prev);
  }

  /** Once at startup. Never rejects: an unreadable store means GUEST with the credential KEPT (it may be transient). */
  async restore(): Promise<SessionState> {
    if (this.current.kind !== 'RESTORING') return this.current;
    let flag: boolean | null = null;
    let stored: string | null | undefined;
    try {
      flag = await this.deps.credentials.readSignedOutFlag();
    } catch {
      flag = null;
    }
    try {
      stored = await this.deps.credentials.read();
    } catch {
      stored = undefined;
    }
    const guest = () => this.move((epoch) => ({ kind: 'GUEST', epoch, lastEnd: null }), true);
    if (flag === null || stored === undefined) {
      guest(); // cannot prove the credential is live: stay guest, delete nothing
    } else if (flag) {
      guest(); // a signed-out credential is never restored, even when its delete failed last time
      await this.forgetCredential();
    } else if (stored === null) {
      guest();
    } else if (isReservedId(stored) && this.deps.transport.kind === 'live') {
      guest(); // a fixture credential never restores into a live session
      await this.forgetCredential();
    } else {
      this.credential = stored;
      this.move((epoch) => ({ kind: 'RESTORED_UNCONFIRMED', epoch }), true);
    }
    return this.current;
  }

  /** Delete the stored credential. Fails CLOSED: the flag is raised first and lowered only after the delete succeeded. */
  private forgetCredential(): Promise<boolean> {
    this.credential = null;
    const run = async (): Promise<boolean> => {
      let flagged = false;
      try {
        await this.deps.credentials.writeSignedOutFlag(true);
        flagged = true;
      } catch {
        flagged = false;
      }
      try {
        await this.deps.credentials.delete();
      } catch {
        this.deletionPending = true;
        return false;
      }
      this.deletionPending = false;
      try {
        if (flagged) await this.deps.credentials.writeSignedOutFlag(false);
      } catch {
        // The flag stays raised: the next restore stays guest, retries the (already successful) delete, and lowers it.
      }
      return true;
    };
    this.forgetting = this.forgetting.then(run, run);
    return this.forgetting;
  }

  /** The server confirmed a restored or current credential and named the Account it belongs to. */
  async confirmBootstrap(stamp: RequestStamp, accountRef: AccountRef): Promise<ConfirmResult> {
    if (!this.isCurrent(stamp)) return 'STALE';
    const state = this.current;
    if (state.kind === 'RESTORED_UNCONFIRMED') {
      this.move((epoch) => ({ kind: 'AUTHENTICATED', epoch, accountRef, confirmedAt: this.now() }), false);
      return 'CONFIRMED';
    }
    if (state.kind !== 'AUTHENTICATED') return 'STALE';
    if (state.accountRef === accountRef) {
      this.move((epoch) => ({ kind: 'AUTHENTICATED', epoch, accountRef, confirmedAt: this.now() }), false);
      return 'CONFIRMED';
    }
    // Same credential, different Account: treat as ended, purge, never adopt it.
    await this.end(state.epoch, 'CREDENTIAL_REJECTED', null);
    return 'ANOMALY';
  }

  /** The server said the session carried by `epoch` is dead. A no-op unless `epoch` is current. */
  endFromServer(epoch: Epoch, reason: Extract<SessionEndReason, 'EXPIRED' | 'REVOKED' | 'CREDENTIAL_REJECTED'>, message: ServerMessage | null): Promise<boolean> {
    return this.end(epoch, reason, message);
  }

  private async end(epoch: Epoch, reason: SessionEndReason, message: ServerMessage | null): Promise<boolean> {
    if (epoch !== this.current.epoch) return true; // a late answer for an earlier session must not end a newer one
    if (this.current.kind === 'GUEST' || this.current.kind === 'RESTORING') return true;
    const endedEpoch = this.current.epoch;
    this.move((next) => ({ kind: 'GUEST', epoch: next, lastEnd: { reason, endedEpoch, message, at: this.now() } }), true);
    return this.forgetCredential(); // the app is guest at once, whether or not the delete succeeds
  }

  /** Local first: the epoch advances and private state is purged before the server revoke is attempted, never in front of it. */
  async signOut(): Promise<SignOutResult> {
    const state = this.current;
    if (state.kind === 'GUEST' || state.kind === 'RESTORING') return { credentialCleared: !this.deletionPending };
    const oldStamp = this.stamp();
    const oldBearer = this.credential;
    this.move((epoch) => ({ kind: 'GUEST', epoch, lastEnd: { reason: 'SIGNED_OUT', endedEpoch: state.epoch, message: null, at: this.now() } }), true);
    const revoked = oldBearer === null || state.kind !== 'AUTHENTICATED' ? Promise.resolve() : this.revokeBestEffort(oldStamp, oldBearer);
    const cleared = await this.forgetCredential();
    await revoked;
    return { credentialCleared: cleared };
  }

  private revokeBestEffort(stamp: RequestStamp, bearer: string): Promise<void> {
    return this.deps.transport.json('session.signOut', {}, { stamp, bearer }).then(
      () => undefined,
      () => undefined, // best effort: the local forget already happened
    );
  }

  // ---- sign-in --------------------------------------------------------------------------------------------------

  async requestCode(input: { destination: string }): Promise<RequestCodeOutcome> {
    const destination = input.destination.trim();
    try {
      const out = await this.call('session.requestCode', { destination });
      const challenge: CodeChallenge = { ref: out.challengeRef, destination, inputHint: out.inputHint };
      return { kind: 'SENT', challenge };
    } catch (error) {
      if (error instanceof SessionChanged) return { kind: 'STALE' };
      return { kind: 'REFUSED', refusal: refusalOf(error) };
    }
  }

  async verifyCode(input: VerifyInput): Promise<VerifyOutcome> {
    if (this.verifying) return { kind: 'STALE' };
    this.verifying = true;
    try {
      let wire: MobileOps['session.verifyCode']['out'];
      try {
        wire = await this.call('session.verifyCode', { challengeRef: input.challenge.ref, code: input.code, intentKey: input.intentKey });
      } catch (error) {
        if (error instanceof SessionChanged) return { kind: 'STALE' };
        return { kind: 'REFUSED', refusal: refusalOf(error) };
      }
      // The response must assert an ordinary MOBILE principal. Anything else (an Operator credential included) is
      // refused with NOTHING stored, no state change and no epoch change.
      const notOrdinary = wire.audience !== MOBILE_AUDIENCE || wire.principalKind !== ORDINARY_PRINCIPAL || wire.credential === '';
      const fixtureOnLive = isReservedId(wire.credential) && this.deps.transport.kind === 'live';
      if (notOrdinary || fixtureOnLive) return { kind: 'REJECTED_FOR_SURFACE' };

      // Storage first: if the credential cannot be written the person is NOT signed in.
      try {
        await this.deps.credentials.writeSignedOutFlag(false);
        await this.deps.credentials.write(wire.credential);
      } catch {
        return { kind: 'REFUSED', refusal: { code: 'INTERNAL', message: null, retryAt: null } };
      }
      this.deletionPending = false;
      const prev = this.current;
      const oldStamp = this.stamp();
      const oldBearer = this.credential;
      this.credential = wire.credential;
      if (prev.kind === 'AUTHENTICATED' && prev.accountRef === wire.accountRef) {
        this.move((epoch) => ({ kind: 'AUTHENTICATED', epoch, accountRef: wire.accountRef, confirmedAt: this.now() }), false);
      } else {
        // A different Account (or the first): A's private state is purged before B can render.
        this.move((epoch) => ({ kind: 'AUTHENTICATED', epoch, accountRef: wire.accountRef, confirmedAt: this.now() }), true);
        if (prev.kind === 'AUTHENTICATED' && oldBearer !== null) void this.revokeBestEffort(oldStamp, oldBearer);
      }
      return { kind: 'SIGNED_IN', accountRef: wire.accountRef };
    } finally {
      this.verifying = false;
    }
  }

  // ---- the commit point -----------------------------------------------------------------------------------------

  /**
   * The ONLY way an operation is sent. The stamp is taken before any await, the bearer is asked for at the last moment,
   * and a response (or a failure) that arrives after the session changed is dropped: SessionChanged, never rendered.
   */
  async call<K extends MobileOpId>(op: K, input: MobileOps[K]['in'], options: { readonly idempotencyKey?: string } = {}): Promise<MobileOps[K]['out']> {
    const stamp = this.stamp();
    const access = OP_SPECS[op].access;
    const bearer = access === 'PUBLIC' ? null : this.bearerFor(stamp);
    if (access === 'AUTHENTICATED' && bearer === null) throw new TransportError('AUTHENTICATION_REQUIRED');
    const ctx: CallContext = options.idempotencyKey === undefined ? { stamp, bearer } : { stamp, bearer, idempotencyKey: options.idempotencyKey };
    let result: Stamped<MobileOps[K]['out']>;
    try {
      result = await this.deps.transport.json(op, input, ctx);
    } catch (error) {
      if (!this.isCurrent(stamp)) throw new SessionChanged(); // an old session's failure is not the new one's
      if (error instanceof TransportError && bearer !== null) {
        const reason = END_FOR[error.code] ?? (error.code === 'AUTHENTICATION_REQUIRED' ? 'EXPIRED' : undefined);
        if (reason !== undefined) void this.end(stamp.epoch, reason, error.serverMessage);
      }
      throw error;
    }
    if (!this.isCurrent(stamp)) throw new SessionChanged();
    return result.value;
  }
}

function refusalOf(error: unknown): SignInRefusal {
  if (error instanceof TransportError) return { code: error.code, message: error.serverMessage, retryAt: error.retryAt };
  return { code: 'INTERNAL', message: null, retryAt: null };
}
