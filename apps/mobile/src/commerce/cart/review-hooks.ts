import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

import { useCommerceContext } from '../runtime/provider';
import { cartsKey } from './hooks';
import type { CartLine, CartSet, LineId, SellerCart } from './model';
import type { Verified } from './port';
import {
  lineReview,
  sellerCartReadiness,
  type AcceptResult,
  type Consent,
  type LineReview,
  type SellerCartReadiness,
} from './review';
import type { CartViewState, Freshness } from './view-state';

const NOT_VERIFIED: Freshness = { kind: 'UNVERIFIED', why: 'checking', error: null };

/**
 * The Buyer's review of what the server reports on each line, for the cart view on screen. A consent is
 * recorded ONLY by `accept`, called for one line with the difference the Buyer was shown: opening the cart,
 * focus, a refresh, coming back to the app, the connection returning, an edit or a clock tick record none.
 * Each verified answer drops the consents it does not report identically.
 */
export function useCartReview(view: CartViewState): {
  reviewOf: (line: CartLine) => LineReview;
  consentOf: (lineId: LineId) => Consent | null;
  readinessOf: (cart: SellerCart) => SellerCartReadiness;
  accept: (lineId: LineId, shownRef: string) => AcceptResult;
} {
  const context = useCommerceContext();
  const qc = useQueryClient();
  const store = context?.runtime.reviews ?? null;
  const scope = context?.scope ?? null;

  const subscribe = useCallback(
    (listener: () => void) => (store ? store.subscribe(listener) : () => undefined),
    [store],
  );
  // Re-render when a consent is added or dropped; the value itself is read through `consentOf`.
  useSyncExternalStore(subscribe, () => store?.snapshot() ?? null);

  const freshness = view.kind === 'LISTED' ? view.freshness : NOT_VERIFIED;
  const verified = view.kind === 'LISTED' && view.freshness.kind !== 'UNVERIFIED';
  const carts = view.kind === 'LISTED' ? view.carts : null;

  useEffect(() => {
    if (!store || !scope || !verified || carts === null) return;
    store.project(scope, { carts, verified: true });
  }, [store, scope, verified, carts]);

  // The Buyer's tap is judged against the freshest answer and the freshest view, not the ones its render drew.
  const latest = useRef(view);
  useEffect(() => {
    latest.current = view;
  });

  const consentOf = (lineId: LineId): Consent | null =>
    store && scope ? store.acceptedFor(scope, lineId) : null;

  const accept = (lineId: LineId, shownRef: string): AcceptResult => {
    if (!store || !scope) return 'STALE_SCOPE';
    const answer = qc.getQueryData<Verified<CartSet>>(cartsKey(scope));
    const shown = latest.current;
    return store.accept(scope, lineId, shownRef, {
      carts: answer?.value ?? { carts: [], checkedAt: null },
      verified:
        answer !== undefined && shown.kind === 'LISTED' && shown.freshness.kind !== 'UNVERIFIED',
    });
  };

  return {
    reviewOf: (line) => lineReview(line, freshness, consentOf(line.lineId)),
    consentOf,
    readinessOf: (cart) => sellerCartReadiness(cart, freshness, consentOf),
    accept,
  };
}
