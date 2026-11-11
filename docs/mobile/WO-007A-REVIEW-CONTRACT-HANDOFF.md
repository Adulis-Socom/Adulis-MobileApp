# WO-007A -- Review Contract Handoff

For the engineers who will build the next Review surfaces. It says what the corrected public Review
contract is, what each future surface must consume, and what must exist before any Review can be
public. Nothing here was built by WO-007A beyond the contract itself.

Governing design: ADU-REV-01 v3.3. Founder decision: ON-20261111-033 (11 November 2026) -- only
Reviews with an authoritative verified evidence basis (FINAL_HANDOFF or VERIFIED_ORDER_FAILURE) are
public or count in public averages; unverified history is kept; a legacy badge is not proof.

## 1. The contract as it stands

| Piece | Where | Rule |
|---|---|---|
| Public projection | `core.v_review_public` (migration 0058; ADU-DB-01 v1.24 S30g) | The ONLY source of public Seller-service Reviews and public Seller rating aggregates. Columns `id, seller_id, seller_rating, body, published_at, evidence_basis` |
| Payment evidence interface | `core.fn_order_payment_verified(uuid)` | Answers `false` for every Order until WO-PAY-001 gives it a provider-verified fact. So nothing is public today |
| Public list | `GET /v1/storefronts/{handle}/reviews` | Filtered before paging; keyset `(published_at, id)`; `no-store`; items carry `evidence_basis`, never Buyer, Order or Claim references |
| Public summary | `review_summary` in `GET /v1/storefronts/{handle}` | Same population as the list: `count`, `average_rating` (null with none), `basis_counts` |
| Stored history | `core.review` (+ `review_item_rating`) | Kept whole. The legacy `badge` column remains for the Seller-private read and is never a public label or an eligibility input |

## 2. Rules every consumer follows

1. **Read public Reviews and public aggregates from `core.v_review_public` only.** Never from
   `core.review` directly, never by re-deriving eligibility in an endpoint, a job or a client.
2. **Never filter on the device.** A client never receives an ineligible Review to hide it.
3. **Label by `evidence_basis`, in words.** VERIFIED_ORDER_FAILURE is never described as received or
   Handoff-verified (REV-01 S16). Never show a legacy badge tier publicly.
4. **Seller service and Product quality stay separate** (REV-01 S19): no combined or Scene score.
5. **No cache keeps a Review public** after its basis or moderation changes: public reads stay
   `no-store` until an invalidation design exists (REV-01 S31).
6. **A Seller can never hide, delay or reorder a valid Review** (REV-01 S23); reporting is
   moderation intake only.

## 3. Surface by surface

| Surface | Must consume | Must not | Blocked on |
|---|---|---|---|
| **Buyer Reviews** (writing: eligibility, submit, edit) | `GET /v1/orders/{orderRef}/review-eligibility` and `POST /v1/orders/{orderRef}/review` as REV-01 S14, S21, S22 define them: server-derived basis, one Grant per Seller Order, received-line item ratings only. Show a composer only when eligibility says so (R-08) | Reuse today's `POST /v1/orders/{id}/review` (pre-REV-01: any terminal Order, no grant, legacy badge) | WO-PAY-001; the REV-01 Grant schema and resolver (ON-20261111-054); OTP/Manual receipt (ON-20261111-055) |
| **Product Detail** (Product-quality Reviews) | A Product-quality projection built like `v_review_public`: received-line `review_item_rating` rows of FINAL_HANDOFF Orders only (REV-01 S18, S30); `GET /v1/products/{productRef}/reviews` | Show item ratings from a VERIFIED_ORDER_FAILURE Order, or from today's unguarded legacy rows | The same, plus that projection (not built) |
| **Seller Storefront** (public web) | The same two endpoints as the Buyer Seller Profile | Its own aggregation | Nothing beyond the above |
| **Seller Console** | `GET /v1/seller/reviews` (Seller-private, every stored Review with its legacy badge) for operations; public numbers from the public summary | Present a private count as the public rating, or offer any action that changes a Review | Nothing for read-only; Report Review needs moderation (below) |
| **Operator Console** (moderation) | A governed Review moderation state and an Operator capability (AUTH-02), joined into `v_review_public` so the list and the aggregate follow it together; audit on every action | Hide a Review by any path outside that state; let an ordinary or Seller session act | ON-20261111-029 (release blocker: no state, vocabulary, capability or workflow exists) |
| **Trust Engine** | `v_review_public` (or a projection derived from it) if a Trust rule ever reads ratings (REV-01 S37: permitted facts only) | Read `core.review` averages (the 0010 ladder did; 0028 replaced it and reads no rating today) | A Trust rating rule (none at MVP) |

## 4. Before the first Review can be public

1. **Verified payment (WO-PAY-001):** replace the body of `core.fn_order_payment_verified` with a
   read of the payment owner's provider-verified fact. Nothing else in the projection changes.
2. **Review moderation (ON-20261111-029):** state, vocabulary, Operator capability and audit, joined
   into the view.
3. **Failure basis precision (ON-20261111-056):** a Seller-fault attribute or decision type on the
   Claim, confirmed by the founder, instead of the trigger mapping.
4. **Correction lineage (ON-20261111-059):** a governed Claim decision correction and
   `review.eligibility_changed` events (REV-01 S29), so a reversal is audited, not a bare UPDATE.
5. **The REV-01 write path** (ON-20261111-054) before any new Review is collected under the new
   rules.

Tests that must keep passing when these land: `apps/api/test/wo-007a-reviews.e2e.spec.ts` (it
stands in for the payment owner for its own fixture Orders only and restores the definition it
found).
