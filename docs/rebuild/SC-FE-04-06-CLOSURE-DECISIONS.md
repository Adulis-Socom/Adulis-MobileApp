# SC-FE-04-06-CLOSE -- specification decisions and proposal dispositions (Batch 02C)

Console session, 26 November 2026. ASCII only. Working authority: founder rulings recorded in the Batch 02C brief. This is not a signed
board or legal approval, and it writes nothing into `contracts/openapi.json`.

## 1. Correction to the reporting

`P-30` to `P-46` in `SC-FE-04-06-PROPOSALS.md` is **17 proposals**, not 46. The earlier summary read the last identifier as a count.

## 2. Rulings recorded

| ID | Ruling | Effect in the Console |
|---|---|---|
| CL-01 | `PRODUCT_TAG_REQUIRED` is the canonical zero-tag blocker. `SCENE_PRODUCT_TAG_REQUIRED` is not kept. | Catalogue key `scene.blocker.SCENE_PRODUCT_TAG_REQUIRED` removed. |
| CL-02 | `NO_AVAILABLE_TAGGED_PRODUCT` is a separate blocker, not a synonym of the tag-required blocker. | Unchanged; both exist. |
| CL-03 | `ALL_TAGGED_PRODUCTS_OUT_OF_STOCK` is used only when stock depletion is the SOLE cause. Withdrawal, restriction, any other loss, or a mix of causes is `ALL_TAGGED_PRODUCTS_UNAVAILABLE`. | Fixture `resolve()` in `fixtures/content.ts`; the Console only renders the code it is given. |
| CL-04 | Approved English: "All tagged Products are currently out of stock." and "None of the Products tagged in this Scene are currently available." | `private_reason.*` keys. |
| CL-05 | Courier navigation is "Couriers", the list is "My Couriers", the engineering model is the Seller Courier Pool, and the wider model is the Cross-Seller Courier Network. | Copy and structure unchanged where already so; no other model is named on screen. |
| CL-06 | Retained: invitations, relationship status, approved relationships, revocation. Deferred: open applications, compensation, assignment, Handoff, custody transfer, delivery execution. | Nothing deferred is built or implied. |
| CL-07 | Seller service coverage and Courier Pool coverage are separate. A relationship count is not capacity. | The Store coverage page and the Couriers page stay separate; no capacity figure is shown. |
| CL-08 | The Seller-level versus relationship-level compensation disagreement is NOT resolved by building compensation. | No compensation field or screen exists. |
| CL-09 | The taxonomy is accepted as submitted business input. TX-01 to TX-04 and other commercial definitions belong to the business team and are not invented here. | The editor still hard-codes no category, attribute, value or required rule. |

Tests for CL-03 (stock-only, withdrawn-only, restricted-only, mixed, partial availability, restoration with moderation active) are in
`src/fixtures/closure.test.ts`.

## 3. Dispositions of the earlier proposals

| ID | Disposition |
|---|---|
| P-37 | Superseded in part by CL-03: the fixture now emits the out-of-stock reason only when stock is the sole cause. |
| P-38 | Accepted: `PRODUCT_TAG_REQUIRED` is canonical (CL-01). |
| P-44 | The narrow delivery-wording adjustment is accepted. Mentioning a feature in a fixed place is not activating it: no Order, payment, delivery tracking or assignment exists. |
| P-46 | The proposed English is the development baseline pending the SC-FE-12 editorial review. Amharic stays PENDING and unpublished. |
| Others (P-30 to P-36, P-39 to P-43, P-45) | Unchanged: still proposals for the backend work orders and the founder to confirm, change or reject. |

## 4. New provisional decisions made in Batch 02C (proposals, not product rules)

| ID | Proposal | Why it was needed |
|---|---|---|
| P-47 | A write whose screen has gone (navigation, Seller switch, sign-out, expiry) rejects with `CONTEXT_MISMATCH` detail `STALE_COMPLETION`, so no completion effect (navigate, notice, data) runs. This stops the Console listening; it does not reverse what the server already did. | Late answers must not change a newer screen. |
| P-48 | Idempotency key scope: authorized scope (account and Seller), operation, key, and a payload fingerprint. The same payload replays; a different payload under the same key is `CONFLICT` with detail `IDEMPOTENCY_KEY_REUSED`; authorization runs before any replay; only successes are remembered. The Console keeps a key only while an outcome is UNKNOWN (network, unavailable, internal), in memory inside the Seller scope, never persisted. | A lost response must not create a duplicate Product, Scene, Story, stock adjustment or invitation, and a fresh key must never follow an unknown result. |
| P-49 | An unknown outcome is shown as "We could not confirm whether this was saved. You can try again: it will not be done twice." | The Seller needs one honest sentence for the uncertain case. |
| P-50 | Unsaved edits to a Product, Scene, Story or Store page are guarded against Back, internal links, Seller switch and explicit reload. Sign-in routes (sign-out, expiry, revocation) always pass. Responses are adopted only if their version is not older than the acknowledged one. | Proportionate protection with no general framework. Same-version late responses are still adopted (documented limit). |
| P-51 | Company details (name, description, representative, phone) are conditional business metadata for a Company Seller, shown at `store/company`. They are not verification and say so. No Government ID, payout or compensation field. The representative is changed by the Owner only. Readiness COMPANY_DETAILS is satisfied when name, representative and contact are set. | ONB-01 S71, S73, S178: the readiness item needed an authoring screen. |
| P-52 | TikTok embed is optional and Product-detail-only. Attaching needs a connected, ownership-verified account; the failures are `TIKTOK_NOT_CONNECTED`, `TIKTOK_OWNERSHIP_NOT_VERIFIED`, `TIKTOK_EMBED_UNAVAILABLE` (plus the Console-side `TIKTOK_URL_INVALID`). No OAuth, no native video, never in the For You feed. Fixture rule: only Alem Textiles is connected, handle `@alem.textiles`. | CATINV S27-S38, S101, S111. |
| P-53 | The Store location page shows a clearly labelled demonstration map preview (an SVG pin from the provider-resolved coordinates) with a per-candidate Preview. It is never presented as a real map. | CON S98 asks for a map preview; no provider is connected. |
| P-54 | Image arrangement is the operation `products.media.arrange`. (`reorder` was refused by the fixture fail-closed list, which blocks any operation name containing "order".) | Naming only. |

## 5. Not decided here

Payment authority (D24-01), the taxonomy business definitions (TX-01 to TX-04), real Amharic copy, and any backend behaviour remain open.
