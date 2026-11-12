# WO-020 -- Seller Companion API capability matrix

12 November 2026. What a MOBILE session may actually do for the Seller Companion, endpoint by
endpoint, and how each proposed feature is classified.

## Sources

| Source | What it settles |
|---|---|
| `contracts/openapi.json` (generated) | Paths, parameters, and that **no response schema is published** for any endpoint below except `/v1/bootstrap` |
| `db/migrations/0006_permission_catalogue.sql` (read only) | The twelve permissions whose `surfaces` include MOBILE and which roles hold them |
| `db/migrations/0005_..._operators.sql` `core.fn_has_permission` | Enforcement: no relationship is a scope failure (404); a missing role grant or surface is 403 |
| `docs/ADU-API-01_API_Contract_v1_11_ASCII.md` S4.2, S12.11, S12.13, S12.14, S15.0a | **M** markers (MOBILE-reachable), `X-Adulis-Seller` rules, bucket semantics, scope parameter rule |
| `docs/build-status/DEFECT-REGISTER.md` D-243 | `GET /v1/seller/list` behaviour (owned and team stores, role per row, DELETED excluded, no seller header) |
| **Runtime probe** (`G:\AdulisDevelopment\WO-020\logs\api-probe.txt`, `api-probe-2.txt`) | The executable response shapes and MOBILE authorization, from a MOBILE session of the fixture store owner (role OWNER) on the disposable `adulis_gates` review data |

`apps/api` and `apps/console` were **not read** (mobile read boundary, ADU-REPO-01 S8). The runtime
probe replaced reading the executable code; it ran the API process only (the database container was
already running) and stopped it afterwards.

## Enforcement in one paragraph

Every `/v1/seller/*` call except the list carries `X-Adulis-Seller`; absent is 400
`SELLER_CONTEXT_REQUIRED`, a store the Account does not hold is 404 `NOT_FOUND` (never 403, so it
does not confirm the store exists). Within a held store, the database checks the role grant AND the
permission's surfaces for the session's audience in one query (`core.fn_has_permission`): MOBILE
without the surface is 403 `PERMISSION_DENIED`. All six team roles (OWNER, ADMIN, SALES_SUPPORT,
INVENTORY, ANALYST, CAMPAIGN_MANAGER) hold `seller.orders:read`, `seller.analytics.basic:read` and
`seller.notifications:read`, each with surfaces {MOBILE, CONSOLE}.

## Endpoints

| Endpoint | Auth | Seller context | Permission | MOBILE | Response contract | Safe to use | UI feature |
|---|---|---|---|---|---|---|---|
| `GET /v1/bootstrap` | Optional bearer; `account_context` only for a MOBILE session | None | None | Yes | Published (`AccountContextDto`) | Yes | Mode gate (`seller_companion.available`) |
| `GET /v1/seller/list` | MOBILE bearer (guest 401 `SESSION_EXPIRED`) | **None** (exempt, D-243) | Relationship only (owner or unsuspended, unrevoked team member) | Yes (probe 200) | **Not published.** Observed: `{ data: [{ id, handle, store_name, status, role, created_at }] }`; empty list for no relationship | Yes, validated at the boundary | Store chooser, active store |
| `GET /v1/seller/analytics/overview` | MOBILE bearer | Required (400 without, 404 foreign) | `seller.analytics.basic:read` | Yes (**M**, S12.13; probe 200) | **Not published.** Observed: `{ products_published, orders, active_reservations, completed_handoffs, followers, window: { from, to } }`; `from`/`to` optional (default the last 30 days; `from` after `to` is 400) | Yes, validated | Home overview |
| `GET /v1/seller/orders` | MOBILE bearer | Required | `seller.orders:read` | Yes (**M**, S12.11; probe 200) | **Not published.** Observed: `{ data: [{ id, state, total_minor, total_currency, expires_at, ready_at, clock_stopped_at, created_at, line_count, payment_sla_deadline, total: { amount_minor, currency } }], has_more, next_cursor }`; `bucket` in needs_action, active, completed, cancelled (other values 400); no bucket returns all | Yes, validated | Orders list |
| `GET /v1/seller/orders/{id}` | MOBILE bearer | Required (another store's Order 404) | `seller.orders:read` | Yes (**M**; probe 200) | **Not published.** Observed: the list fields plus `allowed_actions`, `lines`, `payment_submissions`, `history`; the item shapes of the last three were empty in the review data | Partly: scalar fields and the line count only | Order detail |
| `GET /v1/notifications?as=seller&seller_id=` | MOBILE bearer | Required and must equal `seller_id` (400 `SCOPE_PARAMETER_REQUIRED` otherwise) | `seller.notifications:read` | Yes (**M**, S12.14; probe 200) | **Not published.** Observed: `{ data: [{ id, template_key, locale, slots, order_id, suppressible, scheduled_for, read_at }], next_cursor }` (the Buyer inbox's shape) | Yes, validated (shared Buyer boundary) | Store notifications |
| `POST /v1/notifications/{id}/read` | MOBILE bearer, Idempotency-Key | None | The recipient's own row | Yes (**M I**) | Not published; `{ read_at }` (WO-012) | Yes | Mark one as read |
| `POST /v1/notifications/read-all` | MOBILE bearer | None | Account-wide | Yes (**M I**) | Not published | **No**: marks the whole Account read, Buyer and every store | Not used |

## Features

| Feature | Classification | WO-020 implementation |
|---|---|---|
| Seller mode availability from the server | SUPPORTED | Implemented |
| Switch to Seller / Switch to Buyer on one session | SUPPORTED | Implemented |
| Store chooser (one, several, none; status and role shown) | SUPPORTED (shape unpublished, validated) | Implemented |
| Basic overview counts | PARTIALLY SUPPORTED: the counts are supported; whether each count follows the window is published for none (probe: `orders` follows it, `products_published` does not; the other three undetermined) | Implemented; only verified labels claim a range |
| Store notifications (list, refresh, older pages, read state) | SUPPORTED (template catalogue missing: neutral sentence) | Implemented |
| Mark one notification read | SUPPORTED | Implemented |
| Mark all read | DEFERRED (Account-wide endpoint) | Not built |
| Orders list by server bucket | SUPPORTED | Implemented |
| Order detail | PARTIALLY SUPPORTED: scalar fields; line, payment and history items not observable | Implemented (scalars and line count) |
| Human-readable Order reference | UNSUPPORTED (only the UUID exists) | Not shown |
| Confirm / reject payment (`seller.payment:confirm`, MOBILE for OWNER, ADMIN, SALES_SUPPORT) | DEFERRED (exists; financial action out of scope) | Not built, not callable |
| Mark ready (`seller.order_ready:update`, MOBILE) | DEFERRED | Not built |
| Can't fulfil / reservation cancel (`seller.orders:respond`, MOBILE) | DEFERRED | Not built |
| Refund report, reissue instructions, courier assignment, custody transfer | DEFERRED (not M, or financial) | Not built |
| Payment evidence (`seller.payment_evidence:read`, MOBILE) | DEFERRED (financial) | Not built |
| Order QR (M) | DEFERRED (handoff not in scope) | Not built |
| Notification preferences (M I) | DEFERRED (not in scope) | Not built |
| Seller messages (`seller.messages:read/send`, MOBILE) | DEFERRED (not in this work order) | Not built |
| Reviews (`seller.reviews:read`, MOBILE) | DEFERRED (not in this work order) | Not built |
| Full analytics, export | UNSUPPORTED on MOBILE (not marked M) | Not built |
| Push notifications | DEFERRED (no push infrastructure) | Not built |
| Courier mode | UNSUPPORTED (server says false until WO-API-001B) | Unchanged diagnostic shell |

## Observations for the backend owner

- No response schema is published for the six Seller reads (W20-01).
- The store inbox returned an Account security notice (`NEW_DEVICE_SIGNIN`) and a payout notice
  (`PAYOUT_CHANGE_REQUESTED`, slots `bank_code`, `account_last4`) while the Buyer inbox returned
  none. `core.notification` has no Seller column, so how rows are attributed to one store when an
  Account holds several is not defined anywhere readable (W20-04).
- A malformed `cursor` on `GET /v1/seller/orders` answers 500 `INTERNAL`, not 400 (W20-03).
- Whether `active_reservations`, `completed_handoffs` and `followers` follow the overview window is
  unpublished (W20-02).
