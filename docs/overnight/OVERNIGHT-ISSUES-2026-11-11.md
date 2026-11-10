# Adulis Overnight Issues -- 11 November 2026

Batch: WO-CAT-001A (Scene/Catalogue eligibility), WO-006 (Buyer Seller Profile), WO-007 (Buyer
Shop discovery). Starting branch `catalogue/wo-cat-001-public-read-integrity`, starting SHA
`4193fc8b5d3a3e15d92856dc2f508e4e548dc2ec` (verified equal to origin, clean tree).
The 10 November register (`OVERNIGHT-ISSUES-2026-11-10.md`) is preserved unchanged; its OVN-*
items are referenced here by ID.

Every discovered issue is recorded, fixed or not. Severity is the severity when found.

## Issues

### ON-20261111-001

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** DATA_INTEGRITY (carried OVN-087)
- **Status:** RESOLVED
- **Summary:** Scene item-level availability (core.v_scene_product_availability) lacked the Market-currency term the public Catalogue projection applies.
- **Expected:** Scene and Catalogue agree, item by item, on whether a Product can be bought.
- **Actual:** A Product whose only in-stock ACTIVE Variant was priced outside its Market currency was available to Scenes and For You but unavailable in the Catalogue.
- **Reproduction:** Legacy Variant in USD on an ETB Market as the only in-stock option; read the Scene tag and the Product detail.
- **Evidence:** db/migrations/0054_scene_posts.sql:372-384; apps/api/src/modules/catalogue/public-projection.ts; cat-001a D5
- **Root cause:** The view predates the WO-CAT-001 projection's currency rule.
- **Fix and commit:** Migration 0056: view term + re-evaluation on price_currency and display_currency (9f69577); DB-01 v1.22 (ea712e3).
- **Verification:** cat-001a 13/13 incl. D5 (fails against the pre-0056 view) and the item-agreement test.
- **Remaining risk:** A currency-only blocker is labelled OUT_OF_STOCK (ON-20261111-007).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-002

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** DATA_INTEGRITY (carried OVN-088)
- **Status:** RESOLVED
- **Summary:** Nothing enforced that Variant prices and Product seeds are in the Product's Market currency.
- **Expected:** MKT-01 S334 / CATINV-01 S364: the Seller Market determines the currency.
- **Actual:** createVariant/createProduct stored the request's currency unchecked; the schema allowed any ISO code.
- **Reproduction:** POST /v1/seller/products/{id}/variants with price_currency USD on an ETB Market (201 before).
- **Evidence:** catalogue.service.ts createVariant/createProduct; 0007:174
- **Root cause:** No write-time rule at any layer.
- **Fix and commit:** API validation (VALIDATION_FAILED naming the field) and trigger core.fn_guard_market_currency (23514 mapped to VALIDATION_FAILED): 9f69577, 83ce36d.
- **Verification:** cat-001a currency tests (API 400 for Variant and Product, ETB accepted, DB refuses insert and update).
- **Remaining risk:** A Market display_currency change is not governed (ON-20261111-009); existing rows are not rewritten (none found).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-003

- **Work order:** WO-CAT-001A
- **Severity:** INFO
- **Type:** DATA_INTEGRITY (carried OVN-090)
- **Status:** RESOLVED
- **Summary:** core.product.market_id was not tied to its Seller's Market.
- **Expected:** A Product's Market is its Seller's (as core.scene_post already enforces).
- **Actual:** Only createProduct's copy kept them equal; a direct write could split them.
- **Reproduction:** INSERT a Product with Seller A and another Market (accepted before).
- **Evidence:** 0007:108-111; 0054:102-103 (the Scene FK)
- **Root cause:** Composite FK never added to core.product.
- **Fix and commit:** product_market_is_seller_market FK, validated (9f69577); audit found 0 contradictions.
- **Verification:** cat-001a FK test (insert and update refused, 23503 on the named constraint).
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-004

- **Work order:** WO-CAT-001A
- **Severity:** MEDIUM
- **Type:** BUG (data integrity)
- **Status:** RESOLVED
- **Summary:** PATCH /v1/seller/variants/{id} accepted any free-text status, and status WITHDRAWN skipped DELETE's live-reservation guard.
- **Expected:** A Variant held by an ACTIVE reservation cannot be withdrawn (VARIANT_HAS_ACTIVE_ORDERS); status is one of the values the platform reads.
- **Actual:** A Seller could withdraw a Variant under a live order, or write any status string.
- **Reproduction:** Live reservation on a Variant; PATCH {status:'WITHDRAWN'} -> 200 before.
- **Evidence:** catalogue.schemas.ts patchVariantBody; catalogue.service.ts patchVariant/deleteVariant
- **Root cause:** The guard lived only in deleteVariant; the schema used z.string().
- **Fix and commit:** status z.enum(['ACTIVE','WITHDRAWN']); shared assertNoLiveReservation on PATCH WITHDRAWN (83ce36d).
- **Verification:** c2-catalogue: PATCH WITHDRAWN under a live reservation 409, PAUSED 400.
- **Remaining risk:** None known; the Console never sends status.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-005

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** DATA_INTEGRITY (carried OVN-088 part)
- **Status:** OPEN
- **Summary:** core.seller.category_id has no FK and PATCH /v1/seller/profile accepts a category id that names no category.
- **Expected:** A Seller's category is a real core.category row.
- **Actual:** Observed in the WO-CAT-001 native fixture: 200 for a random uuid.
- **Reproduction:** PATCH /v1/seller/profile {category_id: random uuid} -> 200.
- **Evidence:** 0005:42 (column before core.category exists in 0007); onboarding.service.ts patchProfile
- **Root cause:** Migration order; no FK added later.
- **Fix and commit:** Not fixed (Seller onboarding write path, outside this batch's scope).
- **Verification:** n/a
- **Remaining risk:** Readiness STORE_PROFILE can be satisfied by a dangling id.
- **Founder decision required:** No
- **Recommended resolution:** Validate in patchProfile and add the FK (NOT VALID then VALIDATE after an audit) in an onboarding work order.

### ON-20261111-006

- **Work order:** WO-CAT-001A
- **Severity:** INFO
- **Type:** TEST_FIXTURE
- **Status:** RESOLVED
- **Summary:** cat-001-public-catalogue failed (30/30) after 0056: its fixture inserted a USD Variant, which the guard now refuses.
- **Expected:** The mixed-currency projection test still proves legacy data is handled.
- **Actual:** error: price_currency USD is not the Market currency ETB.
- **Reproduction:** Full API run on a database migrated through 0056.
- **Evidence:** api-001a-full log: 30 failed, 813 passed (only that suite)
- **Root cause:** The guard working as intended.
- **Fix and commit:** The fixture inserts that one row with triggers off, labelled as legacy data (6c7d766).
- **Verification:** cat-001 30/30.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-007

- **Work order:** WO-CAT-001A
- **Severity:** INFO
- **Type:** LABEL_ACCURACY
- **Status:** OPEN
- **Summary:** A Scene made PRIVATE only by a legacy non-Market currency is labelled ALL_TAGGED_PRODUCTS_OUT_OF_STOCK.
- **Expected:** The reason names the real cause.
- **Actual:** fn_scene_post_reevaluate counts 'published' as 'otherwise eligible'.
- **Reproduction:** cat-001a D5 (asserts the label).
- **Evidence:** 0054 fn_scene_post_reevaluate v_reason
- **Root cause:** The reason rule predates the currency term.
- **Fix and commit:** Not changed (Scene lifecycle function; the case cannot be newly written since 0056).
- **Verification:** n/a
- **Remaining risk:** Cosmetic, Seller-facing label only.
- **Founder decision required:** No
- **Recommended resolution:** Refine v_eligible when the Scene domain next changes fn_scene_post_reevaluate.

### ON-20261111-008

- **Work order:** WO-CAT-001A
- **Severity:** INFO
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** pnpm verify:appendix failed when run without the disposable-database environment (it read the developer database, which is behind on migrations).
- **Expected:** The gate reads the database the branch is migrated into.
- **Actual:** FAIL against the developer DB; PASS against adulis_gates (123 tables, 71 enum types).
- **Reproduction:** pnpm verify:appendix with the repo .env only.
- **Evidence:** session log
- **Root cause:** Developer DB not migrated (carried OVN-053).
- **Fix and commit:** None needed for the branch.
- **Verification:** PASS on the disposable database.
- **Remaining risk:** None for the code.
- **Founder decision required:** No
- **Recommended resolution:** Run pnpm db:migrate on the developer database before using these branches (OVN-053).

### ON-20261111-009

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** OPEN_POLICY
- **Status:** OPEN
- **Summary:** No document says whether a Market's display_currency may change while it has Products, or what happens to their prices.
- **Expected:** A governed rule (no conversion is approved).
- **Actual:** 0056 enforces currency on write; a Market currency change is allowed and makes its Products unpriced/unavailable until re-priced.
- **Reproduction:** cat-001a D5 Market currency case.
- **Evidence:** 0056; DB-01 v1.22 S0.1
- **Root cause:** Open product/finance question.
- **Fix and commit:** None (deliberately not decided in SQL).
- **Verification:** n/a
- **Remaining risk:** An operator currency change would hide a Market's catalogue.
- **Founder decision required:** Yes
- **Recommended resolution:** Rule that a Market currency is fixed once Products exist (then a constraint can hold it), or define a re-pricing procedure.

### ON-20261111-010

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** GOVERNANCE (carried OVN-086)
- **Status:** FOUNDER_REVIEW_REQUIRED
- **Summary:** Whether Catalogue/Scene availability should include Checkout prerequisites (ACTIVE payout, timing configuration, NEW-level cap).
- **Expected:** A founder decision.
- **Actual:** Item availability excludes them (WO-CAT-001).
- **Reproduction:** n/a
- **Evidence:** WO-CAT-001A record S4.E (alternatives compared)
- **Root cause:** Open decision.
- **Fix and commit:** Documented two alternatives; recommended Alternative 2; nothing implemented.
- **Verification:** n/a
- **Remaining risk:** An item may show available while its Seller cannot yet take an order.
- **Founder decision required:** Yes
- **Recommended resolution:** Approve Alternative 2 (item availability distinct from Checkout readiness).

### ON-20261111-011

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** TEST_INFRA
- **Status:** RESOLVED
- **Summary:** disc-002-fyp (and once wo-api-001a) failed every test with 'Exceeded timeout of 5000 ms for a hook' in some parallel full runs.
- **Expected:** Suites pass in every full run.
- **Actual:** WO-CAT-001A battery: run 1 856/856, run 2 (pnpm test) 819/856, all 37 failures in disc-002 (74 hook-timeout messages at its beforeAll, line 190). Same signature in the WO-CAT-001 and WO-DISC-002A batteries; each suite passes alone.
- **Reproduction:** pnpm --filter @adulis/api test (parallel workers) on a loaded machine; intermittent.
- **Evidence:** scratchpad v001a/pnpm-test.log: 74 x 'at test/disc-002-fyp.e2e.spec.ts:190:3 beforeAll'
- **Root cause:** The suite's beforeAll builds the Nest app and publishes seven Scenes through the API (~28 requests plus fixture writes) under Jest's 5 s default hook timeout; parallel workers on one machine sometimes push it past 5 s. Not caused by migration 0056 (seen before it).
- **Fix and commit:** jest.setTimeout(30_000) in disc-002-fyp and wo-api-001a, as wo-sec-001 already does (e9444f2). No assertion changed.
- **Verification:** Two full parallel API runs after the shared jest testTimeout (5faadf8): 856/856 and 856/856. The intermediate per-file fix (e9444f2) was followed by a c7-chat-claims beforeAll timeout, which is why the fix moved to jest.config.js.
- **Remaining risk:** A slower machine could still exceed 30 s; the hooks' work is unchanged.
- **Founder decision required:** No
- **Recommended resolution:** Done; consider running the API suite with a bounded worker count in CI.

### ON-20261111-012

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** DOCUMENTATION_DRIFT
- **Status:** OPEN
- **Summary:** apps/api/CLAUDE.md still names ADU-DB-01 v1.16 as governing (line 6) and 120 tables in its counts table (line 46).
- **Expected:** The workstream file cites the governing revision (v1.22) and the current count (123).
- **Actual:** Stale lines; the authoritative versions are in docs/amendments/README.md and DOCUMENT_AUTHORITY.md (both updated).
- **Reproduction:** Read apps/api/CLAUDE.md:6, :46.
- **Evidence:** apps/api/CLAUDE.md
- **Root cause:** Earlier reissues updated only the WO-DISC notes in that file.
- **Fix and commit:** Not changed beyond the 0056 note (the file says the citation governs; the governing files are correct).
- **Verification:** n/a
- **Remaining risk:** An agent reading only that file sees old numbers.
- **Founder decision required:** No
- **Recommended resolution:** Refresh the two lines in the next backend governance pass.

### ON-20261111-013

- **Work order:** WO-CAT-001A
- **Severity:** MEDIUM
- **Type:** TEST_FLAKE_RISK
- **Status:** RESOLVED
- **Summary:** cat-001a asserted For You delivery through /v1/fyp, which depends on the shared ACTIVE algorithm version that disc-002 switches while running in a parallel worker.
- **Expected:** The suite's outcome depends only on its own fixtures.
- **Actual:** A window with no ACTIVE version (or disc-002's 'bad' version) would return an empty feed.
- **Reproduction:** Run cat-001a and disc-002 in parallel workers (timing-dependent).
- **Evidence:** review M1; disc-002 activate() two statements
- **Root cause:** Cross-suite shared configuration row.
- **Fix and commit:** Feed eligibility read from core.v_scene_post_public, the gate For You serves from (c7c5af1); delivery itself stays proven by disc-002.
- **Verification:** cat-001a 13/13.
- **Remaining risk:** None for this suite.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-014

- **Work order:** WO-CAT-001A
- **Severity:** MEDIUM
- **Type:** TEST_GAP
- **Status:** RESOLVED
- **Summary:** The Catalogue/Scene agreement test never exercised the one case the two rules used to disagree on (a non-Market currency).
- **Expected:** The test fails against the pre-0056 view.
- **Actual:** It changed stock, status and publication only.
- **Reproduction:** Run it against the old view: it passed.
- **Evidence:** review M2
- **Root cause:** Case omitted.
- **Fix and commit:** A legacy USD option as the only in-stock Variant is added to the comparison (c7c5af1).
- **Verification:** cat-001a 13/13; the view reports in_stock true, available false for it.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-015

- **Work order:** WO-CAT-001A
- **Severity:** MEDIUM
- **Type:** SEMANTICS
- **Status:** RESOLVED
- **Summary:** The first 0056 draft put the currency term in in_stock too, so the Seller tag view would read 'no sellable stock' for an in-stock Variant priced in the wrong currency.
- **Expected:** in_stock means stock; available means sellable.
- **Actual:** in_stock false while stock_count > 0.
- **Reproduction:** Legacy USD Variant in stock; Seller revision view.
- **Evidence:** review M3; scenes.service.ts seller tag view; scenes.dto.ts in_stock description
- **Root cause:** Term added to both columns.
- **Fix and commit:** in_stock reverted to stock only; the currency term is in available alone (09c32e3, unmerged rewrite).
- **Verification:** Agreement test asserts {available:false, in_stock:true}.
- **Remaining risk:** The Scene's PRIVATE reason still says OUT_OF_STOCK for that case (ON-20261111-007).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-016

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** OPERATIONS
- **Status:** OPEN
- **Summary:** Migration 0056 drops and recreates triggers (ACCESS EXCLUSIVE on product_variant and market until COMMIT) and validates the new FK in the same transaction.
- **Expected:** A short lock window on a populated production database.
- **Actual:** Fine at pre-launch size; on large tables every request reading core.market would wait for the FK validation.
- **Reproduction:** Apply 0056 to a large database.
- **Evidence:** review L1
- **Root cause:** Single-transaction migration.
- **Fix and commit:** Not changed (pre-launch data volumes).
- **Verification:** db:determinism PASS; migration applies in seconds on the gate database.
- **Remaining risk:** Lock waits if applied to a large live database.
- **Founder decision required:** No
- **Recommended resolution:** If 0056 is ever applied to a populated database: set lock_timeout, or add the FK NOT VALID and VALIDATE it in a later migration.

### ON-20261111-017

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** CONCURRENCY_LIMIT
- **Status:** OPEN
- **Summary:** fn_guard_market_currency reads market.display_currency unlocked, so a Variant write racing an operator's Market currency change can commit in the old currency.
- **Expected:** No mixed currencies after a currency change.
- **Actual:** A narrow race on a rare operator action.
- **Reproduction:** Concurrent Variant insert and Market display_currency update.
- **Evidence:** review L2; 0056 guard
- **Root cause:** No lock on the Market row.
- **Fix and commit:** Documented in the migration and DB-01 v1.22.
- **Verification:** n/a
- **Remaining risk:** The projection and view then treat such a row as unpriced/unavailable (safe).
- **Founder decision required:** No
- **Recommended resolution:** Resolve with ON-20261111-009 (fix a Market's currency once Products exist).

### ON-20261111-018

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** ROBUSTNESS
- **Status:** RESOLVED
- **Summary:** The guard's 23514 was mapped by matching message text.
- **Expected:** Mapping by a stable identifier.
- **Actual:** A reworded message would turn into a 500.
- **Reproduction:** n/a
- **Evidence:** review L3
- **Root cause:** First draft.
- **Fix and commit:** RAISE ... CONSTRAINT names; translator matches e.constraint (09c32e3, c7c5af1).
- **Verification:** cat-001a currency API tests (VALIDATION_FAILED with the field).
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-019

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** DATA_CONSISTENCY
- **Status:** RESOLVED
- **Summary:** 0056 narrowed availability without re-evaluating stored Scene visibility.
- **Expected:** Stored visibility matches the new rule after the migration.
- **Actual:** Public reads were right (gate at read time) but a Seller list could show PUBLIC until the next trigger.
- **Reproduction:** A database with a legacy non-Market currency before 0056.
- **Evidence:** review L4
- **Root cause:** No catch-up step.
- **Fix and commit:** One re-evaluation pass over PUBLISHED Scenes at the end of 0056 (09c32e3).
- **Verification:** Migration applies; db:check 16/16; db:determinism PASS.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-020

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** CONCURRENCY
- **Status:** PARTIALLY RESOLVED
- **Summary:** Variant withdrawal (DELETE and PATCH) checked live reservations without locking the Variant, and fn_create_order reads Variant status unlocked.
- **Expected:** No order lands on a Variant being withdrawn.
- **Actual:** Check-then-act gap (pre-existing on DELETE).
- **Reproduction:** Concurrent withdrawal and order creation on the same Variant.
- **Evidence:** review L5; 0028:174-185
- **Root cause:** No row lock on either side.
- **Fix and commit:** The withdrawal guard now takes FOR UPDATE on the Variant (c7c5af1).
- **Verification:** c2-catalogue guard tests pass.
- **Remaining risk:** fn_create_order still reads status without a lock (Orders domain).
- **Founder decision required:** No
- **Recommended resolution:** Lock the Variant rows in fn_create_order when the Cart/Checkout work order touches it.

### ON-20261111-021

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** TEST_ISOLATION
- **Status:** RESOLVED
- **Summary:** cat-001a afterEach did not reset a Variant's currency, so a mid-test D5 failure would cascade.
- **Expected:** Each case starts from the same state.
- **Actual:** Missing reset.
- **Reproduction:** Fail D5 between its two currency writes.
- **Evidence:** review L6
- **Root cause:** Omission.
- **Fix and commit:** afterEach resets currencies to ETB (c7c5af1).
- **Verification:** 13/13.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-022

- **Work order:** WO-CAT-001A
- **Severity:** INFO
- **Type:** DOCUMENTATION
- **Status:** RESOLVED
- **Summary:** DB-01 v1.22 S0.1 pointed to sections (9.2, 9.3, 30c) that did not change.
- **Expected:** Section references name what changed.
- **Actual:** Stale references.
- **Reproduction:** Read S0.1.
- **Evidence:** review L7
- **Root cause:** First draft.
- **Fix and commit:** References now S30e; wording follows the in_stock change (09c32e3).
- **Verification:** verify:docs PASS.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.
