# Overnight handoff -- 12 November 2026 (WO-011, WO-012, WO-013)

Buyer Mobile: Account management, the notification inbox and Buyer-Seller messaging, built on the
existing backend. To try it yourself, follow `MORNING-REVIEW-GUIDE-2026-11-12.md`.

## Executive summary

- **Completed:** 2 work orders, WO-012 (Notifications) and WO-013 (Messaging, on the supported
  subset of the Chat design).
- **Partially completed:** 1, WO-011 (Account). Every supported control is built; Edit Profile is
  blocked because no Buyer profile exists in any design or API.
- **Blocked:** 0.
- **Built:**
  - The You tab: Preferences, live sessions, Sign out, Delete Account on the existing
    deletion-ticket flow.
  - A real Buyer notification inbox with per-row read state.
  - Message Seller, a Messages list, conversations with attributed messages, connected-only
    sending and Ask the Seller.
- **Security:** three independent read-only reviews. No Critical and no High finding. Every
  Medium (three) and every client-side Low was fixed before its checkpoint. Server-side items are
  in the register.
- **Tests:**
  - Mobile 352/352 (61 new tests).
  - API 983/983 in the bounded run. The parallel run was NOT fully green: 3 suites failed on known
    cross-suite interference and each passed alone (ON-126).
  - Every verify and engineering gate is green; Expo Doctor 20/20.
  - Android native flows pass. iOS was not tested.
- **Decisions you need to make:** the deletion lifecycle and session binding; the Buyer profile;
  Buyer notification copy; how bot answers render; the Chat policy items (see "Founder decisions").

## Work orders

| Work order | Status | Branch | HEAD | Tests | Native |
|---|---|---|---|---|---|
| WO-011 Buyer Account | PARTIAL (Edit Profile: no contract) | `mobile/wo-011-buyer-account` | `e598312073c730bfa47e35581db470e31aab8f2e` | account.test.tsx 28/28; mobile 319/319 at checkpoint | 11 flows PASS (account, sessions, Language, Dark 1.3, sign-out, deletion of a disposable Account) + 3 regressions PASS |
| WO-012 Notifications | COMPLETE | `mobile/wo-012-buyer-notifications` | `37bfd566112ebde9429c7b6d277eea63a3a9be5a` | notifications.test.tsx 14/14; mobile 333/333 at checkpoint | 7 flows PASS (inbox, mark read, refresh, load older, Dark 1.3, guest) + 2 regressions PASS |
| WO-013 Messaging | COMPLETE (supported subset; Chat design not complete) | `mobile/wo-013-buyer-messaging` | the commit carrying this document; code at `85d3cc3` (exact SHA in the overnight report) | chat.test.tsx 19/19; mobile 352/352; full gates | 10 messaging flows PASS; final regression 14 of 15 PASS plus categories Dark 1.3 PASS (card-saves dark is order-dependent, ON-159) |

Branches stack: WO-010A `e00706f` -> WO-011 -> WO-012 -> WO-013. Each was pushed before the next
began. Nothing was merged.

## What works, and how far

| Feature | Real API | Controlled test data only | UI built, backend missing | Deferred |
|---|---|---|---|---|
| You: Preferences (Appearance, Language) | -- (device settings) | | | Persistence across launches (ON-133) |
| You: sessions list, This device, Refresh, Sign out | Yes | | | Signing out other sessions (CONSOLE plus step-up only, ON-134) |
| Delete Account (code, preview, blockers, typed DELETE, server-confirmed) | Yes (the immediate ticket flow) | Tested only with disposable Accounts | | The design's deletion lifecycle (cooling-off, status) (ON-129) |
| Edit Profile | | | No Buyer profile exists anywhere | Blocked (ON-132) |
| Notifications inbox, Mark as read, Load older, Refresh | Yes | Rows inserted for a test Account (no Buyer flow produces notifications yet) | | Mark all read (the server's is Account-wide, ON-139); push (ON-145); destinations (ON-144) |
| Notification wording | | | Every row shows the generic sentence: no approved Buyer copy (ON-141) | |
| Message Seller, Messages list, conversation, send, attribution | Yes | | | Product, Scene and Order subjects (ON-149, ON-151) |
| Automated answers | Yes (escalation line) | A disposable intent for one fixture Seller | Keyword answers show a neutral line: no rendering contract (ON-152) | |
| Ask the Seller | Yes | | | A waiting-for-human status (ON-155) |

## Remaining issues

- **New:** ON-20261111-129 to -160 (32 entries).
- **Security, all server-side and open:**
  - the Buyer notification scope is a deny-list (ON-146);
  - timestamp-only cursors in notifications and chat (ON-142, ON-153);
  - same-instant chat ordering (ON-153);
  - Seller-written bot answers never shown (ON-152);
  - self-conversation allowed (ON-154).
- **Missing backend contracts:**
  - no response schemas for deletion, notifications or chat (ON-135, ON-140, ON-150);
  - read-all scope (ON-139);
  - no Buyer profile (ON-132);
  - Chat design rows (ON-149, ON-155).
- **Environment:** an unexplained transient 4.3 GB dip on C: during WO-011, recovered on its own
  (ON-136); an Expo Doctor network timeout, which passed on rerun (ON-160).
- **Old issues touched:**
  - ON-126: the parallel run is still not consistently green (recorded, not hidden).
  - ON-084: `buyer-for-you.yaml` was not run natively; For You was covered by Scene Explorer and
    Jest.
  - ON-123 (cold-cache timeouts) did not recur: the caches were warm.
  - ON-128 is unchanged.
- **Preserved, untouched:** ON-114, -115, -116, -087, -088, -090, -091, -079, -080, -111, -122,
  -124, and the payment deferral.

## Testing

| Suite | Result |
|---|---|
| Mobile Jest | 352/352 (22 suites; WO-011 +28, WO-012 +14, WO-013 +19) |
| API Jest, bounded run (`--maxWorkers=2`) | 983/983 |
| `pnpm test` (all workspaces, parallel) | NOT green: apps/api 962 of 964 passed, 3 suites failed on cross-suite interference (OTP ceiling, global nudge, global commerce count). Each passed alone (19/19, 24/24, 26/26). ON-126 stays open |
| Root typecheck, lint, build | Pass |
| `pnpm install --frozen-lockfile` | Pass |
| Generated client (`@adulis/api-client` tests, `generate:check`) | Pass |
| Verify gates (contract, appendix, docs, deps, mt-keys, error-locale) | Pass |
| db:check (16), db:determinism, orphan sweep | Pass |
| gates.mjs: deps-fires, contract-prefix, extensions, worker-schema, appendix-c, deferred-values, trust-before-open-signup, no-unsafe-eval, production-react, contract-current, transcription, surface-markers, tokens, render-yaml, console-e2e, boot-smoke | Pass |
| Expo Doctor 1.21.6 | 20/20 (the first run timed out reaching exp.host, ON-160) |
| Android native (emulator, WO-010A APK reused; no native change) | WO-011 14/14, WO-012 9/9, WO-013 10/10 messaging; final regression 14/15 + categories Dark 1.3 PASS (the failure is the order-dependent card-saves dark step, ON-159). Skipped: `buyer-for-you.yaml` (ON-084) |
| iOS | Not tested |

## Founder decisions (genuinely yours; nothing was approved on your behalf)

1. **Account deletion:**
   - the design's lifecycle (step-up, states, cooling-off, status) versus the immediate ticket
     flow Mobile uses (ON-129);
   - whether Mobile deletion must be bound to the signed-in session (ON-130).
2. **Buyer profile:** define its fields before Edit Profile (ON-132).
3. **Device preferences:** approve a store so Appearance and Language persist (ON-133).
4. **Sessions:** may Buyers sign out other sessions from Mobile (ON-134)?
5. **Translation:** a HUMAN-REQUIRED ruling for the typed-confirmation strings (ON-131).
6. **Buyer notification copy,** per template (ON-141); Account security notices for Buyer-only
   Accounts (ON-143); the push provider and permission moment (ON-145).
7. **Chat:**
   - how bot answers reach clients (ON-152);
   - staff labels, bot brand, Operator messages, blocking, reporting (ON-156);
   - self-conversation (ON-154);
   - Chat backend priorities (ON-149, ON-155);
   - whether Messages gets its own tab.
8. **Still pending from before (unchanged):**
   - ON-114 (amendment A4), ON-115 (Addis Ababa activation), ON-116 (Seller category);
   - ON-087, -088, -090, -091 (Collections);
   - ON-079, -080 (Search);
   - ON-111, -122, -124 (environment);
   - the payment architecture.

## Storage

| | WO-011 | WO-012 | WO-013 |
|---|---|---|---|
| C: free at start | 16,315,011,072 | 20,001,128,448 | 19,801,669,632 |
| C: free after testing | 19,989,479,424 | 19,810,607,104 | 19,510,648,832 |
| C: free after cleanup | 20,002,234,368 | 19,807,621,120 | 19,537,113,088 |
| G: free at start | 3,362,530,525,184 | 3,361,867,825,152 | 3,361,452,589,056 |
| G: free after testing | 3,361,541,718,016 | 3,361,293,205,504 | 3,360,176,472,064 |
| G: free after cleanup | 3,361,877,262,336 | 3,361,462,026,240 | 3,360,676,642,816 |
| Temporary files cleaned | 50 Maestro driver APKs, 315,531,900 B | 26 APKs, 164,076,588 B | 74 APKs, 466,987,212 B |

- **Generated.** Each work order wrote Maestro evidence (kept), logs and TEMP files to its own
  folder on the SSD. The shared Jest and Metro caches were reused, and no new native build was
  made.
- **Unusual growth.** During WO-011, C: fell 4.31 GB with no Adulis location growing, then
  recovered by itself (ON-136).
- **Stable.** The page file stayed at about 38.8 GB, and Docker's disk was unchanged.
- **Protected files preserved:** `G:\Android\`, `G:\w2`, `G:\w2x`, `G:\wo001a`, `G:\w10a`,
  `G:\adulis-claude-scratch-archive`, Docker volumes, the Node compile-cache policy (unchanged).

## Records

- **WO-011:** `docs/mobile/WO-011-BUYER-ACCOUNT.md`, `WO-011-SECURITY-PRIVACY.md`,
  `WO-011-FOUNDER-HANDOFF.md`.
- **WO-012:** `docs/mobile/WO-012-BUYER-NOTIFICATIONS.md`, `WO-012-FOUNDER-HANDOFF.md`.
- **WO-013:** `docs/mobile/WO-013-BUYER-MESSAGING.md`, `WO-013-CHAT-CONTRACT-GAPS.md`,
  `WO-013-FOUNDER-HANDOFF.md`.
- **Register:** `docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md` (160 entries).
