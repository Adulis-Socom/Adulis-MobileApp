# WO-020 -- Issues and blockers

Seller Companion frontend foundation, 12 November 2026. Starting point:
`mobile/wo-018-buyer-accessibility-completion` at `b091de8dc98c6101524612a6a6f0a506bce38a99`; branch
`mobile/wo-020-seller-companion-foundation`. WO-019 is reserved for the postponed native
verification and is not used here.

Every significant issue found during WO-020 is recorded when found; resolved issues keep their
description and first failures stay recorded. Categories: Application defect; Authorization issue;
Backend contract gap; Test failure; Test-harness issue; Accessibility issue; Resource limitation;
Security finding; Deferred feature.

## Issues

### W20-01

- **Issue ID:** W20-01
- **Severity:** MEDIUM
- **Category:** Backend contract gap
- **Affected files:** `contracts/openapi.json` (generated; not edited); `apps/mobile/src/seller/seller-api.ts`
- **Expected behavior:** Each Seller Companion read publishes its response schema, so the client is typed from the contract.
- **Actual behavior:** `GET /v1/seller/list`, `/v1/seller/analytics/overview`, `/v1/seller/orders`, `/v1/seller/orders/{id}` and `/v1/notifications` (and its read) publish no response body schema.
- **Reproduction:** `contracts/openapi.json`: each 200 response has no `content` schema.
- **Root cause:** The API's controllers declare no response DTO for these routes.
- **Fix:** Frontend only: narrow validators at the client boundary built from the shapes the running API returned (runtime probe, disposable data); a malformed body is refused, a malformed row dropped; no field is invented. No backend change (not authorized).
- **Commit:** `5a5641f`
- **Test evidence:** `seller-api.test.ts` (6), and the route tests' malformed-answer case.
- **Current status:** OPEN (contract); mitigated in the client
- **Remaining risk:** A backend change to these shapes is not caught at compile time; the client then shows a failure state rather than wrong data.
- **Founder decision:** No (backend contract work order)

### W20-02

- **Issue ID:** W20-02
- **Severity:** LOW
- **Category:** Backend contract gap
- **Affected files:** `apps/mobile/src/seller/SellerHome.tsx` (overview)
- **Expected behavior:** The overview says, per count, whether it covers the reporting window or is a current total.
- **Actual behavior:** Nothing published says it. Probe: `orders` follows the window (0 for a September window), `products_published` does not (4 for every window). `active_reservations`, `completed_handoffs` and `followers` were 0 in the review data, so undetermined.
- **Reproduction:** `G:\AdulisDevelopment\WO-020\logs\api-probe-2.txt`.
- **Root cause:** The overview is computed in the API; ADU-API-01 S12.13 says only "Essential counts".
- **Fix:** Labels claim only what was verified: "Published Products now", "Orders from {from} to {to}"; the other three claim no range.
- **Commit:** `afc29af`
- **Test evidence:** `seller.test.tsx` 21-23, 24.
- **Current status:** OPEN (contract); mitigated
- **Remaining risk:** If the three undetermined counts follow the window, a reader may take them as totals.
- **Founder decision:** No (backend to state the semantics)

### W20-03

- **Issue ID:** W20-03
- **Severity:** LOW
- **Category:** Backend contract gap (backend defect observed)
- **Affected files:** none in the app (API behaviour)
- **Expected behavior:** A malformed `cursor` on `GET /v1/seller/orders` is refused with 400 `VALIDATION_FAILED`.
- **Actual behavior:** 500 `INTERNAL` (`cursor=not-a-cursor`).
- **Reproduction:** `api-probe-2.txt`, "orders, bad cursor".
- **Root cause:** Not visible from the mobile boundary (API code not read).
- **Fix:** None in the app: it sends back only the server's own `next_cursor`.
- **Commit:** n/a
- **Test evidence:** n/a
- **Current status:** OPEN (backend)
- **Remaining risk:** A 500 is logged as an internal error for a client mistake.
- **Founder decision:** No

### W20-04

- **Issue ID:** W20-04
- **Severity:** MEDIUM
- **Category:** Backend contract gap (privacy and attribution)
- **Affected files:** `apps/mobile/src/buyer/notifications.ts`, `BuyerNotifications.tsx` (store inbox)
- **Expected behavior:** A store's inbox holds that store's notifications; Account-level notices appear where the design places them.
- **Actual behavior:** The fixture owner's store inbox returned `NEW_DEVICE_SIGNIN` (an Account security notice) and `PAYOUT_CHANGE_REQUESTED` (slots `bank_code`, `account_last4`) while the Buyer inbox returned none. `core.notification` has no Seller column, so how rows are attributed to one store when an Account holds several is not defined in anything readable.
- **Reproduction:** `api-probe.txt`, "notifications as=seller" and "as=buyer".
- **Root cause:** Server-side scoping rule (not visible; API code not read).
- **Fix:** Frontend: the store inbox renders only catalogue sentences in a `notification.seller.` namespace (none exist), so these rows show the neutral "You have a store notification from Adulis." and no slot (no bank digits) is displayed. The server stays the authority on which rows a store sees.
- **Commit:** `4524127`
- **Test evidence:** `seller.test.tsx` 29, 38 (raw template key never shown).
- **Current status:** OPEN (backend question)
- **Remaining risk:** A multi-store Account may see the same Account-level rows under every store; a team member's inbox semantics are unverified.
- **Founder decision:** Yes: confirm with the backend owner which notifications a store inbox should contain (security notices, payout notices, team members).

### W20-05

- **Issue ID:** W20-05
- **Severity:** LOW
- **Category:** Backend contract gap
- **Affected files:** `packages/locale` (no Seller notification templates)
- **Expected behavior:** Seller notification templates have mobile catalogue sentences.
- **Actual behavior:** Template keys arrive as codes (`NEW_DEVICE_SIGNIN`), not catalogue keys; the mobile catalogue has no Seller notification sentences.
- **Reproduction:** As W20-04.
- **Root cause:** No approved Seller notification copy for mobile (as for Buyer, ON-20261111-139).
- **Fix:** Neutral sentence; the Order line when a row names an Order.
- **Commit:** `4524127`
- **Test evidence:** `seller.test.tsx` 29, 38.
- **Current status:** OPEN
- **Remaining risk:** Sellers cannot tell notifications apart in the Companion.
- **Founder decision:** Yes (approve Seller notification copy, English and human Amharic)

### W20-06

- **Issue ID:** W20-06
- **Severity:** LOW
- **Category:** Backend contract gap
- **Affected files:** `apps/mobile/src/seller/SellerOrders.tsx`
- **Expected behavior:** An Order carries a reference a person can quote.
- **Actual behavior:** Only the UUID exists in the list and detail.
- **Reproduction:** `api-probe.txt`, "orders".
- **Root cause:** Contract.
- **Fix:** Rows show state, placed time, total and product count; no reference is invented.
- **Commit:** `4524127`
- **Test evidence:** `seller.test.tsx` 40.
- **Current status:** OPEN
- **Remaining risk:** Two Orders placed close together look alike.
- **Founder decision:** No

### W20-07

- **Issue ID:** W20-07
- **Severity:** LOW
- **Category:** Backend contract gap
- **Affected files:** `apps/mobile/src/seller/seller-api.ts` (`parseOrder`)
- **Expected behavior:** The detail's `lines` (and, later, `history`) item shapes are known.
- **Actual behavior:** Empty in the review data; unpublished.
- **Reproduction:** `api-probe.txt`, "order detail".
- **Root cause:** Contract; review data.
- **Fix:** The detail counts lines and renders none; payment submissions, history and `allowed_actions` are not read.
- **Commit:** `5a5641f`
- **Test evidence:** `seller-api.test.ts`, `seller.test.tsx` 42.
- **Current status:** OPEN
- **Remaining risk:** None for safety; the detail is thin.
- **Founder decision:** No

### W20-08

- **Issue ID:** W20-08
- **Severity:** MEDIUM
- **Category:** Application defect (found by the new tests before commit)
- **Affected files:** `apps/mobile/src/seller/SellerOrders.tsx`
- **Expected behavior:** Opening `/seller/orders`, `/seller/notifications` or an Order directly shows it once the store list has loaded.
- **Actual behavior:** First version: the sub-screens redirected to Seller Home before the list had loaded (no active store yet was treated as no store). Six of the first 26 route tests failed on it.
- **Reproduction:** First run, `G:\AdulisDevelopment\WO-020\logs\jest-seller-1.log`.
- **Root cause:** "Not loaded" and "none" were one state.
- **Fix:** `WithStore`: loading, offline and failure states while the list is read; redirect only when it has answered without an active store.
- **Commit:** `4524127`
- **Test evidence:** `seller.test.tsx` 34-36, 40-47 (direct links).
- **Current status:** RESOLVED
- **Remaining risk:** None known.
- **Founder decision:** No

### W20-09

- **Issue ID:** W20-09
- **Severity:** LOW
- **Category:** Test failure / test-harness issue (with a small UI correction)
- **Affected files:** `seller.test.tsx`; `SellerHome.tsx`
- **Expected behavior:** The overview's offline state is testable and shown.
- **Actual behavior:** First version of test 26: an `'offline'` reply left the overview on "Loading" (TanStack pauses retries while the app is not focused under Jest). Also, a refetch while offline after an error showed the old error instead of "offline".
- **Reproduction:** `jest-seller-2.log`.
- **Root cause:** Test approach; UI ordered the error state ahead of the paused one.
- **Fix:** Test drives offline with `onlineManager.setOnline(false)` and a server error for the failure path; the overview now shows offline whenever the query is paused.
- **Commit:** `afc29af` (UI), `29ddbae` (test)
- **Test evidence:** `seller.test.tsx` 26, 27.
- **Current status:** RESOLVED
- **Remaining risk:** None known.
- **Founder decision:** No

### W20-10

- **Issue ID:** W20-10
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected files:** `seller.test.tsx` (test 40)
- **Expected behavior:** The Orders paging test checks Load more by cursor.
- **Actual behavior:** First version found two rows with the same total: FlashList loads page 2 by itself under Jest when the content is shorter than its viewport (the WO-018 W18-06 behaviour). The other bucket's rows were confirmed gone (no leak).
- **Reproduction:** `jest-seller-3.log`.
- **Root cause:** A short first page.
- **Fix:** A 20-row first page; the unknown-state row moved to the first bucket.
- **Commit:** `29ddbae`
- **Test evidence:** `seller.test.tsx` 40, 41, 43, 44.
- **Current status:** RESOLVED
- **Remaining risk:** None.
- **Founder decision:** No

### W20-11

- **Issue ID:** W20-11
- **Severity:** LOW
- **Category:** Application defect (bundle vocabulary; found before commit)
- **Affected files:** `packages/locale/src/en.ts`, `am.ts`
- **Expected behavior:** No billing vocabulary in the mobile bundle (mobile CLAUDE.md).
- **Actual behavior:** First draft keyed statuses by server value, so `seller.status.BILLING_SUSPENDED` would have put the word into the bundle.
- **Reproduction:** Locale draft.
- **Root cause:** A server enum value used as a key.
- **Fix:** One `seller.status.suspended` key; the app treats any `*_SUSPENDED` status as suspended.
- **Commit:** `a68fb62`
- **Test evidence:** locale test "none with subscription vocabulary"; `seller.test.tsx` 12/15 ("Suspended").
- **Current status:** RESOLVED
- **Remaining risk:** None.
- **Founder decision:** No

### W20-12

- **Issue ID:** W20-12
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected files:** none (command)
- **Expected behavior:** `pnpm --filter @adulis/mobile test -- --runInBand` (the work order's suggested command) runs the suite in band.
- **Actual behavior:** pnpm passes the `--` through; Jest takes it as a test-name pattern, finds no tests and exits 0. The first full run therefore tested nothing; it is not counted.
- **Reproduction:** `pnpm --filter @adulis/mobile test -- --runInBand` -> "No tests found, exiting with code 0".
- **Root cause:** pnpm 10 argument forwarding with a script that already chains commands.
- **Fix:** Run `node scripts/check-locale-imports.mjs && npx jest --runInBand` in `apps/mobile`.
- **Commit:** n/a
- **Test evidence:** `G:\AdulisDevelopment\WO-020\logs\mobile-test-full.log` (the corrected run).
- **Current status:** RESOLVED (documented)
- **Remaining risk:** A future "pass" from that command is vacuous.
- **Founder decision:** No

### W20-13

- **Issue ID:** W20-13
- **Severity:** MEDIUM
- **Category:** Resource limitation
- **Affected files:** none
- **Expected behavior:** Development without interfering with the founder's other work.
- **Actual behavior:** 0.41-1.69 GB of 15.71 GB free during WO-020; an unrelated game held about 10.4 GB. No emulator, Gradle, Maestro, bundle export or parallel test run was started. Two short runtime probes started only the API process for a few minutes each (the database container had been running for 11 hours); both stopped it. Jest ran in band.
- **Reproduction:** Measurements in the founder handoff.
- **Root cause:** Shared machine (W18-02).
- **Fix:** None needed; all work stayed within the resource order.
- **Commit:** n/a
- **Test evidence:** n/a
- **Current status:** OPEN (environment)
- **Remaining risk:** Native verification remains postponed (backlog).
- **Founder decision:** See the backlog (WO-019).

### W20-14

- **Issue ID:** W20-14
- **Severity:** LOW
- **Category:** Deferred feature (native verification)
- **Affected files:** all WO-020 screens
- **Expected behavior:** Seller mode verified on Android (and iOS).
- **Actual behavior:** Not run (resource order). Listed in `MOBILE-NATIVE-VALIDATION-BACKLOG.md`.
- **Reproduction:** n/a
- **Root cause:** Work-order restriction.
- **Fix:** n/a
- **Commit:** n/a
- **Test evidence:** Jest only.
- **Current status:** OPEN
- **Remaining risk:** Layout, focus and TalkBack behaviour of the new screens are unverified.
- **Founder decision:** Schedule with WO-019.

### W20-15

- **Issue ID:** W20-15
- **Severity:** LOW
- **Category:** Test failure (intended behaviour change)
- **Affected files:** `apps/mobile/src/auth/auth-flow.test.tsx`
- **Expected behavior:** The suite reflects the current rule for Seller mode.
- **Actual behavior:** First full in-band run (`mobile-test-full.log`): 458/459. "stays Buyer-only in a release build even when the server says Seller Companion is available" encoded WO-003's rule, which this work order replaces (genuine, server-authorized Seller access).
- **Reproduction:** The full mobile run before `test(mobile): release builds ...`.
- **Root cause:** Founder decision in WO-020 supersedes the WO-003 restriction for Seller mode.
- **Fix:** The test now asserts the new rule in a release build: Seller offered exactly when the server says so; Courier and developer diagnostics still never offered.
- **Commit:** `3289b89`
- **Test evidence:** `auth-flow.test.tsx` 40/40.
- **Current status:** RESOLVED
- **Remaining risk:** Other documents still state "release builds offer Buyer only" (not edited here).
- **Founder decision:** No (decided in WO-020)

### W20-16

- **Issue ID:** W20-16
- **Severity:** LOW (F1, F2); INFO (F3-F7)
- **Category:** Security finding
- **Affected files:** `seller-context.tsx`, `BuyerNotifications.tsx`, `notifications.ts`, `app/seller/_layout.tsx`, `SellerHome.tsx`
- **Expected behavior:** No request loop on a refused store; a protected notice is never marked read unseen; no secret used as a React key; same-name stores distinguishable.
- **Actual behavior:** Independent review of `b091de8..29ddbae` (no Critical, High or Medium): F1 a 404 on a store read could loop requests while the list still named the only store; F2 non-suppressible store notices (payout change with bank code and last four digits, new sign-in) could be marked read everywhere without being seen (read state syncs to the Seller Console); F3 the store context was keyed by the bearer string; F6 same-name stores looked identical in the chooser. F4, F5, F7 Info (see the security review).
- **Reproduction:** `WO-020-SECURITY-REVIEW.md`.
- **Root cause:** F1 query removal re-created the failing read; F2 no rule for protected notices in a surface that cannot show them; F3 a convenience key; F6 the handle not shown.
- **Fix:** F1 `refused` no longer removes queries (test fails on the old code); F2 no Mark as read for a non-suppressible store notice, with a pointer to the Seller Console; F3 key removed; F6 handle shown.
- **Commit:** `bc46751` (and `4f9e52d` for the F2 string)
- **Test evidence:** `seller.test.tsx` "security review fixes" (F1, F2) and the chooser test (F6).
- **Current status:** RESOLVED (F1, F2 in the store inbox, F3, F6); ACCEPTED (F4, F5, F7)
- **Remaining risk:** F2 in the Buyer inbox: a protected Buyer notice can still be marked read there (WO-012 behaviour, unchanged).
- **Founder decision:** Yes: should protected (non-suppressible) notices be markable as read on mobile at all (Buyer inbox included)?

### W20-17

- **Issue ID:** W20-17
- **Severity:** MEDIUM (gate failure, found before the final checkpoint)
- **Category:** Application defect (architecture rule)
- **Affected files:** `apps/mobile/src/modes/modes.ts`, `ModeLayout.tsx`, `ModeShell.tsx`, `app/dev/index.tsx`, `app/(buyer)/(tabs)/account.tsx`
- **Expected behavior:** `pnpm verify:deps` passes (no circular dependency).
- **Actual behavior:** First run after the feature commits: 2 `no-circular` errors (session -> ui-store -> modes -> session; bootstrap -> session -> ui-store -> modes -> bootstrap): `modes.ts` started reading the session and bootstrap while the ui-store imports its types.
- **Reproduction:** `G:\AdulisDevelopment\WO-020\logs\verify:deps.log`.
- **Root cause:** A hook placed in a module the store depends on.
- **Fix:** `useAvailableModes` moved to `ModeLayout.tsx`; `modes.ts` keeps only types, constants and the pure resolver.
- **Commit:** `bc46751`
- **Test evidence:** `verify:deps` "no dependency violations"; mode tests pass.
- **Current status:** RESOLVED
- **Remaining risk:** None.
- **Founder decision:** No
