# ADU-DB-01 — Adulis Database and Data Model Specification

**Version:** 1.6 · **Baseline date:** 24 August 2026
**Owner:** Founder / CEO (back-end)
**Status:** Binding data model. Drawn from ADU-PRD-01 v8.5, ADU-ARCH-01 v2.0 and ADU-XREF-01 v1.6.
**Supersedes:** ADU-DB-01 v1.5
**Related:** ADU-PRD-01 v8.5 · ADU-PROJ-01 v9.0 · ADU-00 v9.0 · ADU-WEB-01 v1.0

> Where this document and ADU-PRD-01 disagree on **product behaviour**, the PRD governs. Where they disagree on **how a behaviour is enforced**, this document governs — that is what it is for. The eight exceptions are in §1, and each carries a ruling that ADU-PRD-01 must adopt at its next revision.

> Where a rule is marked **INVARIANT**, it is enforced by a constraint, a trigger, a grant, or a function in the database. An invariant enforced only by NestJS service code is not enforced. This is the whole doctrine of the document.

---

## 0. What this document is

ADU-PRD-01 states roughly ninety invariants and says they must hold "in a database constraint or a server-side check, never by UI alone." This document is the discharge of that instruction: it names every table, every constraint, and — for the constraints that are not obvious — the exact mechanism.

It is written for two readers who are not the same person:

- **An AI coding agent** generating migrations and NestJS entities. It needs table names, column types, enum values and constraint definitions it can transcribe without inventing anything. Appendix A and Appendix B exist for it.
- **The COO/CTO supervising that agent.** He needs to be able to look at a generated migration and tell whether it matches this document, without holding the PRD in his head. Appendix C exists for him.

Everything undecided is flagged, never invented. Where ADU-PRD-01 §25 leaves a question open, the schema is built so that either answer can be taken later without a migration through live data.

**Reading order:** ADU-00 → ADU-PROJ-01 → ADU-PRD-01 → ADU-DB-01 → ADU-API-01.

**Scope:** V1 as defined in ADU-PRD-01 §2, plus the ledger required by §22 and the analytics schema required by §20. Out of scope: V3 discovery, advertising, Crowd Commerce, Group Buying, delivery, custody balances.

**Count:** 105 tables across nine schemas. The manifest is Appendix B, and a migration that produces a different number is wrong in a way worth investigating before it is reviewed line by line.

---

## 0.1 What changed in v1.6

v1.6 carries ADU-ARCH-01 **v2.0**: Telegram is removed from the architecture, and the Adulis mobile app gains a **Seller Companion mode**. Native push replaces the bot.

| Area | v1.5 | v1.6 |
|---|---|---|
| **Telegram** | `core.telegram_binding`, `notification_channel = TELEGRAM`, per-market channel config | **Removed entirely.** Seller push uses `core.device`, which already carries a push token, platform and permission state |
| **Permissions** | `role_permission` grants a capability to a role | **`core.permission` added.** Surface is a property of the permission, so `seller.payout:update` has no mobile grant and no endpoint could accept one | 
| **Session audiences** | `BUYER_APP` · `SELLER_WEB` · `COURIER_WEB` | **`MOBILE` · `SELLER_WEB` · `COURIER_WEB`.** One mobile session serves both modes, because one account holds both roles |
| **Actor channel** | `WEB` · `TELEGRAM` · `APP` · `SYSTEM` | **`WEB` · `MOBILE` · `SYSTEM`** |

**Counts:** 105 tables (one removed, one added), **54** enum types, append-only **21**. All unchanged in total.

**Why `core.device` needed no seller equivalent.** It already holds `push_token`, `platform`, `notification_permission` and a nullable `account_id` — and under ADU-ARCH-01 §2 the seller and the buyer are the same account. A seller's device is a device. **No new table, no binding flow, no second push registry.**

**The shorter seller session lifetime is preserved by a different mechanism.** §6.4's reasoning was that *a seller losing a session loses payout control*. Payout control is not reachable from mobile at all (§6.9), so a mobile session carries the buyer lifetime and the shorter lifetime attaches to `SELLER_WEB`, where the dangerous capabilities live.

**Everything not listed above is carried forward from v1.5 unaltered.**

---

## 0.2 What changed in v1.5 — retained for history

v1.5 carries the seller-surface architecture change (ADU-ARCH-01) and the rulings recorded in ADU-XREF-01 v1.5. **The seller has no native app.** The console is a PWA; notifications and quick actions run through a Telegram bot; the iOS and Android apps are buyer-only.

| Area | v1.4 | v1.5 | Section |
|---|---|---|---|
| **Session audiences** | `BUYER_APP` · `SELLER_APP` · `COURIER_APP` · `WEB_PURCHASE` | **`BUYER_APP` · `SELLER_WEB` · `COURIER_WEB`.** Purchase is part of the console, so its audience has nothing left to do | §6.6 |
| **Telegram** | Absent | **`core.telegram_binding`**, `notification_channel` gains `TELEGRAM`, and every state-changing write records `actor_channel` | §6.10, §20 |
| **Availability** | `seller_active_hours_version`, effective-range versioned, 8-hour minimum | **`core.seller_availability`** — plain, one-hour minimum, split shifts, **zero windows valid** | §13.1 |
| **Payment window** | Signed timestamp and a 48-hour clock | **Two clocks.** 1-hour SLA for the claim right; 24-hour confirmation window; one 12-hour retry; second rejection ends the order | §12.4 |
| **Transition set** | 18 order rows, 24 total | **17 and 23.** Row 6 struck — a submitted payment never expires. **R-2 closes** | §12.2.1 |
| **Seller closure** | Deletion blocked with no way to stop new obligations | **`seller_status` gains `CLOSING`** | §18.6 |
| **Claims** | Binary outcome | **`state`, `severity`, `remedy`.** `BANK_RECORD` evidence, `CLAIM_UPHELD` review badge | §16 |
| **Verification** | ID verification optional | Staged by configuration — `id_verification_requirement` gains **`MANDATORY_ALL`** | §5.3 |
| **Missing functions** | Named in ADU-API-01, defined nowhere | **`financial.read_payment_evidence` and `verification.write_attestation` defined** | §7.3, §13.3 |

**Counts:** 104 → **105** tables, 51 → **54** enum types, append-only **21** unchanged. Appendix C check 7 drops to **≥ 8** — availability stops being versioned.

**Everything not listed above is carried forward from v1.4 unaltered.**

---

## 0.3 What changed in v1.4 — retained for history

v1.4 adopts the two tables ADU-API-01 v1.1 requires, and takes one substantive decision on the handoff clock.

| Area | v1.3 | v1.4 | Section |
|---|---|---|---|
| **Idempotency** | Absent | **`core.idempotency_record`** — a retry on a lost response no longer creates a second order | §12.8 |
| **Rate limiting** | Named in §23 of the PRD, unimplemented | **`core.rate_limit_bucket`**, keyed by account, device, phone hash or IP hash | §12.9 |
| **Handoff clock (A5)** | The device-signed timestamp governed both order completion and level advancement | **Split.** The signed timestamp governs completion; **server `received_at` governs level advancement** | §14.2 |
| **Honest clock skew** | Recorded as a signal | **Corrected.** `corrected_at` derived from the client's reported bootstrap offset, floored at `issued_at` | §14.2 |

**Counts:** 102 → **104** tables, 49 → **51** enum types. Schemas stay at nine, roles at six, append-only at **21** — neither new table records what happened, and marking an expiring cache append-only would corrupt the figure Appendix C check 5 compares against.

**On the handoff clock, and a correction to how ADU-API-01 v1.0 and v1.1 sized this.** Both said a colluding buyer with a manipulated device clock can manufacture verified handoffs. True, and overstated: **a seller with colluding buyers can already manufacture verified handoffs by scanning promptly, with correct clocks, entirely inside the window.** Backdating adds no capability — it adds *convenience*, letting an attacker farm at leisure and recover orders they let expire. The primary defence was always §5.2's distinct-buyer, velocity and graph controls, and it still is.

What v1.4 removes is the convenience, at a cost worth naming: a genuinely offline handoff that reaches the server beyond the window plus its grace period completes the order but does not advance the ladder. That is the treatment §11.4 already gives a `LATE` scan, so no new outcome is introduced — only a different test for which scans receive it.

**Everything not listed above is carried forward from v1.3 unaltered.**

---

## 0.4 What changed in v1.3 — retained for history

v1.3 revisits **one** decision: P3. v1.2 protected the seller's bank account with a third isolated schema. Review found that the same value is already inside the payment-evidence boundary — ADU-PRD-01 §10.3 justifies that boundary on the grounds that *a payment screenshot carries both parties' bank details* — so v1.2 was running two protection regimes over one secret. That is a direct breach of ADU-PROJ-01 doctrine 7, fewest moving parts, introduced while explicitly noting the overhead was real for a three-founder team.

**The two boundaries are merged into one, renamed `financial`.** Nothing else in the document changes.

| Area | v1.2 | v1.3 |
|---|---|---|
| Schemas holding a bank account number | `payment_evidence` **and** `payout_secret` | **`financial`**, one schema |
| Owning roles | `adulis_evidence`, `adulis_payout` | **`adulis_financial`** |
| Access logs answering *"who saw a bank account number?"* | Two, in schemas owned by different roles | **One `SELECT`** |
| Schemas · roles · tables | 10 · 7 · 103 | **9 · 6 · 102** |
| Enum types | 48 | **49** — `financial.secret_subject_kind` |

**Two corrections carried in this revision.**

**A benefit I overstated in v1.2.** I claimed moving the ciphertext out of `core` prevents a second unlogged `SECURITY DEFINER` function being added quietly. It does not: creating one requires owning the table, which is a reviewed migration in either schema. The real gain is narrower — a new function in a three-table schema is conspicuous where one among `core`'s forty is not. That is review ergonomics, and it survives the merge intact.

**An arithmetic error carried since v1.1.** Appendix B has stated "16 append-only tables" through two revisions. The manifest actually marks **22** in v1.2, and **21** in v1.3 once the disclosure log merges into the shared access log. Appendix C check 5 compares that figure against the trigger and `REVOKE` counts, so a wrong number there disarms the check that verifies every append-only table is actually append-only. Corrected.

**One thing worth stating plainly, because v1.2 assumed it without arguing it.** ADU-PROJ-01 §7.3 names three categories requiring specific handling — identity verification, payment screenshots, buyer conversation records. **Payout details are not among them.** Encryption is retained here as a deliberate choice, not an inherited assumption: the number is shown to every buyer who orders, so confidentiality against buyers is impossible by construction, and every control that defeats the §10.4 write attack sits on the write path and works whether or not the value is encrypted. What encryption buys is one thing — a dump or restored backup does not yield every seller's bank account in the clear. For a company whose positioning is trust, that is worth the column type. §13.6 records the reasoning so it is not re-litigated.

**Everything not listed above is carried forward from v1.2 unaltered.** C1–C8 stand as recorded in §1; P1, P2 and P4 stand as amended in v1.2; the 24-row transition set of §12.2.1 remains open and fail-closed.

---

## 0.5 What changed in v1.2 — retained for history

v1.2 closes the four residuals identified in the v1.1 review. Three were accepted as designed and hardened; one — the payout ciphertext — was accepted with the structural fix it needed. **No ruling changed.** C1–C8 stand exactly as recorded in §1.

| # | Residual | Resolution | Section |
|---|---|---|---|
| **P1** | The transition set governs legality but nobody had ratified its contents, and `order_state_transition_legal` had no stated grant | **Fail-closed from day one, provisional until ratified.** The guard denies any transition absent from the table; rows carry `ratified_at`; a market cannot go live while any row is unratified. Table writable only by `adulis_migrate`. **The 24-row set is presented for review in §12.2.1** | §12.2 |
| **P2** | The ladder-entry trigger left two semantics implicit | **Stated.** No backfill; `since` never resets on re-satisfaction | §8.1 |
| **P3** | The ciphertext sat in `core`, so the one-read-path guarantee held by grant rather than by structure | New `payout_secret` schema owned by `adulis_payout`. **Superseded in v1.3** — merged into `financial` | §3, §13.6 |
| **P4** | `reservation_id` assignment was specified; its integrity was not | **Two constraints added** — the line must belong to the order, and one open claim per scope. The evidence-append reading is recorded | §16 |

**One correction to v1.1, and it is mine.** The v1.1 review asserted that no transition leaves a terminal state. §11.4 requires exactly one: an in-window scan that syncs after the server has already expired an order must still complete it. `EXPIRED_UNCLAIMED` is therefore not terminal, and the transition is row 11 of the ratification set. Recorded as **R-1** in §12.3.

**Counts changed:** 101 → **103** tables, nine → **ten** schemas, six → **seven** roles, 12 → **14** review checks. Append-only tables remain **16**.

**Everything not listed above is carried forward from v1.1 unaltered.**

---

## 0.6 What changed in v1.1 — retained for history

v1.1 records the eight rulings taken on 24 August 2026 and adds the material that could not be written until they were settled. **No mechanism changed.** Every constraint in v1.0 survives unaltered; what changed is that eight of them are now binding rather than provisional, and four gaps that the open questions were hiding are now specified.

| Area | v1.0 | v1.1 | Section |
|---|---|---|---|
| **C1–C8** | Eight contradictions with defaults applied pending a ruling | **All eight ruled. Recorded as binding.** §1 restructured from questions into decisions | §1 |
| **Order and reservation state machines** | Named as two machines (C2) but transitions unspecified | **Legal transitions specified as a data-driven table with a guard trigger** | §12.2 |
| **Payment disclosure log** | `core.payout_disclosure_log` referenced by the C3 mechanism, never defined | **Table specified** | §13.6 |
| **Cart and device lifecycle** | `device_id` named as the anonymous cart key (C6), lifecycle undefined | **Device registration, cart binding at identity creation, and purge specified** | §11 |
| **Claim line scope** | `reservation_id` nullable (C8), nothing said which paths set it | **Set by the §9.4 partial-fulfilment trigger; null for order-level triggers** | §16 |
| **Payment rejection path** | Not addressed | **Specified.** `PAYMENT_SUBMITTED → NOTIFIED` on seller rejection — see the write-back in §29 | §12.2 |
| **Level creation at eligibility** | C5 ruled `New` on eligibility; nothing created the row | **Trigger on eligibility satisfaction inserts `seller_level_state`** | §8.1 |
| **Enum catalogue** | Enums defined inline, scattered | **Consolidated. 48 types in one place** | Appendix A |
| **Table manifest** | Absent | **101 tables listed by schema with append-only flags** | Appendix B |
| **Migration review checklist** | Absent | **Twelve grep-able checks a non-expert can run against generated DDL** | Appendix C |
| **Rulings section** | "Rulings required before build" | **"Corrections required in other documents"** — the schema is unblocked; six write-backs remain | §29 |

**Everything not listed above is carried forward from v1.0 unaltered.**

---

## 1. The eight contradictions, and how they are resolved

Eight items in the document set could not be transcribed into a schema as written. All eight were ruled on **24 August 2026** and the rulings below are binding on this document and on ADU-API-01.

**Each ruling carries a write-back.** A ruling recorded only here leaves ADU-PRD-01 saying something that cannot be built, and the next engineer — or the next agent — reads the PRD first. The consolidated write-back list is §29.

### C1 — Price sits on the product in §7 and on the line in §8.4 · **RULED**

ADU-PRD-01 §7: *"Products carry seller, name, description, price…"* while `ProductVariant` carries only attribute set, stock count and last-confirmed timestamp. §8.4 then captures *"the unit price in effect at the moment the order is created"* onto the **reservation**, which is one variant line.

If price is genuinely product-level, a seller cannot charge more for XL than for S, or for the 128GB model than the 64GB — in fashion, cosmetics and electronics, the three launch categories. Retrofitting per-variant price later is a migration through live orders and captured prices.

> **Ruling.** Price lives on `core.product_variant`. `product.base_price_minor` exists and seeds new variants but is never the price of anything. A seller who does not differentiate never sees a second field: their variants all carry the base price.

### C2 — One state machine in §9.1, two in §8.1 · **RULED**

§9.1 draws a single lifecycle including `PAYMENT_CONFIRMED` and `REFUNDED`. §8.1 says the timer, the QR code, the payment, the scan and the review attach to the **Order**, while cancellation and refund attach to the **Reservation**. Both cannot be one machine: `PAYMENT_CONFIRMED` is meaningless per line, and `REFUNDED` is meaningless for an order that was half fulfilled.

> **Ruling.** Two machines. `order.state` carries the lifecycle and the order-level terminal outcomes; `reservation.state` carries the per-line outcome. Order-level terminal states are **derived** from the line states by a trigger, never written independently. `REFUNDED` exists only at reservation level.

Transitions are specified in §12.2, which is new in v1.1 and is the part of the schema most likely to be got wrong by generated code.

### C3 — Payout details are "never redisplayed to anyone", but the buyer must be shown them · **RULED**

§10.4: *"payout details are masked everywhere after entry… The full number is written once and never redisplayed to anyone."* §10.1 step 2: *"the bot provides the seller's bank details."* §8.5: *"The payment instructions shown to a buyer are read from the order."*

A buyer cannot make a bank transfer to `****4471`. Taken literally, the invariant makes the product's only payment mechanism impossible.

> **Ruling.** The masking invariant is scoped to seller-facing, team, support and admin surfaces. The full value is stored encrypted with exactly one decryption path: rendering payment instructions for a specific order, to the buyer who holds that order, while that order is in a payable state. Every decryption writes a disclosure-log row in the same transaction.

Mechanically identical to the payment-evidence boundary in §10.3, and since v1.3 **housed in it**: the ciphertext lives in the `financial` schema alongside the payment screenshots that already carry the same value, behind the same role, the same two-function pattern and the same access log. Specified in §13.6.

**This is the write-back that matters most.** As ADU-PRD-01 §10.4 stands, an engineer building from the PRD alone builds something that cannot take a payment.

### C4 — Deferred follow is removed in §17.1.1 and still required in §24 · **RULED**

§17.1.1: *"The deferred-follow token from v8.3 is removed."* §24 test coverage still lists: *"Deferred follow: an anonymous web follow intent is claimed on first app open without a second prompt."*

> **Ruling.** §17.1.1 governs. No `deferred_follow` table, no claim token, no `follow_intent` row. The §24 test line is struck. `follow_intent_web` survives as an event only (§20), which is what §17.1.1 asks to be measured.

### C5 — The trust ladder's "New" level has two different entry conditions · **RULED**

ADU-00 and ADU-PROJ-01 §3.3 say **New** is earned by *"ID verified."* ADU-PRD-01 §5.1 says *"Eligibility satisfied."* In Phase 1 almost no seller is ID-verified — it is the paid blue tick (§13.1) — so under the ADU-00 wording an entire Phase 1 cohort holds no level, and the ladder accumulates nothing before the day it starts mattering (§2: *"levels must accumulate from the first handoff"*).

> **Ruling.** ADU-PRD-01 §5.1 governs. `New` is entered when eligibility is satisfied by either path. ADU-00's ladder table and ADU-PROJ-01 §3.3 are corrected to match.

Consequence now specified in §8.1: a trigger on eligibility satisfaction inserts the `seller_level_state` row. In v1.0 the ruling existed with nothing to create the row.

### C6 — The cart is server-enforced, but the buyer has no identity yet · **RULED**

§8.1 makes the one-seller cart rule an INVARIANT, which under the PRD's own preamble must be a constraint or a server-side check. But §6.1 creates identity *"at the moment of first reserve"* — so when the second seller's item is added there is frequently no account to hang a cart row on.

> **Ruling.** `core.cart` is keyed by `device_id`, an app-generated anonymous identifier registered server-side on first launch, with `buyer_account_id` nullable and bound at identity creation. The one-seller rule is then a composite foreign key that holds for anonymous and identified carts alike.

The rejected alternative — a client-held cart — makes the invariant unenforceable, and §8.2 already requires a server round trip on every cart view for live availability. Lifecycle specified in §11.

### C7 — Nothing says where waitlist data lives · **RULED**

ADU-WEB-01 §7.3 collects name, phone, handle, city and product category, retains it 12 months, and requires the DPIA to cover it **before the first submission**. ADU-PROJ-01 §11 runs Phase 0b in parallel with Phase 0 — before product infrastructure is provisioned, and before §10's hosting-region question is answered.

> **Ruling.** The waitlist is its own store, in its own schema, with its own credentials. The product database is not a dependency of the public website. An import path exists for cohort onboarding and is specified in §25.

### C8 — Claim scope is order-level in §14 and line-level in §9.4 · **RULED**

§14's triggers are order-shaped. §9.4 produces a line-shaped one: *"Where the seller's stated reason is unavailable stock and the stock record was not current, the buyer may raise a claim."*

> **Ruling.** `core.claim` attaches to the order, with a nullable `reservation_id` naming the line where the dispute is line-specific. Evidence assembly and the demotion rule operate on the claim regardless of scope.

Which paths set `reservation_id` is specified in §16 — the §9.4 partial-fulfilment trigger sets it; every order-level trigger leaves it null. **v1.2 adds the two constraints that make the assignment enforceable rather than merely documented**: the named line must belong to the named order, and only one claim may be open per scope.

**One further gap, carried from v1.0:** §16.8 opens a claim *"automatically on the buyer's behalf"* and §9.2's fulfilment window *"raises a claim trigger"* with no actor. `claim.opened_by_kind` therefore admits `SYSTEM` alongside `BUYER` and `MODERATION`. A model with a mandatory claimant account cannot represent either case.

---

## 2. Design doctrine

Ten rules. Everything below follows from them.

1. **A rule the database can hold, the database holds.** The binding engineering constraint is one beginner developer supervising AI agents (ADU-PROJ-01 §8.3). Generated application code is plausible far more often than it is correct, and the failure mode is silent. A `CHECK` is neither.
2. **Prefer a constraint to a trigger, a trigger to a function, a function to a service.** In that order, always, and drop down a level only when the level above cannot express the rule.
3. **Money is `bigint` minor units plus a currency code.** Never floating point, never a bare number. Every monetary column travels with its currency.
4. **Every timestamp is `timestamptz`, stored UTC** (§23). No column stores local time. Display timezone is per-market configuration.
5. **Append-only means the grant says so.** `REVOKE UPDATE, DELETE` from the application role, plus a trigger that raises. Two mechanisms because the first is invisible in a migration diff and the second is invisible in a permissions audit.
6. **Configuration is versioned rows with effective ranges, never constants and never a settings singleton.** §19 lists eight dimensions that are per-market; a new market is *"created by creating configuration and a locale pack, not by changing code."*
7. **Isolated boundaries are separate schemas with separate roles, and their only read path is a `SECURITY DEFINER` function that writes the access log in the same transaction.** You cannot read the evidence without logging the read, because there is no other way to read it (§10.3, §23).
8. **Derived state is derived.** Trust level, publication readiness, stock confidence, entitlement limits and order-level terminal state are computed from their evidence, not stored as an independently writable column that can drift from it.
9. **Nothing is hard-deleted that another party has an interest in.** Reviews anonymise; ID hashes survive account deletion; moderation and audit records are permanent (§16.9).
10. **The schema is neutral on every open PRD item.** Where ADU-PRD-01 §25 has not decided, the column exists, is nullable or configuration-backed, and either answer lands without a migration.

**An eleventh, added in v1.1 and directed at the agent rather than the database:** *where a rule is expressed by the absence of a column, that absence is load-bearing.* Eleven invariants in this document are enforced by there being nowhere to write the wrong thing — no `original_key`, no `generated_text`, no `has_chatbot`, no score column on the feed. An agent "completing" the schema by adding one of them silently removes the guarantee. Appendix C is how that gets caught.

---

## 3. Physical layout

Nine schemas in one Postgres cluster. The separation is not cosmetic: **two** of them carry different grants, and those two are the ones holding data whose unlogged disclosure would be a reportable event under Proclamation 1321/2024 rather than an internal defect.

| Schema | Contents | App role access |
|---|---|---|
| `core` | Markets, configuration, accounts, sessions, sellers, catalogue, orders, trust, reviews, claims, follows, moderation | Full DML |
| `verification` | Government-ID attestations and their access log | **None.** Function calls only |
| `financial` | Payment screenshots, payout ciphertext, and the one access log covering both (§13.3, §13.6) | **None.** Function calls only |
| `chat` | Operational conversation record — buyer, seller, message bodies | Full DML |
| `nlu` | Identity-stripped phrase library, intents, embeddings, regression set | Read + insert. **No foreign key to `chat` or `core` exists** |
| `billing` | Subscriptions, price schedules, collection records, inference metering | Full DML |
| `ledger` | Append-only double-entry record (§22) | Insert only |
| `analytics` | Versioned event stream, monthly partitions | Insert + read |
| `jobs` | graphile-worker | Managed by the library |

**INVARIANT — `nlu` holds no foreign key, and no column, referencing a buyer, a seller, a conversation or an order.** §15.3 requires two separated stores. Separation enforced by a structural absence is checkable in five seconds by reading the DDL; separation enforced by convention is checkable by nobody.

**Database roles.**

| Role | Purpose |
|---|---|
| `adulis_app` | The NestJS connection. No access to `verification`, `financial`; no `UPDATE`/`DELETE` on append-only tables |
| `adulis_verification` | Owner of `verification`. Used by nothing at runtime; the app calls `SECURITY DEFINER` functions owned by it |
| `adulis_financial` | Same, for `financial` — payment evidence and payout ciphertext |
| `adulis_jobs` | graphile-worker connection |
| `adulis_migrate` | DDL only. Not used at runtime |
| `adulis_readonly` | Analyst and paid-reviewer access. `SELECT` on `core`, `analytics`; nothing else |

### 3.1 Required extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- HMAC for the keyed ID hash, gen_random_uuid
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE constraints mixing = and &&
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- seller lookup and storefront search (§7.5, §7.6)
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector, cascade layer 3 (§15.1)
```

⚠ **This constrains the open hosting decision.** ADU-PROJ-01 §10 records hosting region as undecided. Whatever is chosen must offer `pgvector` and `btree_gist`, or two specified mechanisms — the cascade's layer 3 and the duplicate-reservation invariant — have no implementation. Local colocation on self-managed Postgres satisfies both trivially; some managed providers do not offer `vector`. **Add this to the criteria before the decision is taken, not after.**

No JSON Schema extension is assumed. Event payload validation (§22) is done in `plpgsql` against a stored key list, precisely so that the hosting decision stays open.

---

## 4. Global conventions

| Concern | Convention |
|---|---|
| **Primary keys** | `uuid`, UUIDv7, generated application-side. Time-ordered, so index locality is preserved without leaking a sequence |
| **Naming** | `snake_case`; tables singular (`product`, not `products`); FK columns `<referenced_table>_id` |
| **Timestamps** | `created_at timestamptz NOT NULL DEFAULT now()` on every table; `updated_at` only where rows are mutable |
| **Money** | `<name>_minor bigint` + `<name>_currency char(3)`. Always a pair, always `CHECK (>= 0)` unless the column is a ledger amount |
| **Enums** | Postgres `ENUM` types for closed sets that change with a migration; lookup tables for sets that change with configuration. Full catalogue in Appendix A |
| **Soft state** | No `is_deleted` booleans. A row is live, superseded (with an effective range), or in a named terminal state |
| **Text search** | `pg_trgm` GIN indexes on `product.name`, `seller.store_name`, `seller.handle` |
| **Market scoping** | Every table that can differ by market carries `market_id`, not just those that obviously do today |

**Shared domains.**

```sql
CREATE DOMAIN core.currency_code AS char(3)
  CHECK (VALUE ~ '^[A-Z]{3}$');

CREATE DOMAIN core.e164 AS text
  CHECK (VALUE ~ '^\+[1-9][0-9]{7,14}$');

CREATE DOMAIN core.locale_code AS text
  CHECK (VALUE IN ('en', 'am'));   -- extended per market by migration, never by data
```

**The append-only mechanism**, applied to every table marked *append-only* in Appendix B:

```sql
CREATE FUNCTION core.fn_forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Table %.% is append-only; % is not permitted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END $$;

-- per table:
CREATE TRIGGER trg_append_only
  BEFORE UPDATE OR DELETE ON core.stock_event
  FOR EACH ROW EXECUTE FUNCTION core.fn_forbid_mutation();

REVOKE UPDATE, DELETE ON core.stock_event FROM adulis_app;
```

**The effective-range mechanism**, applied to every versioned configuration table:

```sql
-- Pattern. Reproduced on each *_config table with its own scope columns.
effective  tstzrange NOT NULL DEFAULT tstzrange(now(), NULL, '[)'),
EXCLUDE USING gist (market_id WITH =, effective WITH &&)
```

Two versions of the same configuration can never be in force at the same moment, and history is retained rather than overwritten. Reading "the configuration in force at time T" is `WHERE effective @> T` — which is also how a payment SLA is computed against the active hours in force when the screenshot arrived (§10.2).

---

## 5. Markets and configuration

### 5.1 `core.market`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE | `ET`, `KE`, … |
| `display_name` | text | |
| `phase` | `market_phase` | `PHASE_1`, `PHASE_2` |
| `display_currency` | currency_code | |
| `display_timezone` | text | IANA name |
| `default_locale` | locale_code | |
| `is_live` | boolean | |

**INVARIANT — phase is a column on the market, never a global flag** (§19). A mature home market may be Phase 2 while a new market opens Phase 1.

**INVARIANT — `market.phase` cannot be set to `PHASE_2` unless the three gate conditions in `core.market_phase_gate` are all satisfied.** Enforced by a `BEFORE UPDATE` trigger reading that table. ADU-PROJ-01 §11 phase 5 makes those conditions build dependencies, not policy preferences; a trigger is the difference between a dependency and a hope.

### 5.2 `core.market_phase_gate`

One row per market. `v3_discovery_live boolean`, `kyc_vendor_integrated boolean`, `ladder_operating boolean`, `dpia_revisited_at timestamptz`, each with `attested_by` and `attested_at`. Set by admin action, logged.

### 5.3 Configuration tables

All versioned by the effective-range pattern in §4, all scoped by `market_id`.

| Table | Carries | PRD |
|---|---|---|
| `core.eligibility_config` | `audience_required bool`, `follower_threshold int NULL`, `counting_platforms platform[]`, `threshold_basis`, `permitted_seller_types`, `id_verification_requirement` | §4.1 |
| `core.ladder_config` | Established/Trusted thresholds, `new_level_product_cap`, `new_level_transaction_cap_minor`, demotion rules, distinct-buyer window and count | §5.1, §5.2 |
| `core.timing_config` | `reservation_window` (48h), `fulfilment_window`, `offline_sync_horizon` (7d), `payout_activation_delay` (24h), `recovery_cooling_period` (7d), `deleted_number_cooling_period`, `refund_ack_window`, `buyer_session_lifetime`, `seller_session_lifetime`, `media_retention`, `level_credit_grace` (24h), cancellation-penalty ladder | §25 open items |
| `billing.price_schedule` | Tier prices, `usd_reference`, prepay discounts, `derived_at`, effective range | §16.6 |
| `core.locale_pack` | Available locales, formats | §19 |
| `core.identity_config` | KYC vendor reference, accepted document types, verification hours | §13.1 |
| `core.legal_config` | Terms version, retention periods, prohibited categories, invoice format | §19 |

**INVARIANT — `eligibility_config.follower_threshold` is nullable and null means no threshold** (§4.1). Not zero, which would read as "a threshold of zero exists". Not a magic sentinel. Setting a number later is an `INSERT` of a new effective row and touches no code.

**Every one of ADU-PRD-01 §25's twelve "can ship at a default" items is a column in `core.timing_config`.** They ship at the PRD's stated defaults and are tuned by inserting a new configuration version. None of them blocks the build, which is the point of putting them here.

---

## 6. Identity, accounts and access

### 6.1 `core.account`

The authentication entity. **One phone number, one account** (§6.1).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `phone_e164` | e164 UNIQUE | The authentication factor (§6.2) |
| `market_id` | uuid FK | |
| `person_id` | uuid FK NULL | Set when an identity attestation exists |
| `status` | `account_status` | |
| `created_at`, `scrubbed_at` | timestamptz | |

**Roles are relationships, not accounts** (§6.3). `buyer_profile`, `seller`, `seller_team_member` and `seller_courier` all reference `account`. One person holding all four roles on one number is the ordinary case and requires no special handling — it is what the model already says.

### 6.2 `core.person`

The natural person, distinct from the account, because §4.4 requires the keyed ID hash stored **once per person and referenced by each seller account**, and §16.9 requires it to **survive deletion**. A person-scoped row is what survives when every account of theirs is scrubbed.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `id_hash` | bytea UNIQUE NULL | HMAC-SHA256 of the ID number, key in a managed store, rotatable (§13.1) |
| `id_hash_key_version` | int | Rotation without losing cross-account detection |

**INVARIANT — `person` is never deleted.** No `DELETE` grant. Duplicate-identity detection across accounts (§4.4, §13.2) is `SELECT ... WHERE id_hash = $1`, and it must still work after the seller closed the account.

A keyed hash rather than a per-record salt, exactly as §13.1 states: the purpose is detecting the same ID across accounts, and a per-record salt makes that impossible.

### 6.3 `core.buyer_profile`

One per account, created at first reserve (§6.1). Reservation history, confirmation rate, cancellation history, claims filed and claims upheld are **derived views**, not stored counters — except the cancellation cooldown state in §12.7, which needs a decaying window.

### 6.4 `core.device`

Anonymous, app-generated, registered on first launch. Required by C6 for the pre-identity cart, and by §17.3 for the notification-permission fallback.

| Column | Notes |
|---|---|
| `id` uuid PK | Generated by the app, registered on first launch |
| `platform` | `ANDROID`, `IOS` |
| `push_token text NULL` | |
| `notification_permission` | `GRANTED`, `DENIED`, `NOT_ASKED` (§17.3) |
| `account_id uuid NULL` | Bound at identity creation, never before |
| `first_seen_at`, `last_seen_at` | |

**A device row carries no personal data.** It holds a push token and a permission state, both of which are properties of an app installation rather than a person. That is what makes it safe as the anonymous cart key, and it is why the purge in §11 is unremarkable rather than a data-protection event.

### 6.5 `core.otp_challenge`

| Column | Notes |
|---|---|
| `purpose` | `SIGN_IN`, `STEP_UP`, `ACCOUNT_DELETION`, `RECOVERY` |
| `phone_e164`, `code_hash`, `attempt_count`, `expires_at`, `consumed_at` | |
| `step_up_action` | NULL, or which §6.5 action this authorises |

**INVARIANT — no session may be created from an OTP challenge whose purpose is `ACCOUNT_DELETION`.** §3.0 and ADU-WEB-01 §6.2: the deletion OTP *"issues no session, grants access to no other surface."*

```sql
CREATE FUNCTION core.fn_session_otp_purpose() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE p core.otp_purpose;
BEGIN
  IF NEW.created_from_otp_id IS NULL THEN RETURN NEW; END IF;
  SELECT purpose INTO p FROM core.otp_challenge WHERE id = NEW.created_from_otp_id;
  IF p <> 'SIGN_IN' THEN
    RAISE EXCEPTION 'OTP purpose % cannot issue a session', p
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
```

### 6.6 `core.session`

`account_id`, `audience` (`MOBILE`, `SELLER_WEB`, `COURIER_WEB`), `device_id`, `first_seen_at`, `last_activity_at`, `approx_location text NULL`, `expires_at`, `revoked_at`, `revoked_by_session_id`, `created_from_otp_id`.

**INVARIANT — session lifetime is per-market configuration, and a `SELLER_WEB` session is shorter than a `MOBILE` one** (§6.4). `expires_at` is set from `core.timing_config` at creation; a `CHECK` enforces the ordering so a configuration edit cannot invert it.

**§6.4's reasoning survives the architecture change intact.** It held that *a buyer losing a session loses convenience; a seller losing one loses payout control.* Under ADU-ARCH-01 v2.0 one mobile session serves both modes — but **payout control is not reachable from mobile at all** (§6.9a), so the short lifetime attaches to the surface where the dangerous capabilities live rather than to the person holding it.

**INVARIANT — revocation takes effect server-side immediately, not at next token refresh** (§6.4). **This becomes load-bearing rather than merely correct under ADU-ARCH-01**: the seller console is a browser surface holding payout access, where a stolen session token is a realistic outcome and a stateless token outliving its row would be unrecoverable. Consequence: **the session row is read on every authenticated request.** No stateless JWT whose validity outlives its row. This is a real cost — one indexed primary-key lookup per request — and it is the price of the invariant. It is affordable because Postgres is the sole datastore and this is its cheapest possible query.

**INVARIANT — a new-device sign-in on a seller, team member or courier account notifies the registered number and is not suppressible** (§6.4). A trigger on `session` insert enqueues the notification when no prior session exists for that `(account_id, device_id)`. Enqueued by the database, so it cannot be forgotten by a service path.

### 6.7 `core.step_up_challenge`

`account_id`, `action`, `target_ref uuid`, `otp_challenge_id`, `satisfied_at`, `expires_at`.

**INVARIANT — the six §6.5 actions require a fresh challenge regardless of an active session, enforced server-side including on direct API calls.** Every mutation implementing one of those actions takes a `step_up_challenge_id` argument and the writing function verifies `satisfied_at` is within the freshness window. Not middleware — a parameter, so a code path that omits it does not compile.

Viewing payment evidence is deliberately **not** in this set (§6.5). The PRD's reasoning is worth preserving in a comment on the enum: a challenge on routine work trains people to approve challenges without reading them.

### 6.8 `core.account_recovery_case`

`account_id`, `requested_at`, `reason`, `operator_account_id`, `evidence_relied_on jsonb`, `decision`, `decided_at`, `payout_locked_until`.

**INVARIANT — the reviewing operator's decision, the evidence relied on, and the reason are logged** (§6.6). Append-only.

**INVARIANT — payout details cannot be changed for the cooling period after any recovery** (§6.6, §10.4). `payout_locked_until` is written by the same statement that approves the recovery. One transaction, two effects — the attack in §6.6 is "recover the account, then immediately change the bank details", and the two writes must not be separable.

### 6.9 Team members and couriers

**`core.seller_team_member`** — `seller_id`, `account_id`, `role`, `invited_by`, `suspended_at`, `revoked_at`. Unique on `(seller_id, account_id)` where not revoked.

**INVARIANT — exactly one `OWNER` per seller.** Partial unique index. §16.9 gives the Owner a power no Admin has; a seller with two Owners or none makes that rule unresolvable.

**INVARIANT — RBAC is enforced server-side on every endpoint, never by hiding UI** (§16.2). `core.fn_has_permission(account_id, seller_id, permission)` is the first statement of every seller-scoped writing function. Permissions live in `core.role_permission` so the matrix is data a reviewer can read in one query.

**`core.seller_courier`** — `seller_id`, `account_id`, `invited_at`, `revoked_at`.
**`core.order_courier_assignment`** — `order_id`, `courier_account_id`, `assigned_at`, `ended_at`.

**INVARIANT — a courier account can read only the orders currently assigned to it, and assignment ending ends access to that order's buyer information** (§6.3). Enforced by row-level security:

```sql
CREATE POLICY courier_assigned_orders ON core."order"
  FOR SELECT TO adulis_app
  USING (
    current_setting('adulis.actor_role', true) <> 'COURIER'
    OR EXISTS (
      SELECT 1 FROM core.order_courier_assignment a
      WHERE a.order_id = "order".id
        AND a.courier_account_id = current_setting('adulis.account_id', true)::uuid
        AND a.ended_at IS NULL
    )
  );
```

RLS rather than a service-layer filter because this is the one access rule where a forgotten `WHERE` clause hands one seller's buyer names and phone numbers to another seller's courier.

---

### 6.9a `core.permission` — surface is a property of the capability

ADU-ARCH-01 §3.4: **no action in §6.5 is reachable from the mobile app, on any screen, by any route.** That has to be structural, or the Companion becomes a way around controls the console enforces.

```sql
CREATE TABLE core.permission (
  code     text PRIMARY KEY,                    -- 'seller.reservations:respond'
  surfaces core.session_audience[] NOT NULL     -- which surfaces may exercise it
);

CREATE TABLE core.role_permission (
  role            core.team_role NOT NULL,
  permission_code text NOT NULL REFERENCES core.permission(code),
  PRIMARY KEY (role, permission_code)
);
```

`core.fn_has_permission(account_id, seller_id, permission_code, audience)` now checks **both**: the role grants the capability, **and** the calling surface may exercise it.

**INVARIANT — every §6.5 step-up capability has `surfaces = '{SELLER_WEB}'`.** Payout change, reissued instructions, team changes, subscription purchase, seller deletion, revoking sessions. A mobile session presenting at one of these receives 403 from the function, before any endpoint logic runs.

```sql
ALTER TABLE core.permission ADD CONSTRAINT step_up_is_web_only CHECK (
  code NOT IN ('seller.payout:update', 'seller.instructions:reissue',
               'seller.staff:admin', 'seller.subscription:update',
               'seller.account:delete', 'seller.sessions:revoke_all')
  OR surfaces = ARRAY['SELLER_WEB']::core.session_audience[]
);
```

A `CHECK` rather than a convention, because this is the boundary an agent is most likely to widen while making the Companion "more useful."

**The Companion's Phase 1 grants**, for reference: `seller.notifications:read`, `seller.reservations:read`, `seller.reservations:respond`, `seller.payment_evidence:read`, `seller.payment_receipt:confirm`, `seller.messages:read`, `seller.messages:send`, `seller.handoff:read`, `seller.order_ready:update`. Each carries `surfaces = '{MOBILE, SELLER_WEB}'` — the console can do everything the Companion can.

**INVARIANT — RBAC is enforced server-side on every endpoint, never by hiding UI** (§16.2), unchanged. Surface scoping is an additional dimension, not a replacement.

---

## 7. Sellers, eligibility and verification

### 7.1 `core.seller`

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `market_id`, `owner_account_id`, `person_id NULL` | |
| `entity_type` | `INDIVIDUAL`, `COMPANY` (§4.3) |
| `store_name`, `handle` | `handle` unique per market; `pg_trgm` index for §7.6 |
| `description`, `category_id` | |
| `status` | `DRAFT`, `ACTIVE`, `BILLING_SUSPENDED`, `SAFETY_SUSPENDED`, `DELETED` (§16.8) |
| `waitlist_follower_claim int NULL` | Self-reported at waitlist, imported per §25. **Never blended with the verified count** |
| `published_at` | |

**INVARIANT — `UNIQUE (id, market_id)` and `UNIQUE (id, owner_account_id)` exist on `seller`.** These are the anchors for the composite foreign keys used throughout §9–§12 to make cross-seller and cross-buyer mistakes structurally impossible rather than merely unlikely.

**`core.seller_company_detail`** — registration identifier, trade licence number, TIN, representative `person_id`, representative relationship. Company sellers only, enforced by a composite FK on `(seller_id, entity_type)`.

### 7.2 `core.seller_social_account`

Account-control verification lives in `core`, not `verification`. Handles and follower counts are public information the storefront displays; putting them behind the isolated boundary would make its audit log too long for the paid reviewer §23 requires to read it in full.

| Column | Notes |
|---|---|
| `seller_id`, `platform` | Unique together |
| `handle`, `platform_account_id` | |
| `verified_at` | NULL until control is proven |
| `follower_count_at_verification int` | §4.2 — captured with a timestamp |
| `follower_count_source` | `PLATFORM_FETCH`, `MANUAL_FALLBACK` (§13.1 adapter degradation) |
| `status` | `PENDING`, `VERIFIED`, `REVOKED` |

**INVARIANT — follower count is recorded at verification with a timestamp, and eligibility is never re-evaluated retroactively** (§4.2). Write-once: an `UPDATE` trigger rejects a change to `follower_count_at_verification` or `verified_at`. Re-verification writes a new row and supersedes the old.

**`core.account_control_challenge`** — the one-time code posted to the linked social account: `code`, `issued_at`, `expires_at`, `matched_at`, `attempts`.

**INVARIANT — each platform sits behind an adapter interface; a platform failure degrades to manual verification without affecting the others** (§13.1). The data-model expression is `follower_count_source` and a nullable `platform_account_id`, so a manually verified seller is a valid row rather than a special case.

### 7.3 `verification` schema — the isolated identity boundary

```sql
CREATE SCHEMA verification AUTHORIZATION adulis_verification;
REVOKE ALL ON SCHEMA verification FROM adulis_app;
```

**`verification.identity_attestation`** — `person_id`, `verified_on date`, `verifier_kind`, `vendor_reference`, `id_type`, `legal_name`, `id_hash bytea`, `id_hash_key_version`, `verified boolean`, `company_relationship text NULL`.

**INVARIANT — no identity image or video is ever uploaded to Adulis systems** (§13.1). There is no column for one. Not a nullable column, not an `image_url` left empty — **no column exists**, so no agent can populate one and no migration can quietly add one without appearing in review.

**INVARIANT — ID verification always attests to a natural person, regardless of seller entity type** (§4.3). The table is keyed on `person_id` and has no `seller_id`. A company attestation is an attestation about its representative, which is what the PRD says and what the schema now says too.

**`verification.access_log`** — append-only: `actor_account_id`, `actor_role`, `attestation_id`, `reason`, `occurred_at`.

**The only read path:**

```sql
CREATE FUNCTION verification.read_attestation(
  p_person_id uuid, p_actor uuid, p_actor_role text, p_reason text
) RETURNS verification.identity_attestation
LANGUAGE plpgsql SECURITY DEFINER SET search_path = verification AS $$
DECLARE r verification.identity_attestation;
BEGIN
  SELECT * INTO r FROM verification.identity_attestation WHERE person_id = p_person_id;
  INSERT INTO verification.access_log
    (actor_account_id, actor_role, attestation_id, reason)
  VALUES (p_actor, p_actor_role, r.id, p_reason);
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION verification.read_attestation TO adulis_app;
```

The log write and the read are one statement. There is no unlogged read because there is no other read.

**A duplicate-detection path that returns no identity data** is provided separately — `verification.id_hash_matches(p_hash bytea) RETURNS int` — so §13.2's "same person across accounts" check does not require reading a name.

### 7.4 `core.seller_eligibility_evaluation`

Append-only: `seller_id`, `evaluated_at`, `config_version_id`, `path` (`AUDIENCE`, `IDENTITY`), `outcome`, `reasons text[]`.

**INVARIANT — eligibility is evaluated by a rules service reading per-market configuration, and Phase 2 must not require a code change** (§4.1). The rules service is `core.fn_evaluate_eligibility(seller_id, at timestamptz)`, a single SQL function reading `eligibility_config` at that instant. Phase 2 is `audience_required = false` in a new configuration row.

**INVARIANT — a seller must satisfy at least one path before publishing any product** (§4.2). Enforced at §9.4, publication readiness.

**INVARIANT — a seller taking the identity path holds a full ID attestation before their first listing goes live. There is no grace period** (§4.2). The readiness function returns `NOT_SATISFIED` where `path = IDENTITY` and no attestation exists; there is no bypass column and no "provisional" state to abuse.

### 7.5 The ambassador rule

§4.5: *"Not system-enforceable… Do not build a control for it."* **No table, no column, no flag.** Recorded here so that no future agent invents one from the terms-of-service text. It is handled by a report under §21.

---

## 8. The trust ladder

### 8.1 `core.seller_level_state`

One row per seller: `level` (`NEW`, `ESTABLISHED`, `TRUSTED`), `since`, `computed_at`, `evidence_snapshot jsonb`.

**Per C5, the row is created when eligibility is satisfied**, not when an ID attestation is written:

```sql
CREATE FUNCTION core.fn_enter_ladder() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.outcome = 'SATISFIED' THEN
    INSERT INTO core.seller_level_state (seller_id, level, since, computed_at)
    VALUES (NEW.seller_id, 'NEW', now(), now())
    ON CONFLICT (seller_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_enter_ladder
  AFTER INSERT ON core.seller_eligibility_evaluation
  FOR EACH ROW EXECUTE FUNCTION core.fn_enter_ladder();
```

`ON CONFLICT DO NOTHING` because re-evaluation must never reset a seller who has already climbed. This was new in v1.1: v1.0 took the C5 ruling but left nothing that actually created the row, which would have produced a Phase 1 cohort with a null level — the exact outcome the ruling was meant to avoid.

**Two semantics the trigger implies, stated here rather than left to be discovered** (P2, v1.2):

**It creates rows going forward and backfills nothing.** Any seller who satisfied eligibility before migration 5 ran has no level row and no trigger will give them one. This is irrelevant pre-launch and is stated only because the trigger must not be deferred to a later migration — if it ever moves after migration 6, a backfill `INSERT ... SELECT` over satisfied evaluations has to move with it.

**`since` never resets, including on re-satisfaction after a revocation.** `ON CONFLICT DO NOTHING` swallows the second insert, which is deliberate: the ladder measures accumulated handoff evidence, and a seller whose social account was revoked and re-verified has not lost the handoffs they completed. Where a revocation should cost a seller their level, the correct instrument is a logged demotion under §5.1 — `source = 'MODERATION'` with a `moderation_event_id` — not a silent re-entry at `NEW` that leaves no record of who decided it or why.

**INVARIANT — a seller's level is computed from completed, scanned handoffs and published reliability statistics. It is never set manually, never purchasable, and never affected by subscription tier or advertising spend** (§5.1).

The mechanism is threefold, because this is the one rule whose violation makes the entire product worthless:

1. `seller_level_state` has **no `UPDATE` grant to `adulis_app`**. It is written only by `core.fn_recompute_seller_level(seller_id)`.
2. That function's body references `core.handoff_scan`, `core.review`, `core.claim` and `core.ladder_config`. **It references no billing table.** There is no join path from a subscription to a level, so no amount of generated code can create one.
3. Every change writes `core.seller_level_event` (append-only) with `source` (`COMPUTED`, `MODERATION`) and `CHECK (source <> 'MODERATION' OR moderation_event_id IS NOT NULL)`.

That third clause is §5.1's *"no manual downgrade except through moderation action, which is logged"* — expressed so that an unlogged manual downgrade is a constraint violation, not an oversight.

### 8.2 Anti-gaming

**INVARIANT — a scanned handoff counts toward level only when the scanning buyer account is distinct, has its own verified phone number, and has not transacted with that seller more than a configured number of times in the level window** (§5.2).

`core.handoff_scan.counts_toward_level` is a boolean written by a `BEFORE INSERT` trigger, never by the application. The trigger evaluates, in order: the buyer account is not the seller's owner or any team member; the buyer's phone is verified; the count of that buyer's prior counting handoffs with that seller within `ladder_config.distinct_buyer_window` is below `ladder_config.max_handoffs_per_buyer`; scan validity is `VALID` and not `LATE` (§11.4).

Supporting tables: `core.level_velocity_flag` (automatic review flag when a level rises unusually fast), and a scheduled graph-analysis job writing `core.buyer_seller_pair_signal`.

**INVARIANT — an upheld claim always demotes, regardless of volume** (§5.2, §14). A trigger on `claim` reaching `UPHELD` calls the recompute function with a forced demotion argument. The demotion is not conditional on thresholds, because the PRD says *always*.

### 8.3 What the buyer sees

**INVARIANT — the seller's level and completed handoff count are visible on the storefront, on every product page, and at the reservation step** (§5.3). `core.seller_public_stats` is materialized and refreshed on relevant writes, carrying level, completed handoff count, cancellation rate, confirmation rate, scan completion rate, unresolved claim count, missed payment-confirmation windows, stock confidence (§13.2). Materialized because it is read on every storefront page load on a low-end Android over a slow connection, which is the binding performance constraint (§23).

**INVARIANT — Adulis never publishes the words scammer, fraud, criminal or equivalent, or any assertion of wrongdoing** (§13.2). `seller_public_stats` contains **only numbers, dates and the three level names**. No free-text column exists on it. A published statistic that cannot hold a sentence cannot hold an accusation.

---

## 9. Catalogue

### 9.1 Categories and structured attributes

**`core.category`** — id, parent, code, per-market availability. Launch set: fashion and clothing, cosmetics, electronics (ADU-00 Launch Scope).

**`core.attribute_definition`** — `category_id`, `code`, `label_key`, `data_type`, `unit`, `is_variant_defining boolean`.

Two layers, because §7 uses attributes for two different jobs: product-level descriptive attributes make the chatbot free (§15.1 layer 0), and variant-defining attributes are what distinguishes one variant from another.

**`core.attribute_option`** — permitted values for `ENUM` attributes.
**`core.product_attribute_value`** — product-level.
**`core.variant_attribute_value`** — variant-level; only definitions with `is_variant_defining = true`, enforced by a composite FK.

### 9.2 `core.product`

`seller_id`, `market_id`, `name`, `description`, `category_id`, `display_order int`, `visibility`, `base_price_minor`, `base_price_currency`, `created_at`, `published_at`, `unpublished_reason NULL`.

**Per C1, `base_price_minor` is a seed value, not a price.** It is copied into a new variant at creation and read by nothing else. No order, reservation, cart line or storefront render reads it — a `grep` for `base_price` outside the variant-creation function should return nothing, which is check 3 in Appendix C.

`UNIQUE (id, seller_id)` — the anchor for every composite FK below.

**INVARIANT — on downgrade, products above the limit are unpublished, never deleted** (§7). `unpublished_reason` records which of the four causes applied, so that the seller's own choice and a system action are distinguishable — §7 gives the seller the choice and specifies the fallback order (most-reserved, then most-recently-added) only where they fail to choose.

### 9.3 `core.product_variant`

`product_id`, `seller_id` (denormalised for the composite FK), **`price_minor`, `price_currency` — the price of the thing, per C1**, `stock_count int NOT NULL CHECK (stock_count >= 0)`, `stock_confirmed_at`, `variant_key text`, `status`.

`UNIQUE (product_id, variant_key)` where `variant_key` is the canonical sorted serialisation of the variant's defining attribute values, written by a trigger. Two variants of one product cannot carry the same attribute combination — a data-entry error that otherwise surfaces as a buyer reserving the wrong thing.

`UNIQUE (id, seller_id)` and `UNIQUE (id, product_id)` — composite FK anchors.

### 9.4 Publication readiness

**INVARIANT — publication readiness is computed server-side as a single resolved state, not inferred by the client from separate checks** (§4.6).

```sql
CREATE FUNCTION core.fn_publication_readiness(p_seller_id uuid)
RETURNS TABLE (item text, satisfied boolean, resolving_action text)
LANGUAGE sql STABLE AS $$ ... $$;
```

One function, returning the ten items in §4.6's table with their satisfaction and the action that resolves each. The client renders the rows; it computes nothing.

**INVARIANT — `seller_publication_blocked` is emitted with its blocking reasons whenever readiness is evaluated and fails** (§4.6). Emitted by the function itself, so the funnel data cannot be lost to a code path that forgot to log. §4.6 is explicit that this is a measurement problem as much as a UX one, and that it cannot be reconstructed later.

**INVARIANT — publication limits are the lesser of the tier limit and the level limit** (§7, §16.5). A `CHECK` cannot express it; `core.fn_publish_product` calls `billing.fn_effective_limit(seller_id, 'PRODUCT_COUNT')` and refuses.

### 9.5 Media

**`core.product_image`** — `product_id`, `position int CHECK (position BETWEEN 1 AND 5)`, `thumb_key`, `card_key`, `full_key`, `uploaded_at`. `UNIQUE (product_id, position)` caps images at five (§7.4) as a structural fact.

**INVARIANT — uploaded originals are resized on receipt and discarded** (§7.4). There is no `original_key` column. Same reasoning as the identity images: the absence of a column is a stronger guarantee than a deletion job.

**`core.product_video`** — `product_id UNIQUE` (one clip per product), `key`, `duration_seconds CHECK (<= 30)`, `height_px CHECK (<= 480)`, `bytes`.

**INVARIANT — Adulis runs no server-side transcoding pipeline in V1** (§7.4). No rendition table, no transcode job type. A single progressive-download rendition, which is one row.

**`core.media_lifecycle`** — `object_key`, `class` (`HOT`, `INFREQUENT`), `purge_after`, `reason`. **INVARIANT — media has a lifecycle policy** (§7.4). Storage that only ever grows is a cost curve, not a bug — which is why it needs a table rather than good intentions.

### 9.6 Social posts

**`core.social_post`** — `platform`, `canonical_post_id`, `status`, `first_seen_at`. `UNIQUE (platform, canonical_post_id)`.
**`core.product_social_post`** — `product_id`, `seller_id`, `social_post_id`. Many-to-many.

**INVARIANT — one post link may be attached to many products by the same seller** (§7.5.1). It is a join table, so it cannot assume otherwise.

**INVARIANT — a pasted post link resolves only within the seller who tagged it** (§7.5.1). The resolution function returns rows grouped by seller; where more than one distinct seller has claimed a post it returns **nothing** and inserts a `moderation_queue_item` of kind `POST_LINK_CONFLICT`. A reseller using someone else's content is a moderation question, not a search result.

Matching is on `canonical_post_id`, never the URL string. **Shortened and redirecting URLs are resolved before matching** — TikTok share links are usually shortened, and matching the raw string fails most of the time. The service performs the redirect chain; the database stores only the canonical result.

**INVARIANT — storefront search scope is exactly one seller** (§7.5) and **seller lookup returns sellers, never products** (§7.6). Both are functions whose signatures make the alternative unexpressible: the search function takes a `seller_id` and has no cross-seller path; the lookup function's return type is `core.seller`.

⚠ **Deleted and reposted source content remains open** (§7.5.1, §25). The schema is neutral: `social_post.status` (`LIVE`, `UNAVAILABLE`, `UNKNOWN`) is set by a checker job. Whatever is decided — hide the embed, unpublish, notify the seller — is a policy on that column, not a migration.

---

## 10. Stock

### 10.1 `core.stock_event` — append-only

`variant_id`, `seller_id`, `delta int`, `reason`, `order_id NULL`, `reservation_id NULL`, `actor_account_id NULL`, `resulting_count int`, `occurred_at`.

**INVARIANT — stock is never mutated without a corresponding StockEvent row** (§7).

The strongest available form: **`stock_count` is not writable at all.** It is maintained exclusively by an `AFTER INSERT` trigger on `stock_event`, and a `BEFORE UPDATE` trigger on `product_variant` raises if `stock_count` changed and the change did not come from that trigger.

```sql
CREATE FUNCTION core.fn_apply_stock_event() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('adulis.stock_write', 'on', true);
  UPDATE core.product_variant
     SET stock_count = stock_count + NEW.delta
   WHERE id = NEW.variant_id
   RETURNING stock_count INTO NEW.resulting_count;
  PERFORM set_config('adulis.stock_write', 'off', true);
  RETURN NEW;
END $$;

CREATE FUNCTION core.fn_guard_stock_count() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock_count IS DISTINCT FROM OLD.stock_count
     AND coalesce(current_setting('adulis.stock_write', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'stock_count is derived from core.stock_event'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
```

The `CHECK (stock_count >= 0)` then makes over-selling a transaction failure rather than a negative number. This is the single most important pair of triggers in the schema: ADU-PROJ-01 §13.5 names *"AI-generated code wrong under concurrency"* as a live risk, and stock decrement under concurrency is where it would first show.

### 10.2 Stock confidence

`stock_confirmed_at` on the variant; the level is **computed, never stored**:

```sql
CREATE VIEW core.v_stock_confidence AS
SELECT v.id AS variant_id,
       v.stock_confirmed_at,
       CASE
         WHEN now() - v.stock_confirmed_at < interval '24 hours' THEN 1
         WHEN now() - v.stock_confirmed_at < interval '48 hours' THEN 2
         WHEN now() - v.stock_confirmed_at < interval '72 hours' THEN 3
         WHEN now() - v.stock_confirmed_at < interval '7 days'  THEN 4
         ELSE 5
       END AS confidence_level
FROM core.product_variant v;
```

A view rather than a column because a stored level drifts the moment a job misses a run, and §13.3's graduated consequences — up to blocking broadcasts — would then fire against a stale number.

⚠ **A gap worth recording.** §13.3 level 3 is *"chatbot hedges stock claims more strongly."* A Free-tier seller has no chatbot (§16.1), so level 3 has no effect for them and the ladder skips from a staleness notice straight to a degraded badge. Not a contradiction, but the seller-facing explanation of stock confidence should not promise a consequence that does not apply to the tier reading it.

**Stock update must take under five seconds** (§13.3) — a single-row insert plus a trigger. Nothing in this path touches an external service.

---

## 11. Cart and device lifecycle

Specified in full here per C6. In v1.0 the `device_id` key was ruled on but its lifecycle was left implicit, which is where a generated implementation would have invented something.

### 11.1 Registration and binding

1. **First app launch.** The app generates a UUIDv7 and registers it: `INSERT INTO core.device`. No account, no session, no personal data.
2. **Browsing and cart building.** `core.cart` rows are keyed by `device_id`. `buyer_account_id` is null.
3. **First reserve.** Phone OTP creates the account (§6.1). In the same transaction: `device.account_id` is set, and every `ACTIVE` cart for that device has `buyer_account_id` set.
4. **Subsequent devices.** A second device for the same account registers its own row and binds on first authenticated call. Carts do not merge across devices — a cart is a draft on a phone, and merging two drafts silently is exactly the kind of "the system altered my cart" behaviour §8.3 forbids.
5. **Purge.** A device with no `account_id` and no activity beyond `timing_config.media_retention` is deleted, taking its carts with it. A bound device is retained while the account is.

### 11.2 `core.cart` and `core.cart_line`

`cart` — `device_id NOT NULL`, `buyer_account_id NULL`, `seller_id NULL`, `market_id`, `status`. One `ACTIVE` cart per device (partial unique index).

**INVARIANT — a cart contains items from exactly one seller, enforced when a second seller's item is added, not at checkout** (§8.1):

```sql
ALTER TABLE core.cart_line
  ADD CONSTRAINT cart_line_single_seller
  FOREIGN KEY (cart_id, seller_id) REFERENCES core.cart (id, seller_id),
  ADD CONSTRAINT cart_line_variant_seller
  FOREIGN KEY (variant_id, seller_id) REFERENCES core.product_variant (id, seller_id);
```

Adding a variant belonging to a different seller violates the second constraint at `INSERT`. Not a service check that can be bypassed by a second endpoint or a direct API call — a foreign key. `cart.seller_id` is set by a trigger on the first line and nulled when the last is removed.

**INVARIANT — adding an item to the cart has no effect on stock** (§8.2). No trigger on `cart_line` touches `stock_event`. Stated because it is the natural instinct when generating this code.

`cart_line` carries `availability_checked_at`, refreshed on every cart view, because §8.2 requires the cart to display live availability per line **with the moment it was checked**. A cart is a draft, not a claim, and the interface has to say so rather than imply it.

---

## 12. Orders and reservations

### 12.1 `core."order"` and `core.reservation`

**`core."order"`**

| Column | Notes |
|---|---|
| `id`, `market_id`, `seller_id`, `buyer_account_id` | |
| `state` | `order_state`, per C2 |
| `created_at`, `expires_at` | `created_at + timing_config.reservation_window` |
| `clock_stopped_at` | Set at `PAYMENT_CONFIRMED` (§9.2) |
| `fulfilment_deadline` | Set at `PAYMENT_CONFIRMED` from `timing_config.fulfilment_window` |
| `total_minor`, `total_currency` | Recalculated from surviving lines (§9.4) |
| `display_currency`, `fx_rate`, `fx_rate_captured_at` | §8.4 — the ETB conversion rate is captured like price |
| `payout_snapshot_id` | §8.5 |
| `seller_level_at_order` | Claim evidence (§14) |

`UNIQUE (id, buyer_account_id)` and `UNIQUE (id, seller_id)` — composite FK anchors for the handoff and review rules.

**`core.reservation`** — `order_id`, `variant_id`, `seller_id`, `buyer_account_id`, `quantity`, `unit_price_minor`, `unit_price_currency`, `state`, `cancelled_at`, `cancelled_by`, `cancellation_reason`, `penalty_exempt boolean`, `active_window tstzrange`.

**INVARIANT — the unit price in effect at the moment the order is created is written onto the reservation and is immutable for the life of that order** (§8.4). Write-once trigger. Price is the most common source of dispute between a buyer and a seller, and the buyer agreed to a specific number.

**INVARIANT — a unique constraint on (seller, buyer, variant, active time window) makes duplicate live reservations structurally impossible** (§9.1). The PRD says "unique constraint"; a plain unique constraint cannot express a time window:

```sql
ALTER TABLE core.reservation
  ADD CONSTRAINT reservation_no_duplicate_active
  EXCLUDE USING gist (
    seller_id WITH =, buyer_account_id WITH =, variant_id WITH =,
    active_window WITH &&
  ) WHERE (state = 'ACTIVE');
```

This is why `btree_gist` is a hard hosting requirement (§3.1).

### 12.2 The two state machines — new in v1.1

C2 ruled two machines. This section specifies them, because "two machines" without a transition table is an invitation for generated code to invent one.

**`order_state` — legal transitions**

| From | To | Trigger |
|---|---|---|
| `CREATED` | `NOTIFIED` | Seller notified of the order |
| `CREATED`, `NOTIFIED` | `PAYMENT_SUBMITTED` | Buyer uploads evidence (§10.1 step 3) |
| `CREATED`, `NOTIFIED` | `EXPIRED_UNCLAIMED` | Expiry sweep |
| `PAYMENT_SUBMITTED` | `PAYMENT_CONFIRMED` | Seller confirms. **Sets `clock_stopped_at`** |
| `PAYMENT_SUBMITTED` | `NOTIFIED` | **Seller rejects the evidence.** See the write-back below |
| `PAYMENT_CONFIRMED` | `HANDED_OFF` | Scan or tapped confirmation (§11.3) |
| `HANDED_OFF` | `COMPLETED` | Order settles; review becomes available |
| Any non-terminal | `CANCELLED_BY_BUYER` | **Derived** — every line buyer-cancelled |
| Any non-terminal | `CANCELLED_BY_SELLER` | **Derived** — every line seller-cancelled or refunded |

**`reservation_state` — legal transitions**

| From | To | Trigger |
|---|---|---|
| `ACTIVE` | `FULFILLED` | Order reaches `COMPLETED` |
| `ACTIVE` | `CANCELLED_BY_BUYER` | Buyer cancels the line |
| `ACTIVE` | `CANCELLED_BY_SELLER` | Seller cancels **before** `PAYMENT_CONFIRMED` |
| `ACTIVE` | `REFUNDED` | Seller cancels **after** `PAYMENT_CONFIRMED` (§9.4) |
| `ACTIVE` | `EXPIRED` | Order expires unclaimed |

`REFUNDED` exists only here. There is no `REFUNDED` value in `order_state`, per C2.

**Enforcement — a data-driven machine, not a `CASE` in a service.** Two tables, one per machine, so each keeps its own enum type and a wrong state name is a type error rather than a row that never matches.

```sql
CREATE TABLE core.order_state_transition_legal (
  from_state   core.order_state NOT NULL,
  to_state     core.order_state NOT NULL,
  written_by   text NOT NULL,          -- which function or job performs it
  ratified_at  timestamptz,            -- NULL until reviewed (P1)
  ratified_by  text,
  PRIMARY KEY (from_state, to_state)
);

CREATE TABLE core.reservation_state_transition_legal (
  from_state   core.reservation_state NOT NULL,
  to_state     core.reservation_state NOT NULL,
  written_by   text NOT NULL,
  ratified_at  timestamptz,
  ratified_by  text,
  PRIMARY KEY (from_state, to_state)
);

CREATE FUNCTION core.fn_guard_order_transition() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IS DISTINCT FROM OLD.state
     AND NOT EXISTS (SELECT 1 FROM core.order_state_transition_legal
                      WHERE from_state = OLD.state AND to_state = NEW.state) THEN
    RAISE EXCEPTION 'Illegal order transition % -> %', OLD.state, NEW.state
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
```

Every transition also writes `core.order_state_transition` (append-only: from, to, actor, reason, occurred_at), which is the *"order state transitions"* evidence §14 attaches to a claim.

**INVARIANT — the guard is fail-closed.** A transition absent from the table is refused. An empty table means nothing moves at all. There is no permissive mode, no warn-only setting, and no environment variable that relaxes it — a machine that logs violations instead of refusing them produces bad data during the exact period nobody is watching the logs.

**INVARIANT — the legal tables are writable only by `adulis_migrate`.** This closes the residual noted in the v1.1 review: a legal set the application can `INSERT` into is a state machine that widens at runtime with no migration and no diff. Adding a transition is a reviewed schema change or it does not happen.

```sql
REVOKE INSERT, UPDATE, DELETE ON core.order_state_transition_legal FROM adulis_app;
REVOKE INSERT, UPDATE, DELETE ON core.reservation_state_transition_legal FROM adulis_app;
```

**Why tables rather than a `CHECK` or a service.** The legal set is 24 rows a reviewer can read in one query and audit against this document without reading `plpgsql`. That matters more here than anywhere else in the schema, because an illegal transition is how a paid order silently becomes an expired one.

### 12.2.1 Ratification — the set is provisional until reviewed

The transition set was drafted from ADU-PRD-01, not ratified by anyone. The interim posture is therefore **provisional but fail-closed**: the 24 rows below are seeded in migration 9 with `ratified_at IS NULL`, the guard enforces them from the first order, and build work proceeds — but nothing unratified reaches a live market.

**INVARIANT — a market cannot be set live while any transition row is unratified.**

```sql
CREATE FUNCTION core.fn_guard_market_live() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_live AND NOT OLD.is_live
     AND EXISTS (SELECT 1 FROM core.order_state_transition_legal WHERE ratified_at IS NULL
                 UNION ALL
                 SELECT 1 FROM core.reservation_state_transition_legal WHERE ratified_at IS NULL) THEN
    RAISE EXCEPTION 'State machine not ratified; market cannot go live'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$;
```

Same shape as the `market_phase_gate` trigger in §5.1, and for the same reason: a review that blocks a release is a gate, and a review that is merely scheduled is a hope.

**The rows to review — `order_state`, 18:**

| # | From | To | Written by | Note |
|---|---|---|---|---|
| 1 | `CREATED` | `NOTIFIED` | seller notification job | |
| 2 | `CREATED` | `PAYMENT_SUBMITTED` | buyer uploads evidence | |
| 3 | `NOTIFIED` | `PAYMENT_SUBMITTED` | buyer uploads evidence | |
| 4 | `CREATED` | `EXPIRED_UNCLAIMED` | expiry sweep | |
| 5 | `NOTIFIED` | `EXPIRED_UNCLAIMED` | expiry sweep | |
| 6 | `PAYMENT_SUBMITTED` | `EXPIRED_UNCLAIMED` | expiry sweep | **R-2** |
| 7 | `PAYMENT_SUBMITTED` | `PAYMENT_CONFIRMED` | seller confirms; sets `clock_stopped_at` | |
| 8 | `PAYMENT_SUBMITTED` | `NOTIFIED` | seller rejects the evidence | W6 |
| 9 | `PAYMENT_CONFIRMED` | `HANDED_OFF` | scan or tapped confirmation | |
| 10 | `HANDED_OFF` | `COMPLETED` | settlement | |
| 11 | `EXPIRED_UNCLAIMED` | `HANDED_OFF` | late in-window scan (§11.4) | **R-1** |
| 12 | `CREATED` | `CANCELLED_BY_BUYER` | derived from lines | |
| 13 | `NOTIFIED` | `CANCELLED_BY_BUYER` | derived from lines | |
| 14 | `PAYMENT_SUBMITTED` | `CANCELLED_BY_BUYER` | derived from lines | |
| 15 | `CREATED` | `CANCELLED_BY_SELLER` | derived from lines | |
| 16 | `NOTIFIED` | `CANCELLED_BY_SELLER` | derived from lines | |
| 17 | `PAYMENT_SUBMITTED` | `CANCELLED_BY_SELLER` | derived from lines | **R-3** |
| 18 | `PAYMENT_CONFIRMED` | `CANCELLED_BY_SELLER` | derived — every line `REFUNDED` | **R-3** |

**`reservation_state`, 6:**

| # | From | To | Written by | Note |
|---|---|---|---|---|
| 19 | `ACTIVE` | `FULFILLED` | order reaches `COMPLETED` | |
| 20 | `ACTIVE` | `CANCELLED_BY_BUYER` | buyer cancels the line | |
| 21 | `ACTIVE` | `CANCELLED_BY_SELLER` | seller cancels before `PAYMENT_CONFIRMED` | |
| 22 | `ACTIVE` | `REFUNDED` | seller cancels after `PAYMENT_CONFIRMED` (§9.4) | |
| 23 | `ACTIVE` | `EXPIRED` | order expires unclaimed | |
| 24 | `EXPIRED` | `FULFILLED` | late in-window scan | **R-1** |

**Three questions the review must answer.** Each is a place where the PRD does not determine the row.

**R-1 — `EXPIRED_UNCLAIMED` is not terminal, and §9.1 says it is.** §11.4 requires an in-window scan that syncs after the server expired the order to complete it: *"The order completes and counts toward trust level, even if the server had already expired it."* Rows 11 and 24 are that path. **Recommendation: ratify both**, with `order_state_transition.reason = 'LATE_SYNC_RECOVERY'` and the reconciliation `StockEvent` of §11.4. The alternative — refusing the transition — discards a completed handoff because of a signal outage in a doorway, which is the case §11.4 was written to handle.

**R-2 — a buyer who paid and was never confirmed.** Row 6. The clock only stops at `PAYMENT_CONFIRMED` (§9.2), so an order where the buyer uploaded evidence and the seller never responded still expires at 48 hours: stock released, order dead, money gone. **Recommendation: ratify the row, and have the same transaction open a `SYSTEM` claim.** Expiry alone leaves a buyer who has performed with no order and no recourse, and §17.3's own copy for this case already tells them a claim is what happens next.

**R-3 — mixed cancellation.** Rows 17 and 18 cover the case where the seller cancels some lines and the buyer cancels the remainder under §9.4's no-penalty rule. Every line is terminal, by different actors, and §9.4 only specifies *"an order whose every line is cancelled becomes `CANCELLED_BY_SELLER`."* **Recommendation: `CANCELLED_BY_SELLER` whenever any line was seller-cancelled or refunded**, because the seller's cancellation is what caused the buyer's. Nothing in the seller's published statistics turns on this — the cancellation rate counts reservation rows, not orders (§12.5) — so the label is a reporting question, not an economic one.

**What the guard does not do.** It validates legality, never authority. Row 7 is legal for anyone who can write the row; that it must be the seller or an RBAC-granted team member is `fn_has_permission` inside the confirming function. Both are required, and the transition table must not be read as an access control.

⚠ **The rejection path is an inference, not a PRD statement.** §10.1 step 4 says the seller *"confirms or rejects"* but never says what state a rejected order occupies. This document takes the only reading that preserves §9.2 — the order returns to `NOTIFIED`, the 48-hour clock is still running and was never stopped, and the buyer may submit new evidence. It is listed as a write-back in §29 so the PRD states it rather than leaving the next reader to re-derive it.

### 12.3 Order creation

**INVARIANT — the entire cart is revalidated inside the same transaction that creates the order. If any line fails, no order is created and no stock is decremented** (§8.3).

`core.fn_create_order(cart_id, ...)` is one function, one transaction. It checks, per line: sufficient stock, product still published, variant still exists, price unchanged, seller still eligible to receive orders, New-level transaction cap. On any failure it raises with a structured payload naming **every** failing line and its failure mode, so the buyer sees the complete reconciliation step §8.3 requires rather than one error at a time.

**The system never silently alters a cart.** No code path in the function writes to `cart_line`.

**INVARIANT — an order from a New-level seller is rejected if it exceeds the configured transaction value cap** (§9.1). Checked in the same function against `ladder_config.new_level_transaction_cap_minor`.

**INVARIANT — creating an order decrements stock immediately and holds it for 48 hours** (§9.1). One `stock_event` per line, inside the transaction.

### 12.4 Expiry

**INVARIANT — the expiry clock stops permanently when an order reaches `PAYMENT_CONFIRMED`. A paid order is never expired by the system** (§9.2).

```sql
ALTER TABLE core."order" ADD CONSTRAINT order_clock_consistency CHECK (
  (state IN ('PAYMENT_CONFIRMED','HANDED_OFF','COMPLETED')) = (clock_stopped_at IS NOT NULL)
);
```

The expiry job selects `WHERE clock_stopped_at IS NULL AND expires_at < now()`. A paid order is not skipped by a filter that could be dropped — it is not in the result set, and the constraint guarantees the column is set. The `EXPIRED_UNCLAIMED` transition is additionally absent from `order_state_transition_legal` for every post-payment state, so the same rule holds twice.

**INVARIANT — stock release on expiry is idempotent** (§9.1). A partial unique index on `(order_id, reason)` for release reasons. A second run inserts nothing and raises nothing.

### 12.5 Partial fulfilment

**INVARIANT — cancellation, refund and stock release operate at reservation level, not order level** (§9.4).

Each cancelled line writes its own `stock_event`, enters its own terminal state, and **counts individually toward the published cancellation rate** — cancelling two of three lines is two cancellations, not one. The cancellation-rate view counts reservation rows, never order rows, which is the arithmetic §9.4 specifies.

**INVARIANT — where payment was already confirmed, each cancelled line enters `REFUNDED` and the seller owes that line's captured amount.** `core.refund` carries `reservation_id`, `amount_minor` (the captured amount, not a recomputed one), `reported_by_seller_at`, `acknowledged_by_buyer_at`.

**The buyer may cancel the remainder without penalty** — `penalty_exempt` is set by the trigger that detects a preceding seller cancellation on the same order. Someone buying a matching set may not want part of it, and that choice belongs to them; the exemption must therefore be automatic, not a support request.

Order-level terminal state is derived: the trigger sets `order.state` when every line is terminal and recalculates `total_minor` from surviving lines on every line state change.

### 12.6 Order QR token

**`core.order_qr_token`** — `order_id`, `nonce uuid UNIQUE`, `signing_key_version`, `issued_at`. One per order — one scan per order regardless of item count (§11.1).

### 12.7 Buyer cancellation penalties

`core.buyer_cancellation_counter` — `buyer_account_id`, `seller_id NULL`, `count`, `window_start`, `cooldown_until`.

§9.5: three consecutive cancellations with one seller → 1 hour; a pattern across sellers → 1 day, then 2 days, escalating; **the counter decays after 30 days of clean activity**. Decay is a scheduled job, and the escalation ladder is `timing_config`, not literals in a service.

Cancelling actively is penalised less than letting an order expire silently — so the counter increments on `EXPIRED_UNCLAIMED` at a higher weight than on `CANCELLED_BY_BUYER`. The weights are configuration.

---

### 12.8 `core.idempotency_record` — transport

A retry on a lost response must not create a second order. The binding constraint is a low-end Android on a slow connection (§23), which makes a retry the normal case rather than the exception — the buyer taps Reserve, the request succeeds, the response never arrives, they tap again.

The `reservation_no_duplicate_active` exclusion constraint in §12.1 catches the single-line case, and only that one. A two-line order slips through it, and even where it fires the buyer receives a constraint violation instead of the order they already hold.

```sql
CREATE TABLE core.idempotency_record (
  id              uuid PRIMARY KEY,
  key             uuid NOT NULL,
  actor_kind      core.idempotency_actor_kind NOT NULL,
  actor_id        uuid NOT NULL,
  endpoint        text NOT NULL,
  request_hash    bytea NOT NULL,
  response_status int  NOT NULL,
  response_body   jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  UNIQUE (key, actor_kind, actor_id, endpoint)
);
```

**`actor_kind` admits `DEVICE` because the cart and device-registration endpoints are reachable before an account exists** (C6). A scheme that assumed an account would leave the pre-identity endpoints unprotected — the ones a buyer hits on the worst connection, before they have committed to anything.

**Not append-only**, and this is a deliberate exclusion rather than an oversight. It is an expiring cache of what was already answered, not a record of what happened; `analytics.event` is the record. Marking it append-only would add a table to the count Appendix C check 5 compares against the trigger and `REVOKE` totals, and that figure has already been wrong once (Appendix B).

### 12.9 `core.rate_limit_bucket` — transport

ADU-PRD-01 §23 requires rate limiting on auth, OTP, reservation, claim and proposal endpoints and specifies no mechanism. Postgres is the sole datastore, so the bucket is a table.

```sql
CREATE TABLE core.rate_limit_bucket (
  subject_kind core.rate_limit_subject_kind NOT NULL,
  subject_id   text NOT NULL,
  bucket_key   text NOT NULL,
  window_start timestamptz NOT NULL,
  count        int NOT NULL DEFAULT 0,
  PRIMARY KEY (subject_kind, subject_id, bucket_key, window_start)
);
```

**INVARIANT — a phone-keyed limit stores a hash, never the number.** The OTP limit has to work before an account exists, which is precisely when the raw number would otherwise sit in a counter table with no retention story and no DPIA coverage. Same mechanism and same reasoning as `core.phone_reuse_block` (§18.6).

**Accepted cost:** one small write per limited request, on top of the session read of §6.6, on a single managed Postgres. Affordable at the modelled volume of 1,000 sellers and worth measuring before it is not. Anonymous reads are limited at the Cloudflare edge and never reach this table (ADU-API-01 §10.1).

**Not append-only**, for the same reason as §12.8.

---

## 13. Payment

### 13.1 `core.seller_active_hours_version`

**Renamed `core.seller_availability` in v1.5, and no longer versioned.** `seller_id`, `weekday`, `opens_at time`, `closes_at time`, `updated_at`. Plain and updatable — the effective-range machinery existed only to serve a retroactivity rule that no longer exists.

**Availability is informational.** It describes when the store is reachable, not when the system is. The app runs 24 hours; a buyer browses, reserves and pays at any hour. **The operational gates are stock and product visibility, nothing else.**

**Windows are one hour to a full day, several per day permitted, and zero windows is a valid state.** Most sellers are creators without a shop and may be available for handoff for an hour a day; requiring eight required a shopfront from people who do not have one.

```sql
ALTER TABLE core.seller_availability
  ADD CONSTRAINT availability_window_minimum
  CHECK (closes_at - opens_at >= interval '1 hour');
```

**The retroactivity rule is deleted.** With availability informational, there is no window in force to capture and no immutable change log to keep — both existed solely to make an hour-weighted SLA computable. `payment_submission.active_hours_version_id` is dropped, and the two §24 tests that covered them go with it.

**The SLA is wall-clock**, computed from `submitted_at` alone. See §12.4.

### 13.2 `core.payment_submission`

`order_id`, `submitted_at`, `evidence_ref uuid` (opaque handle into `financial`), `state`, `decided_by_account_id`, `decided_at`, `rejection_reason`, `sla_deadline`, `active_hours_version_id`.

**Adulis never asserts that a payment is genuine** (§10.1). There is no `verified_by_adulis` column and no automated confirmation path. The seller is the verifier; team members confirm where RBAC grants it and **the acting member is recorded**, never the seller owner by default.

### 13.3 `financial` schema — the second isolated boundary

Same construction as `verification` (§7.3): its own schema, its own owning role, no direct grant to `adulis_app`, and read paths that are `SECURITY DEFINER` functions writing the access log in the same transaction as the read.

```sql
CREATE SCHEMA financial AUTHORIZATION adulis_financial;
REVOKE ALL ON SCHEMA financial FROM adulis_app;
```

Three tables. Two secrets, one log.

**`financial.payment_evidence`** — `order_id`, `object_key`, `encryption_key_ref`, `submitted_at`, `validated_at`, `deleted_at`, `retention_reason NULL`.

**`financial.payout_credential`** — specified in §13.6.

**`financial.access_log`** — append-only: `subject_kind` (`PAYMENT_EVIDENCE`, `PAYOUT_CREDENTIAL`), `subject_id`, `actor_account_id`, `actor_role`, `order_id`, `reason text NULL`, `occurred_at`.

**INVARIANT — screenshots are stored encrypted in an isolated boundary with its own access control and audit log, and are deleted once the payment is validated. Retention beyond validation only while a claim referencing that payment is open** (§10.3). The purge selects `validated_at IS NOT NULL AND retention_reason IS NULL`.

⚠ **The two secrets in this schema have opposite lifecycles, and the purge job must be scoped by table rather than by schema.** A payment screenshot is deleted the moment the payment validates; a payout credential persists for the life of the seller and is destroyed only by §16.9 deletion. A job written against the schema instead of the table would purge every seller's bank details on the first run. This is the one place the merge could bite, and it is why `evidence.purge` in §24 names its table.

**INVARIANT — every access to a payment evidence record is written to the access log, regardless of who performs it** (§10.3). The only read path logs. §10.3 is unusually pointed about why — *"A log that records only operator access describes a boundary Adulis controls while ignoring the actor who reads the record most often."* The seller is a legitimate reader, not an exempt one, and `reason` is nullable precisely because seller-side access requires no justification while still being recorded identically.

### 13.4 Payout details

**`core.payout_details`** — `seller_id`, `bank_code`, `account_last4 char(4)`, `state`, `requested_at`, `activates_at`, `activated_at`, `requested_by_account_id`, `step_up_challenge_id`.

**The account number is not in this table.** It lives in `financial.payout_credential` (§13.6), keyed by `payout_details_id`. `core` holds the last four digits and nothing more, so every seller, team, support and admin surface reads a masked value because that is the only value present — not because it remembered to mask.

**INVARIANT — only the Owner/Admin role may view or change payout details** (§10.4). The `PAYOUT_MANAGE` permission is granted to `OWNER` and `ADMIN` only in `role_permission`, and notably **not** to `SALES_SUPPORT`, who confirm payments daily.

**INVARIANT — changing payout details requires step-up authentication** (§6.5, §10.4). `step_up_challenge_id NOT NULL` on any row entering `PENDING`.

**INVARIANT — a payout change does not take effect immediately** (§10.4). `activates_at = requested_at + timing_config.payout_activation_delay`. During `PENDING`, the previous `ACTIVE` row remains the one read by order creation. A partial unique index enforces at most one `ACTIVE` row per seller.

**The seller can cancel a pending change without step-up authentication** — reverting must always be easier than changing. `fn_cancel_payout_change` takes no challenge argument.

**INVARIANT — a payout change, whether requested, activated or cancelled, notifies the seller's registered number and every Owner/Admin. Not suppressible, not affected by notification preferences** (§10.4). A trigger enqueues with `suppressible = false`, and the sender's preference filter carries `WHERE suppressible`. The seller learns within minutes rather than when a buyer says they paid someone else.

**INVARIANT — every payout change is written to an immutable log** (§10.4): `core.payout_change_log`, append-only — actor, timestamp, device and session reference, masked previous account, masked new account, outcome.

**INVARIANT — payout details cannot be changed during the recovery cooling period** (§6.6, §10.4).

### 13.5 `core.order_payout_snapshot`

**INVARIANT — the seller's payout details in effect at the moment the order is created are written onto the order and are immutable for the life of that order** (§8.5). Write-once row referenced by `order.payout_snapshot_id`.

Without this, a payout change mid-order silently reroutes payment for every order already placed — the exact outcome an attacker compromising a seller session is trying to produce, and it would be invisible to the buyer, the seller and Adulis.

**Reissue is the one controlled path** (§8.5): `core.payment_instruction_reissue` — `order_id`, `previous_snapshot_id`, `new_snapshot_id`, `actor_account_id`, `step_up_challenge_id NOT NULL`, `buyer_notified_at`, `sla_reset_at`, `occurred_at`. Append-only, single-order only (no bulk path exists in the function signature), and included in the order's evidence export.

### 13.6 The payout credential

C3 scopes masking to seller, team, support and admin surfaces and permits exactly one decryption path. v1.1 built that path in `core` and logged it. v1.2 moved it to a schema of its own. **v1.3 puts it where the same value already lives.**

**Why not a schema of its own.** ADU-PRD-01 §10.3 justifies the payment-evidence boundary on the grounds that *a payment screenshot carries both parties' bank details*. The seller's account number is therefore already inside that boundary — encrypted, behind a logging function, under its own role. A second boundary for the same secret means two key references to rotate, two logs to reconcile, and an auditor asking *"who has seen this seller's bank account?"* having to query both and union the answers. One secret, one regime.

**`financial.payout_credential`** — `payout_details_id` (bare uuid, no FK across the boundary), `account_ciphertext bytea`, `account_name_ciphertext bytea`, `encryption_key_ref`, `written_at`. Write-once; no `UPDATE` grant. Changing a bank account writes a new `core.payout_details` row with its own credential (§13.4).

**The only read path:**

```sql
CREATE FUNCTION financial.render_payment_instructions(p_order_id uuid, p_actor uuid)
RETURNS TABLE (bank_code text, account_number text, account_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial AS $$
BEGIN
  -- 1. Verify p_actor is the buyer on p_order_id.
  -- 2. Verify the order is in a payable state.
  -- 3. Read the payout snapshot captured on the order, never the seller's current record.
  -- 4. INSERT INTO financial.access_log (subject_kind => 'PAYOUT_CREDENTIAL', ...)
  --    in this transaction.
  -- 5. Decrypt and return.
END $$;

GRANT EXECUTE ON FUNCTION financial.render_payment_instructions TO adulis_app;
```

**INVARIANT — no column named `account_ciphertext` exists anywhere in `core`.** Cheaper to check than a revoked grant: Appendix C check 11 is a `grep`, and it fails loudly if a future migration reintroduces the column for convenience.

Four properties follow:

- **The masking invariant holds by structure.** Seller, team, support and admin surfaces read `account_last4` because it is the only value in `core`. There is nothing to forget to mask.
- **One query answers the auditor's question.** `SELECT ... FROM financial.access_log WHERE subject_kind = 'PAYOUT_CREDENTIAL'` — or drop the predicate and get every read of a bank account number by any route, screenshot or credential, in one result set. That is the query a data-protection review actually asks for, and v1.2 could not produce it without a union across two roles.
- **A second unlogged read path stays conspicuous.** Adding one is a reviewed migration either way; the gain is that a new function in a three-table schema is visible where one among `core`'s seventy-seven is not. Review ergonomics, not a security boundary — stated accurately here because v1.2 overstated it.
- **The log stays short.** One row per buyer per order, plus the evidence reads. Readable in full by the paid reviewer §23 requires.

**On encryption itself, since v1.2 assumed it rather than arguing it.** ADU-PROJ-01 §7.3 names three categories requiring specific handling under Proclamation 1321/2024, and payout details are not among them. The number is displayed to every buyer who places an order, so confidentiality against buyers is impossible by construction; and the attack §10.4 describes is a **write** attack — change the details, collect from everyone thereafter — defeated entirely by controls on the write path: step-up, activation delay, unsuppressible notification, immutable log, order snapshot. None of those depends on the value being encrypted.

Encryption buys exactly one thing: **a database dump or a restored backup does not yield every seller's bank account in the clear.** That is worth a column type for a company whose positioning is trust, and it is retained on that basis alone. Recorded here so the question is settled rather than rediscovered.

---

## 14. Handoff

### 14.1 `core.courier_custody_transfer` — Event A

`order_id`, `courier_account_id`, `seller_confirmed_at`, `courier_confirmed_at`.

**INVARIANT — Event A never completes an order, never counts toward seller trust level, never enables a review** (§11.2).

Expressed structurally: this table has **no column** for completion, level or review, and **no trigger** on it touches `order.state`, `seller_level_state` or `review`. Conflating the two events would make the trust ladder fakeable by any seller with one cooperative courier — so they are two tables, not one table with a `kind` column, precisely so that a generated code path cannot reach the wrong behaviour by passing the wrong enum value.

### 14.2 `core.handoff_scan` — Event B

`order_id`, `scanned_by_account_id`, `nonce uuid UNIQUE`, `signed_at` (device clock, inside the token), `reported_clock_offset_ms`, `corrected_at`, `received_at` (server), `validity`, `counts_toward_level boolean`, `review_badge`.

**INVARIANT — a courier can never perform the buyer's scan, on any client, under any circumstance** (§11.2):

```sql
ALTER TABLE core.handoff_scan
  ADD CONSTRAINT handoff_scanned_by_buyer
  FOREIGN KEY (order_id, scanned_by_account_id)
  REFERENCES core."order" (id, buyer_account_id);
```

The buyer is the party asserting receipt. A courier scanning on the buyer's behalf would let a seller manufacture verified handoffs at will — so the account that scans must be the account on the order, as a foreign key, not as a check somewhere in a service.

**INVARIANT — a token nonce already seen is rejected as replay, always, regardless of timestamp** (§11.4). `UNIQUE (nonce)`. A replay is a unique-violation, which is the cheapest and most reliable rejection available.

**INVARIANT — the signed timestamp inside the scanned token governs order completion, not the moment the scan reaches the server** (§11.4).

**INVARIANT — server receipt time governs level advancement.** New in v1.4, and the two are separated deliberately.

**Why they were separated.** §11.4 used one test for two decisions with opposite failure costs. Getting *completion* wrong hurts the buyer — they have their goods and no record, and their stock was released to someone else. Getting *level advancement* wrong corrupts the trust ladder, which is the product's only real differentiator. The first argues for generosity toward a clock the platform cannot verify; the second argues for a clock nobody can manipulate. One test cannot serve both.

So: **completion trusts the device, level credit trusts the server.**

```
corrected_at = greatest(signed_at - reported_clock_offset, order_qr_token.issued_at)
```

| Test | Governs | Clock |
|---|---|---|
| `corrected_at` within the reservation window | `validity = VALID`, order completes | Device, skew-corrected, floored at token issuance |
| `corrected_at` after the window closed | `validity = LATE`, order completes | Device |
| `received_at` within window + `timing_config.level_credit_grace` | `counts_toward_level = true` | **Server** |
| `received_at - signed_at >` sync horizon | `REJECTED_HORIZON` | Server |
| Nonce seen | `REJECTED_REPLAY` | — |

`level_credit_grace` is per-market configuration, default **24 hours**. It covers essentially every honest late sync — a buyer's phone regains signal within hours, not days — while removing the attacker's ability to farm at leisure.

**`CHECK (signed_at >= order_qr_token.issued_at)`.** A scan cannot predate the token it scanned, which alone caps backdating at the order's own lifetime.

**Honest skew is corrected, not punished.** Cheap Android devices frequently carry a correct NTP-synced UTC clock and a misconfigured timezone, or simply drift. The client reports its observed offset from the last successful bootstrap (ADU-API-01 §3.1); the server subtracts it. A malicious client lies about the offset too — but the floor at `issued_at` bounds the lie, and a reported offset that disagrees with the population feeds `level_velocity_flag`. **An honest buyer with a wrong clock must never cost an honest seller a level-counting handoff**, and under §11.4 as written they could.

⚠ **The cost, stated plainly.** A genuinely offline handoff that reaches the server beyond window plus grace completes the order but does not advance the ladder. That is exactly the treatment §11.4 already gives a `LATE` scan, so no new outcome is introduced — only a different test for which scans receive it. The seller sees it, and it should be rare.

⚠ **This contradicts ADU-PRD-01 §11.4 as written**, which says an in-window late scan *"completes the order and counts toward trust level, even if the server had already expired it."* Under v1.4 it completes the order always, and counts toward level only if it arrived inside the grace. Recorded as **W11** in §29.

**And a correction to how ADU-API-01 v1.0 and v1.1 sized this.** Both said a colluding buyer with a manipulated clock can manufacture verified handoffs. True, and overstated: **a seller with colluding buyers can already do that by scanning promptly with correct clocks, entirely inside the window.** Backdating adds no capability — only the convenience of farming at leisure and recovering expired orders. §5.2's distinct-buyer, velocity and graph controls were always the primary defence and remain so. This change removes the convenience; it does not close the underlying attack, and nothing at the data layer can.

**INVARIANT — stock is never re-decremented when an expired order is completed by a late-syncing scan** (§11.4). The completion path for an already-expired order writes a `stock_event` with `reason = 'RECONCILIATION'` and `delta = 0`, recording the discrepancy and notifying the seller. Re-decrementing could drive the count negative and violate the non-negativity constraint — the transaction would fail, and a doorway handoff would be lost to an arithmetic accident.

**Where the released stock was reserved by a different buyer in the interval**, the reconciliation trigger inserts a `moderation_queue_item` of kind `DOUBLE_ALLOCATION`. Two buyers hold claims on one item and no software resolves that — but the platform must notice it rather than let one of them discover it at a doorway.

### 14.3 Confirmation tiers

`core.order_confirmation` — `order_id`, `tier`, `source_scan_id NULL`, `confirmed_at`.

**INVARIANT — only a scanned handoff counts toward trust level** (§11.3). The recompute function filters `handoff_scan.counts_toward_level = true`; it never reads `order_confirmation`. A tapped confirmation publishes a review at medium weight and advances nothing.

---

## 15. Reviews

**`core.review`** — `order_id UNIQUE`, `buyer_account_id`, `seller_id`, `seller_rating smallint CHECK (1..5)`, `body text`, `badge`, `published_at`, `anonymised_at NULL`.

**`core.review_item_rating`** — `review_id`, `product_id`, `item_rating smallint`. One review per order, N item ratings — because §12 requires item quality to aggregate to the **product** while a single order may contain several.

**INVARIANT — two ratings, always separate, never averaged together** (§12). Two columns in two tables. There is no `overall_rating` column anywhere, so nothing can compute one by accident and display it.

**INVARIANT — a review may only be written by the buyer who holds the order it references** (§6.1):

```sql
ALTER TABLE core.review
  ADD CONSTRAINT review_by_order_buyer
  FOREIGN KEY (order_id, buyer_account_id)
  REFERENCES core."order" (id, buyer_account_id);
```

**INVARIANT — a seller can never prevent a review from publishing. Evidence determines the badge, not the right to publish** (§12). `published_at` is set by the insert trigger and there is no seller-writable column on this table — no `hidden`, no `approved`, no `visible`. `badge` is derived from `order_confirmation.tier`, so refusing to scan lowers the badge and silences nothing.

**INVARIANT — reviews are anonymised, never deleted** (§16.9). Deletion nulls `buyer_account_id` and sets `anonymised_at`; the row survives. A seller cannot erase their own reliability history by closing the account.

---

## 16. Claims and evidence export

**`core.claim`** — `order_id`, **`reservation_id NULL` (C8)**, `opened_by_kind`, `opened_by_account_id NULL`, `trigger`, `opened_at`, `review_deadline` (`opened_at + 2 days`), `outcome NULL`, `outcome_reason`, `decided_by`, `decided_at`.

`CHECK ((opened_by_kind = 'BUYER') = (opened_by_account_id IS NOT NULL))` — a system-opened claim has no claimant, and a buyer-opened one must name theirs.

**Which paths set `reservation_id`** — specified in v1.1, because C8 left it ruled but unassigned:

| Path | `reservation_id` |
|---|---|
| §9.4 — seller cancelled a line citing stock that was not current | **Set** to that line |
| §10.5 — refund reported and not acknowledged | **Set** — a refund is per-line |
| §9.2 — fulfilment window elapsed on a paid order | Null — order-level |
| §14 — SLA breach, goods not received, not as described | Null — order-level |
| §16.8 — safety suspension terminating a paid order | Null — order-level |

**Integrity — added in v1.2.** The assignment table above tells code what to write; these two constraints stop it writing something else.

```sql
-- requires UNIQUE (order_id, id) on core.reservation
ALTER TABLE core.claim
  ADD CONSTRAINT claim_line_belongs_to_order
  FOREIGN KEY (order_id, reservation_id)
  REFERENCES core.reservation (order_id, id);

CREATE UNIQUE INDEX claim_one_open_per_scope
  ON core.claim (order_id,
                 coalesce(reservation_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE outcome IS NULL;
```

**INVARIANT — a claim's `reservation_id`, where present, names a line on that claim's own order.** Without the composite FK, nothing stopped a claim citing a line from a different order entirely — and since evidence is attached automatically by claim type (below), the dispute would have been reviewed against the wrong line's stock history.

**INVARIANT — at most one open claim exists per scope.** One per line, plus one order-level, and no second claim at the same scope while the first is undecided.

**The consequence, recorded because it is a behaviour and not just a constraint: a trigger firing against an already-open claim at the same scope appends evidence rather than opening a second claim.** §14's triggers are largely sequential stages of one failure — SLA breach, then goods not received, then refund promised and not delivered — rather than independent disputes. Treating them as separate claims would demote the seller once per stage under §14's unconditional rule, so a single seller failure could cost three levels. One claim, growing its evidence set as the situation develops, is both the correct account of what happened and the only version that does not multiply the penalty.

**`core.claim_evidence_item`** — `claim_id`, `kind`, `reference uuid`, `attached_at`.

**Evidence is attached automatically by claim type** (§14). A trigger on claim insert populates the set. Manual assembly at review time loses the evidence that was current at the moment of the dispute, and the payment screenshot in particular is on a deletion schedule (§13.3) — opening a claim sets `retention_reason = 'OPEN_CLAIM'` on the evidence row in the same transaction, which is what stops the purge job from destroying the only proof.

**INVARIANT — an upheld claim always demotes the seller's level** (§14, §5.2). Trigger, unconditional.

**INVARIANT — deletion never removes evidence relied upon in a resolved claim, and never removes moderation history** (§16.9). No `DELETE` grant on either table.

**`core.evidence_export`** — `claim_id NULL`, `order_id`, `requested_by`, `generated_at`, `object_key`, `expires_at`. §14: Adulis does not file police reports; it produces an export and cooperates with lawful process. **For Phase 2 sellers this export is the buyer's primary recourse and must be fast and complete** — which is why evidence is assembled at claim time rather than at export time.

---

## 17. Chat and the chatbot

### 17.1 `chat` schema — the operational record

**`chat.conversation`** — `seller_id`, `buyer_account_id`, `market_id`, `started_at`, `last_message_at`. Unique together.
**`chat.message`** — `conversation_id`, `sender_kind`, `sender_account_id NULL`, `body`, `locale`, `sent_at`, `read_at`.
**`chat.bot_turn`** — `message_id`, `turn_index`, `resolution_path`, `intent_id NULL`, `confidence`, `model_id NULL`, `tokens_in`, `tokens_cached`, `tokens_out`, `latency_ms`, `escalated`.

**INVARIANT — the model never generates a response. It returns an intent ID** (§15.1). `bot_turn` has an `intent_id` and **no `generated_text` column**. The body sent to the buyer is always rendered from `nlu.answer_template`. There is nowhere to put model-generated prose, so none can be stored or sent.

**Free sellers carry the load manually and the burden must be visible** (§15): `chat.v_seller_chat_burden` — unanswered count, median response time, out-of-hours question count.

### 17.2 `nlu` schema — the identity-stripped library

**`nlu.intent`** — global: `code`, `description`, `created_at`, `retired_at`. Expected inventory 50–70 (§15.1).
**`nlu.intent_phrase`** — `intent_id`, `locale`, `text`, `embedding vector(N)`, `source`. HNSW index for layer 3.
**`nlu.answer_template`** — `intent_id`, `locale`, `seller_id NULL`, `template`, `slots text[]`. **Intents are global; answers are per-seller** (§15.1) — a null `seller_id` is the global default.

⚠ `answer_template.seller_id` is the **one** identifier permitted in `nlu`, and it is a bare uuid with **no foreign key** to `core.seller`. Stated explicitly because it is the obvious place for a well-meaning agent to add a foreign key and quietly join the two stores §15.3 requires separated. Appendix C check 4.

**`nlu.unmatched_phrase`** — `text`, `locale`, `market_id`, `observed_at`. Written by an ETL job from escalated turns with identifiers removed. **No `conversation_id`, no `buyer_id`.**
**`nlu.regression_case`** — `text`, `locale`, `expected_intent_id`, `frozen_at`.
**`nlu.regression_run`** — `ran_at`, `change_reference`, `precision_before`, `precision_after`, `accepted boolean`.

**INVARIANT — a frozen regression set runs before and after every update; a precision drop reverts the change** (§15.3). `regression_case` is append-only with no `UPDATE` grant — a "frozen" set that can be edited to make a run pass is not a regression set.

### 17.3 Metering

**`billing.inference_usage_month`** — `seller_id`, `month date`, `cost_minor`, `cap_minor`, `warned_at_70`, `warned_at_90`.

**INVARIANT — the bot never goes dark. Only layer 4 is metered. At the cap, layers 0–3 continue and everything else escalates** (§15.1). The cascade checks the cap **only before layer 4**. Layers 0–3 have no cap read in their code path, so an outage in the metering table cannot silence the bot.

`cap_minor` = 15% of that seller's tier revenue, computed at month start and stored, so a mid-month tier change does not retroactively move the cap.

---

## 18. Subscriptions and entitlements

### 18.1 `billing.subscription`

`seller_id`, `state`, `tier`, `term`, `beta_started_at`, `beta_ended_at`, `trial_started_at`, `trial_ends_at`, `current_period_start`, `current_period_end`, `locked_rate`, `locked_rate_currency`, `price_schedule_version_id`.

**INVARIANT — `BETA` is a distinct subscription state, not a $0 Listed subscription** (§16.10). It is a value in the state enum, not a tier with a zero price. Beta cohort behaviour is the evidence for every launch decision in ADU-PROJ-01 §12, and it is worthless if it cannot be separated from sellers who chose Free on the merits — so the separation is in the type system, where a query cannot accidentally blend them.

**INVARIANT — the trial is 60 days from each seller's own signup date, never a calendar cutoff** (§16.3).

⚠ **The beta-to-paid transition is open** (§16.10, §25): whether the 60-day trial runs in addition to the beta period or is consumed by it. **The schema is neutral** — four independent columns. Either ruling is a value written at conversion, not a migration. This needs an answer before the first cohort converts, not before it is onboarded.

**`billing.subscription_state_transition`** — append-only.

**INVARIANT — suspension never deletes seller data and never resets trust level** (§16.4). No code path from a subscription state change reaches `seller_level_state` or any catalogue table other than `visibility`. Team logins are **disabled, not deleted**: `seller_team_member.suspended_at` rather than a row removal.

### 18.2 Pricing

**`billing.price_schedule`** — `market_id`, `tier`, `price_minor`, `currency`, `usd_reference_minor`, `fx_rate`, `prepay_quarterly_discount`, `prepay_annual_discount`, `derived_at`, effective range.

**INVARIANT — every market has its own price schedule** (§16.6). No global row.
**INVARIANT — the rate is locked when a paid term begins and holds for that term** (§16.6).
**INVARIANT — the rate used is logged against every subscription record** (§16.6). The version reference is `NOT NULL` on any state carrying a price.

### 18.3 Entitlements

**INVARIANT — entitlements are resolved by a service at read time, never stored as a boolean column** (§16.5).

`billing.tier_definition` (versioned: product cap, chatbot scope, blue tick, broadcast, analytics scope, team, support tier, API) and `core.ladder_config` level unlocks.

```sql
CREATE FUNCTION billing.fn_effective_limit(p_seller_id uuid, p_capability text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  -- the intersection of tier entitlement and trust level (§16.5)
$$;
```

**INVARIANT — the effective limit for any capability is the intersection of tier entitlement and trust level** (§16.5). One function, called by every capability gate. **No table anywhere carries a `has_chatbot` or `can_broadcast` boolean.** Appendix C check 3.

**Broadcast eligibility requires Trusted level as well as Pro tier** (§16.1) — the same intersection. Tier grants the capability; level grants the right to use it.

**INVARIANT — payment never buys a badge or a level** (§13.1). The intersection function reads the level; it never writes it. There is no path in the other direction, by construction.

### 18.4 Beta entitlements

`tier_definition` carries a row for the `BETA` state with §16.10's grid: chatbot on all products, unlimited products, account-control verification free, **no blue tick**, **no broadcasts** (requires Trusted, which no beta seller can have earned), views/reservations/conversion analytics, no team accounts, no data export.

### 18.5 Collection and suspension

**`billing.collection_record`** — `subscription_id`, `amount_minor`, `reminder_sent_at`, `marked_transferred_at`, `reconciled_at`, `reconciled_by`, `provider_kind`, `provider_ref`.

**INVARIANT — the payment collection provider sits behind an adapter interface** (§16.7): `provider_kind` and `provider_ref`, never a provider-specific column.

**No purchase surface exists at MVP** (§16.7) because beta sellers pay nothing. When it arrives it is part of the seller console — ADU-ARCH-01 removes the seller app, so the In-App Purchase machinery that required a distinct session audience has nothing left to keep apart.

**Suspension** (§16.8) — `seller.status` distinguishes `BILLING_SUSPENDED` from `SAFETY_SUSPENDED`, because they must not behave the same way.

**INVARIANT — billing suspension never cancels an active order.** Order functions check `status <> 'SAFETY_SUSPENDED'` for existing-order operations and `status = 'ACTIVE'` for forward-looking ones. A buyer with an order in flight sees no change to that order.

**Safety suspension** writes `moderation_event` with an explicit `active_orders_decision` recorded at the time. Where orders terminate: unpaid orders cancel and release stock; **paid orders open a claim automatically on the buyer's behalf** rather than cancelling (§16.8) — which is why `claim.opened_by_kind` admits `SYSTEM`.

**INVARIANT — moderation reasoning is never disclosed to third parties** (§16.8). `moderation_event.reason` is not readable on any buyer-facing path, and the buyer notification template has no slot for it. The buyer is told what happens next, never why the seller was suspended.

### 18.6 Seller deletion

**INVARIANT — deletion is blocked while any of six obligations is unresolved, and the seller is shown exactly which** (§16.9):

```sql
CREATE FUNCTION core.fn_deletion_blockers(p_seller_id uuid)
RETURNS TABLE (blocker text, count int, resolving_action text) ...
```

Six independent checks — non-terminal reservations, evidence awaiting confirmation, orders confirmed and awaiting handoff, refunds unreported or unacknowledged, open claims, `PAST_DUE` subscription. `fn_delete_seller` raises unless the function returns zero rows. §24 requires each blocker tested independently, which this shape makes possible.

**INVARIANT — for a company seller, only the Owner may initiate deletion** (§16.9). Not Admin, not any other role.

**INVARIANT — deletion requires step-up authentication** (§6.5).

**INVARIANT — a deleted seller's phone number does not become immediately reusable for a new seller account** (§16.9). `core.phone_reuse_block` — `phone_hash bytea`, `blocked_until`, `market_id`. Hashed, not stored in the clear: the block must outlive the account whose personal data was scrubbed.

Effects follow §16.9's table exactly: storefront unpublished then purged on the media lifecycle, identity fields scrubbed, **verification attestation retained and the keyed ID hash surviving**, payout purged, transactional records anonymised, reviews anonymised, team access revoked, courier assignments ended, moderation and audit retained in full.

---

## 19. Follows, feed and broadcasts

**`core.follow`** — `buyer_account_id`, `seller_id`, `state`, `created_at`, `changed_at`, `notification_preference`. `UNIQUE (buyer_account_id, seller_id)`.

**INVARIANT — one canonical follow state. Following, unfollowing and per-seller notification preferences resolve to one server-side relationship regardless of which of the six surfaces initiated it** (§17.1.1). One row, `UNIQUE` on the pair. Six surfaces cannot produce six states because there is one row to write.

**INVARIANT — following is available before purchase, from every surface where a seller is identified** (§17.1). No column references an order. There is no gate to remove later, because none was built.

**Per C4 there is no deferred-follow table.** A web follow intent emits `follow_intent_web` (§20) and nothing else. `follow_intent_web` measured against `follow_created` is the instrument §17.1.1 asks for; if the gap is wide, deferred follow gets rebuilt on that evidence rather than reinstated on assumption.

**Adulis followers are not social-platform followers** (§17.1). `follow` has no relationship to `seller_social_account.follower_count_at_verification`, and no view joins them. A seller with 80,000 social followers begins here with none.

**`core.seller_activity`** — `seller_id`, `kind`, `reference uuid`, `occurred_at`.

**INVARIANT — the following feed contains only sellers the buyer follows. It never introduces a seller the buyer has not followed, by any mechanism** (§17.2). The feed query is a join from `follow` to `seller_activity`, ordered by `occurred_at DESC`. **No ranking table, no score column, no impression log, no candidate generator exists.** The feed is a query, not a recommender — and a recommender cannot be built by accident on a schema with nowhere to store a score.

**`core.broadcast`** — `seller_id`, `kind`, `body_template`, `sent_at`. `fn_send_broadcast` calls `fn_effective_limit(seller_id, 'BROADCAST')`, which is the Pro-or-Business **and** Trusted intersection.

---

## 20. Notifications

**`core.notification`** — `recipient_account_id`, `channel`, `template_key`, `locale`, `slots jsonb`, `order_id NULL`, `suppressible boolean`, `state`, `scheduled_for`, `sent_at`.

**INVARIANT — notification content is selected by order state at send time, not by a single template** (§17.3). The sender re-reads `order.state` immediately before dispatch and picks the template then. A buyer whose payment was confirmed overnight must never receive an expiry warning queued the previous evening.

**INVARIANT — no notification is sent for an order past `PAYMENT_CONFIRMED`** (§17.3, §9.2). The sender's guard is `WHERE o.clock_stopped_at IS NULL`, the same column the expiry job uses. One column governs both, so the two rules cannot drift apart.

**INVARIANT — translated strings are never assembled from concatenated fragments** (§17.3, §23.1). `slots jsonb` plus a whole-sentence template per locale. There is no `prefix`/`suffix` column and no concatenation helper. Word order differs between English and Amharic, and fragment assembly produces text that is grammatically wrong in one of them.

**Two notifications only** (§9.3): the morning after (08:00 EAT) and two hours before expiry. Both name the seller and state the deadline as a **time, never a duration** — a duration is stale the moment it is read from the notification tray, so the slot is a timestamp and the template formats it.

**The in-app fallback is not optional** (§9.3, §17.3). `device.notification_permission = 'DENIED'` routes to `IN_APP` with a persistent badge and countdown on the order card. Android 13 and later let buyers refuse notifications, and a refused permission must not mean a lost order.

---

## 21. Moderation

**`core.content_report`** — `reporter_account_id NULL`, `target_kind`, `target_id`, `reason_code`, `body`, `reported_at`, `resolved_at`.

**Store-mandated, build in V1** (§18): a report mechanism on **every** piece of user content. `target_kind` enumerates all of them; adding a user-content surface without adding its enum value is a compile-time failure in the generated types.

**`core.block`** — `blocker_account_id`, `blocked_account_id`, `created_at`.

**`core.moderation_queue_item`** — `kind`, `target_kind`, `target_id`, `queued_at`, `due_at`, `claimed_by`, `resolved_at`.

`due_at = queued_at + 24 hours` — **action on reported content within 24 hours** (§18) is a column an overdue query can find, not a target in a document.

**`core.moderation_event`** — append-only and immutable: `actor_account_id`, `target_kind`, `target_id`, `decision`, `reason`, `active_orders_decision NULL`, `occurred_at`.

**`core.prohibited_keyword`** — per market, versioned, covering the twelve categories of ADU-00.

---

## 22. Analytics

**`analytics.event_definition`** — `name`, `version int`, `required_keys text[]`, `key_types jsonb`, `introduced_at`, `retired_at`. `UNIQUE (name, version)`.

**INVARIANT — every meaningful action emits a versioned event. A definition change creates a new event version; it never edits an existing one** (§20). `event_definition` is append-only. Changing a definition means inserting `(name, version + 1)`; there is no path that edits version 1, so historical events remain interpretable against the definition they were written under.

**`analytics.event`** — partitioned monthly by `occurred_at`:

| Column | Notes |
|---|---|
| `id`, `name`, `version`, `occurred_at` | FK to `event_definition (name, version)` |
| `market_id`, `seller_type`, `eligibility_path`, `seller_level` | **Real columns, not payload keys** (§20) |
| `actor_account_id NULL`, `seller_id NULL`, `order_id NULL`, `device_id NULL` | |
| `payload jsonb` | Everything else |

**`eligibility_path` is the most important field in this version** (§20). Audience-path and identity-path sellers must be measurable as separate cohorts from the first day of Phase 2 — on churn, conversion, claim rate and first-sale time. That is the evidence for whether dropping the gate worked, and §20 is explicit that it cannot be reconstructed later. It is a column, indexed, `NOT NULL` on every seller-scoped event.

Payload validation without an extension:

```sql
CREATE FUNCTION analytics.fn_validate_event() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE d analytics.event_definition; k text;
BEGIN
  SELECT * INTO d FROM analytics.event_definition
   WHERE name = NEW.name AND version = NEW.version;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unregistered event %/%', NEW.name, NEW.version;
  END IF;
  FOREACH k IN ARRAY d.required_keys LOOP
    IF NOT (NEW.payload ? k) THEN
      RAISE EXCEPTION 'Event %/% missing required key %', NEW.name, NEW.version, k;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
```

An unregistered or malformed event fails at insert rather than arriving as a row nobody can interpret six months later.

All 68 event names in §20, plus the chatbot turn fields, are seeded as version 1 definitions in the first migration. ADU-WEB-01 §12's eight website events use the same registry, but the website writes them to the waitlist store (§25) and they are imported, per C7.

---

## 23. Ledger — custody readiness

**`ledger.transaction`** — `id`, `kind`, `occurred_at`, `reference_kind`, `reference_id`.
**`ledger.entry`** — `transaction_id`, `account_code`, `direction`, `amount_minor`, `currency`, `party_kind`, `party_id`.

**INVARIANT — every payment event writes a ledger entry, recording amount, currency, parties, direction and state, with Adulis's balance at zero** (§22).

**INVARIANT — financial records are append-only** (§22).

Balance enforcement as a deferred constraint trigger, so entries can be inserted in any order within the transaction:

```sql
CREATE CONSTRAINT TRIGGER trg_ledger_balanced
  AFTER INSERT ON ledger.entry
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger.fn_assert_balanced();
```

And the V1 posture, checkable at any moment:

```sql
CREATE VIEW ledger.v_adulis_balance AS
SELECT currency,
       sum(CASE WHEN direction = 'DEBIT' THEN amount_minor ELSE -amount_minor END) AS balance
FROM ledger.entry WHERE account_code LIKE 'ADULIS:%' GROUP BY currency;
```

A scheduled assertion job raises an alert if any row is non-zero. **Adulis holds no buyer money before the licence** (ADU-00 rule 1, ADU-PROJ-01 §7.1) is the most valuable structural feature of the business through V3, and a query that can prove it on demand is worth more than a policy that asserts it. When the licence arrives, custody becomes a change in who holds the balance — and escrow is designed against this ledger, which is why it exists now with every balance at zero.

---

## 24. Scheduled work

graphile-worker in the `jobs` schema. Postgres is the sole datastore, including the queue.

| Job | Cadence | Notes |
|---|---|---|
| `order.expire_sweep` | 1 min | Idempotent (§9.1); skips `clock_stopped_at IS NOT NULL` |
| `notification.send` | 1 min | Re-reads order state at send (§17.3) |
| `notification.morning_reminder` | Daily 08:00 EAT | Per market timezone |
| `stock.confidence_nudge` | Hourly | Levels 1–5, 3-hourly once critical (§13.3) |
| `level.recompute` | On write + nightly sweep | Nightly catches window expiry |
| `financial.purge_payment_evidence` | Hourly | **Scoped to `financial.payment_evidence` by name**, never to the schema — payout credentials share it and must not be purged (§13.3) |
| `media.lifecycle` | Daily | §7.4 |
| `subscription.warn` | Daily | 14, 3, 1 day (§16.3) |
| `subscription.collect_reminder` | Per schedule | SMS (§16.7) |
| `waitlist.retention_purge` | Daily | 12 months (§25) |
| `nlu.harvest_unmatched` | Daily | Identity-stripped ETL (§15.3) |
| `analytics.create_partition` | Monthly | |
| `ledger.assert_zero` | Hourly | §23 |
| `social_post.availability_check` | Daily | §9.6 |
| `buyer_cooldown.decay` | Daily | 30-day decay (§9.5) |
| `idempotency.purge_expired` | Hourly | §12.8 — 24-hour records |
| `rate_limit.purge_stale` | Hourly | §12.9 — buckets older than the widest window |
| `order.close_confirmation_window` | 1 min | Cancels, releases stock and opens a claim when the 24h or 12h window ends (§12.4) |
| `notification.push_seller` | 1 min | Native push to the seller's registered devices (§6.4) |
| `device.purge_unbound` | Daily | C6 — unbound devices and their carts |

**INVARIANT — every job is idempotent.** Not a convention: each is either guarded by a partial unique index on its effect, or written as a compare-and-set on a state column. A job that runs twice must produce what one run produced, because at-least-once delivery is what the queue guarantees.

---

## 25. The waitlist store (separate, per C7)

Deployed with the website, independently of product infrastructure.

**`waitlist.application`** — `reference_code`, `full_name`, `phone_e164`, `primary_platform`, `primary_handle`, `secondary_platform NULL`, `secondary_handle NULL`, `follower_count_self_reported int NULL`, `sells_what`, `city`, `consent_at`, `consent_text_version`, `submitted_at`, `purge_after`, `reviewed_by NULL`, `reviewed_at NULL`, `outcome NULL`.

**INVARIANT — `follower_count_self_reported` is optional and never validated against a threshold** (ADU-WEB-01 §7.1). No `CHECK`, no `NOT NULL`, and no rejection path exists in the schema — there is no `outcome = 'REJECTED_ON_FOLLOWERS'` value to write. Every applicant is accepted onto the list.

**Platform is an enum, not free text** (ADU-WEB-01 §7.1), because eligibility depends on it and a typed platform name cannot be joined to anything later.

**Two handles are captured** because a seller on both platforms is assessed on their **highest single account, never the sum** (§4.1). Capturing both is what makes that comparison possible.

**INVARIANT — `purge_after = submitted_at + 12 months`, written as a column, not applied by a job's hard-coded interval.** ADU-WEB-01 §7.3 requires the consent line, the privacy notice and the implementation to state the same number. A column makes the implemented number readable in one query by anyone checking that the three agree.

⚠ **The DPIA must cover this table before the first submission** (ADU-PROJ-01 §14, ADU-WEB-01 §7.3). It is the earliest hard external gate in the project and it lands before any product table exists.

**Import path.** At cohort onboarding the application row is read once to pre-fill the seller record, and `follower_count_self_reported` is written to `core.seller.waitlist_follower_claim` — **a distinct column from `seller_social_account.follower_count_at_verification`.** Self-reported and verified counts are never blended, because the difference between them is itself a signal, and because ADU-PROJ-01 §12's follower-count evidence gate depends on the verified number alone.

---

## 26. Invariant enforcement matrix

Every PRD invariant, the mechanism, and where it is checkable. Abbreviated to the mechanisms that are not simple `NOT NULL` or FK.

| PRD | Invariant | Mechanism | §here |
|---|---|---|---|
| §3 | iOS app has no seller functionality | No enum value for an iOS seller session audience | 6.6 |
| §3.0 | No web sign-in at MVP | Deletion OTP purpose cannot issue a session — trigger | 6.5 |
| §4.1 | Eligibility from per-market config; Phase 2 needs no code change | `eligibility_config` versioned rows + `fn_evaluate_eligibility` | 5.3, 7.4 |
| §4.1 | Threshold is a config record with a null-permitted value | Nullable column, no sentinel | 5.3 |
| §4.2 | Identity path holds a full attestation before first listing | Readiness function, no provisional state | 7.4 |
| §4.3 | ID verification always attests a natural person | Table keyed on `person_id`, no `seller_id` | 7.3 |
| §4.4 | Keyed ID hash once per person, referenced by each account | `person.id_hash` UNIQUE; `person` never deleted | 6.2 |
| §4.6 | Readiness computed server-side as one resolved state | Single function returning all items | 9.4 |
| §5.1 | Level never manual, never purchasable, never tier-affected | No UPDATE grant; function references no billing table | 8.1 |
| §5.1 | Level entered on eligibility (C5) | Trigger on eligibility evaluation, `ON CONFLICT DO NOTHING` | 8.1 |
| §5.2 | Scanned handoff counts only from a distinct buyer | `counts_toward_level` written by trigger | 8.2 |
| §5.2, §14 | Upheld claim always demotes | Unconditional trigger | 8.2, 16 |
| §6.2 | Seller bound to one phone number | `account.phone_e164` UNIQUE + FK | 6.1 |
| §6.4 | Revocation immediate, not at token refresh | Session row read per request | 6.6 |
| §6.4 | New-device sign-in notifies, not suppressible | Insert trigger enqueues with `suppressible = false` | 6.6 |
| §6.5 | Six actions require fresh step-up, incl. direct API calls | `step_up_challenge_id` as a function parameter | 6.7 |
| §6.6 | Payout locked for cooling period after recovery | `payout_locked_until` written in the approval transaction | 6.8 |
| §7 | Stock never mutated without a StockEvent | `stock_count` derived; guard trigger | 10.1 |
| §7 | Price is the variant's (C1) | `variant.price_minor`; `base_price` read only at variant creation | 9.2, 9.3 |
| §7.4 | Originals resized and discarded | No `original_key` column | 9.5 |
| §7.4 | No server-side transcoding in V1 | No rendition table | 9.5 |
| §7.5 | Storefront search scope is exactly one seller | Function signature takes `seller_id`; no cross-seller path | 9.6 |
| §7.5.1 | One post link, many products | Join table | 9.6 |
| §7.5.1 | A pasted link resolves only within the tagging seller | Conflict returns nothing + moderation flag | 9.6 |
| §7.6 | Lookup returns sellers, never products | Function return type is `core.seller` | 9.6 |
| §8.1 | Cart holds one seller, enforced on add | Composite FK, anonymous-safe via `device_id` (C6) | 11.2 |
| §8.2 | Cart has no effect on stock | No trigger writes `stock_event` | 11.2 |
| §8.3 | Whole cart revalidated in the order transaction | One function, one transaction | 12.3 |
| §8.4 | Price captured and immutable | Write-once trigger | 12.1 |
| §8.5 | Payout captured onto the order and immutable | `order_payout_snapshot`, write-once | 13.5 |
| §8.5 | Reissue logged, single-order, step-up | Append-only table, no bulk signature | 13.5 |
| §9.1 | Duplicate live reservations structurally impossible | `EXCLUDE USING gist` | 12.1 |
| §9.1 | Stock release on expiry idempotent | Partial unique index on `(order_id, reason)` | 12.4 |
| §9.1 | Two state machines, order terminal derived (C2) | Two legal tables + fail-closed guard triggers | 12.2 |
| §9.1 | The legal set cannot widen at runtime | Legal tables writable only by `adulis_migrate` | 12.2 |
| §9.1 | No market goes live on an unratified state machine | `fn_guard_market_live` on `market.is_live` | 12.2.1 |
| §14 | A claim's line belongs to the claim's order (C8) | Composite FK `claim_line_belongs_to_order` | 16 |
| §14 | One open claim per scope; stages append evidence (C8) | Partial unique index `claim_one_open_per_scope` | 16 |
| §9.2 | Clock stops permanently at `PAYMENT_CONFIRMED` | `CHECK` + absent transitions | 12.4 |
| §9.4 | Cancellation/refund/release at line level | Reservation-scoped tables and rate views | 12.5 |
| §10.3 | Every evidence access logged, any actor | Only read path is a logging function | 13.3 |
| §10.4 | Only Owner/Admin may view or change payout | `role_permission` + first-statement check | 13.4 |
| §10.4 | Masking scoped; one logged disclosure path (C3) | `financial` schema, own role, one function, shared access log | 13.6 |
| §10.4 | No unlogged decryption path can be added quietly | No `account_ciphertext` column exists in `core` at all | 13.6 |
| §10.3, §10.4 | One query answers who saw a bank account number | Both secrets share `financial.access_log` | 13.6 |
| §10.4 | Activation delay; previous details remain in effect | Partial unique index on one `ACTIVE` row | 13.4 |
| §10.4 | Payout change notifies, not suppressible | Trigger + `WHERE suppressible` in sender | 13.4 |
| §11.2 | Event A never completes, levels or enables review | Separate table; no trigger reaches those tables | 14.1 |
| §11.2 | A courier can never perform the buyer's scan | Composite FK to `(id, buyer_account_id)` | 14.2 |
| §11.3 | Only a scanned handoff counts toward level | Recompute reads `handoff_scan` only | 14.3 |
| §11.4 | Signed timestamp governs **completion**; replay always rejected | Validity trigger; `nonce` UNIQUE | 14.2 |
| §11.4 | Server `received_at` governs **level credit** (A5) | Trigger tests `received_at` against window + `level_credit_grace` | 14.2 |
| §8.3 | A retried write does not create a second order | `idempotency_record`, unique on `(key, actor, endpoint)` | 12.8 |
| §23 | Rate limiting on auth, OTP, reservation, claim | `rate_limit_bucket`; phone keyed by hash | 12.9 |
| §11.4 | Never re-decrement on late sync | Reconciliation event with `delta = 0` | 14.2 |
| §12 | A seller can never prevent a review publishing | No seller-writable column on `review` | 15 |
| §13.1 | No identity image ever uploaded | No column exists | 7.3 |
| §13.1 | KYC vendor behind a vendor-agnostic interface | `verifier_kind` + `vendor_reference` | 7.3 |
| §13.2 | Never publishes an accusation | `seller_public_stats` has no text column | 8.3 |
| §15.1 | The model never generates a response | `bot_turn` has no generated-text column | 17.1 |
| §15.1 | The bot never goes dark | Cap read only before layer 4 | 17.3 |
| §15.3 | Two stores, separated | `nlu` holds no FK to `chat` or `core` | 3, 17.2 |
| §16.2 | RBAC server-side on every endpoint | `fn_has_permission` as first statement | 6.9 |
| §16.5 | Entitlements resolved at read time | No boolean entitlement column anywhere | 18.3 |
| §16.5 | Effective limit is tier ∩ level | Single intersection function | 18.3 |
| §16.10 | `BETA` is a distinct state | Enum value, not a $0 tier | 18.1 |
| §17.1.1 | One canonical follow state; no deferred follow (C4) | `UNIQUE (buyer, seller)`; no token table | 19 |
| §17.2 | Feed never introduces an unfollowed seller | No score, ranking or candidate table | 19 |
| §17.3 | Content selected by order state at send time | Template resolved at dispatch | 20 |
| §19 | New market by configuration, not code | Every dimension is a versioned config row | 5.3 |
| §20 | Every action emits a versioned event | `event_definition` append-only; validation trigger | 22 |
| §22 | Ledger append-only, Adulis balance zero | Deferred balance trigger + assertion view | 23 |
| §23.1 | Strings never assembled from fragments | `slots jsonb`, whole-sentence templates | 20 |

---

## 27. Indexing and performance

The binding constraint is **first paint of a web storefront on a low-end Android over a slow connection** (§23). That makes the storefront read path the only query set tuned in advance; everything else is tuned against measurement.

**Storefront path** — one query, no N+1:
- `product (seller_id, visibility, display_order)` covering index
- `product_variant (product_id)` with `INCLUDE (stock_count, stock_confirmed_at, price_minor)`
- `seller_public_stats (seller_id)` — materialized, so level and handoff count cost one lookup rather than an aggregate over `handoff_scan`

**Search** — `pg_trgm` GIN on `product.name`, `seller.store_name`, `seller.handle`.
**Cascade layer 3** — HNSW on `nlu.intent_phrase.embedding`, per locale.
**Hot writes** — `stock_event (variant_id, occurred_at DESC)`; `analytics.event` partitioned monthly with a BRIN on `occurred_at`.
**Expiry sweep** — partial index `ON core."order" (expires_at) WHERE clock_stopped_at IS NULL`.
**Session read** — primary-key lookup per authenticated request (§6.6). Budgeted, not accidental.

**Target infrastructure cost is under USD 50/month at 1,000 sellers** (ADU-PROJ-01 §10). A single managed Postgres carries this comfortably; the materialized stats table exists so that the storefront read never becomes the reason it does not.

---

## 28. Migration order

Fourteen migrations, each independently reviewable. Ordering matters because the composite foreign keys in later migrations depend on the unique keys in earlier ones.

1. Extensions, roles, schemas, domains, **all enum types (Appendix A)**, shared trigger functions
2. Markets and all configuration tables
3. Accounts, persons, devices, OTP, sessions, step-up, recovery
4. `verification` schema and its functions
5. Sellers, social accounts, team, courier, eligibility, ladder-entry trigger
6. Categories, attributes, products, variants, media, social posts
7. Stock events and the derived-count triggers
8. Trust ladder, level events, anti-gaming, public stats
9. Cart, orders, reservations, **both legal tables seeded unratified, both guards, and `fn_guard_market_live`**, order functions
10. **`financial` schema** — payment evidence, payout credential, shared access log; payment submissions, payout details, snapshots
11. Handoff, custody transfer, confirmation tiers
12. Reviews, claims, evidence export
13. `chat` and `nlu` schemas
14. `billing`, `ledger`, `analytics`, moderation, notifications, follows, jobs
15. **Transport tables** — `idempotency_record`, `rate_limit_bucket`, and their purge jobs (§12.8, §12.9)

**Migrations 7 and 9 are the two to review by hand.** Migration 7's stock triggers are the concurrency-critical path ADU-PROJ-01 §13.5 flags. Migration 9's state machine is where a wrong transition silently turns a paid order into an expired one. Everywhere else, a mistake raises an exception; in those two, it produces wrong data.

---

## 29. Corrections required in other documents

The schema is unblocked. What remains is write-back: six corrections so that ADU-PRD-01 and ADU-00 stop saying things that cannot be built.

| # | Document | Correction | Why it matters |
|---|---|---|---|
| **W1** | ADU-PRD-01 §10.4 | Scope the masking invariant to seller, team, support and admin surfaces; state the single logged buyer-disclosure path (C3) | **Highest priority.** As written, an engineer building from the PRD alone builds a product that cannot take a payment |
| **W2** | ADU-PRD-01 §7, §8.4 | State that price is a variant attribute; `product.base_price` is a seed (C1) | Prevents a per-product pricing implementation that would need migrating through live orders |
| **W3** | ADU-PRD-01 §8.1, §9.1 | Replace the single lifecycle diagram with the two machines and their transitions (C2) | §9.1 as drawn cannot be implemented; §12.2 here is the replacement |
| **W4** | ADU-PRD-01 §24 | Strike the deferred-follow test line (C4) | A required test for a mechanism §17.1.1 removed |
| **W5** | ADU-00 trust ladder · ADU-PROJ-01 §3.3 | `New` is earned by eligibility satisfied, not by ID verified (C5) | As written, the entire Phase 1 cohort holds no level and the ladder accumulates nothing |
| **W6** | ADU-PRD-01 §10.1 | State the state a rejected payment returns the order to (`NOTIFIED`) | §12.2's rejection path is currently an inference this document had to make |
| **W7** | ADU-PRD-01 §14 | First claim trigger reads *"payment confirmed with no seller response within SLA."* The §10.2 SLA is the **confirmation** SLA, so this must mean payment **submitted** | Determines whether R-2's expiry auto-opens a claim. As written the trigger describes a state in which the SLA has already been met |
| **W8** | ADU-PRD-01 §9.1 | `EXPIRED_UNCLAIMED` is listed as terminal but §11.4 requires a late in-window scan to complete such an order | R-1. Two sections of the PRD currently contradict each other on whether the state is terminal |
| **W9** | ADU-PRD-01 §23 | Isolated boundaries are named as `verification` and `payment_evidence`. The second is renamed **`financial`** and now also holds the payout ciphertext | A boundary named in the PRD under a name the schema does not use is the drift §13.5 warns about |
| **W10** | ADU-PRD-01 §5.2 | Anti-gaming limits how often one buyer can advance one seller, and says nothing about *when* they may claim the handoff occurred | The clock residual belongs where the anti-gaming rules are, as a known limit |
| **W11** | ADU-PRD-01 §11.4 | An in-window late scan *"counts toward trust level, even if the server had already expired it."* Under §14.2 it always completes the order, and counts toward level only inside `level_credit_grace` | A5. The PRD currently makes a promise the ladder cannot safely keep |

**Two cross-document items, unchanged from v1.0 and still open:**

- **Hosting criteria.** ADU-PROJ-01 §10's hosting decision must include `pgvector` and `btree_gist` availability. Without the first the chatbot cascade has no layer 3; without the second §9.1's duplicate-reservation invariant has no implementation.
- **Stock confidence level 3.** §13.3's level-3 consequence assumes a chatbot the Free tier does not have. Not a contradiction, but the seller-facing copy should not promise it.

**Three PRD open items this schema does not block on**, recorded so they are not re-litigated during build: trust ladder thresholds, New-level caps, and fulfilment window length are `core.ladder_config` / `core.timing_config` values. They ship at defaults and are set by an `INSERT` when the beta produces the numbers.

---

## Appendix A — Enum catalogue

54 types. All created in migration 1, so no later migration invents a value.

**`core`**

| Type | Values |
|---|---|
| `market_phase` | `PHASE_1`, `PHASE_2` |
| `platform` | `TIKTOK`, `INSTAGRAM` |
| `account_status` | `ACTIVE`, `SUSPENDED`, `SCRUBBED` |
| `device_platform` | `ANDROID`, `IOS` |
| `notification_permission` | `GRANTED`, `DENIED`, `NOT_ASKED` |
| `otp_purpose` | `SIGN_IN`, `STEP_UP`, `ACCOUNT_DELETION`, `RECOVERY` |
| `session_audience` | `MOBILE`, `SELLER_WEB`, `COURIER_WEB` |
| `step_up_action` | `PAYOUT_CHANGE`, `REISSUE_INSTRUCTIONS`, `TEAM_CHANGE`, `SUBSCRIPTION_CHANGE`, `SELLER_DELETION`, `REVOKE_ALL_SESSIONS` |
| `recovery_decision` | `APPROVED`, `REJECTED` |
| `team_role` | `OWNER`, `ADMIN`, `SALES_SUPPORT`, `INVENTORY`, `ANALYST`, `CAMPAIGN_MANAGER` |
| `seller_entity_type` | `INDIVIDUAL`, `COMPANY` |
| `seller_status` | `DRAFT`, `ACTIVE`, `CLOSING`, `BILLING_SUSPENDED`, `SAFETY_SUSPENDED`, `DELETED` |
| `social_verification_status` | `PENDING`, `VERIFIED`, `REVOKED` |
| `follower_count_source` | `PLATFORM_FETCH`, `MANUAL_FALLBACK` |
| `eligibility_path` | `AUDIENCE`, `IDENTITY` |
| `eligibility_outcome` | `SATISFIED`, `NOT_SATISFIED` |
| `id_verification_requirement` | `OPTIONAL`, `MANDATORY_WITHOUT_AUDIENCE`, `MANDATORY_ALL` |
| `threshold_basis` | `HIGHEST_SINGLE` |
| `trust_level` | `NEW`, `ESTABLISHED`, `TRUSTED` |
| `level_change_source` | `COMPUTED`, `MODERATION` |
| `attribute_data_type` | `TEXT`, `NUMBER`, `ENUM`, `BOOLEAN` |
| `idempotency_actor_kind` | `ACCOUNT`, `DEVICE` |
| `rate_limit_subject_kind` | `ACCOUNT`, `DEVICE`, `PHONE_HASH`, `IP_HASH` |
| `product_visibility` | `DRAFT`, `PUBLISHED`, `UNPUBLISHED` |
| `unpublished_reason` | `SELLER`, `TIER_DOWNGRADE`, `LEVEL_DOWNGRADE`, `MODERATION` |
| `media_class` | `HOT`, `INFREQUENT` |
| `social_post_status` | `LIVE`, `UNAVAILABLE`, `UNKNOWN` |
| `stock_event_reason` | `SELLER_SET`, `ORDER_CREATED`, `ORDER_EXPIRED`, `LINE_CANCELLED`, `RECONCILIATION`, `RESTOCK` |
| `cart_status` | `ACTIVE`, `CONVERTED`, `ABANDONED` |
| `order_state` | `CREATED`, `NOTIFIED`, `PAYMENT_SUBMITTED`, `PAYMENT_CONFIRMED`, `HANDED_OFF`, `COMPLETED`, `CANCELLED_BY_BUYER`, `CANCELLED_BY_SELLER`, `EXPIRED_UNCLAIMED` |
| `reservation_state` | `ACTIVE`, `FULFILLED`, `CANCELLED_BY_BUYER`, `CANCELLED_BY_SELLER`, `REFUNDED`, `EXPIRED` |
| `cancelled_by` | `BUYER`, `SELLER`, `SYSTEM` |
| `payment_submission_state` | `SUBMITTED`, `CONFIRMED`, `REJECTED` |
| `payout_state` | `PENDING`, `ACTIVE`, `CANCELLED`, `SUPERSEDED` |
| `scan_validity` | `VALID`, `LATE`, `REJECTED_REPLAY`, `REJECTED_HORIZON` |
| `confirmation_tier` | `VERIFIED_HANDOFF`, `CONFIRMED_BY_BUYER`, `UNCONFIRMED` |
| `review_badge` | `CLAIM_UPHELD`, `VERIFIED_HANDOFF`, `CONFIRMED_BY_BUYER`, `UNVERIFIED` — in descending weight |
| `claim_opener_kind` | `BUYER`, `SYSTEM`, `MODERATION` |
| `claim_trigger` | `SLA_BREACH`, `STOCK_NOT_UPDATED`, `GOODS_NOT_RECEIVED`, `NOT_AS_DESCRIBED`, `REFUND_NOT_DELIVERED` |
| `claim_outcome` | `UPHELD`, `NOT_UPHELD` |
| `claim_evidence_kind` | `CHAT_HISTORY`, `SCAN_RECORD`, `PAYMENT_EVIDENCE`, `BANK_RECORD`, `STOCK_EVENTS`, `ORDER_TRANSITIONS`, `SELLER_LEVEL_AT_ORDER`, `ACTING_TEAM_MEMBER` |
| `follow_state` | `FOLLOWING`, `UNFOLLOWED` |
| `seller_activity_kind` | `NEW_PRODUCT`, `RESTOCK`, `BROADCAST`, `STOREFRONT_UPDATE` |
| `broadcast_kind` | `RESTOCK`, `DISCOUNT` |
| `notification_channel` | `PUSH`, `SMS`, `IN_APP` |
| `actor_channel` | `WEB`, `MOBILE`, `SYSTEM` |
| `claim_state` | `AWAITING_BUYER_EVIDENCE`, `AWAITING_SELLER_EVIDENCE`, `AWAITING_BANK_TRACE`, `UNDER_REVIEW`, `RESOLVED` |
| `claim_severity` | `ORDINARY`, `PAYMENT_FRAUD` |
| `claim_remedy` | `REFUND`, `FULFIL`, `NONE` |
| `notification_state` | `QUEUED`, `SENT`, `DELIVERED`, `FAILED`, `SUPPRESSED` |
| `report_target_kind` | `PRODUCT`, `REVIEW`, `MESSAGE`, `SELLER`, `STOREFRONT` |
| `moderation_queue_kind` | `PROHIBITED_KEYWORD`, `NEW_SELLER`, `NEW_LEVEL_FIRST_LISTING`, `SENSITIVE_CATEGORY`, `POST_LINK_CONFLICT`, `DOUBLE_ALLOCATION`, `REPORT`, `VELOCITY` |
| `active_orders_decision` | `CONTINUE`, `TERMINATE` |

**Other schemas**

| Type | Values |
|---|---|
| `verification.verifier_kind` | `KYC_VENDOR`, `VIDEO_CALL` |
| `financial.retention_reason` | `AWAITING_VALIDATION`, `OPEN_CLAIM` |
| `financial.secret_subject_kind` | `PAYMENT_EVIDENCE`, `PAYOUT_CREDENTIAL` |
| `chat.message_sender_kind` | `BUYER`, `SELLER`, `TEAM_MEMBER`, `BOT` |
| `chat.resolution_path` | `STRUCTURE`, `CHIP`, `KEYWORD`, `EMBEDDING`, `CLASSIFIER`, `ESCALATED` |
| `nlu.phrase_source` | `SEED`, `HARVESTED` |
| `billing.subscription_state` | `BETA`, `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELLED` |
| `billing.subscription_tier` | `LISTED`, `ASSISTED`, `VERIFIED_PRO`, `BUSINESS` |
| `billing.subscription_term` | `MONTHLY`, `QUARTERLY`, `ANNUAL` |
| `ledger.entry_direction` | `DEBIT`, `CREDIT` |
| `waitlist.platform` | `TIKTOK`, `INSTAGRAM` |

**`chat.resolution_path` mirrors the six cascade layers of §15.1 exactly**, so containment is a `GROUP BY` rather than a derivation, and a seventh layer cannot appear in the data without appearing in a migration.

---

## Appendix B — Table manifest

105 tables. **A migration set producing a different count is wrong somewhere**, and finding out which is faster than reading every line. AO = append-only.

**`core` — 80**

`market` · `market_phase_gate` · `eligibility_config` · `ladder_config` · `timing_config` · `locale_pack` · `identity_config` · `legal_config` · `account` · `person` · `buyer_profile` · `device` · `otp_challenge` · `session` · `step_up_challenge` · `account_recovery_case`ᴬᴼ · `seller` · `seller_company_detail` · `seller_team_member` · `role_permission` · `seller_courier` · `order_courier_assignment` · `seller_social_account` · `account_control_challenge` · `seller_eligibility_evaluation`ᴬᴼ · `seller_level_state` · `seller_level_event`ᴬᴼ · `level_velocity_flag` · `buyer_seller_pair_signal` · `seller_public_stats` · `category` · `attribute_definition` · `attribute_option` · `product` · `product_attribute_value` · `product_variant` · `variant_attribute_value` · `product_image` · `product_video` · `media_lifecycle` · `social_post` · `product_social_post` · `stock_event`ᴬᴼ · `cart` · `cart_line` · `order` · `order_state_transition`ᴬᴼ · `order_state_transition_legal` · `reservation_state_transition_legal` · `reservation` · `buyer_cancellation_counter` · `seller_availability` · `payment_submission` · `payout_details` · `payout_change_log`ᴬᴼ · `order_payout_snapshot` · `payment_instruction_reissue`ᴬᴼ · `refund` · `order_qr_token` · `courier_custody_transfer` · `handoff_scan`ᴬᴼ · `order_confirmation` · `review` · `review_item_rating` · `claim` · `claim_evidence_item`ᴬᴼ · `evidence_export` · `follow` · `seller_activity` · `broadcast` · `notification` · `content_report` · `block` · `moderation_queue_item` · `moderation_event`ᴬᴼ · `prohibited_keyword` · `phone_reuse_block` · `idempotency_record` · `rate_limit_bucket` · `permission`

**`verification` — 2** · `identity_attestation` · `access_log`ᴬᴼ
**`financial` — 3** · `payment_evidence` · `payout_credential` · `access_log`ᴬᴼ
**`chat` — 3** · `conversation` · `message` · `bot_turn`ᴬᴼ
**`nlu` — 6** · `intent` · `intent_phrase` · `answer_template` · `unmatched_phrase`ᴬᴼ · `regression_case`ᴬᴼ · `regression_run`ᴬᴼ
**`billing` — 6** · `subscription` · `subscription_state_transition`ᴬᴼ · `price_schedule` · `tier_definition` · `collection_record` · `inference_usage_month`
**`ledger` — 2** · `transaction`ᴬᴼ · `entry`ᴬᴼ
**`analytics` — 2** · `event_definition`ᴬᴼ · `event`ᴬᴼ (monthly partitions)
**`waitlist` — 1** · `application`

**21 append-only tables.** Every one carries both the trigger and the `REVOKE` (§4). Appendix C check 5.

⚠ **This figure read 16 in v1.1 and v1.2 and was wrong both times** — the manifest marked 22. Check 5 compares it against the trigger and `REVOKE` counts, so a wrong number here disarms the check that verifies every append-only table is actually append-only. Recount it whenever the manifest changes; it is not decorative.

---

## Appendix C — Migration review checklist

Twelve checks a reviewer can run against generated DDL without reading it line by line. Each corresponds to an invariant that is enforced by an **absence** — the failure mode where an agent "completes" the schema and silently removes a guarantee. Run these before reviewing anything else.

| # | Check | Expected | Guards |
|---|---|---|---|
| 1 | `grep -ci "original_key\|image_url\|photo_url" migrations/` | **0** | No identity or product original is ever stored (§7.3, §9.5) |
| 2 | `grep -i "generated_text\|response_text" chat migration` | **0 in `bot_turn`** | The model never generates a response (§17.1) |
| 3 | `grep -iE "has_chatbot\|can_broadcast\|is_pro\|blue_tick +bool"` | **0** | Entitlements resolved at read time, never stored (§18.3) |
| 4 | `grep -E "REFERENCES (core\|chat)\." nlu migration` | **0** | The two stores stay separated (§17.2) |
| 5 | Count `trg_append_only` triggers; count `REVOKE UPDATE, DELETE` | **21 each**, same tables | Append-only means the grant says so (§4, Appendix B) |
| 6 | `grep -iE "score\|rank\|weight\|affinity" feed and follow migration` | **0** | The feed is a query, not a recommender (§19) |
| 7 | `grep "EXCLUDE USING gist" migrations/` | **≥ 8** — one per config table, one on `reservation`. Availability is no longer versioned | Duplicate reservations impossible; configs never overlap (§4, §12.1) |
| 8 | `grep "fn_guard_stock_count\|fn_apply_stock_event"` | **Both present, both attached** | Stock never moves without an event (§10.1) |
| 9 | Composite FKs present, by name | `cart_line_variant_seller`, `cart_line_single_seller`, `handoff_scanned_by_buyer`, `review_by_order_buyer` | Cross-seller and cross-buyer errors are structurally impossible |
| 10 | `grep -E "GRANT .* ON SCHEMA (verification\|financial) .* adulis_app"` | **0** | Two isolated boundaries readable only through logging functions (§7.3, §13.6) |
| 11 | `grep -c "account_ciphertext" core migrations` | **0** | The column exists only in `financial` (§13.6) |
| 12 | `grep -E "(INSERT\|UPDATE\|DELETE).*_state_transition_legal.*adulis_app"` | **0** | The state machine cannot widen at runtime (§12.2) |
| 13 | `grep "fn_guard_market_live"` | **Present and attached to `core.market`** | No live market on an unratified machine (§12.2.1) |
| 14 | `SELECT count(*) FROM information_schema.tables WHERE table_schema IN (...)` | **105** | Manifest agreement (Appendix B) |

**Check 14 is the cheapest and catches the most.** A count that is high means something was invented; a count that is low means something was skipped. Either way it is one query, and it runs before anyone reads a migration.

**One check that is not a `grep`, and belongs to the reviewer rather than the agent:**

```sql
SELECT from_state, to_state FROM core.order_state_transition_legal WHERE ratified_at IS NULL
UNION ALL
SELECT from_state::text, to_state::text FROM core.reservation_state_transition_legal WHERE ratified_at IS NULL;
```

Twenty-four rows until §12.2.1 is reviewed, zero afterwards. It is the only outstanding item in this document that a query can report on, which is the point of having built it that way.

---

*Binding data model. Drawn from ADU-PRD-01 v8.5, ADU-ARCH-01 v1.0 and ADU-XREF-01 v1.5, with the eight rulings of 24 August 2026 recorded in §1 and eleven write-backs in §29. One item remains open and is fail-closed until it is settled: the 24-row transition set in §12.2.1, which blocks no build work and blocks every live market. The API contract, ADU-API-01, is drawn from this document: every endpoint maps to one of the named functions above, and no endpoint writes a table directly where a function exists.*
