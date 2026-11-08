# Adulis Buyer-Seller Chat
Version 3.3 | 8 November 2026 | DOCUMENT-CORRECTED

## Document control

Current-state reconciliation: 8 November 2026. Baseline: complete v3.2 dated 13 October 2026. The final “Post-October-13 reconciliation” section is normative for every changed area and supersedes any earlier conflicting passage in this document. Unchanged sections remain part of the complete design and retain their original meaning. This is a full document, not a delta-only amendment.

Contract revision: 13 October 2026. Working baseline: complete v3.1 dated 12 October 2026. Selected repairs in this document: R02. Original numbered body sections and unaffected requirements/tables/graphics remain; historical audits and correction records are preserved separately.

| Document control | Current contract revision |
| --- | --- |
| Version history | 3.0 reviewed 8 October 2026 -> 3.1 amended 12 October 2026. -> 3.2 contract-corrected 13 October 2026 -> 3.3 post-October-13 reconciled 8 November 2026. |
| Source | ADU-CHAT-01_Adulis_Buyer_Seller_Chat_System_Design_v3.2.pdf |
| Authority | 13 October complete contract-corrected pack + approved post-13 founder/prototype decisions + accepted WO-001/WO-001A decisions, reconciled 8 November 2026. |
| Status | CURRENT-RECONCILED complete system design; implementation/deployment evidence remains separately gated. |
| Development / activation | Synthetic-data/sandbox engineering proceeds; actual payment/social/privacy/calibration gates remain evidence-dependent. |
| Change register | Final reconciliation section records every post-13 change applied to this design and its resulting current rule. |

## 1. Canonical decisions and supersession

Status: FINALIZED MVP ARCHITECTURE. This manual is authoritative for Buyer-Seller Chat behavior, message context, Chat timeline events and the Chat-to-Checkout handoff. Owning domains remain authoritative for Product, Inventory, Order, Payment, Handoff, Claims, Trust, Moderation, Notification and Media facts.

### Closed MVP decisions

• One Buyer + one Seller + one Market = one Conversation. Product, Scene Post and Order context belongs to individual Messages, never the Conversation row.

• Canonical Seller content objects are Product Posts and Scene Posts. Scene Post is the actual Content identity; Message subjects use PRODUCT_POST or SCENE_POST.

• Chat is connected-only. Message acceptance requires server acknowledgement; no disconnected business mutation queue exists.

• Commerce uses Checkout plus an approved payment service provider. Chat never establishes payment success and never contains a separate pre-payment transaction lifecycle.

• Valkey is the only cache/async datastore name. PostgreSQL remains canonical; BullMQ executes asynchronous work.

• English automated Chat supports free text plus Quick Replies. Amharic/unsupported automated locales use localized Quick Replies until a dedicated engine is approved; authorized active human takeover permits human free text under Chat capability policy. WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

• Chat includes a first-class system timeline event model separate from human and Bot Messages.

• When Buy is initiated from Chat, the Buyer must review and explicitly confirm the exact current selection before payment begins.

### Superseded older assumptions

| Older assumption | Current replacement |
| --- | --- |
| Conversation can imply current Product/Order | Conversation is relationship-only; composer state is temporary; each Message captures its own immutable subject. |
| Only Product / Order message anchors | Product Post / Scene Post / Order / Seller-General message context. |
| Direct/manual payment instruction patterns | PSP/provider Checkout; Chat never establishes payment truth. |
| Chat free text in any launch language | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |
| Legacy queue datastore terminology | Valkey + BullMQ execution; PostgreSQL canonical. |
| General disconnected-mode assumptions | Connected-only Chat; unsent draft may exist locally but is never treated as sent. |

Historical reviewed-baseline note (superseded by the selected 12 October amendment): Version 3.0 / 7 October 2026 reconciles this complete design to the supplied current specification. The current Scene, Account, selector, visibility and Operator rules supersede conflicting older language; the original Chat architecture remains intact.

## 2. Mission, principles and domain boundaries

Buyer-Seller Chat gives Buyers and Sellers a structured commerce conversation without turning the conversation into a second Catalogue, Inventory, Checkout or Payment system. The system must preserve what the parties said and what they were discussing, while always resolving current commerce truth from the owning domain.

### Core philosophy

```
THREAD = relationship
MESSAGE = communication + immutable message context
SYSTEM EVENT = referenced domain fact
CHAT TEXT != product / stock / price / payment / order truth
STRUCTURED ACTION -> owning domain
CONNECTED SERVER ACK -> sent
```

### Chat owns

• Conversation identity and uniqueness

• Immutable human and Bot Messages

• Message-level subject and provenance context

• Actual sender attribution

• Read high-water state and unread projections

• Conversation summaries, archive and mute preferences

• Escalation workflow and Seller response metrics

• Private Chat attachment references

• System timeline event references

• Message reporting and Claim evidence references

### Chat does not own

• Product Post publication, Product facts, Variant definitions or price

• Inventory availability or stock mutation

• Scene Post lifecycle or tagged-product truth

• Checkout legality, payable total or short checkout stock allocation

• Payment attempt status, provider verification or refund completion

• Order transitions, fulfilment or Handoff verification

• Seller Trust Level, Review Grant or Claim decision

• Notification transport, OTP challenges or Media processing

### A Seller or Buyer may discuss any commerce fact in prose. That prose can become evidence, but it does not

### mutate canonical commerce state.

## 3. Account, participant and conversation identity

One human uses one ordinary Adulis Account across Buyer capability, Seller ownership relationships, Seller-team participation and Courier profile/relationships. Different humans use different Accounts; Seller credentials are never shared. At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the MVP team slot. Multiple roles within that membership compose by current effective permission union. Ownership and Courier relationships are separate from the team slot.

Switching Buyer, Seller or Courier context changes presentation and scoped authority, never the human's identity. An unrelated Courier or Seller relationship cannot grant access to a Buyer Order, another Seller's records or privileged operations.

### Conversation identity

One Buyer relationship + one Seller business + one Market = one long-lived Conversation. The Buyer is the ordinary Account acting as Buyer for this relationship. Seller ownership/team Accounts act on behalf of the Seller business; every accepted Message preserves the actual ordinary Account actor. An Operator Account is never a Buyer/Seller-side Chat participant.

Conversation has no current Product, Scene, Order or Variant subject. Entry from any of those surfaces reuses the same relationship thread; context selection affects only the next Message.

![One relationship thread, many immutable Message subjects](graphics/CHAT_01.svg)
*Figure 01. One relationship thread, many immutable Message subjects. Buyer ordinary Account, Seller business and Market define the thread; Product, Scene and Order belong to individual accepted Messages.*

```
UNIQUE (buyer_account_id, seller_id, market_id)
```

| Conversation field | Rule |
| --- | --- |
| id | Opaque stable identifier; non-enumerating public reference. |
| buyer_account_id | FK to the ordinary Account acting as this Conversation Buyer. |
| seller_id / market_id | Seller business and canonical Market; exact scoped relationship. |
| created_at / last_message_at | Server timestamps. |
| archived / muted preferences | Per-side presentation only; never evidence deletion. |
| No Product/Scene/Order columns | Current composer selection is temporary UI state. |

## 4. Message model, subjects and source context

Each sent Message may have one authoritative primary subject. If a Product Post was selected from a Scene Post, the Scene Post is provenance/source context rather than a competing subject. Context is captured at send time and is immutable after server acceptance.

### MVP primary subjects

| Subject | Meaning | Validation owner |
| --- | --- | --- |
| NONE | Seller / General discussion | Conversation already establishes Seller. |
| PRODUCT_POST | Question about one Seller Product Post / sellable Product | Catalogue + Seller ownership + Market/public accessibility. |
| SCENE_POST | Question about a Seller Scene Post as a whole | Content + Seller ownership + Market/public accessibility. |
| ORDER | Question about an Order between this Buyer and Seller | Order owner + Buyer/Seller/Market scope. |

### Product selected from Scene Post

```
primary subject: PRODUCT_POST -> Black Jacket
source context: SCENE_POST -> University Outfit
```

```
Rule: the Product Post must actually be tagged in that Scene Post.
```

### Recommended schema direction

```
chat.message
id
conversation_id
sender_kind
sender_account_id?
body?
chip_id?
locale
subject_type = NONE | PRODUCT_POST | SCENE_POST | ORDER
subject_ref?
source_context_type? = SCENE_POST
source_context_ref?
source_scene_revision_id?
display_snapshot jsonb
sent_at
idempotency_key_hash
```

If the existing physical schema is safer to extend with typed nullable foreign keys, that is acceptable, but database constraints must guarantee exactly one primary subject and a valid Product-Post-from-Scene-Post relationship. Generic unchecked target_type/target_id pairs are not sufficient if strong foreign-key integrity can be preserved.

### Immutability

• No supported endpoint edits a sent Message body.

• No supported endpoint changes a sent Message subject or source provenance.

• Product/Post unpublication does not erase historical Chat context.

• A historical display snapshot is context only; current commerce actions always resolve current canonical state.

New Buyer subject selection resolves current authorized domain reads. PRIVATE/draft/deleted/moderation-restricted Scenes are not newly selectable. Product-from-Scene provenance must validate Product membership in the exact referenced Scene revision/tag relationship; current public accessibility and conversation Seller/Market scope still apply.

A historical Message retains immutable body, subject, source Scene/revision, sender, sent_at and a bounded display snapshot. If its Scene later becomes PRIVATE, preserve safe historical/unavailable context for readability and authorized evidence. Opening the current Scene always rechecks Content; never expose Seller-private content or newer private revisions.

## 5. Context-aware Buyer UX

Expose two clear optional controls near the Conversation header/composer: Scene selector and Product selector. Every selection visibly describes the next Message; neither changes Conversation identity or old Messages.

### Selector behavior

![Optional Scene and Product selectors determine the next Message](graphics/CHAT_02.svg)
*Figure 02. Optional Scene and Product selectors determine the next Message. Scene selection filters Product choices to its tagged Products; a Product becomes the primary subject while Scene remains exact revision provenance. ORDER is independent.*

| Scene selected | Product selected | Next Message subject / provenance |
| --- | --- | --- |
| No | No | NONE: Seller / General. |
| No | Yes | PRODUCT_POST; Product selector lists the Seller current eligible catalogue. |
| Yes | No | SCENE_POST: the whole currently accessible/public Scene. |
| Yes | Yes | PRODUCT_POST primary + SCENE_POST source provenance; Product selector contains only Products tagged in that Scene. |

Clearing the Scene selector returns the Product selector to the full current Seller catalogue. A browse-all action must visibly clear the Scene filter/provenance before an unrelated Product is used. Server validation prevents an untagged Product from acquiring Scene provenance.

| Entry surface | Initialization in the same Buyer-Seller-Market Conversation |
| --- | --- |
| Seller Profile | Load existing thread or create/open the unique blank thread; NONE. |
| Product Post | Product selector = that current Product. |
| Scene Post | Scene selector = that current accessible Scene. |
| Tagged Product from Scene | Scene + Product selected; Product primary and exact Scene revision provenance. |
| Order Detail / support | Exclusive ORDER context for this Buyer + Seller + Market. |
| Existing Inbox | Load the existing thread; historical subject may be summarized but is not silently reused. |

ORDER is an independent structured context entered from Order detail, support or an approved context control. When ORDER is active, Scene/Product composer selections are inactive or explicitly cleared so no competing subject is sent. History renders bounded immutable snapshots; current actions resolve current domain state.

## 6. Buy from Chat: mandatory final purchase review

A Buy action from a conversation is a structured commerce action, not a natural-language transaction. Whether the preceding answer came from the Chatbot or a human Seller, pressing Buy must enter a canonical Checkout review flow. Payment cannot begin directly from a Message or from stale Chat context.

### Eligibility to show Buy

• Primary subject is a Product Post or the Buyer first chooses a Product Post from a Scene Post.

• Seller/Market/Product Post remain purchase-eligible.

• A concrete Variant can be selected where the Product has Variant dimensions.

• The ordinary Account is authenticated and authorized as Buyer for this purchase.

• The action is server-resolved; the client does not invent purchase eligibility.

### Final review rule

### The final summary is not copied from Chat. It is resolved from Catalogue, Inventory, Market, Fulfilment and

### Checkout/Payment policy at the moment of review. If price, Variant, availability, delivery charge, surcharge or

### another material condition changes before confirmation, payment must not begin until the Buyer reviews the new

### values.

### Checkout handoff

After explicit Buyer confirmation, the Checkout/Order domain creates the Seller-specific commercial snapshot, applies its short provider-attempt stock protection where required, and asks the Payment domain to create an idempotent provider attempt. Chapa is the initial named provider where Market-configured behind the normalized Payment adapter. Chat never sees provider secrets and never treats a browser redirect as proof of payment.

### Chat-to-Checkout attribution

Carry bounded attribution such as conversation_ref, source_message_ref, Product Post ref, optional Scene Post source ref/revision and Chat entry source. Attribution must never be required for transaction validity and must not include raw private Message text.

Buy requires a concrete Product. A SCENE_POST or NONE context first requires explicit Product choice; ORDER context uses normal Order actions and never starts a new purchase implicitly. Authentication is the ordinary Account acting as Buyer.

Chat displays the canonical server-calculated current launch-disabled zero Adulis Buyer Checkout surcharge and commercial-policy amount snapshot from Checkout/Finance; Chat performs no fee arithmetic. The final review includes Product, Variant/options, quantity, merchandise subtotal, delivery charge if applicable, surcharge, currency, payable total, Seller and Market.

![Immutable launch-zero money and provider permission](graphics/CHAT_03.svg)
*Figure 03. Immutable launch-zero money and provider permission. The inactive proposed future surcharge and provider-fee permission never activate by configuration alone.*

## 7. System timeline events - required extension

Commerce facts shown in a conversation must be represented as timeline events, not fake human/Bot Messages. This keeps Claims evidence, Chatbot classification, unread/response metrics and actor attribution semantically correct.

### Timeline event entity

```
chat.timeline_event
id
conversation_id
event_type
source_domain
source_event_id
domain_ref
occurred_at
visibility = BOTH | BUYER_ONLY | SELLER_SIDE_ONLY
presentation_key
presentation_version
created_at
```

```
UNIQUE(conversation_id, source_domain, source_event_id)
```

### Launch event catalogue

| Event | Source / meaning | Visibility |
| --- | --- | --- |
| ORDER_PAID | Order/Payment says provider-verified paid state exists | Both |
| ORDER_READY | Seller preparation completed | Both |
| COURIER_ASSIGNED | Fulfilment has accepted assignment | Both when Buyer visibility is allowed |
| PICKUP_HANDOFF_VERIFIED | Seller-to-Courier custody accepted | Both / policy |
| DELIVERY_HANDOFF_VERIFIED | Final Buyer/delegate Handoff accepted | Both |
| CLAIM_OPENED | Claims case created for related Order | Both where policy allows |
| CLAIM_RESOLVED | Claims decision/remedy state available | Both / policy |
| REFUND_STATUS_CHANGED | Finance/provider refund state changed | Affected participant(s) |
| CHECKOUT_REVIEW_CONFIRMED | Buyer confirmed Chat-origin Checkout review | Buyer-only unless product policy explicitly exposes it |

### Event rendering rules

• Timeline rows reference canonical domain objects; they do not copy mutable Order/Payment truth into Chat.

• Render current safe presentation from owning-domain read models where possible; preserve source event identity and occurred_at for evidence.

• A system event is excluded from Seller response-time and unanswered-message calculations.

• Bot classification never receives timeline events as user text.

• If an event requires attention, Notifications owns transport. The Chat timeline is durable context, not the transport source of truth.

• Outbox/event retries are idempotent; one domain event cannot create duplicate timeline rows.

### Never use SYSTEM as a human-like sender

Keep sender kinds for actual communicators such as BUYER, SELLER_OWNER, TEAM_MEMBER and BOT. A payment or Handoff fact has no human author and belongs in timeline_event.

Only owning-domain committed facts create timeline rows; source identity, visibility and idempotency remain mandatory. Pickup and Delivery Handoff are distinct events. System timeline display text never becomes Buyer language for Chatbot or a human Seller response metric.

Snapshot merchandise_minor, delivery_minor, provider_processing_fee_minor, adulis_surcharge_minor, total_minor, currency, exact rounding, fee basis/incidence and commercial/provider policy versions on the accepted quote, attempt and Seller Order. Launch adulis_surcharge_minor = 0. Provider fee is not platform revenue. A permission-unconfirmed component is not charged as zero or guessed: block that live route. Reconfirmation precedes a changed new quote; accepted history is immutable and no fee is collected twice.

Launch remedies are Seller-funded; Adulis provides no voluntary cash refund backstop. Record obligation amount/currency/components, Seller responsibility, Claim/decision/version, approved deadline and financial state REQUESTED, PENDING, COMPLETED, REFUSED or OVERDUE. A Seller promise, Operator command, screenshot or Review never proves reimbursement. Finance confirms completion from the approved provider path. Contract-required merchant debits/chargebacks remain honest liabilities; the business preference does not waive them. No other Seller entitlement is reassigned silently.

## 8. Chatbot, Quick Replies and language policy

WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

| Mode | Input / routing |
| --- | --- |
| Supported English automation | Free text/optional Quick Replies through the approved classifier/template cascade. |
| Unsupported language / offline or disabled automation | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |
| HUMAN_TAKEOVER_ACTIVE | Authorized Seller/team continues same conversation in any language. |
| Return to automation | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |

## 9. Seller team access, sender attribution and authorization

Each Seller Owner and Seller Team Member has an individual Adulis account. Shared Seller credentials are prohibited. Multiple Seller roles may be assigned to one team member according to Auth policy; effective permission is the union of permitted roles, while the Message always records the real actor.

### Seller-side authorization

```
authenticate account
-> resolve seller relationship
-> membership/standing active
-> read: seller.inbox:read; send/reply: seller.inbox:reply (exact operation)
-> surface allowed (MOBILE or CONSOLE)
-> conversation belongs to seller
-> subject/resource scope valid
-> ALLOW / DENY
```

### Sender attribution

| Sender | Stored identity | Buyer display |
| --- | --- | --- |
| Buyer | buyer_account_id | Buyer identity according to privacy policy |
| Seller Owner | actual owner account_id + seller_id | Seller business identity; optional staff label only if product policy chooses |
| Seller Team Member | actual team-member account_id + seller_id | Seller business identity; internal audit preserves employee actor |
| Bot | Bot provenance + BotTurn/template/version | Clearly automated Adulis/Seller assistant presentation; never disguised as human |

### Multiple devices

One account may be signed in on multiple authorized devices. Message identity remains account-based, not device-based. Device/session metadata is security/audit context and must not create duplicate messages. Idempotency-Key protects resend races across unreliable networks.

### Removed-team-member rule

Removing or suspending a team member immediately blocks new Seller-side Chat reads/writes on the next authorized request. Historical Messages remain attributed to the original actor and are not reassigned or erased.

One human uses one ordinary Adulis Account across Buyer capability, Seller ownership relationships, Seller-team participation and Courier profile/relationships. Different humans use different Accounts; Seller credentials are never shared. At most one non-terminal ACTIVE or SUSPENDED Seller-team membership consumes the MVP team slot. Multiple roles within that membership compose by current effective permission union. Ownership and Courier relationships are separate from the team slot.

Switching Buyer, Seller or Courier context changes presentation and scoped authority, never the human's identity. An unrelated Courier or Seller relationship cannot grant access to a Buyer Order, another Seller's records or privileged operations.

Seller reads/writes recheck Account standing, current ownership or active membership, effective role union, Seller context, permitted surface, Conversation Seller and subject scope on every request. Removed or suspended staff lose new access immediately; historical attribution never changes.

The two inbox capabilities are alternatives selected by the requested operation, not a required union. Generate shared permission types from AUTH §157; removed/suspended membership, wrong Seller/conversation, disallowed surface or missing exact capability fails closed. Step-up, where the owning action requires it, cannot supply a missing permission.

## 10. Read state, inbox, realtime and connected-only behavior

### Read model

Use a conversation read-state/high-water projection per participant side rather than rewriting every Message row. Read updates are monotonic and idempotent. Bot processing does not mark Buyer content as read by a human Seller.

```
chat.conversation_read_state
conversation_id
participant_side = BUYER | SELLER
last_read_message_id
last_read_at
version
```

### Seller team semantics

MVP uses shared Seller-side read state for the business thread; it does not require per-employee read receipts. Internal audit still identifies who actually sent each reply.

### Realtime strategy

• Buyer foreground refresh/polling uses bounded intervals and conditional requests.

• Seller Companion and Seller Console may poll while visible; hidden browser tabs pause aggressive polling.

• Stable REST APIs keep a future WebSocket/SSE upgrade possible without changing canonical Chat storage.

• No presence, typing indicators or per-user live cursor system is required for MVP.

### Connected-only rule

### The Chat composer may keep an unsent local draft for UX convenience. It must not create a durable

### disconnected mutation queue. Without Internet/server acknowledgement, a Message is NOT SENT.

• Optimistic UI uses PENDING only while an online request is outstanding.

• Server acknowledgement changes PENDING -> SENT.

• Network failure changes PENDING -> FAILED / Retry; no false sent state.

• A restart may preserve draft text according to privacy policy, but not pretend a server Message exists.

## 11. Commerce boundaries inside Chat

### Price and stock statements

A Seller or Bot may discuss price/stock using current canonical slots, but a historical Chat statement is not the final transaction price or inventory commitment. The Buy flow revalidates immediately before the Buyer confirms payment.

### Payment

• Chat cannot mark an Order paid.

• Seller cannot manually override provider payment truth through Chat.

• Chatbot cannot fabricate payment status.

• Provider secrets, webhook payloads and Buyer payment credentials never enter Chat.

• Payment-related timeline cards are derived from server-verified Payment/Order facts.

### Refunds and cancellations

A Seller message such as "I will refund you" can become Claim evidence, but it does not execute a refund. Structured actions route to Order/Claims/Finance commands with server-side authorization and current-state validation.

### Scene Post context

A Scene Post can be discussed as a whole, but Buy explicitly resolves a concrete Product Post through current tagged-product relationships and current Product/Variant truth. Chat never purchases a Scene Post as an independent commercial object.

Scene Post / ScenePost / SCENE_POST is the canonical Seller-authored image content object with caption, immutable revisions and same-Seller Product tags. Product Post is the structured commerce destination for exactly one Product. Scene context and historical provenance never establish current price, Variant availability, stock, Checkout totals or payment state.

Content owns publication_state DRAFT / PUBLISHED / ARCHIVED, independent visibility PUBLIC / PRIVATE and revision lifecycle. Initial public publication requires at least one valid same-Seller/same-Market Product tag and at least one currently eligible available tagged Product, ready images/caption and every Seller, Market and Moderation gate.

When the last eligible available tagged Product disappears, Content changes PUBLISHED + PUBLIC to PUBLISHED + PRIVATE with reason ALL_TAGGED_PRODUCTS_UNAVAILABLE. Temporary stock loss does not archive/delete the Scene. Restock triggers Content reevaluation and automatic PUBLIC restoration only if every current gate passes; no manual republish is needed solely for recovered stock. Independent archive, moderation, Seller/Market or Media blocks remain binding.

Buyer-facing current reads of PRIVATE Scenes fail closed across FYP, Search, Storefront, direct links and Collection resolution. Response-time canonical gates remain final while outbox, cache, CDN and projection consumers converge. Saved membership can remain as a safe unavailable reference without revealing old caption/media or a newer private revision.

## 12. Attachments, Moderation, Claims and evidence

### Attachments

Current native Adulis media is image-only. Chat attachments use the Media domain with private CHAT_ATTACHMENT purpose. No native video upload, transcoding or streaming pipeline is introduced by Chat. TikTok embeds belong to eligible Product Post detail, not Chat attachment transport.

• Upload through reviewed Media API; Chat stores attachment references only.

• Private attachment access is conversation-authorized; never expose a public R2/CDN URL as ordinary Chat evidence.

• Image processing uses current Media controls (R2, Sharp and restricted delivery).

• Attachment ownership and Message binding are immutable after send.

### Moderation

Message reports go through the canonical Moderation reporting system with target_kind MESSAGE. Reporting does not instantly delete evidence. Moderation presentation effects must preserve the underlying immutable record when Claims, legal/security holds or audit require it.

### Claims evidence

Claims may reference the smallest relevant set of Messages, context snapshots, attachments and system timeline events. Do not attach the entire long-term Buyer-Seller conversation by default.

| Evidence element | Preserved fact |
| --- | --- |
| Message | body/chip identity, sender, actual actor, server timestamp |
| Primary subject | Product Post / Scene Post / Order / none |
| Source context | Scene Post provenance when a Product was selected from it |
| Display snapshot | What the historical context card represented at send time |
| Attachment refs | Private evidence references under retention hold |
| Timeline event | Canonical source domain/event/ref and occurred_at |

### Retention and deletion

Chat retention follows Privacy/Claims policy, not an arbitrary Chat-only timer. Account deletion or Seller deletion removes ordinary access according to lifecycle policy but cannot destroy evidence under a valid Claim, Moderation, security or legal hold. After hold release, policy-driven purge/anonymization proceeds.

Operator Account is a separate internally provisioned privileged principal, with independent credentials, strong authentication, OPERATOR sessions, recovery, revocation and audit identity. Ordinary Account roles, phone OTP, public registration and Mode switching do not create Operator authority. The same person may possess both principals, but their authorization and identifiers remain distinct.

Privileged commands require the separate Operator Account, a current narrow capability, exact Market/resource/case scope, purpose/reason and audit, with fresh authentication and approval where existing Operator governance requires it. No generic superuser bypass, arbitrary state setter or impersonation path is introduced.

Restricted Claims, Moderation, abuse and Chatbot-quality evidence access is case/purpose bounded and identifies operator_account_id. Ordinary Seller permissions grant no internal evidence access. Historical snapshots/private attachment references may be held as evidence without granting current public Scene access.

CHAT_ATTACHMENT is a PRIVATE Media purpose bound to typed conversation_id, pending_message/send intent, eventual immutable message_id and sender ordinary_account_id. Chat verifies current participant/exact Seller-team permission on upload, completion, bind and every new read. Upload grants/object keys stay private; READY is technical only. One upload-completion/send identity attaches once; cross-conversation rebinding and public PRODUCT_GALLERY delivery are forbidden. Reuse bounded approved image processing/limits; abandoned grants expire under approved policy. No new numeric limits or native video.

Selected Claim/Moderation/legal/security attachment evidence uses existing exact hold/purge fences; ordinary message removal cannot erase held bytes. After release apply approved lifecycle and orphan reconciliation. Purpose-scoped bounded signed access never promises recall of previously downloaded bytes or already issued access grants. Public descriptors, notifications, Analytics/logs and unrelated exports exclude private attachment bytes and URLs.

## 13. Notifications and analytics

### Notification policy

The current Notifications architecture prioritizes Chatbot-escalation alerts to Seller accounts authorized to answer the conversation. Ordinary human-message push remains policy-controlled rather than assumed for every Message. The Inbox is authoritative. Push payloads never include the full private Buyer Message.

### Notification recipients

Recipient resolution uses Seller permissions and current account standing. Multiple devices for one account may each receive a Push delivery for one logical notification; that is device fan-out, not duplicate logical notification. Notification delivery never grants Chat authorization.

### Allowed analytics

• scene_context_selected / product_context_selected

• chat_started_from_product_post / chat_started_from_scene_post / chat_started_from_seller / chat_started_from_order

• message_sent_by_subject_type

• product_selected_from_scene_post

• chat_buy_started

• chat_checkout_review_confirmed

• chat_paid_order_attributed

• chatbot_resolved / escalated

• seller_response_time

• unanswered_conversation_count

• quick_reply_selected by chip_id/locale

• system_timeline_event_rendered/opened where useful

General Analytics must not copy raw private Message bodies. Use typed references, event IDs, subject type, Market, Seller and privacy-safe source metadata. Chatbot improvement datasets require dedicated PII-redaction and retention controls.

### Attribution

```
CHAT context / Message
-> Buy
-> Checkout review
-> Buyer confirm
-> PSP attempt
-> provider-verified paid Order
```

```
Analytics may preserve bounded Chat source references without affecting transaction validity.
```

Notifications resolve ordinary Accounts through exact current Seller relationships/permissions. One logical ordinary Account notice may fan out to multiple authorized devices; push never grants Conversation access. No standalone Creator recipient or attribution domain is introduced.

## 14. Canonical data model

| Entity | Purpose / critical constraints |
| --- | --- |
| chat.conversation | One Buyer + Seller + Market. No Product/Post/Order context columns. |
| chat.message | Immutable communication record; exactly one primary subject at most; actual actor attribution. |
| chat.message_context_snapshot | Lightweight historical display evidence; never current commerce authority. |
| chat.bot_turn | Automated resolution provenance: intent/template/model/prompt/version/slots; no hidden generated prose path. |
| chat.escalation | Persisted human-attention workflow; independent of BotTurn mutability. |
| chat.conversation_read_state | Monotonic Buyer/Seller high-water read projection. |
| chat.message_attachment | Private Media references bound to Message. |
| chat.timeline_event | Idempotent reference to canonical domain event; not a Message. |
| chat.message_report_ref | Link to canonical Moderation report when needed. |
| chat.claim_evidence_ref | Bounded Claim evidence references/holds. |

### Key constraints

• UNIQUE(seller_id, buyer_account_id, market_id) on Conversation.

• Message body/chip/attachment satisfies non-empty-content rule under locale capability.

• Subject type/reference consistency database/application enforced.

• Product Post and Scene Post must belong to Conversation Seller.

• Order subject must belong to Conversation Buyer + Seller + Market.

• Product source Scene Post relationship must be a valid current/historical tag relationship according to Content evidence rules.

• Sent Message body/context immutable.

• Timeline event uniqueness by source event prevents duplicate cards.

Prefer typed nullable Product, Scene, Order and source Scene/revision FKs with subject CHECK constraints and exact Seller/Buyer/Market validation. Bot provenance is distinct from ordinary human sender identity. Privileged evidence access logs use a separate Operator Account FK, never sender_account_id.

## 15. API contracts

### Conversation APIs

```
POST /v1/conversations                         create/get unique relationship thread
GET  /v1/conversations                         list in authorized ordinary context
GET  /v1/conversations/{ref}                    scoped summary
GET  /v1/conversations/{ref}/messages           cursor-paginated Messages + timeline
POST /v1/conversations/{ref}/messages           immutable send; Idempotency-Key
POST /v1/conversations/{ref}/read               monotonic high-water
POST /v1/conversations/{ref}/archive            presentation preference only
POST /v1/conversations/{ref}/mute               notification preference
```

### Immutable Message send example

```
{
  "text": "Do you have Medium?",
  "chipId": null,
  "subject": {"type": "PRODUCT_POST", "ref": "pp_..."},
  "sourceContext": {
    "type": "SCENE_POST", "ref": "scene_...", "revisionRef": "revision_..."
  },
  "attachmentRefs": []
}
```

Resolve text/chip combinations under locale and current human-takeover capability. Enforce one primary subject and exact source tag/revision provenance. Context selectors consume bounded cursor-paginated Catalogue/Content/Order reads for Seller Scenes, full Seller Products, Products tagged in the selected Scene and this Buyer Orders with Seller. No new Chat-owned catalogue is created.

Buy uses the canonical Checkout preview/prepare, final review, explicit confirm and revalidation service. Chat never creates a provider attempt independently. REST/OpenAPI and generated clients use current Scene fields consistently.

| Error | Meaning |
| --- | --- |
| CONVERSATION_NOT_FOUND / CONVERSATION_ACCESS_DENIED | Safe participant denial without resource enumeration. |
| MESSAGE_EMPTY / TEXT_INPUT_UNSUPPORTED_FOR_LOCALE | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |
| MESSAGE_CONTEXT_CONFLICT | Competing primary subjects or illegal context combination. |
| MESSAGE_PRODUCT_POST_INVALID / MESSAGE_SCENE_POST_INVALID | Missing, inaccessible or wrong-Seller/Market current subject. |
| MESSAGE_PRODUCT_NOT_IN_SCENE_POST | Product is not in the referenced Scene revision/tag relationship. |
| MESSAGE_ORDER_INVALID | Order not owned by this Buyer + Seller + Market. |
| CHECKOUT_REVIEW_CHANGED / BUY_NOT_AVAILABLE | Material changes require reconfirmation; no eligible purchase. |
| IDEMPOTENCY_KEY_REUSED | Same key with a different Message request. |

## 16. Technology stack and module placement

### Backend and data

| Area | Current technology / Chat use |
| --- | --- |
| Runtime | Node.js + NestJS + Fastify + strict TypeScript |
| ORM / database | Drizzle ORM + PostgreSQL; database constraints for uniqueness, immutability and tenant scope |
| PostgreSQL extensions | pg_stat_statements for query visibility; shared approved extensions remain available where platform requires them |
| Cache / async | Valkey + BullMQ; never canonical Message/Timeline truth |
| API | REST + OpenAPI + @nestjs/swagger + generated TypeScript client |
| Security | @nestjs/throttler, @fastify/helmet, opaque sessions/approved audiences, RLS where useful as defense in depth |
| Media | Cloudflare R2 + Sharp through Media domain for private image attachments |
| Payment integration | Normalized Payment provider adapter; Chapa where Market-configured; Chat only calls Checkout/Payment public services |
| Mobile | React Native + Expo + Expo Router + TanStack Query + FlashList + Expo Image + SecureStore + Notifications |
| Browser Seller Console | Current Seller Console stack; authenticated private origin; polling while visible |
| Testing | Jest + Testcontainers + Maestro + Playwright + k6 |
| Observability | Sentry + Pino structured logs + pg_stat_statements |
| Architecture control | dependency-cruiser |
| Delivery | Docker + GitHub Actions + Render + Cloudflare + EAS |

### No Chat microservice at MVP

Keep Chat inside the Adulis platform modular monolith. Its transactional joins, Auth checks, Claims references and operational scale do not justify network-distributed service boundaries at launch. Public module interfaces and dependency-cruiser rules preserve extraction options later.

### Recommended module structure

```
chat/
conversations/
messages/
subject-resolver/
sender-attribution/
idempotency/
context-selectors/
checkout-entry/
timeline-events/
read-state/
escalation/
attachments/
moderation/
claims/
reads/
analytics/
```

```
chatbot/ separate automated resolver
nlu/ separate redacted language resources
```

## 17. Security, privacy and failure behavior

### Threat controls

| Threat | Required control |
| --- | --- |
| Cross-Seller subject injection | Resolve subject server-side; Seller ownership + Market checks; 404/not-visible semantics. |
| Buyer reads another conversation | Participant authorization + scoped query + RLS where appropriate. |
| Removed Seller staff keeps access | Membership standing and permission rechecked every request. |
| Shared Seller login hides actor | Shared credentials prohibited; each member has own account; actual actor recorded. |
| Message replay / duplicate send | Required Idempotency-Key + unique request identity. |
| Context tampering after send | No mutation endpoint + database/application immutability guard. |
| Fake payment through Chat | Only Payment/Order provider-verified state produces paid timeline fact. |
| Stale Buy data | Checkout preview + confirmation-boundary revalidation; changed data requires reconfirmation. |
| Push disclosure | No full private Message body in push; authorization rechecked on open. |
| Attachment IDOR | Private Media ownership/conversation scope + signed short-lived access where used. |
| Log leakage | Never log raw Message body, OTP, provider secrets, private attachment URLs. |

### Failure behavior

| Failure | Canonical behavior |
| --- | --- |
| PostgreSQL unavailable | Message send fails; never show SENT. |
| Valkey/BullMQ unavailable | Persisted Messages/timeline state remain; async bot/notification/event work pauses and reconciles. |
| Chatbot unavailable/capped | Buyer Message remains; approved flow escalates or supports human takeover where policy allows; human Chat remains. |
| Notification provider unavailable | Chat continues; Inbox is authoritative. |
| Media unavailable | Text/chip Chat continues; image attachment action unavailable. |
| Product/Post becomes unavailable | Historical context remains; new commerce action resolves current unavailable state. |
| Payment provider unavailable | Chat continues; Buy/Checkout shows provider-unavailable state and does not fabricate success. |
| No Internet | Draft may remain local; send/Buy/system-event refresh requires connection. |

## 18. Performance, observability and operating metrics

### Separate latency domains

• Message accepted latency: authenticate -> validate -> insert -> commit.

• Chatbot resolution latency: post-commit automated resolution.

• Timeline event lag: source-domain outbox -> Chat timeline projection.

• Conversation list p95/p99 and message-page p95/p99.

• Checkout preview latency from Chat entry; Payment provider latency belongs to Payment telemetry.

### Operational alerts

• Message-send failure spike

• Conversation uniqueness violation

• Cross-tenant authorization denial spike

• Seller inbox query latency / DB CPU regression

• Escalation age growing

• Duplicate Bot or timeline events

• Claim references missing Message/context

• Attachment access failures

• Checkout review confirmation mismatch spike

• Valkey/BullMQ backlog or dead-letter growth

### Zero-tolerance integrity alerts

• Two Conversations for one Buyer/Seller/Market

• Conversation row contains Product/Post/Order subject state

• Sent Message body/context changes

• Timeline event is inserted as a human/Bot Message

• Bot free-form model prose reaches Buyer where deterministic policy forbids it

• Chat marks payment successful

• Unsupported non-English automated free text accepted outside authorized human takeover WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

• Buy payment begins without final Buyer confirmation

• Provider success is inferred from client redirect

## 19. Required testing matrix

| Test group | Mandatory cases |
| --- | --- |
| Conversation | same Buyer/Seller/Market reuse; Market separation; concurrent create converges; no conversation commerce subject. |
| Context | Product Post; Scene Post; Order; Seller-General; cross-Seller rejection; Product not tagged in source Post rejection; context mutation blocked. |
| Entry points | Seller Profile, Product Post, Scene Post, tagged Product, Order, Inbox initialize correct composer state without rewriting history. |
| Language | WAITING_FOR_HUMAN: original any-language free text accepted privately; optional localized chips; no English-only NLU route or immediate-response promise. |
| Buy | final selection shows exact Variant attributes/price; material change before confirm requires new review; no payment before confirm; provider failure never yields paid timeline event. |
| System events | duplicate outbox event -> one timeline row; wrong visibility blocked; event excluded from response metrics; canonical domain state re-resolved. |
| Seller team | actual actor attribution; removed member blocked; multi-role member with send permission works; shared credentials not assumed. |
| Idempotency | lost response + retry creates one Message; changed request under same key rejected. |
| Read state | monotonic mark-read; bot does not mark human read; Seller-side shared read projection. |
| Claims / moderation | bounded evidence snapshot; hidden text still held when Claim requires it; report does not erase evidence. |
| Connected-only | no network -> no SENT state; retry after reconnection is explicit; no durable disconnected mutation queue. |
| Load | conversation list, message pagination, send, Seller Console polling, context selector, timeline event fan-in, checkout preview entry. |

### End-to-end critical path

```
Product Post / Scene Post
-> Chat
-> one Buyer-Seller-Market Conversation
-> Message with immutable Product Post subject
-> Seller or Bot answers
-> Buyer taps Buy
-> selects exact Variant
-> Checkout preview + final summary
-> Buyer confirms
-> PSP attempt
-> server verifies paid state
-> ORDER_PAID timeline event
-> fulfilment / Handoff
-> Claims/Review/Trust consume canonical evidence
```

### Current canonical regression cases

• 01. Existing Buyer-Seller-Market thread reused from Seller Profile.

• 02. Product entry opens same Conversation with Product context.

• 03. Scene entry opens same Conversation with Scene context.

• 04. Scene + Product -> Product primary + Scene provenance.

• 05. Scene selected -> Product selector only shows tagged Products.

• 06. No Scene -> Product selector shows full Seller catalogue.

• 07. Neither -> Seller General.

• 08. Product cannot be attached as provenance to unrelated Scene.

• 09. Cross-Seller Product/Scene subject rejected.

• 10. PRIVATE Scene cannot be newly selected by Buyer.

• 11. Historical Message referencing now-PRIVATE Scene remains understandable without exposing private current revision.

• 12. Scene restocks/becomes PUBLIC -> current opening works again.

• 13. Buy from Scene requires concrete Product.

• 14. Buy flow displays current zero launch surcharge from Checkout, not Chat calculation.

• 15. Material Checkout change requires reconfirmation.

• 16. Browser/payment return cannot create ORDER_PAID.

• 17. Seller team member removed -> new reads/writes blocked.

• 18. Same ordinary Account may also be Courier/Buyer elsewhere without duplicating identity.

• 19. Operator ordinary Account session cannot gain privileged Chat evidence access.

• 20. Separate authorized Operator Account can access only approved evidence scope.

• 21. Duplicate outbox event -> one timeline row.

• 22. Valkey outage does not erase Chat Messages.

## 20. Production launch gates

• Conversation uniqueness and tenant isolation are database/application enforced.

• Conversation has no Product Post, Scene Post or Order subject columns.

• Message context supports NONE / PRODUCT_POST / SCENE_POST / ORDER and immutable Scene provenance.

• All subject IDs are server-validated against Seller/Buyer/Market ownership.

• Actual Seller team actor is preserved; shared Seller credentials are not supported.

• English automated text/chips and unsupported-locale automated chips pass; authorized active human-takeover multilingual text passes without unsupported NLU.

• Chatbot outage does not block human Chat.

• System timeline events are separate from Messages, idempotent and visibility-scoped.

• Buy from Chat always renders a final canonical purchase summary before payment.

• Material Checkout changes force reconfirmation; payment cannot begin on stale review.

• Provider-verified payment is the only source of paid timeline truth.

• Valkey loss does not lose persisted Messages, timeline events or due work reconstruction.

• No connected-only Chat flow reports success without server acknowledgement.

• Claims can preserve selected Messages/context/attachments/timeline facts without exposing full history.

• Push notifications contain no full private Message and do not grant authorization.

• Raw Message text is absent from general logs and Analytics.

• Private image attachment access passes IDOR tests.

• Load/SLO, security-negative, Testcontainers, Maestro, Playwright and k6 suites pass.

Scene/Product selectors, exact revision provenance, new PRIVATE-context rejection, safe historical PRIVATE context, restock opening, ordinary multi-relationship identity and separate Operator evidence boundaries pass the current regression cases. The displayed zero launch surcharge comes from Checkout/Finance.

## 21. Recommended implementation sequence

| Phase | Work / exit condition |
| --- | --- |
| 0 - Canonical alignment | Product Post/Scene Post identifiers, ordinary Account + separate Operator write-back, language policy, Checkout boundary. Exit: no conflicting terminology. |
| 1 - Integrity | Conversation unique key, Message immutability, sender attribution, subject constraints. Exit: thread/message identity correct. |
| 2 - Human Chat | Create/get, list, send, pagination, idempotency, Buyer/Seller authorization. Exit: reliable human communication. |
| 3 - Context UX | Scene + Product selectors, independent ORDER entry, Product/Scene/Order cards, source provenance. Exit: every new Message can preserve explicit subject. |
| 4 - Language + Quick Replies | English automation/chips; optional localized chips; any-language human text persists in WAITING_FOR_HUMAN and bypasses unsupported NLU. Exit: routing and authorization are server-enforced. |
| 5 - Chatbot / escalation | Structured context into Bot, deterministic responses, Bot provenance, escalation. Exit: automation cannot corrupt human Chat. |
| 6 - Buy from Chat | Variant selector, Checkout preview, final summary, confirm/revalidate/payment handoff. Exit: no payment from stale Chat data. |
| 7 - System events | Outbox consumers, timeline event, safe visibility/presentation. Exit: commerce facts appear without fake Messages. |
| 8 - Read/inbox/notifications | read high-water, Seller burden metrics, escalation notification, device fan-out. Exit: authorized Seller responders can manage attention. |
| 9 - Claims/moderation/media | private images, reports, evidence refs, retention holds. Exit: evidence-safe operations. |
| 10 - Hardening | security tests, load, privacy, observability, runbooks, launch gate. |

## 22. Core system invariants

• CHAT-INV-01 One Buyer + Seller + Market has at most one Conversation.

• CHAT-INV-02 Conversation has no current Product/Scene/Order subject.

• CHAT-INV-03 Composer selection is temporary; sent Message context is immutable.

• CHAT-INV-04 Message has at most one primary subject.

• CHAT-INV-05 Product/Scene subjects belong to Conversation Seller.

• CHAT-INV-06 Order belongs to Conversation Buyer + Seller + Market.

• CHAT-INV-07 Product-from-Scene provenance requires valid relationship.

• CHAT-INV-08 Scene provenance is not second commerce authority.

• CHAT-INV-09 Sent body/context/sender immutable.

• CHAT-INV-10 Later Product/Scene lifecycle does not rewrite historical meaning.

• CHAT-INV-11 Seller replies preserve actual ordinary Account actor.

• CHAT-INV-12 Shared Seller credentials are forbidden.

• CHAT-INV-13 One ordinary Account may hold multiple ordinary Adulis relationships.

• CHAT-INV-14 Separate Operator Account is required for privileged internal access.

• CHAT-INV-15 System facts use timeline_event, not fake Messages.

• CHAT-INV-16 Chat text never establishes commerce truth.

• CHAT-INV-17 Buy requires final canonical Checkout review.

• CHAT-INV-18 Material changes require reconfirmation.

• CHAT-INV-19 Provider/backend verification establishes paid state.

• CHAT-INV-20 Human Chat does not depend on Chatbot.

• CHAT-INV-21 No Message is SENT without server acknowledgement.

• CHAT-INV-22 PostgreSQL is canonical.

• CHAT-INV-23 Raw Message body stays out of ordinary logs/Analytics.

• CHAT-INV-24 Claims use bounded evidence.

• CHAT-INV-25 Notification delivery does not authorize Chat.

• CHAT-INV-26 Scene PRIVATE/PUBLIC state is Content-owned.

• CHAT-INV-27 Unsupported non-English text is accepted for WAITING_FOR_HUMAN; optional chips support automation and no unsupported text enters English NLU. WAITING_FOR_HUMAN accepts and preserves original free text in ANY language when the Seller is offline or automation is unsupported, disabled, unavailable, out of budget or exhausted. Existing sender/conversation/rate/content authorization still applies. Unsupported text bypasses English-only NLU and is never falsely translated/classified as a confirmed intent; optional localized Quick Replies remain assistance. Show unavailable/waiting status with no immediate-response promise. Authorized human takeover continues the same private conversation; this adds neither multilingual NLU nor generative advice.

• CHAT-INV-28 Timeline events reference owning-domain truth and cannot mutate it.

• CHAT-INV-29 Chat displays the server-calculated surcharge snapshot and performs no fee calculation.

• CHAT-INV-30 New Buyer Scene selection requires current public accessibility; historical context cannot leak a private current revision.

## 23. Required cross-system write-backs

Dependent interfaces must remain aligned with this current complete baseline.

| System | Current write-back contract |
| --- | --- |
| Auth | One ordinary Account; one non-terminal team slot; role union; separate privileged Operator Account/session/evidence capabilities. |
| Mobile / Seller Console / Companion | Scene + Product selectors; independent ORDER context; same thread reuse; safe historical unavailable context; current language/human-takeover capability. |
| Content / Catalogue | Current public Scene reads; exact tagged Product/revision validation; Content-owned PUBLIC/PRIVATE; current Product truth. |
| Chatbot / NLU | Immutable triggering subject/provenance; deterministic answers; locale enforcement; human Chat independent of automation. |
| Checkout / Finance | Canonical preview, explicit final confirmation, material reconfirmation; current zero at launch server surcharge; PSP/backend verified timeline facts. |
| Notifications | Current ordinary recipients/role scope; one logical notice/device fan-out; push carries no full private Message. |
| Claims / Moderation | Small selected Message/snapshot/attachment/timeline evidence; separate Operator access. |
| Analytics | Current Scene event/type names; bounded references and revision attribution; no raw Message body. |

DOCUMENT-CORRECTED describes this specification only. Engineering with synthetic data/sandbox can proceed. Live payments remain disabled for unconfirmed merchant/fee/finality/refund-funding permissions; actual real-data launch requires applicable Privacy/legal/processor/region/retention/security sign-offs. Social capability activation requires actual platform approvals. Missing severity/maturity/calibration stays pending; selected technical/product choices are not reopened. No migrations, deployed controls, external tests or provider/regulator approvals are claimed by this document.

## 24. Final system architecture

Buyer/Seller clients invoke relationship-scoped Chat APIs. PostgreSQL persists the unique Conversation, immutable Messages/context, actual ordinary sender, read state and idempotent source timeline rows. Automation, Seller attention and commerce actions remain separate consequences.

![Private any-language waiting support with bounded attachments](graphics/CHAT_04.svg)
*Figure 04. Private any-language waiting support with bounded attachments. Money is never established by Chat; original text and private evidence remain purpose-bound.*

### Final engineering doctrine

Chat communicates. Content owns Scene lifecycle and provenance; Catalogue/Inventory own Product truth; Checkout validates the concrete purchase and fee snapshot; Finance verifies provider payment; Handoff verifies receipt. Safe history preserves meaning without granting access to a current PRIVATE Scene. Human Chat remains usable through automation failure.

## 25. Glossary

Definitions used in this current complete edition.

| Term | Current meaning |
| --- | --- |
| Ordinary Account | One human identity across Buyer/Seller/Courier relationships; roles/context remain resource scoped. |
| Operator Account | Separate privileged internal principal, credentials, OPERATOR session and typed audit. |
| Scene Post | Canonical captioned image content with exact same-Seller Product/revision relationships. |
| PUBLIC / PRIVATE | Content visibility independent of publication and Moderation; stock-private can restore after all gates pass. |
| Product Post | Structured commerce destination for exactly one Product; current Catalogue/Inventory truth. |
| Market activation | Approved runtime commerce scope; Ethiopia first, globally extensible future routes. |
| PSP | Payment service provider; authenticated backend/provider facts establish money state. |
| Launch surcharge / 0 bps | Current explicit Buyer Checkout surcharge; exact server policy snapshot. |
| Outbox / job_intent | PostgreSQL records atomically preserve facts or direct/deadline async intent. |
| BullMQ / Valkey | Sole ordinary job engine and its execution/cache datastore; non-canonical. |
| Conversation | Unique Buyer ordinary Account + Seller business + Market; relationship-only. |
| Message subject | NONE / PRODUCT_POST / SCENE_POST / ORDER; at most one immutable primary. |
| Scene provenance | Exact source Scene/revision/tag relationship; not a second commerce authority. |
| Timeline event | Idempotent source-domain fact displayed separately from human/Bot Messages. |
| High-water read state | Monotonic Buyer-side and shared Seller-side read position. |
| Human takeover | Authorized active human exchange; unsupported-language NLU stays off. |

## 26. Post-October-13 reconciliation — current authority

Authority and precedence. This section is the current authority for the post-13 October topics listed below. If an older passage in this document conflicts with a rule here, this section wins. For domains not listed here, the unchanged 13 October body remains authoritative. Prototype code is UX/reference evidence only and cannot override payment, authorization, privacy, financial, Handoff, Trust or other domain contracts.

### Changes applied in this revision

| Change | 13 October baseline / reason for amendment | Current reconciled rule | Evidence / date |
| --- | --- | --- | --- |
| R-01 — Buyer-facing Product / Scene terminology | The 13 October designs use Product Post and Scene Post as canonical domain names. | Buyer-facing copy uses “Product” and “Scene”. Internal schemas, identifiers, events and system-design prose may retain Product Post / Scene Post when naming canonical backend entities, but every user-facing surface must distinguish the visible label from the internal canonical name. Search, Collections, reports and chat context must use Product / Scene visibly. | PR-001 / PR-005, 26-27 Oct 2026 |
| R-07 — Final Product engagement model | Product Post remains the canonical structured commerce object. | Buyer-facing Product actions are Save, Share, Reviews, Ask Seller, Order and More/Report. Product has no Like, public comments or repost. Save is Product-only. Ask Seller opens the ongoing Buyer-Seller conversation with Product context. Order enters Cart/Checkout; opening a Product or using Buy Again never creates an Order or payment automatically. | PR-005, 27 Oct 2026 |
| R-09 — Seller profile and Storefront information architecture | The 13 October designs define Seller profile/Storefront content but not the final shared tab order. | Buyer Seller profile and standalone public Storefront share Scenes / Products / Reviews / About and open on Scenes. Scenes show the Seller’s Buyer-public eligible Scenes. Products show the catalogue with available first. Reviews is Seller Service; Product Quality remains on Product. About includes description, Trust facts, category, neighborhood/operating area, fulfilment, member since and social accounts. Collection point appears only where Buyer Collection is offered. Header actions are Follow and Message; the public Storefront hands these actions into the app. Trust is information, not a button. | PR-002, 26 Oct 2026 |

### Implementation guardrails

• Do not infer additional domain authority from prototype-only presentation data or demo fixtures.

• Do not hand-write duplicate API DTOs where generated contract types are missing; correct the authoritative contract/client seam instead.

• Do not treat Theme Lab candidate palettes, machine-translated Amharic, or Seller Stories persistence/events as production-closed unless a later approved design explicitly closes them.

• Do not regress the October 13 payment truth, zero launch Adulis surcharge, one ordinary Account model, connected Handoff evidence, Trust ownership, Claims evidence or Seller/Operator permission boundaries.
