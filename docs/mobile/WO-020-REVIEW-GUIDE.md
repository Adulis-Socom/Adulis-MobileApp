# WO-020 review guide -- Seller Companion foundation

What was built, where its information comes from, how access works, and what is still to be
checked on a device. Everything here was verified **in code and with automated tests only**. No
Android or iOS run was made in WO-020 (the work order's resource rules); the native checks are
listed in `MOBILE-NATIVE-VALIDATION-BACKLOG.md`.

No production Seller credentials are needed. To try it later on the emulator, the review data's
store owner is the `fixture-weaves` owner that `morning-start.sh prepare` creates; sign in with its
phone and get the code with `morning-start.sh code <phone>`.

## 1. Screens

| Screen | Where | What it shows | Information from |
|---|---|---|---|
| Switch to Seller | You, Account section | A button, only for an Account the server says has Seller access | `GET /v1/bootstrap` -> `account_context.seller_companion.available` |
| Seller access check | Opening Seller mode | "Checking your store access", "You are offline...", a server error with Try again, or "Seller tools are not available for this Account." | the same bootstrap |
| Choose a store | Seller mode, Account with several stores | Each store's name, your role, its status | `GET /v1/seller/list` |
| No store | Seller mode, no store returned | "No store is linked to this Account." | same |
| Seller Home | Seller mode | The active store, @handle, your role, the store's status (a store that is not open says so), Change store, Overview, Store notifications, Orders, Switch to Buyer | list |
| Overview | Seller Home | "Published Products now", "Orders from {date} to {date}", "Active reservations", "Completed handoffs", "Followers": only the counts the server sent | `GET /v1/seller/analytics/overview` (last 30 days by the server) |
| Store notifications | Home -> Store notifications | The store's notifications, Unread/Read in words, when, Mark as read, Refresh, Load older | `GET /v1/notifications?as=seller&seller_id=`, `POST /v1/notifications/{id}/read` |
| Orders | Home -> Orders | Tabs Needs action, Active, Completed, Cancelled (the server decides which Orders are in each); each Order's status, when placed, total, product count; Load more | `GET /v1/seller/orders` |
| Order | Tap an Order | Status, placed, total, expiry or ready time, number of products. View only | `GET /v1/seller/orders/{id}` |

There is no button anywhere in Seller mode that confirms or rejects a payment, marks an Order
ready, cancels, refunds, edits a Product, changes stock, or changes a setting.

## 2. How Seller access works

1. The server decides. After sign-in the app reads `account_context`; Seller mode exists only when
   `seller_companion.available` is true. That is true when the Account owns a store or is an active
   team member of one, and that role has a permission allowed on mobile.
2. Nothing on the phone can open it otherwise: not developer diagnostics, not a remembered mode, not
   a remembered store (the store choice is not saved at all).
3. The same session is used. Switching to Seller and back signs nothing in or out.
4. Every store request names the store (`X-Adulis-Seller`) and the server checks it again: a store
   the Account does not hold is refused (404), a feature the role lacks is refused (403).
5. The store list is the authority on which stores you can open. If a store is removed from your
   Account, the next refusal or list read closes it.

## 3. Several stores

- One store: it opens directly.
- Several: a chooser; pick one; Change store on Home goes back to the chooser.
- A deleted store is never offered; a suspended or not-yet-open store is offered with its status
  shown, and Home says it is not fully open.
- Changing store clears the previous store's information first; a late answer for the previous
  store never appears under the new one.

## 4. When access is refused or unavailable

| Situation | What the app does |
|---|---|
| Guest | Seller mode sends you to Buyer Home |
| Account without Seller access | No Switch to Seller; Seller mode says it is not available; no store request is made |
| Offline or server error before access is known | Says offline or shows the error with Try again; does not say "not available"; you stay signed in |
| A feature not allowed for your role (403) | "The overview is not available for your role." / "Orders are not available for your role."; the store stays open |
| Store no longer yours (404) | The store is closed and the list read again |
| Session expired | The usual sign-out; Seller mode leaves |

## 5. Not available yet

Order and payment actions; notification preferences; Seller messages; reviews; full analytics;
push notifications; Courier; human-readable Order references (none in the API); real notification
sentences (no Seller templates exist, so a neutral sentence is shown). Details:
`WO-020-SELLER-API-CAPABILITY-MATRIX.md`.

## 6. Tests

Automated (Jest, in-memory server applying the API's observed rules); exact counts are in the
founder handoff:

- `src/seller/seller.test.tsx`: access, selection, isolation, overview, notifications, Orders.
- `src/seller/seller-api.test.ts`: the response checks.
- `src/modes/navigation.test.tsx`, `src/auth/auth-flow.test.tsx`: mode rules in development and
  release builds.
- The whole mobile suite, run in band.

## 7. Still to check on a device

All of section 1 on the Android emulator (Light, Dark, 100%, 130%, 160%), TalkBack, Account
switching, offline, and iOS: `MOBILE-NATIVE-VALIDATION-BACKLOG.md`, "From WO-020".
