# WO-018 -- Issues and blockers

Buyer accessibility completion and native verification, 12 November 2026. Starting point:
`mobile/wo-017-buyer-frontend-stabilization` at `ec8e1a11ce1822bc354293d3306145b4f3eed72d`;
branch `mobile/wo-018-buyer-accessibility-completion`.

This file records every bug, accessibility issue, test failure, harness problem, security
finding, environment problem and missing backend capability found during WO-018, when it is
found. It is separate from the development report. A resolved issue keeps its original
description, and first failed attempts stay recorded. The central register
(`docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md`) is updated where an entry applies.

Categories: Application defect; Security finding; UX/accessibility issue; Test failure;
Test-harness issue; Development-environment issue; Backend contract gap.

Carried in from WO-015..017 and monitored here (not re-described): A-006 (the subject of this
work order, see W18-01), B-001 and B-003 (memory and C: during native runs, see W18-02), B-010
(Expo Router development warning), S-001 (Seller handle unique per Market only), ON-126
(parallel API test interference), ON-162 (no stable Seller identity in public reads), ON-163 (no
Product summary on message history).

## Issues

### W18-01

- **Issue ID:** W18-01 (A-006 from WO-017)
- **Severity:** LOW (as recorded by WO-017)
- **Category:** UX/accessibility issue
- **Affected component:** `SaveToCollection.tsx`, `CollectionScreen.tsx`, `SavedItemCard.tsx`, `Checkbox.tsx`, `PublicListView.tsx`, `ForYouFeed.tsx`, `SellerProfile.tsx` (`ProductTile`), `SearchResults.tsx`, `DeleteAccount.tsx`
- **Expected behavior:** Busy and disabled states announced; pagination reachable without scrolling; Product names readable at large text; screen-reader focus kept when the pressed control is replaced.
- **Actual behavior:** (1) In Add to collection and a Collection's Remove, an in-flight change was shown by opacity only; other controls looked enabled and ignored taps; the checkbox had no disabled state. (2) Public lists and For You paged on scrolling only. (3) Product names were cut to two lines in tiles at any text size. (4) A Seller Profile tab press and each Delete Account step unmounted the pressed control (focus lost); "Checking" and "Deleting" were not spoken.
- **Reproduction:** WO-017 accessibility review, section 4.
- **Root cause:** Component design that predates the audit.
- **Fix:** See the development report (`WO-018-BUYER-ACCESSIBILITY-COMPLETION.md`), one commit per group: busy and disabled states with one change at a time; an explicit Load more on the same cursor mechanism; one-column grids and full names from 130% text; focus moved to the selected tab and to each step's first line; "Deleting" spoken.
- **Commit:** `e0a6aa4` (busy states), `1e1b2cb` (pagination), `16646f7` (names), `05391db` (tab focus), `a23d57f` (Delete Account focus), `38780ea` (tests), `67ecf4b` (review fixes), `80dbc39` (W18-12, W18-13)
- **Regression test:** `components/a11y-states.test.tsx`; the "WO-018" blocks in `saved.test.tsx`, `shop.test.tsx`, `for-you.test.tsx`, `seller-profile.test.tsx`, `account.test.tsx`.
- **Verification:** Jest PASS (mobile 427/427). Native, partial: tab selection, the failed-next-page state and Collection changes PASS; names, Delete Account focus and the paging retry blocked (W18-08).
- **Current status:** RESOLVED in code; native verification partial; TalkBack PENDING (W18-11)
- **Remaining risk:** see W18-11 (TalkBack).
- **Founder decision required:** No

### W18-02

- **Issue ID:** W18-02 (B-001 and B-003 recurring)
- **Severity:** MEDIUM
- **Category:** Development-environment issue
- **Affected component:** Development machine (physical memory, commit charge, C:)
- **Expected behavior:** Enough memory for Jest, Metro and the emulator together; C: at least 25 GB free before a long native battery, never below 10 GB.
- **Actual behavior:** At the WO-018 start, 0.36 GB of 15.71 GB physical memory was free and the commit charge was 34.7 of 35.9 GB. An unrelated game (CrimsonDesert) held 9.1 GB of private memory. During the first focused Jest runs free memory fell to 0.16 GB and the commit charge reached 37.0 of 37.9 GB: the system-managed page file grew by about 2 GB on C:. One Jest run stalled for about 20 minutes while paged out and was stopped (see W18-06). C: was 27.0 GB free at the start.
- **Reproduction:** Measure with the game running (`G:\AdulisDevelopment\WO-018\logs\audit-start.json`).
- **Root cause:** A memory-heavy program outside this work runs alongside development; the page file is system-managed.
- **Fix:** None (the game is the user's and is not closed without authorization; the page file is not changed). Mitigation: Jest with `--maxWorkers=2`, one suite at a time, native work only after a fresh measurement.
- **Commit:** n/a
- **Regression test:** n/a
- **Verification:** Measured at each checkpoint (development report, Storage).
- **Current status:** OPEN
- **Remaining risk:** The emulator (about 3-4 GB) may not fit while the game runs; native testing is gated on the measurement.
- **Founder decision required:** Yes (ON-20261111-161: page-file policy, or close heavy programs before native batches).

### W18-03

- **Issue ID:** W18-03
- **Severity:** LOW
- **Category:** Application defect
- **Affected component:** `apps/mobile/src/buyer/CollectionScreen.tsx`
- **Expected behavior:** Removing an item from a named Collection says which Collection it left.
- **Actual behavior:** The announcement was always "Removed from Saved.", also for a named Collection such as "Outfit ideas" (found reading the code for WO-018).
- **Reproduction:** Open a named Collection, Remove an item with a screen reader on.
- **Root cause:** The default Collection's string was reused.
- **Fix:** "Removed from {name}." with the Collection's name (new key `buyer.save.removed_from`); Add to collection says "Added to {name}." / "Removed from {name}.".
- **Commit:** `e0a6aa4`
- **Regression test:** `saved.test.tsx` "the Collection screen, in Dark: while a Remove is in flight ..." asserts "Removed from Outfit ideas.".
- **Verification:** PASS
- **Current status:** RESOLVED
- **Remaining risk:** None known.
- **Founder decision required:** No

### W18-04

- **Issue ID:** W18-04
- **Severity:** LOW
- **Category:** Application defect (found in development by a new test, before any commit)
- **Affected component:** `apps/mobile/src/buyer/LoadMoreFooter.tsx` (new)
- **Expected behavior:** After a Load more, the screen reader hears how many items arrived.
- **Actual behavior:** First implementation: nothing was announced when the answer came at once. The footer waited to see the request "in flight" before treating it as finished; TanStack and React delivered "fetching" and "settled" in one render, so the request never looked started.
- **Reproduction:** `shop.test.tsx` "a failed page keeps what is shown ..." (instant answers) failed on the "Loaded 1 more" assertion.
- **Root cause:** Completion inferred from an intermediate state that is not guaranteed to render.
- **Fix:** Completion is inferred from the page count, which grows exactly once per arrived page.
- **Commit:** `1e1b2cb`
- **Regression test:** the same test, and "Load more asks for the next cursor ..." (held answer).
- **Verification:** PASS
- **Current status:** RESOLVED
- **Remaining risk:** None known.
- **Founder decision required:** No

### W18-05

- **Issue ID:** W18-05
- **Severity:** LOW
- **Category:** UX/accessibility issue (wording, found in development before any app commit used it)
- **Affected component:** `packages/locale` key `buyer.list.loaded_more`
- **Expected behavior:** The count announcement is true in every state.
- **Actual behavior:** First wording: "Loaded {count} more. They are just before this button." After the last page the end sentence replaces the button, so the sentence pointed at a control that no longer existed.
- **Reproduction:** Writing the end-of-list test.
- **Root cause:** Wording written for the middle of a list only.
- **Fix:** "Loaded {count} more, just above." (locale commit `2f858a5`, after `44c129d` added the key).
- **Commit:** `2f858a5`
- **Regression test:** `shop.test.tsx` and `for-you.test.tsx` assert the sentence after the last page.
- **Verification:** PASS
- **Current status:** RESOLVED
- **Remaining risk:** The Amharic entry is a machine-translation placeholder (MT-KEYS.md), as for every Amharic string.
- **Founder decision required:** No

### W18-06

- **Issue ID:** W18-06
- **Severity:** LOW
- **Category:** Test-harness issue (with test failures)
- **Affected component:** New WO-018 tests in `apps/mobile/src/buyer/shop.test.tsx`
- **Expected behavior:** The new tests pass alone and together.
- **Actual behavior:** First attempts failed, in order: (a) the first Load more test found the button busy, because FlashList pages by itself under Jest when the content is shorter than its 900 dp viewport; (b) the following tests then failed at the Shop header, cascading from (a) and from an unawaited `act()`; (c) one run stalled for about 20 minutes under memory pressure (W18-02) and was stopped; (d) the Amharic test hung: its fake server repeated the cursor `page-2` forever, so the list kept asking for a "next" page that added nothing.
- **Reproduction:** The first versions of the WO-018 Shop block (`G:\AdulisDevelopment\WO-018\logs\jest-shop-*.log`).
- **Root cause:** Test design: (a) a first page shorter than the viewport; (b) an unawaited `act()`; (d) a fake server that a real API would never be (cursors do not repeat).
- **Fix:** First pages of 20 items (taller than the viewport), arrivals checked through the spoken count and the requests (rows past the window are not mounted), the same-frame `act()` awaited, and a last page without a cursor.
- **Commit:** `38780ea`
- **Regression test:** n/a (the tests themselves)
- **Verification:** `shop.test.tsx` 24/24 together.
- **Current status:** RESOLVED
- **Remaining risk:** (d) shows the app keeps asking while a server returns a repeating cursor. The contract's cursors never repeat, so this is noted, not changed.
- **Founder decision required:** No

### W18-07

- **Issue ID:** W18-07
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected component:** Mobile Jest environment
- **Expected behavior:** Tests run at an ordinary font scale unless they say otherwise.
- **Actual behavior:** The Jest window reports a font scale of 2, so every existing screen test ran in what WO-018 defines as large text (one-column grids, full names). They still pass. WO-018 tests that depend on the scale set it explicitly with `Dimensions.set` and restore it.
- **Reproduction:** `Dimensions.get('window')` under jest-expo returns `fontScale: 2`.
- **Root cause:** React Native's Jest mock of the device dimensions.
- **Fix:** No global change (it would alter every suite); scale-dependent tests set the scale.
- **Commit:** n/a
- **Regression test:** `shop.test.tsx` WO-018 name tests (1.0, 1.15, 1.3, 1.6).
- **Verification:** PASS
- **Current status:** RESOLVED (documented)
- **Remaining risk:** A future two-column assertion must set the font scale first.
- **Founder decision required:** No

### W18-08

- **Issue ID:** W18-08
- **Severity:** MEDIUM
- **Category:** Development-environment issue (with test failures)
- **Affected component:** Android emulator `Adulis_Pixel_8a_API_37`, development machine memory and C:
- **Expected behavior:** The emulator stays up through a native battery; C: stays well above 10 GB.
- **Actual behavior:** First native run (`names`, five flows): every flow failed at launch (see W18-09). During that run C: fell from 26.96 GB to 13.18 GB free and the system-managed page file grew from 23.8 GB to 30.0 GB; the emulator then exited on its own (no qemu process, adb device gone). Its exit returned about 12 GB of C:. An unrelated game held 9.3 GB of private memory throughout.
- **Reproduction:** `G:\AdulisDevelopment\WO-018\logs\native-names.out`.
- **Root cause:** Memory and commit pressure (W18-02): the emulator (4 GB guest) plus the game exceed physical memory; the page file and the emulator's own files grow on C:.
- **Fix:** None to the environment (no page-file change, the game is not closed). Mitigation: the emulator was restarted with its temp on the SSD and an attempted `-memory 2048` (not applied: the guest still reported about 4 GB), the C: gate before every flow, and the emulator stopped after native work.
- **Commit:** n/a
- **Regression test:** n/a
- **Verification:** The second native run's results are in `WO-018-NATIVE-ACCESSIBILITY-VALIDATION.md`.
- **Current status:** OPEN (as W18-02)
- **Remaining risk:** Native runs can stop part-way while the game runs.
- **Founder decision required:** Yes (with W18-02).

### W18-09

- **Issue ID:** W18-09
- **Severity:** LOW (development) / observation for production
- **Category:** Test-harness issue; observation on app behaviour
- **Affected component:** `G:\AdulisDevelopment\tools\review\wo018-native.sh`; the app's device registration
- **Expected behavior:** Native flows start on the Buyer Home feed.
- **Actual behavior:** For You showed "The request is not valid." on launch, so every first-run flow failed at its first assertion. The emulator kept the app's install, registered against the database that `morning-start.sh prepare` had just rebuilt; the server no longer knew the device and answered 400 VALIDATION_FAILED on `X-Adulis-Device` (reproduced with curl: a registered device gets 200, an unknown one 400).
- **Reproduction:** `prepare`, then any flow that does not clear the app's state first.
- **Root cause:** Harness order. The WO-015..017 batteries began with a clearing flow by chance.
- **Fix:** The WO-018 harness runs `foundation-smoke.yaml` (clearState) first.
- **Commit:** n/a (harness outside the repository)
- **Regression test:** n/a
- **Verification:** see the second native run.
- **Current status:** RESOLVED for the harness
- **Remaining risk:** Observation, not changed in this frontend work order: when the server does not know a device the app believes registered, Home shows a generic error with a Try again that cannot succeed; the app does not re-register. A server that forgets devices is not expected outside a rebuilt test database. Recorded for a future device-lifecycle decision.
- **Founder decision required:** No (observation)

### W18-10

- **Issue ID:** W18-10
- **Severity:** LOW (three findings); INFO (five)
- **Category:** Security finding
- **Affected component:** `SaveToCollection.tsx`, `SavedScreen.tsx` (`NewCollection`), `CollectionScreen.tsx`
- **Expected behavior:** Nothing is announced after a session ends; a Create and a tick never overlap; Remove, Rename and Delete never run together.
- **Actual behavior:** Independent read-only review of `ec8e1a1..38780ea` (no Critical, High or Medium): F1 an "Added to {name}" announcement could follow an await without re-checking the session; F2 a tick during a New collection Create could make the Create's fill return silently; F3 Remove, Rename and Delete relied on React state across controls (same-frame taps could run two, a pre-existing double Delete path included). Info: F4 a column-count remount drops NewCollection's idempotency intent (needs a live font-scale change plus a lost answer); F5 the typed phone is read at more Delete Account steps (the same visible text, no code or ticket); F6 the Buyer's own Collection names are spoken; F7 a never-advancing cursor (pre-existing, W18-06); F8 Delete Account's Retry has no ref guard (read-only call).
- **Reproduction:** The review report (development report, Security).
- **Root cause:** Guards written per control rather than per screen; one missing re-check after an await.
- **Fix:** F1 re-check after the re-read; F2 NewCollection reports its Create to the picker's lock (`onBusyChange`) and a refused fill is said; F3 one screen-level ref lock checked first by Remove, Rename and Delete (also inside the dialog). F4-F8 accepted as recorded.
- **Commit:** `67ecf4b`
- **Regression test:** `saved.test.tsx` "WO-018 security review fixes (F1-F3)".
- **Verification:** `saved.test.tsx` 32/32.
- **Current status:** RESOLVED (F1-F3); ACCEPTED (F4-F8)
- **Remaining risk:** F4 (very unlikely duplicate Collection); backend enforcement was not reviewed (frontend review only).
- **Founder decision required:** No

### W18-11

- **Issue ID:** W18-11
- **Severity:** MEDIUM (verification gap)
- **Category:** Development-environment issue (blocks a required verification)
- **Affected component:** TalkBack validation of the Buyer journeys (work order section 14)
- **Expected behavior:** The Buyer journeys exercised with TalkBack on the emulator, results recorded.
- **Actual behavior:** Not carried out. TalkBack is installed on the emulator image (`com.google.android.marvin.talkback`) and a keyboard-driven session with an accessibility-event record was prepared (`G:\AdulisDevelopment\tools\review\talkback.sh`), planned after the Maestro flows. The emulator exited twice and C: fell to 9.78 GB and 5.78 GB free (W18-08), so native work stopped before it. TalkBack was never switched on.
- **Reproduction:** `WO-018-NATIVE-ACCESSIBILITY-VALIDATION.md`, sections 3 and 5.
- **Root cause:** W18-02 / W18-08 (memory and C: with the emulator running beside another heavy program).
- **Fix:** None possible in this session without closing the user's program or changing the page file. A manual TalkBack script is in `WO-018-MANUAL-REVIEW-GUIDE.md` section 3.
- **Commit:** n/a
- **Regression test:** n/a (Jest asserts the app's announcements and focus requests; that is not a TalkBack test)
- **Verification:** PENDING
- **Current status:** OPEN
- **Remaining risk:** Announcement timing, focus landing (150 ms delay), and reading order are unverified with a real screen reader.
- **Founder decision required:** Yes: run the manual script, or free the machine for a TalkBack session (see W18-02).

### W18-12

- **Issue ID:** W18-12
- **Severity:** MEDIUM
- **Category:** Application defect (found natively)
- **Affected component:** `apps/mobile/src/buyer/PublicListView.tsx` (`useLargeText`)
- **Expected behavior:** From Android's 130% font size, grids are one column and Product names are shown in full.
- **Actual behavior:** At 130% the Shop stayed two columns and cut the long name to two lines (native screenshot `paging-open`, `a11y-01-shop-first-page.png`). At 160% it worked.
- **Reproduction:** `adb shell settings put system font_scale 1.3`, open the Shop.
- **Root cause:** Android reports the font scale as a 32-bit float: 1.3f arrives in JavaScript as 1.2999999523, below the 1.3 threshold. The Jest tests set exactly 1.3 and could not see it.
- **Fix:** Rounded percentages are compared (`Math.round(fontScale * 100) >= 130`).
- **Commit:** `80dbc39`
- **Regression test:** `shop.test.tsx` "at 130% the grid is already one column (as Android reports it) ..." uses `Math.fround(1.15)` and `Math.fround(1.3)`.
- **Verification:** Jest PASS. Native re-verification: PENDING (W18-08).
- **Current status:** RESOLVED in code; native re-check pending
- **Remaining risk:** iOS reports other values (for example 1.235 and 1.353); 1.353 counts as large text, 1.235 does not.
- **Founder decision required:** No

### W18-13

- **Issue ID:** W18-13
- **Severity:** LOW
- **Category:** UX/accessibility issue (found natively; existed before WO-018)
- **Affected component:** Seller Profile tab bar (`SellerProfile.tsx`), Search tabs (`app/(buyer)/search.tsx`), `FilterTabs` (`SavedScreen.tsx`: Saved and a Collection)
- **Expected behavior:** Tab labels stay whole words at large text.
- **Actual behavior:** At 160% the Seller Profile's "Products" tab broke as "Product" / "s" (native screenshot `tabs-1.6-dark`, `a11y-06-seller-products.png`): four equal-width tabs are narrower than the word.
- **Reproduction:** Font size 160%, open a Seller Profile.
- **Root cause:** `flex: 1` gives every tab the same width regardless of its label.
- **Fix:** `useTabLayout`: equal widths at ordinary sizes; from 130% each tab is at least its label's width and the row wraps. Applied to all three tab rows. Ordinary text keeps today's layout.
- **Commit:** `80dbc39`
- **Regression test:** `seller-profile.test.tsx` "WO-018 (W18-13): tab labels at large text".
- **Verification:** Jest PASS. Native re-verification: PENDING (W18-08).
- **Current status:** RESOLVED in code; native re-check pending
- **Remaining risk:** At the largest sizes the tabs take two rows; the selected tab is still marked by its underline and its selected state.
- **Founder decision required:** No

### W18-14

- **Issue ID:** W18-14
- **Severity:** LOW
- **Category:** Development-environment issue (dependency drift, not caused by WO-018)
- **Affected component:** `apps/mobile/package.json` (`expo`, `expo-sqlite`)
- **Expected behavior:** Expo Doctor 20/20 (as in WO-017).
- **Actual behavior:** Expo Doctor 1.21.6 at `e00ff88`: 19/20. "Patch version mismatches": `expo` expected ~58.0.25, found 58.0.24; `expo-sqlite` expected ~58.0.17, found 58.0.16.
- **Reproduction:** `npx expo-doctor@1.21.6` in `apps/mobile` (`G:\AdulisDevelopment\WO-018\logs\gates\expo-doctor.log`).
- **Root cause:** Expo published patch releases after WO-017; Expo Doctor compares against the newest SDK 58 versions. WO-018 changed no dependency (`package.json` and `pnpm-lock.yaml` are unchanged since `ec8e1a1`).
- **Fix:** None in this work order. Upgrading changes the lockfile and a native module (`expo-sqlite`), which needs a native rebuild: a dependency work order.
- **Commit:** n/a
- **Regression test:** n/a
- **Verification:** n/a
- **Current status:** OPEN
- **Remaining risk:** None known to users; the patches' changelogs were not reviewed here.
- **Founder decision required:** No (schedule with the next dependency maintenance)
