# ADU-VAL-01 -- Deferred Value Decisions Register

**Version:** 1.1 - **Baseline date:** 28 August 2026
**Owner:** Founder / CEO
**Supersedes:** ADU-VAL-01 v1.0
**Status:** Working register. **Not binding as a specification** -- nothing here is a rule about how the system behaves. **S1.1 is machine-read**, and that part is enforced.
**Encoding:** ASCII.

---

## 0. How to use this

**The problem it solves.** Values were scattered across eight documents in three states -- decided with a number, decided as "ship at a default", and genuinely open -- and no document said which was which.

| State | Meaning |
|---|---|
| **OPEN** | No value exists. Something is blocked, or will be |
| **DEFAULT** | A value exists and ships; reasoned, not measured. Tune later, no rework |
| **SET** | Decided, in a document, with a number. Listed so nobody re-opens it |

**A column is a schema decision; a value is a business decision.** Almost everything here is a value in a configuration row, and configuration rows are `INSERT`s. **Nothing in S2, S3 or S4 blocks a migration.**

### 0.1 What changed in v1.1

| # | Change |
|---|---|
| **S1.1 is new, and it is the point of this revision** | Every OPEN value is now named by **exact schema, table and column**. v1.0 named concepts, and a concept cannot be compared against `information_schema` |
| **The nullability rule** | ADU-RUL-02: **a column whose value is deferred must be nullable, and its consumer fails closed on NULL** -- S0.2 |
| **Six values move to SET** | ADU-RUL-01 closed them: the two NEW-exit arms, the product cap, the transaction cap, and G1.5's four intervals |
| **D-05 promoted to S1** | The embedding dimension is now the chatbot's blocking decision |
| **Four new OPEN entries** from the register | D-08, D-09, D-20, and D-05 |
| **S5 updated** | Six of the seven measurement items are **measured**. One is not, and it is the one that matters |

### 0.2 The rule this revision exists to make enforceable

> **A `NOT NULL` column holding a value this register marks OPEN is not a deferral. It is a forced invention with a later deadline.**

For four work orders, every deferred threshold on `core.ladder_config` was `NOT NULL` (D-61). Three consequences, none of which raised anything:

- ADU-DB-01 S12.3's *"the column is NULL and the check does not fire"* **could not be expressed at all.**
- ADU-RUL-01 A1.3's mechanism was **false**: TRUSTED was stated unreachable *because* `trusted_*` stay NULL, and a market seed had to supply all four.
- The `coalesce(..., false)` fail-closed guards were guarding against a value the schema forbade. **Decorative, and they read as careful.**

**The ladder was inert only because no `ladder_config` row existed, and that protection ends the day a market is configured.**

> **RULING (ADU-RUL-02) -- every column in S1.1 is nullable, and its consumer fails closed on NULL.** Otherwise the schema requires the build to break the standing rule that forbids inventing a value this register defers.

### 0.3 How S1.1 is checked

**Three forms, one source, and something compares them** -- the S16.6 pattern that caught the collapsed permission matrix.

1. **S1.1's table** -- for a human.
2. **`db/checks/fixtures/deferred-values.json`** -- for a machine, generated from S1.1.
3. **A comparator** asserting the two agree, both directions, like `verify:permission-doc`.
4. **A gate** asserting **every column in the fixture is nullable in the live schema.**

[!] **S1.1's column list is derived from the documents and has not yet been reconciled against the schema.** On the gate's first run, **where the list and `information_schema` disagree, the schema wins** and the difference is a register entry. This document has been wrong about its own schema three times (D-58, D-59, D-60); asserting otherwise here would be the fourth.

**The reverse direction cannot be automated.** Nothing intrinsic marks a column as deferred, so *"a nullable config column absent from this list"* is a **review question at each reissue**, not a check. That is the gap D-59 fell through and it stays open honestly rather than being papered over.

---

## 1. Blocking -- decide before the market seed

### 1.1 The OPEN columns, by name

**This table is the machine-read part of this document.**

| # | Schema.table | Column | Type | Group |
|---|---|---|---|---|
| 1 | `core.ladder_config` | `established_min_handoffs` | int | A |
| 2 | `core.ladder_config` | `established_window` | interval | A |
| 3 | `core.ladder_config` | `established_min_avg_rating` | numeric(3,2) | A |
| 4 | `core.ladder_config` | `established_max_claim_rate` | numeric(5,4) | A |
| 5 | `core.ladder_config` | `trusted_min_handoffs` | int | A |
| 6 | `core.ladder_config` | `trusted_window` | interval | A |
| 7 | `core.ladder_config` | `trusted_min_scan_completion_rate` | numeric(5,4) | A |
| 8 | `core.ladder_config` | `trusted_max_claim_rate` | numeric(5,4) | A |
| 9 | `core.ladder_config` | `demotion_max_claim_rate` | numeric(5,4) | A |
| 10 | `core.ladder_config` | `demotion_max_cancellation_rate` | numeric(5,4) | A |
| 11 | `core.ladder_config` | `demotion_min_scan_completion_rate` | numeric(5,4) | A |
| 12 | `core.ladder_config` | `demotion_window` | interval | A |
| 13 | `core.ladder_config` | `distinct_buyer_window` | interval | C |
| 14 | `core.ladder_config` | `distinct_buyer_max_count` | int | C |
| 15 | `core.eligibility_config` | `follower_threshold` | int | -- |
| 16 | `nlu.intent_phrase` | `embedding` | vector(N) | -- |

**Rows 1-14 must all be nullable.** 0028 made 5 of them so; the rest are D-61's outstanding migration. **Row 15 is already nullable** and PRD S4.1 rules that NULL means no threshold. **Row 16 is not a nullability question** -- see S1.4.

### 1.2 Group A -- the trust ladder, beyond the NEW exit

**Status: OPEN.** ADU-PRD-01 S5.1 states the shape and refuses the numbers: *"all thresholds are per-market configuration records, published to sellers and never secret."*

**The NEW exit is SET** (S2). What remains is **ESTABLISHED -> TRUSTED** and **every demotion rule except the claim invariant**.

**What evidence settles it.** Phase 0's distribution of completed scanned handoffs per seller per month. **Almost every number here is a percentile of that distribution**, and until it exists each is a guess wearing a decimal point.

**Err low and raise later, once, announced.** Too low and TRUSTED signals nothing; too high and nobody reaches it. **Raising a threshold demotes people**, which is the one change a trust system cannot make quietly.

[!] **`demotion_*` is not `established_*` read backwards.** A seller demoted the instant they fall below the bar they climbed oscillates on one bad week. **The gap between the two sets is hysteresis and it needs its own numbers.**

**An upheld claim always demotes regardless of every value here** (S5.2). Not configuration.

### 1.3 Group C -- anti-gaming

`distinct_buyer_window`, `distinct_buyer_max_count`. A scanned handoff counts toward level only when the buyer is distinct, phone-verified, and has not transacted with that seller more than this many times in the window.

**Set the count above one.** At one you punish the loyal-customer pattern a good small retailer actually has, and the false positive lands on your best sellers.

### 1.4 The embedding dimension -- promoted from S3 in v1.1

**Status: OPEN. Now the chatbot's blocking decision** (D-05).

`nlu.intent_phrase.embedding` is built dimensionless, which pgvector permits -- **and an HNSW index requires a fixed dimension, so layer 3 is functional but unindexed.** Fails safe: slower, never wrong.

> **Choosing N chooses the embedding model**, which is an infrastructure and cost decision, not a transcription. **It is the same decision as layer 4's classifier vendor**, which is also unselected -- both call the same provider in almost every plausible answer.

**Decide them together.** ADU-CON-02's adapter doctrine applies: an interface, and a second provider before launch, as with SMS.

---

## 2. SET in v1.1 -- decided, do not re-open

| Value | Column | Decided |
|---|---|---|
| NEW exit, tenure arm | `new_to_established_min_tenure` | **60 days** |
| NEW exit, order arm | `new_to_established_min_orders` | **50** |
| NEW product cap | `new_level_product_cap` | **10** |
| NEW transaction cap | `new_level_transaction_cap_minor` | **NULL -- no cap** |
| Fulfilment window | `timing_config.fulfilment_window` | **7 days** |
| Refund acknowledgement | `timing_config.refund_ack_window` | **72 hours** |
| Media retention | `legal_config.media_retention` | **90 days** |
| Deleted-number cooling | `timing_config.deleted_number_cooling_period` | **30 days** |
| Cancellation penalty ladder | `timing_config`, four columns | **3 / 1h / 1d->2d escalating / 30d decay** -- PRD S9.5 |

> **The NEW exit requires BOTH arms.** 60 days **and** 50 orders. An earlier draft used `OR`, which promoted a dormant seller -- sign up, never trade, and sixty days later leave NEW with an uncapped catalogue and no caution flag.

**`new_level_transaction_cap_minor` is SET to no-cap, not left open.** The column stays so that setting one later is an `INSERT`, and **its consumer must treat NULL as absent rather than relying on a NULL comparison evaluating false by accident.**

---

## 3. Ship at a default -- reasoned, not measured

Each ships and is tuned by inserting a configuration version. **None blocks anything.**

| Item | Default | What would change it |
|---|---|---|
| Payout activation delay | 24 h | Observed fraud vs. seller complaints about the wait |
| Recovery cooling period | 7 d | Account-takeover attempts through recovery |
| Offline scan sync horizon | 7 d | Real courier connectivity in Phase 0 |
| Level credit grace | 24 h | Clock-skew incidents at handoff |
| Reservation window | 48 h | PRD-stated |
| Payment confirmation window | 24 h | Feeds S12.4a's `SYSTEM` claim |
| Console session, remembered | 7 d / 8 h idle | R17: SMS spend vs. exposure |
| Console session, unremembered | 12 h / 30 min idle | R17 |
| Mobile session | 30 d sliding, 5 devices | |
| Analytics live window | 90 d | Storage cost vs. query need |
| Evidence cap | 5 MB | Real screenshot sizes on low-end Android |
| Media limits | 5 images, 1 video <=480p <=30s | |
| OTP rate limits | 3/hour per phone | Lockout complaints vs. abuse |
| **Courier invites** | **10/hour/seller** | New in v1.1. Timing-sample floor, and a bound on abuse |

---

## 4. Open, with a named consequence

| # | Item | Blocks |
|---|---|---|
| 4.1 | **Follower threshold** (`eligibility_config.follower_threshold`) | Eligibility at paid launch. **The number the beta exists to discover** -- do not guess it |
| 4.2 | **Stock confidence bands are hard-coded** in a view, not configuration | Nothing yet. Every comparable interval is a `timing_config` column. **Either move them or record why they differ** -- they may be genuinely market-invariant, which would be a fine answer nobody has given |
| 4.3 | **`billing.tier_definition`'s columns** (D-08) | Nothing today; the commercial rebuild owns it |
| 4.4 | **Cancellation-counter weights** (D-09) -- two `timing_config` columns | Nothing today. S12.7 says the expiry weight exceeds the cancel weight and neither column exists |
| 4.5 | **Bootstrap market resolution and the client version floor** (D-20) | Nothing while there is one market. **Loudly wrong the day there are two**, by design and by comment |
| 4.6 | **Counting platforms -- two or five** | Verification build |
| 4.7 | **Delivery fee** | Courier module. `seller_fulfilment_method` carries **no fee column**, so either answer is a migration |
| 4.8 | **Claim outcome matrix** | Phase 3 |
| 4.9 | **Beta-to-paid transition** | First cohort conversion |
| 4.10 | **Trial conversion criterion** | Paid launch. **Written down in advance, per seller type** -- a criterion chosen after the fact is not one |
| 4.11 | **Deleted or reposted source content** | Link resolution |
| 4.12 | **Conversation per pair, or per anchor** (D-66) | **Ruled: the anchor moves to the message.** Listed so the question is not re-opened as if open |

---

## 5. Settled by measurement -- six of seven now measured

| Item | Status |
|---|---|
| Hot-variant concurrency | **Measured.** 300 of 350 on stock 300, zero negative counts |
| Expiry sweep, 1M rows | **Measured.** 2.8 ms on the partial index |
| Stats trigger, 100 scans/sec | **Measured.** Flat at ~0.35 ms |
| 08:00 dispatch, 10k queued | **Measured.** 99 ms |
| Evidence streaming, 100 x 2 MB | **Measured.** +24.8 MB RSS |
| Pooled-connection identity leak | **Measured.** Zero crossings |
| SMS primary vendor | **Not measured.** Delivery rate in Phase 0 -- a release gate |
| **Hosting provider** | [!] **Not verified.** The four-step probe has run only against local Docker |

> **Every measured number beat the model, several by two orders of magnitude.** That is worth less confidence in the next model, not more.

[!] **The hosting probe is the one that has not moved and has become more urgent.** SR-1 and D-50 were both grant defects nothing detected for four work orders, and the fix for both is a privilege model a managed provider may not permit. **If Render cannot create six roles and reassign function ownership, the definer discipline has no implementation** -- and it would land on 34 migrations, 124 endpoints and a worker rather than on an empty repository.

---

## 6. Non-negotiable -- recorded so they are never "tuned"

Zero: the ledger's balance, materialized views, step-up permissions reachable from `MOBILE`. One: session reads per authenticated request. Exactly eight step-up permissions, 42 permissions, 139 grants, zero Analyst writes. `stock_count >= 0` is a constraint, not a threshold. The 48-hour clock **stops** at `PAYMENT_CONFIRMED` -- the interval is configuration, the stopping is not. **An upheld claim always demotes.**

---

## 7. For whoever fills in Group A

**Do not decide the ladder and the caps separately.** They are one system: the thresholds set how long a seller stays NEW, and the caps set what that costs them.

**The single most useful Phase 0 measurement** is the distribution of completed scanned handoffs per seller per month. Almost every remaining number is a percentile of it.

**Publish the thresholds when you set them** (S5.1: *"published to sellers and never secret"*). A ladder whose rungs are hidden is indistinguishable from favouritism, and the product's whole claim is that trust is earned by evidence rather than granted.

---

*Working register, not a specification -- except S1.1, which is machine-read and enforced. Sixteen OPEN columns named by schema, table and column, because the rule that deferred values must be nullable cannot be checked against a list of concepts. The nullability rule is v1.1's reason for existing: for four work orders "deferred" meant a NOT NULL column with an undecided value, which is an invention with a deadline rather than a deferral -- and the ladder was safe only because no configuration row existed, which is a safety that expires the first time someone writes one.*
