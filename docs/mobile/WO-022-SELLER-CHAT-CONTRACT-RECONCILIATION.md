# WO-022 -- Seller Chat contract reconciliation (proposal)

12 November 2026. A proposal for the founder to resolve W21-02, the open question of whether a MOBILE
session may read and answer Buyer conversations as a store. **This is a proposal, not an amendment.**
No backend, database, contract or governing document was changed. The backend remains the
authorization authority.

It also carries:
- the additive response-schema proposal for W21-01 (section 11);
- the backend verification matrix still owed (section 12).

## 1. The conflicting sources

| Source | Provision | What it says |
|---|---|---|
| ADU-API-01 v1.11 (implementation contract) | S12.7, line 1035 | "Chat is in-app only for the buyer (S15). The seller's inbox is a console surface (ADU-CON-03 SC-20), so this group is reachable from `CONSOLE` in the seller scope." |
| ADU-API-01 v1.11 | S12.7 route table | `GET /v1/conversations` is marked **M**, `POST .../messages` **M I**, and `GET .../messages` has **no M**. Yet the Buyer side reads history from MOBILE (WO-013), so the markers are inconsistent with the text and with use |
| ADU-API-01 v1.11 | R10 (line 233) | `?as=buyer` or `?as=seller&seller_id=` is required, with no default, "because one account holds both roles" |
| `db/migrations/0006_permission_catalogue.sql` (executable) | lines 125-126, 216-221 | `seller.messages:read` and `seller.messages:send` have surfaces `{MOBILE, CONSOLE}`, granted to OWNER, ADMIN and SALES_SUPPORT |
| ADU-MOB-02 v4.3 (November design authority) | S152 "Seller Inbox" | "Seller Inbox contains Buyer conversations and chatbot escalations for the active Seller ... Inbox is granted to OWNER/ADMIN/SALES_SUPPORT as permitted. INVENTORY has no unrestricted Buyer Inbox; ANALYST and CAMPAIGN_MANAGER do not inherit raw messages" |
| ADU-MOB-02 v4.3 | Companion role table and line 1501 | OWNER/ADMIN: Inbox; SALES_SUPPORT: "Inbox/replies/escalation"; INVENTORY: "No unrestricted Inbox". "Companion navigation is capability-aware ... hide unrestricted Inbox" for INVENTORY |
| ADU-AUTH-02 v3.3 | S157 seed; line 1492 | Permissions **`seller.inbox:read`** and **`seller.inbox:reply`**. OWNER has all, ADMIN all but a stated few, SALES_SUPPORT has both. "Inbox/Claim support: Console + permitted support Companion where granted" |
| ADU-CHAT-01 v3.3 | S9 (lines 380-386) | "Seller reads/writes recheck Account standing, current ownership or active membership, effective role union, Seller context, **permitted surface**, Conversation Seller and subject scope on every request ... wrong Seller/conversation, disallowed surface or missing exact capability fails closed" |

**Two conflicts, not one:**

1. **Surface:**
   - ADU-API-01 S12.7 says CONSOLE only.
   - The design pack, the DB catalogue and AUTH-02 say the Companion too, for permitted roles.
2. **Permission names:**
   - The design (AUTH-02 S157) says `seller.inbox:read` / `seller.inbox:reply`.
   - The executable catalogue says `seller.messages:read` / `seller.messages:send`.

   The client never names a permission, so the app is unaffected. A generated permission type
   (CHAT-01 S9 asks for one from AUTH S157) would still disagree with the database until one side
   is renamed.

## 2. November design intent

The Seller Companion has a Seller Inbox for the active store, used by OWNER, ADMIN and SALES_SUPPORT.
INVENTORY, ANALYST and CAMPAIGN_MANAGER do not read raw Buyer messages. Under CLAUDE.md and
DOCUMENT_AUTHORITY.md the November pack outranks the older repository specifications for design
intent, and a disagreement with what is built is a SPEC_CONFLICT that the founder resolves.

## 3. Current executable catalogue

`core.permission` lists `seller.messages:read` and `seller.messages:send` with `{MOBILE, CONSOLE}`.
`core.role_permission` grants both to OWNER, ADMIN and SALES_SUPPORT. `core.fn_has_permission` gives
404 when there is no relationship to the store, and 403 when the role lacks the grant or the
session's audience is not in the surfaces (as recorded in WO-020).

**Not verified:** whether the Chat controller calls that check with the Seller context for the list,
history and send, or whether it applies S12.7's CONSOLE-only rule in code. `apps/api` is outside the
mobile read boundary, and WO-021/WO-022 could not start the API.

## 4. Expected MOBILE behaviour (what the app already implements)

| Request (MOBILE bearer + `X-Adulis-Seller: S`) | OWNER, ADMIN or SALES_SUPPORT of S | INVENTORY, ANALYST or CAMPAIGN_MANAGER of S | Not a member of S |
|---|---|---|---|
| `GET /v1/conversations?as=seller&seller_id=S` | 200, S's conversations | 403 | 404 |
| `GET /v1/conversations/{id}/messages` (conversation of S) | 200 | 403 | 404 |
| same, conversation of another store T | 404 | 404 | 404 |
| `POST /v1/conversations/{id}/messages` `{ text }` | 201; sender `SELLER` (owner) or `TEAM_MEMBER` | 403 | 404 |
| Missing header, or `seller_id` != header | 400 (`SELLER_CONTEXT_REQUIRED` / `SCOPE_PARAMETER_REQUIRED`) | 400 | 400 |

The app fails closed on any 403: "Messaging is not available for your role in this store". It does
not sign out, does not retry, and stops polling. A 404 on the list ends the store selection; a 404 on
one conversation is only "not available".

## 5. Proposed policy (for founder review)

> **Seller Companion messaging is supported for OWNER, ADMIN and SALES_SUPPORT when the backend
> confirms the Seller relationship and the messaging permission for the MOBILE audience.**

## 6. Required API documentation changes (if approved)

All of these are in ADU-API-01. None is made by this work order.

1. **S12.7 text.** Replace "Chat is in-app only for the buyer ... reachable from `CONSOLE` in the
   seller scope" with: the seller scope is reachable from CONSOLE and MOBILE, governed by
   `seller.messages:read` / `seller.messages:send` and their surfaces.
2. **S12.7 markers.** Mark `GET /v1/conversations/{id}/messages` **M** (it is already used from
   MOBILE by the Buyer side).
3. **Seller scope on history and send.** State that, in the seller scope, the history and send
   routes require `X-Adulis-Seller`. State that a request with the header is the store's (sender
   `SELLER` or `TEAM_MEMBER`, derived by the server) even when the same Account is the
   conversation's Buyer. Without the header, it is the Buyer's.
4. **Error table.**
   - 400 for a missing header or a mismatched `seller_id`.
   - 404 for a store the Account does not hold, or a conversation of another store.
   - 403 for a role or surface without the permission.
5. **Permission naming.** Record which name is canonical (`seller.messages:*` as built, or
   `seller.inbox:*` as designed) and rename the other in its own change.
6. **ADMIN attribution.** State whether an ADMIN's reply is `TEAM_MEMBER` or `SELLER` (W21-11).
7. **Response DTOs.** Publish them per section 11, so `contracts/openapi.json` and
   `@adulis/api-client` carry them (W21-01).

## 7. Runtime tests still required

Section 12. **None was run in WO-021 or WO-022.**

## 8. Security implications

- **If MOBILE is denied** while the design intends it: the Companion's Messages entry is inert but
  safe ("not available for your role"). No data leaks.
- **If MOBILE is allowed but the header is ignored on send** (S21-04): a same-Account reply would be
  stored as the Buyer's. The client always sends the header; only a backend negative test can close
  this.
- **If conversation ownership is not checked against the header** (S21-05): a store member could
  read or answer another store's conversation by id. The client cannot check this (any UUID is sent
  under the active store); it shows the server's 404 as "not available".
- **Revocation:** CHAT-01 S9 requires removed or suspended staff to lose access on the next request.
  The app handles the resulting 403/404 without signing out and stops re-reading.
- **Audience:** the Companion uses the one MOBILE session (no Console cookie, no second login). The
  client never asks for a different audience.

## 9. Founder approval required

1. Approve the policy in section 5, or rule that Seller messaging stays Console only. In that case
   the Companion's Messages entry should be removed in a later work order.
2. Choose the canonical permission names (section 6.5).
3. Authorize a backend work order for the contract text, the DTOs and the tests in section 12.

## 10. Acceptance criteria for the future contract change

1. ADU-API-01 S12.7 states the MOBILE seller scope, its permissions and its errors as in section 6.
2. `contracts/openapi.json` publishes the response DTOs in section 11, and `@adulis/api-client`
   regenerates. The mobile boundary validators are then replaced by generated types in a mobile work
   order.
3. Every row of section 12 passes against the running API on a disposable database.
4. A same-Account reply with the store header is recorded as `SELLER` or `TEAM_MEMBER`, never
   `BUYER`, as a backend test.
5. A conversation of store T read or answered under store S's header is 404, as a backend test.
6. INVENTORY, ANALYST and CAMPAIGN_MANAGER receive 403 on all three routes from MOBILE.
7. The permission naming conflict is closed in one place.

## 11. Additive response-schema proposal (W21-01)

These are the fields the mobile screens actually read today. Nothing here is new to the backend.
Every field is already in the answers the Buyer side reads (WO-013), or in the row shape the WO-021
work order states. **Not proposed:** Buyer identity, unread counts, previews, human references.

```
ConversationListPage (GET /v1/conversations, both scopes)
  data: ConversationRow[]
  next_cursor: string | null            -- opaque; see the cursor note
ConversationRow (as=seller)
  id: uuid
  started_at: date-time
  last_message_at: date-time
  buyer_account_id: uuid                -- present today; the app never reads or shows it
ConversationRow (as=buyer, as WO-013 reads it)
  id, seller_id, store_name, handle, started_at, last_message_at

MessagePage (GET /v1/conversations/{id}/messages)
  data: Message[]                        -- newest first
  next_cursor: string | null
Message
  id: uuid
  sender_kind: BUYER | SELLER | TEAM_MEMBER | BOT
  body: string | null                    -- human messages
  template_key: string | null            -- BOT only
  slots: object | null                   -- BOT only (S12.7); not read by the app today
  resolution_path: string | null         -- BOT only (ESCALATED and others)
  sent_at: date-time
  product_id: uuid | null
  order_id: uuid | null

MessageAccepted (POST /v1/conversations/{id}/messages, 201)
  message_id: uuid
  bot: object | null                     -- the automated answer, if any; not read by the app today
```

**Cursor note (new, W22-07):**
- WO-013 records timestamp cursors.
- The server writes a Buyer message and its automated answer in one transaction with the same
  `sent_at` (ON-20261111-153).
- If the next page is "older than the cursor's time", a pair split across a page boundary would lose
  its second message.
- The contract should state that `next_cursor` is opaque and unique (for example the time plus the
  message id).
- Not verified at runtime; the mobile side cannot fix it.

## 12. Backend verification matrix (pending runtime verification)

Each row: a MOBILE session; `S` and `T` are stores, and `cS` and `cT` are conversations of each.
**Status for every row: NOT EXECUTED (WO-022 does not authorize the API or database).**

| # | Actor (role in S) | Request | Expected |
|---|---|---|---|
| 1 | OWNER | list S; history cS; send cS | 200; 200; 201, sender `SELLER` |
| 2 | ADMIN | list, history, send | 200, 200, 201; record the sender kind (W21-11) |
| 3 | SALES_SUPPORT | list, history, send | 200, 200, 201, sender `TEAM_MEMBER` |
| 4 | INVENTORY | list, history, send | 403 on each |
| 5 | ANALYST | list, history, send | 403 on each |
| 6 | CAMPAIGN_MANAGER | list, history, send | 403 on each |
| 7 | OWNER | wrong header (T, not held) on list, history, send | 404 |
| 8 | OWNER | missing header on list (`as=seller`) | 400 |
| 9 | OWNER | `seller_id=S` with header T | 400 |
| 10 | OWNER of S and T | history and send of cT under header S | 404 |
| 11 | OWNER of S, also the Buyer of cS | send with header S; send without the header | `SELLER`; `BUYER` |
| 12 | OWNER | send the same key twice; then the same key with other text | one message; `IDEMPOTENCY_KEY_REUSED` (or the contract's code) |
| 13 | SALES_SUPPORT removed mid-session | next list, history, send | 403 or 404, never data |
| 14 | OWNER of S | list S, then list T (not held) | T is 404; no S rows under T |
| 15 | Two Accounts | Account B reads Account A's Buyer conversation by id | 404 |
| 16 | Any | a message pair with one `sent_at` across a page boundary | both returned once (section 11 cursor note) |
