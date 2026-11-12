# Review guide -- WO-015 to WO-017 (12 November 2026)

How to try the batch yourself on the Android emulator. You need no production credentials.
Everything runs against the local, disposable test database (`adulis_gates`) loaded with review
data. Nothing here touches production.

## 1. Start everything

1. Start **Docker Desktop** and wait until it says it is running.
2. In **Git Bash**:

   ```
   bash /g/AdulisDevelopment/tools/review/morning-start.sh prepare
   bash /g/AdulisDevelopment/tools/review/morning-start.sh start
   ```

   `prepare` rebuilds the review data (about 20 seconds). It stops with a clear message if anything
   is missing. `start` starts the API, the emulator, the app and its development server, then
   prints **READY**.
3. **Signing in:** use any test number, for example `+251911800001`. Tap Send code, then in a second
   Git Bash window run:

   ```
   bash /g/AdulisDevelopment/tools/review/morning-start.sh code +251911800001
   ```

   Type the printed six-digit code. A new number makes a new, empty Account.
4. To stop: `bash /g/AdulisDevelopment/tools/review/morning-start.sh stop`.
5. To simulate a lost connection for the app only: `... morning-start.sh api-stop`, and `api-start` to
   restore it. Airplane mode does not work for this: the app reaches the local API through `adb`.

The launcher and its support files live in `G:\AdulisDevelopment\tools\review\`. They don't depend
on any temporary folder. Close other heavy programs (games, large apps) first: the emulator needs
memory, and C: can run low (B-003).

The review data has a Seller called **Fixture Weaves** with Products Woven basket, Coffee tray,
Clay cup and Cotton scarf (currently unavailable).

## 2. WO-015 -- choose a Product inside a conversation

| Step | What to do | Correct | Incorrect |
|---|---|---|---|
| 1 | Sign in. Open `Fixture Weaves` from Search, or open a Product of Fixture Weaves and tap Message Seller on its Seller Profile | The conversation opens; **Select Product** is under the history | No Select Product; or it never becomes tappable |
| 2 | Type a question, then tap **Select Product** | A full-screen list: "Select a Product", "Products from Fixture Weaves", each Product with a photo, name and availability; Cancel at the bottom, clear of the system bars | A list of another Seller's Products; title under the clock |
| 3 | Tap **Coffee tray** | The list closes; "Asking about / Coffee tray / Available"; your typed text is still there; nothing is sent | A message is sent; the text is lost |
| 4 | Tap **Choose another Product**, pick Cotton scarf; then **Remove Product** | The context changes to Cotton scarf ("Currently unavailable"), then disappears | -- |
| 5 | Pick Woven basket, Send | The message appears with "About a Product"; the "Asking about" box disappears; the next message has no Product | The Product stays attached for the next message |

## 3. WO-016 -- the conversation with the keyboard, refusals and unconfirmed sends

| Step | What to do | Correct | Incorrect |
|---|---|---|---|
| 1 | Android Settings -> Display -> Font size: largest. Open a conversation with messages, attach a Product, tap the message box | The latest messages, the Product box, the message box and **Send** are all visible above the keyboard | Send hidden under the keyboard; the history disappears |
| 2 | With the conversation open, run `bash /g/AdulisDevelopment/tools/review/morning-start.sh api-stop`, type a message, Send | "Your message may already have been received. Trying again checks the same message, so it is not sent twice. Editing it makes a new message, which could arrive twice." with **Try sending again** and **Edit the message instead**; the text is locked | "Not sent"; or the message shown as sent |
| 3 | Run `bash /g/AdulisDevelopment/tools/review/morning-start.sh api-start`, then tap **Try sending again** | The message is sent once (Refresh shows it once) | Two copies |

A server "not found" on send now says "This conversation or the Product with it may not be
available right now". It names a removed Product only when a fresh read shows it (Jest-tested; it
cannot be produced on demand in the review data).

## 4. WO-017 -- stability and accessibility

| Step | What to do | Correct | Incorrect |
|---|---|---|---|
| 1 | Sign in with a new number, run `morning-start.sh api-stop`, then open You -> Messages (or Notifications); afterwards `api-start` | "You are offline. Check your connection and try again." | "Loading" forever |
| 2 | TalkBack on (Settings -> Accessibility), search "basket", move over a result | The result reads its name, price, availability **and "Sold by Fixture Weaves"** | The Seller is missing |
| 3 | TalkBack on, make an action fail (`api-stop`, then Save a Product) | The failure is spoken | Silence |
| 4 | Journeys: Home -> a Scene -> a Product -> the Seller -> a Product -> Ask Seller; Shop -> a category -> a Product -> Ask Seller -> Back; Search -> a Product -> the Seller -> Message Seller; save a Product -> Saved -> it -> Ask Seller; You -> Messages -> a conversation -> Back | Each step opens the expected screen; Back returns to the previous one; every Ask Seller and Message Seller opens the same Fixture Weaves conversation | A duplicate screen; Back skips a screen; a second conversation |
| 5 | Delete Account (You -> Delete Account) with a disposable Account: on the confirmation, tap the field | The buttons are not covered by the keyboard (not tested natively in this batch) | -- |

## 5. Where the evidence is

- Records: `docs/mobile/WO-015-*.md`, `WO-016-*.md`, `WO-017-*.md`.
- Issues: `docs/overnight/WO-015-017-ISSUES-AND-BLOCKERS.md`.
- Screenshots and logs: `G:\AdulisDevelopment\WO-015\`, `WO-016\`, `WO-017\` (`maestro\`, `logs\`).
