# ADULIS -- THREE-WORK-ORDER DEVELOPMENT REPORT

WO-015, WO-016 and WO-017, 12 November 2026. Buyer Mobile frontend only: no backend, contract,
database or payment change.

Issues and blockers are recorded separately in
[`WO-015-017-ISSUES-AND-BLOCKERS.md`](WO-015-017-ISSUES-AND-BLOCKERS.md). How to try the work:
[`WO-015-017-REVIEW-GUIDE.md`](WO-015-017-REVIEW-GUIDE.md).

## Executive summary

- **Work orders:** three executed in sequence. Each has its own branch and pushed checkpoint, and
  the next started from the verified one. WO-015 and WO-016 are complete. WO-017: see the
  checkpoint table.
- **Built:**
  - Buyers can attach a Product from inside a conversation (WO-015).
  - The conversation stays usable with enlarged text and the keyboard open; not-found refusals no
    longer guess; unconfirmed sends are explained and retried safely (WO-016).
  - Failures are now spoken to screen readers; offline is said as offline on private screens;
    Search reads fully; the For You native flow works; five navigation journeys pass natively
    (WO-017).
- **Security:** three independent read-only reviews, one per checkpoint, found no Critical, High
  or Medium issue. Their Lows were fixed (S-002, S-003, S-004). One Low (S-001, a handle unique
  only per Market) is a backend contract gap. Two HIGH user-facing defects were found and fixed:
  Send under the keyboard (B-008, found natively) and silent failure messages (A-001, found by the
  accessibility audit).
- **Tests:** mobile Jest grew from 376 to 403 tests, all passing. Native Android covered every new
  feature and the regression set; first failures and reruns are recorded. Full gates: see Testing.
- **Founder decisions:** one environment decision (page file and heavy programs during native
  tests); the older pending decisions are unchanged.

## Work-order checkpoints

| Work order | Status | Branch | Final SHA | Tests | Native |
|---|---|---|---|---|---|
| WO-015 | COMPLETE | `mobile/wo-015-conversation-product-selector` | `67c48bbad70cc4c9f1a7e600bfd4ea88d062975f` | mobile 393/393; chat 60/60 | selector journey PASS (after B-004, B-003, B-005) |
| WO-016 | COMPLETE | `mobile/wo-016-messaging-ux-reliability` | `a610a413f9fa9f666d9123678e4fbc4888f826dd` | mobile 400/400; chat 67/67 | layout at 1.0/1.3/1.6 and the unconfirmed path PASS (after B-008) |
| WO-017 | COMPLETE (A-006 Lows open by design; recorded) | `mobile/wo-017-buyer-frontend-stabilization` | code `0ed2ed7`; pushed HEAD in the final report (the docs commit) | mobile 403/403; API bounded 983/983; parallel `pnpm test` 982/983 (ON-126) | For You x2, journeys 5/5, regressions, notifications, messaging PASS after recorded flow fixes |

Each branch starts from its predecessor's pushed checkpoint. Nothing was merged or force-pushed.

## Feature summary

**Functional against the real local API (native, disposable database):**
- **In-conversation Product selector (WO-015):** Select Product, the Seller's paged public
  Products, attach, replace, remove, and send with the Product on that message only. Two Products
  were sent in one conversation and their stored ids verified.
- **Conversation layout (WO-016):** the history, the Product context and Send stay usable with
  the keyboard open at font scales 1.0, 1.3 and 1.6, in Light and Dark.
- **Unconfirmed sends (WO-016):** the explanation, Try sending again (stored once) and Edit the
  message instead.
- **For You (WO-017):** its dedicated native flow passes on its own data (ON-084).
- **Navigation journeys (WO-017):** all five PASS natively (j4 after a flow correction, B-012); every Ask Seller and Message Seller reached the one Fixture Weaves conversation, and nothing was sent.
- **Regressions (WO-017):** the WO-014 Product-context journeys A-E (stored rows checked), offline and Dark at 1.3 PASS; notifications PASS; Seller Profile messaging PASS; 17 regression flows PASS. Search passed after its pattern followed the new labels (A-003). Flows that tap You right after launch passed after a retry was added (B-013). First failures are recorded.

**Verified only with controlled test fixtures (Jest, in-memory server):**
- the neutral not-found refusal and its follow-up reads (ON-168);
- picker paging beyond 30 Products, the offline picker, and Account switching with the picker
  open;
- the timeout path;
- screen-reader announcements (spied in Jest; no screen reader was run);
- the offline wording on private screens.

**Implemented but not fully validated:**
- the Delete Account keyboard offset (A-005; its native flow deletes an Account);
- announcements heard on a real screen reader;
- iOS.

**Blocked by missing backend functionality:**
- a Seller id on conversations and Product reads (ON-162, S-001): selection is limited to the
  Buyer's 100 most recent conversations;
- naming a past message's Product (ON-163);
- context-specific send errors (ON-168, backend part).

**Deferred by policy:** payment, checkout, orders, Seller Companion, Courier, push, read receipts,
typing, presence, unread counts, production For You.

## Bug summary

23 issues were recorded as found (13 B-, 4 S-, 6 A- entries). 18 are resolved and 5 are open.
Details and fix commits: [`WO-015-017-ISSUES-AND-BLOCKERS.md`](WO-015-017-ISSUES-AND-BLOCKERS.md).

| Kind | Resolved | Open |
|---|---|---|
| Application defects | B-002 (Seller lookup stalled after page 2, since WO-014) | -- |
| Security | S-002, S-003, S-004 (review Lows) | S-001 (handle unique per Market; backend gap) |
| UX / accessibility | B-005 (picker under the status bar), B-008 (Send under the keyboard, HIGH), A-001 (silent failures, HIGH), A-002, A-003, A-004, A-005 | A-006 (busy states, scroll-only paging, two-line names, focus on tab switches) |
| Test harness | B-004 (`prepare` lost a helper and still said "ready"; my WO-014 claim was wrong), B-007, B-009 (ON-170: a reading error; totals added), B-011 (ON-084), B-012, B-013 | -- |
| Development environment | B-006 (Metro cache folder) | B-001, B-003 (memory and C: during native runs), B-010 (Expo Router development warning) |

Corrections to earlier reports:
- WO-014 called the launcher's `prepare` verified; it was not (B-004).
- WO-014's "627 MB recovered" was a free-space difference. The files removed totalled 580,578,696
  bytes (B-009).
- My first B-007 diagnosis was incomplete and was corrected.

## Testing

Gates on freshly rebuilt disposable databases at the WO-017 code head `0ed2ed7`
(`G:\AdulisDevelopment\WO-017\logs\gates.out`):

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| API Jest, bounded (`--maxWorkers=2`) | 983/983 PASS |
| Full parallel `pnpm test` | **FAIL: API 982/983.** `wo-009-collections` "saving creates no Cart, reservation, Order or stock change" (a global commerce-row count, ON-20261111-126). The same suite alone on a rebuilt database: 26/26. The parallel run stopped after the API failure, so the mobile package did not run inside it. ON-126 stays open; OTP limits were not raised. |
| api-client test, `generate:check` | PASS (the generated client is unchanged) |
| Mobile typecheck, lint, test, build | PASS; Jest 403/403 (23 suites) |
| Repo typecheck, lint, build | PASS |
| verify contract, appendix, docs, deps, mt-keys, error-locale | PASS |
| `db:check`, `db:determinism` | PASS |
| 15 ops gates, orphan sweep, console-e2e | PASS |
| boot-smoke (PowerShell) | PASS |
| Expo Doctor 1.21.6 | 20/20 |
| Bundle subscription scan | 2 files, both identifier text in the Hermes string table (no subscription, price, tier or billing copy) |

Mobile Jest by checkpoint: 376 (start), 393 (WO-015), 400 (WO-016), 403 (WO-017), all passing.

Android native: all on the Android 17 emulator, the real local API and the disposable database.
- **WO-015:** the selector journey with two Products, stored ids verified.
- **WO-016:** the layout at three font scales and the unconfirmed path, stored once.
- **WO-017:** the For You flow, five journeys, the Product-context journeys, layout, messaging,
  notifications and 17 regression flows.
- **First failures (recorded, not erased by the reruns):** B-003 (blocked by C:), B-004 (fixtures),
  B-005, B-008, B-011, B-012, B-013 and the Search label pattern.

**iOS: not tested.**

## Storage

Bytes free. C: is the system drive; G: is the SanDisk Extreme 55AE SSD (`G:\AdulisDevelopment`).

| Point | WO-015 C: | WO-015 G: | WO-016 C: | WO-016 G: | WO-017 C: | WO-017 G: |
|---|---|---|---|---|---|---|
| Before development | 26,604,363,776 | 3,358,291,132,416 | 38,200,033,280 | 3,358,022,696,960 | 27,969,122,304 | 3,357,644,161,024 |
| After development | 26,583,678,976 | -- | -- | -- | -- | -- |
| After testing | 38,178,361,344 (emulator stopped; 9,913,442,304 at the low point) | 3,357,915,742,208 | 27,974,156,288 (emulator running) | 3,357,414,522,880 | 27,927,961,600 (emulator running) | 3,354,373,652,480 |
| After cleanup | 38,214,889,472 | 3,358,037,377,024 | 27,974,012,928 | 3,357,655,695,360 | 38,141,784,064 | 3,355,695,906,816 |

- **Temporary files generated:** Maestro output, logs and driver APKs on G: (WO-015/016/017
  folders); the For You fixture media in MinIO (removed after the flow).
- **Removed:** unused Maestro driver APKs only, dry run first: 22 (WO-015), 32 (WO-016) and 193
  (WO-017; 1,223,379,041 bytes, the audit's own total).
- **Recovered:** 122,683,392 (WO-015), 245,366,784 (WO-016) and 1,223,379,041 bytes (WO-017),
  all on G:.
- **Protected files preserved:** `G:\Android\`, `G:\w2`, `G:\w2x`, `G:\wo001a`,
  `G:\adulis-claude-scratch-archive`, `G:\w10a`, Docker volumes, other projects' containers and
  images, the page file. None was touched.
- **Memory:** 2.17 GB free at the start, 0.35 GB at the worst point (B-003), 1.05 GB at the WO-017
  start. Page file: 29.4 GB, then 30.5 GB, then 18.6 GB, then 20.7 GB (system-managed, unchanged by
  me). C: swings of 10-17 GB track the running emulator.

## Founder decisions

- **ON-20261111-161 / B-003:** page-file policy, or a reboot and closing heavy programs before long
  native batches. During this batch C: dropped below the 10 GB gate while an unrelated game held
  about 10 GB of memory.
- Unchanged and still yours: ON-20261111-129, -130, -132, -141, -146, -152, -154, -156; the Chat
  backend gaps (ON-149); and the payment deferral. None was approved here.

## Recommended next work order

**WO-018 -- Buyer accessibility completion.** Fix A-006:
- busy and disabled states announced in Add to collection and Collections;
- a Load more button on public lists and For You;
- full Product names at large text;
- focus kept on Seller Profile tab switches and Delete Account steps.

Then a human TalkBack pass over the main journeys (no screen reader was run in this batch). In
parallel, and outside the mobile workstream, a small backend contract change: a Seller id and
Market on conversation rows and Product reads (ON-162, S-001), and a Product summary on Buyer
messages (ON-163). Not started.
