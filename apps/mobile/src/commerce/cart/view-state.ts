import { LINE_ISSUES, type CartLine, type CartSet, type LineIssue, type SellerCart } from './model';
import type { Availability, Provenance, UnavailableReason, Verified } from './port';

/**
 * How far the answer on screen can be trusted. VERIFIED: the server's last word. REVALIDATING: still
 * that last word, and a new one is on its way. UNVERIFIED: it cannot be vouched for (the connection is
 * gone, a re-read failed, or the app came back from the background and has not asked again), so prices,
 * availability and reasons are not to be drawn.
 */
export type Freshness =
  | Readonly<{ kind: 'VERIFIED' }>
  | Readonly<{ kind: 'REVALIDATING' }>
  | Readonly<{ kind: 'UNVERIFIED'; why: 'offline' | 'failed' | 'checking'; error: unknown }>;

export type CartViewState =
  | Readonly<{ kind: 'DISABLED'; reason: UnavailableReason }>
  | Readonly<{ kind: 'LOADING'; waitingForConnection: boolean }>
  | Readonly<{
      kind: 'LISTED';
      carts: CartSet;
      freshness: Freshness;
      provenance: Provenance;
      receivedAt: number;
    }>
  | Readonly<{ kind: 'ERROR'; error: unknown }>;

/** What a query says about itself, as far as the cart view needs it. */
export type QueryFacts = Readonly<{
  status: 'pending' | 'error' | 'success';
  fetchStatus: 'idle' | 'fetching' | 'paused';
  data: Verified<CartSet> | undefined;
  error: unknown;
}>;

/**
 * The cart view for this moment, a pure function of the adapter, the scope and the query's own state.
 * `withheld`: the app returned from the background past the freshness interval and the answer on screen
 * has not been replaced yet. A scope that is not current shows nothing of an earlier one.
 */
export function deriveViewState(input: {
  availability: Availability;
  /** False while the session is restoring or once the scope the answer belongs to is gone. */
  scopeCurrent: boolean;
  query: QueryFacts;
  withheld: boolean;
}): CartViewState {
  const { availability, scopeCurrent, query, withheld } = input;
  if (!availability.available) return { kind: 'DISABLED', reason: availability.reason };
  if (!scopeCurrent) return { kind: 'LOADING', waitingForConnection: false };
  const { data } = query;
  if (data === undefined) {
    if (query.status === 'error') return { kind: 'ERROR', error: query.error };
    return { kind: 'LOADING', waitingForConnection: query.fetchStatus === 'paused' };
  }
  const listed = (freshness: Freshness): CartViewState => ({
    kind: 'LISTED',
    carts: data.value,
    freshness,
    provenance: data.provenance,
    receivedAt: data.receivedAt,
  });
  if (query.fetchStatus === 'paused')
    return listed({ kind: 'UNVERIFIED', why: 'offline', error: null });
  if (query.status === 'error')
    return listed({ kind: 'UNVERIFIED', why: 'failed', error: query.error });
  if (withheld) return listed({ kind: 'UNVERIFIED', why: 'checking', error: null });
  return listed(query.fetchStatus === 'fetching' ? { kind: 'REVALIDATING' } : { kind: 'VERIFIED' });
}

/** Whether prices, availability, reasons and a subtotal may be drawn: only from an answer that is the server's last word. */
export const mayDrawFacts = (freshness: Freshness): boolean => freshness.kind !== 'UNVERIFIED';

export type SellerCartStatus = 'EMPTY' | 'CLEAN' | 'HAS_ISSUES' | 'UNVERIFIED';

/**
 * A Seller cart's status, derived. Each Seller cart stands alone: nothing in another one changes it.
 * CLEAN is not permission to buy: a code about the whole cart is not represented here, so nothing may gate
 * a checkout on it. An item that names no Variant reaches every line, so a cart may show more issues than
 * the server meant, never fewer.
 */
export function sellerCartStatus(cart: SellerCart, freshness: Freshness): SellerCartStatus {
  if (cart.lines.length === 0) return 'EMPTY';
  if (freshness.kind === 'UNVERIFIED') return 'UNVERIFIED';
  return cart.lines.some((line) => line.issues.length > 0) ? 'HAS_ISSUES' : 'CLEAN';
}

/** The reason to show first for a line, by display precedence, or null when the server reports nothing. */
export function primaryIssue(line: CartLine): LineIssue | null {
  return LINE_ISSUES.find((issue) => line.issues.includes(issue)) ?? null;
}
