import { createEditStore, type EditStore } from '../cart/edit-store';
import { createIntentStore, type IntentStore } from '../cart/intent-store';
import type { Scope } from '../cart/port';
import { createReviewStore, type ReviewStore } from '../cart/review';

/** Who the session says is signed in: a guest, or an Account and its credential. Null while the session is being restored. */
export type SessionIdentity =
  Readonly<{ kind: 'guest'; token: null }> | Readonly<{ kind: 'account'; token: string }>;

/**
 * The ONE owner of the cart's session scope. A provider makes one, and every hook reads the scope and
 * the intent store from it: nothing computes an epoch of its own, so two screens mounted at different
 * times always agree, and an add or an edit the Buyer left unconfirmed, or a price the Buyer accepted,
 * cannot outlive the session that started it.
 *
 * Epoch 0 means "no scope yet" (the session is being restored). The first known identity is epoch 1, and
 * every later change of identity (sign-in, sign-out, another Account) adds one. Nothing here is stored
 * anywhere: the credential is held in memory only, as the session already holds it.
 */
export interface CommerceRuntime {
  /**
   * Told the session's identity by the provider, while it renders. Idempotent for an unchanged identity.
   * A change ends the old scope: it stops being current, and every pending add and edit and every consent
   * is dropped, before any screen draws anything for the new one. That happens when the provider renders
   * the new identity, one render after the session's own credential changed, so a request already on the
   * wire still needs its own check at send time.
   */
  observe(identity: SessionIdentity | null): void;
  readonly scope: Scope | null;
  readonly epoch: number;
  readonly intents: IntentStore;
  /** Every edit of a line (quantity or removal) of this run, one per line. */
  readonly edits: EditStore;
  /** The Buyer's consents to reported differences of this run. */
  readonly reviews: ReviewStore;
}

const same = (a: SessionIdentity | null, b: SessionIdentity | null): boolean =>
  a === b || (a !== null && b !== null && a.kind === b.kind && a.token === b.token);

export function createRuntime(): CommerceRuntime {
  const intents = createIntentStore();
  const edits = createEditStore();
  const reviews = createReviewStore();
  let identity: SessionIdentity | null = null;
  let epoch = 0;
  let scope: Scope | null = null;

  return {
    observe(next) {
      if (same(identity, next)) return;
      identity = next;
      epoch += 1;
      // Silent: this runs while the provider renders, and a screen that watches the store re-renders with the new scope anyway.
      intents.clear({ silent: true });
      edits.clear({ silent: true });
      reviews.clear({ silent: true });
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
    edits,
    reviews,
  };
}
