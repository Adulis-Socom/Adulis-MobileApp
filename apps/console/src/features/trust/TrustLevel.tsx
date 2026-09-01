/**
 * features/trust/TrustLevel.tsx -- SC-13 Trust and level (v1.2 S10).
 *
 * THE SCREEN'S WIRE DOES NOT EXIST (D-226): GET /v1/seller/level was
 * specified and never built -- no route serves a seller's own level, no
 * endpoint exposes seller_level_event history, and the one public read
 * (GET /v1/storefronts/{handle}) is unusable from here twice over: the
 * console cannot learn its own handle from any authed endpoint, and every
 * call to that route emits a storefront_viewed analytics event -- a console
 * reading its own stats would inflate its own view counts.
 *
 * S17's rule -- a screen whose endpoints do not exist is not built -- meets
 * the D-146 rule -- a menu entry must never dead-end. What renders is the
 * honest intersection: the sentences that are TRUE WITHOUT A WIRE (level is
 * computed, never negotiated; level is independent of subscription tier --
 * the two facts S10 says the screen must state plainly), and the absence,
 * named. No number is invented, no history faked, NOTHING here is a control.
 */
import { en } from '@adulis/locale';

export function TrustLevel() {
  return (
    <section aria-labelledby="trust-heading" data-screen="SC-13" className="trust-level">
      <h1 id="trust-heading">{en['console.insights.trust.heading']}</h1>

      {/* The two sentences S10 requires stated plainly -- true without a wire. */}
      <p className="callout">{en['console.insights.trust.independent']}</p>
      <p>{en['console.insights.trust.computed']}</p>

      {/* The absence, named where the numbers would be (D-226). */}
      <div className="empty" data-state="EMPTY">
        <p>{en['console.insights.trust.wire_owed']}</p>
      </div>
    </section>
  );
}
