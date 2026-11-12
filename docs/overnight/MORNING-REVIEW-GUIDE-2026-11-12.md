# Morning review guide -- 12 November 2026

How to try the overnight work (WO-011 Account, WO-012 Notifications, WO-013 Messaging) yourself on
the Android emulator. You need no production credentials. Everything runs against the local,
disposable test database (`adulis_gates`), which has been loaded with review data.

## 1. Start everything (about 3 minutes)

1. Start **Docker Desktop** and wait until it says it is running. The database (`adulis-postgres`)
   and file store (`adulis-minio`) containers start with it.
2. Open **Git Bash** and run:

   ```
   bash /g/AdulisDevelopment/WO-013/scratch/morning-start.sh
   ```

   The script:
   - checks the external SSD;
   - starts the local API (on the test database only);
   - starts the Android emulator;
   - installs the Adulis app if it is missing;
   - starts the app's development server (Metro).

   Wait for **READY**. Leave the window open.
3. **Signing in:** use any test phone number, for example `+251911700001`. The six-digit code is
   not sent by SMS. In a second Git Bash window, run:

   ```
   bash /g/AdulisDevelopment/WO-013/scratch/morning-start.sh code +251911700001
   ```

   It prints the latest code for that number.

To stop everything afterwards: `bash /g/AdulisDevelopment/WO-013/scratch/morning-start.sh stop`.

If something does not start, the script says what failed. Nothing here touches production.

The helper script (tested at the end of the night: prepare, start, code, stop) uses support scripts
in the overnight session's temporary folder under `C:\Users\naods\AppData\Local\Temp\claude\`. If
Windows has cleaned that folder and the script reports a missing file, ask Claude to recreate the
review environment. The app and the test database are unaffected.

## 2. What to check

Each feature lists six things:
- **Screen:** where to go.
- **Action:** what to do.
- **Success:** what you should see.
- **Failure:** what a problem looks like.
- **Sign-in:** whether you need to be signed in.
- **Data:** whether it needs the review data.

### 2.1 You tab (WO-011)

| | |
|---|---|
| Screen | The **You** tab (bottom right) |
| Action | Open it without signing in, then sign in (Sign in -> phone -> code) and open it again |
| Success | **Signed out:** "Sign in to see your profile." and Preferences (Appearance; Language). **Signed in:** "You are signed in...", then Preferences, Security (your sessions: "Android device", "Adulis app", "This device", Last active, Signed in), Messages, Privacy (Delete Account) |
| Failure | An Account, Security or Delete control while signed out; a session without "This device"; an invented name, email or address; a raw code like `buyer.you...` |
| Sign-in | For Security, Messages and Privacy |
| Data | No |

**Appearance.** Tap **Dark**, then **System**. Success: the whole app switches at once, and the
choice shows a check mark. Known limit: the choice resets when the app restarts (no approved
storage yet).

**Language.** This is a development build, so the Amharic option is shown. Tap **Amharic
(development preview)** and the screen switches to Amharic. Tap **English** to switch back.
Success: the switch is immediate, with no mixed or missing text. A release build shows only "Adulis
is shown in English." The Amharic is machine-translated and must not ship.

**Sessions.** Tap **Refresh sessions**. Success: the list reloads, with no session id or invented
location shown.

**Sign out.** Scroll down, then tap **Sign out**. Success: You returns to "Sign in to see your
profile."

### 2.2 Delete Account (WO-011)

**Use a throwaway number only**, for example `+251911700099`. Deletion is permanent, even here.

| | |
|---|---|
| Screen | You -> **Delete Account** |
| Action | Continue -> enter the same number you signed in with -> Send code -> enter the code (use the `code` command) -> read "What deletion does" -> type **DELETE** -> **Delete my Account permanently** |
| Success | "The Adulis Account registered to +251... has been deleted." then "This device is signed out." -> Go to Home -> You shows the signed-out state. Typing anything other than DELETE gives "Type DELETE exactly to confirm." Cancel at any step deletes nothing |
| Failure | Deletion without typing DELETE; "deleted" when it was not; still signed in after deleting your own Account; any money or order screen |
| Sign-in | Yes |
| Data | No |

A deleted number cannot be reused for a new Account in this test database. Use a new throwaway
number each time.

### 2.3 Notifications (WO-012)

| | |
|---|---|
| Screen | Home -> **Notifications** (top of the Home screen) |
| Action | Sign in as **+251911700010** in the app. Then, in Git Bash, run `bash /g/AdulisDevelopment/WO-013/scratch/morning-start.sh notifications +251911700010` to load 29 sample notifications for that Account. Open Notifications (or tap Refresh notifications) |
| Success | "Recent" and "Older" groups. Each row says **Unread** or **Read**, "You have a notification from Adulis.", and "Received ...". Tap **Mark as read** on an unread row: it changes to Read. **Refresh notifications** keeps it Read. Scroll down, then **Load older notifications** -> "That is everything for now." |
| Failure | A row that opens a screen or link; a code like `ORDER_...` shown; a Seller notification such as stock reminders; a "Mark all read" button (deliberately absent) |
| Sign-in | Yes. Signed out, it shows "Sign in to see notifications." |
| Data | Yes: the `notifications` command loads them (it also adds one Seller-class row that must NOT appear) |

Every row reads the same generic sentence on purpose. No Buyer notification wording has been
approved yet (a decision for you, ON-20261111-141).

### 2.4 Messages (WO-013)

| | |
|---|---|
| Screen | **Fixture Weaves** Seller Profile: Shop tab -> a Fixture Weaves product -> the store name, or Search "Fixture Weaves" |
| Action | Tap **Message Seller**. Type a message and tap **Send**. Then send exactly `Delivery times?` |
| Success | The conversation opens ("No messages yet..." the first time). Your message appears labelled **You**. Fixture Weaves has the automated assistant, so an **Automated answer** follows: "Your question has been passed to the seller...", or for `Delivery times?` "This automated answer cannot be shown." with **Ask the Seller**. Tap Ask the Seller and the escalation line appears. You -> **Messages** lists the conversation, and opening it shows the same history. Tapping Message Seller again opens the same conversation |
| Failure | An automated answer labelled "Seller"; a message shown before it was sent; a duplicate message from one tap; a promise of a response time; any cart, order or payment screen |
| Sign-in | Yes. Signed out, Message Seller asks you to sign in |
| Data | Yes: the Fixture Weaves Seller and its sample assistant answer are loaded |

**Offline check.** Turn on airplane mode in the emulator (pull down from the top), type a
message, and tap Send. Success: "We could not confirm that your message was sent..." and your text
stays in the box. Turn airplane mode off and tap Send again: the message appears once.

**Second Account.** Sign out, then sign in with another new number. Messages shows "No
conversations yet...": no other Account's conversations appear.

### 2.5 Still working from before (spot checks)

| Screen | Success |
|---|---|
| Home (For You) | Scenes load, or "There are no Scenes to show right now" |
| Shop | Products listed; category tabs (All, Fashion, Cosmetics, Electronics) filter the list |
| Search | Typing "basket" finds the Woven basket |
| Saved | Signed in: your saved items and Collections |
| Dark mode | You -> Appearance -> Dark: every screen readable |

## 3. Not testable here

- **iOS:** not built or tested.
- **Push notifications:** out of scope.
- **Edit Profile:** no design or API exists for a Buyer profile.
- **Signing out other sessions:** console only.
- **Mark all read:** blocked by a server limitation.
- **Product context in messages, attachments, read receipts:** need backend work. See the work-order
  handoffs.
