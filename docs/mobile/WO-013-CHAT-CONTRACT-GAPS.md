# WO-013 -- Chat: design versus the existing backend

Work order WO-013 (12 November 2026). This record compares the November design (ADU-CHAT-01
v3.3, ADU-CHATBOT-01 v3.3, ADU-MOB-02 v4.3 S123-S130 and S232) with the Chat API that exists today
(`apps/api/src/modules/chat`, ADU-API-01 S12.7), and says what Mobile built. **The canonical Chat
design is NOT complete; Mobile implements the subset the backend supports.**

Status key:
- **SUPPORTED:** built in Mobile on an existing endpoint.
- **PARTIAL:** built, but narrower than the design.
- **DEFERRED:** possible on today's backend, not built in this work order.
- **BACKEND GAP:** needs a server or contract change.
- **POLICY OPEN:** needs a product decision.

| # | Design requirement | Source | Backend today | Mobile | Status |
|---|---|---|---|---|---|
| 1 | One conversation per Buyer, Seller and Market; create or return | CHAT S1, S3, S19 | `POST /v1/conversations {seller_id}`, unique pair, idempotent | Message Seller | SUPPORTED |
| 2 | Entry from the Seller Profile | MOB R-09; CHAT S5 | yes | Built (by the profile's `seller_id`) | SUPPORTED |
| 3 | Ask Seller from a Product, the Product preselected | MOB R-07; CHAT S5 | A per-message `product_id` anchor (the Seller's PUBLISHED Products only); the Product DTO carries the Seller's handle, not its id | WO-014: Ask Seller About This Product on Product Detail; the Seller resolved by the public storefront read of that handle; the Product preselected for the next message only; WO-015: the composer's Select Product lists the conversation Seller's public Products (paged) and attaches one the same way | SUPPORTED (WO-014 Product Detail entry; WO-015 Select Product inside the conversation, for conversations within the Buyer's 100 most recent: no Seller id is published) |
| 4 | Entry from a Scene; a SCENE_POST subject; Scene with a tagged Product | CHAT S4, S5 | None: no Scene subject, no source context | Not built | BACKEND GAP |
| 5 | ORDER subject from Order Detail | CHAT S4, S5 | A per-message `order_id` anchor (this pair's Orders) | Not built (Orders not built) | DEFERRED |
| 6 | Per-message immutable subject: NONE, PRODUCT_POST, SCENE_POST or ORDER, and a source context | CHAT S4, S25 | `product_id` or `order_id`, at most one | WO-014: NONE or a Product (`product_id`, re-read before sending); no Scene, Order or source context | PARTIAL |
| 7 | Sender kinds BUYER, SELLER_OWNER, TEAM_MEMBER, BOT | CHAT S7 | BUYER, SELLER, TEAM_MEMBER, BOT | Labelled You / Seller / Seller team / Automated answer | SUPPORTED (SELLER is the owner) |
| 8 | System facts as timeline events, never as messages | CHAT S7 | None | None shown | BACKEND GAP |
| 9 | Staff label and bot brand | CHAT S9 | n/a | Generic labels ("Seller team", "Automated answer") | POLICY OPEN |
| 10 | Operator messages with their own provenance | MOB S125, S1970 | None; CHAT S3 bars Operators as participants | None | POLICY OPEN (documents conflict) |
| 11 | PENDING, SENT and FAILED states; no false sent state | CHAT S10 | 201 on acceptance | The draft stays in the box with "Sending" or "not sent"; shown only after acceptance | SUPPORTED |
| 12 | Read state per side (a high-water mark), `POST .../read` | CHAT S10 | A `read_at` column; no read endpoint for the Buyer | Not built | BACKEND GAP |
| 13 | Bounded foreground polling with conditional requests | CHAT S10 | Plain GET (no ETag) | Re-read every 30 s while focused in the foreground; Refresh; on opening | PARTIAL |
| 14 | No presence or typing indicators | CHAT S10 | n/a | None | SUPPORTED |
| 15 | Connected-only; no durable queue; a local draft is allowed | CHAT S10; MOB S161 | n/a | In-memory draft, dropped with the screen or session | SUPPORTED |
| 16 | Bounded text length (no numeric limit in the design) | CHAT S12; BOT S83 | 1-4,000 characters | 4,000 enforced before sending | SUPPORTED (server's value) |
| 17 | Private image attachments (CHAT_ATTACHMENT) | CHAT S12, S14 | None | None | BACKEND GAP |
| 18 | Quick replies (chip_id) | BOT S19 | `chip_id` accepted on send; no endpoint lists a Buyer's chips | None | BACKEND GAP |
| 19 | Idempotency-Key on send; IDEMPOTENCY_KEY_REUSED | CHAT S15 | Yes | One key per draft, kept across a lost connection | SUPPORTED |
| 20 | Context error codes (MESSAGE_PRODUCT_POST_INVALID and others) | CHAT S15 | NOT_FOUND / VALIDATION_FAILED | The server's message rendered | PARTIAL |
| 21 | No model prose; templates; a missing slot escalates | BOT S3, S31 | Templates only; a template with slots escalates | Renders `chat.bot.*` catalogue copy only, otherwise "This automated answer cannot be shown." | PARTIAL (no catalogue for answer templates) |
| 22 | A bot answer is labelled and never looks human | MOB S128; CHAT S9 | n/a | "Automated answer", its own styling | SUPPORTED |
| 23 | Escalation to a human, no response-time promise | BOT S18-S19, S71; MOB S130 | `POST .../escalate` (Buyer only) | "Ask the Seller" after an automated answer; the server's escalation line | SUPPORTED |
| 24 | WAITING_FOR_HUMAN status shown | CHAT S1, S8 | No conversation status field | Only the escalation message | PARTIAL |
| 25 | Report a message to Moderation (target MESSAGE) | CHAT S12; MOB S123 | Not in the Chat API | None | DEFERRED |
| 26 | Blocking | MOB S124 | n/a | None | POLICY OPEN |
| 27 | Archive and mute (presentation only) | CHAT S12 | None | None | DEFERRED |
| 28 | Push for a new message | CHAT (policy-controlled) | None | None (push out of scope) | DEFERRED |
| 29 | Unread counts | not designed | None | None (not fabricated) | -- |
| 30 | Cross-account isolation without enumeration | CHAT S17 | 404 for non-members | Relies on it; "not available" | SUPPORTED |
| 31 | Message text never in logs or analytics | CHAT S17 | n/a | Not logged | SUPPORTED |
| 32 | Generated DTOs, no hand-written types | MOB S232 | No schemas published | Answers checked at the boundary (`src/buyer/chat.ts`) | BACKEND GAP (contract) |
| 33 | One conversation read by id (title, Seller) | not designed | None | Title from the cached list, else "Conversation" | BACKEND GAP (minor) |

## Notes

- **Seller identity.** It comes only from a public read's `seller_id`: the Seller Profile read,
  or (WO-014) the storefront read of the handle a Product names, used only when it answers for
  that same handle. Handles and names are never used as ids. Route parameters carry the
  conversation reference and, from a Product, its public handle and slug as lookup keys only. The
  server decides membership.
- **Bot answer templates.** `nlu.answer_template.template` values are template resources. No
  mobile catalogue entry exists for them, so every keyword or chip answer currently shows the
  neutral line, and Ask the Seller is offered. Only the escalation line (`chat.bot.escalated`)
  renders.
- **Product context.** Row 3 is built (WO-014, ON-20261111-151): the composer shows the Product
  from the screen's own current public read, re-reads it before an anchored send, and clears it
  after the server accepts. Message history shows "About a Product" without a name: no Product
  read by id exists (row 33's kind of gap), so a past message's Product is never named from a
  guess. The Product's Seller is matched to the conversation by the Seller handle in the Buyer's
  conversation list; the Product DTO and the list carry no `seller_id` (see
  `docs/mobile/WO-014-PRODUCT-CONTEXT-MESSAGING.md`).
- **Seller side (WO-021).** The store's side of the same conversations is now built in the Seller
  Companion (`docs/mobile/WO-021-SELLER-MESSAGING.md`). It satisfies the following rows for the
  store too, on the same endpoints with `X-Adulis-Seller`:
  - Row 7: the server's sender kinds, labelled Buyer / Store owner / Store team member /
    Automated answer.
  - Rows 11, 15 and 16: shown only after acceptance; connected-only, in-memory draft; 4,000
    characters.
  - Row 13: re-read on opening, on Refresh and every 30 s while focused. It is still a plain GET,
    so the row stays PARTIAL.
  - Rows 19 and 22: one key per reply intent; automated answers labelled.
  - Rows 29-31: no unread counts are fabricated; another store's conversation is "not available";
    message text is never logged.

  No status above changes. Rows 4, 5, 6, 8, 12, 17, 18, 24 and 32 remain gaps on the Seller side
  as well (WO-021 W21-01, W21-05). The Seller-side authorization question, whether MOBILE may use
  the Seller inbox at all, is WO-021 W21-02 (SPEC_CONFLICT with ADU-API-01 v1.11 S12.7).
