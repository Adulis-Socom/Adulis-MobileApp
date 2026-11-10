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

### ON-20261111-023

- **Work order:** WO-006
- **Severity:** LOW
- **Type:** DESIGN_CONFLICT
- **Status:** FOUNDER_REVIEW_REQUIRED
- **Summary:** ADU-MOB-02 names the Buyer Seller route (buyer)/seller/[sellerRef]; /seller is already the Seller Companion shell, and no Seller reference exists beyond the handle.
- **Expected:** One unambiguous Buyer route to a Seller.
- **Actual:** Implemented as /sellers/[handle] (plural, like /scenes/[ref]); the public web is /s/:handle (STOREFRONT-02).
- **Reproduction:** n/a
- **Evidence:** MOB-02:202; apps/mobile/src/modes/modes.ts (Companion /seller); app/(buyer)/sellers/[handle].tsx
- **Root cause:** Route naming not reconciled across Mobile modes and the web.
- **Fix and commit:** Plural route; recorded.
- **Verification:** seller-profile tests and Maestro flows (deep link adulis://sellers/fixture-weaves).
- **Remaining risk:** A rename later needs link compatibility.
- **Founder decision required:** Yes (with OVN-080)
- **Recommended resolution:** Decide the cross-surface Seller URL together with the Scene/Product scheme (OVN-080).

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
- **Status:** FOUNDER_REVIEW_REQUIRED
- **Summary:** MOB-02 R-09 says the Products tab is 'the catalogue with available first'; the API keeps the Seller's display order.
- **Expected:** Available Products first.
- **Actual:** Seller display order (display_order, created_at, slug); unavailable Products are labelled in words.
- **Reproduction:** n/a
- **Evidence:** MOB-02 R-09 :2373; storefront.controller.ts products
- **Root cause:** Ordering by a live, changing flag makes keyset pages shift between requests.
- **Fix and commit:** Not implemented (deliberate).
- **Verification:** n/a
- **Remaining risk:** Unavailable Products may sit above available ones if the Seller ordered them so.
- **Founder decision required:** Yes
- **Recommended resolution:** Confirm Seller order, or approve available-first with a snapshot-stable cursor (or a server-side partition: available pages, then unavailable).

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
- **Founder decision required:** No
- **Recommended resolution:** Add the moderation state, filter it in reviews and the summary.

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
- **Status:** FOUNDER_REVIEW_REQUIRED
- **Summary:** REV-01 v3.3 admits public reviews only on a verified evidence basis (FINAL_HANDOFF or VERIFIED_ORDER_FAILURE; 'no unverified fallback'), while the built schema derives an UNVERIFIED badge and the existing public reviews endpoint lists and counts such reviews.
- **Expected:** One rule for which reviews are public.
- **Actual:** UNVERIFIED reviews are public, labelled 'Unverified', and counted in the Seller-service mean; badge_counts are the stored tiers, not REV-01's bases.
- **Reproduction:** Any review whose order has no confirmation and no upheld claim.
- **Evidence:** REV-01 :23-31; 0014 fn_review_derive_badge; storefront.controller.ts reviews and summary
- **Root cause:** The schema follows the older DB-01 badge ladder; the November pack changed the rule.
- **Fix and commit:** None (SPEC_CONFLICT: report, do not resolve in code). The comment no longer overclaims (1ed877d).
- **Verification:** n/a
- **Remaining risk:** Buyers see unverified opinions in the Seller summary.
- **Founder decision required:** Yes
- **Recommended resolution:** Rule whether UNVERIFIED reviews stay public (labelled) or are excluded from list and mean until the Reviews domain implements REV-01's eligibility resolver.

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
- **Status:** OPEN
- **Summary:** The Seller products cursor carries the last Product's created_at to the microsecond (readable after base64 decoding).
- **Expected:** Doctrine 5 keeps internal UUIDs (time-ordered) out of URLs; creation time itself is a similar, weaker disclosure.
- **Actual:** Creation time of one listed Product per page is visible in the cursor.
- **Reproduction:** Decode next_cursor.
- **Evidence:** review Low; storefront.controller.ts products
- **Root cause:** The established order (display_order, created_at) needs created_at as its key.
- **Fix and commit:** Not changed.
- **Verification:** n/a
- **Remaining risk:** Low: a Product's listing time, not an identifier.
- **Founder decision required:** Yes (note)
- **Recommended resolution:** Accept, or sign/encrypt cursors if creation times are considered sensitive.

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
- **Status:** PARTIALLY RESOLVED
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
- **Status:** OPEN
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

### ON-20261111-049

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** PRODUCT_SCOPE / MISSING_DATA
- **Status:** FOUNDER_REVIEW_REQUIRED
- **Summary:** Shop category browsing, Locally Made, Discounts and New Drops modules are not built: no Buyer-facing category taxonomy exists and no rule defines those modules' membership.
- **Expected:** Category entry points backed by real, governed data.
- **Actual:** core.category has only id, parent_id, code, created_at (no labels, no locale strings, one seed row); no discount or 'locally made' attribute is defined for Buyer display.
- **Reproduction:** \d core.category on the disposable database.
- **Evidence:** Disposable DB introspection 11 Nov; shop.tsx header comment; batch rule 'Do not fabricate Fashion/Cosmetics/Electronics database categories'.
- **Root cause:** The taxonomy and the module rules are undefined, not unimplemented.
- **Fix and commit:** None (deliberately not built). The Shop is one honest list; Home's Locally Made and Discounts channels keep their placeholders; the header's Search entry is unchanged (no Marketplace Search).
- **Verification:** Mobile test asserts no Fashion/Cosmetics/Electronics/Sort/Filter/Add to cart controls; native shop.yaml asserts no Fashion/Add to cart/Filter.
- **Remaining risk:** The Shop is less browsable than the prototype until a taxonomy exists.
- **Founder decision required:** Yes -- a Buyer category taxonomy (labels, locales, Market availability) and the rules for Locally Made, Discounts and New Drops.
- **Recommended resolution:** A catalogue taxonomy work order before any category UI.

### ON-20261111-050

- **Work order:** WO-007
- **Severity:** LOW
- **Type:** PRODUCT_RULE
- **Status:** FOUNDER_REVIEW_REQUIRED
- **Summary:** Shop order is a provisional deterministic order, newest first publication (published_at DESC, id DESC), labelled 'Newest first'; no document defines the Shop's ordering.
- **Expected:** A founder-defined Shop order.
- **Actual:** Newest first publication. Republishing keeps the first published_at (fn_publish_product: coalesce(published_at, now())), so unpublish/republish cannot bump a Product to the top; an unavailable Product stays listed in place, labelled.
- **Reproduction:** GET /v1/shop/products; db/migrations/0020_unpublish_product.sql:115.
- **Evidence:** wo-007-shop tests; native refresh-3 (republished Clay cup kept its place).
- **Root cause:** No ordering rule in the pack for a Market-wide Product list.
- **Fix and commit:** None needed now; the order is honest and labelled.
- **Verification:** API and native tests above.
- **Remaining risk:** Newer Sellers' Products dominate the top; no 'available first' (compare ON-20261111-026).
- **Founder decision required:** Yes -- confirm 'Newest first' or define the Shop order (and whether available-first applies, as for ON-20261111-026).
- **Recommended resolution:** Keep 'Newest first' until a ranking design exists; never introduce an unlabelled order.

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
- **Status:** OPEN
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
