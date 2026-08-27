# ADU-VAL-01 -- Deferred Value Decisions Register

**Version:** 1.0  -  **Baseline date:** 27 August 2026
**Owner:** Founder / CEO
**Status:** Working register. **Not binding** -- nothing here is a specification. It is the list of every number, threshold and interval the document set defers, gathered in one place so that each is decided once, deliberately, against evidence.
**Sources swept:** ADU-PRD-01 v8.5 S25  -  ADU-DB-01 v1.9+A1/A2  -  ADU-AUTH-01 v2.3  -  ADU-API-01 v1.5  -  ADU-CON-02 v3.0 + A1  -  ADU-CON-03 v1.1  -  the Tier 1 spec-gap register

---

## 0. How to use this

**The problem this solves.** Values were scattered across eight documents in three states -- some decided with a number, some decided as "ship at a default," some genuinely open -- and no document said which was which. A build hits them one migration at a time and each one becomes an interruption.

**Three states, and only one of them blocks anything.**

| State | Meaning |
|---|---|
| **OPEN** | No value exists. Something is blocked, or will be |
| **DEFAULT** | A value exists and ships; it was reasoned, not measured. Tune later, no rework |
| **SET** | Decided, in a document, with a number. Listed here only so nobody re-opens it |

> **The distinction that matters: a column is a schema decision; a value is a business decision.** Almost everything below is a *value* in a configuration row, and configuration rows are `INSERT`s. **Nothing in S2, S3 or S4 blocks a migration** -- they block the market seed, which is Tier 4. Only S1 blocks anything sooner.

**How to fill this in.** Work group by group, not row by row -- the rows within a group constrain each other, and deciding one in isolation produces a set that doesn't cohere. Each group states what evidence would settle it and what happens if it is set wrong in each direction.

**When a group is decided,** move the numbers into the document named in its *Lands in* line, mark the rows **SET** here, and leave the reasoning. The reasoning is the part that is expensive to reconstruct.

---

## 1. Blocking -- decide before the market seed

### Group A  -  The trust ladder

**Lands in:** `core.ladder_config`  -  **Blocks:** the Ethiopian market seed, and the meaning of `fn_recompute_seller_level` (migration 8)
**Status:** **OPEN** -- ADU-PRD-01 S5.1 states the *shape* and refuses the numbers, deliberately: *"all thresholds are per-market configuration records, published to sellers and never secret."*

| Column | Question | State |
|---|---|---|
| `established_min_handoffs` | How many completed scanned handoffs earn Established? | OPEN |
| `established_window` | Over what period must they fall? | OPEN |
| `established_min_avg_rating` | Minimum average review rating | OPEN |
| `established_max_claim_rate` | Maximum upheld-claim rate | OPEN |
| `trusted_min_handoffs` | Same, for Trusted | OPEN |
| `trusted_window` | | OPEN |
| `trusted_min_scan_completion_rate` | Trusted adds a scan-completion floor (S5.1) | OPEN |
| `trusted_max_claim_rate` | | OPEN |
| `demotion_max_claim_rate` | What claim rate demotes? | OPEN |
| `demotion_max_cancellation_rate` | What cancellation rate demotes? | OPEN |
| `demotion_min_scan_completion_rate` | What scan-completion floor demotes? | OPEN |
| `demotion_window` | Over what period | OPEN |

**What evidence settles it.** Phase 0's actual distribution of handoffs per seller per month. Set Established at a level a genuine seller reaches in weeks, not months -- the badge has to be *reachable* or it stops signalling anything and becomes a wall.

**The asymmetry to hold in mind.** Too low and the ladder is worthless: everyone is Established, the badge means nothing, and the differentiator you built the product around evaporates. Too high and beta sellers stay New indefinitely, carry the product cap and transaction cap, and churn before they ever see the value. **The second failure is the one that kills a beta**, so err low and raise it -- raising a threshold demotes people, which is why it should be done once, from evidence, and announced.

[!] **An upheld claim always demotes regardless of volume** (S5.2). That invariant is independent of every number here and is not up for tuning.

### Group B  -  New-level caps

**Lands in:** `core.ladder_config`  -  **Blocks:** the seed; visible to every beta seller from day one
**Status:** **OPEN** -- ADU-PRD-01 S25 names both.

| Column | Question |
|---|---|
| `new_level_product_cap` | How many products may a New seller publish? |
| `new_level_transaction_cap_minor` | Maximum order value for a New seller, in minor units |

**These are the two numbers a beta seller feels first**, before any trust mechanic. The product cap interacts with the tier limit -- the effective limit is the **lesser** of the two (S7.3) -- so a New seller on any tier publishes at this number, and a paying seller who cannot publish will ask why their money did nothing.

**The transaction cap is a risk control, not a trust signal.** It bounds what a buyer can lose to a seller with no history, since Adulis holds no money and cannot reverse a transfer. Set it against a typical Ethiopian social-commerce order value, not against an aspirational one.

### Group C  -  Anti-gaming

**Lands in:** `core.ladder_config`  -  **Blocks:** the seed; `fn_recompute_seller_level` reads it
**Status:** **OPEN**

| Column | Question |
|---|---|
| `distinct_buyer_window` | Over what period is buyer distinctness assessed? |
| `distinct_buyer_max_count` | How many times may one buyer's handoffs count toward one seller's level inside that window? |

**INVARIANT this configures** (S5.2): a scanned handoff counts toward level **only** when the buyer account is distinct, has its own verified phone, and has not transacted with that seller more than this many times in the window.

**The tension is real and worth naming.** A genuine repeat customer is the best evidence a seller is good -- and is also exactly what a seller faking a ladder climb would simulate. **Set the count above one.** At one, you punish the loyal-customer pattern that a good small retailer actually has, and the false-positive lands on your best sellers.

---

## 2. Ship at a default -- a number exists, it was reasoned, not measured

Each ships. Each is tuned by inserting a configuration version and touches no code. **None blocks anything.**

| Item | Default | Lands in | What would change it |
|---|---|---|---|
| Payout activation delay | **24 h** | `timing_config` | Observed fraud attempts vs. seller complaints about the wait |
| Recovery cooling period | **7 d** | `timing_config` | Account-takeover attempts through recovery |
| Offline scan sync horizon | **7 d** | `timing_config` | Real courier connectivity in Phase 0 |
| Level credit grace | **24 h** | `timing_config` | Clock-skew incidents at handoff |
| Reservation window | **48 h** | `timing_config` | Buyer payment latency; PRD-stated |
| Payment confirmation window | **24 h** | `timing_config` | Seller responsiveness; feeds S12.4a's `SYSTEM` claim |
| Console session, remembered | **7 d / 8 h idle** | `timing_config` | R17; SMS spend vs. exposure |
| Console session, unremembered | **12 h / 30 min idle** | `timing_config` | R17 |
| Mobile session | **30 d sliding, 5 devices** | `timing_config` | |
| Stock confidence bands | **24 h / 48 h / 72 h / 7 d** | `v_stock_confidence` -- **hard-coded, not configuration** | [!] S3 item |
| Analytics live window | **90 d** | R19 | Storage cost vs. query need |
| Evidence cap | **5 MB** | API S7.1 | Real screenshot sizes on low-end Android |
| Media limits | **5 images, 1 video <=480p <=30s** | PRD S7.4 | |
| OTP rate limits | **3/hour per phone** | AUTH S22 | Lockout complaints vs. abuse |
| Cancellation penalty ladder | **3 same-seller -> 1 h; cross-seller 1 d -> 2 d escalating; 30 d decay** | `timing_config` | PRD S9.5 -- **SET**, transcribe don't decide |

---

## 3. Open, and each blocks something specific

| # | Item | Blocks | Note |
|---|---|---|---|
| 3.1 | **Follower threshold** | Eligibility config at paid launch | Nullable, null means no threshold. **The number the beta exists to discover** -- do not guess it |
| 3.2 | **Fulfilment window length** | Order lifecycle | How long a paid order may await handoff before it becomes a claim trigger. **Interacts with S12.4a** -- the confirmation-window claim and this one must not both fire on the same order |
| 3.3 | **Refund acknowledgement window** | Claim triggers | How long before an unacknowledged refund raises a claim |
| 3.4 | **Deleted-number cooling period** | Can ship at a default; no default chosen | Before a phone number may open a new seller account |
| 3.5 | **Media retention period** | Lifecycle policy | For deleted accounts and unpublished products. Lands in `legal_config` |
| 3.6 | **Stock confidence bands are hard-coded** | Nothing yet | The four intervals are literals in a view, not configuration, while every comparable interval is a `timing_config` column. **Either move them or record why they are different.** They are also market-invariant, which may be the answer |
| 3.7 | **Counting platforms -- two or five** | Verification build | TikTok and Instagram, or more |
| 3.8 | **Delivery fee** | Courier module | Who sets it, buyer visibility, whether Adulis records it. `seller_fulfilment_method` carries **no fee column**, so either answer is a migration |
| 3.9 | **Claim outcome matrix** | Phase 3 | Which remedies are available in which claim states |
| 3.10 | **Beta-to-paid transition** | First cohort conversion | What happens to chatbot configuration and history at conversion; whether the 60-day trial is additional to the beta or consumed by it |
| 3.11 | **Trial conversion success criterion** | Paid launch | **Written down in advance, per seller type** -- a criterion chosen after the fact is not a criterion |
| 3.12 | **Deleted or reposted source content** | Link resolution | What happens to a product whose tagged post no longer exists |

---

## 4. Commercial -- held pending the model rebuild

**ADU-PRD-01 X3 records that the commercial model is being rebuilt.** These are listed so they are not treated as settled.

| Item | Currently | Note |
|---|---|---|
| Tier prices | $0 / $10 / $25 / $50 | PRD S16.1; `billing.price_schedule` |
| Publication limits by tier | Listed 10, others unlimited | **"Unlimited" is never unlimited** -- the level cap always applies (CON-03 SC-07) |
| Analytics by tier | Essential / views-reservations-conversion / full / full+export | Beta gets the Assisted set |
| Team access | **Business only** | AUTH S16.2 |
| KYC vendor and per-verification cost | Unselected | Phase 2 economics |
| Business tier API scope and rate limits | Undefined | |
| VAT invoice format for company sellers | Undefined | `legal_config.invoice_number_format` |
| Prepay discounts | Undefined | `billing.price_schedule` |

---

## 5. Operational -- decided by measurement, not by choosing

Listed because they are easy to mistake for decisions. **Each has a right answer that a test produces.**

| Item | Settled by |
|---|---|
| SMS primary vendor | Measured delivery rate in Phase 0 (AUTH S6; a release gate) |
| Hosting provider | The four-step capability probe (CON-02 S18) -- requirement 5 disqualifies, and it is on no feature page |
| Postgres tier | The capacity model's thresholds (CON-02 S17) |
| Worker concurrency | The 08:00 dispatch measurement |
| Load-test targets | CON-02-A1 S6's six tests replace every modelled assumption |

---

## 6. Non-negotiable -- recorded so they are never "tuned"

Numbers that look like configuration and are not.

- **Zero.** The ledger's balance, asserted hourly.
- **One.** Session reads per authenticated request. Above one means someone cached a session and immediate revocation is gone.
- **Exactly eight** step-up permissions, **42** permissions, **139** grants, **zero** Analyst writes.
- **`stock_count >= 0`.** Not a threshold; a constraint.
- **48 hours** stops permanently at `PAYMENT_CONFIRMED` -- the interval is configuration, the stopping is not.
- **An upheld claim always demotes**, regardless of volume.
- **Zero** materialized views. Zero step-up permissions reachable from `MOBILE`.

---

## 7. Filling in Group A -- a note for whoever does the research

**Do not decide Groups A, B and C separately.** They are one system: the ladder thresholds set how long a seller stays New, and the New caps set how much that costs them. A high Established threshold plus a low product cap is a beta where nobody can trade.

**The single most useful Phase 0 measurement** is the distribution of completed scanned handoffs per seller per month. Almost every number in Group A is a percentile of that distribution, and until it exists every value is a guess wearing a decimal point.

**Publish the thresholds when you set them** (S5.1: *"published to sellers and never secret"*). A ladder whose rungs are hidden is indistinguishable from favouritism, and the product's entire claim is that trust is earned by evidence rather than granted.

---

*Working register, not a specification. Three groups block the market seed; fifteen values ship at a reasoned default and are tuned by an `INSERT`; twelve are open with a named consequence; five are settled by measurement rather than by choosing. The distinction worth keeping is between a column and a value -- the columns are written and the schema is not waiting on any of this.*
