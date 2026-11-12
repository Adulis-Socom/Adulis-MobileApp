# WO-017 -- Buyer frontend stabilization

Work order WO-017 (12 November 2026). Branch `mobile/wo-017-buyer-frontend-stabilization`, from the
WO-016 checkpoint `a610a413f9fa9f666d9123678e4fbc4888f826dd`. A quality and reliability pass over
the existing Buyer app. There is no new feature, no backend change and no redesign. Production For
You stays disabled.

## 1. What changed

| Area | Change | Issue |
|---|---|---|
| Accessibility | Failures and screen-level errors are announced (`AlertText`, 25 sites + 4 headlines) | A-001 |
| Offline | Private screens say offline instead of loading forever; Saved says offline | A-002 |
| Search | Labels carry the Seller and trust level; "no results" is spoken; the Scene tile's Seller line wraps | A-003, A-004 |
| Keyboard | Delete Account, Sign in, Verify: the conversation's keyboard fix (header offset) | A-005 |
| For You native flow | Tab taps retried during the theme change; 300 s scroll budget; its own data in the harness | ON-084, B-011 |
| Storage audit | One removed total in the text and the JSON, by drive | ON-170, B-009 |
| Review tooling | `prepare` stops on fixture failures (B-004, WO-015); the launcher's subshell detached (B-007); the Metro cache folder (B-006) | -- |

Details: `WO-017-ACCESSIBILITY-REVIEW.md` and `docs/overnight/WO-015-017-ISSUES-AND-BLOCKERS.md`.

## 2. Navigation (section 23)

| Journey | How verified |
|---|---|
| For You -> Scene -> Product -> Seller Profile -> Product -> Ask Seller -> Conversation | Native `buyer-journeys.yaml` j1 |
| Shop -> Category -> Product -> Ask Seller -> Conversation -> Back | Native j2 |
| Search -> Product -> Seller Profile -> Messages | Native j3 |
| Saved -> Saved Product -> Product Detail -> Ask Seller | Native j4 |
| You -> Messages -> Conversation -> Back | Native j5 |
| Guest sign-in continuation; returning from authentication | Native WO-014 Journey C (`pcm-guest`, `pcm-guest-in`), Saved guest continuation (`saved-guest-1/2`) |
| Account switching | Native `pcm` E (another Account), Jest WO-013 "21", WO-015 "20, 21" |
| Invalid route parameters | Jest: malformed conversation and Product references (WO-014 "18", WO-015 "review I-2") |
| Expired sessions | Existing session tests (a 401 ends only its own session); not re-tested natively |
| Deleted or unavailable Products | Native WO-014 Journey D (`pcm-d-*`); Jest WO-015 "13", "15" |
| No unintended duplicate screens | Singular routes (Product, Scene, Seller, conversation) keep one screen per key; Jest WO-014 "review L-3" |

**Navigation finding (B-010):** a development-only Expo Router warning ("linking configured in
multiple places") appears after some reloads. The app has one navigation root and no linking
configuration of its own. No Buyer effect; recorded.

## 3. Offline and error consistency (section 25)

- **"No results" versus "could not load":** distinct on Shop, Search, the Seller tabs, Saved, the
  picker, Messages and Notifications (public lists through the shared list view; private lists
  checked in the audit).
- **Offline:** public reads already said offline. Private reads now do too (A-002).
- **Not found:** shown only on a server 404 (a current read). A network failure is never treated
  as proof that a Product, Scene, Seller or conversation was deleted (WO-016 ON-168 for sends).
- **New Account:** no stale private data. `clearSession` clears the whole query cache, and private
  reads are bound to their session.

## 4. ON-20261111-084 -- the For You flow

Reproduced (B-011). On its own freshly rebuilt database with the twelve fixture Scenes, run 1 failed
at the theme step: a tab tap was swallowed during the theme re-render. The same flow then passed on
run 2. The original 120 s scroll budget did not run out this time, but it is tight. Fixed in the
flow (tab taps retried until their screen shows; 300 s budget) with the assertions unchanged. The
harness step `foryou` now builds the flow's own data and restores the review data afterwards.
Native results are in section 7.

## 5. Test isolation (section 27)

- **ON-126 (API parallel tests):** backend test isolation. It was not changed in this frontend
  work order, and OTP limits were not raised. The gate result is reported in the batch handoff,
  with one green run not claimed as a fix. Required backend work, unchanged since the WO-010A
  entry: isolate the OTP ceiling, the global stock nudge and the commerce-row count per suite.
- **ON-123 (cold-cache timeouts):** not reproduced in this batch (the shared caches were warm). Left
  open.
- **ON-159:** stays fixed. `card-saves` Dark runs on a fresh Account after Saved Collections in the
  battery.
- **Mobile fixture isolation:** every native step now signs in its own disposable Account. The For
  You flow gets its own database.

## 6. Tests

- Jest: mobile 403/403 (23 suites). New: `AlertText.test.tsx`, chat.test.tsx "A-001" and "A-002".
  Search label assertions follow the new labels and check the Seller and trust phrases.
- Maestro: `buyer-journeys.yaml` (new), `buyer-for-you.yaml` (hardened), Search flows (new labels).

## 7. Native Android

Android 17 emulator, the WO-010A debug APK, Metro restarted on this branch, the real local API on
the disposable database. Each step signs in its own new disposable Account. Harness:
`G:\AdulisDevelopment\tools\review\wo014-native.sh`. Evidence: `G:\AdulisDevelopment\WO-017\logs\native-battery.out`,
`native-reruns.out`, `native-selector-final.out` and `G:\AdulisDevelopment\WO-017\maestro\`.

**Battery (14:33-15:44), first results, all recorded:**

| Step | Result |
|---|---|
| foryou (own database, twelve Scenes) | `foryou-1` PASS, smoke PASS, shell PASS, `foryou-2-after-regression` PASS; the review data restored |
| journeys | j1, j2, j3, j5 PASS; j4 FAIL (flow defect, B-012) |
| selector (WO-015) | seed and view PASS; `sel-select`, `sel-select2` FAIL (a swallowed You tap, B-013) |
| pcm (WO-014 journeys A-E, offline, Dark + 1.3) | all PASS except `account-sign-out-m` FAIL (B-013); stored rows as expected (D: nothing about clay-cup; offline: unchanged; retry: one copy; E: the other Account sees nothing) |
| layout (WO-016) | all PASS: 1.0 Light, 1.3 Dark, 1.6 Light with the keyboard; offline then one copy after the retry |
| messaging (WO-013) | `msg-open` PASS; `msg-reopen` FAIL (B-013) |
| notifications (WO-012) | guest, read, Dark at 1.3: all PASS |
| regressions (17 flows) | 16 PASS; `search` FAIL: its pattern expected the old Seller label (A-003) |

**After the fixes (flows only; no app change), the isolated reruns:**
- journeys: j1 to j5 all PASS (one conversation; nothing sent).
- `msg-reopen` PASS.
- the sign-out PASS.
- Search PASS.
- selector: `sel-select` PASS, `sel-select2` FAIL once more (B-013). With the You tap retried: all
  PASS (two Products in one conversation, stored as coffee-tray then woven-basket).

**Not run natively:**
- the Delete Account confirmation with the keyboard (its flow deletes an Account);
- a screen reader;
- iOS.
