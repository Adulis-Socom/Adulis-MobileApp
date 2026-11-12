# WO-018 manual review guide -- Buyer accessibility

How to check the WO-018 changes yourself on the Android emulator, including the TalkBack pass
that WO-018 could not run (W18-11). You need no production credentials: everything runs against
the local, disposable test database (`adulis_gates`). Nothing here touches production, and no step
deletes an Account.

## 1. Start

**Before you start, close heavy programs, games especially.** With a game open, the emulator
used up C: and exited twice during WO-018. Make sure C: has at least 25 GB free.

1. Start **Docker Desktop** and wait until it says it is running.
2. In **Git Bash**:

   ```
   bash /g/AdulisDevelopment/tools/review/morning-start.sh prepare
   bash /g/AdulisDevelopment/tools/review/morning-start.sh long-names
   bash /g/AdulisDevelopment/tools/review/morning-start.sh start
   ```

   `prepare` rebuilds the review data. `long-names` gives two Shop Products long names, one
   English and one Amharic, for the large-text checks. `start` prints **READY** when the app is open.
3. **Signing in:** type any test number, for example `+251911800001`, and tap **Send code**. Then
   get the code from a second Git Bash window:

   ```
   bash /g/AdulisDevelopment/tools/review/morning-start.sh code +251911800001
   ```

   A new number makes a new, empty Account.
4. **To simulate a lost connection** for the app only, run
   `bash /g/AdulisDevelopment/tools/review/morning-start.sh api-stop`; `api-start` brings it back.
5. **To stop everything:** `bash /g/AdulisDevelopment/tools/review/morning-start.sh stop`.

## 2. Check the changes without a screen reader

| # | Where and what to do | Correct | Incorrect |
|---|---|---|---|
| 1 | **Enlarged text.** Android Settings -> Display -> Font size: the step at 130%, then the largest. Open **Shop** | One column of Products; "Handwoven cotton scarf with a traditional tibeb border in white and gold, large size" shown in full, as is the Amharic name; nothing overlaps the photo, price, Save or "Sold by" | Two columns at 130% or more; a name cut with "..." (W18-12) |
| 2 | Same sizes. Open a Seller (Fixture Weaves from Search or a Product) | Tabs Scenes, Products, Reviews, About as whole words; at the largest size they may take two rows | A word broken across lines, like "Product / s" (W18-13) |
| 3 | Font size back to Default. Shop | Two columns; long names cut to two lines (the full name is read by TalkBack and is on the Product) | -- |
| 4 | **Load more.** Shop, scroll to the bottom slowly | More Products load on their own as you near the end; at the end "That is everything for now." | Products repeated; a page that never loads |
| 5 | Pull down to refresh, run `api-stop`, then scroll to the bottom | "Could not load more. You are offline. ..." and a **Try again** button in the same place; the Products above stay | The list empties; no way to retry |
| 6 | Run `api-start`, tap **Try again** | The remaining Products appear once; then "That is everything for now." | Duplicates; the error stays |
| 7 | **Collections.** Sign in. Open Woven basket -> **Add to collection**. Tap **New collection**, name it, **Create**; tick **Saved**; untick your new Collection | Each tick follows the server; between taps every box is usable again | A box that stays greyed out; a tick that changes but did not save |
| 8 | Run `api-stop`, tick a box | "Saved was not changed. You are offline. ..." under the boxes; the box keeps its old state and stays usable | The tick shown as saved |
| 9 | `api-start`. Saved tab -> open a Collection -> **Remove** on an item | The item goes; "This collection is empty." when it was the last | -- |
| 10 | **Delete Account (do not confirm).** You -> Delete Account -> Continue -> phone -> Send code -> code -> Verify | Each step replaces the last; the consequences screen appears. **Then tap Cancel.** Never type the confirmation word | -- |

## 3. TalkBack pass (pending from WO-018)

TalkBack is installed on the emulator image but switched off.

**Switch it on.** Use Android Settings -> Accessibility -> TalkBack -> On. Or, in Git Bash:

```
/g/Android/SDK/platform-tools/adb shell settings put secure enabled_accessibility_services com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService
/g/Android/SDK/platform-tools/adb shell settings put secure accessibility_enabled 1
```

**Move around.** With the emulator window focused, the keyboard is easiest:

| Key | Action |
|---|---|
| **Alt+Right** | next item |
| **Alt+Left** | previous item |
| **Alt+Enter** | activate |

With the mouse, a click selects an item and a double-click activates it. TalkBack's green outline
shows where its focus is. Turn the PC's sound on to hear it.

For each line below, note what TalkBack said and whether it matched.

| # | Screen and action | Correct (what you should hear) |
|---|---|---|
| T1 | Home | The header buttons by name (Search, Notifications), the channels as tabs with one "selected", each Scene card as one item with Seller, caption and availability in words |
| T2 | Shop -> a category tab | The category read as a selected tab; each Product read as "name, price, availability", then "Sold by ..." as a link and "Save ..." as a toggle |
| T3 | A Product | Photos labelled; options grouped; Add to collection and Message Seller by name |
| T4 | A Seller -> activate **Products** | Focus stays on the tab bar and reads "Products, tab, selected" (it does not jump to the top of the screen); the next item is the first Product. Repeat for Reviews and About |
| T5 | Saved -> a Collection | Each Remove read as "Remove {name} from this collection"; after a Remove, "Removed from {Collection}." |
| T6 | Add to collection -> activate a box | The box read as a checkbox, "checked" or "not checked". Right after you activate it, "Added to {Collection}." (or "Removed from ..."). With `api-stop`, the failure is read out |
| T7 | Search "basket" | Results read with "Sold by" and the Seller's trust level; "No results" read when nothing matches |
| T8 | Shop, go to the end with Alt+Right | You reach a **Load more** button (or the end sentence). Activating it: "Loading more", then "Loaded N more, just above."; focus stays on the button. With `api-stop` first: the failure is read out and the button is now "Try again" |
| T9 | Notifications | Each notification readable; the "Load older notifications" button reachable |
| T10 | Messages -> a conversation -> Select Product | The picker title, each Product with its availability, Cancel; "Send" reachable above the keyboard |
| T11 | You -> Appearance, Security / sessions | Each choice read as a radio button with its state; sessions readable |
| T12 | You -> Delete Account -> Continue | On each step the first line is read without you moving: "Enter the phone number ...", then "We sent a deletion code ...", then "Checking what deletion does", then "This deletes the Adulis Account registered to ...". **Tap Cancel; never confirm** |

A failure, a busy control read as "busy" or "disabled", and every state change should be heard
without looking at the screen. **Incorrect:** silence after an action; focus jumping to the top of
the screen; a control with no name ("button", "unlabelled"); a disabled control read as usable.

## 4. Enlarged text from the command line (optional)

```
/g/Android/SDK/platform-tools/adb shell settings put system font_scale 1.3
/g/Android/SDK/platform-tools/adb shell cmd uimode night yes
/g/Android/SDK/platform-tools/adb shell wm density 480
```

These set 130% text, Dark mode, and a 360 dp-wide screen (ADU-MOB-02 S173). Reopen the app
after changing them.

## 5. Put the emulator back to ordinary settings

```
/g/Android/SDK/platform-tools/adb shell settings delete secure enabled_accessibility_services
/g/Android/SDK/platform-tools/adb shell settings put secure accessibility_enabled 0
/g/Android/SDK/platform-tools/adb shell settings put system font_scale 1.0
/g/Android/SDK/platform-tools/adb shell cmd uimode night no
/g/Android/SDK/platform-tools/adb shell wm density reset
bash /g/AdulisDevelopment/tools/review/morning-start.sh stop
```

Turn TalkBack off **before** running any Maestro flow: the two cannot run together.
