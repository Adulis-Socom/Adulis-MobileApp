# WO-012 -- Buyer notifications and in-app inbox

Work order WO-012 (12 November 2026). Branch `mobile/wo-012-buyer-notifications`, from the WO-011
checkpoint `e598312073c730bfa47e35581db470e31aab8f2e`. Engineering record; it changes no
specification and no backend.

## 1. Sources

- **Design:** ADU-NOTIF-01 v3.3 S2 ("Notifications are never business truth"), S40 (the
  entity), S60-S61 (list, read, read-all scope), S66 (destinations), S84-S85 (templates and
  slots); ADU-MOB-02 v4.3 S131-S135 and S232 (R-03 entry point, R-19 Amharic); ADU-EVT-01 v3.2
  (sources only).
- **Executable API:** `GET /v1/notifications?as=buyer`, `POST /v1/notifications/{id}/read`,
  `POST /v1/notifications/read-all` (ADU-API-01 S12.14). None publishes a schema.
- **Server behaviour checked (read only):** `apps/api/src/modules/notifications/notifications.controller.ts`.
  - The Buyer arm returns the Account's rows that are unlinked, or linked to an Order on which
    the Account is the buyer.
  - It excludes the Seller-class templates.
  - It pages 25 at a time, newest first, with the cursor on `scheduled_for`.
  - Mark-read is idempotency-keyed and scoped to the recipient.
  - Read-all marks EVERY unread row of the Account.

## 2. What the Buyer sees (`src/app/(buyer)/notifications.tsx`, `src/buyer/BuyerNotifications.tsx`)

- **A guest:** "Sign in to see notifications." and Sign in. Nothing is read.
- **Signed in:** the inbox (FlashList), newest first, grouped under "Recent" (seven days) and
  "Older".
  - **Each row** shows:
    - "Unread" or "Read" in words (plus a border, never colour alone);
    - its sentence;
    - "It is about one of your orders." when the row names an Order;
    - "Received {time}";
    - Mark as read, when unread.
  - **Refresh:** a button and pull to refresh. The query client also refetches a stale inbox
    when the app returns to the foreground.
  - **Load older notifications** fetches the next page only when tapped; "That is everything for
    now." at the end.
  - **Empty and failure:** "You have no notifications." when empty. A failed load shows the cause
    and Try again.
- **Grouping** (Recent/Older) is presentation only. The design defines none; read state is shown
  on every row instead of splitting the list.

## 3. Rendering: no fabricated copy

- **The API shape.** It returns a `template_key`, `locale` and `slots`, not the design's
  rendered title and body (NOTIF-01 S40).
- **No approved copy.** No Buyer notification template has approved catalogue copy anywhere.
  The only notification sentence in the catalogue (`notification.chat.escalated`) is
  Seller-class, and the console's are Seller templates.
- **The rule (`notificationText`).**
  - A row renders its own sentence only when its template key lies under `notification.buyer.`,
    is in the mobile catalogue, and every slot is present.
  - Every other row shows "You have a notification from Adulis."
  - Today that is every row. The Buyer has no copy to read beyond "a notification, received at T,
    possibly about an order", which is honest and reveals nothing.
- **Never shown:** a raw template key, a slot value of an unknown template, or a Seller, error or
  SMS sentence a row happens to name (security review, MEDIUM, fixed).
- **No destination.** No row opens anything. The only reference the API carries is an Order, and
  the Buyer has no Orders screen. A notification also never establishes that the event happened.

## 4. Read state

- **Per-row Mark as read** is `POST /v1/notifications/{id}/read` with one idempotency key per
  notification. The key is kept across a lost connection and dropped once the server answers.
  One request per notification is in flight at a time (a second tap sends nothing).
- **The read state shown** is the server's `read_at`. An answer without one makes the app read
  the inbox again rather than assume.
- **A NOT_FOUND** (gone, or not this Account's) says so and re-reads the inbox.
- **No Mark all read.** The server's read-all would also mark the Account's Seller notifications
  read (one Account can own a Seller). The control is deferred until a Buyer-scoped operation
  exists (ON-20261111-139).

## 5. Privacy and sessions

- **Session-bound reads.** Every read is bound to the session on screen (`keepIfCurrent`): a page
  that lands after a sign-out or another sign-in is refused, never shown.
- **Cache.** `clearSession` clears the cache, and the mark-read state lives in the screen, which
  unmounts on sign-out.
- **Scope.** `as=buyer` is fixed in the client; no Seller scope is ever requested.
- **No push.** No permission is asked, no token is registered, no provider is selected
  (out of scope; NOTIF-01 S62 has Expo Push in MVP, ON-20261111-145).

## 6. Tests

- **Jest:** `src/buyer/notifications.test.tsx`, 14 tests numbered by the section 21 matrix; 19
  and 20 (Dark, enlarged text) are native. Every test also asserts that no read-all, no push
  registration and no commerce call is ever made. Mobile suite: 333/333.
- **Native results:** `WO-012-FOUNDER-HANDOFF.md`.

## 7. Conflicts and gaps (register)

| Id | Kind | Summary |
|---|---|---|
| ON-20261111-139 | CONTRACT_GAP | Read-all is Account-wide; no Buyer-scoped Mark all read |
| ON-20261111-140 | CONTRACT_GAP | The notification endpoints publish no schemas |
| ON-20261111-141 | SPEC_CONFLICT | The design stores rendered title/body; the API returns template keys, and no Buyer template has approved copy |
| ON-20261111-142 | API_DEFECT | The timestamp cursor (strict `<`, millisecond ISO) can skip rows that share the boundary timestamp |
| ON-20261111-143 | DESIGN_GAP | NEW_DEVICE_SIGNIN is Seller-class, so an Account with no Seller never sees its own security notice |
| ON-20261111-144 | DESIGN_GAP | No notification-type-to-destination table; Order-linked rows have no Buyer destination |
| ON-20261111-145 | SPEC_NOTE | Push is in the design's MVP but out of this work order's scope; no unread count or badge is designed |
| ON-20261111-146 | SECURITY | The server's Buyer scope is a deny-list of Seller-class templates; drift sends Seller rows to the Buyer inbox |
