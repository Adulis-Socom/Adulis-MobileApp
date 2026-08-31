# ADU-VAL-01 -- Deferred Value Decisions Register

**Version:** 1.2 - **Baseline date:** 29 August 2026
**Owner:** Founder / CEO
**Supersedes:** ADU-VAL-01 v1.1
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

### 0.1 What changed in v1.2

**S1.1 was wrong in three ways and the gate that reads it is now pinned.**

| # | Change | S |
|---|---|---|
| **1** | **Row 15 is REMOVED.** `follower_threshold` NULL is a **decided** value, not a deferral -- and a column where NULL means something is not an OPEN column | 1.1, 1.5 |
| **2** | **Row 16 is REMOVED.** The embedding dimension is a **type** question, not a nullability one. It stays OPEN, in S1.4, and out of the machine-read table | 1.1, 1.4 |
| **3** | **The count is 14, and it is pinned in the gate.** v1.1 said "0028 made 5 of them so"; `information_schema` said **ten of the fourteen** were still `NOT NULL`, and 0039 altered exactly ten (D-90) | 1.1 |
| **4** | **`media_retention` is `timing_config`, not `legal_config`** (D-91). The schema and ADU-DB-01 both say so; v1.1's S2 row named a column that does not exist where it stated | 2 |
| **5** | Five new deferred values from the T6-T8 registers | 3, 4 |

### 0.2 Why the pin moved, and it moved after being verified

`verify:deferred-values` **was exposed to D-121's class** -- it compared S1.1's table against the fixture and asserted nothing about how many rows either held, so **a column removed from both would have passed.** It is pinned now.

> **The pin was set at 16 and is 14. That is not a retreat; it is the pin doing its job on its first day.** Pinning a count forces someone to say what the count *is*, and saying it out loud is what exposed two rows that were never nullability questions.
>
> **A gate that only compares two forms cannot ask whether either is right.** A pin can.

### 0.3 What S1.1 is for, stated because v1.1 blurred it

> **S1.1 lists columns whose VALUE is undecided and which must therefore be nullable, so that "not yet decided" is a state the schema can hold.** Nothing else belongs in it.
>
> A column where NULL carries meaning is **decided** (S1.5). A question about a column's type, its owner or its semantics is an open question and belongs in S3 or S4. **v1.1 put all three in one table and the gate inherited the confusion.**

**Everything not listed above is carried forward from v1.1 unaltered.**

---

### 0.5 What changed in v1.1 -- retained for history

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

**All fourteen are nullable as of migration 0039**, and **the count 14 is pinned in `verify:deferred-values`.**

[!] **v1.1 said "0028 made 5 of them so" and that was one of three wrong counts in three documents** (D-90). `information_schema` said **ten of the fourteen** were still `NOT NULL`; 0039 altered exactly ten, and its header names all three wrong counts. **The schema won, per S0.3's own rule, and the gate now holds all three forms together so the next drift is red rather than a register entry.**

**Rows 15 and 16 of v1.1 are removed.** See S1.5 and S1.4 -- neither was a nullability question, and the pin is what made that visible.

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

### 1.5 D-92 -- `follower_threshold`'s NULL is decided, not deferred

**Two sentences in one governing register said opposite things**, and both were in force.

| Source | Reading |
|---|---|
| ADU-RUL-02, via v1.1 S0.2 | *"every column in S1.1 is nullable, and its consumer **fails closed** on NULL"* -- and row 15 was in S1.1 |
| v1.1 S1.1's own note, citing ADU-PRD-01 S4.1 | *"NULL means **no threshold**"* -- fail **open** |

**The code fails closed**, so a market with `audience_required = true` and a NULL threshold refuses every seller with `FOLLOWER_THRESHOLD_NOT_MET` -- and the beta posture *"no threshold is enforced"* is reachable only by `audience_required = false`, never by a NULL threshold.

> **RULING -- ADU-PRD-01 S4.1 governs. NULL means no minimum, and the consumer fails OPEN on it.** `fn_evaluate_eligibility`'s audience arm treats a NULL threshold as satisfied.
>
> **The two rules were never actually in conflict; they are about different kinds of NULL.** For a ladder threshold, NULL means *nobody has decided the bar* -- an absence, and failing closed is right, because promoting on an undecided threshold promotes on nothing. **For `follower_threshold`, NULL means *this market sets no bar* -- a decision, expressed as an absence of value.**
>
> **So the column does not belong in S1.1 at all**, and having it there is what made the two sentences look contradictory. **"Not yet decided" and "decided to be none" are different states that share a representation**, and a register of deferrals must hold only the first.

**One line and one test:** a NULL-threshold market admits an audience-less seller.

[!] **The general shape is worth carrying.** Any column where NULL is a meaningful value cannot also be a deferral marker -- **the two readings are indistinguishable in the data and only the document can tell them apart.** Where a column needs both, it needs two columns.

---

## 2. SET in v1.2 -- decided, do not re-open

| Value | Column | Decided |
|---|---|---|
| NEW exit, tenure arm | `new_to_established_min_tenure` | **60 days** |
| NEW exit, order arm | `new_to_established_min_orders` | **50** |
| NEW product cap | `new_level_product_cap` | **10** |
| NEW transaction cap | `new_level_transaction_cap_minor` | **NULL -- no cap** |
| Fulfilment window | `timing_config.fulfilment_window` | **7 days** |
| Refund acknowledgement | `timing_config.refund_ack_window` | **72 hours** |
| Media retention | **`timing_config.media_retention`** | **90 days** -- v1.1 said `legal_config`, which has no such column (D-91) |
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
| 4.13 | **`TRUSTED_PROXY_HOPS`** (D-114) | **Blocking, and the value cannot be guessed.** Behind a CDN every IP-keyed budget becomes one per deployment; trusting one hop too many lets a client forge its own. Needs the deployment topology, which D-80 says nobody has written |
| 4.14 | **`POST /v1/devices`'s rate budget, and per what subject** (D-113) | An unauthenticated write at ~280 rows/second. **IP is the only anonymous subject available and it is the wrong one behind a carrier NAT** |
| 4.15 | **The two cancellation-counter weights** (D-09) | S12.7 says expiry weighs more than cancellation and neither column exists |
| 4.16 | **The ownership-transfer delay: literal or per-market** (D-71) | A literal `24 hours` today. Reading `payout_activation_delay` would couple a flat rule to a per-market configurable -- **a market shortening its payout delay would silently shorten the window a compromised Owner is caught in** |
| 4.17 | **The client version floor, and anonymous market resolution** (D-20) | Floored at `0.0.0`, so every client passes. **Loudly wrong the day a second market goes live**, by design and by comment |

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
| **Hosting provider** | [!] **Not verified.** The four-step probe has run only against local Docker, and `ops/render.yaml` has never existed (D-80) |

> **Every measured number beat the model, several by two orders of magnitude.** That is worth less confidence in the next model, not more.

[!] **The hosting probe is the one that has not moved and has become more urgent.** SR-1 and D-50 were both grant defects nothing detected for four work orders, and the fix for both is a privilege model a managed provider may not permit. **If Render cannot create six roles and reassign function ownership, the definer discipline has no implementation** -- and it would now land on **40 migrations, a console and a worker** rather than on an empty repository.

**And it has acquired a second dependent.** `TRUSTED_PROXY_HOPS` (S4.13) cannot be set without knowing how many proxies sit in front, so **the same missing topology now blocks both the privilege model and every IP-keyed rate limit.** One hour of work, and it has only ever got more expensive.

---

## 6. Non-negotiable -- recorded so they are never "tuned"

Zero: the ledger's balance, materialized views, step-up permissions reachable from `MOBILE`. One: session reads per authenticated request. Exactly eight step-up permissions, 42 permissions, 139 grants, zero Analyst writes. `stock_count >= 0` is a constraint, not a threshold. The 48-hour clock **stops** at `PAYMENT_CONFIRMED` -- the interval is configuration, the stopping is not. **An upheld claim always demotes.**

---

## 7. For whoever fills in Group A

**Do not decide the ladder and the caps separately.** They are one system: the thresholds set how long a seller stays NEW, and the caps set what that costs them.

**The single most useful Phase 0 measurement** is the distribution of completed scanned handoffs per seller per month. Almost every remaining number is a percentile of it.

**Publish the thresholds when you set them** (S5.1: *"published to sellers and never secret"*). A ladder whose rungs are hidden is indistinguishable from favouritism, and the product's whole claim is that trust is earned by evidence rather than granted.

---

*Working register, v1.2 -- not a specification, except S1.1, which is machine-read, pinned and enforced. The pin moved from 16 to 14 on its first day, which is the pin working: forcing someone to say what a count IS exposed two rows that were never nullability questions. One of them, `follower_threshold`, had two governing sentences saying opposite things -- and they were never in conflict, because NULL meaning "nobody has decided" and NULL meaning "this market sets no bar" are different states sharing a representation. A register of deferrals holds only the first, and putting both in one table is what made them look contradictory. Fourteen OPEN columns named by schema, table and column, because the rule that deferred values must be nullable cannot be checked against a list of concepts. The nullability rule is v1.1's reason for existing: for four work orders "deferred" meant a NOT NULL column with an undecided value, which is an invention with a deadline rather than a deferral -- and the ladder was safe only because no configuration row existed, which is a safety that expires the first time someone writes one.*
