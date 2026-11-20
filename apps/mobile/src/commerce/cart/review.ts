import {
  findLine,
  type CartLine,
  type CartSet,
  type LineId,
  type SellerCart,
  type VariantId,
} from './model';
import type { Scope } from './port';
import type { Freshness } from './view-state';

/**
 * What a line needs from the Buyer before it can be relied on. Derived, never stored: a function of the
 * line the server reported, how fresh the answer is, and the Buyer's own recorded consent.
 *
 *   UNVERIFIED    the answer cannot be vouched for: no review state is drawn
 *   OK            the server reports nothing against the line
 *   NEEDS_ACCEPT  the only thing reported is a changed price that can be told apart from any other
 *   ACCEPTED      the Buyer accepted exactly that difference
 *   BLOCKED       anything else is reported (including a changed price that cannot be identified)
 */
export type LineReview = 'UNVERIFIED' | 'OK' | 'NEEDS_ACCEPT' | 'ACCEPTED' | 'BLOCKED';

/**
 * The Buyer's explicit acceptance of one reported difference on one line. It holds no price: only which
 * difference was accepted. It is an input for whatever reads it next, never proof to the server.
 */
export type Consent = Readonly<{
  epoch: number;
  lineId: LineId;
  variantId: VariantId;
  ref: string;
}>;

const onlyPriceChange = (line: CartLine): boolean =>
  line.issues.length === 1 && line.issues[0] === 'PRICE_CHANGED';

/** Whether this consent is for the very difference the line reports now. */
const covers = (consent: Consent | null, line: CartLine): boolean =>
  consent !== null &&
  consent.lineId === line.lineId &&
  consent.variantId === line.variantId &&
  typeof line.priceChangeRef === 'string' &&
  consent.ref === line.priceChangeRef;

export function lineReview(
  line: CartLine,
  freshness: Freshness,
  consent: Consent | null,
): LineReview {
  if (freshness.kind === 'UNVERIFIED') return 'UNVERIFIED';
  if (line.issues.length === 0) return 'OK';
  if (!onlyPriceChange(line) || typeof line.priceChangeRef !== 'string') return 'BLOCKED';
  return covers(consent, line) ? 'ACCEPTED' : 'NEEDS_ACCEPT';
}

/**
 * Whether the line may be bought once the Buyer's review is counted: nothing is reported against it, or
 * the only thing reported is a changed price the Buyer accepted. An unknown reason never qualifies. The
 * reviewed counterpart of `isPurchasable`, which stays "nothing reported".
 */
export const isPurchasableReviewed = (line: CartLine, consent: Consent | null): boolean =>
  line.issues.length === 0 || (onlyPriceChange(line) && covers(consent, line));

/**
 * Whether anything in one Seller cart is unresolved. Each Seller cart stands alone. This is not a
 * checkout state: it says only what the server reports and what the Buyer accepted.
 */
export type SellerCartReadiness = 'EMPTY' | 'UNVERIFIED' | 'BLOCKED' | 'NEEDS_REVIEW' | 'CLEAR';

export function sellerCartReadiness(
  cart: SellerCart,
  freshness: Freshness,
  consentOf: (lineId: LineId) => Consent | null,
): SellerCartReadiness {
  if (cart.lines.length === 0) return 'EMPTY';
  if (freshness.kind === 'UNVERIFIED') return 'UNVERIFIED';
  const reviews = cart.lines.map((line) => lineReview(line, freshness, consentOf(line.lineId)));
  if (reviews.includes('BLOCKED')) return 'BLOCKED';
  if (reviews.includes('NEEDS_ACCEPT')) return 'NEEDS_REVIEW';
  return 'CLEAR';
}

/**
 * What `accept` did. CHANGED: the difference the Buyer saw is not the one reported now (nothing was
 * recorded, and the line shows the new one). NOT_ACCEPTABLE: this line cannot be accepted in this state.
 * STALE_SCOPE: the session on screen is not the one that asked.
 */
export type AcceptResult = 'ACCEPTED' | 'CHANGED' | 'NOT_ACCEPTABLE' | 'STALE_SCOPE';

/** The latest cart answer, read when the Buyer acts, and whether it is the server's last word. */
export type CurrentAnswer = Readonly<{ carts: CartSet; verified: boolean }>;

/**
 * The Buyer's consents of this run, in memory only, one per line. The runtime that owns it empties it when
 * the session changes. A consent lives only while the server keeps reporting the same difference on the
 * same line: every verified answer drops the ones it does not report identically, so a difference that
 * went away and came back is reviewed again.
 */
export interface ReviewStore {
  /**
   * Records a consent for the line only if `shownRef` is the difference reported NOW, the line's only
   * issue is that price change, it can be identified, and the answer is verified. Synchronous.
   */
  accept(scope: Scope, lineId: LineId, shownRef: string, current: CurrentAnswer): AcceptResult;
  acceptedFor(scope: Scope, lineId: LineId): Consent | null;
  /** Drops every consent the answer does not report identically. Does nothing for an unverified answer. */
  project(scope: Scope, current: CurrentAnswer): void;
  /** Every consent, as one value that changes identity only when a consent is added or dropped. */
  snapshot(): ReadonlyMap<LineId, Consent>;
  /** Empties the store. With `silent`, watchers are not told: for a caller that is rendering. */
  clear(options?: { silent?: boolean }): void;
  subscribe(listener: () => void): () => void;
}

export function createReviewStore(): ReviewStore {
  let consents: ReadonlyMap<LineId, Consent> = new Map();
  const listeners = new Set<() => void>();
  const replace = (next: ReadonlyMap<LineId, Consent>) => {
    consents = next;
    for (const listener of [...listeners]) listener();
  };

  return {
    accept(scope, lineId, shownRef, current) {
      if (!scope.isCurrent()) return 'STALE_SCOPE';
      const line = current.verified ? findLine(current.carts, lineId) : null;
      if (line === null || !onlyPriceChange(line) || typeof line.priceChangeRef !== 'string') {
        return 'NOT_ACCEPTABLE';
      }
      if (line.priceChangeRef !== shownRef) return 'CHANGED';
      const held = consents.get(lineId) ?? null;
      if (covers(held, line) && held?.epoch === scope.epoch) return 'ACCEPTED';
      replace(
        new Map(consents).set(lineId, {
          epoch: scope.epoch,
          lineId,
          variantId: line.variantId,
          ref: line.priceChangeRef,
        }),
      );
      return 'ACCEPTED';
    },

    acceptedFor(scope, lineId) {
      const held = consents.get(lineId) ?? null;
      return scope.isCurrent() && held?.epoch === scope.epoch ? held : null;
    },

    project(scope, current) {
      if (!scope.isCurrent() || !current.verified) return;
      const kept = new Map<LineId, Consent>();
      for (const [lineId, consent] of consents) {
        const line = findLine(current.carts, lineId);
        if (line !== null && consent.epoch === scope.epoch && covers(consent, line)) {
          kept.set(lineId, consent);
        }
      }
      if (kept.size !== consents.size) replace(kept);
    },

    snapshot: () => consents,

    clear(options) {
      if (consents.size === 0) return;
      consents = new Map();
      if (options?.silent !== true) for (const listener of [...listeners]) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
