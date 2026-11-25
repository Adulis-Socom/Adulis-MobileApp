/**
 * components/Deferred.tsx -- the honest "not part of this release" state (SC-SAFE-01).
 *
 * Founder decisions D24-01 (payment authority unresolved), B02-D01 (Subscription Option B: no
 * purchase) and B02-D02 (Payout Option A: deferred entirely) remove these workflows from the
 * MVP. A historical route or region renders this instead of the old screen: it calls no API, so
 * there is nothing to hide with CSS and nothing a seller can reach by URL. The old screens'
 * source stays in the tree, unrouted, because the data and the backend controls are preserved.
 */
import { Link } from 'react-router';
import { en } from '@adulis/locale';

export type DeferredWhat = 'payout' | 'payment' | 'purchase' | 'handoff' | 'claims' | 'courier';

const TEXT: Readonly<Record<DeferredWhat, string>> = {
  payout: en['console.deferred.payout'],
  payment: en['console.deferred.payment'],
  purchase: en['console.deferred.purchase'],
  handoff: en['console.deferred.handoff'],
  claims: en['console.deferred.claims'],
  courier: en['console.deferred.courier'],
};

/** The sentence alone, for a region inside a screen that stays. */
export function DeferredNote({ what }: { readonly what: DeferredWhat }) {
  return (
    <p className="deferred-note hint" data-deferred={what}>
      {TEXT[what]}
    </p>
  );
}

/** A whole screen, for a route that no longer exists in the MVP. */
export function Deferred({ what }: { readonly what: DeferredWhat }) {
  return (
    <main className="screen deferred" data-deferred-screen={what}>
      <h1>{en['console.deferred.heading']}</h1>
      <DeferredNote what={what} />
      <Link to=".." relative="path" className="back">
        {en['console.deferred.back']}
      </Link>
    </main>
  );
}
