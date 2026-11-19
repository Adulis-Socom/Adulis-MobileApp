import { createIntentStore, type IntentStore } from '../cart/intent-store';
import type { Scope } from '../cart/port';

/** Who the session says is signed in: a guest, or an Account and its credential. Null while the session is being restored. */
export type SessionIdentity =
  | Readonly<{ kind: 'guest'; token: null }>
  | Readonly<{ kind: 'account'; token: string }>;

/**
 * The ONE owner of the cart's session scope. A provider makes one, and every hook reads the scope and
 * the intent store from it: nothing computes an epoch of its own, so two screens mounted at different
 * times always agree, and an add the Buyer left unconfirmed cannot outlive the session that started it.
 *
 * Epoch 0 means "no scope yet" (the session is being restored). The first known identity is epoch 1, and
 * every later change of identity (sign-in, sign-out, another Account) adds one. Nothing here is stored
 * anywhere: the credential is held in memory only, as the session already holds it.
 */
export interface CommerceRuntime {
  /**
   * Told the session's identity by the provider, while it renders. Idempotent for an unchanged identity.
   * A change ends the old scope: it stops being current, and every pending add is dropped, before any
   * screen draws anything for the new one.
   */
  observe(identity: SessionIdentity | null): void;
  readonly scope: Scope | null;
  readonly epoch: number;
  readonly intents: IntentStore;
}

const same = (a: SessionIdentity | null, b: SessionIdentity | null): boolean =>
  a === b || (a !== null && b !== null && a.kind === b.kind && a.token === b.token);

export function createRuntime(): CommerceRuntime {
  const intents = createIntentStore();
  let identity: SessionIdentity | null = null;
  let epoch = 0;
  let scope: Scope | null = null;

  return {
    observe(next) {
      if (same(identity, next)) return;
      identity = next;
      epoch += 1;
      intents.clear();
      if (next === null) {
        scope = null;
        return;
      }
      const made: Scope = {
        kind: next.kind,
        epoch,
        // The scope this object stands for is the current one only until the identity changes again.
        isCurrent: () => scope === made,
      };
      scope = made;
    },
    get scope() {
      return scope;
    },
    get epoch() {
      return epoch;
    },
    intents,
  };
}
