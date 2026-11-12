# WO-018 -- Native accessibility validation

12 November 2026. Android emulator `Adulis_Pixel_8a_API_37` (Android 17, Google APIs image), the
WO-010A debug APK (`G:\w10a`, reused: WO-018 changes no native dependency or `app.json`), Metro
serving the branch, the real local API on the DISPOSABLE `adulis_gates` database. Disposable
phones and Accounts only; no Account was deleted; nothing ran against production.

Harness: `G:\AdulisDevelopment\tools\review\wo018-native.sh` with the committed flow
`apps/mobile/.maestro/accessibility-completion.yaml`; output under
`G:\AdulisDevelopment\WO-018\maestro\` and `G:\AdulisDevelopment\WO-018\logs\native-*.out`. A C:
gate runs before every flow (blocked below 10 GB, stop below 5 GB).

## 1. Result in one paragraph

Native testing was **partly executed and then stopped for safety**. Seller tab selection (100% Light
and 160% Dark), the Shop's next-page failure path (130%), and Add to collection plus a Collection's
Remove (130% Dark) passed natively. Native screenshots exposed two defects that Jest had missed
(W18-12: the large-text layout did not switch on at Android's 130%; W18-13: a tab label broken
mid-word at 160%). Both are fixed and covered by Jest, but **not re-verified natively**. During the
runs C: fell from about 26 GB to 9.78 GB and then to 5.78 GB free, and the emulator exited twice
(W18-02, W18-08). Native testing was stopped under the work order's rule. **TalkBack was not run**
(section 5): it is installed on the emulator image, but the emulator could not be kept up safely.

## 2. Preflight (before the first emulator start)

| Measure | Value |
|---|---|
| C: free | 26,964,357,120 bytes |
| G: free | 3,354,896,891,904 bytes |
| Physical memory free | 2.50 GB of 15.71 GB |
| Commit charge | 34.92 of 38.96 GB |
| Page file | 23,805 MB allocated (system-managed; not changed) |
| Heavy processes | an unrelated game (CrimsonDesert) 9.3 GB private; WSL/Docker 2.5 GB; VS Code 3.2 GB |

C: was above the 25 GB preference. The game was not closed (not authorized).

## 3. Runs

### Run 1 (18:42-18:53): no flow reached its check

| Flow | Result | Why |
|---|---|---|
| names at 1.0 Light, 1.3 Dark, 1.6 Light, 360 dp 1.0, 360 dp 1.3 Dark | FAIL (5) | Home showed "The request is not valid.": the app's stored device registration predated the rebuilt database (W18-09) |

C: fell to 13.18 GB; the emulator then exited on its own (W18-08).

### Run 2 (18:59-19:17), harness now starting with a clearing flow

| Flow | Result | What it showed |
|---|---|---|
| smoke (x3) | PASS | cleared install, device registered again |
| names (5 variants) | FAIL (5) | flow error: the long-named Products sit below the first screen (newest Products first); the flow waited without scrolling. Fixed in the flow, not rerun (blocked) |
| tabs-1.0-light | PASS | Scenes selected on opening; Products, Reviews, About each `selected` after its press, the others not |
| tabs-1.6-dark | PASS | the same at 160% Dark. Its screenshot shows "Products" broken as "Product / s" (W18-13) |
| paging-open (1.3 Light) | PASS | the Shop's first page. Its screenshot shows two columns and a cut long name at 130% (W18-12) |
| paging-fail (API stopped) | PASS | at the end of the list: "Could not load more. You are offline. Check your connection and try again." and **Try again** in the button's place; no Load more; scrolling back up, the first page is still there |
| paging-retry | BLOCKED | C: 9,780,977,664 bytes free (< 10 GB) |
| collections, delete | BLOCKED | C: under 10 GB |

C: fell from 26.44 GB to 9.78 GB within four minutes of the paging step. Commit charge reached
42.7 of 45.1 GB; physical memory free 0.85 GB. Stopping the emulator returned C: to 26.2 GB.

### Run 3 (19:22-19:29): one step only

| Flow | Result | What it showed |
|---|---|---|
| smoke, auth-request-coll, sign-in-coll | PASS | a fresh disposable Account signed in |
| collections-1.3-dark | PASS | Add to collection: Saved unticked and enabled; New collection "Large text list" created and ticked, every box enabled once answered; Saved ticked; the new list unticked; Done; Saved -> the Saved Collection -> Remove Woven basket -> "This collection is empty." The database shows no membership left |

C: was 5,779,984,384 bytes free at the end (the drop happened inside the flow, after its gate).
The emulator had exited by itself. Native testing stopped here.

Commerce rows stayed at the review fixtures' baseline in every run (carts 0, reservations 5,
orders 8): no flow created a Cart, reservation or Order.

## 4. Not validated natively

- **Re-verification of W18-12 and W18-13 fixes** (one column and full names from 130%; tab labels
  that wrap instead of breaking). Jest covers both with Android's float value.
- **Load more pressed while idle.** Scrolling to the button fires the scroll trigger first, so on a
  device the button is reached mostly by screen-reader users or when a page fails. Its idle press,
  busy state and the "Loaded N more" sentence are Jest-verified; its failure state was verified
  natively.
- **Busy states during a change.** On the local API a change answers in milliseconds; the busy and
  disabled states are Jest-verified (held answers), and the enabled states afterwards natively.
- **Delete Account step focus** (blocked; the flow goes to the preview and cancels, never confirms).
- **Long names on screen, 360 dp width, image alignment** (the names runs failed before the check).
- **For You Load more Scenes** (needs its own rebuilt database; Jest-verified).
- **Regression journeys A-F** beyond what ran: Discovery, Messaging with the Product selector,
  Account, Notifications were not rerun natively in WO-018 (Jest suites pass; WO-017 ran them on
  this branch's predecessor).
- **iOS:** not tested.

## 5. TalkBack

**Status: PENDING. No TalkBack test was carried out.**

- The emulator image includes TalkBack (`com.google.android.marvin.talkback`, with Switch Access
  and Voice Access); it is not enabled by default. A helper to enable it, drive it by keyboard
  (Alt+Right / Alt+Left / Alt+Enter) and record the accessibility event stream was prepared
  (`G:\AdulisDevelopment\tools\review\talkback.sh`), and the session was planned after the
  Maestro flows (TalkBack changes how touches work).
- It did not run: the emulator exited twice and C: fell below the hard stop while another program
  held about 9.8 GB of memory. TalkBack was never switched on; the emulator's accessibility
  settings are unchanged (`enabled_accessibility_services` is null).
- What exists instead is not a TalkBack result: Jest asserts the announcements and focus requests
  the app makes, and Maestro read the native accessibility tree (selected tabs, checked and
  enabled boxes, labels).
- **Manual script for the founder:** `WO-018-MANUAL-REVIEW-GUIDE.md`, section 3.

## 6. Emulator state left behind

Font scale 1.0, Light, density reset, TalkBack off, emulator stopped, Metro and the API stopped.
After the gates (which rebuild the disposable database) the review data was rebuilt with
`morning-start.sh prepare` and the two long Product names set again with `long-names` (a
command added for the manual review guide).
