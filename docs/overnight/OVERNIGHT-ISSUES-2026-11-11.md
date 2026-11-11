# Adulis Overnight Issues -- 11 November 2026

Batch: WO-CAT-001A (Scene/Catalogue eligibility), WO-006 (Buyer Seller Profile), WO-007 (Buyer
Shop discovery). Starting branch `catalogue/wo-cat-001-public-read-integrity`, starting SHA
`4193fc8b5d3a3e15d92856dc2f508e4e548dc2ec` (verified equal to origin, clean tree).
The 10 November register (`OVERNIGHT-ISSUES-2026-11-10.md`) is preserved unchanged; its OVN-*
items are referenced here by ID.

Every discovered issue is recorded, fixed or not. Severity is the severity when found.

WO-007A (11 November 2026, branch `mobile/wo-007a-discovery-stabilization`, from `fe7ffb2`) updated
ON-20261111-009, -010, -012, -023, -026, -029, -033, -037, -040, -043, -048, -049, -050 and -052, each
with a "WO-007A" line separating policy approval from implementation, and added -053 to -070. WO-007B and WO-008 (11 November 2026) updated ON-20261111-026, -049, -053, -056, -057 and -068 and added -071 to -085. WO-009 (11 November 2026, branch `mobile/wo-009-buyer-saved-collections`) added -086 to -102. WO-009A (11 November 2026, branch `mobile/wo-009a-card-saves-storage-hardening`, from `379adb6`) updated -084, -085, -092, -100 and -102 and added -103 to -113; -087, -088, -090 and -091 are unchanged and still await the founder. WO-010 (11 November 2026, branch `mobile/wo-010-catalogue-categories`, from `0f90974`) updated -049, -100, -110, -111 and -112 and added -114 to -121; the other pending founder decisions are unchanged. WO-010A (11-12 November 2026, branch `mobile/wo-010a-dependency-environment-stabilization`, from `9970fea`) updated -100, -110, -114, -115, -117 and -118 and added -122 to -128; -049, -079, -080, -087, -088, -090, -091, -111, -116 and the payment deferral are unchanged. WO-011 (12 November 2026, branch `mobile/wo-011-buyer-account`, from `e00706f`) added -129 to -138; no earlier decision was changed.

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
- **Status:** RESOLVED
- **Summary:** No document says whether a Market's display_currency may change while it has Products, or what happens to their prices.
- **Expected:** A governed rule (no conversion is approved).
- **Actual:** 0056 enforces currency on write; a Market currency change is allowed and makes its Products unpriced/unavailable until re-priced.
- **Reproduction:** cat-001a D5 Market currency case.
- **Evidence:** 0056; DB-01 v1.22 S0.1
- **Root cause:** Open product/finance question.
- **Fix and commit:** None (deliberately not decided in SQL).
- **Verification:** n/a
- **Remaining risk:** An operator currency change would hide a Market's catalogue.
- **Founder decision required:** No (decided 11 November 2026)
- **Recommended resolution:** Rule that a Market currency is fixed once Products exist (then a constraint can hold it), or define a re-pricing procedure.
- **WO-007A (11 November 2026):** Policy APPROVED: a Market currency is fixed once it has Products. Implementation COMPLETED: migration 0059 (trg_market_currency_fixed, 23514 market_currency_fixed_with_products, SHARE ROW EXCLUSIVE on core.product so a concurrent first Product cannot slip past). Further engineering: the exceptional repricing procedure is undesigned (a reviewed forward migration when needed). Further legal/privacy authorisation: none.
- **WO-007A verification:** wo-007a-reviews (refused with Products, allowed without, both race orders, two changes queue); cat-001a D5 now asserts the refusal; native curl: refused, currency unchanged.

### ON-20261111-010

- **Work order:** WO-CAT-001A
- **Severity:** LOW
- **Type:** GOVERNANCE (carried OVN-086)
- **Status:** RESOLVED
- **Summary:** Whether Catalogue/Scene availability should include Checkout prerequisites (ACTIVE payout, timing configuration, NEW-level cap).
- **Expected:** A founder decision.
- **Actual:** Item availability excludes them (WO-CAT-001).
- **Reproduction:** n/a
- **Evidence:** WO-CAT-001A record S4.E (alternatives compared)
- **Root cause:** Open decision.
- **Fix and commit:** Documented two alternatives; recommended Alternative 2; nothing implemented.
- **Verification:** n/a
- **Remaining risk:** An item may show available while its Seller cannot yet take an order.
- **Founder decision required:** No (decided 11 November 2026)
- **Recommended resolution:** Approve Alternative 2 (item availability distinct from Checkout readiness).
- **WO-007A (11 November 2026):** Policy APPROVED: Alternative 2. Implementation: already the behaviour (item availability excludes Checkout prerequisites); nothing changed. Further engineering: Checkout must validate its own prerequisites before an Order exists (Checkout work order). Further legal/privacy authorisation: none.

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
- **Status:** RESOLVED
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
- **WO-007A (11 November 2026):** apps/api/CLAUDE.md now cites ADU-DB-01 v1.24 and 123 tables (manifest 109 + 14, core 97), the numbers pnpm db:check and pnpm verify:permission-doc print (72d957d).

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

### ON-20261111-023

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** DESIGN_CONFLICT
- **Status:** RESOLVED
- **Summary:** ADU-MOB-02 names the Buyer Seller route (buyer)/seller/[sellerRef]; /seller is already the Seller Companion shell, and no Seller reference exists beyond the handle.
- **Expected:** One unambiguous Buyer route to a Seller.
- **Actual:** Implemented as /sellers/[handle] (plural, like /scenes/[ref]); the public web is /s/:handle (STOREFRONT-02).
- **Reproduction:** n/a
- **Evidence:** MOB-02:202; apps/mobile/src/modes/modes.ts (Companion /seller); app/(buyer)/sellers/[handle].tsx
- **Root cause:** Route naming not reconciled across Mobile modes and the web.
- **Fix and commit:** Plural route; recorded.
- **Verification:** seller-profile tests and Maestro flows (deep link adulis://sellers/fixture-weaves).
- **Remaining risk:** A rename later needs link compatibility.
- **Founder decision required:** No (decided 11 November 2026)
- **Recommended resolution:** Decide the cross-surface Seller URL together with the Scene/Product scheme (OVN-080).
- **WO-007A (11 November 2026):** Policy APPROVED: keep /sellers/[handle] (no collision with the Companion /seller). Implementation: already the route. Further engineering: universal-link standardisation across surfaces is a separate task. Further legal/privacy authorisation: none.

### ON-20261111-024

- **Work order:** WO-006
- **Severity:** MEDIUM
- **Type:** BUG
- **Status:** RESOLVED
- **Summary:** GET /v1/storefronts/{handle}/reviews cast the raw cursor in SQL: a malformed cursor was a 500, the cursor kept only milliseconds, and reviews sharing a published_at were skipped at a page boundary.
- **Expected:** Invalid cursors are 400; pages neither skip nor repeat.
- **Actual:** 500 INTERNAL (22007 unmapped); rows lost at ties and inside the truncated millisecond.
- **Reproduction:** ?cursor=not-a-date -> 500; two reviews written in one transaction share published_at.
- **Evidence:** storefront.controller.ts reviews (before bf21f9e)
- **Root cause:** Unvalidated cast; non-unique sort key; JS Date truncation.
- **Fix and commit:** Validated opaque keyset cursor (published_at at microseconds, id); optional limit (bf21f9e).
- **Verification:** wo-006 e2e: 400 CURSOR_INVALID; one-row pages walk across a timestamp tie returning every review once.
- **Remaining risk:** Old ISO cursors are refused (no in-repo consumer).
- **Founder decision required:** No
- **Recommended resolution:** Done; release note in the handoff.

### ON-20261111-025

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** SPEC_CONFLICT
- **Status:** OPEN
- **Summary:** TRUST-01 defines four public Trust levels (NEW, REBUILDING, ESTABLISHED, TRUSTED); core.trust_level has three (no REBUILDING).
- **Expected:** Schema and design agree.
- **Actual:** The profile shows the three the database holds; REBUILDING cannot occur.
- **Reproduction:** n/a
- **Evidence:** 0001:192; TRUST-01 S9 :110-115
- **Root cause:** Design revision after the enum.
- **Fix and commit:** None (Trust domain).
- **Verification:** n/a
- **Remaining risk:** None until the Trust domain adds the level (the app would need a catalogue label).
- **Founder decision required:** No
- **Recommended resolution:** Trust work order: add REBUILDING with its label key.

### ON-20261111-026

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** DESIGN_GAP
- **Status:** RESOLVED
- **Summary:** MOB-02 R-09 says the Products tab is 'the catalogue with available first'; the API keeps the Seller's display order.
- **Expected:** Available Products first.
- **Actual:** Seller display order (display_order, created_at, slug); unavailable Products are labelled in words.
- **Reproduction:** n/a
- **Evidence:** MOB-02 R-09 :2373; storefront.controller.ts products
- **Root cause:** Ordering by a live, changing flag makes keyset pages shift between requests.
- **Fix and commit:** Not implemented (deliberate).
- **Verification:** n/a
- **Remaining risk:** Unavailable Products may sit above available ones if the Seller ordered them so.
- **Founder decision required:** No (option A decided 11 November 2026)
- **Recommended resolution:** Confirm Seller order, or approve available-first with a snapshot-stable cursor (or a server-side partition: available pages, then unavailable).
- **WO-007A (11 November 2026):** Policy APPROVED: available first. Implementation NOT DONE, by the work order's own rule: a stateless keyset cannot page a list sorted by a value that changes between pages with neither a repeat nor a gap (proof and options: WO-007A-DISCOVERY-STABILIZATION.md S11). The Seller's display order is kept. Further engineering: implement the chosen option. Further legal/privacy authorisation: option B only (a new retention rule).
- **WO-007B (11 November 2026):** Founder APPROVED option A. IMPLEMENTED: GET /v1/storefronts/{handle}/products orders by (availability phase, display_order, created_at, slug) in one statement per page, the cursor carrying the phase; no snapshot storage; mobile de-duplicates by Product id. Accepted limit, documented: a Product that changes group mid-browse may repeat (shown once) or appear only after refresh; Product Detail re-reads availability (09f8edb, a5dfd2b; WO-007B-AVAILABLE-FIRST-CATALOGUE.md).
- **WO-007B verification:** wo-007b 11/11 (both move directions, 130 Products, malformed cursors, cross-Market); seller-profile.test 17/17; native seller-profile.yaml asserts the out-of-stock Product below the available ones.

### ON-20261111-027

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** Reliability rates (cancellation, confirmation, scan completion) are not shown: the API exposes no denominators or freshness, and TRUST-01 S57 forbids a zero rate reading as perfect (INSUFFICIENT_EVIDENCE).
- **Expected:** Rates with sample context, or INSUFFICIENT_EVIDENCE.
- **Actual:** Rates are decimal text with no sample size; the app shows only the Trust level and completed handoffs.
- **Reproduction:** GET /v1/storefronts/{handle}: stats.cancellation_rate '0.0000' with no denominator.
- **Evidence:** TRUST-01 S57 :440, S68 :557-565; seller_public_stats
- **Root cause:** Trust public projection not built.
- **Fix and commit:** Rates withheld in the UI (documented).
- **Verification:** seller-profile test asserts no rate text.
- **Remaining risk:** None (nothing misleading shown).
- **Founder decision required:** No
- **Recommended resolution:** Trust work order: public reliability projection with sample sizes.

### ON-20261111-028

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** About is partial against R-09: no category label (no taxonomy/labels), no neighbourhood/operating area or collection point (no structured location), no social accounts, no opening hours (only open now).
- **Expected:** R-09 About fields where public policy permits.
- **Actual:** Description, Trust level, open/closed now, fulfilment methods, member since.
- **Reproduction:** n/a
- **Evidence:** MOB-02 R-09; STOREFRONT-02 :514, :528-547; StorefrontDto
- **Root cause:** No public contract or data for the missing fields.
- **Fix and commit:** Only genuine fields shown.
- **Verification:** seller-profile About test.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Add the fields with their governing data (taxonomy, structured location, verified social accounts) in their own work orders.

### ON-20261111-029

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** REV-01 S32 lets moderation restrict or remove a review from public view; no such state exists, so every review is public.
- **Expected:** A moderated review is excluded and aggregates reconciled.
- **Actual:** All reviews listed and counted.
- **Reproduction:** n/a
- **Evidence:** 0014 core.review (no visibility column); REV-01 S32 :291
- **Root cause:** Moderation projection not built.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** A review an operator wants removed stays public.
- **Founder decision required:** Yes -- the Review moderation policy and Operator capability
- **Recommended resolution:** Add the moderation state, filter it in reviews and the summary.
- **WO-007A (11 November 2026):** Re-audited: no Review moderation state, decision vocabulary (moderation_event.decision is free text), Operator capability or workflow exists. Nothing invented. Now a RELEASE BLOCKER for public Reviews (REV-01 S32): when built, it joins core.v_review_public so the list and the aggregate follow it together. No public Review exists until verified payment does (ON-20261111-053), so no moderated content is public meanwhile.

### ON-20261111-030

- **Work order:** WO-006
- **Severity:** INFO
- **Type:** SCOPE
- **Status:** OPEN
- **Summary:** R-09 header actions Follow and Message (and Share) are not built.
- **Expected:** Per R-09 later.
- **Actual:** Absent (no fake buttons).
- **Reproduction:** n/a
- **Evidence:** MOB-02 R-09; work order exclusions
- **Root cause:** Out of this batch's scope (Follow, Chat).
- **Fix and commit:** None.
- **Verification:** seller-profile test asserts no such buttons.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Build with the Follow and Chat work orders.

### ON-20261111-031

- **Work order:** WO-006
- **Severity:** MEDIUM
- **Type:** ANALYTICS
- **Status:** RESOLVED
- **Summary:** storefront_viewed was recorded on every storefront header read, including the profile's re-reads on return, pull and background return (review M1; the OVN-073 pattern for Seller views).
- **Expected:** Openings and technical re-reads distinguished (founder principle OVN-073).
- **Actual:** Scene -> back -> Scene -> back added a Seller view each time.
- **Reproduction:** Open the profile, return from a Scene: two events.
- **Evidence:** storefront.controller.ts storefront() emit; SellerProfile.tsx focus re-read
- **Root cause:** The revalidate flag existed only on the Product read.
- **Fix and commit:** GET /v1/storefronts/{handle} takes revalidate=true and then records nothing; the app sends it on every re-read (1ed877d, 1124125).
- **Verification:** wo-006 e2e: one opening + two revalidations = +1 event; mobile: re-reads carry revalidate=true.
- **Remaining risk:** Like product_viewed, not de-duplicated across openings.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-032

- **Work order:** WO-006
- **Severity:** HIGH
- **Type:** SECURITY/ROBUSTNESS
- **Status:** RESOLVED
- **Summary:** A list cursor could pass the shape check and still make Postgres refuse it -- an impossible date V8 rolls over (2026-02-30), year 0000, or an int beyond int4 -- giving an unauthenticated 500 on the Scenes, Products and Reviews lists.
- **Expected:** Every malformed cursor is 400 CURSOR_INVALID.
- **Actual:** 500 INTERNAL (22008/22003 unmapped) and an error log per request.
- **Reproduction:** GET /v1/storefronts/x/scenes?cursor=<b64 of ["2026-02-30T00:00:00.000000Z","AAAAAAAAAAAAAAAAAAAAAA"]>.
- **Evidence:** review H1; cursor.ts (before 1ed877d)
- **Root cause:** Date.parse accepts impossible dates; ints checked only as safe integers.
- **Fix and commit:** Timestamps must round-trip unchanged (and not year 0); ints bounded to int4 (1ed877d).
- **Verification:** wo-006 e2e crafted cursors on all three lists: 400; native curl: 400.
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-033

- **Work order:** WO-006
- **Severity:** MEDIUM
- **Type:** SPEC_CONFLICT
- **Status:** RESOLVED
- **Summary:** REV-01 v3.3 admits public reviews only on a verified evidence basis (FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; 'no unverified fallback'), while the built schema derives an UNVERIFIED badge and the existing public reviews endpoint lists and counts such reviews.
- **Expected:** One rule for which reviews are public.
- **Actual:** UNVERIFIED reviews are public, labelled 'Unverified', and counted in the Seller-service mean; badge_counts are the stored tiers, not REV-01's bases.
- **Reproduction:** Any review whose order has no confirmation and no upheld claim.
- **Evidence:** REV-01 :23-31; 0014 fn_review_derive_badge; storefront.controller.ts reviews and summary
- **Root cause:** The schema follows the older DB-01 badge ladder; the November pack changed the rule.
- **Fix and commit:** None (SPEC_CONFLICT: report, do not resolve in code). The comment no longer overclaims (1ed877d).
- **Verification:** n/a
- **Remaining risk:** Buyers see unverified opinions in the Seller summary.
- **Founder decision required:** No (decided 11 November 2026)
- **Recommended resolution:** Rule whether UNVERIFIED reviews stay public (labelled) or are excluded from list and mean until the Reviews domain implements REV-01's eligibility resolver.
- **WO-007A (11 November 2026):** Policy APPROVED: only verified-evidence Reviews are public or counted. Implementation COMPLETED, fail closed: migration 0058 (core.v_review_public, core.fn_order_payment_verified) read by the public list and summary; badge -> evidence_basis, badge_counts -> basis_counts (d905834). Today no Review is public because no verified payment exists (K-1). Every stored Review is kept. Further engineering: ON-20261111-053 to -059 (payment, write path, receipt methods, fault attribution, self-review timing, correction lineage). Further legal/privacy authorisation: none for this change.
- **WO-007A verification:** wo-007a-reviews 20+ cases (mutation-sensitive: the pre-0058 summary would count 19 reviews at 2.6); wo-006 header/list now 0/null; native: as built "No reviews yet", with the payment stand-in 27 verified reviews paged and labelled, unverified ones never shown.

### ON-20261111-034

- **Work order:** WO-006
- **Severity:** MEDIUM
- **Type:** BUG
- **Status:** RESOLVED
- **Summary:** Back on the Seller Profile only the header was re-read: a Scene that went PRIVATE while open stayed in the grid, and a list pull left the header's summary stale.
- **Expected:** Return re-reads what is visible; header and list agree.
- **Actual:** Stale tile until a pull or the background interval.
- **Reproduction:** Open a Scene from the profile; make it PRIVATE; Back.
- **Evidence:** review M3
- **Root cause:** Focus re-read wired to the header only.
- **Fix and commit:** Each list tab re-reads on return; a list pull also re-reads the header (1124125).
- **Verification:** seller-profile tests: return drops the PRIVATE Scene; pull re-reads header as revalidation.
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-035

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** PRESENTATION
- **Status:** RESOLVED
- **Summary:** The review mean was rounded twice (server 2 decimals, app 1), so 4.249 showed 4.3.
- **Expected:** One rounding.
- **Actual:** Double rounding.
- **Reproduction:** Mean 4.249.
- **Evidence:** review Low
- **Root cause:** Both sides rounded.
- **Fix and commit:** Server rounds once to 1 decimal; app shows it as is (1ed877d, 1124125).
- **Verification:** wo-006 e2e: 5, 4, 4 -> 4.3.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-036

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** PRESENTATION
- **Status:** RESOLVED
- **Summary:** 'Member since' formatted a UTC date in the device time zone (a day early west of UTC).
- **Expected:** The UTC date as is.
- **Actual:** Off by one west of UTC.
- **Reproduction:** Device in a negative UTC offset.
- **Evidence:** review Low
- **Root cause:** No timeZone option.
- **Fix and commit:** timeZone: 'UTC' (1124125).
- **Verification:** Typecheck and tests.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-037

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** PRIVACY_NOTE
- **Status:** RESOLVED
- **Summary:** The Seller products cursor carries the last Product's created_at to the microsecond (readable after base64 decoding).
- **Expected:** Doctrine 5 keeps internal UUIDs (time-ordered) out of URLs; creation time itself is a similar, weaker disclosure.
- **Actual:** Creation time of one listed Product per page is visible in the cursor.
- **Reproduction:** Decode next_cursor.
- **Evidence:** review Low; storefront.controller.ts products
- **Root cause:** The established order (display_order, created_at) needs created_at as its key.
- **Fix and commit:** Not changed.
- **Verification:** n/a
- **Remaining risk:** Low: a Product's listing time, not an identifier.
- **Founder decision required:** No (decided 11 November 2026)
- **Recommended resolution:** Accept, or sign/encrypt cursors if creation times are considered sensitive.
- **WO-007A (11 November 2026):** Policy APPROVED: creation timestamps inside opaque, validated, resource-scoped cursors are accepted for MVP; no encryption only to hide them. Implementation: already the behaviour. Further engineering: none.

### ON-20261111-038

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** ACCESSIBILITY
- **Status:** RESOLVED
- **Summary:** Tab labels used adjustsFontSizeToFit, shrinking text at large font scales.
- **Expected:** Labels honour the user's text size.
- **Actual:** Shrunk labels.
- **Reproduction:** Font scale 1.3.
- **Evidence:** review Low
- **Root cause:** First draft.
- **Fix and commit:** Labels wrap instead (1124125).
- **Verification:** Native dark + 1.3 run passed.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-039

- **Work order:** WO-006
- **Severity:** INFO
- **Type:** PERFORMANCE
- **Status:** OPEN
- **Summary:** Switching Seller Profile tabs refetches the tab and loses its scroll position (each tab unmounts; gcTime 0 by design for public reads).
- **Expected:** Acceptable for now; could keep tabs mounted.
- **Actual:** One request per switch.
- **Reproduction:** Switch Products -> Reviews -> Products.
- **Evidence:** review Low
- **Root cause:** Freshness-first cache policy.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** Extra requests on metered data.
- **Founder decision required:** No
- **Recommended resolution:** Keep tabs mounted (or a short gcTime) if usage shows frequent switching.

### ON-20261111-040

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** TEST_GAP
- **Status:** RESOLVED
- **Summary:** Review found weak tests: a vacuous products tiebreak, no crafted cursors, no rounding case, no draft exclusion, a mobile 'paged' reviews test that never paged, untested pull/dedup/later-page 404.
- **Expected:** Tests that fail on regression.
- **Actual:** Several gaps.
- **Reproduction:** n/a
- **Evidence:** review item 7
- **Root cause:** First draft.
- **Fix and commit:** Added: one-statement products insert (slug tiebreak), crafted cursors, 5-4-4 rounding, draft exclusion, view counting, return/pull re-reads (1ed877d, 1124125).
- **Verification:** wo-006 e2e 20/20; seller-profile 15/15.
- **Remaining risk:** Mobile: de-dup across pages and a 404 on a later page remain untested (covered by the hook's logic only).
- **Founder decision required:** No
- **Recommended resolution:** Add hook-level tests for usePublicList.
- **WO-007A (11 November 2026):** Shared-list tests added (shop.test.tsx, seller-profile.test.tsx): failed next page with retry, a pull keeping items while it loads, a slow older pull never replacing a newer one, a session ending mid-browse re-reading as a guest, a later-page 404 clearing the profile (2000d1c, f63f65a, 45811df).

### ON-20261111-041

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** TEST_FLAKE (carried OVN-047)
- **Status:** OPEN
- **Summary:** In parallel full API runs, auth suites intermittently get 429 instead of 202 on POST /v1/auth/otp/request (c6, t8, wo-api-001a, wo-sec-001 in run 1; t12-d89 in run 2 of the WO-006 battery).
- **Expected:** Each suite's OTP requests stay within its own budget.
- **Actual:** WO-006 battery: run 1 872/876, run 2 875/876; every failure an OTP 429 (e.g. wo-sec-001:302 expected 202 x14, got 429). The same five suites in band: 86/86.
- **Reproduction:** pnpm --filter @adulis/api test (parallel workers); intermittent, different suites each run.
- **Evidence:** scratchpad v006/api-test.log, v006/pnpm-test.log; register OVN-047
- **Root cause:** Known: t13 lowers the platform-wide OTP ceiling while other auth suites run in parallel workers (OVN-047, re-diagnosed on 10 Nov). Shared platform budget, not product code; WO-006 changed no auth code.
- **Fix and commit:** Not fixed in this batch (auth test infrastructure).
- **Verification:** Failing suites pass alone (86/86). Final batch battery (on 7503e5a): did not recur in either full run (API 884/884 twice); not fixed, so it stays OPEN.
- **Remaining risk:** Red full runs that hide a real auth regression.
- **Founder decision required:** No
- **Recommended resolution:** Run t13 in its own serial project, or give it a private Market/platform budget in tests.

### ON-20261111-042

- **Work order:** WO-007
- **Severity:** MEDIUM
- **Type:** UX_QUALITY (review M1)
- **Status:** RESOLVED
- **Summary:** The Shop grid used the 160 px thumbnail derivative, upscaled about 3x in a two-column tile and visibly softer than the same ProductTile on the Seller Profile (card derivative).
- **Expected:** One tile, one image quality, wherever it appears.
- **Actual:** GET /v1/shop/products returned thumb_key; the Seller Profile Products list returns image_key (card, 640 px).
- **Reproduction:** Open a Product with an image in Shop and on its Seller Profile on a 2.75x device.
- **Evidence:** apps/console/src/features/catalogue/Media.tsx:46-48 (thumb 160, card 640); storefront.controller.ts Shop subquery; independent review of bce772b..574bddc
- **Root cause:** The thumbnail was chosen for low data without checking the derivative's size against the tile.
- **Fix and commit:** Shop returns image_key (card) like the Seller Profile list (ad06f70); contract regenerated (4ff5f9d); mobile passes it straight through and the test asserts the card URI (9beeaec).
- **Verification:** wo-007-shop 8/8; mobile 220/220 (image URI asserted); native shop.yaml PASS.
- **Remaining risk:** None for quality. A 640 px card per tile costs more data than a thumbnail; if a low-data rule is wanted it is a design decision, not made here.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-043

- **Work order:** WO-007
- **Severity:** MEDIUM
- **Type:** CORRECTNESS (review M2)
- **Status:** RESOLVED
- **Summary:** On a fresh install the Shop could read before the first bootstrap registered the device (the guest's Market), get an empty page and keep showing 'No Products' until a pull or a 5-minute background return.
- **Expected:** A new install's first Shop read happens with its Market known.
- **Actual:** The Shop read raced POST /v1/devices + GET /v1/bootstrap; requesterMarket() was null and the server answered {data:[], next_cursor:null}.
- **Reproduction:** Fresh install, open or deep-link /shop before bootstrap completes (or offline, then reconnect).
- **Evidence:** apps/mobile/src/api/bootstrap.ts useBootstrap (ensureDeviceRegistered); shop.tsx; review
- **Root cause:** The Shop list was enabled independently of the bootstrap that registers the device.
- **Fix and commit:** The Shop read waits for the first bootstrap attempt to settle (9beeaec); test 'a new install reads the Shop only after the first bootstrap'.
- **Verification:** mobile 220/220 incl. the new test (no Shop request while bootstrap is held; one after release); native shop.yaml with clearState PASS.
- **Remaining risk:** If the first bootstrap FAILS (offline, registration error) the Shop still reads and, for an unregistered device, gets the same empty page; a pull recovers. The server sends the same payload for 'no Market evidence' and 'empty Market', so the client cannot tell them apart.
- **Founder decision required:** No
- **Recommended resolution:** Optionally an additive response signal for 'no Market' in a later API work order.
- **WO-007A (11 November 2026):** Completed beyond the first-bootstrap race: GET /v1/shop/products adds market_resolved; the Shop reads only after a SUCCESSFUL bootstrap and distinguishes bootstrap or device-registration failure (retry), offline (paused, resumes), unresolved Market (retry re-places the device; a pull does the same) and a genuinely empty Market. Never another Market. Verified in shop.test.tsx (the four Market tests fail against the WO-007 code) and natively (shop-no-market-1/2: unresolved Market -> message -> retry re-places the device; shop-offline-1/2: API unreachable -> offline + retry -> recovery; all PASS on Android).

### ON-20261111-044

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** TEST_GAP (review L2)
- **Status:** RESOLVED
- **Summary:** Shop API tests did not exercise the id tiebreak, a realistic hidden Seller, or a device in an inactive Market; the index test explained a simplified statement.
- **Expected:** Negative and boundary cases covered.
- **Actual:** All fixture published_at values differed; only a DRAFT Seller was hidden; no SUSPENDED-Market device; EXPLAIN without joins or keyset predicate.
- **Reproduction:** Read apps/api/test/wo-007-shop.e2e.spec.ts at 574bddc.
- **Evidence:** review L2
- **Root cause:** First-pass test design.
- **Fix and commit:** ad06f70: three Products at one published_at walked one per page (no repeat or gap, id order); SAFETY_SUSPENDED Seller with a PUBLISHED Product excluded; device in the SUSPENDED Market gets an empty page; EXPLAIN of the real statement shape with a cursor.
- **Verification:** wo-007-shop 8/8.
- **Remaining risk:** The EXPLAIN test restates the statement shape; it does not execute the controller's own SQL.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-045

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** CODE_QUALITY (review L1, L3)
- **Status:** RESOLVED
- **Summary:** The Seller link used a literal 44 instead of the touch-target token; a Shop test comment claimed an image check it did not make.
- **Expected:** Theme tokens only; tests assert what they say.
- **Actual:** SellerProfile.tsx minHeight: 44; shop.test.tsx asserted only the query.
- **Reproduction:** Read the files at 574bddc.
- **Evidence:** review L1, L3
- **Root cause:** Oversight.
- **Fix and commit:** theme.touchTarget; product-photo testID and URI assertion (9beeaec).
- **Verification:** mobile typecheck, lint, 220/220.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-046

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** DOCUMENTATION (review L4)
- **Status:** RESOLVED
- **Summary:** ADU-DB-01 v1.23 S30f cited docs/mobile/WO-007-BUYER-SHOP-DISCOVERY.md before the file existed.
- **Expected:** Governed documents cite files that exist.
- **Actual:** Dangling reference between 1503cfc and the WO-007 record commit.
- **Reproduction:** ls docs/mobile at 9beeaec.
- **Evidence:** review L4
- **Root cause:** The record is written at the end of the work order.
- **Fix and commit:** The WO-007 record is committed on the same branch (see the record's commit).
- **Verification:** File present at the branch HEAD.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-047

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** TEST_HARNESS
- **Status:** RESOLVED
- **Summary:** First native run: refresh-3, the Dark/1.3 re-run and the scene-explorer regression failed because the harness's republish of the Clay cup was refused (409 LEVEL_LIMIT_REACHED, cap 10, published 35).
- **Expected:** Fixtures that stay within the product's own limits.
- **Actual:** The 32 page-filling Products were inserted for the fixture Seller, a NEW-level Seller, so fn_publish_product correctly refused the republish and the three flows that expect the cup failed.
- **Reproduction:** maestro-007 logs of the first run; cat001-op.mjs publish cup after wo007-fixtures-extra (first version).
- **Evidence:** Scratchpad wo007-native.out (first run): 'POST /v1/seller/products/.../publish -> 409 ... LEVEL_LIMIT_REACHED ... cap 10, published 35'.
- **Root cause:** Harness design; the product behaved correctly (the publication cap held).
- **Fix and commit:** The filler Products moved to a second fixture Seller, 'Fixture Pottery' (which also exercises mixed Sellers); database rebuilt; full native set re-run.
- **Verification:** Second run: all 11 flows PASS (shop, refresh-1..3, auth-request, sign-in, shop-signed-in, shop-dark-large, seller-profile, scene-explorer, product-1).
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-048

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** ACCESSIBILITY / RENDERING
- **Status:** RESOLVED
- **Summary:** On Android in Dark mode at font scale 1.3, some Shop tiles' Seller line rendered without its underline while others kept it.
- **Expected:** Every Seller link carries the same non-colour cue.
- **Actual:** shop-dark-large screenshot shop-04-end: top row and 'Shop item 03' Seller lines not underlined; 'Shop item 02' and '01' underlined. All four underlined in the light run.
- **Reproduction:** maestro shop.yaml with font_scale 1.3 and night mode; scroll to the end.
- **Evidence:** Scratchpad maestro-007/shop-dark-large/.../takeScreenshot/shop-04-end.png
- **Root cause:** Not investigated to the root; consistent with textDecorationLine being lost on recycled FlashList cells on Android.
- **Fix and commit:** None.
- **Verification:** The link role and its 'View <store>' label are present on every tile (Maestro selected them by id); only the visual underline varies.
- **Remaining risk:** Sighted users see some Seller lines distinguished by secondary colour only (a non-colour cue missing).
- **Founder decision required:** No
- **Recommended resolution:** A follow-up: give the Seller line a non-text cue that survives recycling (an icon or a 'Sold by' prefix), then re-validate natively.
- **WO-007A (11 November 2026):** The tile's Seller line reads "Sold by {store}" (buyer.product.seller) with no underline; the visible words are the accessible name, "View {store}" the hint (label in name, as on the Product). Verified: shop.test.tsx; native: shop.yaml asserts the worded cue on recycled cells (page 2), PASS in Light at 1.0 and Dark at 1.3; screenshot shows the Seller line of every tile wrapping as "Sold by Fixture Pottery".

### ON-20261111-049

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** PRODUCT_SCOPE / MISSING_DATA
- **Status:** OPEN
- **Summary:** Shop category browsing, Locally Made, Discounts and New Drops modules are not built: no Buyer-facing category taxonomy exists and no rule defines those modules' membership.
- **Expected:** Category entry points backed by real, governed data.
- **Actual:** core.category has only id, parent_id, code, created_at (no labels, no locale strings, one seed row); no discount or 'locally made' attribute is defined for Buyer display.
- **Reproduction:** \d core.category on the disposable database.
- **Evidence:** Disposable DB introspection 11 Nov; shop.tsx header comment; batch rule 'Do not fabricate Fashion/Cosmetics/Electronics database categories'.
- **Root cause:** The taxonomy and the module rules are undefined, not unimplemented.
- **Fix and commit:** None (deliberately not built). The Shop is one honest list; Home's Locally Made and Discounts channels keep their placeholders; the header's Search entry is unchanged (no Marketplace Search).
- **Verification:** Mobile test asserts no Fashion/Cosmetics/Electronics/Sort/Filter/Add to cart controls; native shop.yaml asserts no Fashion/Add to cart/Filter.
- **Remaining risk:** The Shop is less browsable than the prototype until a taxonomy exists.
- **Founder decision required:** No (direction decided 11 November 2026); the taxonomy itself comes from the Catalogue taxonomy work order
- **Recommended resolution:** A catalogue taxonomy work order before any category UI.
- **WO-007A (11 November 2026):** Policy direction APPROVED: initial top-level groups Fashion, Cosmetics, Electronics. Implementation: recorded only (as directed); no category, module or assignment built. Further engineering: the Catalogue taxonomy work order (definitions, subcategories, labels, localisation, Market enablement, classification) and membership rules for Locally Made, Discounts, New Drops. Further legal/privacy authorisation: none.
- **WO-008:** Marketplace Search launches without category facets for the same reason; no category was fabricated.
- **WO-010 (11 November 2026):** Status PARTIALLY RESOLVED.
  - Implemented and tested: the three approved top-level categories (migration 0062, fixed ids, label keys, order; ADU-DB-01 v1.27), Market availability (runbook Step 6 per Market; dev seed), the Product classification guard, `GET /v1/categories` (Market-scoped), Shop category browsing and the Search Product category filter (server-side, cursors bound to the category), Mobile category tabs.
  - Awaiting founder decisions: subcategories, attribute definitions, classification of existing Products, Locally Made / Discounts / New Drops membership. Not built.
  - Records: `docs/mobile/WO-010-CATALOGUE-CATEGORIES.md`, `docs/mobile/WO-010-BUYER-CATEGORY-DISCOVERY.md`.

### ON-20261111-050

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** PRODUCT_RULE
- **Status:** RESOLVED
- **Summary:** Shop order is a provisional deterministic order, newest first publication (published_at DESC, id DESC), labelled 'Newest first'; no document defines the Shop's ordering.
- **Expected:** A founder-defined Shop order.
- **Actual:** Newest first publication. Republishing keeps the first published_at (fn_publish_product: coalesce(published_at, now())), so unpublish/republish cannot bump a Product to the top; an unavailable Product stays listed in place, labelled.
- **Reproduction:** GET /v1/shop/products; db/migrations/0020_unpublish_product.sql:115.
- **Evidence:** wo-007-shop tests; native refresh-3 (republished Clay cup kept its place).
- **Root cause:** No ordering rule in the pack for a Market-wide Product list.
- **Fix and commit:** None needed now; the order is honest and labelled.
- **Verification:** API and native tests above.
- **Remaining risk:** Newer Sellers' Products dominate the top; no 'available first' (compare ON-20261111-026).
- **Founder decision required:** No (decided 11 November 2026)
- **Recommended resolution:** Keep 'Newest first' until a ranking design exists; never introduce an unlabelled order.
- **WO-007A (11 November 2026):** Policy APPROVED: keep Newest first (published_at DESC, id DESC). Implementation: already the behaviour. Further engineering: none until a ranking design is approved.

### ON-20261111-051

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** API_DESIGN
- **Status:** OPEN
- **Summary:** The Shop cursor carries the Product id as its tiebreaker, unlike the WO-006 lists, which avoid internal UUIDs in list URLs.
- **Expected:** Opaque cursors that disclose nothing beyond the page.
- **Actual:** The cursor tuple is (published_at at microseconds, product id). The id is already in every Shop row (PublicProductSummaryDto.id), so nothing new is disclosed; slugs are unique only per Seller, so no other unique public key exists.
- **Reproduction:** Base64url-decode a Shop next_cursor.
- **Evidence:** storefront.controller.ts shopProducts; WO-006 record S4
- **Root cause:** No Market-wide public Product reference exists.
- **Fix and commit:** None.
- **Verification:** Forged well-formed cursors only move within the requester's Market (review).
- **Remaining risk:** If the public summary ever drops id, the cursor would become the only place it travels.
- **Founder decision required:** No
- **Recommended resolution:** Revisit if a public Product reference is introduced.

### ON-20261111-052

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** CLEANUP
- **Status:** RESOLVED
- **Summary:** The locale key buyer.shop.coming ('Shopping by category arrives in a coming update.') is no longer used by the app.
- **Expected:** No dead catalogue strings.
- **Actual:** Key remains in packages/locale (en, am).
- **Reproduction:** grep -r buyer.shop.coming apps/mobile/src returns nothing.
- **Evidence:** packages/locale/src/en.ts:315
- **Root cause:** Removing a key is a packages/locale change in its own commit; left to avoid churn.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** None functional.
- **Founder decision required:** No
- **Recommended resolution:** Remove in the next packages/locale change.
- **WO-007A (11 November 2026):** buyer.shop.coming removed (en + am) with the four unused buyer.review.badge.* labels; MT-KEYS regenerated (1f54346).

### ON-20261111-053

- **Work order:** WO-007A
- **Severity:** MEDIUM
- **Type:** CONTRACT_GAP (release blocker)
- **Status:** OPEN
- **Summary:** No authoritatively verified payment exists, so no Review can meet REV-01 and none is public.
- **Expected:** REV-01 S1-S2: both bases need provider/backend-verified payment.
- **Actual:** Payment is a Buyer screenshot confirmed by the Seller (0012: "Adulis NEVER asserts a payment is genuine"); K-1 retires that as payment truth.
- **Reproduction:** GET /v1/storefronts/{handle}/reviews returns an empty page for every Seller.
- **Evidence:** 0012 core.payment_submission; DOCUMENT_AUTHORITY K-1; 0058 core.fn_order_payment_verified
- **Root cause:** The payment model is the legacy manual-transfer one until WO-PAY-001.
- **Fix and commit:** Fail closed: core.fn_order_payment_verified answers false (50ce32b). Nothing fabricated.
- **Verification:** wo-007a-reviews "as built" half; native curl and seller-profile flow.
- **Remaining risk:** Public Reviews stay absent from every Seller Profile until WO-PAY-001.
- **Founder decision required:** Yes -- the payment architecture itself (deferred by the founder, 11 November 2026)
- **Recommended resolution:** WO-PAY-001 replaces the body of core.fn_order_payment_verified with a read of its provider-verified fact.
- **WO-007B (11 November 2026):** Founder decision: payment architecture DEFERRED -- no decision yet on a payment gateway; future research to compare direct Seller transfers, independent verification, provider integrations, cost, compliance and operations. Until a separate work order: no provider, no gateway, no WO-PAY-001, no change to payment verification or workflows, no Checkout, no public Reviews, no weakening of payment or Review gates, nothing new on the Seller-confirmed screenshot model. The fail-closed state is preserved (core.fn_order_payment_verified answers false).

### ON-20261111-054

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** The Review write path predates REV-01: POST /v1/orders/{id}/review accepts any terminal Order (cancelled and expired included), derives a legacy badge and accepts item ratings for any Product of the Order, with no Grant.
- **Expected:** REV-01 S14-S22: a server-authoritative eligibility resolver, one Grant per Seller Order, received-line item ratings only, atomic publication.
- **Actual:** reviews.controller.ts createReview; no review_grant table.
- **Reproduction:** POST a review on a CANCELLED_BY_BUYER Order: 201, badge UNVERIFIED.
- **Evidence:** apps/api/src/modules/reviews/reviews.controller.ts; 0014
- **Root cause:** Built before REV-01 v3.x.
- **Fix and commit:** None (out of scope: no Review writing in WO-007A). Such rows are never public (0058).
- **Verification:** n/a
- **Remaining risk:** Stored history accumulates non-REV-01 rows; never public.
- **Founder decision required:** No
- **Recommended resolution:** A Reviews work order implementing REV-01 phases 2-3 (Grant, resolver, received-line guard) before any Buyer review UI.

### ON-20261111-055

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** Only QR receipt exists: no OTP or Manual final receipt, and no delegate receipt.
- **Expected:** REV-01 S7: QR, OTP or governed Manual receipt, Buyer or authorised delegate.
- **Actual:** core.handoff_scan is the Buyer's own QR scan (FK to the Order Buyer).
- **Reproduction:** n/a
- **Evidence:** 0013 core.handoff_scan
- **Root cause:** Handoff domain not yet built to the November design.
- **Fix and commit:** None. 0058 reads VALID/LATE handoff_scan as FINAL_HANDOFF.
- **Verification:** n/a
- **Remaining risk:** OTP/Manual receipts, when built, need adding to the view's FINAL_HANDOFF term.
- **Founder decision required:** No
- **Recommended resolution:** Handoff work order; extend core.v_review_public with the new receipt facts.

### ON-20261111-056

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** SPEC_GAP
- **Status:** OPEN
- **Summary:** VERIFIED_ORDER_FAILURE is read as an UPHELD Claim with trigger GOODS_NOT_RECEIVED or REFUND_NOT_DELIVERED; core.claim has no Seller-fault attribute, and line-scoped Claims count.
- **Expected:** REV-01 S1: an upheld Seller-fault Claim establishing eligible non-delivery or an unpaid/refused/overdue remedy.
- **Actual:** The two triggers REV-01 names literally; fault is implied only by the forced demotion an upheld Claim causes.
- **Reproduction:** n/a (no Review is public today).
- **Evidence:** 0058 view; 0014 core.claim; independent review finding 5
- **Root cause:** Claims domain has no liable-party or decision-type column.
- **Fix and commit:** Narrow literal reading, recorded; not live until verified payment exists.
- **Verification:** wo-007a-reviews: upheld NOT_AS_DESCRIBED without receipt is excluded; receipt + upheld non-delivery is FINAL_HANDOFF.
- **Remaining risk:** An upheld Claim whose fault was not the Seller's could support Seller-service feedback once payment is verified.
- **Founder decision required:** No (decided 11 November 2026: approved for future implementation)
- **Recommended resolution:** Add a fault/decision type to Claims and key the failure basis on it before WO-PAY-001 goes live.
- **WO-007B (11 November 2026):** Founder decision: an upheld Claim trigger alone does NOT establish Seller fault. The future Claims system must record an explicit, authoritative Seller-fault determination with evidence and correction history, and Reviews must use it. Policy approved; implementation deferred to the Claims and Reviews work orders (nothing built now). The 0058 trigger mapping stays inert because no Review is public (ON-20261111-053).

### ON-20261111-057

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** SPEC_GAP
- **Status:** OPEN
- **Summary:** Self-review exclusion (Order Buyer is the Seller's owner or a live team member) is evaluated at read time.
- **Expected:** REV-01 S50: "Seller-owner self-review conflict -> excluded/rejected according to policy" (the policy is not defined).
- **Actual:** After an ownership transfer or a revocation, a former owner's or member's Review can become public, and a new owner's earlier purchases disappear.
- **Reproduction:** n/a (no Review is public today).
- **Evidence:** 0058 view; independent review finding 6
- **Root cause:** No policy defines the conflict or its point in time.
- **Fix and commit:** Fail-closed reading recorded; revoked members' Reviews are eligible, live members' are not (tested).
- **Verification:** wo-007a-reviews liveTeam excluded, revokedTeam included, self excluded.
- **Remaining risk:** Edge cases around ownership changes.
- **Founder decision required:** No (decided 11 November 2026: approved for future implementation)
- **Recommended resolution:** Snapshot the relationship at Order time (e.g. on the Grant) once the policy exists.
- **WO-007B (11 November 2026):** Founder decision: Review eligibility evaluates Seller ownership/team conflicts at Order creation and at Review submission, recording the authoritative relationship at that time; later team or ownership changes do not automatically rewrite the original determination; authorised fraud/moderation corrections remain possible. Policy approved; implementation deferred to the Reviews work order. The 0058 read-time check stays inert meanwhile (no Review is public).

### ON-20261111-058

- **Work order:** WO-007A
- **Severity:** INFO
- **Type:** FUTURE_INTEGRATION
- **Status:** OPEN
- **Summary:** The independent review flagged the Trust ladder averaging all core.review rows; the live ladder (0028) reads no rating at all.
- **Expected:** REV-01 S37: Trust consumes only permitted Review facts.
- **Actual:** 0010's fn_recompute_seller_level read avg(seller_rating) from core.review; 0028 replaced it and established_min_avg_rating is "READ BY NOTHING at MVP".
- **Reproduction:** SELECT prosrc FROM pg_proc WHERE proname = 'fn_recompute_seller_level' -- no seller_rating.
- **Evidence:** 0010:321; 0028:425
- **Root cause:** Historical code path, superseded.
- **Fix and commit:** None needed now.
- **Verification:** Live function source checked on the disposable database.
- **Remaining risk:** A future rating-based Trust rule could read core.review again.
- **Founder decision required:** No
- **Recommended resolution:** Any Trust rule that reads ratings reads core.v_review_public (handoff document S3).

### ON-20261111-059

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** A Claim decision correction is a bare UPDATE of core.claim.outcome; no correction record, no review.eligibility_changed event.
- **Expected:** REV-01 S25, S29: overturned findings re-evaluate eligibility with auditable correction lineage and an outbox event.
- **Actual:** The view follows the current outcome live (list and aggregate together), but nothing records the change.
- **Reproduction:** UPDATE core.claim SET outcome = 'NOT_UPHELD' on an upheld Claim.
- **Evidence:** 0014 core.claim (decision effects fire only NULL -> outcome)
- **Root cause:** Claims correction workflow not built.
- **Fix and commit:** None (no new event infrastructure, as directed).
- **Verification:** wo-007a-reviews: an overturned Claim leaves the list and the aggregate together.
- **Remaining risk:** Corrections are not audited.
- **Founder decision required:** No
- **Recommended resolution:** Claims work order: governed decision correction and the REV-01 S29 producer contract.

### ON-20261111-060

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** LIMITATION
- **Status:** OPEN
- **Summary:** The fixed-currency trigger re-reads after its lock wait only under READ COMMITTED, and its lock pauses Product writes while a currency change is uncommitted.
- **Expected:** Race-safe under any isolation; short administrative transactions.
- **Actual:** A REPEATABLE READ session keeps its first snapshot; an idle uncommitted currency change blocks every Product write.
- **Reproduction:** Two psql sessions in REPEATABLE READ.
- **Evidence:** 0059; independent review findings 3, 4
- **Root cause:** Snapshot semantics; the lock is what makes READ COMMITTED safe.
- **Fix and commit:** Lock mode changed to SHARE ROW EXCLUSIVE (changes queue, no deadlock) (26b9d04); the limit is documented in 0059 and DB-01 S30g.
- **Verification:** wo-007a-reviews: two race orders and two queued changes, each waiting on a real lock.
- **Remaining risk:** Only an operator session in a non-default isolation level, or left open, is affected; no API path writes a Market currency.
- **Founder decision required:** No
- **Recommended resolution:** Keep currency changes in short READ COMMITTED transactions (the repricing procedure, when written).

### ON-20261111-061

- **Work order:** WO-007A
- **Severity:** INFO
- **Type:** CONTRACT_CHANGE
- **Status:** RESOLVED
- **Summary:** Two public fields were replaced, not added: StorefrontReviewDto.badge -> evidence_basis, ReviewSummaryDto.badge_counts -> basis_counts.
- **Expected:** /v1 changes are additive (version skew).
- **Actual:** Keeping the legacy tiers would have kept the mislabel the founder ruled out.
- **Reproduction:** n/a
- **Evidence:** storefront.dto.ts; contracts/openapi.json (8779c3c)
- **Root cause:** The fields described legacy tiers, not REV-01 bases.
- **Fix and commit:** Replaced deliberately; no released client exists and the console reads only seller/reviews (checked).
- **Verification:** Contract regenerated twice, byte-identical; api-client generate:check.
- **Remaining risk:** None while the Buyer app is unreleased.
- **Founder decision required:** No
- **Recommended resolution:** None.

### ON-20261111-062

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** TEST_HARNESS
- **Status:** RESOLVED
- **Summary:** First WO-007A native run: every flow failed at Home with "Something went wrong on our side".
- **Expected:** The debug app reaches the local API.
- **Actual:** Metro was started without EXPO_PUBLIC_API_BASE_URL, so the client had no API origin (config.ts throws; shown as the generic error).
- **Reproduction:** Start Metro without the variable and open the app.
- **Evidence:** maestro-007a/shop screenshot; apps/mobile/src/api/config.ts
- **Root cause:** Harness started Metro differently from earlier runs.
- **Fix and commit:** Metro restarted with EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 and --clear; whole native set re-run.
- **Verification:** Second native run (S19 of the WO-007A record).
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-063

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** TEST_HARNESS
- **Status:** RESOLVED
- **Summary:** Fixture collisions between parallel API suites: the WO-007A suite reused the Shop suite's Market code (W7C) and phone range (+25191170700N).
- **Expected:** Each suite owns its unique keys.
- **Actual:** The Shop suite failed on market_code_key / account_phone_e164_key when the two ran together.
- **Reproduction:** Run wo-007a-reviews and wo-007-shop in parallel.
- **Evidence:** a007a-1 / a007a-3 logs
- **Root cause:** Copied fixture patterns.
- **Fix and commit:** WO-007A uses V7R/V7C/V7D and +2519117079NN (3468243).
- **Verification:** Both suites pass together (58/58) and in the full battery.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-064

- **Work order:** WO-007A
- **Severity:** MEDIUM
- **Type:** TEST_SAFETY
- **Status:** RESOLVED
- **Summary:** The WO-007A test restored a hard-coded payment-interface body; after WO-PAY-001 it would have overwritten the real body in whatever database it ran against.
- **Expected:** A test that swaps a production function puts back exactly what it found.
- **Actual:** restorePaymentOwner wrote SELECT false.
- **Reproduction:** Run the suite after WO-PAY-001.
- **Evidence:** independent review finding 2
- **Root cause:** Shortcut in the first draft.
- **Fix and commit:** Captures pg_get_functiondef before swapping and restores it; refuses to start over a leftover stand-in (3468243).
- **Verification:** Suite passes; prosrc is SELECT false after every run.
- **Remaining risk:** A killed run leaves the stand-in for this file's fixture Orders only; the next run refuses to start until the database is rebuilt.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-065

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** TEST_GAP
- **Status:** RESOLVED
- **Summary:** Review found tests that would pass with parts of the view deleted: no live/revoked team member, no rejected scan, no receipt-plus-claim precedence, race tests timed by sleep and released mid-transaction.
- **Expected:** Mutation-sensitive tests.
- **Actual:** See summary.
- **Reproduction:** n/a
- **Evidence:** independent review finding 7
- **Root cause:** First draft.
- **Fix and commit:** Fixtures added; races wait for a real lock wait (pg_stat_activity) and roll back before release (3468243).
- **Verification:** wo-007a-reviews passes; each new case targets one term of the view.
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-066

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** UX_STATE
- **Status:** RESOLVED
- **Summary:** Shop blocked states: a pull did a bare re-read instead of the retry, a bootstrap retry showed no progress, and the paused (real offline) branch was untested.
- **Expected:** A pull behaves like the retry while blocked; progress is visible; every branch tested.
- **Actual:** See summary.
- **Reproduction:** n/a
- **Evidence:** independent review finding 8
- **Root cause:** First draft.
- **Fix and commit:** onRefresh follows the retry while blocked; a retry in flight shows loading; tests for a device that starts offline and for a pull while blocked (2000d1c).
- **Verification:** shop.test.tsx 18/18.
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-067

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** ACCESSIBILITY
- **Status:** RESOLVED
- **Summary:** The Shop tile's Seller link was named "View {store}" while it shows "Sold by {store}" (WCAG 2.5.3 label in name).
- **Expected:** The accessible name contains the visible words.
- **Actual:** accessibilityLabel replaced the visible text.
- **Reproduction:** Voice control: "tap Sold by Store 1" finds nothing.
- **Evidence:** independent review finding 9
- **Root cause:** Label kept from the underline version.
- **Fix and commit:** Visible words are the name, "View {store}" the hint, as on the Product and Scene Explorer (2000d1c).
- **Verification:** shop.test.tsx: link found by "Sold by ..." with the hint.
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-068

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** PROCESS
- **Status:** OPEN
- **Summary:** The branch carries packages/locale and packages/api-client commits alongside app commits.
- **Expected:** packages/* changes go in their own PR (root CLAUDE.md, collision surfaces).
- **Actual:** They are separate commits on one branch (1f54346 locale; 8779c3c generated contract and client), as in the earlier branches.
- **Reproduction:** git log fe7ffb2..HEAD
- **Evidence:** independent review finding 10
- **Root cause:** Stacked branches without PRs (no PRs in this work order).
- **Fix and commit:** Kept as separate commits so they can be split.
- **Verification:** n/a
- **Remaining risk:** None until integration.
- **Founder decision required:** No
- **Recommended resolution:** Split the packages commits into their own PR when the branch is integrated.
- **WO-007B / WO-008:** the same pattern continues: 393b8cf (packages/locale) and e7fbace, 36fb3b1 (generated contract and client) are separate commits on the app branches, to split into their own PR at integration.

### ON-20261111-069

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** TEST_HARNESS
- **Status:** RESOLVED
- **Summary:** The first Dark + 1.3 runs of shop.yaml and seller-reviews-verified.yaml failed at the Shop tab tap.
- **Expected:** The tab opens on the first tap.
- **Actual:** Once a debug-build LogBox toast (Metro restarted under a running dev app) covered the tab bar; once the first tab tap after the font-scale change was swallowed. Both are known Android/debug-build quirks.
- **Reproduction:** Change font_scale, launch, tap Shop at once.
- **Evidence:** maestro-007a/shop-dark-large and dark-shop screenshots
- **Root cause:** Emulator and debug-build behaviour, not the app.
- **Fix and commit:** The flows tap the tab until it lands (repeat while notVisible); a harness-only copy also dismisses a dev toast. Re-run: both PASS in Dark at 1.3; the committed flows PASS again at 1.0 (d94e365).
- **Verification:** S19 of the WO-007A record.
- **Remaining risk:** None for release builds (no LogBox).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-070

- **Work order:** WO-007A
- **Severity:** LOW
- **Type:** TEST_ISOLATION (pre-existing)
- **Status:** OPEN
- **Summary:** The final battery's first full API run failed one test: e2-e6.jobs "stock.confidence_nudge nudges a stale variant once per window" saw 5 nudges on its second run instead of 0.
- **Expected:** The second run inside the window nudges nothing.
- **Actual:** stockConfidenceNudge scans every variant in the database (no Market or Seller scope); a parallel suite (wo-006 creates exactly 5 variants) inserted stale variants between the test's two runs, and they were nudged once, correctly.
- **Reproduction:** Run the full API suite in parallel workers; the window between the two job runs must overlap another suite's variant inserts. Alone, the suite passes.
- **Evidence:** v007a/api-test.log; apps/api/src/jobs/e3-trust-stock.ts (global SELECT on core.v_stock_confidence); e2-e6.jobs.spec.ts:574-578
- **Root cause:** A global job asserted with a global count in a shared database. WO-007A changes no stock, variant or job code; its new suite changed worker scheduling.
- **Fix and commit:** None (outside WO-007A; the test is not weakened).
- **Verification:** e2-e6.jobs alone 24/24 twice; full run 2 901/901; full run 3 901/901.
- **Remaining risk:** An intermittent red in parallel full runs.
- **Founder decision required:** No
- **Recommended resolution:** Assert on the test's own variant (its notification count stays 1 after the second run), or give the job test its own database.

### ON-20261111-071

- **Work order:** WO-007B
- **Severity:** LOW
- **Type:** PERFORMANCE_LIMIT
- **Status:** OPEN
- **Summary:** Available-first ordering evaluates price and availability for the Seller's whole published catalogue on every page.
- **Expected:** Bounded per-page work.
- **Actual:** The phase is computed, so the index on display order can no longer stop the read early; each page prices every published Product of that Seller, then takes the page.
- **Reproduction:** EXPLAIN on a 1,000-Product Seller.
- **Evidence:** WO-007B record S6 (2.7 ms execution, 0.7 ms planning on the disposable database); independent review finding 5
- **Root cause:** Founder option A computes availability live rather than storing it.
- **Fix and commit:** None (accepted; measured and documented).
- **Verification:** WO-007B measurement.
- **Remaining risk:** Linear in one Seller's catalogue; a very large catalogue would slow its Products tab.
- **Founder decision required:** No
- **Recommended resolution:** Revisit only if a Seller catalogue reaches thousands of Products (a maintained availability column or a projection would bound it).

### ON-20261111-072

- **Work order:** WO-007B
- **Severity:** LOW
- **Type:** TEST_FIXTURE
- **Status:** RESOLVED
- **Summary:** The mobile fake API gave every Seller and Shop Product the same id, so de-duplicating by id collapsed every list to one tile.
- **Expected:** Distinct ids per Product, as the API sends.
- **Actual:** sellerProduct and shopProduct returned a fixed uuid.
- **Reproduction:** Key the Products tab by id and run seller-profile.test.tsx.
- **Evidence:** apps/mobile/src/testing/fake-api.ts
- **Root cause:** Fixtures predated id-based de-duplication.
- **Fix and commit:** productIdFor(slug) gives each fixture Product its own stable id (a5dfd2b, 0f5b039).
- **Verification:** seller-profile.test.tsx, shop.test.tsx, search.test.tsx pass.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-073

- **Work order:** WO-008
- **Severity:** MEDIUM
- **Type:** SECURITY_ABUSE
- **Status:** RESOLVED
- **Summary:** Marketplace Search charged its rate limit before resolving the Market: an anonymous request updated one shared bucket row, and a random device id per request inserted a new bucket row -- for requests that can never return results.
- **Expected:** No write for a request that can find nothing; rate limits keyed to real subjects.
- **Actual:** consume() ran first; an ANONYMOUS bucket existed; requesterMarket ran after.
- **Reproduction:** Flood GET /v1/search with no device, or a new random X-Adulis-Device each time.
- **Evidence:** search.controller.ts; independent review finding 1
- **Root cause:** Ordering of the rate-limit call.
- **Fix and commit:** Market resolved first; with none the answer is empty and nothing is written; then ACCOUNT or registered DEVICE is charged; the anonymous bucket removed (93ad3cb).
- **Verification:** wo-008-search: "a request that cannot find anything writes nothing"; native curl with no device.
- **Remaining risk:** A registered device can still be multiplied (ON-20261111-076).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-074

- **Work order:** WO-008
- **Severity:** MEDIUM
- **Type:** PERFORMANCE
- **Status:** RESOLVED
- **Summary:** Scene matching OR-ed the caption predicate with a correlated EXISTS on tagged Products, so the new caption trigram index could not be used for 3+ character queries.
- **Expected:** Each candidate branch served by its index.
- **Actual:** Every query read every public Scene of the Market and ran ILIKE and <% on each caption.
- **Reproduction:** EXPLAIN the Scene statement for a 3+ character query.
- **Evidence:** search.controller.ts scenes(); independent review finding 2
- **Root cause:** An OR across an indexable predicate and a correlated subquery.
- **Fix and commit:** Candidates as a UNION (caption matches; Scenes tagging a Product whose name matches through idx_product_name_trgm), banded after (93ad3cb).
- **Verification:** wo-008-search: the caption and tag predicates, as written, are served by their trigram indexes; all Scene cases pass.
- **Remaining risk:** The view still evaluates its availability EXISTS per candidate (bounded by the candidate set).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-075

- **Work order:** WO-008
- **Severity:** MEDIUM
- **Type:** CORRECTNESS
- **Status:** RESOLVED
- **Summary:** A Seller query starting with "@" matched handles only at the fuzzy band: the prefix and substring patterns were built from "@handle".
- **Expected:** "@addis" finds addis-weaves at the prefix band.
- **Actual:** The exact and fuzzy tests used the handle without "@"; the LIKE patterns used the raw query.
- **Reproduction:** Search "@addis": the Seller ranked below a prefix-band Product.
- **Evidence:** search.controller.ts band()/candidate(); independent review finding 3
- **Root cause:** Patterns computed once from the query instead of from the matched text.
- **Fix and commit:** likePatterns(text) builds the patterns from the text each column is matched with (93ad3cb).
- **Verification:** wo-008-search 2b: "@addis" puts the Seller ahead of the prefix-band Product "@addis edition"; unit test of the patterns.
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-076

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** SECURITY_ABUSE
- **Status:** OPEN
- **Summary:** The per-device Search limit can be multiplied by registering many devices.
- **Expected:** A per-network limit as well.
- **Actual:** Limits are per Account or registered device; device registration is capped platform-wide (50,000 an hour), and per-IP limits wait for trusted-proxy handling (S15.1).
- **Reproduction:** Register many devices and search from each.
- **Evidence:** search.controller.ts; bootstrap.controller.ts
- **Root cause:** No trusted client IP yet.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** A distributed client can exceed 60 searches a minute in aggregate; each query is bounded and indexed.
- **Founder decision required:** No
- **Recommended resolution:** Add a per-IP limit when the trusted-proxy work lands.

### ON-20261111-077

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** GOVERNANCE
- **Status:** RESOLVED
- **Summary:** The search threshold set_config contradicted the written rule that only withRequestContext calls set_config.
- **Expected:** One audited place for set_config.
- **Actual:** The controller called set_config directly.
- **Reproduction:** n/a
- **Evidence:** handler-transaction.ts, app.module.ts; independent review finding 6
- **Root cause:** New tolerance setting.
- **Fix and commit:** setWordSimilarityThreshold in request-context.ts (the audited file); both comments name the exception (93ad3cb).
- **Verification:** Typecheck; Search tests.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-078

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** PERFORMANCE
- **Status:** RESOLVED
- **Summary:** Queries made only of punctuation or symbols gave the trigram index nothing to narrow on.
- **Expected:** Refused before any scan.
- **Actual:** Accepted and scanned.
- **Reproduction:** GET /v1/search?q=!!
- **Evidence:** independent review finding 4
- **Root cause:** No letter/digit requirement.
- **Fix and commit:** 400 QUERY_NO_TERMS unless the query has a letter or digit (93ad3cb).
- **Verification:** search.logic.spec; wo-008-search; native curl 400.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-079

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** OPEN_POLICY
- **Status:** FOUNDER_REVIEW_REQUIRED
- **Summary:** Search launch thresholds are provisional technical values, not product decisions.
- **Expected:** Thresholds approved by an authority (SRC-01 S13 leaves the launch configuration "bounded/versioned without an unsupported fixed numeric formula").
- **Actual:** Minimum 2 characters; substring and fuzzy from 3; pg_trgm word similarity 0.5; Top caps 6 Products, 3 Sellers, 3 Scenes; page 20 (max 50); 60 searches a minute per Account or device; equal relevance ordered by a stable id.
- **Reproduction:** n/a
- **Evidence:** search.logic.ts (SEARCH_ALGORITHM_VERSION lexical-trgm-v1); WO-008 record S5
- **Root cause:** No numeric launch configuration in the design pack.
- **Fix and commit:** Values chosen, documented and versioned; any change bumps algorithm_version.
- **Verification:** n/a
- **Remaining risk:** Ranking may need tuning on real queries.
- **Founder decision required:** Yes -- confirm or set the launch thresholds.
- **Recommended resolution:** Confirm, then measure zero-result rate and reformulations once telemetry is approved (ON-20261111-080).

### ON-20261111-080

- **Work order:** WO-008
- **Severity:** INFO
- **Type:** DEFERRED_PRIVACY
- **Status:** OPEN
- **Summary:** Search telemetry and attribution (search_session_id, query_id, search_performed, search_zero_results, result impressions/opens) are not built.
- **Expected:** SRC-01 S23 lists them; WO-008 S18 forbids unapproved processing.
- **Actual:** No event, identifier or raw query is stored or logged.
- **Reproduction:** n/a
- **Evidence:** WO-008 record S6
- **Root cause:** The processing needs a PRV-01/DPIA-01 approved basis and retention.
- **Fix and commit:** Deferred by design.
- **Verification:** search.test.tsx: no analytics call; API has no event write.
- **Remaining risk:** No measurement of zero-result rate or relevance quality yet.
- **Founder decision required:** Yes -- approve (or not) Search analytics processing and its retention.
- **Recommended resolution:** Decide the privacy basis; then add query-id telemetry without raw query text in general analytics.

### ON-20261111-081

- **Work order:** WO-008
- **Severity:** INFO
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** Explicit browse Market (country) switching in Search is not implemented.
- **Expected:** SRC-01 S6, S10: a supported activated Market may be selected; the result corpus follows.
- **Actual:** Search uses only the server-resolved Market; no country parameter is accepted.
- **Reproduction:** n/a
- **Evidence:** WO-008 record S4
- **Root cause:** No server-approved activated-Market selection contract exists (initially Ethiopia only).
- **Fix and commit:** Not invented; documented.
- **Verification:** wo-008-search: Market isolation and inactive-Market cases.
- **Remaining risk:** None while one Market is active.
- **Founder decision required:** No
- **Recommended resolution:** Add with the Market selection contract (MKT-01) when a second Market activates.

### ON-20261111-082

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** DEFERRED_SCOPE
- **Status:** OPEN
- **Summary:** Pending Search improvements: structured filters and sort whitelist, category/attribute and description matching, secondary ranking signals (Trust, popularity, conversion, freshness, Seller diversity), suggestions and synonyms, corrected-query recovery, Amharic transliteration, the Ethiopic wordspace as a word separator.
- **Expected:** SRC-01 S8, S13-S15 (several are "worth adding").
- **Actual:** Launch is lexical over names, handles and captions only.
- **Reproduction:** n/a
- **Evidence:** WO-008 record S3
- **Root cause:** Dependencies (category taxonomy ON-20261111-049, approved signals, telemetry) not yet in place.
- **Fix and commit:** Deferred; none faked.
- **Verification:** n/a
- **Remaining risk:** Recall is limited to name/handle/caption words.
- **Founder decision required:** No
- **Recommended resolution:** Schedule after the Catalogue taxonomy work order and the telemetry decision.

### ON-20261111-083

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** TEST_HARNESS
- **Status:** RESOLVED
- **Summary:** Native search.yaml: the first keystroke typed right after tapping the clear control was dropped ("zqx" for "zzqx").
- **Expected:** The typed query arrives whole.
- **Actual:** Maestro typed before the field had settled after the clear tap; the app searched what it received.
- **Reproduction:** Tap clear, then inputText at once.
- **Evidence:** maestro-008/search screenshot
- **Root cause:** Input timing in the harness, not the app.
- **Fix and commit:** The flow taps the field before typing after a clear (9ace2ba).
- **Verification:** search.yaml PASS.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-084

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** TEST_HARNESS
- **Status:** OPEN
- **Summary:** buyer-for-you.yaml (WO-004A) ran out of its 120-second scroll budget before the end of the 12-Scene feed, twice (reaching Scene 3, then Scene 2).
- **Expected:** The flow reaches the end marker within its budget.
- **Actual:** The emulator scrolled the tall cards more slowly than when the flow was written; the feed paged correctly (API: 10, then 2, then the end) and the For You code is unchanged in WO-007B/WO-008.
- **Reproduction:** Run buyer-for-you.yaml with the 12 WO-004A fixture Scenes on this emulator.
- **Evidence:** maestro-008b/for-you-3, for-you-4 screenshots; for-you-5 log
- **Root cause:** Scroll speed versus a fixed timeout, not the app.
- **Fix and commit:** A harness-only copy with a 360-second budget and the same assertions passed (336 s). The committed flow is unchanged.
- **Verification:** for-you-5 PASS; API pages checked.
- **Remaining risk:** The committed flow can time out on a slow emulator.
- **Founder decision required:** No
- **Recommended resolution:** Raise the scroll timeout or speed of that flow in a test-maintenance change.
- **WO-009A (11 November 2026):** Not run again (it needs the WO-004A fixtures on their own database). For You was exercised by its Jest suites and by `buyer-scene-explorer.yaml`, which starts in For You (PASS). Still OPEN.

### ON-20261111-085

- **Work order:** WO-008
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** In the final battery the full API suite at default parallelism lost Jest workers to out-of-memory crashes (837/940 in the first run, 927/930 inside pnpm test).
- **Expected:** A clean full run.
- **Actual:** "Fatal process out of memory: Zone" twice in run 1 and "Jest worker ran out of memory and crashed" in run 2; crashed suites skipped their afterAll, and later suites collided with the leftover rows (market_pkey, market_code_key) or saw reset connections (ECONNRESET, a 503 database-unavailable).
- **Reproduction:** Run the full API suite with default workers while the emulator, WSL, Docker and other memory-heavy applications run (2.4 GB free of 15.7 GB at the time).
- **Evidence:** v008/api-test.log lines 217, 260; v008/pnpm-test.log line 436; Postgres logged no crash or refusal; container not restarted, not OOM-killed.
- **Root cause:** Host memory pressure, not product code (every failing suite is outside WO-007B/WO-008 and passes in clean runs).
- **Fix and commit:** None in code. Re-run on a rebuilt disposable database with --maxWorkers=2: 940/940, then 940/940.
- **Verification:** api-run3-008.log, api-run4-008.log.
- **Remaining risk:** Default-parallel full runs can fail on a memory-constrained machine.
- **Founder decision required:** No
- **Recommended resolution:** Run the full API suite with fewer workers (or close other heavy applications) on this machine; consider a maxWorkers default in a test-infrastructure change.
- **WO-009A (11 November 2026):** The full API suite passed both with `--maxWorkers=2` (969/969) and at default parallelism inside `pnpm test` (969/969, mobile 278/278) on a rebuilt disposable database. Free RAM during the later native runs was 0.9 to 1.2 GB of 15.7 GB, so the pressure that caused this is still present. Still OPEN: one clean default-parallel run does not close it.

### ON-20261111-086

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** SPEC_GAP
- **Status:** RESOLVED (recorded deviation)
- **Summary:** ADU-SRC-01 v3.2 S19 lists a product_tag_id FK on core.collection_item; no surrogate Product-tag id exists.
- **Expected:** Tag provenance referencing the canonical tag.
- **Actual:** A tag is core.scene_post_product (revision_id, product_id) (0054); there is no tag id to reference.
- **Reproduction:** Read 0054_scene_posts.sql scene_post_product.
- **Evidence:** db/migrations/0054_scene_posts.sql; 0061 collection_item_origin_tag; ADU-DB-01 v1.26 S30i
- **Root cause:** The design assumed a surrogate key the schema never had.
- **Fix and commit:** Realised as the composite FK (originating_scene_revision_id, product_post_id) -> scene_post_product (revision_id, product_id): the database refuses a fabricated Scene/tag relationship (6d25064).
- **Verification:** wo-009 e2e case 30 (23503 on a forged tag row).
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Fold the composite form into SRC-01 at its next revision.

### ON-20261111-087

- **Work order:** WO-009
- **Severity:** MEDIUM
- **Type:** PRIVACY_POLICY_GAP
- **Status:** OPEN
- **Summary:** Deleting a Collection is a hard delete; SRC-01 S19 offers an optional deleted_at and no retention for deleted private Collection names is approved.
- **Expected:** An approved lifecycle for a Buyer-deleted Collection.
- **Actual:** PRV-01 v3.3 S36 and DPIA-01 PA-08 define only the Account-deletion purge; nothing says how long a deleted Collection or its name may be kept. 0061 creates no deleted_at and DELETE removes the row and its memberships.
- **Reproduction:** DELETE /v1/collections/{ref}; the row is gone.
- **Evidence:** ADU-PRV-01 v3.3 S36 (line 604), DPIA-01 PA-08 (line 253, "exact duration LEGAL REVIEW REQUIRED"); 0061 header
- **Root cause:** Retention is a privacy decision the documents leave open.
- **Fix and commit:** Data-minimising default implemented: hard delete, no restore (6d25064); recorded here rather than inventing a retention period.
- **Verification:** wo-009 e2e cases 5-6.
- **Remaining risk:** If a restore or audit window is later required, a deleted_at column and a purge job are needed.
- **Founder decision required:** Yes
- **Recommended resolution:** Confirm hard delete, or approve a soft-delete window and its purge.

### ON-20261111-088

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** POLICY_VALUES
- **Status:** OPEN
- **Summary:** Provisional technical bounds with no governing value: Collection name 1-60 characters, saved-state batch of at most 60 targets, pages of 50 Collections / 30 items; no quota or rate limit on Collections or memberships.
- **Expected:** Values from a governing document or ADU-VAL-01.
- **Actual:** None of SRC-01, MOB-02 or VAL-01 gives a number; the work order forbids inventing a quota. The independent review (D6) noted storage is bounded only by write speed, and GET /v1/collections and saved-state create the DEFAULT on first need.
- **Reproduction:** n/a
- **Evidence:** apps/api/src/modules/collections/collections.logic.ts (NAME_MAX, SAVED_STATE_MAX); 0061 collection_name CHECK
- **Root cause:** Values are business decisions the documents leave open.
- **Fix and commit:** Implemented as marked shortcuts; no cap or rate limit added.
- **Verification:** collections.logic.spec.ts; e2e cases 3, 12.
- **Remaining risk:** An abusive Account can store many rows (owner-scoped reads only slow its own pages).
- **Founder decision required:** Yes
- **Recommended resolution:** Confirm the bounds; decide whether a per-Account cap or write rate limit is wanted (RateLimitService exists).

### ON-20261111-089

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** No error code for "the DEFAULT Collection cannot be renamed or deleted"; the closed taxonomy (ADU-API-01 S7.1) admits no new code from a work order.
- **Expected:** A specific, translatable refusal.
- **Actual:** PATCH/DELETE of DEFAULT answer 400 VALIDATION_FAILED with slots.path = collectionRef. The app never offers either action for DEFAULT.
- **Reproduction:** PATCH /v1/collections/{defaultRef}.
- **Evidence:** apps/api/src/common/errors/error-catalogue.ts header; collections.service.ts rename/remove
- **Root cause:** Closed taxonomy by design.
- **Fix and commit:** Reused VALIDATION_FAILED (9e5b310).
- **Verification:** e2e cases 4, 6.
- **Remaining risk:** A future client could show a generic validation message.
- **Founder decision required:** No (API-01 amendment if a code is wanted)
- **Recommended resolution:** Add a COLLECTION_DEFAULT_IMMUTABLE code at the next ADU-API-01 revision if wanted.

### ON-20261111-090

- **Work order:** WO-009
- **Severity:** MEDIUM
- **Type:** PRODUCT_POLICY_GAP
- **Status:** OPEN
- **Summary:** A Seller may hard-delete a never-ordered, untagged Product; the saved membership then disappears instead of showing a tombstone.
- **Expected:** WO-009 S9: "tombstone when ... deleted".
- **Actual:** collection_item.product_post_id is ON DELETE CASCADE, so the membership goes with the Product. Unpublished, restricted and out-of-stock Products keep their membership and show the neutral unavailable state.
- **Reproduction:** Save a never-stocked Product; DELETE /v1/seller/products/{id}; the Collection no longer lists it.
- **Evidence:** catalogue.service.ts deleteProduct (hard delete); 0061; e2e "Product deleted by its Seller"
- **Root cause:** A hard-deleted row cannot be referenced; RESTRICT would refuse the Seller (a behaviour change outside this work order), SET NULL would break the one-target CHECK.
- **Fix and commit:** Cascade chosen so Seller deletion is never blocked (6d25064).
- **Verification:** e2e "Product deleted by its Seller".
- **Remaining risk:** The Buyer sees the item vanish rather than a tombstone for this one path.
- **Founder decision required:** Yes
- **Recommended resolution:** Accept, or approve a tombstone design (a target_type column plus nullable target, or Product soft delete).

### ON-20261111-091

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** SPEC_CONFLICT
- **Status:** OPEN
- **Summary:** SRC-01 S25 suggests "Unavailable in your current market" for a Market change; WO-009 S17 asks for one neutral sentence and no distinguishing reason.
- **Expected:** One rule for the Buyer-facing text.
- **Actual:** Implemented the work order: every unavailable cause, Market change included, shows "This Product/Scene is no longer available." with no reason.
- **Reproduction:** Change the Account Market; open Saved.
- **Evidence:** ADU-SRC-01 v3.2 S25 (line 714); WO-009 S17, S19; e2e case 31
- **Root cause:** Two sources, two wordings.
- **Fix and commit:** Work order wording followed (founder decision outranks).
- **Verification:** e2e case 31.
- **Remaining risk:** A travelling Buyer is not told why.
- **Founder decision required:** Yes
- **Recommended resolution:** Confirm the single neutral sentence or approve a Market-specific one.

### ON-20261111-092

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** SCOPE
- **Status:** OPEN
- **Summary:** Card-level Save on Shop, Search, Seller Profile and For You cards is not built ("where practical"); Save is on Product Detail and Explore the Scene.
- **Expected:** Optional per WO-009 S15.
- **Actual:** POST /v1/collections/saved-state:batch exists for those lists (one request per visible page, up to 60 targets); no card calls it yet, so no list sends any per-card request.
- **Reproduction:** n/a
- **Evidence:** apps/mobile/src/buyer/SaveButton.tsx; collections.controller.ts savedState
- **Root cause:** Prioritised the two required surfaces.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** A small follow-up: a SaveToggle on the shared tiles fed by one batch per page.
- **WO-009A (11 November 2026):** Status RESOLVED. Card-level Save on Shop Product cards, Search Top rows (Products and Scenes, never Sellers) and the Products and Scenes grids, and Seller Profile Product and Scene cards. One `saved-state:batch` per page of results (at most 60 targets), never per card; guests read nothing. For You cards stay without Save (WO-009A S4). Commits 76ec748, 5be3273; tests card-saves.test.tsx (17); native card-saves flows PASS. Device request counts are in `docs/mobile/WO-009A-CARD-SAVES-SESSION-HARDENING.md` S3.

### ON-20261111-093

- **Work order:** WO-009
- **Severity:** MEDIUM
- **Type:** SECURITY
- **Status:** RESOLVED
- **Summary:** Independent review D1: POST /v1/collections answered the whole Collection, so the idempotency store kept a private name for 24 hours after the Collection or the Account was deleted.
- **Expected:** No private name retained past deletion.
- **Actual:** core.idempotency_record.response_body held CollectionDto (with name) for its 24-hour life; fn_delete_account does not purge it.
- **Reproduction:** Create a Collection, delete it, read idempotency_record.
- **Evidence:** handler-transaction.ts runIdempotent; collections.controller.ts create
- **Root cause:** A POST answer is a stored artifact.
- **Fix and commit:** POST /v1/collections answers { ref } only (b4814c8, contract f3ebfa8).
- **Verification:** e2e "stored POST answers carry no Collection name and no target content".
- **Remaining risk:** Other endpoints store their own answers by the existing design (not changed here).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-094

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** SECURITY
- **Status:** RESOLVED
- **Summary:** Independent review D2: POST .../items answered the resolved Scene (caption, image keys); a replay of the same key within 24 hours would serve it after the Scene went PRIVATE (same Account only).
- **Expected:** No content served after it stopped being public.
- **Actual:** The stored answer was a content snapshot.
- **Reproduction:** Save a Scene; make it PRIVATE; replay the key.
- **Evidence:** collections.service.ts addItem
- **Root cause:** Content resolved into a stored answer.
- **Fix and commit:** POST .../items answers the membership only (ref, collection_ref, target_type, saved_at) (b4814c8).
- **Verification:** e2e cases 21-22, 25-27 and the stored-answer test.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-095

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** DATA_INTEGRITY
- **Status:** RESOLVED
- **Summary:** Independent review D3: the app kept a Save key across a lost answer; after a removal (picker or another device) the next Save replayed the old membership and drew Saved for nothing until the re-read.
- **Expected:** Saved drawn only for a real membership.
- **Actual:** Idempotency replay of a stale 201.
- **Reproduction:** Lose a Save answer, remove elsewhere, Save again.
- **Evidence:** apps/mobile/src/buyer/saved.ts, SaveToCollection.tsx
- **Root cause:** Key lifetime longer than the fact it protected.
- **Fix and commit:** A fresh key per tap and tick; the membership itself is idempotent (2dcc90f).
- **Verification:** saved.test.tsx "a refused Save ... saves once".
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-096

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** DATA_INTEGRITY
- **Status:** RESOLVED
- **Summary:** Independent review D4: originating_scene_post_id had no ON DELETE action, so a Buyer provenance row would block any future Scene purge.
- **Expected:** Provenance never blocks the owning domain.
- **Actual:** NO ACTION FK.
- **Reproduction:** Delete a saved Scene (no command exists today).
- **Evidence:** 0061
- **Root cause:** Oversight.
- **Fix and commit:** ON DELETE SET NULL; the CHECK tying the two originating columns dropped (c204739; DB-01 9b97f8a).
- **Verification:** e2e case 29 reads every referential action from pg_constraint.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-097

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** RELIABILITY
- **Status:** RESOLVED
- **Summary:** Independent review D5: a Collection or Product deleted between the checks and the INSERT, or a membership removed before the re-read, answered 500.
- **Expected:** The same 404 as before the race.
- **Actual:** 23503 (not a scope FK in the translator) became INTERNAL; an empty re-read became undefined.
- **Reproduction:** Concurrent delete during a Save.
- **Evidence:** collections.service.ts addItem
- **Root cause:** Unhandled race outcomes.
- **Fix and commit:** Mapped to NOT_FOUND (b4814c8).
- **Verification:** Code review; e2e suite 29/29.
- **Remaining risk:** None known.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-098

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** TEST_ENVIRONMENT
- **Status:** RESOLVED
- **Summary:** Mobile tests: a waitFor whose callback awaited findBy (nested waits) left the act environment off, and every later test in the file rendered nothing; separately the fake server issued the DEFAULT ref to the first named Collection.
- **Expected:** Independent tests.
- **Actual:** Cascading "Unable to find" failures after the picker test; a missing named Collection.
- **Reproduction:** Run saved.test.tsx in order.
- **Evidence:** apps/mobile/src/buyer/saved.test.tsx; testing/fake-collections.ts
- **Root cause:** Test-authoring mistakes, not product code.
- **Fix and commit:** Synchronous queries inside waitFor; fake ids start at 100 (3319049).
- **Verification:** 17/17 in order and alone.
- **Remaining risk:** The same nesting would break any suite.
- **Founder decision required:** No
- **Recommended resolution:** Never await a findBy inside waitFor.

### ON-20261111-099

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** TEST_CORRECTION
- **Status:** RESOLVED
- **Summary:** First e2e run: two expectations were wrong -- re-saving a now-hidden Scene answers 404 (the gate, by design), and a fixture Product with stock events cannot be hard-deleted by its Seller (stock_event references its Variant).
- **Expected:** Tests that state the intended behaviour.
- **Actual:** A cascade of 7 failures from one aborted test that left the Scene PRIVATE.
- **Reproduction:** Run wo-009-collections.e2e.spec.ts at its first version.
- **Evidence:** apps/api/test/wo-009-collections.e2e.spec.ts
- **Root cause:** Test fixtures and expectations.
- **Fix and commit:** Expectations corrected; the deletable Product has no stock events (9e5b310).
- **Verification:** 29/29.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-100

- **Work order:** WO-009
- **Severity:** MEDIUM
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** During native validation drive C: reached 0 MB free; Maestro and Metro died ("There is not enough space on the disk").
- **Expected:** Room for Metro, Maestro and Docker.
- **Actual:** Two state flows failed for lack of disk, not product behaviour.
- **Reproduction:** Long sessions of builds, emulator and test runs on a nearly full drive.
- **Evidence:** maestro-009/back.log, dark.log; Get-PSDrive C: 0 GB free (475.7 GB used)
- **Root cause:** Host disk pressure (Docker, SDKs, test artifacts).
- **Fix and commit:** Non-destructive: this session's old scratch outputs (58 folders) and 27 stale Maestro temp APKs (3.2 GB, 8-10 November) moved to G:\adulis-claude-scratch-archive\2026-11-11; nothing deleted. 22 GB free afterwards; the flows re-ran and passed.
- **Verification:** PASS back, dark after the move.
- **Remaining risk:** The drive can fill again.
- **Founder decision required:** Yes
- **Recommended resolution:** Free space on C: (the G: archive may be deleted at will once reviewed).
- **WO-009A (11 November 2026):** Measured (`docs/engineering/WO-009A-STORAGE-AUDIT.md`, tool `ops/scripts/adulis-storage-audit.ps1`, policy `docs/engineering/DEVELOPMENT-STORAGE-POLICY.md`):
  - C: free was 21,081,735,168 bytes before development, 7,271,710,720 after testing and 10,359,230,464 after cleanup.
  - About 0.49 GB of the 13.8 GB growth is Adulis artifacts. The rest is unattributed; the page file is the likely cause (ON-110).
  - Cleanup removed 485 Maestro driver APKs (3,066,085,337 bytes; ON-109) and this work order's Maestro output (68,528,230 bytes).
  - Still OPEN: C: ends below the policy's 10 GB floor for native batteries. Founder items: ON-110, ON-111.
- **WO-010 (11 November 2026):** Status MITIGATED.
  - Measured: stopping a long-running emulator returned about 10.6 GB of C: (ON-110).
  - Mitigation: development temporary output now goes to the external SSD (`ops/scripts/adulis-ssd-env.sh`), and the emulator is started with its temp there; its boot then cost 12.8 MB of C:.
  - Checkpoints and cleanup: `docs/engineering/WO-010-SSD-ENVIRONMENT.md`. Still OPEN as a capacity risk: C: is about 19 GB free with a 41 GB page-file ceiling.
- **WO-010A (11-12 November 2026):** Still OPEN as a capacity risk; nothing new on C:.
  - C: free 17,078,161,408 bytes at checkpoint A, 16,508,252,160 at B (after testing), 16,577,970,176 at C (after cleanup).
  - The native build (Gradle, CMake, TEMP), the shared caches, the emulator's temp and Maestro all wrote to the SSD; C:'s growth is mostly the pnpm store (+87 MB for the new Expo patches).
  - C: stayed above 15.6 GB through every native flow.

### ON-20261111-101

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** RESOLVED
- **Summary:** Stopping the background API wrapper left its node process serving the previous build on port 3000 (Windows), and the first native tab tap after a launch was swallowed.
- **Expected:** A restarted API serves the new build; taps land.
- **Actual:** Port 3000 still answered after the stop; the first Saved tap did nothing.
- **Reproduction:** Stop the wrapper task; relaunch the app and tap a tab at once.
- **Evidence:** Get-NetTCPConnection on 3000/8081; maestro-009/collections first run
- **Root cause:** Known host behaviours (memory notes).
- **Fix and commit:** Processes stopped by port before each restart; flows tap a tab until it lands (b75a9cb).
- **Verification:** All native flows PASS.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-102

- **Work order:** WO-009
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** RESOLVED (pinned)
- **Summary:** `npx expo-doctor` fetched 1.21.7, published 11 November 2026 09:48 UTC, which cannot start: "Cannot find module '@expo/env'".
- **Expected:** 20/20 checks as in WO-008.
- **Actual:** Exit 1 before any check, also with a fresh npm cache.
- **Reproduction:** `cd apps/mobile && npx --yes expo-doctor` on 11 November 2026.
- **Evidence:** v009/expo-doctor.log; expo-doctor-009b.log (fresh cache); `npm view expo-doctor time`.
- **Root cause:** Upstream packaging of expo-doctor 1.21.7 (not this repository).
- **Fix and commit:** None in code; ran the previous release `npx expo-doctor@1.21.6`: 20/20 checks passed.
- **Verification:** expo-doctor-009c.log.
- **Remaining risk:** An unpinned `npx expo-doctor` fails until upstream republishes.
- **Founder decision required:** No
- **Recommended resolution:** Pin the doctor version in any script or CI step that runs it.
- **WO-009A (11 November 2026):** `npm view expo-doctor time` still lists 1.21.7 (09:48 UTC) as the latest release. The battery ran `npx expo-doctor@1.21.6` with the G: npm cache: 20/20. Still pinned.

### ON-20261111-103

- **Work order:** WO-009A
- **Severity:** MEDIUM
- **Type:** SECURITY
- **Status:** RESOLVED
- **Summary:** A guest Save continuation whose saved-state answer was delayed past a sign-out and another Account's sign-in sent its membership POST with the newer Account's bearer.
- **Expected:** Every request of a continuation carries the credential of the sign-in that completed it, and none is sent once that session ends.
- **Actual:** POST /v1/collections/<A's DEFAULT ref>/items with "Authorization: Bearer <B>". The real API refuses it: B does not own A's Collection, so 404. No data changed, but a mutation was issued under the wrong Account.
- **Reproduction:** saved.test.tsx "25, 26": guest Save, sign in A, hold A's saved-state answers, sign out, sign in B, release.
- **Evidence:** The test failed on 379adb6 with exactly that request. apps/mobile/src/api/client.ts reads the bearer at send time, after `await deviceId()`.
- **Root cause:** The continuation used the session's shared client, which presents whichever credential is current when each request leaves.
- **Fix and commit:** SessionProvider.boundApi(credential): a client pinned to one bearer that throws SessionChanged before sending once that session is no longer current. Used by the continuation (bound to its own sign-in's credential), every one-tap Save and every saved-state read; cache writes are guarded by isCurrent() (051defe, 76ec748).
- **Verification:** saved.test.tsx 25-26 and 24; card-saves.test.tsx 26-27; native: the A-to-B switch showed B nothing of A's.
- **Remaining risk:** The picker and the Collection screen still use the shared client (ON-112).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-104

- **Work order:** WO-009A
- **Severity:** LOW
- **Type:** SECURITY
- **Status:** RESOLVED
- **Summary:** An armed guest Save stayed in memory after its sign-in was cancelled, until sign-out.
- **Expected:** A Save armed for one sign-in is completed by that sign-in or dropped.
- **Actual:** Back out of sign-in, then sign in from You: the armed Save remained, unused, while signed in. A link could not complete it, because the nonce is unknown to a link.
- **Reproduction:** saved.test.tsx "22".
- **Evidence:** The test failed on 379adb6 (pendingSave not null).
- **Root cause:** completePendingSave returned early without clearing a non-matching Save.
- **Fix and commit:** Any sign-in consumes the armed Save; it is completed only for its own nonce (76ec748).
- **Verification:** saved.test.tsx 22, 46.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-105

- **Work order:** WO-009A
- **Severity:** MEDIUM
- **Type:** UX
- **Status:** RESOLVED
- **Summary:** (Independent review R1) A failed card Save's alert reappeared on every later re-render, for example after a Save on another card.
- **Expected:** One alert per failure.
- **Actual:** The alert effect depended on useT(), which returns a new function on each render, so it fired again while the failure was still held.
- **Reproduction:** card-saves.test.tsx "a failure is said once": Basket fails offline, then Scarf saves.
- **Evidence:** The test failed with 2 alerts before the fix.
- **Root cause:** Effect dependency on an unstable function.
- **Fix and commit:** The control remembers the failure it has already shown, and never alerts for a session change (5be3273).
- **Verification:** card-saves.test.tsx (1 alert).
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-106

- **Work order:** WO-009A
- **Severity:** LOW
- **Type:** UX
- **Status:** RESOLVED
- **Summary:** (Independent review R2) After a guest saved from a card and signed in, Back showed the Product again instead of the list.
- **Expected:** Back returns to the list the card was on.
- **Actual:** The router's dismissTo, with the Product not yet in the stack, replaced only the verify screen. Back then focused sign-in, whose signed-in redirect reopened the Product.
- **Reproduction:** card-saves.test.tsx "21" plus router.back(); native card-saves-guest-2.
- **Evidence:** expo-router StackRouter POP_TO: a route that is not found replaces the current one only.
- **Root cause:** The card's guest flow left sign-in underneath the Product it opened.
- **Fix and commit:** The card's Sign in now opens the item first and the sign-in over it, as from Product Detail; the auth screens are unchanged (5be3273).
- **Verification:** card-saves.test.tsx 21 (Back -> /shop); native card-saves-guest-2 PASS (Back to the Shop, card saved).
- **Remaining risk:** If the guest cancels sign-in they are on the item, not the list (the prompt says the item opens).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-107

- **Work order:** WO-009A
- **Severity:** LOW
- **Type:** DATA_CONSISTENCY
- **Status:** RESOLVED
- **Summary:** (Independent review R3) A saved-state read already in flight when a Save, Remove or continuation landed could overwrite the confirmed state with its older answer.
- **Expected:** The card shows the server's latest state.
- **Actual:** The narrowed invalidation reached only entries already holding the target; a page batch still on its way, or without an answer yet, was skipped.
- **Reproduction:** Guest Save from a list, with the list's new batch sent before the continuation's POST commits.
- **Evidence:** Code review of saved.ts (confirm, onError, completePendingSave).
- **Root cause:** Invalidation predicate too narrow.
- **Fix and commit:** Reads in flight or without an answer are sent again after every Save, Remove and continuation (76ec748).
- **Verification:** card-saves and saved suites; native: the card was saved on return to the Shop after the guest flow.
- **Remaining risk:** None (the server state was never wrong; the next tap would re-add idempotently).
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-108

- **Work order:** WO-009A
- **Severity:** LOW
- **Type:** REVIEW
- **Status:** RESOLVED
- **Summary:** Independent review minor items.
- **Expected:** n/a
- **Actual:** Five items: (1) the retry icon could send a batch per tap while one was in flight; (2) the guest bookmark was a toggle although it opens a prompt; (3) a header comment claimed every private request was bound; (4) a request refused for a session change could alert; (5) the storage script stopped without a report if a delete failed.
- **Reproduction:** n/a
- **Evidence:** Independent review of the WO-009A diff.
- **Root cause:** n/a
- **Fix and commit:** Retry disabled while fetching; the guest control is a button; the comment corrected; no alert for SessionChanged (5be3273, 76ec748); unlock re-checked right before each delete, and a failed delete recorded instead of aborting (de344d1).
- **Verification:** Mobile 279/279; storage self-test PASS; executed cleanup report: 485 removed, 0 failed.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-109

- **Work order:** WO-009A
- **Severity:** MEDIUM
- **Type:** ENVIRONMENT
- **Status:** RESOLVED (cleaned; recurs per run)
- **Summary:** Maestro writes a copy of its driver to %TEMP% on every run and never removes it. Under the names maestro-app*.apk and maestro-server*.apk, 485 copies (2.86 GB) had built up since 8 November, unseen by the WO-009 cleanup, which knew only tmp*.apk.
- **Expected:** Test-run temporary files do not accumulate on C:.
- **Actual:** 487 files at checkpoint C (the 33 runs of this work order added 66 files, 416,502,108 bytes). Each run adds 11,736,545 + 884,731 bytes, and every copy is byte-identical (SHA-256 5EF8A8D0...).
- **Reproduction:** Any `maestro test` run on this machine.
- **Evidence:** WO-009A storage audit S6; `Win32` file listing by date; manifest of the server APK declares dev.mobile.maestro.test.
- **Root cause:** Maestro CLI behaviour, not this repository.
- **Fix and commit:** The audit recognises all three names, identified by manifest or entries; `-Clean -Execute` removed 485 files, 3,066,085,337 bytes, with none in use (de344d1). The policy lets any work order clean verified copies. Two truncated files remain for a person.
- **Verification:** Checkpoint D: 2 files (320 KB) left; C: +3,087,519,744 bytes free.
- **Remaining risk:** Recurs on every run until cleaned.
- **Founder decision required:** No
- **Recommended resolution:** Run the audit with -Clean -Execute at the end of every work order (policy S4).

### ON-20261111-110

- **Work order:** WO-009A
- **Severity:** MEDIUM
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** About 13.3 GB of C: was used during WO-009A outside every configured Adulis location, most of it during the test phase.
- **Expected:** Host free space moves with the work order's artifacts.
- **Actual:** C: free went from 21,081,735,168 (A) to 7,271,710,720 (C) bytes. Adulis locations explain about 0.49 GB. The Windows page file is 44,801,458,176 bytes allocated, with peak use 10,543 MB and 0.9 to 1.2 GB of RAM free during native runs.
- **Reproduction:** Full test battery plus the emulator, Metro, Maestro, Docker and the editor on a 15.7 GB machine.
- **Evidence:** Checkpoints A-D; Win32_PageFileUsage; Docker vhdx not sparse and unchanged.
- **Root cause:** Not proven: the page file was not recorded at A or B, no low-memory event was logged, and shadow storage needs elevation, which was not used.
- **Fix and commit:** None in code. The audit now records the page file and free RAM.
- **Verification:** n/a
- **Remaining risk:** C: can run out mid-session again (ON-100).
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: decide whether to fix the page-file size or close memory-heavy applications during test batteries; the next work order's checkpoints (with the page-file row) will confirm or rule out the cause.
- **WO-010 (11 November 2026):** Status RESOLVED (cause measured).
  - With the WO-009A emulator still running: page file 42,726 MB, commit 47.1 of 57.4 GB, 0.38 GB RAM free, C: 10,355,748,864 bytes free.
  - After stopping only the emulator: page file 38,833 MB (-3,893 MB) and C: 20,951,506,944 bytes free (+10.6 GB). The rest of the release (about 6.7 GB) came from storage no file listing showed.
  - The page file did not grow during WO-010 (38,833 MB at every checkpoint).
  - The emulator started with TEMP on the SSD cost 12.8 MB of C: at boot and released nothing measurable at exit after about an hour, consistent with its temp storage having been the hidden part. Proven by stop and start measurements, not by a named file.
  - Nothing was disabled, resized or relocated. A game using 10 GB of private memory ran throughout (ON-120).
- **WO-010A (11-12 November 2026):** Confirmed. With the emulator started on the SSD temp, the page file stayed at 38,826-38,832 MB from checkpoint A to C. Free RAM was 0.54 GB at A and 2.69 GB at B. Nothing was disabled or resized.

### ON-20261111-111

- **Work order:** WO-009A
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** Storage the audit cannot clean on its own authority.
- **Expected:** A person decides each.
- **Actual:** Candidates: %TEMP%\pip-unpack-* 2.08 GB (2,393 folders, 7-8 November, owner not provable); Docker build cache 28.18 GB (21.43 GB reclaimable, shared with other projects' containers); G:\wo001a 11.31 GB (superseded); G:\adulis-claude-scratch-archive 3.62 GB; another session's scratch 233 MB; two truncated Maestro files.
- **Reproduction:** n/a
- **Evidence:** docs/engineering/WO-009A-STORAGE-AUDIT.md S8.
- **Root cause:** Ownership or necessity uncertain (policy: report, never delete).
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** Docker space returns to C: only after a builder prune and a virtual-disk compaction.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: authorise or decline each; never prune Docker volumes.
- **WO-010 (11 November 2026):** Unchanged and still awaiting the founder: pip leftovers, the Docker build cache, `G:\wo001a`, the G: archive, another session's scratch, two truncated Maestro files. WO-010 deleted none of them.

### ON-20261111-112

- **Work order:** WO-009A
- **Severity:** LOW
- **Type:** SECURITY
- **Status:** OPEN
- **Summary:** The picker (Add to collection) and the Collection screen still send through the session's shared client, not a session-bound one.
- **Expected:** Every private request bound to the session that started it.
- **Actual:** They read the bearer at send time like every other screen. A switch needs a full sign-out, which leaves these screens, and the server scopes every request to the bearer's Account.
- **Reproduction:** n/a
- **Evidence:** Independent review (INFO); SaveToCollection.tsx, CollectionScreen.tsx.
- **Root cause:** Out of WO-009A's scope (the card and continuation paths were bound).
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** Low.
- **Founder decision required:** No
- **Recommended resolution:** Move them to boundApi in a small follow-up.
- **WO-010 (11 November 2026):** Status RESOLVED.
  - The Saved screen, the Collection screen and the picker use `usePrivateApi` / `keepIfCurrent` (session-bound requests; late answers dropped; follow-ups only for the current session).
  - Without a session both screens ask for a sign-in (review R1).
  - Tests: saved.test.tsx +5 (Account A/B switches, delayed read, expired session, signed out).

### ON-20261111-113

- **Work order:** WO-009A
- **Severity:** LOW
- **Type:** PROCESS
- **Status:** OPEN
- **Summary:** The packages/locale change (five keys) shares this branch with the app change.
- **Expected:** packages/* changes in their own PR (Adulis-MobileApp/CLAUDE.md collision surfaces).
- **Actual:** It is its own commit (72efade), as WO-009 did under its own constraint ("packages/* changes go in their own commits").
- **Reproduction:** n/a
- **Evidence:** git log 379adb6..HEAD.
- **Root cause:** Work-order convention versus repository rule.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** None if merged in order.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: merge as one PR, or cherry-pick 72efade into its own PR first.

### ON-20261111-114

- **Work order:** WO-010
- **Severity:** LOW
- **Type:** CONTRACT
- **Status:** OPEN (amendment A4 PROPOSED, awaiting founder approval)
- **Summary:** GET /v1/categories had no documented semantics (ADU-API-01 S12.1 lists it with an empty description); WO-010 defines them.
- **Expected:** A governed contract for the category list.
- **Actual:** It returned every category (id, code, parent_id). It now returns only the categories enabled in the requester's Market that have a label key, ordered, with additive fields (label_key, display_order, market_resolved). A Seller-side consumer resolving through its Account now sees only that Market's enabled categories.
- **Reproduction:** n/a
- **Evidence:** storefront.controller.ts categories; contracts/openapi.json.
- **Root cause:** The contract never specified the list.
- **Fix and commit:** Additive response shape; no field removed.
- **Verification:** wo-010-categories.e2e (GET /v1/categories cases).
- **Remaining risk:** Operator tooling or a caller with no Market context now gets an empty list.
- **Founder decision required:** Yes
- **Recommended resolution:** Record the semantics in an ADU-API-01 amendment.
- **WO-010A (11-12 November 2026):** Proposed amendment prepared, `docs/amendments/ADU-API-01_A4_categories_PROPOSED.md` (commit `28686e1`). It is listed under "Proposed amendments" in `docs/amendments/README.md`, which says it governs nothing yet.
  - A4.1: `GET /v1/categories` (Market resolution, fields, eligibility, ordering, `no-store`, compatibility).
  - A4.2 and A4.3: the Shop and Search `category` filters with Market- and category-bound cursors.
  - A4.4: the Seller Product `category_id` validation.
  - A4.5: what is not covered.
  - Checked against the implementation. No runtime change; v1.11 still governs.

### ON-20261111-115

- **Work order:** WO-010
- **Severity:** MEDIUM
- **Type:** CONFIGURATION
- **Status:** OPEN
- **Summary:** The Addis Ababa launch Market's code is not recorded in the repository, so its category enablement is an operator step.
- **Expected:** The launch Market offers Fashion, Cosmetics and Electronics.
- **Actual:** Migration 0062 creates the categories everywhere but enables none (Markets are created by the operator). The dev seed enables its fixture Market.
- **Reproduction:** n/a
- **Evidence:** ops/runbooks/activate-market.md Step 6.
- **Root cause:** Market rows are configuration, not migrations.
- **Fix and commit:** Runbook Step 6: an idempotent per-Market-code enablement with a check query.
- **Verification:** Seed path verified (GET /v1/categories lists the three for the seed Market; native flows).
- **Remaining risk:** Until Step 6 runs, the launch Market lists no categories (the Shop shows All only).
- **Founder decision required:** Yes
- **Recommended resolution:** Founder or operator: run Step 6 with the Addis Ababa Market code.
- **WO-010A (11-12 November 2026):** Unchanged, still OPEN. The Addis Ababa Market code is still not in the repository and was not guessed. No category was enabled in any non-development database, and the development seed Market was not used as a stand-in. The founder or operator runs `ops/runbooks/activate-market.md` Step 6 with the real code.

### ON-20261111-116

- **Work order:** WO-010
- **Severity:** LOW
- **Type:** DATA_INTEGRITY
- **Status:** OPEN
- **Summary:** core.seller.category_id (a Seller's store category, migration 0005) is a bare uuid with no foreign key and no Market check.
- **Expected:** A store category that names a real, Market-enabled category, if store categories are meant to use this taxonomy.
- **Actual:** Seller onboarding accepts any uuid. Real categories now exist, so the question becomes live.
- **Reproduction:** n/a
- **Evidence:** 0005 comment; onboarding.service.ts.
- **Root cause:** Out of WO-010 scope (Product classification only).
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** Low.
- **Founder decision required:** Yes
- **Recommended resolution:** Decide whether a Seller's store category uses the Product taxonomy; then add the foreign key and Market check in a forward migration.

### ON-20261111-117

- **Work order:** WO-010
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** RESOLVED
- **Summary:** Expo Doctor 1.21.6 (the working pinned version) reports 19/20: new Expo SDK 58 patch releases appeared after WO-009A passed 20/20.
- **Expected:** 20/20.
- **Actual:** Patch mismatches: expo 58.0.24 expected, 58.0.23 found; likewise expo-constants, expo-font, expo-linking, expo-network, expo-router, expo-secure-store, expo-sqlite, expo-status-bar.
- **Reproduction:** `npx expo-doctor@1.21.6` on 11 November 2026 (evening).
- **Evidence:** G:\AdulisDevelopment\WO-010\logs\gates\expo-doctor.log.
- **Root cause:** Upstream patch releases; WO-010 changed no dependency.
- **Fix and commit:** None. Not silently upgraded: an upgrade changes the lockfile and may need a native rebuild.
- **Verification:** n/a
- **Remaining risk:** The installed patch versions drift from the SDK's recommendation.
- **Founder decision required:** No
- **Recommended resolution:** Upgrade in a dependency-maintenance work order (with a native rebuild check).
- **WO-010A (11-12 November 2026):** RESOLVED.
  - `expo install --fix` within SDK 58 (commit `b7e2b6a`): expo 58.0.24, expo-constants 58.0.16, expo-font 58.0.12, expo-linking 58.0.17, expo-network 58.0.5, expo-router 58.0.31, expo-secure-store 58.0.3, expo-sqlite 58.0.16, expo-status-bar 58.0.5.
  - Lockfile regenerated by pnpm (Expo packages only; the transitive `getenv` dropped); `--frozen-lockfile` passes. The expo-font and expo-status-bar config plugins were added to `app.json` (no manifest change).
  - Expo Doctor 1.21.6: 20/20, no check suppressed.
  - expo-modules-core moved 58.0.30 -> 58.1.0 and eight other modules with native code changed version, so the old APK could not be trusted. The debug APK was rebuilt (`G:\w10a`, BUILD SUCCESSFUL, 326 tasks) and all 31 native flows passed on it.
  - Record: `docs/mobile/WO-010A-EXPO-DEPENDENCY-STABILIZATION.md`.

### ON-20261111-118

- **Work order:** WO-010
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** RESOLVED
- **Summary:** The external SSD is exFAT with a 1 MiB allocation unit; it cannot hold junctions, and a cache of small files takes about 1 MiB per file.
- **Expected:** Audit numbers that reflect SSD use; a self-test that works wherever TEMP points.
- **Actual:** The Jest cache measured 25.9 MB apparent in 3,201 files, about 3.2 GB allocated. The audit self-test failed when TEMP pointed at the SSD.
- **Reproduction:** Set TEMP to the SSD and run Jest or the audit self-test.
- **Evidence:** Get-Volume AllocationUnitSize: G: 1,048,576, C: 4,096.
- **Root cause:** exFAT on a 4 TB drive.
- **Fix and commit:** The self-test now uses the user's NTFS temp; the policy and audit say SSD use is read from free space.
- **Verification:** Self-test PASS with TEMP on the SSD.
- **Remaining risk:** SSD space is used about 10x faster than apparent sizes suggest (3.5 TB free, so capacity is not at risk).
- **Founder decision required:** No
- **Recommended resolution:** Optional: reformat a dedicated SSD partition as NTFS (founder's hardware decision).
- **WO-010A (11-12 November 2026):** The per-work-order caches that exFAT made expensive are now shared (commit `5a7f790`). Jest (`apps/mobile/jest.config.js`), Metro (`apps/mobile/metro.config.js`) and Node's compile cache live in `G:\AdulisDevelopment\shared-cache`, set by `adulis-ssd-env.sh` for the sourcing shell only.
  - Cold run 177.9 s + 99.8 s; warm 43.4 s + 30.0 s; a new work-order context reused the caches with no new Jest or Metro entries; the invalidation probe passed.
  - A cold build of the caches costs 8.9 GB of G: once, instead of in every work order.
  - Follow-ups: ON-20261111-123, -124 and -128. Record: `docs/engineering/WO-010A-SHARED-SSD-CACHE.md`.

### ON-20261111-119

- **Work order:** WO-010
- **Severity:** MEDIUM
- **Type:** REVIEW
- **Status:** RESOLVED
- **Summary:** Independent review of the WO-010 diff: no Critical or High; one Medium and five Low, all fixed before commit.
- **Expected:** n/a
- **Actual:** Six findings: R1 (MEDIUM) the Collection screen and the picker waited forever without a session; R2 a Shop category tab could briefly show the previous category's items as its placeholder; R3 the trigger did not re-check a Market change; R4 unlabelled categories were hidden but still accepted as a filter or an assignment; R5 Search did not re-read categories after a refusal; R6 a selection could stay applied with its tab row hidden. Info items: the runbook idempotence wording, a stale Shop docblock, an ALL key sentinel.
- **Reproduction:** n/a
- **Evidence:** Review report (session record).
- **Root cause:** n/a
- **Fix and commit:** R1 sign-in prompt in the route; R2 placeholder restricted to the same resource; R3 trigger on category_id or market_id; R4 label_key required by the guard and the filter; R5 refetch on refusal; R6 fallback in the screens against the server's successful answer; the info items fixed.
- **Verification:** Mobile 291/291; affected API suites 78/78; e2e covers W10_HIDDEN and the Market change.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-120

- **Work order:** WO-010
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** A non-development application (a game) held about 10 GB of private memory during development, the largest share of the commit charge.
- **Expected:** Room in RAM and commit for the emulator, Jest and Docker.
- **Actual:** 0.38 GB of RAM free at the start of WO-010; commit 47.1 of 57.4 GB with the WO-009A emulator running.
- **Reproduction:** n/a
- **Evidence:** Get-Process (CrimsonDesert, 10,026 MB private).
- **Root cause:** The founder's own application; not closed (only unused development processes may be stopped).
- **Fix and commit:** None. The idle emulator was stopped during coding and the gates.
- **Verification:** n/a
- **Remaining risk:** Page-file growth under memory pressure (ON-110).
- **Founder decision required:** No
- **Recommended resolution:** Close memory-heavy applications before a native battery.

### ON-20261111-121

- **Work order:** WO-010
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** The first write to the external SSD after idle took 74 s for 16 MB; later writes ran at 280-408 MB/s.
- **Expected:** Consistent latency.
- **Actual:** Measured once at the start of WO-010.
- **Reproduction:** Write to the SSD after it has idled.
- **Evidence:** WO-010 SSD probe (G:\AdulisDevelopment\WO-010\logs).
- **Root cause:** USB drive power management (wake from idle).
- **Fix and commit:** adulis-ssd-env.sh probes the drive before work; scripts stop instead of falling back to C:.
- **Verification:** Probe PASS; no later stall observed.
- **Remaining risk:** A long first write can time out a test that starts while the drive sleeps.
- **Founder decision required:** No
- **Recommended resolution:** Keep the probe step before disk-intensive work; optionally disable USB selective suspend for this drive.

### ON-20261111-122

- **Work order:** WO-010A
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** RESOLVED (workaround documented)
- **Summary:** A native Android build cannot run from a `subst` drive or a long path on the exFAT SSD, and pnpm cannot link workspace packages there.
- **Expected:** A rebuild in a short-path copy under `G:\AdulisDevelopment\WO-xxx\build`.
- **Actual:** Under `subst W:`, `generateCodegenSchemaFromJavaScript` failed for safe-area-context, gesture-handler and screens ("this and base files have different roots"): autolinking resolves real paths (G:), and the codegen CLI path stayed on W:. A direct path under G:\AdulisDevelopment is about 31 characters too long for the CMake object paths (285 characters from G:\w2). The pnpm install ends with EISDIR on the `@adulis/*` workspace links (no junctions on exFAT).
- **Reproduction:** Build from `subst W: G:\AdulisDevelopment\WO-010A\build`.
- **Evidence:** G:\AdulisDevelopment\WO-010A\logs\build-gradle.log, build-install.log.
- **Root cause:** Windows path limits, subst versus real-path resolution, and exFAT without reparse points.
- **Fix and commit:** The copy was moved (same-volume rename) to `G:\w10a`, with CMake staging in `G:\w10ax`. The policy records the rule: a short, real top-level path named after the work order. The workspace links are not needed for a debug APK, whose JavaScript Metro serves. No repository change.
- **Verification:** BUILD SUCCESSFUL in 13 min 47 s; APK installed; 31 flows PASS.
- **Remaining risk:** Top-level G: folders cannot be deleted by an agent; each native work order leaves one or two for the founder (at least 98 GB of G: for `G:\w10a`: 100,664 files at 1 MiB or more each).
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: delete superseded build copies when convenient (`G:\wo001a`; `G:\w2` and `G:\w2x` now that `G:\w10a` holds the current APK). Optionally provide an NTFS partition for build copies (ON-20261111-118).

### ON-20261111-123

- **Work order:** WO-010A
- **Severity:** LOW
- **Type:** TEST
- **Status:** OPEN
- **Summary:** On a cold Jest cache, two "root providers" tests in `apps/mobile/src/auth/session.test.tsx` can exceed the 5 s test timeout during the full mobile suite.
- **Expected:** 291/291 on any run.
- **Actual:** Test A (cold shared cache): 289/291, the file took 62 s. Alone on a cold cache: 8/8 in 24 s. Every warm run: 291/291.
- **Reproduction:** Empty the Jest cache and run the whole mobile suite (four workers) with the cache on the USB exFAT SSD.
- **Evidence:** G:\AdulisDevelopment\WO-010A\logs\cache-test\A-jest.log, cold-session.log.
- **Root cause:** React Native and Expo load internals lazily, so on a cold cache their transforms run inside the first tests, in four workers at once, on a slow drive.
- **Fix and commit:** None (no test timeout loosened).
- **Verification:** n/a
- **Remaining risk:** The first full run after a dependency change can fail two tests.
- **Founder decision required:** No
- **Recommended resolution:** Rerun once warm, or use `--maxWorkers=2` for the first run. Raise only these tests' timeout in a test-maintenance change if it recurs in CI.

### ON-20261111-124

- **Work order:** WO-010A
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** Node's compile cache costs much more SSD than it holds and leaks orphaned temporary files on Windows.
- **Expected:** A small, bounded cache.
- **Actual:** `shared-cache\node` reached 7,541 files (6,789 entries, 752 orphans named `<8 hex>.<6 characters>`): 31 MB apparent, about 7.5 GB of G: (1 MiB per file). About 100 orphans per full mobile suite: parallel Jest workers writing the same entry lose the Windows rename.
- **Reproduction:** Run the mobile suite or Metro with NODE_COMPILE_CACHE set.
- **Evidence:** docs/engineering/WO-010A-SHARED-SSD-CACHE.md section 3.2.
- **Root cause:** Node writes entries through a temporary file and a rename; exFAT allocates 1 MiB per file.
- **Fix and commit:** Kept, as the work order requires. The policy says to clear `shared-cache\node` when it grows, and to treat the SSD as a trusted device (security LOW-1).
- **Verification:** File counts before and after each test.
- **Remaining risk:** Unbounded growth of about 100 MB of G: per suite run.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: keep NODE_COMPILE_CACHE (its benefit was not separately measured) or drop it (one line in `ops/scripts/adulis-ssd-env.sh`).

### ON-20261111-125

- **Work order:** WO-010A
- **Severity:** LOW
- **Type:** TEST
- **Status:** RESOLVED
- **Summary:** `apps/mobile/.maestro/buyer-shell.yaml` asserted the Search and Shop placeholder sentences that WO-007 and WO-008 removed; no work order since had run it.
- **Expected:** The shell flow passes on the current app.
- **Actual:** FAIL: "Search for Products, Sellers and Scenes arrives in a coming update." not visible.
- **Reproduction:** Run buyer-shell.yaml on the current app.
- **Evidence:** G:\AdulisDevelopment\WO-010A\maestro\shell.
- **Root cause:** Test maintenance missed when Search (WO-008) and the Shop (WO-007) replaced their placeholders.
- **Fix and commit:** The flow waits for the Search start text, dismisses the focused keyboard before Back, and accepts any resolved Shop state. No app code changed.
- **Verification:** PASS on the rebuilt APK.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-126

- **Work order:** WO-010A
- **Severity:** LOW
- **Type:** TEST
- **Status:** OPEN
- **Summary:** In the parallel `pnpm test`, `wo-sec-001-pool-starvation` (deletion OTP request) got 429 instead of 202 once.
- **Expected:** 983/983 in every run.
- **Actual:** Second gates database: 982/983. The suite alone: 19/19. The first database's full API run: 983/983.
- **Reproduction:** Run `pnpm test` (all suites in parallel) on a fresh disposable database.
- **Evidence:** G:\AdulisDevelopment\WO-010A\logs\gates\pnpm-test.log, rerun-wo-sec-001.log.
- **Root cause:** Parallel suites share the OTP rate limits (OVN-047 class).
- **Fix and commit:** None.
- **Verification:** Rerun alone: PASS.
- **Remaining risk:** Intermittent red in the parallel gate.
- **Founder decision required:** No
- **Recommended resolution:** Isolate the OTP ceiling per suite (backend test maintenance).

### ON-20261111-127

- **Work order:** WO-010A
- **Severity:** MEDIUM
- **Type:** REVIEW
- **Status:** RESOLVED
- **Summary:** Independent read-only security review of the WO-010A changes: no Critical, High or Medium; two Low and two Info items.
- **Expected:** n/a
- **Actual:** LOW-1: shared V8 compile cache on access-control-free exFAT. LOW-2: the Metro override used Metro's plain FileStore instead of Expo's. INFO: the work-order argument was not validated; the policy wrongly said the caches hold no environment values (Metro's export entries contain the public EXPO_PUBLIC_* values). The lockfile (36 new resolutions, all sha512, npm registry only, no install scripts), the two config plugins (no manifest change) and amendment A4 (tightens security) were checked clean.
- **Reproduction:** n/a
- **Evidence:** Review report (session record).
- **Root cause:** n/a
- **Fix and commit:** LOW-2: Expo's FileStore. INFO: `^WO-[A-Za-z0-9-]+$` check; policy wording corrected. LOW-1: documented as a trusted-device rule and a founder decision (ON-20261111-124). Commit `5a7f790` and the docs commit.
- **Verification:** Bad argument refused; Metro config loads with Expo's store; lint clean; all gates green.
- **Remaining risk:** LOW-1 remains while NODE_COMPILE_CACHE is kept.
- **Founder decision required:** No
- **Recommended resolution:** Done (see -124 for the remaining choice).

### ON-20261111-128

- **Work order:** WO-010A
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** OPEN
- **Summary:** Only the mobile Jest cache is shared; `apps/api` and `packages/*` Jest runs still build a cache in each work order's TEMP.
- **Expected:** One shared Jest cache for every workspace.
- **Actual:** The gates left 3,124 files (38.9 MB apparent, about 3 GB of G:) in `WO-010A\temp\jest`, removed at cleanup.
- **Reproduction:** Run the API or package tests in a sourced shell.
- **Evidence:** Cleanup record in docs/engineering/WO-010A-SHARED-SSD-CACHE.md section 3.3.
- **Root cause:** Their Jest configuration is outside the mobile work order's write boundary (apps/api; packages need their own PR).
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** About 3 GB of G: per work order that runs the full gates, cleaned as class A.
- **Founder decision required:** No
- **Recommended resolution:** A backend or tooling change: the same `cacheDirectory` line in those Jest configurations.

### ON-20261111-129

- **Work order:** WO-011
- **Severity:** MEDIUM
- **Type:** SPEC_CONFLICT
- **Status:** OPEN
- **Summary:** The design deletion lifecycle (ADU-PRV-01 v3.3 S29-S30, S57: deletion requests with step-up, states, optional cooling-off, cancellation and a status route) is not in the backend; only the immediate deletion-ticket flow (ADU-API-01 v1.11 S12.18) exists.
- **Expected:** Mobile builds the designed lifecycle.
- **Actual:** Mobile builds the implemented ticket flow, as the work order directs: OTP, ticket, preview, typed confirmation, immediate irreversible deletion.
- **Reproduction:** Compare PRV-01 S57 with `apps/api/src/modules/deletion`.
- **Evidence:** docs/mobile/WO-011-BUYER-ACCOUNT.md section 4.
- **Root cause:** The backend implements the web-era ticket design; the November pack redesigned the lifecycle.
- **Fix and commit:** None in the backend (out of scope). Mobile uses the existing flow.
- **Verification:** n/a
- **Remaining risk:** No cooling-off, cancellation or deletion-status view; deletion is immediate.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: decide whether the PRV-01 lifecycle (and its cooling-off period, which needs legal review) is built before release, or whether the immediate flow is acceptable for the first release.

### ON-20261111-130

- **Work order:** WO-011
- **Severity:** MEDIUM
- **Type:** CONTRACT_GAP
- **Status:** OPEN (mitigated)
- **Summary:** The deletion ticket identifies the Account by possession of a phone, not by the signed-in session; the client cannot make the two match.
- **Expected:** Mobile deletes only the signed-in Account.
- **Actual:** A signed-in Buyer who types another number they control deletes that number's Account.
- **Reproduction:** Sign in as A; Delete Account with phone B and B's code.
- **Evidence:** Security review M1; deletion.service ticketAccount.
- **Root cause:** The ticket flow was designed for an anonymous web page.
- **Fix and commit:** Mitigated in commit `ddf71a6`: the preview and outcome name the phone; after deletion the app asks the server with this device's bearer whether its own session was revoked, signs out only then (or when the server cannot be asked), and otherwise says the device is still signed in.
- **Verification:** Tests M1 (another Account; no answer).
- **Remaining risk:** Deleting the wrong number remains possible for someone who controls both phones.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: decide whether Mobile deletion must be bound to the session (a contract change: a session-scoped deletion request, as PRV-01 S57 designs).

### ON-20261111-131

- **Work order:** WO-011
- **Severity:** LOW
- **Type:** DECISION
- **Status:** OPEN
- **Summary:** The deletion typed-confirmation strings (`buyer.delete.confirm_instruction`, `buyer.delete.confirm_word`) are candidates for the HUMAN-REQUIRED translation class.
- **Expected:** A string a person consents to an irreversible action with is translated by a person.
- **Actual:** They are ordinary machine-translated placeholders: the HUMAN-REQUIRED gate admits only keys with a recorded ruling.
- **Reproduction:** `pnpm verify:mt-keys` after marking them.
- **Evidence:** ops/scripts/verify-mt-keys.mjs.
- **Root cause:** No ruling classifies them; one was not invented.
- **Fix and commit:** None. Amharic is development-only, so no user sees the placeholder.
- **Verification:** verify:mt-keys PASS.
- **Remaining risk:** None until Amharic is enabled.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder or the translation owner: rule whether these join the HUMAN-REQUIRED class.

### ON-20261111-132

- **Work order:** WO-011
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** No Buyer profile exists: R-11 names "Edit Profile", but no document defines a Buyer field and no endpoint reads or edits one.
- **Expected:** Edit Profile in You.
- **Actual:** You shows only the signed-in statement; no field is fabricated, and the Seller Profile API was not repurposed.
- **Reproduction:** n/a
- **Evidence:** ADU-MOB-02 S232 R-11; contracts/openapi.json.
- **Root cause:** The Buyer profile was never designed.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** None.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: define the Buyer profile (fields, visibility, review-author display) before an Edit Profile work order.

### ON-20261111-133

- **Work order:** WO-011
- **Severity:** LOW
- **Type:** DECISION
- **Status:** OPEN
- **Summary:** Appearance and Language are not persisted across app launches.
- **Expected:** A device setting survives a restart.
- **Actual:** Both live in the in-memory UI store for the app run (unchanged behaviour).
- **Reproduction:** Choose Dark; restart the app.
- **Evidence:** src/state/ui-store.ts.
- **Root cause:** The approved device stores are SecureStore (credentials) and SQLite (no tables until a design defines them); a storage library would be a new native dependency.
- **Fix and commit:** None.
- **Verification:** n/a
- **Remaining risk:** A preference resets on each launch.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: approve a device-local preference store (an SQLite settings table, or a key in SecureStore) in a small follow-up.

### ON-20261111-134

- **Work order:** WO-011
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** A Buyer cannot sign out other sessions from the app.
- **Expected:** ADU-AUTH-02 S38: "revoke one or all other sessions according to policy".
- **Actual:** The contract allows revoking another session only from CONSOLE with a REVOKE_ALL_SESSIONS step-up, and no step-up is reachable from Mobile.
- **Reproduction:** n/a
- **Evidence:** contracts/openapi.json (RevokeSessionBodyDto, RevokeOthersBodyDto).
- **Root cause:** The policy restricts the action to the console.
- **Fix and commit:** None; the screen says so in one sentence.
- **Verification:** n/a
- **Remaining risk:** A Buyer with no console access cannot end a lost device's session except by waiting for expiry.
- **Founder decision required:** Yes
- **Recommended resolution:** Founder: decide whether Buyers get a MOBILE path to revoke other sessions (and with what verification).

### ON-20261111-135

- **Work order:** WO-011
- **Severity:** LOW
- **Type:** CONTRACT_GAP
- **Status:** OPEN
- **Summary:** The deletion endpoints publish no request or response schemas in contracts/openapi.json.
- **Expected:** Generated types for every endpoint a client calls.
- **Actual:** Mobile checks the verify, preview and confirm answers at its boundary (src/buyer/account.ts) instead of hand-writing DTOs.
- **Reproduction:** n/a
- **Evidence:** contracts/openapi.json /v1/deletion/*.
- **Root cause:** The legacy controller has no Swagger response decorators.
- **Fix and commit:** None (no API change in this batch).
- **Verification:** Boundary checks tested.
- **Remaining risk:** A server change in shape is caught as a contract failure at runtime, not at compile time.
- **Founder decision required:** No
- **Recommended resolution:** Backend: add response DTOs to the deletion controller and regenerate the contract.

### ON-20261111-136

- **Work order:** WO-011
- **Severity:** LOW
- **Type:** ENVIRONMENT
- **Status:** RESOLVED (transient)
- **Summary:** C: lost 4.31 GB between WO-011 checkpoints A and B with no Adulis location growing by more than 50 MB.
- **Expected:** Host free space moves with the work order's artifacts.
- **Actual:** C: free 16,315,011,072 (A), 12,000,800,768 (B), 20,244,537,344 after the native runs.
- **Reproduction:** n/a
- **Evidence:** Checkpoints A, B; Windows Update downloads 1.0 GB; Docker disk unchanged.
- **Root cause:** Not proven: other software (likely Windows Update or temporary system files), released later.
- **Fix and commit:** None needed.
- **Verification:** C: recovered without any action.
- **Remaining risk:** Native runs started close to the 10 GB floor once.
- **Founder decision required:** No
- **Recommended resolution:** Keep checking free space before each native flow (the harness does).

### ON-20261111-137

- **Work order:** WO-011
- **Severity:** MEDIUM
- **Type:** REVIEW
- **Status:** RESOLVED
- **Summary:** Independent read-only security review of WO-011: no Critical or High; two Medium and four Low, all fixed before the checkpoint.
- **Expected:** n/a
- **Actual:** M1 (wrong-Account outcome), M2 (lost answer reported as expired), L1 (background 401 unmounting the flow), L2 (double submit), L3 (duplicate keys), L4 (fresh ticket refused shown as expired).
- **Reproduction:** n/a
- **Evidence:** docs/mobile/WO-011-SECURITY-PRIVACY.md section 3.
- **Root cause:** n/a
- **Fix and commit:** Commit `ddf71a6` (and locale `2f80b06`).
- **Verification:** Account suite 28/28; mobile 319/319; native delete flows PASS.
- **Remaining risk:** ON-20261111-129 and -130 remain decisions.
- **Founder decision required:** No
- **Recommended resolution:** Done.

### ON-20261111-138

- **Work order:** WO-011
- **Severity:** LOW
- **Type:** TEST
- **Status:** RESOLVED
- **Summary:** Three new WO-011 Maestro steps asserted text that the scrolled You tab had pushed above the viewport, and one asserted the old done sentence.
- **Expected:** Flows pass on the working app.
- **Actual:** account-dark-large, delete-cancel, delete-confirm failed on assertions while the server state was correct (SCRUBBED, sessions 0).
- **Reproduction:** Run the flows at font scale 1.3 or after scrolling to the bottom of You.
- **Evidence:** G:\AdulisDevelopment\WO-011\maestro (screenshots).
- **Root cause:** Flow authoring: missing scroll-up steps.
- **Fix and commit:** Flows scroll up before those assertions and assert the new outcome text (commit `d34076f`).
- **Verification:** All 11 WO-011 flows PASS on the rerun.
- **Remaining risk:** None.
- **Founder decision required:** No
- **Recommended resolution:** Done.
