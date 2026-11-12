# WO-020 -- Seller Companion frontend foundation

12 November 2026. The first functional Seller mode of the one Adulis mobile app: server-authorized
access, store selection, a lightweight Home with the basic overview, store notifications and
read-only Orders. Mobile frontend only: no backend, contract, database or native change. Resource
constrained: no emulator, native build, Maestro, bundle export or parallel test run.

- **Branch:** `mobile/wo-020-seller-companion-foundation`, from `b091de8dc98c6101524612a6a6f0a506bce38a99`
  (WO-018 head; verified equal to the remote, clean tree).
- **Capability matrix:** [`WO-020-SELLER-API-CAPABILITY-MATRIX.md`](WO-020-SELLER-API-CAPABILITY-MATRIX.md).
  **Issues:** [`WO-020-ISSUES-AND-BLOCKERS.md`](WO-020-ISSUES-AND-BLOCKERS.md).
  **Security:** [`WO-020-SECURITY-REVIEW.md`](WO-020-SECURITY-REVIEW.md).
  **Native backlog:** [`MOBILE-NATIVE-VALIDATION-BACKLOG.md`](MOBILE-NATIVE-VALIDATION-BACKLOG.md).
  **Try it:** [`WO-020-REVIEW-GUIDE.md`](WO-020-REVIEW-GUIDE.md).

## 1. Sources

- ADU-API-01 v1.11 S4.2 (`X-Adulis-Seller`), S12.11 (orders, **M**), S12.13 (overview, **M**),
  S12.14 (notifications, **M**), S15.0a (buckets are the server's).
- The permission catalogue and `core.fn_has_permission` in `db/migrations` (read only).
- `AccountContextDto` in `contracts/openapi.json`: `seller_companion.available` is true when the
  Account holds a Seller relationship whose role has a MOBILE permission (WO-API-001A).
- D-243 (DEFECT-REGISTER): `GET /v1/seller/list`.
- A **runtime probe** of the executable API with a MOBILE session on disposable review data
  (`G:\AdulisDevelopment\WO-020\logs\api-probe*.txt`), because no response schema is published and
  `apps/api` is outside the mobile read boundary.
- WO-018 handoff, issues and native validation records; WO-017 accessibility review; the storage
  policy.

The repository's mobile documents still describe "one app, two modes" and say release builds offer
Buyer only. This work order, the founder's current decision, supersedes the release restriction for
Seller mode. Courier stays a development-only diagnostic shell. Those stale lines were not edited
(outside this work order's documents).

## 2. Architecture

```
You (Buyer) -- Switch to Seller (only if account_context.seller_companion.available) --> /seller
/seller  = SellerGate -> SellerProvider -> Stack
           Home (chooser | store) . notifications . orders . orders/[orderId]
```

| File | Role |
|---|---|
| `src/modes/modes.ts` | Seller availability: signed in AND the server's `seller_companion.available`. Development builds too: diagnostics grant nothing. Courier unchanged (diagnostic shell) |
| `src/seller/SellerGate.tsx` | Guest -> Buyer Home. Loading, offline and server error shown as such (never as a revocation). Confirmed unavailable fails closed with no Seller request. Losing availability unmounts every Seller screen |
| `src/seller/seller-context.tsx` | The Seller list query (session-bound, gcTime 0) and the active store: a UI selection in memory, always a row of the list, gone when the gate unmounts the context (session end); one store opens directly; switching drops the previous store's queries; a 404 on a store read releases a chosen store and re-reads list and bootstrap once |
| `src/api/client.ts` | `seller` option: `X-Adulis-Seller` set per request by the Seller read methods only, refused before sending unless a UUID. Not on the list call, never on Buyer requests |
| `src/seller/seller-api.ts` | Boundary validators for the unschematized responses (shapes from the probe) |
| `src/seller/SellerHome.tsx` | Chooser, Home, overview card |
| `src/seller/SellerOrders.tsx` | Orders list and detail (read-only), store inbox wrapper, `WithStore` |
| `src/buyer/notifications.ts`, `BuyerNotifications.tsx` | The inbox generalized by scope: Buyer unchanged, or one store's (`as=seller`) |
| `src/app/seller/*` | Routes |
| `src/app/(buyer)/(tabs)/account.tsx` | Switch to Seller |

All Seller queries live under `['seller', <storeId>, ...]` (and `seller-list`), are bound to the
session through `keepIfCurrent`, and are cleared with the whole cache by sign-out.

## 3. What each screen shows

| Screen | Content | API |
|---|---|---|
| Gate | Checking / offline / error with Retry / "Seller tools are not available for this Account." + Switch to Buyer | `GET /v1/bootstrap` |
| Chooser | Each store: name, role, status (accessible label "Store, Role, Status") | `GET /v1/seller/list` |
| No store | "No store is linked to this Account." | same |
| Home | Active store, @handle, "Your role", "Store status" (restricted stores say they are not fully open), Change store (several stores), Overview, Store notifications, Orders, Switch to Buyer | list + overview |
| Overview | "Published Products now: N", "Orders from {from} to {to}: N", "Active reservations: N", "Completed handoffs: N", "Followers: N"; only counts the server returned; 403 "not available for your role" | `GET /v1/seller/analytics/overview` (server default window) |
| Store notifications | The shared inbox: Unread/Read in words, a neutral sentence (no Seller templates exist), "It is about one of this store's Orders.", time, Mark as read (busy), Refresh, Load older (busy) | `GET /v1/notifications?as=seller&seller_id=`, `POST /v1/notifications/{id}/read` |
| Orders | "Orders are view only here...", tabs Needs action / Active / Completed / Cancelled (the server's buckets), rows: state, placed, total, products, expires, ready; Load more; 403 "not available for your role" | `GET /v1/seller/orders` |
| Order | "Status: {state}", placed, total, expires/ready, "Products in this Order: N", the view-only note; 404 "This Order is not available." | `GET /v1/seller/orders/{id}` |

No screen offers an Order, payment, stock, product, team or settings action.

## 4. Lifecycle rules implemented

- **Confirmed unavailable** (false, or no account_context): fail closed, no Seller request.
- **Permission denied** (403 on a feature): that feature says it is not available for the role; the
  store stays open.
- **Session expired** (401 `SESSION_EXPIRED` / `SESSION_REVOKED` on a request that carried the
  bearer): the existing single path ends the session; Seller mode leaves.
- **Offline / server unavailable:** shown as such, with Retry; never treated as revocation, never a
  sign-out.
- **Relationship revoked:** a 404 on a store read, or a list that no longer returns the store, closes
  it; a stale bootstrap cannot keep it open (the list decides).

## 5. Tests

Filled in the founder handoff (exact counts and commands).

## 6. What was not done

- Native Android and iOS verification (backlog).
- Order or payment actions, notification preferences, Seller messages, reviews, full analytics,
  push, Courier (deferred or unsupported: capability matrix).
- Backend contract fixes (W20-01..W20-07).
- Updating the stale "two modes" lines in other repository documents.
