# SC-FE-07 / 08 / 09 -- what was built, provisional decisions, and open gaps (Batch 02C)

Console session, 26 November 2026. ASCII only. PROPOSALS and GAPS, not product rules and not a signed approval. Nothing here is written into
`contracts/openapi.json`. Fixture-backed throughout (GOV-06); nothing exists in a release build.

## 0. Source caveat

The 24 November decision register (`DECISION_REGISTER_2026-11-24.md`) and the per-design 24 November amendments are NOT in this repository. They are
only cited from `CLAUDE.md`, `docs/amendments/*`, `docs/rebuild/*` and `.claude/reference/*`. Everything below about Option A / Option C, deferred claims
and chat is read from those citing documents and from the 8 November designs. A founder check against the register itself is still needed.

## 1. SC-FE-07 internal Order experience simulation

Built: `/internal/order-simulation`, reachable only from a fixture build (entry link on the fixture sign-in helper), outside every Seller and every navigation.
Needs action, Preparing, Ready; a role view; a stale-write conflict; loading, empty and failed screens. All data is `fx_sim_ord_*`, in memory, on the page.

NOT built, deliberately: payment, handover, delivery, tracking, refund, settlement, stock hold or deduction, Courier assignment, any Reservation, any
money amount, any state beyond Ready, any link from the simulation to a real Seller, Product or stock fact, any Home figure or notification.

| ID | Proposal | Why |
|---|---|---|
| P-55 | The simulation's copy lives in `src/fixtures/simulation/copy.ts`, English only, not in the shared catalogue. | The shared catalogue ships in release and its hygiene test bans the words an Order screen needs. The release scan proves the module is absent. |
| P-56 | Only the three preparation states are drawn. | ORDER-01 makes every fulfilment state follow a payment, and payment authority is undecided (D24-01). The design gives no payment-free path. |
| P-57 | Simulated actions change in-memory page state only; no fixture-world write exists. | GOV-06 S2 licenses no write by default. |
| P-58 | Roles: Owner, Admin and Inventory prepare; Sales Support reads only; Analyst sees nothing (AUTH-02 Order codes). | The Console `Capability` union has no Order code, and the SC-FE-00 matrix has no Orders row, so the simulation carries its own role table. |

Open: the register text for Option C; a from-to transition table; the demo-entry mechanism and who may open it; whether any money amount may appear; the
wording of the "simulated" label; notifications and Chat or Claim regions of an Order (they depend on deferred work).

Release exclusion evidence: `pnpm verify:release` gained three markers (module marker, title, route path) with positive control; `e2e/release` asserts the URL is not-found.

## 2. SC-FE-08 Inbox and scripted assistance

Built: Inbox list and thread at `/s/:sellerId/inbox` and `/inbox/:conversationId`; per-message Scene and Product provenance; a human reply composer (Scene first,
then a Product narrowed by that Scene, "Show all my Products" clears the Scene); automated entries labelled automated and provisional; WAITING_FOR_HUMAN; an
uncertain-send state with a retry that makes one message; permissions per AUTH-02 (Owner, Admin, Sales Support); isolation by Seller.

NOT built, deliberately: model-generated reply text, an intent classifier, "AI write reply", automatic learning, any stored reply-text or entitlement boolean, Order
context and Order timeline events, typing or presence, per-employee read receipts, a retention figure, the Seller review controls of the Companion, the
scripted-assistance settings (`/inbox/automation` is an honest "arrives later").

| ID | Proposal | Why |
|---|---|---|
| P-59 | A human reply is a NAMED fixture write touching only the Inbox module's own thread list. | The work order needs the PENDING, SENT and FAILED behaviour; GOV-06 S2 says a write needs a named work order and its own test. This is that statement. |
| P-60 | The list shows buyer label, a server-chosen preview, last sender and time, an unread count and the waiting state; newest first; cursor pages of 4 (demonstration). | The designs specify no list columns, ordering, filters or search. |
| P-61 | Opening a thread calls `inbox.read.mark`, one shared Seller-side mark, monotonic. | CHAT S10. A failed mark leaves the thread unread, which is true. |
| P-62 | The bodies of automated entries are fixed provisional strings with the template label "Provisional demonstration template". | RB25-D09 and the founder review: no dialogue is approved. They name no price, stock, warranty, fit, authenticity or delivery. |
| P-63 | Home treats the Inbox as a built area. | The destination now exists. |
| P-64 | A reply's context errors are `MESSAGE_BODY_REQUIRED`, `MESSAGE_PRODUCT_NOT_IN_SCENE`, `CONTEXT_SCENE_NOT_AVAILABLE`, `CONTEXT_PRODUCT_NOT_AVAILABLE`. | CHAT S15 names the first two; the rest cover the same rule for a Scene or Product that is no longer eligible. |

Open: the Nov 24 chat amendment; which scripted intents, templates and knowledge fields are approved; the route conflict (CONSOLE-02 S76 `automation/chatbot` versus
SC-FE-00 `inbox/automation`); list columns, filters, search and unread format; chat retention (PRV-01: legal review); whether an Order-context message may appear; the
Amharic dialogue.

## 3. SC-FE-09 Trust and Reviews, read only

Built: `/s/:sellerId/trust` with the level (server-authoritative, with when it was last evaluated and a statement that no transaction evidence is connected),
Product reviews and service reviews kept apart with separate counts and star distributions, and a non-interactive "Reporting and appeals arrive later" section.

NOT built, deliberately: a score, progress, threshold or requirement count; anything derived from Orders or Handoffs; a combined or average rating; a Seller reply;
any hide, delay, remove, report or appeal control; a purchase proof, transaction reference or evidence badge; removed or restricted reviews; Buyer review submission;
Claims and disputes.

| ID | Proposal | Why |
|---|---|---|
| P-65 | One page at `/trust` (not `/insights/reviews`). | SC-FE-00 maps Trust and Reviews there; CONSOLE-02 S92 says `/insights/reviews`. SC-FE-00 is the in-repo route map. |
| P-66 | Capabilities `trust.read` (Owner, Admin, Sales Support, Inventory) and `reviews.read` (Owner, Admin, Sales Support); each section is shown only to a role that holds it. | AUTH-02. This CHANGED the earlier fixture table, which gave Trust to Owner and Admin only. |
| P-67 | Contract operation names avoid the fixture fail-closed words: `standing.get`, `reviews.summary.get`, `reviews.list`. | The block-list refuses any operation name containing trust, report, claim, moderation or evidence; it guards writes and these are reads. |
| P-68 | Only REBUILDING carries a one-line explanation. | TRUST-01 S10 says it is never shown as New. No other level has governed wording. |
| P-69 | Review summaries are the "server's" per-dimension counts and star distributions; the Console never averages. | REV-01 S30. |
| P-70 | A suspended Seller keeps only Home and Settings in the fixture, so its Trust page is not reachable. Not changed. | MOD-01 S29 says a Safety Suspension keeps historical access; whether Trust and Reviews count is not stated. Reported, not decided. |

Open: the numeric thresholds and badge names (pending the Nov 24 text); whether time on the ladder may be shown; review sort, filter and page size; the label for
failure-basis feedback; whether a removed review appears to the Seller and in what words; the Seller's interim path to report a review; the Seller-facing wording of a
Trust requirement without Orders; whether an Analyst's review-quality aggregates belong to SC-FE-09 or SC-FE-10.

## 4. Verification posture

Implemented: yes, for all three. Fixture-verified: by unit tests (`src/fixtures/simulation/model.test.ts`, `inbox.test.ts`, `trust.test.ts`) and browser specs
(`e2e/fixture/simulation.spec.ts`, `inbox.spec.ts`, `trust.spec.ts`) in CI. Integrated: no (draft PRs, not merged). Commercial definitions pending: yes (Trust
thresholds, dialogue, Order amounts). Backend pending: yes (no Seller backend exists). Release accepted: no.
