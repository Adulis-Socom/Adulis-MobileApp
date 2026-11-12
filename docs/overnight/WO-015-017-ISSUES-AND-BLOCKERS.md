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
