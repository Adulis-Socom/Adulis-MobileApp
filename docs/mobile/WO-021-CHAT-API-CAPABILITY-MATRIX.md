# WO-021 -- Seller-side Chat API capability matrix

12 November 2026. What a MOBILE session of a store's team can do with the existing Chat API, feature
by feature, and what Mobile built on it. An endpoint existing is not enough for SUPPORTED: the
classification also needs MOBILE authorization and a response shape the app can check.

## Sources

| Source | What it settles |
|---|---|
| `contracts/openapi.json` (generated, read only) | Paths and parameters. **No response schema is published** for any `/v1/conversations*` operation (200/201 with no content) and no security requirement is declared |
| `db/migrations/0006_permission_catalogue.sql` lines 125-126, 216-221 (read only) | `seller.messages:read` and `seller.messages:send`, both with surfaces `{MOBILE, CONSOLE}`, granted to OWNER, ADMIN and SALES_SUPPORT only |
| `core.fn_has_permission` (migration 0005, as recorded in WO-020) | No relationship to the store: 404. Role without the grant, or audience not in the surfaces: 403 |
| `docs/ADU-API-01_API_Contract_v1_11_ASCII.md` S12.7, R10 | The five Chat routes; `?as=seller&seller_id=` required for the list; **"Chat is in-app only for the buyer ... the seller's inbox is a console surface ... reachable from CONSOLE in the seller scope"** |
| `docs/system-designs/2026-11-08/` ADU-MOB-02 v4.3 (current design authority) | The Companion Inbox and replies for OWNER and ADMIN; SALES_SUPPORT for Buyer communication; INVENTORY has no unrestricted Inbox |
| The work order (WO-021 S4-S5) | The list row shape `{ id, buyer_account_id, started_at, last_message_at }`, X-Adulis-Seller on all three calls |
| `chat.conversation` (DB-01) | Columns id, seller_id, buyer_account_id, market_id, started_at, last_message_at (both times NOT NULL) |

`apps/api` was **not read** (mobile read boundary). **No runtime probe was run**: the work order
forbids starting the API, PostgreSQL or Docker. Every "Observed" column of WO-020 is therefore
"Not observed" here.

## Authorization: SPEC_CONFLICT (W21-02)

- **Executable catalogue:** MOBILE may read and send for OWNER, ADMIN and SALES_SUPPORT.
- **Design authority (November pack):** agrees, and adds that INVENTORY has no unrestricted Inbox.
- **Implementation contract (ADU-API-01 v1.11 S12.7):** the Seller inbox is CONSOLE only.

Whether the running API accepts `as=seller` from a MOBILE session was **not verified**. The app
fails closed. 403 `PERMISSION_DENIED` or `AUDIENCE_NOT_PERMITTED` on any of the three calls shows
"Messaging is not available for your role in this store." It never signs out and never retries.
Polling stops. **Seller-side messaging permissions applying to MOBILE is confirmed by the
catalogue only, not at runtime.**

## Endpoints

| Endpoint | Auth | Seller header | Permission | MOBILE authorization | Response schema | Used for |
|---|---|---|---|---|---|---|
| `GET /v1/conversations?as=seller&seller_id={id}&cursor=` | MOBILE bearer | Required, must equal `seller_id` (R10) | `seller.messages:read` | Catalogue yes; ADU-API-01 S12.7 says CONSOLE; route marked **M**; runtime unverified | **None published.** Expected (WO): `{ data: [{ id, buyer_account_id, started_at, last_message_at }], next_cursor }`. Checked in `src/seller/seller-chat.ts` | Inbox |
| `GET /v1/conversations/{id}/messages?cursor=` | MOBILE bearer | Required by the work order (not under `/v1/seller`, so nothing adds it implicitly) | `seller.messages:read` | Catalogue yes; route **not marked M** in S12.7, although the Buyer side already reads it from MOBILE; runtime unverified for the Seller side | **None published.** The Buyer shape (WO-013): `{ data: [{ id, sender_kind, body, template_key, resolution_path, sent_at, product_id, order_id }], next_cursor }`. Checked by the shared `parseMessagePage` | History |
| `POST /v1/conversations/{id}/messages` | MOBILE bearer + `Idempotency-Key` | Required (and the only thing that makes a same-Account reply the store's) | `seller.messages:send` | Catalogue yes; route marked **M I**; runtime unverified | **None published.** 201 `{ message_id, bot }`; accepted only with a UUID `message_id` | Reply |
| `POST /v1/conversations` | -- | -- | -- | -- | -- | **Not called** from Seller mode (no conversation is created by replying) |
| `POST /v1/conversations/{id}/escalate` | -- | -- | -- | -- | -- | **Not called** (a Buyer action) |

## Features

| Feature | Endpoint | Status | Remaining limitation |
|---|---|---|---|
| Messages entry on Seller Home | -- | SUPPORTED | Shown for every store role; a role without the permission gets the server's 403 (W21-06) |
| Conversation list, most recent activity first | GET list | PARTIALLY SUPPORTED | Shape not published or observed (W21-01, W21-03); MOBILE runtime unverified (W21-02) |
| Buyer display identity in the list | -- | UNSUPPORTED | No Buyer name, handle or photo is published; rows read "Buyer conversation" + last activity (W21-04). `buyer_account_id` is not read |
| Cursor pagination and Refresh | GET list | PARTIALLY SUPPORTED | As the list |
| Unread counts / read state | -- | UNSUPPORTED | No read endpoint or unread field (WO-013 row 12); none shown |
| Message previews | -- | UNSUPPORTED | No preview field; none invented |
| Message history with sender attribution | GET messages | PARTIALLY SUPPORTED | BUYER / SELLER (owner) / TEAM_MEMBER / BOT from the server; whether an ADMIN's reply is SELLER or TEAM_MEMBER is not documented (W21-11) |
| Automated answers | GET messages | PARTIALLY SUPPORTED | Only `chat.bot.*` catalogue copy renders, else the neutral line; the escalation line is worded for the Buyer (W21-12) |
| Product / Order anchors in history | GET messages | PARTIALLY SUPPORTED | "About a Product" / "About an order" only; no read names either |
| Older messages, Refresh, 30 s focused polling | GET messages | PARTIALLY SUPPORTED | No conditional requests (WO-013 row 13) |
| Plain-text reply (1-4,000) with idempotency | POST messages | PARTIALLY SUPPORTED | MOBILE runtime unverified (W21-02); response shape unpublished (W21-01) |
| Anchored replies (Product or Order) | POST messages | DEFERRED | Excluded by WO-021 |
| Quick replies, attachments, archive, mute, block, report | -- | UNSUPPORTED | Backend or policy gaps as WO-013 rows 17, 18, 25-27 |
| Push for a new message, presence, typing, read receipts | -- | UNSUPPORTED | Excluded by WO-021 and absent from the API |
| Conversation creation from Seller mode | POST conversations | UNSUPPORTED (by design) | A store answers; it never opens a thread |

No feature is SUPPORTED without qualification. The cause is the same for every row: no schema is
published, there was no runtime probe, and the documents conflict on MOBILE.
