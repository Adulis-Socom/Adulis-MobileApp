# WO-015 to WO-017 -- Issues and blockers

Batch WO-015 (in-conversation Product selector), WO-016 (messaging UX and reliability) and WO-017
(Buyer frontend stabilization), 12 November 2026. Starting point:
`mobile/wo-014-product-context-messaging` at `c8efdb8424ddda79505a5eb597ecc33944b76c2c`.

This file records every significant bug, regression, blocker, test failure, security finding and
environment issue found during the batch, when it is found. It is separate from the reports. A
resolved issue keeps its original description. The central register
(`docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md`) is updated where an entry applies.

Categories: Application defect; Security defect; UX/accessibility issue; Test-harness issue;
Development-environment issue; Backend contract gap; Founder policy decision.

## Issues

### B-001

- **Issue ID:** B-001
- **Work order:** WO-015 (batch start)
- **Date/time discovered:** 2026-11-12, batch start
- **Severity:** MEDIUM
- **Category:** Development-environment issue
- **Affected component:** Development machine (C:, physical memory)
- **Expected behavior:** Enough free memory and C: space for Metro, the emulator, Docker and Jest together.
- **Actual behavior:** At the start, 2.17 GB of 15.71 GB physical memory free and the system-managed page file at 29.4 GB allocated (ON-20261111-161); C: 26.60 GB free.
- **Steps to reproduce:** Measure at the batch start (`G:\AdulisDevelopment\WO-015\logs\checkpoint-start.json`).
- **Root cause:** Memory pressure from Docker/WSL, the IDE and earlier work; the page file is system-managed.
- **Files affected:** None.
- **Fix implemented:** None (the page file is not to be changed). Mitigation: the emulator runs only for native validation and is stopped before the gates; Jest runs with `--maxWorkers=2`.
- **Regression test:** n/a
- **Verification result:** Measured before and after each native run (each work order's storage section).
- **Current status:** OPEN
- **Remaining risk:** C: can fall toward the 10 GB gate during long native runs.
- **Founder decision required:** Yes (ON-20261111-161: page-file policy or a reboot before long native batches).

### B-002

- **Issue ID:** B-002
- **Work order:** WO-015
- **Date/time discovered:** 2026-11-12, WO-015 development (Jest)
- **Severity:** LOW
- **Category:** Application defect
- **Affected component:** `apps/mobile/src/buyer/Conversation.tsx` (finding the conversation's Seller in the Buyer's list)
- **Expected behavior:** When the open conversation is not on the first page of the Buyer's conversation list, the screen reads the next pages (bounded) until it finds it.
- **Actual behavior:** The walk stopped after the second page. A conversation on page 3 or later was never found, so its Product context showed "checking" and could not be sent. Existing since the WO-014 review fix (`a4c7229`), whose test only went to page 2.
- **Steps to reproduce:** 100 newer conversations, open an older one; only pages 1-2 are requested.
- **Root cause:** The effect re-ran only on a change of its dependencies. After page 2 arrived, the fetching flag rose and fell within one batched render and "can walk" stayed true, so nothing changed and the effect did not run again.
- **Files affected:** `apps/mobile/src/buyer/Conversation.tsx`
- **Fix implemented:** The number of pages read is now a dependency (it changes on every page). The walk is also bounded to four pages (`MAX_LIST_PAGES`), after which Product selection is off with an explanation (WO-015 section 9: no unbounded traversal).
- **Regression test:** `chat.test.tsx` "a conversation beyond the first pages of the list: Product selection is off and says why; plain messages still send" (asserts exactly 4 list pages).
- **Verification result:** PASS (chat.test.tsx 58/58; mobile 391/391).
- **Current status:** RESOLVED (commit `b052307`)
- **Remaining risk:** A conversation older than the Buyer's 100 most recent cannot have a Product attached until the API publishes a Seller id or a conversation read by id (ON-20261111-162).
- **Founder decision required:** No

### B-003

- **Issue ID:** B-003
- **Work order:** WO-015
- **Date/time discovered:** 2026-11-12 12:30 (first WO-015 native run)
- **Severity:** MEDIUM
- **Category:** Development-environment issue
- **Affected component:** Development machine C: drive during native validation
- **Expected behavior:** C: stays above the 10 GB gate while the emulator runs.
- **Actual behavior:** C: fell from 26.60 GB free (batch start) to 9.92 GB within minutes of starting the emulator; the harness blocked `sel-select`, `sel-select2` and `sel-view` (correctly). Physical memory free 0.35 GB; commit 43.4 of 45.5 GB; page file 30.5 GB allocated. An unrelated game process (`CrimsonDesert.exe`, started 08:55) held about 10 GB of committed memory; the emulator (`qemu-system-x86_64`) about 5.9 GB.
- **Steps to reproduce:** Start the emulator while the machine's commit charge is near its limit.
- **Root cause:** Commit pressure. The emulator's footprint on C: comes back when it stops (C: 35.60 GB free after stopping it). Docker's disk image (47 GB) and the page file did not grow materially in this window.
- **Files affected:** None.
- **Fix implemented:** None to the system (the page file, the founder's game and other projects' Docker data are out of bounds). Mitigation: the emulator runs only while flows run and stops right after; the 10 GB gate is kept.
- **Regression test:** n/a
- **Verification result:** After stopping the emulator, C: 35.60 GB free.
- **Current status:** OPEN (mitigated)
- **Remaining risk:** Native runs can block again while other heavy programs run.
- **Founder decision required:** Yes (ON-20261111-161 page-file policy; close heavy programs during native validation).

### B-004

- **Issue ID:** B-004
- **Work order:** WO-015 (defect introduced in WO-014)
- **Date/time discovered:** 2026-11-12 12:35 (first WO-015 native run: "This Seller is no longer available" for Fixture Weaves)
- **Severity:** MEDIUM
- **Category:** Test-harness issue
- **Affected component:** Review launcher `G:\AdulisDevelopment\tools\review\morning-start.sh prepare` and its fixture scripts
- **Expected behavior:** `prepare` rebuilds the full review data, or says it failed.
- **Actual behavior:** The fixture script stopped on a missing helper (`solid_webp.py`, never copied from the session scratchpad when the tools moved in WO-014), and a later fixture step failed on a foreign key. Fixture Weaves stayed DRAFT and Market B's Seller was missing, yet `prepare` printed "review data ready". The WO-014 report and ON-20261111-169 called `prepare` verified on that output: that claim was wrong.
- **Steps to reproduce:** Run `morning-start.sh prepare` with the WO-014 tools folder; read `G:\AdulisDevelopment\WO-REVIEW\logs\morning-fixtures.log`.
- **Root cause:** An incomplete copy of the support files, and a `prepare` that did not check the fixture step (the fixture script always exits 0).
- **Files affected:** `G:\AdulisDevelopment\tools\review\solid_webp.py` (added), `morning-start.sh` (prepare).
- **Fix implemented:** The helper is in the tools folder. `prepare` now stops on a fixture failure or an error line in the fixture log, and checks that Fixture Weaves is ACTIVE before saying "ready".
- **Regression test:** `prepare` rerun: "review data ready: 38 Products; Fixture Weaves ACTIVE; assistant: true"; no error line in the fixture log; Fixture Weaves ACTIVE in both Markets.
- **Verification result:** PASS.
- **Current status:** RESOLVED
- **Remaining risk:** Another helper could be missing; the STOP checks now make that visible.
- **Founder decision required:** No

### B-005

- **Issue ID:** B-005
- **Work order:** WO-015
- **Date/time discovered:** 2026-11-12 12:47 (native, `sel-view` screenshot, Dark at font scale 1.3)
- **Severity:** MEDIUM
- **Category:** UX/accessibility issue
- **Affected component:** `apps/mobile/src/buyer/ProductPicker.tsx` (the picker modal)
- **Expected behavior:** The picker's title clears the status bar and Cancel clears the system navigation bar.
- **Actual behavior:** "Select a Product" was drawn under the clock and status icons, and Cancel sat on the gesture bar (the modal is drawn edge to edge). The Jest suite could not show it.
- **Steps to reproduce:** Android 17 emulator, a conversation, Select Product; see `G:\AdulisDevelopment\WO-015\maestro\sel-view\...\sel-05-picker-dark-large.png`.
- **Root cause:** A React Native `Modal` is its own window; the screen's safe-area insets do not apply inside it.
- **Files affected:** `apps/mobile/src/buyer/ProductPicker.tsx`
- **Fix implemented:** The modal content sits in its own `SafeAreaProvider` and a `SafeAreaView` (top and bottom edges).
- **Regression test:** Native `sel-view` rerun (screenshot `sel-05-picker-dark-large.png` in `sel-view-2`); the Jest picker cases still pass.
- **Verification result:** PASS. `sel-view-3` (Dark, font scale 1.3, both read back from the device before the flow): the title is below the status bar and Cancel above the navigation bar. An earlier rerun (`sel-view-2`) passed but rendered in Light at 1.0: the display settings had not applied before the flow, so it does not count as the Dark/enlarged check.
- **Current status:** RESOLVED (commit `2eda40c`)
- **Remaining risk:** None known.
- **Founder decision required:** No

### B-006

- **Issue ID:** B-006
- **Work order:** WO-015
- **Date/time discovered:** 2026-11-12 13:00 (Metro log)
- **Severity:** LOW
- **Category:** Development-environment issue
- **Affected component:** Shared Metro cache `G:\AdulisDevelopment\shared-cache\metro`
- **Expected behavior:** Metro saves its file map in the shared cache between starts.
- **Actual behavior:** "[metro-file-map] Cache write error: ENOENT ... shared-cache\metro\file-map\..." on every start (3 times in the review Metro log); each start rebuilt the file map.
- **Steps to reproduce:** Start Metro with the SSD environment; read `G:\AdulisDevelopment\WO-REVIEW\logs\metro-morning.log`.
- **Root cause:** The `file-map` folder was never created, and Metro does not create it.
- **Files affected:** `G:\AdulisDevelopment\shared-cache\metro\file-map` (created; outside Git).
- **Fix implemented:** Created the folder.
- **Regression test:** The next Metro start's log (no cache write error expected).
- **Verification result:** PASS (WO-016): the file-map cache file now exists in `shared-cache\metro\file-map`, and the two Metro starts after the fix logged no cache write error.
- **Current status:** RESOLVED
- **Remaining risk:** None.
- **Founder decision required:** No

### B-007

- **Issue ID:** B-007
- **Work order:** WO-015
- **Date/time discovered:** 2026-11-12 13:05
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected component:** `G:\AdulisDevelopment\tools\review\morning-start.sh start` (the Metro wait)
- **Expected behavior:** `start` returns within seconds once Metro answers.
- **Actual behavior:** After a Metro restart, `start` hung for over 20 minutes although Metro answered on 127.0.0.1 ("packager-status:running"). The process was stopped by hand; Metro kept running.
- **Steps to reproduce:** Stop Metro, run `start`.
- **Root cause:** Corrected in WO-016 (the original analysis was incomplete). The process that looked stuck was the subshell that backgrounds Metro: under Git Bash it stays alive with the caller's output attached, so a caller that pipes the script (`start | tail`) waits until that subshell ends. The launcher itself had finished. The unbounded `curl http://localhost:8081/status` checks were a second, real risk on this machine, where "localhost" connections can stall.
- **Files affected:** `morning-start.sh`, `wo014-native.sh` (outside Git).
- **Fix implemented:** Every probe uses `127.0.0.1` and `--max-time 5` (Metro and API, launcher and harness). The app's own API address stays `localhost`: on the device it goes through `adb reverse`. WO-016: the Metro subshell (launcher) and the API subshell (harness `api_start`) now detach their own output (`> /dev/null 2>&1 < /dev/null`).
- **Regression test:** `start` with Metro running: READY in 5.9 s. WO-016: a piped `start` that has to start Metro returned only when the Metro subshell was ended by hand (13:32-13:45, recorded here); after the detach fix, a piped `start` that started Metro returned READY in 16.9 s.
- **Verification result:** PASS.
- **Current status:** RESOLVED
- **Remaining risk:** None known.
- **Founder decision required:** No

### S-001

- **Issue ID:** S-001
- **Work order:** WO-015 (security review L-1)
- **Date/time discovered:** 2026-11-12, WO-015 independent security review
- **Severity:** LOW
- **Category:** Backend contract gap
- **Affected component:** Product selector and Product context (`Conversation.tsx`, `ProductPicker.tsx`)
- **Expected behavior:** The picker lists exactly the conversation Seller's Products.
- **Actual behavior:** The Seller is identified by handle, and a handle is unique only within a Market (`UNIQUE (market_id, handle)`). If the Buyer's session resolved to a different Market than the conversation's, another Market's Seller with the same handle could be listed and shown as the context; the server would refuse it at Send (404), so no wrong anchor is stored.
- **Steps to reproduce:** Not reproducible with today's fixtures (one Market per Account); reasoned from the schema and the contract.
- **Root cause:** No `seller_id` or Market on the conversation row or the public Product read (ON-20261111-162).
- **Files affected:** None changed.
- **Fix implemented:** None in the client (a store-name comparison would not be unique either). The server's Product scope remains the authority.
- **Regression test:** n/a
- **Verification result:** n/a
- **Current status:** OPEN
- **Remaining risk:** A mislabelled context in a cross-Market case; refused at Send.
- **Founder decision required:** No (backend work: add `seller_id`/Market to conversation rows and Product reads; confirm `?as=buyer` is Market-scoped).

### S-002

- **Issue ID:** S-002
- **Work order:** WO-015 (security review I-2, I-3, I-4)
- **Date/time discovered:** 2026-11-12, WO-015 independent security review
- **Severity:** LOW (Info findings)
- **Category:** Security defect (defence in depth)
- **Affected component:** `apps/mobile/src/buyer/Conversation.tsx`
- **Expected behavior:** No list walk for a malformed or unavailable conversation; only well-formed handles and slugs become a context; the picker never opens by itself.
- **Actual behavior:** The walk also ran for a malformed reference (up to 3 extra list reads); a server handle or slug was not shape-checked; the picker could reopen when the conversation came back into the list.
- **Steps to reproduce:** Open `/chat/not-a-conversation` with 30 conversations: page 2 was read.
- **Root cause:** Missing guards.
- **Files affected:** `apps/mobile/src/buyer/Conversation.tsx`, `apps/mobile/src/buyer/chat.test.tsx`
- **Fix implemented:** Guards on the walk, `isPathName` on the handle and the slug, the picker shown only while selection is allowed.
- **Regression test:** "review I-2" (fails without the fix), "review I-3".
- **Verification result:** PASS (chat.test.tsx 60/60; mobile 393/393).
- **Current status:** RESOLVED (commit `f7ab805`)
- **Remaining risk:** None known.
- **Founder decision required:** No

### B-008

- **Issue ID:** B-008
- **Work order:** WO-016
- **Date/time discovered:** 2026-11-12 13:47 (native `lay-view-*`, all three font scales)
- **Severity:** HIGH (the Send button unreachable with the keyboard open)
- **Category:** UX/accessibility issue
- **Affected component:** `apps/mobile/src/app/(buyer)/chat/[conversationRef].tsx` (keyboard handling) with the WO-016 composer layout
- **Expected behavior:** With the keyboard open, the composer and Send stay above the keyboard (ON-20261111-164).
- **Actual behavior:** After the first WO-016 layout change (history kept; composer content in a scroll area; Send fixed at the bottom), the history stayed visible but Send was under the keyboard at font scales 1.0, 1.3 and 1.6. The Jest suite passed: it cannot show a keyboard.
- **Steps to reproduce:** Android 17 emulator, a conversation with history, attach a Product, tap the message box (`G:\AdulisDevelopment\WO-016\maestro\lay-view-1.0-light\...\step-025-assertCondition-Send.png`).
- **Root cause:** The keyboard-avoiding view measures the keyboard against its own frame, which starts under the navigation header, so it shrank the screen by less than the keyboard's height. The bottom of the screen stayed under the keyboard. WO-014 had the same shortfall, but only the small connected-only note was hidden then (visible in its `pcm-v2-keyboard.png`); once Send became the bottom item, Send was hidden.
- **Files affected:** `apps/mobile/src/app/(buyer)/chat/[conversationRef].tsx`
- **Fix implemented:** `keyboardVerticalOffset` = the navigation header's height (`useHeaderHeight`).
- **Regression test:** Native `layout` step (`lay-view-1.0-light`, `lay-view-1.3-dark`, `lay-view-1.6-light`: "History 30" and Send visible with the keyboard open).
- **Verification result:** PASS after the fix: `lay-view-1.0-light`, `lay-view-1.3-dark`, `lay-view-1.6-light` ("History 30", the composer and Send visible with the keyboard open; screenshots `lay-03-keyboard.png`). The first run (all three FAIL) is kept in `G:\AdulisDevelopment\WO-016\logs\native-layout.out`.
- **Current status:** RESOLVED (commit `8ffa1d8`)
- **Remaining risk:** Other screens with text fields under a header may have the same shortfall (WO-017 audit).
- **Founder decision required:** No

### S-003

- **Issue ID:** S-003
- **Work order:** WO-016 (security review L1, L2)
- **Date/time discovered:** 2026-11-12, WO-016 independent security review
- **Severity:** LOW
- **Category:** Security defect (L2) and UX/accessibility issue (L1)
- **Affected component:** `apps/mobile/src/buyer/Conversation.tsx`
- **Expected behavior:** A screen reader hears the refusal the screen shows; an unconfirmed send's key cannot be replaced while a retry of it is in flight.
- **Actual behavior:** L1: a 404 on an anchored send was announced as "This conversation may not be available" while the screen said "This conversation or the Product with it...". L2 (existing since WO-014): "Edit the message instead" did not check for a send in flight; a tap landing before the re-render could clear the key, and the in-flight retry would then create a new key for the same payload (a possible duplicate).
- **Steps to reproduce:** L1: anchored send answered 404 with a screen reader on. L2: a timing window of one frame (reasoned from the code).
- **Root cause:** L1: one announcement for both cases. L2: a missing guard.
- **Files affected:** `apps/mobile/src/buyer/Conversation.tsx`, `apps/mobile/src/buyer/chat.test.tsx`
- **Fix implemented:** L1: the refusal kind (anchored or plain) is kept and announced. L2: `abandon` returns while a send is in flight.
- **Regression test:** "ON-168. a 404 on an anchored send, then a current read that answers 404" (asserts the anchored announcement). L2 has no automated test (a sub-frame race the test renderer cannot produce); the guard is one line.
- **Verification result:** PASS (mobile 400/400).
- **Current status:** RESOLVED (commit `3bbf927`)
- **Remaining risk:** None known.
- **Founder decision required:** No

### B-009

- **Issue ID:** B-009
- **Work order:** WO-017 (ON-20261111-170)
- **Date/time discovered:** 2026-11-12, WO-017 (reproducing ON-20261111-170)
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected component:** `ops/scripts/adulis-storage-audit.ps1` (cleanup reporting) and how its JSON was read
- **Expected behavior:** The text report and the JSON agree on what the cleanup removed; reports quote removed bytes, not a free-space difference.
- **Actual behavior:** ON-20261111-170 said the JSON reported "0 of 1" after 92 removals. Reproduced from the WO-014 JSON: `clean.items` lists all 92 files with `Done: true` (580,578,696 bytes), matching the 92 "removed" text lines. The "0 of 1" came from WO-014's own reading (`@($j.clean)`, the summary object, instead of `$j.clean.items`). The WO-014 report's "recovered 627 MB on G:" was the drive's free-space change during the run, which includes other activity; the files removed totalled 580,578,696 bytes.
- **Steps to reproduce:** `@($j.clean) | Where-Object Done` on any cleanup JSON gives 0 of 1.
- **Root cause:** No removed total in either output, so a reader computed one, wrongly.
- **Files affected:** `ops/scripts/adulis-storage-audit.ps1`
- **Fix implemented:** The audit now prints and writes one removed total: `removed: N file(s), B bytes` with a per-drive split (C: and the SSD separate) in the text, and `clean.removedCount`, `clean.removedBytes`, `clean.removedBytesByDrive` in the JSON. Both come only from files actually deleted. The cleanup is still dry-run-first and still deletes only verified Maestro driver APKs.
- **Regression test:** Dry run: text "removed: 0 file(s), 0 bytes" = JSON `removedCount 0, removedBytes 0`. Executed run: see WO-017 storage (after the native runs).
- **Verification result:** PASS. Dry run: 0 removed in both outputs. Executed run (WO-017 cleanup): text "removed: 193 file(s), 1,223,379,041 bytes" with "G: 1,223,379,041 bytes"; JSON `removedCount 193`, `removedBytes 1223379041`, `removedBytesByDrive {G: 1223379041}`.
- **Current status:** RESOLVED (commits `39d5abe`, `bd2b8ca`)
- **Remaining risk:** None.
- **Founder decision required:** No

### B-010

- **Issue ID:** B-010
- **Work order:** WO-017 (navigation audit; first seen in the WO-015 Metro log)
- **Date/time discovered:** 2026-11-12 13:00
- **Severity:** LOW
- **Category:** Development-environment issue
- **Affected component:** Expo Router 58 `useLinking` (development builds only)
- **Expected behavior:** No linking warning with a single navigation root.
- **Actual behavior:** "ERROR Looks like you have configured linking in multiple places" in the Metro log, 21 times across 59 bundle loads, each right after a reload of the app's JavaScript (Maestro relaunches, hot updates).
- **Steps to reproduce:** Relaunch the debug app repeatedly while Metro runs; read `G:\AdulisDevelopment\WO-REVIEW\logs\metro-morning.log`.
- **Root cause:** Expo Router's own diagnostic (`expo-router/build/fork/useLinking.native.js:61`) fires when its module-level handler list is not yet empty as a root mounts, which happens on development reloads. The check returns early in production. The app configures no linking of its own and renders one navigation root (Expo Router's); a search of `apps/mobile/src` finds no `NavigationContainer`, `linking` prop or `+native-intent`.
- **Files affected:** None.
- **Fix implemented:** None (framework, development-only). Deep links were exercised natively and behaved (WO-014/015 `openLink` steps).
- **Regression test:** n/a
- **Verification result:** Classified; no Buyer-visible effect.
- **Current status:** OPEN (no action; watch on an Expo Router upgrade)
- **Remaining risk:** Noise in development logs.
- **Founder decision required:** No

### B-011

- **Issue ID:** B-011
- **Work order:** WO-017 (ON-20261111-084)
- **Date/time discovered:** 2026-11-12 14:14 (reproduction run `foryou-1`)
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected component:** `apps/mobile/.maestro/buyer-for-you.yaml` and its fixtures
- **Expected behavior:** The dedicated For You flow passes on its own data.
- **Actual behavior:** Reproduced on a freshly rebuilt database with the twelve WO-004A Scenes. Run 1 (`foryou-1`) passed the feed, the end of the feed, the refresh and Dark, then FAILED at "Tap on System": the preceding "Tap on You" was reported done but the screen stayed on Home (screenshot `step-025-tapOnElement-System.png`). Run 2 of the same, unchanged flow (`foryou-2-after-regression`) PASSED. A Scene Explorer run between them FAILED only because that flow expects the review fixtures' captions, not the twelve For You Scenes: a pairing mistake in the harness, not a regression. The original ON-084 failure (the 120 s scroll budget) did not recur this time.
- **Steps to reproduce:** Harness step `foryou` (rebuild, the twelve-Scene fixtures, the flow).
- **Root cause:** Two harness causes. (1) A tab tap that lands while the whole tree re-renders for the theme change can be swallowed. (2) The 120 s scroll budget is tight for the tall cards on this emulator (ON-084's original failure). The flow also depends on fixtures that clash with the review data (both create `fixture-weaves`), which is why it was skipped in earlier batteries.
- **Files affected:** `apps/mobile/.maestro/buyer-for-you.yaml`; `G:\AdulisDevelopment\tools\review\fyp-native-fixtures.mjs` (stable copy) and the harness step `foryou`.
- **Fix implemented:** Each tab tap in the theme section is retried until its screen shows (the `card-saves.yaml` pattern); the two long scrolls have a 300 s budget. No assertion changed. The harness rebuilds a database for the flow, seeds the twelve Scenes, runs the flow, related regressions (smoke, shell), the flow again, removes the fixture media and restores the review data (`prepare`).
- **Regression test:** The harness step `foryou` (WO-017 native battery).
- **Verification result:** PASS: `foryou-1`, then smoke and shell, then `foryou-2-after-regression` (WO-017 native battery).
- **Current status:** RESOLVED (commit `ae34634`)
- **Remaining risk:** The flow still needs its own database (a fixture clash with the review data).
- **Founder decision required:** No

### A-001

- **Issue ID:** A-001
- **Work order:** WO-017 (accessibility audit F1)
- **Date/time discovered:** 2026-11-12, WO-017 read-only accessibility audit
- **Severity:** HIGH
- **Category:** UX/accessibility issue
- **Affected component:** Failure and screen-level error messages across the Buyer app
- **Expected behavior:** A screen-reader user hears a failure (for example "could not sign out").
- **Actual behavior:** 25 messages used `accessibilityRole="alert"` alone, which Android and iOS do not speak (the codebase's own note in `TextField.tsx`). A failed sign-out on a shared phone was silent, while a successful one was announced.
- **Steps to reproduce:** TalkBack on; make sign-out, Save or a collection removal fail.
- **Root cause:** No shared announcing component; only some sites announced.
- **Files affected:** `apps/mobile/src/components/AlertText.tsx` (new) and the sites in the commit.
- **Fix implemented:** `AlertText` announces its message when it appears or changes (no live region, to avoid double reading on Android). Used at 25 sites, plus the headlines of four screen-level failures (Messages, Notifications, Signed-in sessions, a conversation's messages). TextField, Delete Account and Verify already announced and were left as they were.
- **Regression test:** `AlertText.test.tsx`; chat.test.tsx "A-001. a conversation list that fails is announced".
- **Verification result:** PASS (Jest). Not verified with TalkBack on the device (no screen-reader automation in this environment).
- **Current status:** RESOLVED (commit `7a27128`)
- **Remaining risk:** Announcements were not heard on a real screen reader in this batch.
- **Founder decision required:** No

### A-002

- **Issue ID:** A-002
- **Work order:** WO-017 (audit F2)
- **Date/time discovered:** 2026-11-12, WO-017 audit
- **Severity:** MEDIUM
- **Category:** UX/accessibility issue
- **Affected component:** Private screens: Messages, a conversation, Notifications, Signed-in sessions, Saved
- **Expected behavior:** Offline is said as offline, distinct from loading or "no results".
- **Actual behavior:** A first read that waits for a connection stays "pending" without an error, so these screens showed "Loading" indefinitely; Saved showed the generic internal error (an empty error) instead of offline.
- **Steps to reproduce:** Lose the connection, then open Messages.
- **Root cause:** TanStack Query pauses offline; only the public read views handled `paused`.
- **Files affected:** `Conversations.tsx`, `Conversation.tsx`, `BuyerNotifications.tsx`, `AccountSessions.tsx`, `SavedScreen.tsx`
- **Fix implemented:** A paused first read shows "You are offline. Check your connection and try again."
- **Regression test:** chat.test.tsx "A-002. a private list waiting for a connection says offline".
- **Verification result:** PASS (Jest).
- **Current status:** RESOLVED (commit `7a27128`)
- **Remaining risk:** None known.
- **Founder decision required:** No

### A-003, A-004, A-005

- **Issue ID:** A-003 (Search labels), A-004 (Search "no results" not announced), A-005 (keyboard offset on Delete Account, Sign in, Verify)
- **Work order:** WO-017 (audit F3, F4, F5)
- **Date/time discovered:** 2026-11-12, WO-017 audit
- **Severity:** MEDIUM
- **Category:** UX/accessibility issue
- **Affected component:** `SearchResults.tsx`; `app/(buyer)/account/delete.tsx`, `auth/sign-in.tsx`, `auth/verify.tsx`
- **Expected behavior:** A label carries what the row shows; "no results" is spoken; the keyboard does not cover a form's buttons.
- **Actual behavior:** A-003: Search labels dropped "Sold by", "Scene by" and the trust level; the Scene tile cut the Seller to one line. A-004: "no results" was silent after the announced "Searching". A-005: the three forms had no Android keyboard handling and no header offset (the cause of B-008 in the conversation).
- **Steps to reproduce:** TalkBack on Search results; the Delete Account confirmation with the keyboard open.
- **Root cause:** Labels written before the Seller lines; a missing live region; the keyboard-avoiding view's header offset.
- **Files affected:** As above; `search.test.tsx` and two Maestro Search flows follow the new labels.
- **Fix implemented:** Labels include the Seller and trust phrases; the Scene tile wraps; "no results" is a polite live region; the three forms use Android 'height' plus the header height.
- **Regression test:** search.test.tsx (labels assert the Seller and trust phrases); native Search, sign-in and verify flows in the battery.
- **Verification result:** Jest PASS; native in the WO-017 battery.
- **Current status:** RESOLVED (commit `7a27128`)
- **Remaining risk:** The Delete Account confirmation with the keyboard was not exercised natively (its flow deletes an Account; see the WO-017 record).
- **Founder decision required:** No

### A-006

- **Issue ID:** A-006
- **Work order:** WO-017 (audit F6, F7, F8 and the focus notes)
- **Date/time discovered:** 2026-11-12, WO-017 audit
- **Severity:** LOW
- **Category:** UX/accessibility issue
- **Affected component:** `SaveToCollection.tsx`, `CollectionScreen.tsx`, `PublicListView.tsx`, `ForYouFeed.tsx`, `SellerProfile.tsx`, `SearchResults.tsx`, `DeleteAccount.tsx`
- **Expected behavior:** Busy states announced as disabled; pagination reachable without scrolling; full Product names at large text; focus kept on tab switches.
- **Actual behavior:** F6: an in-flight checkbox or Remove is shown only by opacity, other controls look enabled while ignored. F7: public lists and For You page only on scroll (Messages, Notifications and a conversation have Load buttons). F8: Product names cut to two lines in tiles. Seller Profile tab switches and Delete Account step changes unmount the pressed control (screen-reader focus lost); Delete Account's "Checking"/"Deleting" lines are not live.
- **Steps to reproduce:** See the audit (WO-017 accessibility review).
- **Root cause:** Component design predating the audit.
- **Files affected:** None changed.
- **Fix implemented:** None in this batch (recorded; each is a contained follow-up).
- **Regression test:** n/a
- **Verification result:** n/a
- **Current status:** OPEN in this batch; addressed in WO-018 (`docs/mobile/WO-018-ISSUES-AND-BLOCKERS.md`, W18-01)
- **Remaining risk:** Degraded but workable for screen-reader and large-text users.
- **Founder decision required:** No

### B-012

- **Issue ID:** B-012
- **Work order:** WO-017
- **Date/time discovered:** 2026-11-12 14:47 (native `jrn-j4`)
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected component:** `apps/mobile/.maestro/buyer-journeys.yaml` step j4
- **Expected behavior:** The flow proves a Product was saved, then opens it from Saved.
- **Actual behavior:** FAIL. After tapping Save, the wait for "Saved" matched the Saved tab label (still in the view hierarchy behind the Product screen), so it did not prove the save; the screenshot still showed "Save". The next tap on "Saved" could not reach the covered tab, and the flow stopped on the Product screen.
- **Steps to reproduce:** Run `jrn-j4`.
- **Root cause:** An ambiguous selector and a tab covered by a stack screen (the flow, not the app).
- **Files affected:** `apps/mobile/.maestro/buyer-journeys.yaml`
- **Fix implemented:** Tap Save, go Back to the tabs, open Saved, and require the Clay cup in the Saved list (a stronger proof of the save).
- **Regression test:** `jrn-j4` rerun.
- **Verification result:** PASS (`jrn-j4` in the isolated rerun).
- **Current status:** RESOLVED (commit `bd2b8ca`)
- **Remaining risk:** None.
- **Founder decision required:** No

### S-004

- **Issue ID:** S-004
- **Work order:** WO-017 (security review)
- **Date/time discovered:** 2026-11-12, WO-017 independent security review
- **Severity:** LOW
- **Category:** UX/accessibility issue (L), Test-harness issue (L)
- **Affected component:** `AccountSessions.tsx`, `BuyerNotifications.tsx`, `Conversation.tsx`, `Conversations.tsx`; `ops/scripts/adulis-storage-audit.ps1`
- **Expected behavior:** A failure is read once; the audit's per-drive totals are right for any path.
- **Actual behavior:** The review found no Critical, High or Medium issue. It confirmed every announcement is a catalogue sentence or `failureMessage` (no phone, code, token or internal id). Lows: (1) four failure headlines (`AlertText`) sit inside a `View` with the alert role too, so a screen reader may read them twice; (2) the audit's drive key used `Substring(0,1).ToUpper()`, wrong for a UNC path and culture-sensitive. Info: `AlertText` announces again when a recycled row remounts; tabs that stay mounted may announce "offline" in the background (no data yet only).
- **Steps to reproduce:** Reasoned from the code (review).
- **Root cause:** Nested alert roles after the WO-017 conversion; a naive drive parser.
- **Files affected:** As above.
- **Fix implemented:** (1) The wrapper views lose the alert role (the headline announces). (2) `[IO.Path]::GetPathRoot(...)` with an invariant upper-case. The re-announcement notes are accepted (fixed sentences, only on failures).
- **Regression test:** The mobile suite (A-001 test) and the audit dry run.
- **Verification result:** PASS (mobile 403/403; the audit's executed run above).
- **Current status:** RESOLVED (commit `bd2b8ca`)
- **Remaining risk:** Re-announcements on remount (Info, accepted).
- **Founder decision required:** No

### B-013

- **Issue ID:** B-013
- **Work order:** WO-017
- **Date/time discovered:** 2026-11-12 14:50-15:57 (WO-017 native battery and reruns)
- **Severity:** LOW
- **Category:** Test-harness issue
- **Affected component:** Maestro flows that tap the You tab right after launch
- **Expected behavior:** The tap opens You.
- **Actual behavior:** Intermittent: `sel-select`, `sel-select2`, `msg-reopen` and `account-sign-out-m` failed in the battery (14:50-15:20). In isolated reruns `msg-reopen`, the sign-out and `sel-select` passed, and `sel-select2` failed again with the screen still on Home after "Tap on You" was reported done (screenshot `step-008-scrollUntilVisible-Messages.png`). Other runs of the same flows passed (WO-014 to WO-016, `jrn-j5`, the layout steps).
- **Steps to reproduce:** Launch, wait for For You, tap You at once; repeat the flow several times.
- **Root cause:** The same as B-011: a tab tap that lands while the screen re-renders (here the For You feed loading) is not delivered. Not reproduced by hand; a Buyer whose first tap is ignored taps again.
- **Files affected:** `conversation-product-selector.yaml`, `messaging.yaml`, `messaging-layout.yaml`, `buyer-journeys.yaml`, `account.yaml`
- **Fix implemented:** The You tap is retried until "Appearance" shows (the `card-saves.yaml` pattern). No assertion changed.
- **Regression test:** The selector step rerun: all PASS (`native-selector-final.out`).
- **Verification result:** PASS.
- **Current status:** RESOLVED
- **Remaining risk:** Other flows that tap a tab right after launch (for example `saved-states`, `shop-signed-in`) may show the same flake; they keep their existing form.
- **Founder decision required:** No
