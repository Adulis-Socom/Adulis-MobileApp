# WO-CAT-001A -- Scene and Catalogue Eligibility Consistency

Status: COMPLETE (OVN-086 documented, not decided; see S4.E)

## 1. Baseline

- Starting branch `catalogue/wo-cat-001-public-read-integrity`, SHA
  `4193fc8b5d3a3e15d92856dc2f508e4e548dc2ec` (verified equal to origin, clean tree).
- Branch `catalogue/wo-cat-001a-eligibility-consistency`.
- Overnight batch of 11 November 2026; issues are in `docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md`
  (ON-20261111-*).

## 2. Documents reviewed

ADU-SCN-01 v3.2 (S27, S29, S41, S54: availability, re-evaluation, restoration gates), ADU-CATINV-01
v3.3 (S364 price/currency, S492-S496 availability), ADU-MKT-01 v3.3 (S132, S334), ADU-DB-01 v1.21
(S30c, S30d, Appendix C), the WO-CAT-001 record, founder rulings and handoff, the 10 November
register (OVN-086 to OVN-090), migrations 0007, 0008, 0028, 0054, 0055.

## 3. Audit (before change)

| Item | Finding |
|---|---|
| `core.v_scene_product_availability` (0054) | `available` = PUBLISHED AND an ACTIVE Variant with `stock_count > 0`. No currency term. Read by `fn_scene_post_publish`, `fn_scene_post_reevaluate`, `v_scene_post_public`, the Scene read's seller views and the For You tag projection (`fyp.service.ts`) |
| Public Catalogue projection (WO-CAT-001) | item level = the above AND `price_currency = market.display_currency`; plus Seller ACTIVE and Market ACTIVE |
| Seller / Market gates for Scenes | already separate and complete: `fn_scene_post_reevaluate.v_gates_ok` (restoration only), `v_scene_post_public` (Seller ACTIVE, Market ACTIVE), and re-evaluation triggers on `seller.status` and `market.activation_state` (0054:672-690) |
| Re-evaluation inputs | Variant `stock_count`, `status`, `product_id`; Product `visibility`, `market_id`; Seller `status`; Market `activation_state`. Not `price_currency`, not `display_currency` |
| Currency writes | only at creation: `createProduct` (`base_price_currency`) and `createVariant` (`price_currency`), both taking the request's value unchecked; no PATCH path changes a currency |
| Product Market | `createProduct` copies the Seller's Market, but no constraint ties `product.market_id` to the Seller (`core.scene_post` has the composite FK; `core.product` does not) |
| Existing data (read-only, disposable and developer databases) | 0 non-Market Variant currencies, 0 non-Market seeds, 0 Product/Seller Market contradictions |
| Found on the way | `PATCH /v1/seller/variants/{id}` took any free-text `status`, and `WITHDRAWN` there skipped DELETE's live-reservation guard (ON-20261111-004) |

## 4. Changes

### A. OVN-087 -- one item-level rule (migration 0056)

The smallest authoritative correction: the Scene view gains the Market-currency term, nothing else.
Seller and Market status stay the Scene domain's separate gates, so suspension still hides a Scene
at once (public gate) and still blocks restoration (`v_gates_ok`), exactly as before. The
re-evaluation triggers gain the two new inputs (`product_variant.price_currency`,
`market.display_currency`), recreated with the same events, WHEN clauses and DEFERRABLE INITIALLY
DEFERRED processor. Publication, revisions, same-Seller and same-Market tagging, moderation and
media gates, the transition and notification writes and every grant are unchanged. For You reads
the same view and the same public gate, so its eligibility and its tag `available` follow.

Result: for every Product, Scene item-level availability equals the Catalogue projection's item
level; the Catalogue's `available` adds the Seller/Market gates, which the public Scene gate
requires anyway (tested across stock, status, publication and Seller changes).

`in_stock` keeps meaning "an ACTIVE Variant has stock"; only `available` gains the currency term,
so the Seller's tag view can say "in stock, not sellable" truthfully (review M3). The migration ends
with one re-evaluation pass over PUBLISHED Scenes so stored visibility matches the new rule (a no-op
on audited data).

Known label nuance (INFO, ON-20261111-007): a Scene whose only blocker is a legacy non-Market
currency is labelled `ALL_TAGGED_PRODUCTS_OUT_OF_STOCK` (the re-evaluation counts "published" as
"otherwise eligible"). Such rows can no longer be written (B).

### B. OVN-088 -- currency integrity

- API: `createProduct` and `createVariant` refuse a currency other than the Seller's Market
  currency: `400 VALIDATION_FAILED`, `slots.path` = `base_price_currency` / `price_currency`.
- Database: `core.fn_guard_market_currency()` BEFORE INSERT and BEFORE UPDATE OF
  `price_currency`/`product_id` (Variant) and `base_price_currency`/`market_id` (Product); raises
  `23514` naming `variant_price_in_market_currency` / `product_seed_in_market_currency`, mapped by
  the API (by constraint name) to the same `VALIDATION_FAILED`. Known limit: the Market currency is
  read unlocked (ON-20261111-017).
- No conversion; existing rows are not rewritten (the audit found none to rewrite).
- A trigger, not a constraint, by decision recorded in DB-01 v1.22 S0.1: a constraint form (two
  composite FKs through `market (id, display_currency)`) would also forbid changing a Market's
  currency while it has Products -- a policy no document states.

### C. OVN-090 -- Product/Seller Market integrity

`product_market_is_seller_market`: `core.product (seller_id, market_id)` REFERENCES
`core.seller (id, market_id)` (the unique index `seller_id_market` already existed), validated in
the migration. Nothing updates `seller.market_id` today (audited); with the FK such an update is
refused while the Seller has Products.

### D. Seller Variant status (found on the way)

`PATCH /v1/seller/variants/{id}`: `status` is `ACTIVE` or `WITHDRAWN` only, and `WITHDRAWN` meets
the same live-reservation guard as DELETE (shared `assertNoLiveReservation`, which now locks the
Variant row). The Console never sends `status` (it patches the price only). `fn_create_order` still
reads Variant status without a lock (ON-20261111-020, Orders domain).

### E. OVN-086 -- Catalogue availability vs Checkout readiness (documented, NOT implemented)

| | Alternative 1: Scene/Catalogue availability includes every Checkout prerequisite | Alternative 2: item availability stays distinct from Checkout readiness |
|---|---|---|
| Rule | "available" also requires ACTIVE payout details, a timing configuration in force, and (per item) the NEW-level order cap | "available" = the item can be bought as an item (published, ACTIVE Variant in stock in the Market currency) and the Seller/Market are ACTIVE; Checkout re-validates Seller readiness at order time and says why it cannot proceed |
| Buyer effect | fewer dead ends at Checkout; but a Seller's pending payout change hides every Scene and marks every Product unavailable, though nothing about the items changed | an item may show available while that Seller cannot take an order yet (a short window: payout activation delay); Checkout must explain it |
| Scene effect | Scenes flip PRIVATE for Seller-administrative reasons, churning Seller notices and For You eligibility; needs new triggers on payout and configuration tables | unchanged: Scenes follow items and the existing Seller/Market gates |
| Data/coupling | Catalogue and Content read financial-boundary state (payout) and configuration | Catalogue stays independent of the financial boundary |
| Fits | "Catalogue availability" as a commerce promise | CATINV-01 S492-S496 (Variant-level availability), SCN-01 S27 (Scene follows tagged-item availability), ORDER-01 revalidation at Checkout |

**Recommendation: Alternative 2** (as WO-CAT-001 implemented), with Checkout readiness as its own
signal when Cart/Checkout is built. **Not decided here: OVN-086 remains a founder decision**; no new
policy was implemented.

## 5. Tests

`apps/api/test/cat-001a-eligibility.e2e.spec.ts` (13, real PostgreSQL, Scenes published through the
Seller API, every step checked on the direct Scene read, For You delivery and the Seller list):

| S D | Case | Result |
|---|---|---|
| 1-4 | several available -> one unavailable (PUBLIC) -> last unavailable (PRIVATE, OUT_OF_STOCK, 404, not in For You) -> availability returns (PUBLIC) | PASS |
| 5 | legacy non-Market currency is unavailable; correcting `price_currency` restores; a Market `display_currency` change re-evaluates both ways | PASS (both cases FAIL against the pre-0056 view: mutation-checked) |
| 6 | Seller SAFETY_SUSPENDED: hidden at once (404, not in For You); stock out and back while suspended stays PRIVATE; ACTIVE again restores | PASS |
| 7 | Market SUSPENDED hides; ACTIVE shows again | PASS |
| 8 | last available Product unpublished -> PRIVATE (UNAVAILABLE); republished -> PUBLIC | PASS |
| 9 | last in-stock Variant WITHDRAWN -> PRIVATE; ACTIVE -> PUBLIC | PASS |
| 10 | two concurrent transactions remove the last stock: PRIVATE, and no PUBLISHED+PUBLIC Scene without an available tag; concurrent restore: PUBLIC | PASS |
| -- | Catalogue `available` equals the Scene view's item availability for every tag across four changes | PASS |
| -- | API refuses USD Variant/Product (400, field named); ETB accepted; database refuses a USD insert/update (23514) | PASS |
| -- | Product in another Market than its Seller refused on insert and update (FK) | PASS |

Also: `cat-001-public-catalogue` (30) inserts its mixed-currency row as legacy data and still
passes; `c2-catalogue` asserts the PATCH withdrawal guard (409) and the status vocabulary (400).

## 6. Governance

Migration 0056 is forward only. ADU-DB-01 **v1.22** records it (S0.1, S30e; Appendices unchanged:
123 tables, `core` 97, 71 enum types); v1.21 moved to `docs/superseded/`; DOCUMENT_AUTHORITY,
the amendments README, the spec router, the docs-ascii governed list and `apps/api/CLAUDE.md` point
to v1.22. The November 8 design pack is untouched. No API contract change (regenerated: no diff).

## 7. Gates

Battery on `6c7d766` (freshly rebuilt disposable database): API **856/856** (run 1); catalogue,
Scene, For You and Product suites 258/258; `@adulis/api-client` test and `generate:check` PASS;
mobile typecheck, test (197/197) and build PASS; `pnpm typecheck` / `lint` / `build`; `verify:contract`
/ `appendix` / `docs` / `deps` / `mt-keys` / `error-locale`; `db:check` 16/16; `db:determinism`;
orphan sweep; Expo Doctor 20/20 -- all PASS. **`pnpm test` (run 2): API 819/856**, all 37 failures
`Exceeded timeout of 5000 ms for a hook` at `disc-002-fyp`'s beforeAll (ON-20261111-011).

Root cause and fix: e2e setups that build the Nest app and their fixtures through the API exceed
Jest's 5 s hook default under parallel workers (a per-file fix was followed by the same timeout in
`c7-chat-claims`, so the fix is one `testTimeout: 30_000` in `apps/api/jest.config.js`, `5faadf8`).
Verified: two full parallel API runs, **856/856 and 856/856**.

After the review fixes (`09c32e3`, `c7c5af1`): rebuilt database, `db:check` 16/16, cat-001a +
cat-001 + c2 + disc-001 + error-mapping specs **114/114**, `db:determinism` PASS (12,989 schema lines
compared), lint and typecheck clean. The whole battery runs again on the batch's final code.

## 8. Review

Independent code and security review of `4193fc8..HEAD`: **no Critical or High**.

- Fixed: M1 cross-suite For You dependency in the new test (ON-20261111-013); M2 the agreement
  test did not cover the currency case (ON-20261111-014); M3 `in_stock` semantics
  (ON-20261111-015); L3 error mapping by message (ON-20261111-018); L4 no catch-up re-evaluation
  (ON-20261111-019); L5 withdrawal check without a row lock, partly (ON-20261111-020); L6 test
  isolation (ON-20261111-021); L7 DB-01 references (ON-20261111-022).
- Recorded: L1 lock footprint on a populated database (ON-20261111-016); L2 unlocked Market
  currency read (ON-20261111-017).
- Checked and fine (review): trigger recreation identical to 0054 plus the new inputs; view grants
  kept; every consumer shifts only as intended; guard function ownership, search_path, NULL
  handling; no writer anywhere creates a non-Market currency or a cross-Market Product; FK indexed
  by `idx_product_storefront`; PATCH status not used by the Console; no contract change.

Data integrity: two invariants added at the database (currency, Market). Authorization: unchanged
(Seller writes still `seller.products:write`; no new public surface). Market/Seller isolation:
strengthened (FK). PRIVATE Scene leakage: none -- the gate only narrows; the catch-up pass keeps
stored state right. Cursors and caching: not applicable (no new read). Accessibility: not
applicable (no UI). Performance: the view's EXISTS gains one join to `core.market` by primary key;
the FK check uses an index.

## 9. Outcome

**COMPLETE.** Catalogue and Scene item-level availability agree (tested item by item, including
the case that used to differ); PUBLIC -> PRIVATE and back works across stock, currency, Seller,
Market, publication, withdrawal and concurrent changes; currency and Market integrity are held by
the database; no Critical or High finding remains. OVN-086 is documented with a recommendation and
left to the founder. WO-006 may depend on this branch.
