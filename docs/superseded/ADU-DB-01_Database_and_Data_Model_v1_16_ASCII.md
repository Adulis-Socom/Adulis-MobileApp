# ADU-DB-01 -- Adulis Database and Data Model Specification

**Version:** 1.16  -  **Baseline date:** 1 September 2026
**Owner:** Founder / CEO (back-end)
**Status:** Binding data model. Drawn from ADU-PRD-01 v8.5, ADU-ARCH-01 v2.0, **ADU-AUTH-01 v2.3**, ADU-CON-01 v1.0 and ADU-CON-02 v3.0 with its annex A1.
**Supersedes:** ADU-DB-01 v1.15. Carries ADU-RUL-01 v1.0's rulings and the fifteen documentation defects of the T4 register
**Related:** ADU-PRD-01 v8.5  -  ADU-AUTH-01 v2.0  -  ADU-API-01 v1.3  -  ADU-CON-02 v3.0  -  ADU-PROJ-01 v9.0  -  ADU-00 v9.1  -  ADU-WEB-01 v1.0

> Where this document and ADU-PRD-01 disagree on **product behaviour**, the PRD governs. Where they disagree on **how a behaviour is enforced**, this document governs -- that is what it is for. The eight exceptions are in S1, and each carries a ruling that ADU-PRD-01 must adopt at its next revision.

> Where a rule is marked **INVARIANT**, it is enforced by a constraint, a trigger, a grant, or a function in the database. An invariant enforced only by NestJS service code is not enforced. This is the whole doctrine of the document.

---

## 0. What this document is

ADU-PRD-01 states roughly ninety invariants and says they must hold "in a database constraint or a server-side check, never by UI alone." This document is the discharge of that instruction: it names every table, every constraint, and -- for the constraints that are not obvious -- the exact mechanism.

It is written for two readers who are not the same person:

- **An AI coding agent** generating migrations and NestJS entities. It needs table names, column types, enum values and constraint definitions it can transcribe without inventing anything. Appendix A and Appendix B exist for it.
- **The COO/CTO supervising that agent.** He needs to be able to look at a generated migration and tell whether it matches this document, without holding the PRD in his head. Appendix C exists for him.

Everything undecided is flagged, never invented. Where ADU-PRD-01 S25 leaves a question open, the schema is built so that either answer can be taken later without a migration through live data.

**Reading order:** ADU-00 -> ADU-PROJ-01 -> ADU-PRD-01 -> ADU-DB-01 -> ADU-API-01.

**Scope:** V1 as defined in ADU-PRD-01 S2, plus the ledger required by S22 and the analytics schema required by S20. Out of scope: V3 discovery, advertising, Crowd Commerce, Group Buying, delivery, custody balances.

**The count lives in Appendix B and nowhere else.** **Migration 1 creates ten schemas** -- the tenth is `jobs`, which holds graphile-worker's own objects and none of ours, which is why Appendix C check 14 scopes its `IN (...)` list to nine and why a reader counting `CREATE SCHEMA` statements gets a different number. The manifest is Appendix B, **generated from `pg_class` and compared by `verify:appendix`**, and a migration that produces a different number is wrong in a way worth investigating before it is reviewed line by line.

> **D-222.5 -- this line said "109 tables" through v1.13, v1.14 and v1.15, while Appendix B said 114 and then 116.** It is the **fifth** counting drift in this document, and the worst-placed: **v1.13's entire purpose was to stop hand-maintained counts drifting**, and it carried one in its opening section for three revisions **because no gate reads the body.**
>
> **The correction is to remove the number, not to update it.** A count here has no reader and no checker; updating it would only reschedule the drift for v1.17.

---

## 0.1 What changed in v1.16

**One line removed, and it is worth more than a correction.**

| # | Change | S |
|---|---|---|
| **D-222.5** | **S0 no longer states a table count.** It said 109 through three revisions while Appendix B said 114 then 116 | 0 |

**Nothing else changes. 116 tables, 71 enum types, migrations 0001-0046.**

### Why removal rather than correction

**This is the fifth counting drift in this document and the first inside the revision that was written to end them.** v1.13 generated both appendices from the fixtures and added a gate; **`verify:appendix` parses only the appendices, so S0's prose was never read by anything.**

> **A number in a document must have a checker or no reader.** S0's had neither. **Correcting it to 116 would have scheduled the same finding for v1.17.**

**And the cause is worth recording, because it is about method rather than care.** Every revision since v1.13 was made by surgical edit -- locate the section, replace the text, leave the rest. **Surgical editing preserves what it does not read, and what it does not read is the part nobody has checked in three revisions.**

**Everything not listed above is carried forward from v1.15 unaltered.**

---

## 0.2 What changed in v1.15 -- retained for history

**Migrations 0044-0046, and one sentence of mine that was right about itself.**

| # | Change | S |
|---|---|---|
| **A** | **`core.otp_challenge.market_id`** -- stamped from the device's market at creation. **D-180, D-193 and D-203 were one defect and this is the one column that closes all three** | 30b.7 |
| **B** | **Transport before supersession** -- a challenge that has not been transported is not live | 30b.7 |
| **C** | **`is_live` is dropped** (0046). `activation_state = 'ACTIVE'` governs, and both readers moved | 30b.3 |
| **D** | **D-190 -- Appendix B said "Reproducing 114 names" three lines under its own "116 tables"** | App. B |
| **E** | Two rulings the build produced: **`audience` joins S5.3's tuple** (D-208), and **bootstrap serves a returning device from a `SUSPENDED` market** (D-216.4) | 30b.7 |

**Counts unchanged: 116 tables, 71 enum types.** `market_id` is a column; `is_live` was one.

### D-190, and it is worth one line rather than none

**I updated "114 tables" to 116 and left "reproducing 114 names" three lines below** -- **in the sentence explaining that a number repeated in prose becomes a fourth copy of a fact that has already drifted three times.**

> **The sentence was right about itself.** Corrected here, and it stays as the argument for why the enumeration lives in the fixture.

### The lesson from the transcription gate

**The gate built to abolish witnessing-yourself checked the provider enum against a constant.** It compared the migration to a literal in its own source -- **one witness, wearing a header that claimed two.**

> **A gate that reads one side from a literal has one witness, whatever it says about itself.** Both sides must come from somewhere a single edit cannot reach.

**Everything not listed above is carried forward from v1.14 unaltered.**

---

## 0.3 What changed in v1.14 -- retained for history

**The schema ADU-AUTH-01 v2.6 needs, and four rulings the transcription produced.**

| # | Change | S |
|---|---|---|
| **A** | **`core.otp_delivery_attempt`** -- transport state, separate from security state, many attempts per challenge | 30b.1 |
| **B** | **`core.platform_otp_budget`** -- **the first platform-scoped configuration table.** Every other config row is per market; a global spend ceiling is not | 30b.2 |
| **C** | **Five enums** -- `market_activation_state`, `otp_delivery_status`, `sender_registration_status`, `sms_provider`, `sms_sender_mode` | App. A |
| **D** | **`is_live` is WITHDRAWN. `activation_state = 'ACTIVE'` is the single truth about a market** -- D-183 | 30b.3 |
| **E** | **Two event names collide with installed ones. The installed names win and the new pair is never emitted** -- D-184 | 30b.4 |
| **F** | `failure_class` and `sms_compliance_status` stay **TEXT**, deliberately -- D-181, D-182 | 30b.5 |
| **G** | **`otp_challenge.audience` exists; the service half does not** -- D-180, and it is owed before anything is built on it | 30b.6 |

**Counts:** **116 tables** (`core` = 90) - **71 enum types** - 22 append-only - Appendix C **sixteen** checks, and CI runs **twenty-four gates**.

### The generator checked itself, which is the point of it

**`generate-appendix.mjs` failed check 16 on its first run.** `pg_enum.enumlabel` is type `name`, so `array_agg` without `::text` returns something the driver will not parse -- **and the gate caught it before the fixture was ever written wrong.**

> **The direction is one-way and it is what made that possible: database -> fixture -> document.** Nothing writes upstream. A generator feeding a gate that checks the generator is only safe while the flow has one direction, and stating it here is cheaper than re-deriving it later.

**Everything not listed above is carried forward from v1.13 unaltered.**

---

## 0.4 What changed in v1.13 -- retained for history

**The appendices are generated, and that is the whole revision.**

Three revisions running, this document announced an appendix correction and did not perform it -- v1.10 withdrew a block and left it, v1.11 said so, v1.12 declared Appendix B reconciled and named none of the three tables it claimed to have added. **Every one stayed green, because nothing checks the appendices.** Checks 14 and 16 read `db/checks/fixtures/`.

> **v1.13's Appendix A and Appendix B are generated from those fixtures, and a gate compares the document against them from now on.** The document, the fixture and the database agree **by construction**. A fourth announced-and-unperformed correction is no longer possible, because the correction is not written by hand.

| # | Change | S |
|---|---|---|
| **A** | **Appendix A regenerated.** Adds `OPERATOR_ATTESTED` (D-58) and **`WEB`** on `device_platform` (D-108). No asserted count -- check 16 is the count | App. A |
| **B** | **Appendix B regenerated from `pg_class`.** **114 tables**, every per-schema count derived from its own list, the five body-over-manifest rows folded in and flagged by register id (D-18, D-40, D-59, D-68, D-70) | App. B |
| **C** | **The definer discipline gains a fourth clause.** Own it, revoke `PUBLIC`, grant by name -- **and the owning role must hold the privileges the body needs**, which the billing trap proved is not implied by the other three | 4.4a |
| **D** | **Deferral is nullable, as a stated principle** rather than a per-column decision (D-61) | 5.5a |
| **E** | Two new tables printed: **`billing.purchase_intent`** (D-68) and **`core.seller_ownership_transfer`** with its five functions (D-70) | 18.6, 7.5 |
| **F** | **The chat anchor moves to `chat.message`** (D-66, D-73). `chat.conversation`'s two columns are dropped | 17.1 |
| **G** | **S3's grant table names `adulis_jobs`' path to `core`** -- twenty jobs and no way to reach them (D-47) | 3 |
| **H** | **S31**: thirty-one corrections where the build is right and this document was wrong | 31 |

**Counts:** **114 tables** - **66 enum types, 234 values** - 22 append-only - Appendix C **sixteen** checks, and CI runs **twenty-one gates**.

### The lesson this revision is built on

**An assertion in prose that nothing executes will drift**, and this document has now proved it about itself four times in four revisions. **The fix is not more care. It is fewer assertions** -- the appendices are rendered from the thing the checks already read, and the only remaining hand-written number in this document is one nobody depends on.

**Everything not listed above is carried forward from v1.12 unaltered.**

---

## 0.5 What changed in v1.12 -- retained for history

**Two kinds of change.** Founder rulings that add behaviour, and fifteen places where the T4 build is right and this document was wrong -- **the more dangerous direction**, because the next reader corrects working code to match stale prose.

### The rulings (ADU-RUL-01 v1.0)

| # | Change | S |
|---|---|---|
| **G1.1** | **Identity verification is operator-only.** No KYC vendor at MVP; the founder attests directly. New enum value **`OPERATOR_ATTESTED`**, because neither existing value describes what happens | 7.3, App. A |
| **G1.2** | **The NEW level now has an exit.** `tenure >= 60 days` **AND** `completed orders >= 50` -- both required. **No transaction cap** | 5.5 |
| **G1.4** | The **scan signature scheme** is recorded -- it existed in code and in no document | 14 |
| **G1.8** | **Pending courier invites.** An invite succeeds whether or not the number has an account, because any distinguishable response is a registration oracle | 6.3a |
| **G1.9** | **`product.slug`** -- generated once, immutable, unique per seller. Doctrine 5 already required it: a product page is anonymous, so it cannot carry a UUID | 9.1 |
| **G1.10** | `chat.conversation` gains **`product_id` / `order_id`**, at most one set | 15.1 |
| **G1.11** | **Devices are assigned a market at bootstrap**, and a marketless device falls back to the **shortest** retention, never the longest | 6.4 |

### The corrections

**Fifteen entries, listed in S30.** Two are worth naming here because they encode a lesson rather than a fix:

> **The definer discipline appears in no document, and its absence produced the two worst findings of this project.** SR-1 found ten `SECURITY DEFINER` functions executable by `PUBLIC` -- including all six boundary functions, callable by any connecting role **naming any actor**. D-50 found one owned by the superuser, bypassing RLS entirely for four work orders. **Nothing ever failed**, which is exactly why both survived. S4.4 states the rule and check 10 now enforces the class.

> **The table manifest gets the enum treatment.** D-18 and D-40 found two tables the bodies require and Appendix B omitted; D-10 found the event-name count stated as 65 in one section, 68 in another, and 72 in fact. **That is the fifth counting drift.** Appendix B is now reconciled *from* the database rather than asserted, and check 14 compares the two in both directions -- the same fix check 16 made for enums.

**Counts:** **112 tables** (111 after D-18/D-40's two, plus `seller_courier_invite`), **67 enum types** (`OPERATOR_ATTESTED` extends an existing type; the count is now derived, not asserted -- App. A).

**Everything not listed above is carried forward from v1.11 unaltered.**

---

## 0.6 What changed in v1.11 -- retained for history

**Amendment A3 absorbed, and two defects closed that A3 itself introduced or failed to catch.** No new capability.

| # | Change | S |
|---|---|---|
| **A3.1** | `fn_apply_stock_event` fires **`BEFORE INSERT`**. v1.10 said `AFTER`, in which `RETURN NEW` and the assignment to `NEW.resulting_count` are both inert -- so every stock event would have carried NULL and **nothing would have raised** | S10.1 |
| **A3.2** | Stock release is idempotent per **line**, not per order: `UNIQUE (reservation_id, reason)` over release reasons, **plus a `CHECK` requiring the anchor** -- a partial unique index does not constrain rows whose indexed column is NULL | S12.4 |
| **A3.3** | The standing gate raises **`U0001`**, not `U0002`. A suspended member is told they may not act, not that the seller does not exist | S6.9a |
| **NEW** | **`fn_has_permission` is multiplicity-safe.** A3.3's body read membership regardless of standing, and `seller_team_member_live` is unique only `WHERE revoked_at IS NULL` -- so a revoked-then-reinvited member has several rows and a bare `SELECT INTO` took an arbitrary one | S6.9a |
| **NEW** | **Appendix A's withdrawn block is actually removed.** v1.10 announced the withdrawal in S0.1 and left the block in place | App. A |

### The two new items are the same failure in different clothes

**Both are corrections that were declared and not performed.** v1.10 said the Appendix A block was withdrawn; the block stayed. A3.3 said the standing gate distinguishes three cases; the body it supplied could not distinguish them reliably, because it read a table whose uniqueness guarantee does not hold under the predicate it used.

**Neither was caught by reading.** The appendix defect was caught by **check 16** comparing the document against `pg_type`; the multiplicity defect was caught by someone building the function and reading the index it depends on. **An assertion in prose that nothing executes will drift** -- this document has now said so three times and demonstrated it three times.

**Everything not listed above is carried forward from v1.10 unaltered.**

---

## 0.7 What changed in v1.10 -- retained for history

**v1.10 absorbs amendments A1 and A2 and closes the Tier 1 register.** Tier 1 is complete -- migrations 01-05 built, applied, tested and deterministic; 42 permissions and 139 grants seeded; Gate C met. This revision is written against what building them found.

**Absorbed from the amendments** (they cease to apply separately):

| From | Change |
|---|---|
| A1.1 | The provisional Appendix A block is **withdrawn**. The catalogue is **66 types**, as v1.8 always had it. My "core-only" claim was wrong |
| A1.2 | `core.step_up_action` carries **eight values**, one per step-up permission |
| A1.3 | **`core.fn_has_permission` is defined**, and the Owner is `seller.owner_account_id` alone |
| A2 R28 | **A suspended team member loses every permission on the next request** |
| A2 R29 | **`U0001` / `U0002`** replace `insufficient_privilege` and `no_data_found` for deliberate denials |
| A2 R30 | ADU-AUTH-01's per-role write counts are withdrawn -- **v2.4 debt, not this document's** |

**New in v1.10, from SC of the register -- columns the document described and never named:**

| # | Table | v1.10 |
|---|---|---|
| C1 | `core.ladder_config` | Twelve threshold and demotion columns named. **Values are deferred to ADU-VAL-01 Group A** |
| C2 | `core.timing_config` | The cancellation-penalty ladder, transcribed from ADU-PRD-01 S9.5 -- which already had it |
| C3 | `core.seller_company_detail` | Its five columns named |
| C4 | `core.account_control_challenge` | Anchored on `seller_social_account_id` |
| C5 | `core.buyer_profile` | Confirmed **payload-less by design** |
| C6 | `core.market_phase_gate` | Attestation is **per condition** -- S5.2 said *"each with"* and meant it |
| C7 | `core.timing_config` | `buyer_session_lifetime` -> **`mobile_session_lifetime`**; `seller_session_lifetime` **retired** |

**And the smaller corrections:** S28 records the six deferred objects of SD so the deferrals cannot be lost  -  `verification.identity_attestation.verified` is **dropped**, never having been written by anything  -  check 10 names **five** functions, not four  -  the schema count is reconciled at **ten created, nine holding tables**  -  S6.9a's Companion list is corrected -- it named three permissions that do not exist  -  the closing summary is corrected against S0.1.

**Counts:** tables **109**, unchanged. Enum types **66 / 232 values**. Append-only **22**. Appendix C **sixteen** checks.

### The pattern in this register, which is worth naming once

Nearly every item in SC is the same failure: **a table described in prose and never given columns.** *"Established/Trusted thresholds, demotion rules"* reads like a specification and is not one -- an agent cannot build a column from a description of what it carries.

The fix is not more prose. **SC's tables are now given in the same form as every other table in this document: named columns, typed, with their constraints.** Where the *value* is genuinely undecided -- the ladder thresholds -- the column is named here and the value is deferred to **ADU-VAL-01**, explicitly, so that an absence is legible as a decision rather than as an omission.

**Everything not listed above is carried forward from v1.9 unaltered.**

---

## 0.8 What changed in v1.9 -- retained for history

**v1.9 is a defect reissue. It adds no capability.** Tier 1 was blocked by eight faults found while an agent tried to build migrations 1-5 from v1.8, and every one of them is a fault in this document.

| # | Defect in v1.8 | v1.9 | S |
|---|---|---|---|
| **D1** | **`step_up_is_web_only` names six codes where there are eight**, omits `seller.orders:reissue_instructions`, `seller.identity:manage` and `seller.ownership:transfer`, and includes `seller.instructions:reissue`, **which is not a permission that exists**. Written `code NOT IN (...) OR surfaces = '{CONSOLE}'`, **an omitted code is unconstrained** | **`core.permission` gains `requires_step_up boolean`, and the constraint becomes total** -- no list, nothing to drift | S6.9a |
| **D2** | Appendix C's reviewer query -- written to catch D1 -- **does not compile**: it selects `key` where the column is `code`, and filters on `requires_step_up`, which the table did not have | Rewritten against real columns; the column now exists | App. C |
| **D3** | `core.role_permission` had no seed. ADU-AUTH-01 v2.1 S16 was a **group** matrix and this table is **code**-keyed | Seeded from **ADU-AUTH-01 v2.2 S16.2** -- 42 codes, 139 grants, with a checksum query | S6.9a |
| **D4** | **`verification.write_attestation` is named in ADU-API-01 S13 and asserted as *defined* in this document's own v1.5 change table. It was never written** | Defined | S7.3 |
| **D5** | `fn_seller_availability_state` reads `m.timezone`; `core.market` has **`display_timezone`**. The function written to prevent the feature's one real defect **does not compile** | Fixed | S13.1b |
| **D6** | **Appendix A is a `core`-only catalogue presented as complete.** Every non-core enum -- six of them -- is absent, and the stated count has been wrong in three successive revisions | Non-core sections added; **the asserted count is replaced by a derivation rule and a check** | App. A, C |
| **D7** | **Appendix C check 10 is unsatisfiable as written.** It forbids any `GRANT ... ON SCHEMA verification ... adulis_app` -- including the `USAGE` without which the `SECURITY DEFINER` function is uncallable and identity verification cannot work at all | Restated as a privilege query with the invariant it actually protects | App. C |
| **D8** | `locale_pack`, `identity_config` and `legal_config` appear in the manifest with **no columns defined anywhere in the document** | Columns defined | S5.4 |

**Counts:** tables unchanged at **109**. `core.permission` gains one column. Appendix C gains **check 16** and now runs **sixteen** checks.

### What D1 and D2 together should teach

The list in D1 was wrong. **The deeper fault is that it was a list at all.** A hardcoded enumeration inside a `CHECK` has to be maintained in lockstep with a catalogue in a different document, and nothing enforces that -- so it drifted, and then the query written to detect the drift was itself never run against a real table.

v1.9 does not fix the list. **It removes the list**: `requires_step_up` becomes a column, and the constraint reads `CHECK (NOT requires_step_up OR surfaces = ARRAY['CONSOLE'])` -- **total over every row, present and future**. A permission added in 2027 is covered by a constraint written today. That is the doctrine this document already claims to follow: a rule the database can hold, the database holds -- and an enumeration a human must keep in sync is not the database holding it.

**Everything not listed above is carried forward from v1.8 unaltered.**

---

## 0.9 What changed in v1.8 -- retained for history

**One table, one function, one founder ruling.** v1.8 carries **R27** from ADU-CON-03 v1.1: sellers may mark dates on which the store is closed, on top of the weekly availability pattern.

| # | Area | v1.7 | v1.8 | S |
|---|---|---|---|---|
| **R27** | Availability | A weekly pattern only. No concept of a date | **`core.seller_availability_override`** -- a closure date with an optional note. Plus `core.fn_seller_availability_state`, so the storefront and the chatbot cannot disagree about whether a store is open | S13.1a |

**Counts:** 108 -> **109** tables. Enum types unchanged at 56; append-only unchanged at 22. Appendix C check 14 moves to **109**.

**The ruling was taken against a recommendation, and the reasoning that overturned it is worth keeping.** ADU-CON-04-R1 recommended against overrides on the grounds that availability gates nothing -- a seller closed for Meskel is already not judged on it, so a date calendar is machinery for a signal with no consequence. **The counter-argument is buyer-facing rather than seller-facing:** a storefront reading *open 9-6 Monday to Saturday* during Timkat is telling buyers something false, and a buyer who messages into silence on a public holiday cannot tell whether the seller is closed or gone. Availability's one job is setting an expectation, and being wrong on the twelve days a year buyers most need it is the case worth building for.

**Everything not listed above is carried forward from v1.7 unaltered.**

---

## 0.10 What changed in v1.7 -- retained for history

v1.7 discharges the document debt accumulated by ADU-AUTH-01 v2.0's findings, ADU-CON-01 v1.0's rulings, and ADU-CON-02 v3.0 with its capacity annex A1. **It is the reissue that unblocks migrations 1-15.** Nothing here is a new product decision; every item is a ruling already taken elsewhere, now written into the document that enforces it.

| # | Area | v1.6 | v1.7 | S|
|---|---|---|---|---|
| **R2** | Session audiences | `MOBILE`  -  `SELLER_WEB`  -  `COURIER_WEB` | **`MOBILE`  -  `CONSOLE`.** The courier restriction is row-level security keyed on a per-request setting, so a third audience bought nothing and forced a courier who also sells to hold two logins | S6.6, S6.9a, App. A |
| **R5** | Boundary audit identity | `read_attestation` and `read_payment_evidence` take `p_actor_role text` from the caller | **Derived inside the function from actual grants.** The most contested field in the audit row stops being the one the reader supplies -- and with no grant there is no row, so the query that logs is the query that authorises | S7.3, S13.3 |
| **R15** | Payment instructions | `render_payment_instructions` returns plaintext | **Returns ciphertext plus a key reference.** Key material never enters PostgreSQL, so a live database connection yields nothing readable | S13.6 |
| **R18** | Evidence encoding | Whole-object encryption | **~64 KB AEAD frames**, decrypted and streamed with constant memory (A1 rung 6) | S13.5 |
| **R16** | Public stats | *"materialized and refreshed on relevant writes"* | **A plain table maintained in O(1) by triggers.** A literal `MATERIALIZED VIEW` re-aggregates every seller's history per refresh -- the build-time capacity trap A1 found. Appendix C gains **check 15** | S8.3, App. C |
| **R19** | Analytics retention | Monthly partitions, unbounded | **90-day live window**; older partitions detach, export to R2 as Parquet, drop | S21, S24 |
| **R17** | Console sessions | 12 h / 30 min, OTP every return | **Remembered devices: 7 days / 8 hours.** `core.account_device` added; `timing_config` gains four columns. Sign-in SMS falls ~70% (A1 rung 1) | S6.6a, S4.3 |
| **R12** | Mark ready | Absent -- a Companion grant with no column | **`"order".ready_at`, `ready_marked_by_account_id`, `fn_mark_order_ready`.** A column, not a state: a new state would collide with `order_clock_consistency` and reopen the ratification set | S12.6a |
| **R13** | Fulfilment configuration | A readiness item with no table | **`core.seller_fulfilment_method`** -- `BUYER_COLLECTION`  -  `SELLER_DELIVERY`  -  `COURIER_DELIVERY`, at least one required, each with a `handoff_note` | S13.0 |
| **F6** | Operators | No operator model at all | **`core.operator_grant`.** A founder holding all five roles is fine; a founder holding all five because none exist is not | S6.11 |
| **R8'** | Transition set | 24 rows seeded unratified; the shipped table still carried struck row 6 | **23 rows, all ratified.** R-1 and R-3 adopted; **R-2 corrected** -- a submitted payment never expires, and the confirmation-window path is new S12.4a | S12.2.1 |
| **R7(a)** | `payment_submission` | Still listed `active_hours_version_id`, which S13.1 says is dropped | **Removed.** The column list now matches the section above it | S13.2 |
| **R9** | Invariant matrix | Two rows enforce retired invariants | **Corrected.** An invariant matrix carrying a retired invariant is worse than one that omits it | S26 |
| -- | Permissions seed | Catalogue described, not seeded | **`core.permission` and `core.role_permission` seeded** from ADU-AUTH-01 S15/S16 in migration 5 | S6.9a, S28 |
| -- | Churn tables | Default autovacuum | **Per-table tuning** for `rate_limit_bucket`, `idempotency_record` and the `jobs` schema | S27 |
| -- | Counting errors | S28 said "Fourteen migrations" and listed 15; Appendix C said "Twelve checks" and listed 14 | **Both corrected**; Appendix C is now **fifteen** | S28, App. C |

**Counts:** 105 -> **108** tables (`operator_grant`, `seller_fulfilment_method`, `account_device`), **56** enum types (`fulfilment_method`, `operator_role`; `session_audience` loses a value but not the type), append-only **22** (`operator_grant`). Appendix C **14 -> 15** checks.

**Three functions are added for endpoints ADU-CON-01 S6 registers as missing** -- `fn_mark_order_ready`, `fn_unpublish_product`, `fn_transfer_seller_ownership` -- so that ADU-API-01 v1.4 does not repeat v1.1's defect of naming functions that exist nowhere.

**What is deliberately still open.** The remaining ADU-CON-01 S6 endpoints that are plain reads or plain scoped writes get no function, because inventing one for a `SELECT` is overhead without a rule to enforce. Delivery fee (ADU-PRD-01 S25) stays uncolumned so either ruling lands as a migration rather than a rewrite.

**Everything not listed above is carried forward from v1.6 unaltered.**

---

## 0.11 What changed in v1.6 -- retained for history

v1.6 carries ADU-ARCH-01 **v2.0**: Telegram is removed from the architecture, and the Adulis mobile app gains a **Seller Companion mode**. Native push replaces the bot.

| Area | v1.5 | v1.6 |
|---|---|---|
| **Telegram** | `core.telegram_binding`, `notification_channel = TELEGRAM`, per-market channel config | **Removed entirely.** Seller push uses `core.device`, which already carries a push token, platform and permission state |
| **Permissions** | `role_permission` grants a capability to a role | **`core.permission` added.** Surface is a property of the permission, so `seller.payout:update` has no mobile grant and no endpoint could accept one | 
| **Session audiences** | `BUYER_APP`  -  `SELLER_WEB`  -  `COURIER_WEB` | **`MOBILE`  -  `SELLER_WEB`  -  `COURIER_WEB`.** One mobile session serves both modes, because one account holds both roles |
| **Actor channel** | `WEB`  -  `TELEGRAM`  -  `APP`  -  `SYSTEM` | **`WEB`  -  `MOBILE`  -  `SYSTEM`** |

**Counts:** 105 tables (one removed, one added), **54** enum types, append-only **21**. All unchanged in total.

**Why `core.device` needed no seller equivalent.** It already holds `push_token`, `platform`, `notification_permission` and a nullable `account_id` -- and under ADU-ARCH-01 S2 the seller and the buyer are the same account. A seller's device is a device. **No new table, no binding flow, no second push registry.**

**The shorter seller session lifetime is preserved by a different mechanism.** S6.4's reasoning was that *a seller losing a session loses payout control*. Payout control is not reachable from mobile at all (S6.9), so a mobile session carries the buyer lifetime and the shorter lifetime attaches to `SELLER_WEB`, where the dangerous capabilities live.

**Everything not listed above is carried forward from v1.5 unaltered.**

---

## 0.12 What changed in v1.5 -- retained for history

v1.5 carries the seller-surface architecture change (ADU-ARCH-01) and the rulings recorded in ADU-XREF-01 v1.5. **The seller has no native app.** The console is a PWA; notifications and quick actions run through a Telegram bot; the iOS and Android apps are buyer-only.

| Area | v1.4 | v1.5 | Section |
|---|---|---|---|
| **Session audiences** | `BUYER_APP`  -  `SELLER_APP`  -  `COURIER_APP`  -  `WEB_PURCHASE` | **`BUYER_APP`  -  `SELLER_WEB`  -  `COURIER_WEB`.** Purchase is part of the console, so its audience has nothing left to do | S6.6 |
| **Telegram** | Absent | **`core.telegram_binding`**, `notification_channel` gains `TELEGRAM`, and every state-changing write records `actor_channel` | S6.10, S20 |
| **Availability** | `seller_active_hours_version`, effective-range versioned, 8-hour minimum | **`core.seller_availability`** -- plain, one-hour minimum, split shifts, **zero windows valid** | S13.1 |
| **Payment window** | Signed timestamp and a 48-hour clock | **Two clocks.** 1-hour SLA for the claim right; 24-hour confirmation window; one 12-hour retry; second rejection ends the order | S12.4 |
| **Transition set** | 18 order rows, 24 total | **17 and 23.** Row 6 struck -- a submitted payment never expires. **R-2 closes** | S12.2.1 |
| **Seller closure** | Deletion blocked with no way to stop new obligations | **`seller_status` gains `CLOSING`** | S18.6 |
| **Claims** | Binary outcome | **`state`, `severity`, `remedy`.** `BANK_RECORD` evidence, `CLAIM_UPHELD` review badge | S16 |
| **Verification** | ID verification optional | Staged by configuration -- `id_verification_requirement` gains **`MANDATORY_ALL`** | S5.3 |
| **Missing functions** | Named in ADU-API-01, defined nowhere | **`financial.read_payment_evidence` and `verification.write_attestation` defined** | S7.3, S13.3 |

**Counts:** 104 -> **105** tables, 51 -> **54** enum types, append-only **21** unchanged. Appendix C check 7 drops to **>= 8** -- availability stops being versioned.

**Everything not listed above is carried forward from v1.4 unaltered.**

---

## 0.13 What changed in v1.4 -- retained for history

v1.4 adopts the two tables ADU-API-01 v1.1 requires, and takes one substantive decision on the handoff clock.

| Area | v1.3 | v1.4 | Section |
|---|---|---|---|
| **Idempotency** | Absent | **`core.idempotency_record`** -- a retry on a lost response no longer creates a second order | S12.8 |
| **Rate limiting** | Named in S23 of the PRD, unimplemented | **`core.rate_limit_bucket`**, keyed by account, device, phone hash or IP hash | S12.9 |
| **Handoff clock (A5)** | The device-signed timestamp governed both order completion and level advancement | **Split.** The signed timestamp governs completion; **server `received_at` governs level advancement** | S14.2 |
| **Honest clock skew** | Recorded as a signal | **Corrected.** `corrected_at` derived from the client's reported bootstrap offset, floored at `issued_at` | S14.2 |

**Counts:** 102 -> **104** tables, 49 -> **51** enum types. Schemas stay at nine, roles at six, append-only at **21** -- neither new table records what happened, and marking an expiring cache append-only would corrupt the figure Appendix C check 5 compares against.

**On the handoff clock, and a correction to how ADU-API-01 v1.0 and v1.1 sized this.** Both said a colluding buyer with a manipulated device clock can manufacture verified handoffs. True, and overstated: **a seller with colluding buyers can already manufacture verified handoffs by scanning promptly, with correct clocks, entirely inside the window.** Backdating adds no capability -- it adds *convenience*, letting an attacker farm at leisure and recover orders they let expire. The primary defence was always S5.2's distinct-buyer, velocity and graph controls, and it still is.

What v1.4 removes is the convenience, at a cost worth naming: a genuinely offline handoff that reaches the server beyond the window plus its grace period completes the order but does not advance the ladder. That is the treatment S11.4 already gives a `LATE` scan, so no new outcome is introduced -- only a different test for which scans receive it.

**Everything not listed above is carried forward from v1.3 unaltered.**

---

## 0.14 What changed in v1.3 -- retained for history

v1.3 revisits **one** decision: P3. v1.2 protected the seller's bank account with a third isolated schema. Review found that the same value is already inside the payment-evidence boundary -- ADU-PRD-01 S10.3 justifies that boundary on the grounds that *a payment screenshot carries both parties' bank details* -- so v1.2 was running two protection regimes over one secret. That is a direct breach of ADU-PROJ-01 doctrine 7, fewest moving parts, introduced while explicitly noting the overhead was real for a three-founder team.

**The two boundaries are merged into one, renamed `financial`.** Nothing else in the document changes.

| Area | v1.2 | v1.3 |
|---|---|---|
| Schemas holding a bank account number | `payment_evidence` **and** `payout_secret` | **`financial`**, one schema |
| Owning roles | `adulis_evidence`, `adulis_payout` | **`adulis_financial`** |
| Access logs answering *"who saw a bank account number?"* | Two, in schemas owned by different roles | **One `SELECT`** |
| Schemas  -  roles  -  tables | 10  -  7  -  103 | **9  -  6  -  102** |
| Enum types | 48 | **49** -- `financial.secret_subject_kind` |

**Two corrections carried in this revision.**

**A benefit I overstated in v1.2.** I claimed moving the ciphertext out of `core` prevents a second unlogged `SECURITY DEFINER` function being added quietly. It does not: creating one requires owning the table, which is a reviewed migration in either schema. The real gain is narrower -- a new function in a three-table schema is conspicuous where one among `core`'s forty is not. That is review ergonomics, and it survives the merge intact.

**An arithmetic error carried since v1.1.** Appendix B has stated "16 append-only tables" through two revisions. The manifest actually marks **22** in v1.2, and **21** in v1.3 once the disclosure log merges into the shared access log. Appendix C check 5 compares that figure against the trigger and `REVOKE` counts, so a wrong number there disarms the check that verifies every append-only table is actually append-only. Corrected.

**One thing worth stating plainly, because v1.2 assumed it without arguing it.** ADU-PROJ-01 S7.3 names three categories requiring specific handling -- identity verification, payment screenshots, buyer conversation records. **Payout details are not among them.** Encryption is retained here as a deliberate choice, not an inherited assumption: the number is shown to every buyer who orders, so confidentiality against buyers is impossible by construction, and every control that defeats the S10.4 write attack sits on the write path and works whether or not the value is encrypted. What encryption buys is one thing -- a dump or restored backup does not yield every seller's bank account in the clear. For a company whose positioning is trust, that is worth the column type. S13.6 records the reasoning so it is not re-litigated.

**Everything not listed above is carried forward from v1.2 unaltered.** C1-C8 stand as recorded in S1; P1, P2 and P4 stand as amended in v1.2; the 24-row transition set of S12.2.1 remains open and fail-closed.

---

## 0.15 What changed in v1.2 -- retained for history

v1.2 closes the four residuals identified in the v1.1 review. Three were accepted as designed and hardened; one -- the payout ciphertext -- was accepted with the structural fix it needed. **No ruling changed.** C1-C8 stand exactly as recorded in S1.

| # | Residual | Resolution | Section |
|---|---|---|---|
| **P1** | The transition set governs legality but nobody had ratified its contents, and `order_state_transition_legal` had no stated grant | **Fail-closed from day one, provisional until ratified.** The guard denies any transition absent from the table; rows carry `ratified_at`; a market cannot go live while any row is unratified. Table writable only by `adulis_migrate`. **The 24-row set is presented for review in S12.2.1** | S12.2 |
| **P2** | The ladder-entry trigger left two semantics implicit | **Stated.** No backfill; `since` never resets on re-satisfaction | S8.1 |
| **P3** | The ciphertext sat in `core`, so the one-read-path guarantee held by grant rather than by structure | New `payout_secret` schema owned by `adulis_payout`. **Superseded in v1.3** -- merged into `financial` | S3, S13.6 |
| **P4** | `reservation_id` assignment was specified; its integrity was not | **Two constraints added** -- the line must belong to the order, and one open claim per scope. The evidence-append reading is recorded | S16 |

**One correction to v1.1, and it is mine.** The v1.1 review asserted that no transition leaves a terminal state. S11.4 requires exactly one: an in-window scan that syncs after the server has already expired an order must still complete it. `EXPIRED_UNCLAIMED` is therefore not terminal, and the transition is row 11 of the ratification set. Recorded as **R-1** in S12.3.

**Counts changed:** 101 -> **103** tables, nine -> **ten** schemas, six -> **seven** roles, 12 -> **14** review checks. Append-only tables remain **16**.

**Everything not listed above is carried forward from v1.1 unaltered.**

---

## 0.16 What changed in v1.1 -- retained for history

v1.1 records the eight rulings taken on 24 August 2026 and adds the material that could not be written until they were settled. **No mechanism changed.** Every constraint in v1.0 survives unaltered; what changed is that eight of them are now binding rather than provisional, and four gaps that the open questions were hiding are now specified.

| Area | v1.0 | v1.1 | Section |
|---|---|---|---|
| **C1-C8** | Eight contradictions with defaults applied pending a ruling | **All eight ruled. Recorded as binding.** S1 restructured from questions into decisions | S1 |
| **Order and reservation state machines** | Named as two machines (C2) but transitions unspecified | **Legal transitions specified as a data-driven table with a guard trigger** | S12.2 |
| **Payment disclosure log** | `core.payout_disclosure_log` referenced by the C3 mechanism, never defined | **Table specified** | S13.6 |
| **Cart and device lifecycle** | `device_id` named as the anonymous cart key (C6), lifecycle undefined | **Device registration, cart binding at identity creation, and purge specified** | S11 |
| **Claim line scope** | `reservation_id` nullable (C8), nothing said which paths set it | **Set by the S9.4 partial-fulfilment trigger; null for order-level triggers** | S16 |
| **Payment rejection path** | Not addressed | **Specified.** `PAYMENT_SUBMITTED -> NOTIFIED` on seller rejection -- see the write-back in S29 | S12.2 |
| **Level creation at eligibility** | C5 ruled `New` on eligibility; nothing created the row | **Trigger on eligibility satisfaction inserts `seller_level_state`** | S8.1 |
| **Enum catalogue** | Enums defined inline, scattered | **Consolidated. 48 types in one place** | Appendix A |
| **Table manifest** | Absent | **101 tables listed by schema with append-only flags** | Appendix B |
| **Migration review checklist** | Absent | **Twelve grep-able checks a non-expert can run against generated DDL** | Appendix C |
| **Rulings section** | "Rulings required before build" | **"Corrections required in other documents"** -- the schema is unblocked; six write-backs remain | S29 |

**Everything not listed above is carried forward from v1.0 unaltered.**

---

## 1. The eight contradictions, and how they are resolved

Eight items in the document set could not be transcribed into a schema as written. All eight were ruled on **24 August 2026** and the rulings below are binding on this document and on ADU-API-01.

**Each ruling carries a write-back.** A ruling recorded only here leaves ADU-PRD-01 saying something that cannot be built, and the next engineer -- or the next agent -- reads the PRD first. The consolidated write-back list is S29.

### C1 -- Price sits on the product in S7 and on the line in S8.4  -  **RULED**

ADU-PRD-01 S7: *"Products carry seller, name, description, price..."* while `ProductVariant` carries only attribute set, stock count and last-confirmed timestamp. S8.4 then captures *"the unit price in effect at the moment the order is created"* onto the **reservation**, which is one variant line.

If price is genuinely product-level, a seller cannot charge more for XL than for S, or for the 128GB model than the 64GB -- in fashion, cosmetics and electronics, the three launch categories. Retrofitting per-variant price later is a migration through live orders and captured prices.

> **Ruling.** Price lives on `core.product_variant`. `product.base_price_minor` exists and seeds new variants but is never the price of anything. A seller who does not differentiate never sees a second field: their variants all carry the base price.

### C2 -- One state machine in S9.1, two in S8.1  -  **RULED**

S9.1 draws a single lifecycle including `PAYMENT_CONFIRMED` and `REFUNDED`. S8.1 says the timer, the QR code, the payment, the scan and the review attach to the **Order**, while cancellation and refund attach to the **Reservation**. Both cannot be one machine: `PAYMENT_CONFIRMED` is meaningless per line, and `REFUNDED` is meaningless for an order that was half fulfilled.

> **Ruling.** Two machines. `order.state` carries the lifecycle and the order-level terminal outcomes; `reservation.state` carries the per-line outcome. Order-level terminal states are **derived** from the line states by a trigger, never written independently. `REFUNDED` exists only at reservation level.

Transitions are specified in S12.2, which is new in v1.1 and is the part of the schema most likely to be got wrong by generated code.

### C3 -- Payout details are "never redisplayed to anyone", but the buyer must be shown them  -  **RULED**

S10.4: *"payout details are masked everywhere after entry... The full number is written once and never redisplayed to anyone."* S10.1 step 2: *"the bot provides the seller's bank details."* S8.5: *"The payment instructions shown to a buyer are read from the order."*

A buyer cannot make a bank transfer to `****4471`. Taken literally, the invariant makes the product's only payment mechanism impossible.

> **Ruling.** The masking invariant is scoped to seller-facing, team, support and admin surfaces. The full value is stored encrypted with exactly one decryption path: rendering payment instructions for a specific order, to the buyer who holds that order, while that order is in a payable state. Every decryption writes a disclosure-log row in the same transaction.

Mechanically identical to the payment-evidence boundary in S10.3, and since v1.3 **housed in it**: the ciphertext lives in the `financial` schema alongside the payment screenshots that already carry the same value, behind the same role, the same two-function pattern and the same access log. Specified in S13.6.

**This is the write-back that matters most.** As ADU-PRD-01 S10.4 stands, an engineer building from the PRD alone builds something that cannot take a payment.

### C4 -- Deferred follow is removed in S17.1.1 and still required in S24  -  **RULED**

S17.1.1: *"The deferred-follow token from v8.3 is removed."* S24 test coverage still lists: *"Deferred follow: an anonymous web follow intent is claimed on first app open without a second prompt."*

> **Ruling.** S17.1.1 governs. No `deferred_follow` table, no claim token, no `follow_intent` row. The S24 test line is struck. `follow_intent_web` survives as an event only (S20), which is what S17.1.1 asks to be measured.

### C5 -- The trust ladder's "New" level has two different entry conditions  -  **RULED**

ADU-00 and ADU-PROJ-01 S3.3 say **New** is earned by *"ID verified."* ADU-PRD-01 S5.1 says *"Eligibility satisfied."* In Phase 1 almost no seller is ID-verified -- it is the paid blue tick (S13.1) -- so under the ADU-00 wording an entire Phase 1 cohort holds no level, and the ladder accumulates nothing before the day it starts mattering (S2: *"levels must accumulate from the first handoff"*).

> **Ruling.** ADU-PRD-01 S5.1 governs. `New` is entered when eligibility is satisfied by either path. ADU-00's ladder table and ADU-PROJ-01 S3.3 are corrected to match.

Consequence now specified in S8.1: a trigger on eligibility satisfaction inserts the `seller_level_state` row. In v1.0 the ruling existed with nothing to create the row.

### C6 -- The cart is server-enforced, but the buyer has no identity yet  -  **RULED**

S8.1 makes the one-seller cart rule an INVARIANT, which under the PRD's own preamble must be a constraint or a server-side check. But S6.1 creates identity *"at the moment of first reserve"* -- so when the second seller's item is added there is frequently no account to hang a cart row on.

> **Ruling.** `core.cart` is keyed by `device_id`, an app-generated anonymous identifier registered server-side on first launch, with `buyer_account_id` nullable and bound at identity creation. The one-seller rule is then a composite foreign key that holds for anonymous and identified carts alike.

The rejected alternative -- a client-held cart -- makes the invariant unenforceable, and S8.2 already requires a server round trip on every cart view for live availability. Lifecycle specified in S11.

### C7 -- Nothing says where waitlist data lives  -  **RULED**

ADU-WEB-01 S7.3 collects name, phone, handle, city and product category, retains it 12 months, and requires the DPIA to cover it **before the first submission**. ADU-PROJ-01 S11 runs Phase 0b in parallel with Phase 0 -- before product infrastructure is provisioned, and before S10's hosting-region question is answered.

> **Ruling.** The waitlist is its own store, in its own schema, with its own credentials. The product database is not a dependency of the public website. An import path exists for cohort onboarding and is specified in S25.

### C8 -- Claim scope is order-level in S14 and line-level in S9.4  -  **RULED**

S14's triggers are order-shaped. S9.4 produces a line-shaped one: *"Where the seller's stated reason is unavailable stock and the stock record was not current, the buyer may raise a claim."*

> **Ruling.** `core.claim` attaches to the order, with a nullable `reservation_id` naming the line where the dispute is line-specific. Evidence assembly and the demotion rule operate on the claim regardless of scope.

Which paths set `reservation_id` is specified in S16 -- the S9.4 partial-fulfilment trigger sets it; every order-level trigger leaves it null. **v1.2 adds the two constraints that make the assignment enforceable rather than merely documented**: the named line must belong to the named order, and only one claim may be open per scope.

**One further gap, carried from v1.0:** S16.8 opens a claim *"automatically on the buyer's behalf"* and S9.2's fulfilment window *"raises a claim trigger"* with no actor. `claim.opened_by_kind` therefore admits `SYSTEM` alongside `BUYER` and `MODERATION`. A model with a mandatory claimant account cannot represent either case.

---

## 2. Design doctrine

Ten rules. Everything below follows from them.

1. **A rule the database can hold, the database holds.** The binding engineering constraint is one beginner developer supervising AI agents (ADU-PROJ-01 S8.3). Generated application code is plausible far more often than it is correct, and the failure mode is silent. A `CHECK` is neither.
2. **Prefer a constraint to a trigger, a trigger to a function, a function to a service.** In that order, always, and drop down a level only when the level above cannot express the rule.
3. **Money is `bigint` minor units plus a currency code.** Never floating point, never a bare number. Every monetary column travels with its currency.
4. **Every timestamp is `timestamptz`, stored UTC** (S23). No column stores local time. Display timezone is per-market configuration.
5. **Append-only means the grant says so.** `REVOKE UPDATE, DELETE` from the application role, plus a trigger that raises. Two mechanisms because the first is invisible in a migration diff and the second is invisible in a permissions audit.
6. **Configuration is versioned rows with effective ranges, never constants and never a settings singleton.** S19 lists eight dimensions that are per-market; a new market is *"created by creating configuration and a locale pack, not by changing code."*
7. **Isolated boundaries are separate schemas with separate roles, and their only read path is a `SECURITY DEFINER` function that writes the access log in the same transaction.** You cannot read the evidence without logging the read, because there is no other way to read it (S10.3, S23).
8. **Derived state is derived.** Trust level, publication readiness, stock confidence, entitlement limits and order-level terminal state are computed from their evidence, not stored as an independently writable column that can drift from it.
9. **Nothing is hard-deleted that another party has an interest in.** Reviews anonymise; ID hashes survive account deletion; moderation and audit records are permanent (S16.9).
10. **The schema is neutral on every open PRD item.** Where ADU-PRD-01 S25 has not decided, the column exists, is nullable or configuration-backed, and either answer lands without a migration.

**An eleventh, added in v1.1 and directed at the agent rather than the database:** *where a rule is expressed by the absence of a column, that absence is load-bearing.* Eleven invariants in this document are enforced by there being nowhere to write the wrong thing -- no `original_key`, no `generated_text`, no `has_chatbot`, no score column on the feed. An agent "completing" the schema by adding one of them silently removes the guarantee. Appendix C is how that gets caught.

---

## 3. Physical layout

Nine schemas in one Postgres cluster. The separation is not cosmetic: **two** of them carry different grants, and those two are the ones holding data whose unlogged disclosure would be a reportable event under Proclamation 1321/2024 rather than an internal defect.

| Schema | Contents | App role access |
|---|---|---|
| `core` | Markets, configuration, accounts, sessions, sellers, catalogue, orders, trust, reviews, claims, follows, moderation | Full DML |
| `verification` | Government-ID attestations and their access log | **None.** Function calls only |
| `financial` | Payment screenshots, payout ciphertext, and the one access log covering both (S13.3, S13.6) | **None.** Function calls only |
| `chat` | Operational conversation record -- buyer, seller, message bodies | Full DML |
| `nlu` | Identity-stripped phrase library, intents, embeddings, regression set | Read + insert. **No foreign key to `chat` or `core` exists** |
| `billing` | Subscriptions, price schedules, collection records, inference metering | Full DML |
| `ledger` | Append-only double-entry record (S22) | Insert only |
| `analytics` | Versioned event stream, monthly partitions | Insert + read |
| `jobs` | graphile-worker | Managed by the library |

**INVARIANT -- `nlu` holds no foreign key, and no column, referencing a buyer, a seller, a conversation or an order.** S15.3 requires two separated stores. Separation enforced by a structural absence is checkable in five seconds by reading the DDL; separation enforced by convention is checkable by nobody.

**Database roles.**

| Role | Purpose |
|---|---|
| `adulis_app` | The NestJS connection. No access to `verification`, `financial`; no `UPDATE`/`DELETE` on append-only tables |
| `adulis_verification` | Owner of `verification`. Used by nothing at runtime; the app calls `SECURITY DEFINER` functions owned by it |
| `adulis_financial` | Same, for `financial` -- payment evidence and payout ciphertext |
| `adulis_jobs` | graphile-worker connection |
| `adulis_migrate` | DDL only. Not used at runtime |
| `adulis_readonly` | Analyst and paid-reviewer access. `SELECT` on `core`, `analytics`; nothing else |

### 3.1 Required extensions

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- HMAC for the keyed ID hash, gen_random_uuid
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- EXCLUDE constraints mixing = and &&
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- seller lookup and storefront search (S7.5, S7.6)
CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector, cascade layer 3 (S15.1)
```

[!] **This constrains the open hosting decision.** ADU-PROJ-01 S10 records hosting region as undecided. Whatever is chosen must offer `pgvector` and `btree_gist`, or two specified mechanisms -- the cascade's layer 3 and the duplicate-reservation invariant -- have no implementation. Local colocation on self-managed Postgres satisfies both trivially; some managed providers do not offer `vector`. **Add this to the criteria before the decision is taken, not after.**

No JSON Schema extension is assumed. Event payload validation (S22) is done in `plpgsql` against a stored key list, precisely so that the hosting decision stays open.

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

Two versions of the same configuration can never be in force at the same moment, and history is retained rather than overwritten. Reading "the configuration in force at time T" is `WHERE effective @> T` -- which is also how a payment SLA is computed against the active hours in force when the screenshot arrived (S10.2).

---

### 3.1a `adulis_jobs` and its path to `core`

**S24 gives this role twenty jobs and S3 never gave it a way to reach them** (D-47). Migration 01 granted `USAGE` on `core` to `adulis_app` and `adulis_migrate` and not to `adulis_jobs`, so **every one of the twenty would have failed on its first statement with `42501 permission denied for schema core`** -- the expiry sweep, the confirmation window, the notification sender, all of them.

**Nothing in production depended on it because nothing ran**, and the first symptom would have been a seller noticing that a 48-hour reservation had not expired.

> **`adulis_jobs` holds `USAGE` on `core`, and every table privilege explicitly and narrowly -- one line per privilege, each naming the job that fails without it.** It holds **no table privilege in `financial` at all**: the evidence purge reaches that schema through two boundary functions that name `payment_evidence` literally, so the role cannot name `payout_credential` even by accident (D-48).

**Proven as the role, never inferred.** The probe that found D-47 ran before a line of the worker was written, and the test harness refuses an admin connection -- because **an invoker trigger writing a table the job's own statement never mentions passes every statement test and fails the first time a real row moves** (two further instances found the same way).

### 4.4a The definer discipline

**Stated here because it appeared in no document, and its absence produced the two worst findings of this project.**

> **INVARIANT -- every `SECURITY DEFINER` function is owned by the role whose privileges it is meant to lend, has `EXECUTE` revoked from `PUBLIC`, is granted by name to the roles that need it, and -- fourth clause, v1.13 -- **the owning role holds, on every object the body touches, the privileges the body needs.**
>
> ```sql
> ALTER FUNCTION <schema>.<fn> OWNER TO <the boundary role>;
> REVOKE ALL ON FUNCTION <schema>.<fn> FROM PUBLIC;
> GRANT EXECUTE ON FUNCTION <schema>.<fn> TO <named role>;
> ```

**Three defaults conspire here and none of them is obvious.** PostgreSQL grants `EXECUTE` on a new function to `PUBLIC`. A function created by a superuser is **owned** by that superuser, so `SECURITY DEFINER` lends *superuser* privileges and bypasses RLS entirely. And neither produces an error -- **the system works perfectly, which is what an unenforced boundary looks like.**

**SR-1** found ten definer functions executable by `PUBLIC`, including all six financial and verification boundary functions: **callable by any connecting role, naming any actor**, with the access log faithfully recording the actor the caller nominated. **D-50** found one owned by the superuser for four work orders. Every test passed throughout, because the tests exercised the legitimate path and the illegitimate one was never tried.

**The fourth clause is not implied by the first three, and the billing trap proved it.** `adulis_migrate` owned every `SECURITY DEFINER` function in `billing` and held **nothing** on `billing.collection_record`. A doctrine-correct reconciliation function therefore **created cleanly, migrated cleanly, passed every static check, and would have raised `42501` the first time an operator reconciled a real bank transfer.** Ownership lends the owner's privileges -- **and an owner with none lends none.**

> **The check for it is not static: call every new definer function in a test.** A function nobody has invoked is a grant nobody has verified, which is why the four migrations that seeded SR-1's exposure passed review.

**And a related rule the same sweep produced (D-49): every table is owned by its schema's owner, not by whoever ran the migration.** `analytics.event` was bootstrap-owned inside a schema authorized to `adulis_migrate`, so **no definer could attach a partition to it** and every event since Tier 2 landed in the default partition. R19's future detach-and-export needs the same privilege.

**Appendix C check 10 enforces the class**, not the instances: no definer function is `PUBLIC`-executable, and none is owned by a superuser.


## 5. Markets and configuration

### 5.1 `core.market`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `code` | text UNIQUE | `ET`, `KE`, ... |
| `display_name` | text | |
| `phase` | `market_phase` | `PHASE_1`, `PHASE_2` |
| `display_currency` | currency_code | |
| `display_timezone` | text | IANA name |
| `default_locale` | locale_code | |
| `is_live` | boolean | |

**INVARIANT -- phase is a column on the market, never a global flag** (S19). A mature home market may be Phase 2 while a new market opens Phase 1.

**INVARIANT -- `market.phase` cannot be set to `PHASE_2` unless the three gate conditions in `core.market_phase_gate` are all satisfied.** Enforced by a `BEFORE UPDATE` trigger reading that table. ADU-PROJ-01 S11 phase 5 makes those conditions build dependencies, not policy preferences; a trigger is the difference between a dependency and a hope.

### 5.2 `core.market_phase_gate`

One row per market. Four conditions, **each with its own attestation pair** -- S5.2 said *"each with"* and this is what that means, thirteen columns rather than six:

| Column | Type |
|---|---|
| `market_id` | uuid, primary key |
| `v3_discovery_live`  -  `v3_discovery_live_attested_by`  -  `v3_discovery_live_attested_at` | boolean  -  uuid  -  timestamptz |
| `kyc_vendor_integrated`  -  `kyc_vendor_integrated_attested_by`  -  `kyc_vendor_integrated_attested_at` | boolean  -  uuid  -  timestamptz |
| `ladder_operating`  -  `ladder_operating_attested_by`  -  `ladder_operating_attested_at` | boolean  -  uuid  -  timestamptz |
| `dpia_revisited_at`  -  `dpia_revisited_attested_by`  -  `dpia_revisited_attested_at` | timestamptz  -  uuid  -  timestamptz |

**Per condition, not per row, and the difference is the whole point.** One attestation pair for the row records that *somebody signed off on something*. Four pairs record **who attested which gate and when** -- which is the question asked when a market went live and one of the four turns out not to have been true.

Set by operator action under `core.operator_grant`, logged. A `CHECK` requires the attestation pair to be non-null whenever its condition is set.

### 5.3 Configuration tables

All versioned by the effective-range pattern in S4, all scoped by `market_id`.

| Table | Carries | PRD |
|---|---|---|
| `core.eligibility_config` | `audience_required bool`, `follower_threshold int NULL`, `counting_platforms platform[]`, `threshold_basis`, `permitted_seller_types`, `id_verification_requirement` | S4.1 |
| `core.ladder_config` | Level thresholds, caps, demotion rules, anti-gaming window -- **columns in S5.5** | S5.1, S5.2 |
| `core.timing_config` | `reservation_window` (48h), `payment_confirmation_window` (24h), `fulfilment_window`, `offline_sync_horizon` (7d), `payout_activation_delay` (24h), `recovery_cooling_period` (7d), `deleted_number_cooling_period`, `refund_ack_window`, `media_retention`, `level_credit_grace` (24h), session lifetimes and the cancellation-penalty ladder -- **columns in S5.5** | S25 open items |
| `billing.price_schedule` | Tier prices, `usd_reference`, prepay discounts, `derived_at`, effective range | S16.6 |
| `core.locale_pack` | Available locales, default, machine-translation flag -- **columns in S5.4** | S19 |
| `core.identity_config` | Whether identity is required, vendor family, accepted document types -- **columns in S5.4** | S13.1 |
| `core.legal_config` | Document versions and URLs, retention intervals, prohibited categories, invoice format -- **columns in S5.4** | S19 |

**INVARIANT -- `eligibility_config.follower_threshold` is nullable and null means no threshold** (S4.1). Not zero, which would read as "a threshold of zero exists". Not a magic sentinel. Setting a number later is an `INSERT` of a new effective row and touches no code.

**Every one of ADU-PRD-01 S25's twelve "can ship at a default" items is a column in `core.timing_config`.** They ship at the PRD's stated defaults and are tuned by inserting a new configuration version. None of them blocks the build, which is the point of putting them here.

---

### 5.5 `ladder_config` and `timing_config` -- the columns they only described

**Register items C1, C2 and C7.** Both tables were described by what they "carry" and never given columns. S5.4 did this for three tables; these are the remaining two.

#### `core.ladder_config`

| Column | Type | ADU-VAL-01 |
|---|---|---|
| **`new_to_established_min_tenure`** | interval | **60 days** -- G1.2 |
| **`new_to_established_min_orders`** | int | **50** -- G1.2 |
| `established_min_avg_rating` | numeric(3,2) | Group A, still deferred |
| `established_max_claim_rate` | numeric(5,4) | Group A, still deferred |
| `trusted_min_handoffs` | int | Group A |
| `trusted_window` | interval | Group A |
| `trusted_min_scan_completion_rate` | numeric(5,4) | Group A |
| `trusted_max_claim_rate` | numeric(5,4) | Group A |
| `demotion_max_claim_rate` | numeric(5,4) | Group A |
| `demotion_max_cancellation_rate` | numeric(5,4) | Group A |
| `demotion_min_scan_completion_rate` | numeric(5,4) | Group A |
| `demotion_window` | interval | Group A |
| `new_level_product_cap` | int | **10** -- G1.2 |
| `new_level_transaction_cap_minor` | bigint **NULL** | **NULL = no cap.** G1.2 rules there is none at MVP. The column stays so that setting one later is an `INSERT`, not a migration |
| `distinct_buyer_window` | interval | Group C |
| `distinct_buyer_max_count` | int | Group C |

> **RULING G1.2 -- the NEW level has an exit, and BOTH arms must be satisfied.** A seller leaves NEW when **`tenure >= new_to_established_min_tenure`** **AND** **`completed orders >= new_to_established_min_orders`**. Both values are set: **60 days and 50 orders.**
>
> **This is the first ladder transition with real numbers**, and it means the ladder is no longer inert. `fn_recompute_seller_level` still fails closed on the transitions whose thresholds are NULL -- ESTABLISHED to TRUSTED, and every demotion rule except the claim invariant -- so a seller can now reach ESTABLISHED and no further, which is the correct MVP shape.

**`AND` is the safer of the two and it closes a real hole.** An earlier draft made this `OR`, which promoted a **dormant** seller: sign up, never trade, and sixty days later leave NEW on tenure alone -- an uncapped catalogue and no caution flag, having done nothing. Under `AND` the tag can only be earned by trading, which is what the trust ladder claims to measure.

[!] **The mirror case, recorded once.** A seller who reaches fifty orders in three weeks still waits until day sixty, capped at ten products throughout. `AND` rewards nobody early. That is the correct trade for a hand-picked beta -- **a wrongly-promoted seller costs a buyer, a slowly-promoted one costs a seller some patience** -- and both numbers are configuration rows, so the balance is tunable from Phase 0 evidence rather than from either of our guesses.

**An upheld claim still always demotes, regardless of any of this** (S5.2). That invariant is independent of every threshold above and is not configuration.

**`new_level_transaction_cap_minor` is NULL and the check that reads it must treat NULL as absent, not as zero.** S12's order-creation function compares against it; a NULL comparison yields NULL, which is not true, so the cap correctly does not fire -- but write that as the intended behaviour rather than leaving it to three-valued logic, exactly as S8's threshold comparisons do.

> **The columns are named here; the values are deferred to ADU-VAL-01 and that deferral is deliberate.** ADU-PRD-01 S5.1: *"all thresholds are per-market configuration records, published to sellers and never secret."* The PRD declines to give numbers because the beta exists to find them. **An unnamed column blocks migration 8; an unseeded row blocks only the market seed** -- so naming them now and deferring the values costs nothing and unblocks the next two migrations.

**Rates are `numeric`, not float.** A claim rate compared against a threshold decides whether a livelihood is restricted; binary floating point is the wrong type for a comparison whose result someone will contest.

**`demotion_*` is a separate set from `established_*`, deliberately.** Demotion thresholds are not the promotion thresholds read backwards -- a seller demoted the instant they fall below the bar they climbed would oscillate on a single bad week. The gap between the two sets is hysteresis, and it needs its own numbers.

#### `core.timing_config` -- the additions

| Column | Type | Note |
|---|---|---|
| `same_seller_cancellation_threshold` | int | **3** -- ADU-PRD-01 S9.5 |
| `same_seller_cooldown` | interval | **1 hour** |
| `cross_seller_cooldown_ladder` | interval[] | **`{1 day, 2 days, 4 days}`** -- escalating; the last value repeats |
| `cancellation_counter_decay` | interval | **30 days** of clean activity |
| `mobile_session_lifetime` | interval | **Renamed from `buyer_session_lifetime`** -- C7 |

**C2 was never open.** ADU-PRD-01 S9.5 states the ladder in full: *three consecutive cancellations with one seller -> 1 hour; a pattern across multiple sellers -> 1 day, then 2 days, escalating; the counter decays after 30 days of clean activity.* It was described in S5.3 and never transcribed. These are **SET**, not deferred.

**The ladder is an `interval[]`, indexed by offence count, and the final element repeats.** An escalating penalty with no ceiling eventually bans a buyer permanently for cancelling, which is not what S9.5 describes -- *"cancelling actively is penalised less than letting an order expire silently"* is the doctrine, and a terminal penalty inverts it.

> **C7 -- there is no `seller_session_lifetime`, and there cannot be.** R2 collapsed the audiences to `MOBILE` and `CONSOLE`, so the two lifetime columns must be **`mobile_session_lifetime`** and S6.6a's four console columns. `buyer_session_lifetime` is renamed and `seller_session_lifetime` is dropped -- it described an audience that no longer exists, and leaving it invites a `CHECK` that orders the console pair against the wrong column. The `CHECK` now names `mobile_session_lifetime` explicitly rather than inferring it.

---

### 5.5a Deferral is a state the schema holds -- a principle, not a per-column decision

**For four work orders every value ADU-VAL-01 marked OPEN was given a `NOT NULL` column** (D-61), which is not a deferral -- it is **an invention with a later deadline**, and the schema was quietly requiring the build to break the standing rule that forbids inventing a deferred value.

> **INVARIANT -- a column whose value is deferred is nullable, and its consumer fails closed on NULL.**
>
> The consequences of the old shape were three, and **none of them raised**: S12.3's *"the column is NULL and the check does not fire"* could not be expressed at all; A1.3's stated mechanism for TRUSTED being unreachable was **false**, because a configured market had to supply all four `trusted_*`; and the `coalesce(..., false)` guards were **guarding against a value the schema forbade** -- decorative, and they read as careful.

**The ladder was inert only because no `ladder_config` row existed**, and that protection ends the day a market is configured. **A safety that depends on a table being empty expires the first time somebody fills it.**

**Enforced by a gate, not by review:** ADU-VAL-01 S1.1 names every OPEN column; `verify:deferred-values` asserts each is nullable in the live schema, **and pins the count** -- because two forms that shrink together agree perfectly (D-121's class).

### 5.4 The three configuration tables that had no columns

**D8.** `locale_pack`, `identity_config` and `legal_config` are named in S5.3 and in Appendix B, are referenced by S13 and S19 -- and **not one column of any of them is defined anywhere in v1.8.** An agent cannot build a table from a description of what it "carries."

All three follow S4's versioned pattern: `market_id`, `effective tstzrange`, an `EXCLUDE USING gist (market_id WITH =, effective WITH &&)` so versions cannot overlap, and `created_by_account_id`. Only the payload columns are given below.

**`core.locale_pack`**

| Column | Type | Note |
|---|---|---|
| `default_locale` | `core.locale_code` | Rendered when a client sends no usable `Accept-Language` |
| `available_locales` | `core.locale_code[]` | **`CHECK (default_locale = ANY(available_locales))`** and **`CHECK (cardinality(available_locales) > 0)`** |
| `machine_translation_enabled` | boolean | Free-text product and store descriptions only (S19) |

[!] **This is not the `AM_ENABLED` flag.** That flag governs whether the console renders a language switcher and is a build-time concern (ADU-CON-02 S9). This row governs what the **server** will accept and render. A locale is legitimately *available here and hidden in the client* -- which is exactly the state while Amharic is machine-translated and awaiting human review.

**`core.identity_config`**

| Column | Type | Note |
|---|---|---|
| `identity_required` | boolean | Whether `IDENTITY_VERIFIED` is a readiness item in this market at all |
| `verifier_kind` | `verification.verifier_kind` | Which vendor family |
| `accepted_id_types` | text[] | **`CHECK (NOT identity_required OR cardinality(accepted_id_types) > 0)`** -- a market that requires identity must say what it accepts |
| `vendor_reference_pattern` | text NULL | Optional format assertion on the vendor's returned reference |

**No vendor credential lives here.** Endpoints and API keys are deployment secrets (ADU-CON-02 S18). This row says *which* vendor family and *what* it must return -- never how to reach it.

**`core.legal_config`** -- one row per market per version, covering everything S5.3 says it carries.

| Column | Type | Note |
|---|---|---|
| `terms_version`  -  `terms_url` | text | |
| `privacy_version`  -  `privacy_url` | text | |
| `seller_agreement_version`  -  `seller_agreement_url` | text | |
| `requires_reacceptance` | boolean | Whether existing users must accept again on this version |
| `evidence_retention`  -  `chat_retention`  -  `analytics_retention` | interval | The purge jobs of S24 read these, never a constant |
| `prohibited_categories` | text[] | Refused at product creation |
| `invoice_number_format` | text | S16.8 |

> **INVARIANT -- the legal text is not stored in the database.** Only a version label and a URL. The text is served from the public website and versioned there, and holding a second copy here creates two texts that can disagree about what a person actually agreed to. An acceptance record points at `terms_version`, not at prose.

**Retention intervals are configuration, not constants**, which is what lets a market with a different data-protection regime be served without a migration -- and what stops a purge job hard-coding ninety days in one place and one hundred and eighty in another.

---

## 6. Identity, accounts and access

### 6.1 `core.account`

The authentication entity. **One phone number, one account** (S6.1).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `phone_e164` | e164 UNIQUE | The authentication factor (S6.2) |
| `market_id` | uuid FK | |
| `person_id` | uuid FK NULL | Set when an identity attestation exists |
| `status` | `account_status` | |
| `created_at`, `scrubbed_at` | timestamptz | |

**Roles are relationships, not accounts** (S6.3). `buyer_profile`, `seller`, `seller_team_member` and `seller_courier` all reference `account`. One person holding all four roles on one number is the ordinary case and requires no special handling -- it is what the model already says.

### 6.2 `core.person`

The natural person, distinct from the account, because S4.4 requires the keyed ID hash stored **once per person and referenced by each seller account**, and S16.9 requires it to **survive deletion**. A person-scoped row is what survives when every account of theirs is scrubbed.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `id_hash` | bytea UNIQUE NULL | HMAC-SHA256 of the ID number, key in a managed store, rotatable (S13.1) |
| `id_hash_key_version` | int | Rotation without losing cross-account detection |

**INVARIANT -- `person` is never deleted.** No `DELETE` grant. Duplicate-identity detection across accounts (S4.4, S13.2) is `SELECT ... WHERE id_hash = $1`, and it must still work after the seller closed the account.

A keyed hash rather than a per-record salt, exactly as S13.1 states: the purpose is detecting the same ID across accounts, and a per-record salt makes that impossible.

### 6.3 `core.buyer_profile`

One per account, created at first reserve (S6.1). Reservation history, confirmation rate, cancellation history, claims filed and claims upheld are **derived views**, not stored counters -- except the cancellation cooldown state in S12.7, which needs a decaying window.

### 6.3a `core.seller_courier_invite` -- pending invites

**G1.8.** A seller invites a courier by phone number. Before this ruling, a number with no account returned **404** -- and that response is a **registration oracle**: anyone holding a seller account could test arbitrary phone numbers for Adulis membership.

```sql
CREATE TABLE core.seller_courier_invite (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id    uuid NOT NULL REFERENCES core.seller(id) ON DELETE CASCADE,
  phone        core.e164 NOT NULL,
  invited_by_account_id uuid NOT NULL,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  claimed_at   timestamptz NULL,
  claimed_by_account_id uuid NULL,
  revoked_at   timestamptz NULL,
  UNIQUE (seller_id, phone)
);
```

> **INVARIANT -- an invite succeeds whether or not the number has an account, and the response is byte-identical either way.** The row is written; it surfaces when that person next signs in. **Nothing is learned by inviting.**
>
> This is the same rule as S19's scope failure returning 404 rather than 403, and S22's rate-limit rejection never revealing whether a number belongs to an account. **The better user experience and the correct security posture are the same build here**, which is why the table is worth it.

**Couriers only at MVP.** Team invites keep the current behaviour because team is Business tier and post-beta -- recorded so the asymmetry is a decision rather than an oversight.


### 6.4 `core.device`

Anonymous, app-generated, registered on first launch. Required by C6 for the pre-identity cart, and by S17.3 for the notification-permission fallback.

| Column | Notes |
|---|---|
| `id` uuid PK | Generated by the app, registered on first launch |
| `platform` | `ANDROID`, `IOS` |
| `push_token text NULL` | |
| `notification_permission` | `GRANTED`, `DENIED`, `NOT_ASKED` (S17.3) |
| `account_id uuid NULL` | Bound at identity creation, never before |
| `first_seen_at`, `last_seen_at` | |

**A device row carries no personal data.** It holds a push token and a permission state, both of which are properties of an app installation rather than a person. That is what makes it safe as the anonymous cart key, and it is why the purge in S11 is unremarkable rather than a data-protection event.

**G1.11 -- `core.device` carries `market_id`, assigned at the first `/v1/bootstrap` call**, which already resolves a market. That removes the marketless case rather than answering it.

> **Where a device genuinely has no market, retention falls back to the SHORTEST interval in force, never the longest.** A retention default must fail toward deletion. Falling back to the longest keeps anonymous data longest exactly where the system knows least about whose it is -- the wrong direction under a data-protection regime, and the wrong direction to have to explain.

The cart concern is smaller than it looks: the shortest window in force is measured in weeks, and no shopper is mid-session for weeks.

### 6.5 `core.otp_challenge`

| Column | Notes |
|---|---|
| `purpose` | `SIGN_IN`, `STEP_UP`, `ACCOUNT_DELETION`, `RECOVERY` |
| `phone_e164`, `code_hash`, `attempt_count`, `expires_at`, `consumed_at` | |
| `step_up_action` | NULL, or which S6.5 action this authorises |

**INVARIANT -- no session may be created from an OTP challenge whose purpose is `ACCOUNT_DELETION`.** S3.0 and ADU-WEB-01 S6.2: the deletion OTP *"issues no session, grants access to no other surface."*

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

`account_id`, `audience` (`MOBILE`, `CONSOLE`), `device_id`, `account_device_id NULL`, `first_seen_at`, `last_activity_at`, `approx_location text NULL`, `expires_at`, `revoked_at`, `revoked_by_session_id`, `created_from_otp_id`.

**R2 -- the audience enum is two values, not three.** ADU-AUTH-01 S12 is adopted: the courier restriction is row-level security keyed on `current_setting('adulis.actor_role')`, **resolved per request, not per session**, so a separate `COURIER_WEB` audience enforced nothing the RLS policy was not already enforcing -- while forcing a person who is both courier and seller to hold two logins for one account, a case ADU-PRD-01 S6.3 calls ordinary. `SELLER_WEB` is renamed `CONSOLE` and `COURIER_WEB` is removed. The rename happens in migration 1, before any permission row is seeded; taken later it is a data migration.

**INVARIANT -- session lifetime is per-market configuration, and a `CONSOLE` session is shorter than a `MOBILE` one** (S6.4). `expires_at` is set from `core.timing_config` at creation; a `CHECK` enforces the ordering so a configuration edit cannot invert it. Under R17 the console has two lifetime pairs, remembered and not; the `CHECK` orders both against `MOBILE` (S6.6a).

**S6.4's reasoning survives the architecture change intact.** It held that *a buyer losing a session loses convenience; a seller losing one loses payout control.* Under ADU-ARCH-01 v2.0 one mobile session serves both modes -- but **payout control is not reachable from mobile at all** (S6.9a), so the short lifetime attaches to the surface where the dangerous capabilities live rather than to the person holding it.

**INVARIANT -- revocation takes effect server-side immediately, not at next token refresh** (S6.4). **This becomes load-bearing rather than merely correct under ADU-ARCH-01**: the seller console is a browser surface holding payout access, where a stolen session token is a realistic outcome and a stateless token outliving its row would be unrecoverable. Consequence: **the session row is read on every authenticated request.** No stateless JWT whose validity outlives its row. This is a real cost -- one indexed primary-key lookup per request -- and it is the price of the invariant. It is affordable because Postgres is the sole datastore and this is its cheapest possible query.

**INVARIANT -- a new-device sign-in on a seller, team member or courier account notifies the registered number and is not suppressible** (S6.4). A trigger on `session` insert enqueues the notification when no prior session exists for that `(account_id, device_id)`. Enqueued by the database, so it cannot be forgotten by a service path.

### 6.6a `core.account_device` -- remembered console devices

**R17 exists because of an economic finding, not a security one.** With a 30-minute console idle timeout and OTP as the only sign-in factor, every return after a coffee break costs one SMS. ADU-CON-02-A1 modelled the specified design at **$648/month in sign-in messages at 1,000 sellers and $6,500 at 10,000** -- against a $50 infrastructure target -- with the 3-OTP/hour phone limit beginning to lock out honest sellers. The specification, followed exactly, produced that.

**`core.account_device`** -- `account_id`, `device_id`, `token_hash bytea NOT NULL`, `label text NULL`, `remembered_at`, `last_used_at`, `expires_at`, `revoked_at NULL`, `revoked_by_session_id NULL`. `UNIQUE (token_hash)`.

**`core.timing_config` gains four columns:** `console_session_lifetime`, `console_idle_timeout`, `console_remembered_lifetime` (7 days), `console_remembered_idle` (8 hours).

| Console session | Absolute | Idle |
|---|---|---|
| Remembered device | `console_remembered_lifetime` | `console_remembered_idle` |
| Any other device | `console_session_lifetime` | `console_idle_timeout` |

**INVARIANT -- the `CHECK` on `timing_config` orders both console pairs against the mobile lifetime**, so a configuration edit cannot make a console session outlive a mobile one in either mode.

**The token is stored hashed, never in the clear.** A `core.account_device` row is not a credential; it is the record of one. The browser holds `__Host-adulis_device`; the database holds its hash, exactly as `session` holds an opaque token it can revoke.

**Why the longer window is safe here, stated plainly.** A longer session is a longer window for a stolen cookie, and three things carry that risk. The cookie is `HttpOnly` and `__Host-`-prefixed, so theft requires device compromise rather than XSS. **Every S6.5 step-up capability demands a fresh OTP regardless of session age** -- that is the control protecting money, and it is untouched. And the payout activation delay (S13.4) plus the per-order payout snapshot (S13.5) mean even a fully compromised session cannot reroute money already in flight. The 30-minute idle was defending the borrowed-laptop case; the remembered flag is the seller asserting *this is not that laptop*, and un-remembered devices keep the strict values.

Remembered devices appear in the sessions screen by `label` and are revocable individually or by `seller.sessions:revoke_all`. Revoking a device revokes every session created from it, in the same transaction.

### 6.11 `core.operator_grant` -- the operator model

**Moderation, claim review, identity verification, account recovery and the trust ladder's human-review route all describe an operator making a decision, and through v1.6 nothing defined what an operator was** (ADU-CON-01 F6; ADU-AUTH-01 S20.1). ADU-DPIA-01 S7.4's open item R11 depends on this: a person contesting a machine-made restriction on their livelihood needs someone with standing to hear it.

**`core.operator_grant`** -- append-only: `account_id`, `role core.operator_role`, `granted_by_account_id`, `granted_at`, `revoked_at NULL`, `revoked_by_account_id NULL`, `reason text`.

`operator_role` is `SUPPORT`  -  `MODERATOR`  -  `CLAIM_REVIEWER`  -  `IDENTITY_REVIEWER`  -  `ADMIN`.

**INVARIANT -- an operator grant is a relationship on an account, never an account type.** There is no operator login, no operator account table and no impersonation column. An operator is a person with a phone number and a grant, which is what makes S7.3's and S13.3's derived `actor_role` possible at all -- R5 has something to derive *from*.

**INVARIANT -- the table is append-only.** Revocation sets `revoked_at`; it never deletes the row. Who could read a bank record last March is a question the audit logs cannot answer alone.

**A founder holding all five roles is fine. A founder holding all five because none exist is not.**

[!] **E4 -- the founder grant is not seeded in migration 5, and cannot be.** v1.9 said it was. **No founder account id exists in any document**, `core.account` has no seed, and a grant referencing an account that does not exist would have to invent it. The founder account is created by the ordinary phone-OTP sign-up path like any other, and the grant becomes a **documented operational step at Tier 4**, taken once against the real account id and recorded in `ops/runbooks/`. Tests use a fixture account created inside the test transaction -- which is what proves the grant works without seeding a real one, and is why `read_attestation` could be tested in Tier 1 with no operator existing.

**The surface is out of scope for this document and for the seller console.** ADU-CON-01 R6 rules the operator console a separate deployment on its own origin: an operator has no seller relationship, so mixing operator grants into a seller-scoped surface gives the scope model two shapes in one codebase and widens the blast radius of a console compromise from one seller's payout to every seller's identity attestations.


### 6.7 `core.step_up_challenge`

`account_id`, `action`, `target_ref uuid`, `otp_challenge_id`, `satisfied_at`, `expires_at`.

**INVARIANT -- the six S6.5 actions require a fresh challenge regardless of an active session, enforced server-side including on direct API calls.** Every mutation implementing one of those actions takes a `step_up_challenge_id` argument and the writing function verifies `satisfied_at` is within the freshness window. Not middleware -- a parameter, so a code path that omits it does not compile.

Viewing payment evidence is deliberately **not** in this set (S6.5). The PRD's reasoning is worth preserving in a comment on the enum: a challenge on routine work trains people to approve challenges without reading them.

### 6.8 `core.account_recovery_case`

`account_id`, `requested_at`, `reason`, `operator_account_id`, `evidence_relied_on jsonb`, `decision`, `decided_at`, `payout_locked_until`.

**INVARIANT -- the reviewing operator's decision, the evidence relied on, and the reason are logged** (S6.6). Append-only.

**INVARIANT -- payout details cannot be changed for the cooling period after any recovery** (S6.6, S10.4). `payout_locked_until` is written by the same statement that approves the recovery. One transaction, two effects -- the attack in S6.6 is "recover the account, then immediately change the bank details", and the two writes must not be separable.

### 6.9 Team members and couriers

**`core.seller_team_member`** -- `seller_id`, `account_id`, `role`, `invited_by`, `suspended_at`, `revoked_at`. Unique on `(seller_id, account_id)` where not revoked.

**INVARIANT -- exactly one `OWNER` per seller.** Partial unique index. S16.9 gives the Owner a power no Admin has; a seller with two Owners or none makes that rule unresolvable.

**INVARIANT -- RBAC is enforced server-side on every endpoint, never by hiding UI** (S16.2). `core.fn_has_permission(account_id, seller_id, permission)` is the first statement of every seller-scoped writing function. Permissions live in `core.role_permission` so the matrix is data a reviewer can read in one query.

**`core.seller_courier`** -- `seller_id`, `account_id`, `invited_at`, `revoked_at`.
**`core.order_courier_assignment`** -- `order_id`, `courier_account_id`, `assigned_at`, `ended_at`.

**INVARIANT -- a courier account can read only the orders currently assigned to it, and assignment ending ends access to that order's buyer information** (S6.3). Enforced by row-level security:

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

### 6.9a `core.permission` -- surface is a property of the capability

ADU-ARCH-01 S3.4: **no action in S6.5 is reachable from the mobile app, on any screen, by any route.** That has to be structural, or the Companion becomes a way around controls the console enforces.

```sql
CREATE TABLE core.permission (
  code              text PRIMARY KEY,                 -- 'seller.orders:respond'
  surfaces          core.session_audience[] NOT NULL, -- which surfaces may exercise it
  requires_step_up  boolean NOT NULL DEFAULT false,   -- D1: a column, not a list
  CONSTRAINT surfaces_not_empty CHECK (cardinality(surfaces) > 0)
);

CREATE TABLE core.role_permission (
  role            core.team_role NOT NULL,
  permission_code text NOT NULL REFERENCES core.permission(code),
  PRIMARY KEY (role, permission_code)
);
```

`core.fn_has_permission(account_id, seller_id, permission_code, audience)` now checks **both**: the role grants the capability, **and** the calling surface may exercise it.

**Defined here for the first time** -- v1.9 cited this function in five places and never gave its body. Absorbed from amendment A1.3 with A2's two rulings applied.

```sql
CREATE FUNCTION core.fn_has_permission(
  p_account uuid, p_seller uuid, p_permission text, p_audience core.session_audience
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = core AS $$
DECLARE v_role core.team_role;
BEGIN
  -- 1. Owner. There is no suspended_at on core.seller: seller-level
  --    suspension is gate 0 and belongs to the calling function.
  SELECT 'OWNER'::core.team_role INTO v_role
    FROM core.seller s
   WHERE s.id = p_seller AND s.owner_account_id = p_account;

  -- 2. Live membership. AT MOST ONE ROW, guaranteed by the partial unique
  --    index seller_team_member_live on (seller_id, account_id)
  --    WHERE revoked_at IS NULL. Anything that changes that index changes
  --    this function's correctness.
  IF v_role IS NULL THEN
    SELECT tm.role INTO v_role
      FROM core.seller_team_member tm
     WHERE tm.seller_id    = p_seller
       AND tm.account_id   = p_account
       AND tm.suspended_at IS NULL
       AND tm.revoked_at   IS NULL;
  END IF;

  -- 3. No live standing. 403 if they EVER held a relationship, 404 if never.
  --    EXISTS, not SELECT INTO: a revoked-then-reinvited member holds
  --    several rows and we need no role from them, only the fact.
  IF v_role IS NULL THEN
    IF EXISTS (SELECT 1 FROM core.seller_team_member tm
                WHERE tm.seller_id = p_seller AND tm.account_id = p_account) THEN
      RAISE EXCEPTION 'permission denied' USING ERRCODE = 'U0001';  -- 403
    END IF;
    RAISE EXCEPTION 'out of scope' USING ERRCODE = 'U0002';         -- 404
  END IF;

  -- 4. Role grant AND surface, in ONE query, so the two cannot be told apart.
  IF NOT EXISTS (
    SELECT 1 FROM core.role_permission rp
      JOIN core.permission p ON p.code = rp.permission_code
     WHERE rp.role = v_role AND rp.permission_code = p_permission
       AND p_audience = ANY(p.surfaces)
  ) THEN
    RAISE EXCEPTION 'permission denied' USING ERRCODE = 'U0001';  -- 403
  END IF;
END $$;

REVOKE ALL ON FUNCTION core.fn_has_permission FROM PUBLIC;
GRANT EXECUTE ON FUNCTION core.fn_has_permission TO adulis_app;
```

[!] **E6 -- ownership transfer needs `ON UPDATE CASCADE`, and Tier 7 will discover this if it is not written down now.** The transfer updates `owner_account_id`, which is a composite-FK anchor, so **every child FK referencing `(seller_id, owner_account_id)` needs the cascade or the transfer raises.** Added when those FKs are created, not when the transfer is built.

> **INVARIANT -- the Owner is `core.seller.owner_account_id`, and `core.seller_team_member` never holds an `OWNER` row.** Enforced by `CHECK (role <> 'OWNER')`. Two sources of truth for one fact is how a person ends up Owner in one table and Admin in another. The seller row wins because `UNIQUE (id, owner_account_id)` is already a composite-FK anchor throughout S9-S12 and cannot move.

> **INVARIANT -- the live-membership lookup depends on `seller_team_member_live` for its uniqueness, and step 3 depends on nothing.** A3.3's body read membership *regardless of standing*, and that index is unique only `WHERE revoked_at IS NULL` -- so a member revoked and later re-invited holds several rows, and a bare `SELECT INTO` takes an arbitrary one. **A member in good standing could have been denied because the planner returned their old revoked row.**
>
> **The fix is not an `ORDER BY`; it is not needing the row.** Step 3 has to answer one question -- *did this account ever hold a relationship* -- and `EXISTS` answers it without selecting a role. Multiplicity stops mattering because nothing reads the ambiguous rows.

> **INVARIANT -- a suspended team member loses every permission on the next request** (R28). S18.1 disables suspended logins, but **disabling a login does not end a live session** -- under R17 a suspended Admin would otherwise keep payout access, evidence reads and staff administration for up to seven days. The predicate is the control because it is on the row every authorization check already reads: immediate, free, and impossible for a service path to skip. A trigger also revokes that member's sessions, as hygiene -- if it fails, the boundary still holds.

> **INVARIANT -- standing, role and surface all raise `U0001` and are indistinguishable to the caller; only *never having held a relationship* raises `U0002`.** The 404 exists to defeat enumeration by strangers (ADU-AUTH-01 S19). A suspended Admin is not a stranger -- they worked there, they know the store exists, and telling them it does not protects no secret while producing a support ticket that looks like a bug. **The boundary is "did you ever have standing," not "do you have it now."**

> **INVARIANT -- role failure and surface failure are indistinguishable to the caller** (ADU-AUTH-01 S14). One `EXISTS` covers both, so the function is structurally unable to report which gate stopped you. Telling a caller which gate failed tells an attacker which to work on.

**It returns `void` and raises**, because every call site uses `PERFORM`. A boolean invites `IF NOT fn_has_permission(...)`, whose failure mode is a caller that omits the `IF` and reads as authorised.

**It checks neither `seller.status` nor object ownership.** Gate 0 (suspension -> 409) belongs to the calling function; gate 4 (is this object theirs -> 404) belongs to the composite foreign keys. This function is gates 1 and 2 exactly.

> **E5 -- `adulis_app` keeps `SELECT` on `core.permission` and `core.role_permission`, and amendment A1.3's stated reason for `SECURITY DEFINER` was wrong.** A1.3 said the app role *"has no need to read them directly."* It does: ADU-AUTH-01 S5 returns `roles[]` as a rendering hint and S16.2 requires the console not to hide a control the server would permit -- which needs the **grant set**, not a yes/no per call. The grant stays. `SECURITY DEFINER` remains for a different and sufficient reason: it keeps the raise semantics of S6.9b in one place, so no caller invents its own.

### 6.9b Application SQLSTATEs -- R29

**`42501` is left to PostgreSQL.** ADU-CON-02 S6.3 maps it to **500** on the reasoning *"a grant is wrong"* -- correct for Postgres raising it, and wrong for a deliberate denial, which is a 403. One code meaning both *"you may not"* and *"our grants are misconfigured"* means a real privilege bug reaches a seller as a clean 403 and is never investigated.

| Code | Raised by | API |
|---|---|---|
| **`U0001`** | `fn_has_permission`, `read_attestation`, `read_payment_evidence` | **403** `PERMISSION_DENIED` |
| **`U0002`** | `fn_has_permission` | **404** |
| `42501` | **PostgreSQL only** | **500** -- a defect |

**Not `ADU01`.** The SQL standard reserves SQLSTATE classes beginning `0`-`4` and `A`-`H`; implementation-defined codes must begin `5`-`9` or `I`-`Z`. `U0003`-`U0999` are reserved for this project's future deliberate raises.

**INVARIANT -- every S6.5 step-up capability has `surfaces = '{CONSOLE}'`.** Payout change, reissued instructions, team changes, subscription purchase, seller deletion, revoking sessions, **and ownership transfer** (ADU-AUTH-01 S16). A mobile session presenting at one of these receives 403 from the function, before any endpoint logic runs.

```sql
ALTER TABLE core.permission ADD CONSTRAINT step_up_is_console_only CHECK (
  NOT requires_step_up
  OR surfaces = ARRAY['CONSOLE']::core.session_audience[]
);
```

A `CHECK` rather than a convention, because this is the boundary an agent is most likely to widen while making the Companion "more useful."

> **INVARIANT -- the step-up constraint is total.** `step_up_is_console_only` quantifies over **every row**, present and future. A permission added in a later migration is covered by a constraint written now.
>
> **v1.8's version was an enumeration, and it had drifted.** It named six codes where ADU-AUTH-01 has eight; it omitted `seller.orders:reissue_instructions`, `seller.identity:manage` and `seller.ownership:transfer`; and it included `seller.instructions:reissue`, which is not a permission that exists. Because it read `code NOT IN (...) OR surfaces = '{CONSOLE}'`, **an omitted code satisfied the first disjunct and was unconstrained** -- a seed granting `seller.identity:manage` to `MOBILE` would have inserted cleanly, and nothing would have raised until someone found it from outside.
>
> **The list was wrong; the deeper fault was that it was a list.** An enumeration inside a `CHECK` must be kept in lockstep with a catalogue in a different document, and nothing enforces that. `requires_step_up` is a fact about the permission, so it lives on the permission.

**Migration 5 seeds both tables from ADU-AUTH-01 v2.2 S15.1 and S16.2 -- 42 permissions and 139 grants.** S16.3 there is the canonical list of the eight carrying `requires_step_up = true`. **This document does not restate that list**, because two copies of one list is how D1 happened.

**Three checksums migration 5 must satisfy**, each against a fixture rather than against the seed:

```sql
SELECT count(*) FROM core.permission;                         -- 42
SELECT count(*) FROM core.role_permission;                    -- 139
SELECT count(*) FROM core.permission WHERE requires_step_up;  --  8
```

Plus the per-role totals of ADU-AUTH-01 S16.2 -- **42  -  40  -  19  -  16  -  10  -  12** -- with `ANALYST` holding **zero** writes.

**The mobile-reachable grants** are the **twelve** permissions marked **M** in ADU-AUTH-01 v2.3 S15.1, each carrying `surfaces = '{MOBILE, CONSOLE}'` -- the console can do everything the Companion can.

[!] **v1.9's version of this list named three permissions that do not exist** -- `seller.reservations:read`, `seller.reservations:respond` and `seller.payment_receipt:confirm`, where the catalogue has `seller.orders:read`, `seller.orders:respond` and `seller.payment:confirm` -- and counted nine where v2.3 has twelve. It was harmless only because migration 5 seeded from ADU-AUTH-01 S16.2a rather than from here.

> **This document no longer restates the list.** ADU-AUTH-01 S15.1 is the single copy. **A list reproduced in two documents is how D1 began**, and reproducing it a second time to correct it would be repeating the mistake rather than fixing it.

**INVARIANT -- RBAC is enforced server-side on every endpoint, never by hiding UI** (S16.2), unchanged. Surface scoping is an additional dimension, not a replacement.

---

## 7. Sellers, eligibility and verification

### 7.1 `core.seller`

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `market_id`, `owner_account_id`, `person_id NULL` | |
| `entity_type` | `INDIVIDUAL`, `COMPANY` (S4.3) |
| `store_name`, `handle` | `handle` unique per market; `pg_trgm` index for S7.6 |
| `description`, `category_id` | |
| `status` | `DRAFT`, `ACTIVE`, `BILLING_SUSPENDED`, `SAFETY_SUSPENDED`, `DELETED` (S16.8) |
| `waitlist_follower_claim int NULL` | Self-reported at waitlist, imported per S25. **Never blended with the verified count** |
| `published_at` | |

**INVARIANT -- `UNIQUE (id, market_id)` and `UNIQUE (id, owner_account_id)` exist on `seller`.** These are the anchors for the composite foreign keys used throughout S9-S12 to make cross-seller and cross-buyer mistakes structurally impossible rather than merely unlikely.

**`core.seller_company_detail`** -- company sellers only, enforced by a composite FK on `(seller_id, entity_type)`.

| Column | Type | Note |
|---|---|---|
| `seller_id` | uuid, primary key | |
| `entity_type` | `core.seller_entity_type` | Half of the composite FK; a company row cannot attach to an individual seller |
| `registration_identifier` | text | |
| `trade_licence_number` | text | |
| `tin` | text | Taxpayer identification number |
| `representative_person_id` | uuid -> `core.person` | **A natural person, not an account** |
| `representative_relationship` | text | Director, owner, authorised signatory |

> **INVARIANT -- the representative is a `person_id`, and the identity attestation attaches to that person, not to the company** (S7.3). A company attestation is an attestation about its representative. This is what makes ADU-CON-03 SC-02's disclosure necessary: declaring "company" does not add a second verification, it **changes whom the existing one is about**, and a seller who discovers that mid-flow abandons it.

### 7.2 `core.seller_social_account`

Account-control verification lives in `core`, not `verification`. Handles and follower counts are public information the storefront displays; putting them behind the isolated boundary would make its audit log too long for the paid reviewer S23 requires to read it in full.

| Column | Notes |
|---|---|
| `seller_id`, `platform` | Unique together |
| `handle`, `platform_account_id` | |
| `verified_at` | NULL until control is proven |
| `follower_count_at_verification int` | S4.2 -- captured with a timestamp |
| `follower_count_source` | `PLATFORM_FETCH`, `MANUAL_FALLBACK` (S13.1 adapter degradation) |
| `status` | `PENDING`, `VERIFIED`, `REVOKED` |

**INVARIANT -- follower count is recorded at verification with a timestamp, and eligibility is never re-evaluated retroactively** (S4.2). Write-once: an `UPDATE` trigger rejects a change to `follower_count_at_verification` or `verified_at`. Re-verification writes a new row and supersedes the old.

**`core.account_control_challenge`** -- the one-time code posted to the linked social account: `code`, `issued_at`, `expires_at`, `matched_at`, `attempts`.

**INVARIANT -- each platform sits behind an adapter interface; a platform failure degrades to manual verification without affecting the others** (S13.1). The data-model expression is `follower_count_source` and a nullable `platform_account_id`, so a manually verified seller is a valid row rather than a special case.

### 7.3 `verification` schema -- the isolated identity boundary

```sql
CREATE SCHEMA verification AUTHORIZATION adulis_verification;
REVOKE ALL ON SCHEMA verification FROM adulis_app;
```

**`verification.identity_attestation`** -- `person_id`, `verified_on date`, `verifier_kind`, `vendor_reference`, `id_type`, `legal_name`, `id_hash bytea`, `id_hash_key_version`, `company_relationship text NULL`.

> **E1 -- `verified boolean` is dropped in v1.10.** The column was listed and **no writer ever set it**; `write_attestation`, its only writer, does not mention it. **The row's existence is the attestation** -- one is written when and only when a vendor verified -- so a boolean is redundant and a row reading `false` means nothing. Same argument as `seller_availability_override` having no `is_closed` (S13.1a): a column whose false value is meaningless is a second state to reason about on every read, bought for nothing.

**INVARIANT -- no identity image or video is ever uploaded to Adulis systems** (S13.1). There is no column for one. Not a nullable column, not an `image_url` left empty -- **no column exists**, so no agent can populate one and no migration can quietly add one without appearing in review.

**INVARIANT -- ID verification always attests to a natural person, regardless of seller entity type** (S4.3). The table is keyed on `person_id` and has no `seller_id`. A company attestation is an attestation about its representative, which is what the PRD says and what the schema now says too.

**`verification.access_log`** -- append-only: `actor_account_id`, `actor_role`, `attestation_id`, `reason`, `occurred_at`.

**The only read path:**

```sql
CREATE FUNCTION verification.read_attestation(
  p_person_id uuid, p_actor uuid, p_reason text
) RETURNS verification.identity_attestation
LANGUAGE plpgsql SECURITY DEFINER SET search_path = verification, core AS $$
DECLARE r verification.identity_attestation;
        v_role text;
BEGIN
  -- R5: the role is DERIVED from the caller's actual grants, never supplied.
  SELECT g.role::text INTO v_role
    FROM core.operator_grant g
   WHERE g.account_id = p_actor
     AND g.role IN ('IDENTITY_REVIEWER', 'ADMIN')
     AND g.revoked_at IS NULL
   ORDER BY g.granted_at LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'no grant permits reading an identity attestation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO r FROM verification.identity_attestation WHERE person_id = p_person_id;
  INSERT INTO verification.access_log
    (actor_account_id, actor_role, attestation_id, reason)
  VALUES (p_actor, v_role, r.id, p_reason);
  RETURN r;
END $$;

GRANT EXECUTE ON FUNCTION verification.read_attestation TO adulis_app;
```

**D4 -- the write path, which v1.8 asserted was defined and never was.** ADU-API-01 S13 maps `POST /v1/seller/identity-verification` to `verification.write_attestation`, and this document's v1.5 change table claimed *"both defined."* Only the read was.

```sql
CREATE FUNCTION verification.write_attestation(
  p_person_id       uuid,
  p_verifier_kind   verification.verifier_kind,
  p_vendor_ref      text,
  p_id_type         text,
  p_legal_name      text,
  p_id_hash         bytea,
  p_id_hash_key_ver int,
  p_verified_on     date
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = verification AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO verification.identity_attestation
    (person_id, verifier_kind, vendor_reference, id_type, legal_name,
     id_hash, id_hash_key_version, verified_on)
  VALUES
    (p_person_id, p_verifier_kind, p_vendor_ref, p_id_type, p_legal_name,
     p_id_hash, p_id_hash_key_ver, p_verified_on)
  ON CONFLICT (person_id) DO UPDATE SET
     verifier_kind       = EXCLUDED.verifier_kind,
     vendor_reference    = EXCLUDED.vendor_reference,
     id_type             = EXCLUDED.id_type,
     legal_name          = EXCLUDED.legal_name,
     id_hash             = EXCLUDED.id_hash,
     id_hash_key_version = EXCLUDED.id_hash_key_version,
     verified_on         = EXCLUDED.verified_on
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION verification.write_attestation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verification.write_attestation TO adulis_app;
```

> **RULING G1.1 -- identity verification is operator-only at MVP, and `POST /v1/seller/identity-verification` is closed to sellers.** There is no KYC vendor and there is no video call; the founder attests directly under an `IDENTITY_REVIEWER` or `ADMIN` grant.
>
> **The function derives the caller's role from `core.operator_grant` and raises `U0001` where there is none**, exactly as `read_attestation` does. Before this ruling the endpoint wrote an attestation **from fields the client supplied** -- a seller with a step-up code could assert their own identity verification, which is the IDENTITY eligibility path and, at Pro, the verified badge.

**`OPERATOR_ATTESTED` exists because neither other value would have been true.** `KYC_VENDOR` names a vendor that does not exist; `VIDEO_CALL` names a call that does not happen. **An audit record that says something other than what occurred is worse than one that says less** -- and this row is the evidence a claim about a seller's identity would rest on.

> **INVARIANT -- the Verified Pro badge is never granted on an `OPERATOR_ATTESTED` attestation alone.** Not a constraint today, because the badge is post-beta and the tier does not exist. **It is written here because the day it does exist, the temptation is to read any attestation as verification** -- and a buyer reading "Verified" is entitled to assume something was checked. When a real verification path lands, this invariant is what says which attestations qualify.

**The MVP posture, stated plainly for the DPIA:** with no vendor, **Adulis is both controller and processor for this step.** There is no third party to point at, no image is captured -- the schema still has no column for one, and that absence is unchanged -- and the attestation records only that an operator asserted it, on what date, and against which document type.

> **INVARIANT -- the write function takes no image, no document reference and no file handle, because there is no column for one.** The vendor holds the document; Adulis holds an attestation that a vendor saw it. `p_id_hash` is a keyed HMAC computed **before** the call, so the raw identifier never crosses this boundary either.

**It upserts on `person_id` rather than inserting.** A person re-verifying -- a renewed document, a corrected name, a second attempt after a vendor failure -- is one attestation superseding itself, not two rows. **The write is not logged in `verification.access_log`**: that log records *reads*, and a write is already evidenced by the row it produces.

**Re-verification is not free of consequence and this function does not decide it.** Whether a new attestation re-opens eligibility or resets anything is S7.4's business, evaluated by `fn_evaluate_eligibility` at the moment it is asked.

The log write and the read are one statement. There is no unlogged read because there is no other read.

**INVARIANT -- `actor_role` in either boundary access log is derived server-side from the caller's actual grants and is never a function parameter** (R5; ADU-AUTH-01 S20.2). v1.6 took the role as `p_actor_role text` and wrote it straight into the log, which made the most contested field in the audit row the one the reader supplied about themselves. Deriving it closes a second hole in the same edit: with no grant lookup the function *authorised nothing* -- it logged a read it was going to perform anyway. Now **no grant, no row**, and the query that logs is the query that authorises.

**A duplicate-detection path that returns no identity data** is provided separately -- `verification.id_hash_matches(p_hash bytea) RETURNS int` -- so S13.2's "same person across accounts" check does not require reading a name.

### 7.4 `core.seller_eligibility_evaluation`

Append-only: `seller_id`, `evaluated_at`, `config_version_id`, `path` (`AUDIENCE`, `IDENTITY`), `outcome`, `reasons text[]`.

**INVARIANT -- eligibility is evaluated by a rules service reading per-market configuration, and Phase 2 must not require a code change** (S4.1). The rules service is `core.fn_evaluate_eligibility(seller_id, at timestamptz)`, a single SQL function reading `eligibility_config` at that instant. Phase 2 is `audience_required = false` in a new configuration row.

**INVARIANT -- a seller must satisfy at least one path before publishing any product** (S4.2). Enforced at S9.4, publication readiness.

**INVARIANT -- a seller taking the identity path holds a full ID attestation before their first listing goes live. There is no grace period** (S4.2). The readiness function returns `NOT_SATISFIED` where `path = IDENTITY` and no attestation exists; there is no bypass column and no "provisional" state to abuse.

### 7.5 The ambassador rule

S4.5: *"Not system-enforceable... Do not build a control for it."* **No table, no column, no flag.** Recorded here so that no future agent invents one from the terms-of-service text. It is handled by a report under S21.

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

`ON CONFLICT DO NOTHING` because re-evaluation must never reset a seller who has already climbed. This was new in v1.1: v1.0 took the C5 ruling but left nothing that actually created the row, which would have produced a Phase 1 cohort with a null level -- the exact outcome the ruling was meant to avoid.

**Two semantics the trigger implies, stated here rather than left to be discovered** (P2, v1.2):

**It creates rows going forward and backfills nothing.** Any seller who satisfied eligibility before migration 5 ran has no level row and no trigger will give them one. This is irrelevant pre-launch and is stated only because the trigger must not be deferred to a later migration -- if it ever moves after migration 6, a backfill `INSERT ... SELECT` over satisfied evaluations has to move with it.

**`since` never resets, including on re-satisfaction after a revocation.** `ON CONFLICT DO NOTHING` swallows the second insert, which is deliberate: the ladder measures accumulated handoff evidence, and a seller whose social account was revoked and re-verified has not lost the handoffs they completed. Where a revocation should cost a seller their level, the correct instrument is a logged demotion under S5.1 -- `source = 'MODERATION'` with a `moderation_event_id` -- not a silent re-entry at `NEW` that leaves no record of who decided it or why.

**INVARIANT -- a seller's level is computed from completed, scanned handoffs and published reliability statistics. It is never set manually, never purchasable, and never affected by subscription tier or advertising spend** (S5.1).

The mechanism is threefold, because this is the one rule whose violation makes the entire product worthless:

1. `seller_level_state` has **no `UPDATE` grant to `adulis_app`**. It is written only by `core.fn_recompute_seller_level(seller_id)`.
2. That function's body references `core.handoff_scan`, `core.review`, `core.claim` and `core.ladder_config`. **It references no billing table.** There is no join path from a subscription to a level, so no amount of generated code can create one.
3. Every change writes `core.seller_level_event` (append-only) with `source` (`COMPUTED`, `MODERATION`) and `CHECK (source <> 'MODERATION' OR moderation_event_id IS NOT NULL)`.

That third clause is S5.1's *"no manual downgrade except through moderation action, which is logged"* -- expressed so that an unlogged manual downgrade is a constraint violation, not an oversight.

### 8.2 Anti-gaming

**INVARIANT -- a scanned handoff counts toward level only when the scanning buyer account is distinct, has its own verified phone number, and has not transacted with that seller more than a configured number of times in the level window** (S5.2).

`core.handoff_scan.counts_toward_level` is a boolean written by a `BEFORE INSERT` trigger, never by the application. The trigger evaluates, in order: the buyer account is not the seller's owner or any team member; the buyer's phone is verified; the count of that buyer's prior counting handoffs with that seller within `ladder_config.distinct_buyer_window` is below `ladder_config.max_handoffs_per_buyer`; scan validity is `VALID` and not `LATE` (S11.4).

Supporting tables: `core.level_velocity_flag` (automatic review flag when a level rises unusually fast), and a scheduled graph-analysis job writing `core.buyer_seller_pair_signal`.

**INVARIANT -- an upheld claim always demotes, regardless of volume** (S5.2, S14). A trigger on `claim` reaching `UPHELD` calls the recompute function with a forced demotion argument. The demotion is not conditional on thresholds, because the PRD says *always*.

### 8.3 What the buyer sees

**INVARIANT -- the seller's level and completed handoff count are visible on the storefront, on every product page, and at the reservation step** (S5.3). `core.seller_public_stats` is a **plain table with one row per seller**, carrying level, completed handoff count, cancellation rate, confirmation rate, scan completion rate, unresolved claim count, missed payment-confirmation windows, stock confidence (S13.2). It exists because the read happens on every storefront page load on a low-end Android over a slow connection, which is the binding performance constraint (S23), and one primary-key lookup is the cheapest possible answer.

**INVARIANT -- `seller_public_stats` is never a `MATERIALIZED VIEW`, and no `MATERIALIZED VIEW` exists anywhere in this schema** (R16; ADU-CON-02-A1 S4.1). v1.6 said *"materialized and refreshed on relevant writes"*, and an agent reading that will reach for `CREATE MATERIALIZED VIEW` -- under which every refresh re-aggregates **every seller's entire history** to update one seller's row: O(total) work per event, degrading from roughly five thousand sellers and untenable near thirty thousand. The failure is the shape, not the constant.

**The maintenance path is the trigger set that already exists.** Each of `handoff_scan`, `review`, `claim` and `seller_level_event` already fires on write; each additionally performs one `UPDATE core.seller_public_stats SET ... WHERE seller_id = ...` -- an O(1) row update against a primary key. Counts are incremented, rates are recomputed from counters held on the same row, never by scanning the source tables. Appendix C **check 15** greps the migrations for the forbidden phrase, so the trap cannot be reintroduced by a later agent who reads v1.6's wording in an old branch.

**INVARIANT -- Adulis never publishes the words scammer, fraud, criminal or equivalent, or any assertion of wrongdoing** (S13.2). `seller_public_stats` contains **only numbers, dates and the three level names**. No free-text column exists on it. A published statistic that cannot hold a sentence cannot hold an accusation.

---

## 9. Catalogue

### 9.1 Categories and structured attributes

**`core.category`** -- id, parent, code, per-market availability. Launch set: fashion and clothing, cosmetics, electronics (ADU-00 Launch Scope).

**`core.attribute_definition`** -- `category_id`, `code`, `label_key`, `data_type`, `unit`, `is_variant_defining boolean`.

Two layers, because S7 uses attributes for two different jobs: product-level descriptive attributes make the chatbot free (S15.1 layer 0), and variant-defining attributes are what distinguishes one variant from another.

**`core.attribute_option`** -- permitted values for `ENUM` attributes.
**`core.product_attribute_value`** -- product-level.
**`core.variant_attribute_value`** -- variant-level; only definitions with `is_variant_defining = true`, enforced by a composite FK.

### 9.2 `core.product`

`seller_id`, `market_id`, `name`, `description`, `category_id`, `display_order int`, `visibility`, `base_price_minor`, `base_price_currency`, `created_at`, `published_at`, `unpublished_reason NULL`.

**Per C1, `base_price_minor` is a seed value, not a price.** It is copied into a new variant at creation and read by nothing else. No order, reservation, cart line or storefront render reads it -- a `grep` for `base_price` outside the variant-creation function should return nothing, which is check 3 in Appendix C.

`UNIQUE (id, seller_id)` -- the anchor for every composite FK below.

**INVARIANT -- on downgrade, products above the limit are unpublished, never deleted** (S7). `unpublished_reason` records which of the four causes applied, so that the seller's own choice and a system action are distinguishable -- S7 gives the seller the choice and specifies the fallback order (most-reserved, then most-recently-added) only where they fail to choose.

**G1.9 -- `core.product` gains `slug text NOT NULL`, `UNIQUE (seller_id, slug)`.** Generated once at creation from the product name, **immutable thereafter**, with a numeric suffix on collision within the seller.

> **This was never a founder decision.** Doctrine 5: *handles and slugs on the wire, UUIDs behind authentication.* A product page is anonymous, so serving it by `id` puts an internal identifier on a public URL. ADU-API-01's `{slug}` was right and the missing column was the defect.

**Immutable because the distribution channel is a shared link.** A seller who renames a product must not break every TikTok post pointing at it. The slug records what the product was called at creation; the name is what it is called now, and they are allowed to differ.

### 9.3 `core.product_variant`

`product_id`, `seller_id` (denormalised for the composite FK), **`price_minor`, `price_currency` -- the price of the thing, per C1**, `stock_count int NOT NULL CHECK (stock_count >= 0)`, `stock_confirmed_at`, `variant_key text`, `status`.

`UNIQUE (product_id, variant_key)` where `variant_key` is the canonical sorted serialisation of the variant's defining attribute values, written by a trigger. Two variants of one product cannot carry the same attribute combination -- a data-entry error that otherwise surfaces as a buyer reserving the wrong thing.

`UNIQUE (id, seller_id)` and `UNIQUE (id, product_id)` -- composite FK anchors.

### 9.4 Publication readiness

**INVARIANT -- publication readiness is computed server-side as a single resolved state, not inferred by the client from separate checks** (S4.6).

```sql
CREATE FUNCTION core.fn_publication_readiness(p_seller_id uuid)
RETURNS TABLE (item text, satisfied boolean, resolving_action text)
LANGUAGE sql STABLE AS $$ ... $$;
```

One function, returning the ten items in S4.6's table with their satisfaction and the action that resolves each. The client renders the rows; it computes nothing.

**INVARIANT -- `seller_publication_blocked` is emitted with its blocking reasons whenever readiness is evaluated and fails** (S4.6). Emitted by the function itself, so the funnel data cannot be lost to a code path that forgot to log. S4.6 is explicit that this is a measurement problem as much as a UX one, and that it cannot be reconstructed later.

**INVARIANT -- publication limits are the lesser of the tier limit and the level limit** (S7, S16.5). A `CHECK` cannot express it; `core.fn_publish_product` calls `billing.fn_effective_limit(seller_id, 'PRODUCT_COUNT')` and refuses.

### 9.5 Media

**`core.product_image`** -- `product_id`, `position int CHECK (position BETWEEN 1 AND 5)`, `thumb_key`, `card_key`, `full_key`, `uploaded_at`. `UNIQUE (product_id, position)` caps images at five (S7.4) as a structural fact.

**INVARIANT -- uploaded originals are resized on receipt and discarded** (S7.4). There is no `original_key` column. Same reasoning as the identity images: the absence of a column is a stronger guarantee than a deletion job.

**`core.product_video`** -- `product_id UNIQUE` (one clip per product), `key`, `duration_seconds CHECK (<= 30)`, `height_px CHECK (<= 480)`, `bytes`.

**INVARIANT -- Adulis runs no server-side transcoding pipeline in V1** (S7.4). No rendition table, no transcode job type. A single progressive-download rendition, which is one row.

**`core.media_lifecycle`** -- `object_key`, `class` (`HOT`, `INFREQUENT`), `purge_after`, `reason`. **INVARIANT -- media has a lifecycle policy** (S7.4). Storage that only ever grows is a cost curve, not a bug -- which is why it needs a table rather than good intentions.

### 9.6 Social posts

**`core.social_post`** -- `platform`, `canonical_post_id`, `status`, `first_seen_at`. `UNIQUE (platform, canonical_post_id)`.
**`core.product_social_post`** -- `product_id`, `seller_id`, `social_post_id`. Many-to-many.

**INVARIANT -- one post link may be attached to many products by the same seller** (S7.5.1). It is a join table, so it cannot assume otherwise.

**INVARIANT -- a pasted post link resolves only within the seller who tagged it** (S7.5.1). The resolution function returns rows grouped by seller; where more than one distinct seller has claimed a post it returns **nothing** and inserts a `moderation_queue_item` of kind `POST_LINK_CONFLICT`. A reseller using someone else's content is a moderation question, not a search result.

Matching is on `canonical_post_id`, never the URL string. **Shortened and redirecting URLs are resolved before matching** -- TikTok share links are usually shortened, and matching the raw string fails most of the time. The service performs the redirect chain; the database stores only the canonical result.

**INVARIANT -- storefront search scope is exactly one seller** (S7.5) and **seller lookup returns sellers, never products** (S7.6). Both are functions whose signatures make the alternative unexpressible: the search function takes a `seller_id` and has no cross-seller path; the lookup function's return type is `core.seller`.

[!] **Deleted and reposted source content remains open** (S7.5.1, S25). The schema is neutral: `social_post.status` (`LIVE`, `UNAVAILABLE`, `UNKNOWN`) is set by a checker job. Whatever is decided -- hide the embed, unpublish, notify the seller -- is a policy on that column, not a migration.

---

## 10. Stock

### 10.1 `core.stock_event` -- append-only

`variant_id`, `seller_id`, `delta int`, `reason`, `order_id NULL`, `reservation_id NULL`, `actor_account_id NULL`, `resulting_count int`, `occurred_at`.

**INVARIANT -- stock is never mutated without a corresponding StockEvent row** (S7).

The strongest available form: **`stock_count` is not writable at all.** It is maintained exclusively by a **`BEFORE INSERT`** trigger on `stock_event`, and a `BEFORE UPDATE` trigger on `product_variant` raises if `stock_count` changed and the change did not come from that trigger.

```sql
-- BEFORE INSERT ON core.stock_event. NOT AFTER: see below.
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

-- [!] A3.1 -- v1.10 said AFTER INSERT and this body requires BEFORE.
--     In an AFTER trigger both the assignment to NEW.resulting_count and
--     RETURN NEW are inert, so resulting_count would be NULL on every row
--     and nothing would raise -- the column is nullable and unread.
--     BEFORE is also the ordering the design needs: the UPDATE fires and
--     CHECK (stock_count >= 0) raises before an event exists claiming a
--     decrement that did not happen.

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

The `CHECK (stock_count >= 0)` then makes over-selling a transaction failure rather than a negative number. This is the single most important pair of triggers in the schema: ADU-PROJ-01 S13.5 names *"AI-generated code wrong under concurrency"* as a live risk, and stock decrement under concurrency is where it would first show.

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

A view rather than a column because a stored level drifts the moment a job misses a run, and S13.3's graduated consequences -- up to blocking broadcasts -- would then fire against a stale number.

[!] **A gap worth recording.** S13.3 level 3 is *"chatbot hedges stock claims more strongly."* A Free-tier seller has no chatbot (S16.1), so level 3 has no effect for them and the ladder skips from a staleness notice straight to a degraded badge. Not a contradiction, but the seller-facing explanation of stock confidence should not promise a consequence that does not apply to the tier reading it.

**Stock update must take under five seconds** (S13.3) -- a single-row insert plus a trigger. Nothing in this path touches an external service.

---

## 11. Cart and device lifecycle

Specified in full here per C6. In v1.0 the `device_id` key was ruled on but its lifecycle was left implicit, which is where a generated implementation would have invented something.

### 11.1 Registration and binding

1. **First app launch.** The app generates a UUIDv7 and registers it: `INSERT INTO core.device`. No account, no session, no personal data.
2. **Browsing and cart building.** `core.cart` rows are keyed by `device_id`. `buyer_account_id` is null.
3. **First reserve.** Phone OTP creates the account (S6.1). In the same transaction: `device.account_id` is set, and every `ACTIVE` cart for that device has `buyer_account_id` set.
4. **Subsequent devices.** A second device for the same account registers its own row and binds on first authenticated call. Carts do not merge across devices -- a cart is a draft on a phone, and merging two drafts silently is exactly the kind of "the system altered my cart" behaviour S8.3 forbids.
5. **Purge.** A device with no `account_id` and no activity beyond `timing_config.media_retention` is deleted, taking its carts with it. A bound device is retained while the account is.

### 11.2 `core.cart` and `core.cart_line`

`cart` -- `device_id NOT NULL`, `buyer_account_id NULL`, `seller_id NULL`, `market_id`, `status`. One `ACTIVE` cart per device (partial unique index).

**INVARIANT -- a cart contains items from exactly one seller, enforced when a second seller's item is added, not at checkout** (S8.1):

```sql
ALTER TABLE core.cart_line
  ADD CONSTRAINT cart_line_single_seller
  FOREIGN KEY (cart_id, seller_id) REFERENCES core.cart (id, seller_id),
  ADD CONSTRAINT cart_line_variant_seller
  FOREIGN KEY (variant_id, seller_id) REFERENCES core.product_variant (id, seller_id);
```

Adding a variant belonging to a different seller violates the second constraint at `INSERT`. Not a service check that can be bypassed by a second endpoint or a direct API call -- a foreign key. `cart.seller_id` is set by a trigger on the first line and nulled when the last is removed.

**INVARIANT -- adding an item to the cart has no effect on stock** (S8.2). No trigger on `cart_line` touches `stock_event`. Stated because it is the natural instinct when generating this code.

`cart_line` carries `availability_checked_at`, refreshed on every cart view, because S8.2 requires the cart to display live availability per line **with the moment it was checked**. A cart is a draft, not a claim, and the interface has to say so rather than imply it.

---

## 12. Orders and reservations

### 12.1 `core."order"` and `core.reservation`

**`core."order"`**

| Column | Notes |
|---|---|
| `id`, `market_id`, `seller_id`, `buyer_account_id` | |
| `state` | `order_state`, per C2 |
| `created_at`, `expires_at` | `created_at + timing_config.reservation_window` |
| `clock_stopped_at` | Set at `PAYMENT_CONFIRMED` (S9.2) |
| `fulfilment_deadline` | Set at `PAYMENT_CONFIRMED` from `timing_config.fulfilment_window` |
| `total_minor`, `total_currency` | Recalculated from surviving lines (S9.4) |
| `display_currency`, `fx_rate`, `fx_rate_captured_at` | S8.4 -- the ETB conversion rate is captured like price |
| `payout_snapshot_id` | S8.5 |
| `seller_level_at_order` | Claim evidence (S14) |

`UNIQUE (id, buyer_account_id)` and `UNIQUE (id, seller_id)` -- composite FK anchors for the handoff and review rules.

**`core.reservation`** -- `order_id`, `variant_id`, `seller_id`, `buyer_account_id`, `quantity`, `unit_price_minor`, `unit_price_currency`, `state`, `cancelled_at`, `cancelled_by`, `cancellation_reason`, `penalty_exempt boolean`, `active_window tstzrange`.

**INVARIANT -- the unit price in effect at the moment the order is created is written onto the reservation and is immutable for the life of that order** (S8.4). Write-once trigger. Price is the most common source of dispute between a buyer and a seller, and the buyer agreed to a specific number.

**INVARIANT -- a unique constraint on (seller, buyer, variant, active time window) makes duplicate live reservations structurally impossible** (S9.1). The PRD says "unique constraint"; a plain unique constraint cannot express a time window:

```sql
ALTER TABLE core.reservation
  ADD CONSTRAINT reservation_no_duplicate_active
  EXCLUDE USING gist (
    seller_id WITH =, buyer_account_id WITH =, variant_id WITH =,
    active_window WITH &&
  ) WHERE (state = 'ACTIVE');
```

This is why `btree_gist` is a hard hosting requirement (S3.1).

### 12.2 The two state machines -- new in v1.1

C2 ruled two machines. This section specifies them, because "two machines" without a transition table is an invitation for generated code to invent one.

**`order_state` -- legal transitions**

| From | To | Trigger |
|---|---|---|
| `CREATED` | `NOTIFIED` | Seller notified of the order |
| `CREATED`, `NOTIFIED` | `PAYMENT_SUBMITTED` | Buyer uploads evidence (S10.1 step 3) |
| `CREATED`, `NOTIFIED` | `EXPIRED_UNCLAIMED` | Expiry sweep |
| `PAYMENT_SUBMITTED` | `PAYMENT_CONFIRMED` | Seller confirms. **Sets `clock_stopped_at`** |
| `PAYMENT_SUBMITTED` | `NOTIFIED` | **Seller rejects the evidence.** See the write-back below |
| `PAYMENT_CONFIRMED` | `HANDED_OFF` | Scan or tapped confirmation (S11.3) |
| `HANDED_OFF` | `COMPLETED` | Order settles; review becomes available |
| Any non-terminal | `CANCELLED_BY_BUYER` | **Derived** -- every line buyer-cancelled |
| Any non-terminal | `CANCELLED_BY_SELLER` | **Derived** -- every line seller-cancelled or refunded |

**`reservation_state` -- legal transitions**

| From | To | Trigger |
|---|---|---|
| `ACTIVE` | `FULFILLED` | Order reaches `COMPLETED` |
| `ACTIVE` | `CANCELLED_BY_BUYER` | Buyer cancels the line |
| `ACTIVE` | `CANCELLED_BY_SELLER` | Seller cancels **before** `PAYMENT_CONFIRMED` |
| `ACTIVE` | `REFUNDED` | Seller cancels **after** `PAYMENT_CONFIRMED` (S9.4) |
| `ACTIVE` | `EXPIRED` | Order expires unclaimed |

`REFUNDED` exists only here. There is no `REFUNDED` value in `order_state`, per C2.

**Enforcement -- a data-driven machine, not a `CASE` in a service.** Two tables, one per machine, so each keeps its own enum type and a wrong state name is a type error rather than a row that never matches.

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

Every transition also writes `core.order_state_transition` (append-only: from, to, actor, reason, occurred_at), which is the *"order state transitions"* evidence S14 attaches to a claim.

**INVARIANT -- the guard is fail-closed.** A transition absent from the table is refused. An empty table means nothing moves at all. There is no permissive mode, no warn-only setting, and no environment variable that relaxes it -- a machine that logs violations instead of refusing them produces bad data during the exact period nobody is watching the logs.

**INVARIANT -- the legal tables are writable only by `adulis_migrate`.** This closes the residual noted in the v1.1 review: a legal set the application can `INSERT` into is a state machine that widens at runtime with no migration and no diff. Adding a transition is a reviewed schema change or it does not happen.

```sql
REVOKE INSERT, UPDATE, DELETE ON core.order_state_transition_legal FROM adulis_app;
REVOKE INSERT, UPDATE, DELETE ON core.reservation_state_transition_legal FROM adulis_app;
```

**Why tables rather than a `CHECK` or a service.** The legal set is 24 rows a reviewer can read in one query and audit against this document without reading `plpgsql`. That matters more here than anywhere else in the schema, because an illegal transition is how a paid order silently becomes an expired one.

### 12.2.1 Ratification -- the set is provisional until reviewed

**Ratified in v1.7.** The transition set was drafted from ADU-PRD-01 and provisional through v1.6; ADU-CON-01 R8, corrected to **R8'** by the conflict recorded below, ratifies it. The **23 rows** are seeded in migration 9 with `ratified_at` set, and the guard below stays in place -- it now protects future additions rather than the initial set.

**A defect in v1.6 is corrected here.** v1.6's own S0.3 change table stated *"17 and 23. Row 6 struck -- a submitted payment never expires. R-2 closes"*, and ADU-API-01 v1.3 S15 records the same closure. **But the table v1.6 shipped still contained row 6, still marked it `R-2`, and its prose still posed R-2 as an open question.** The document contradicted itself one page apart, and ADU-CON-01 R8 was written against the stale table -- ratifying a row that had already been struck, and counting 24 where the count is 23. The change table and ADU-API-01 are right; the shipped table was not updated. It is updated now.

**INVARIANT -- a market cannot be set live while any transition row is unratified.**

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

Same shape as the `market_phase_gate` trigger in S5.1, and for the same reason: a review that blocks a release is a gate, and a review that is merely scheduled is a hope.

**`order_state`, 17 rows -- all ratified:**

| # | From | To | Written by | Note |
|---|---|---|---|---|
| 1 | `CREATED` | `NOTIFIED` | seller notification job | |
| 2 | `CREATED` | `PAYMENT_SUBMITTED` | buyer uploads evidence | |
| 3 | `NOTIFIED` | `PAYMENT_SUBMITTED` | buyer uploads evidence | |
| 4 | `CREATED` | `EXPIRED_UNCLAIMED` | expiry sweep | |
| 5 | `NOTIFIED` | `EXPIRED_UNCLAIMED` | expiry sweep | |
| 6 | `PAYMENT_SUBMITTED` | `PAYMENT_CONFIRMED` | seller confirms; sets `clock_stopped_at` | |
| 7 | `PAYMENT_SUBMITTED` | `NOTIFIED` | seller rejects the evidence | W6 |
| 8 | `PAYMENT_CONFIRMED` | `HANDED_OFF` | scan or tapped confirmation | |
| 9 | `HANDED_OFF` | `COMPLETED` | settlement | |
| 10 | `EXPIRED_UNCLAIMED` | `HANDED_OFF` | late in-window scan (S11.4) | **R-1 ratified** |
| 11 | `CREATED` | `CANCELLED_BY_BUYER` | derived from lines | |
| 12 | `NOTIFIED` | `CANCELLED_BY_BUYER` | derived from lines | |
| 13 | `PAYMENT_SUBMITTED` | `CANCELLED_BY_BUYER` | derived from lines | |
| 14 | `CREATED` | `CANCELLED_BY_SELLER` | derived from lines | |
| 15 | `NOTIFIED` | `CANCELLED_BY_SELLER` | derived from lines | |
| 16 | `PAYMENT_SUBMITTED` | `CANCELLED_BY_SELLER` | derived from lines | **R-3 ratified** |
| 17 | `PAYMENT_CONFIRMED` | `CANCELLED_BY_SELLER` | derived -- every line `REFUNDED` | **R-3 ratified** |

**There is no `PAYMENT_SUBMITTED -> EXPIRED_UNCLAIMED` row, and its absence is load-bearing.** A submitted payment never expires. S12.4a is what happens instead.

**`reservation_state`, 6 rows -- all ratified:**

| # | From | To | Written by | Note |
|---|---|---|---|---|
| 18 | `ACTIVE` | `FULFILLED` | order reaches `COMPLETED` | |
| 19 | `ACTIVE` | `CANCELLED_BY_BUYER` | buyer cancels the line | |
| 20 | `ACTIVE` | `CANCELLED_BY_SELLER` | seller cancels before `PAYMENT_CONFIRMED` | |
| 21 | `ACTIVE` | `REFUNDED` | seller cancels after `PAYMENT_CONFIRMED` (S9.4) | |
| 22 | `ACTIVE` | `EXPIRED` | order expires unclaimed | |
| 23 | `EXPIRED` | `FULFILLED` | late in-window scan | **R-1 ratified** |

**The three questions, and how each was answered.**

**R-1 -- `EXPIRED_UNCLAIMED` is not terminal, and S9.1 says it is.** S11.4 requires an in-window scan that syncs after the server expired the order to complete it: *"The order completes and counts toward trust level, even if the server had already expired it."* Rows 10 and 23 are that path. **Ratified -- both rows are legal**, with `order_state_transition.reason = 'LATE_SYNC_RECOVERY'` and the reconciliation `StockEvent` of S11.4. The alternative -- refusing the transition -- discards a completed handoff because of a signal outage in a doorway, which is the case S11.4 was written to handle.

**R-2 -- a buyer who paid and was never confirmed. Closed by striking the row, not by ratifying it.** The reservation clock stops being the governing clock the moment evidence is submitted; S12.4's confirmation window takes over. So the row that would have expired a paid order does not exist, and **stock is never released out from under a buyer who has performed.**

**Striking the row removed an answer without supplying a replacement, and S12.4a supplies it.** With `PAYMENT_SUBMITTED -> EXPIRED_UNCLAIMED` illegal, an order whose seller simply never responds would otherwise sit in `PAYMENT_SUBMITTED` indefinitely, holding stock forever. The confirmation window terminates that case: the order does not expire, the stock stays held, and the same transaction opens a `SYSTEM` claim. That preserves the part of ADU-CON-01 R8 that was right -- a buyer who has performed gets recourse, which is what S17.3's own copy already promises them -- and drops the part that was wrong.

**R-3 -- mixed cancellation. Ratified as recommended.** Rows 16 and 17 cover the case where the seller cancels some lines and the buyer cancels the remainder under S9.4's no-penalty rule. Every line is terminal, by different actors, and S9.4 only specifies *"an order whose every line is cancelled becomes `CANCELLED_BY_SELLER`."* **Ruled: `CANCELLED_BY_SELLER` whenever any line was seller-cancelled or refunded**, because the seller's cancellation is what caused the buyer's. Nothing in the seller's published statistics turns on this -- the cancellation rate counts reservation rows, not orders (S12.5) -- so the label is a reporting question, not an economic one.

**What the guard does not do.** It validates legality, never authority. Row 7 is legal for anyone who can write the row; that it must be the seller or an RBAC-granted team member is `fn_has_permission` inside the confirming function. Both are required, and the transition table must not be read as an access control.

[!] **The rejection path is an inference, not a PRD statement.** S10.1 step 4 says the seller *"confirms or rejects"* but never says what state a rejected order occupies. This document takes the only reading that preserves S9.2 -- the order returns to `NOTIFIED`, the 48-hour clock is still running and was never stopped, and the buyer may submit new evidence. It is listed as a write-back in S29 so the PRD states it rather than leaving the next reader to re-derive it.

### 12.3 Order creation

**INVARIANT -- the entire cart is revalidated inside the same transaction that creates the order. If any line fails, no order is created and no stock is decremented** (S8.3).

`core.fn_create_order(cart_id, ...)` is one function, one transaction. It checks, per line: sufficient stock, product still published, variant still exists, price unchanged, seller still eligible to receive orders, New-level transaction cap. On any failure it raises with a structured payload naming **every** failing line and its failure mode, so the buyer sees the complete reconciliation step S8.3 requires rather than one error at a time.

**The system never silently alters a cart.** No code path in the function writes to `cart_line`.

**INVARIANT -- an order from a New-level seller is rejected if it exceeds the configured transaction value cap, where one is configured** (S9.1). Checked in the same function against `ladder_config.new_level_transaction_cap_minor`. **G1.2 sets no cap at MVP, so the column is NULL and the check does not fire.** The comparison must handle NULL explicitly rather than relying on a NULL comparison evaluating false by accident.

**INVARIANT -- creating an order decrements stock immediately and holds it for 48 hours** (S9.1). One `stock_event` per line, inside the transaction.

### 12.4 Expiry

**INVARIANT -- the expiry clock stops permanently when an order reaches `PAYMENT_CONFIRMED`. A paid order is never expired by the system** (S9.2).

```sql
ALTER TABLE core."order" ADD CONSTRAINT order_clock_consistency CHECK (
  (state IN ('PAYMENT_CONFIRMED','HANDED_OFF','COMPLETED')) = (clock_stopped_at IS NOT NULL)
);
```

The expiry job selects `WHERE clock_stopped_at IS NULL AND expires_at < now()`. A paid order is not skipped by a filter that could be dropped -- it is not in the result set, and the constraint guarantees the column is set. The `EXPIRED_UNCLAIMED` transition is additionally absent from `order_state_transition_legal` for every post-payment state, so the same rule holds twice.

**INVARIANT -- stock release is idempotent per LINE** (S9.1, S12.5).

```sql
CREATE UNIQUE INDEX stock_release_once
  ON core.stock_event (reservation_id, reason)
  WHERE reason IN ( /* release reasons */ );

ALTER TABLE core.stock_event ADD CONSTRAINT release_has_a_line CHECK (
  reason NOT IN ( /* release reasons */ ) OR reservation_id IS NOT NULL
);
```

[!] **v1.10 scoped this `(order_id, reason)`, which would have silently lost stock.** S12.5 makes cancellation, refund, terminal state and the published cancellation rate all reservation-level; release was the one written order-level, by inattention rather than argument. On a three-line order the second cancelled line collides -- and an idempotent job using `ON CONFLICT DO NOTHING`, as such a job should, **returns no stock and reports no error.**

**The `CHECK` is not decoration.** `reservation_id` is nullable, because a seller's manual adjustment has no line, and **a partial unique index does not constrain rows whose indexed column is NULL.** Without the `CHECK`, a release written with a null anchor escapes the index entirely, exactly where the idempotency guarantee matters.

### 12.4a The confirmation window terminates, and expiry does not

**INVARIANT -- an order in `PAYMENT_SUBMITTED` never expires and never releases stock** (R8'). There is no legal transition to `EXPIRED_UNCLAIMED` from that state, so no job and no code path can produce one.

**What happens when the seller never responds.** At `submitted_at + timing_config.payment_confirmation_window` (24 hours, S12.4), the job `orders.confirmation_window_lapse` runs and, in **one transaction**:

1. Opens a `claim` with `opened_by_kind = 'SYSTEM'`, `reason = 'CONFIRMATION_WINDOW_LAPSED'`, scoped to the order -- subject to S14's one-open-claim-per-scope rule, so a seller with an existing open claim on that order has evidence appended rather than a second claim opened.
2. Sets `retention_reason = 'OPEN_CLAIM'` on the payment evidence in the same transaction, so the purge job cannot destroy the proof.
3. Records a missed confirmation window against the seller -- the statistic S8.3 already publishes.
4. Leaves the order in `PAYMENT_SUBMITTED` and every reservation `ACTIVE`. **Stock stays held.**

**Why stock stays held.** The buyer has paid. Releasing goods they paid for so another buyer can reserve them converts a seller's unresponsiveness into a second victim, and leaves the first with money gone and no order. Holding the stock keeps the remedy available: the seller can still confirm late, or the claim resolves with a refund, and either way the goods the buyer paid for are still there.

**The order is not immortal.** It leaves `PAYMENT_SUBMITTED` by exactly three doors: the seller confirms (row 6), the seller rejects (row 7, returning it to `NOTIFIED` with the reservation clock still running), or every line is cancelled or refunded through the claim (rows 13 and 16). Claim resolution is the terminal path, which is the correct owner of a case where a human has to decide who is owed what.

**Migration 9 seeds `payment_confirmation_window` into `timing_config`** if it is not already present, and the job is registered in S24.


### 12.5 Partial fulfilment

**INVARIANT -- cancellation, refund and stock release operate at reservation level, not order level** (S9.4).

Each cancelled line writes its own `stock_event`, enters its own terminal state, and **counts individually toward the published cancellation rate** -- cancelling two of three lines is two cancellations, not one. The cancellation-rate view counts reservation rows, never order rows, which is the arithmetic S9.4 specifies.

**INVARIANT -- where payment was already confirmed, each cancelled line enters `REFUNDED` and the seller owes that line's captured amount.** `core.refund` carries `reservation_id`, `amount_minor` (the captured amount, not a recomputed one), `reported_by_seller_at`, `acknowledged_by_buyer_at`.

**The buyer may cancel the remainder without penalty** -- `penalty_exempt` is set by the trigger that detects a preceding seller cancellation on the same order. Someone buying a matching set may not want part of it, and that choice belongs to them; the exemption must therefore be automatic, not a support request.

Order-level terminal state is derived: the trigger sets `order.state` when every line is terminal and recalculates `total_minor` from surviving lines on every line state change.

### 12.6 Order QR token

**`core.order_qr_token`** -- `order_id`, `nonce uuid UNIQUE`, `signing_key_version`, `issued_at`. One per order -- one scan per order regardless of item count (S11.1).

### 12.6a Mark ready -- a column, not a state

ADU-ARCH-01 S3.1 grants the Companion `seller.order_ready:update`; v1.6 carried the permission with no column, no state and no function behind it.

**`core."order"` gains `ready_at timestamptz NULL` and `ready_marked_by_account_id uuid NULL`**, written only by:

```sql
CREATE FUNCTION core.fn_mark_order_ready(p_order_id uuid, p_actor uuid, p_seller uuid)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = core AS $$
BEGIN
  PERFORM core.fn_has_permission(p_actor, p_seller, 'seller.order_ready:update',
                                 current_setting('adulis.audience')::core.session_audience);
  UPDATE core."order" SET ready_at = now(), ready_marked_by_account_id = p_actor
   WHERE id = p_order_id AND seller_id = p_seller
     AND state IN ('PAYMENT_CONFIRMED', 'HANDED_OFF')
     AND ready_at IS NULL
  RETURNING ready_at INTO STRICT ready_at;
  -- notify the assigned courier if one exists; if none, assignment fires it later
  RETURN ready_at;
END $$;
```

**INVARIANT -- marking ready is idempotent and does not move the order's state.** `ready_at IS NULL` in the predicate makes the second call a no-op rather than a second notification.

**Why not a `READY` state, which is the obvious design.** Three reasons, and the second is decisive. First, Event A already set the precedent that seller->courier movement is its own record rather than a lifecycle state (S14.1). Second, `order_clock_consistency` reads `CHECK ((state IN ('PAYMENT_CONFIRMED','HANDED_OFF','COMPLETED')) = (clock_stopped_at IS NOT NULL))` -- an order entering a new `READY` state would have a stopped clock and a state outside that list, and **the transition would raise**; making it work means editing a constraint that guards the payment clock. Third, a new state reopens the ratification set S12.2.1 has just closed. A nullable timestamp costs one column and no rulings.

**It notifies the courier, not the buyer.** A buyer-facing "ready" signal is a fulfilment promise Adulis cannot make on the seller's behalf, and S17.3 governs what the buyer is told.


### 12.7 Buyer cancellation penalties

`core.buyer_cancellation_counter` -- `buyer_account_id`, `seller_id NULL`, `count`, `window_start`, `cooldown_until`.

S9.5: three consecutive cancellations with one seller -> 1 hour; a pattern across sellers -> 1 day, then 2 days, escalating; **the counter decays after 30 days of clean activity**. Decay is a scheduled job, and the escalation ladder is `timing_config`, not literals in a service.

Cancelling actively is penalised less than letting an order expire silently -- so the counter increments on `EXPIRED_UNCLAIMED` at a higher weight than on `CANCELLED_BY_BUYER`. The weights are configuration.

---

### 12.8 `core.idempotency_record` -- transport

A retry on a lost response must not create a second order. The binding constraint is a low-end Android on a slow connection (S23), which makes a retry the normal case rather than the exception -- the buyer taps Reserve, the request succeeds, the response never arrives, they tap again.

The `reservation_no_duplicate_active` exclusion constraint in S12.1 catches the single-line case, and only that one. A two-line order slips through it, and even where it fires the buyer receives a constraint violation instead of the order they already hold.

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

**`actor_kind` admits `DEVICE` because the cart and device-registration endpoints are reachable before an account exists** (C6). A scheme that assumed an account would leave the pre-identity endpoints unprotected -- the ones a buyer hits on the worst connection, before they have committed to anything.

**Not append-only**, and this is a deliberate exclusion rather than an oversight. It is an expiring cache of what was already answered, not a record of what happened; `analytics.event` is the record. Marking it append-only would add a table to the count Appendix C check 5 compares against the trigger and `REVOKE` totals, and that figure has already been wrong once (Appendix B).

### 12.9 `core.rate_limit_bucket` -- transport

ADU-PRD-01 S23 requires rate limiting on auth, OTP, reservation, claim and proposal endpoints and specifies no mechanism. Postgres is the sole datastore, so the bucket is a table.

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

**INVARIANT -- a phone-keyed limit stores a hash, never the number.** The OTP limit has to work before an account exists, which is precisely when the raw number would otherwise sit in a counter table with no retention story and no DPIA coverage. Same mechanism and same reasoning as `core.phone_reuse_block` (S18.6).

**Accepted cost:** one small write per limited request, on top of the session read of S6.6, on a single managed Postgres. Affordable at the modelled volume of 1,000 sellers and worth measuring before it is not. Anonymous reads are limited at the Cloudflare edge and never reach this table (ADU-API-01 S10.1).

**Not append-only**, for the same reason as S12.8.

---

## 13. Payment

### 13.0 `core.seller_fulfilment_method` -- what fulfilment configuration is

ADU-PRD-01 S4.6 makes *"fulfilment configuration"* a publication-readiness item and ADU-API-01 S7.1 gives it the code `FULFILMENT_CONFIG`. **Neither defines it.** Through v1.6 it was the one readiness item a seller could not satisfy, because nothing existed to write. R13 defines it.

**`core.seller_fulfilment_method`** -- `seller_id`, `method core.fulfilment_method`, `handoff_note text NULL`, `is_active bool NOT NULL DEFAULT true`, `created_at`, `updated_at`. `PRIMARY KEY (seller_id, method)`.

| Value | Meaning |
|---|---|
| `BUYER_COLLECTION` | The buyer comes to the seller |
| `SELLER_DELIVERY` | The seller delivers personally |
| `COURIER_DELIVERY` | The seller's courier delivers (S6.3, S14.1) |

**INVARIANT -- a seller must offer at least one active fulfilment method before any product publishes** (S4.6). `fn_publication_readiness` returns `NOT_SATISFIED` for `FULFILMENT_CONFIG` where no active row exists. It is a readiness check rather than a table constraint because a seller in `DRAFT` legitimately has none yet.

**`handoff_note` is the seller's own words** -- where to collect, which areas are covered -- rendered on the product page and at the reservation step, so a buyer knows how they will receive the goods **before** they commit stock. It is free text under S19's machine-translation rule, never a structured address, because a structured address implies a delivery system Adulis does not operate until V6.

**No fee column exists, deliberately.** ADU-PRD-01 S25 leaves open who sets a delivery fee and whether Adulis records it, and S8.4 already rules that when a fee mechanism exists it is captured onto the order as price is. Building a column now guesses at both. Either ruling lands as a migration rather than a rewrite.


### 13.1 `core.seller_active_hours_version`

**Renamed `core.seller_availability` in v1.5, and no longer versioned.** `seller_id`, `weekday`, `opens_at time`, `closes_at time`, `updated_at`. Plain and updatable -- the effective-range machinery existed only to serve a retroactivity rule that no longer exists.

**Availability is informational.** It describes when the store is reachable, not when the system is. The app runs 24 hours; a buyer browses, reserves and pays at any hour. **The operational gates are stock and product visibility, nothing else.**

**Windows are one hour to a full day, several per day permitted, and zero windows is a valid state.** Most sellers are creators without a shop and may be available for handoff for an hour a day; requiring eight required a shopfront from people who do not have one.

```sql
ALTER TABLE core.seller_availability
  ADD CONSTRAINT availability_window_minimum
  CHECK (closes_at - opens_at >= interval '1 hour');
```

**The retroactivity rule is deleted.** With availability informational, there is no window in force to capture and no immutable change log to keep -- both existed solely to make an hour-weighted SLA computable. `payment_submission.active_hours_version_id` is dropped, and the two S24 tests that covered them go with it.

**The SLA is wall-clock**, computed from `submitted_at` alone. See S12.4.

### 13.1a `core.seller_availability_override` -- closure dates

**R27.** S13.1 describes a repeating week and has no concept of a date. A seller closing for Meskel, Timkat, Eid or a family funeral cannot say so, and the storefront goes on advertising hours the seller will not keep.

```sql
CREATE TABLE core.seller_availability_override (
  seller_id     uuid NOT NULL REFERENCES core.seller(id) ON DELETE CASCADE,
  override_date date NOT NULL,
  note          text NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_id, override_date),
  CONSTRAINT override_note_length CHECK (note IS NULL OR length(note) <= 120)
);
```

> **INVARIANT -- the presence of a row means the store is closed on that date. There is no `is_closed` column.** A boolean here would admit a row whose value is `false`, which is a row that means nothing and a second state to reason about on every read. Closed is a fact recorded by writing it down and unrecorded by deleting it.

**Overrides are closures, never different hours.** Nearly all real use is closure; supporting variable hours per date needs a second window editor, a second `>= interval '1 hour'` check and a merge rule against the weekly pattern, for a case that is rare and -- since availability gates nothing -- carries no consequence when unsupported. A seller wanting shorter hours on one day cannot express it, and nothing breaks.

**This is a schedule, not a log.** Rows are deletable, including past ones; nothing depends on a closure having been recorded, and no invariant reads a historical override. It is not append-only and must not be marked so -- the append-only count in Appendix B stays at 22.

**`note` is capped at 120 characters** because it renders on a storefront card and in a chatbot reply, both of which are width-constrained on a low-end Android. It is free text under S19's machine-translation rule.

**Rows are not purged.** At roughly ten per seller per year they are negligible, and the storage argument for deleting them is weaker than the small convenience of a seller seeing last year's pattern when planning this year's.

### 13.1b One function answers "is this store open"

Three callers need the answer -- the storefront, the chatbot's out-of-hours reply, and the seller's own screen -- and three implementations of *check the override table, then fall back to the weekday row* will differ at the edges.

```sql
CREATE FUNCTION core.fn_seller_availability_state(p_seller uuid, p_at timestamptz)
RETURNS TABLE (is_open boolean, reason text, note text)
LANGUAGE plpgsql STABLE AS $$
DECLARE v_tz text; v_local timestamp;
BEGIN
  SELECT m.display_timezone INTO v_tz
    FROM core.seller s JOIN core.market m ON m.id = s.market_id
   WHERE s.id = p_seller;
  v_local := p_at AT TIME ZONE v_tz;

  -- 1. An override for the local date wins outright.
  RETURN QUERY
    SELECT false, 'OVERRIDE_CLOSED', o.note
      FROM core.seller_availability_override o
     WHERE o.seller_id = p_seller AND o.override_date = v_local::date;
  IF FOUND THEN RETURN; END IF;

  -- 2. Otherwise the weekly pattern. Zero windows is valid and means closed.
  RETURN QUERY
    SELECT EXISTS (
      SELECT 1 FROM core.seller_availability a
       WHERE a.seller_id = p_seller
         AND a.weekday = EXTRACT(isodow FROM v_local)
         AND v_local::time BETWEEN a.opens_at AND a.closes_at
    ), 'WEEKLY_PATTERN', NULL::text;
END $$;
```

> **INVARIANT -- the override date is resolved in the market's timezone -- `core.market.display_timezone` -- never in UTC.** `override_date` is a calendar date, and a date only means something inside a timezone. Comparing it against a UTC timestamp puts the rollover at 03:00 EAT, so a store marked closed for Meskel would show open for the first three hours of it and closed for the first three hours of the following day. This is the single most likely defect in the feature and it is the reason the function exists rather than a `WHERE` clause in three services.

[!] **v1.8's version of this function read `m.timezone`, and the column is `display_timezone`. It did not compile.** The function written to prevent the feature's one real defect could not run -- which is the argument for S28's rule that migration 5 is read by hand, made by the document rather than about it.

**An override beats the weekly pattern outright** -- it does not intersect with it. A seller who is normally open Saturday and marks Saturday closed is closed, and the function returns at step 1 without consulting the week.

### 13.2 `core.payment_submission`

`order_id`, `submitted_at`, `evidence_ref uuid` (opaque handle into `financial`), `state`, `decided_by_account_id`, `decided_at`, `rejection_reason`, `sla_deadline`.

**R7(a) -- `active_hours_version_id` is gone.** S13.1 said it was dropped and this column list still carried it; v1.6 contradicted itself one section apart. The SLA is wall-clock, so there is no window version to capture.

**Adulis never asserts that a payment is genuine** (S10.1). There is no `verified_by_adulis` column and no automated confirmation path. The seller is the verifier; team members confirm where RBAC grants it and **the acting member is recorded**, never the seller owner by default.

### 13.3 `financial` schema -- the second isolated boundary

Same construction as `verification` (S7.3): its own schema, its own owning role, no direct grant to `adulis_app`, and read paths that are `SECURITY DEFINER` functions writing the access log in the same transaction as the read.

```sql
CREATE SCHEMA financial AUTHORIZATION adulis_financial;
REVOKE ALL ON SCHEMA financial FROM adulis_app;
```

Three tables. Two secrets, one log.

**`financial.payment_evidence`** -- `order_id`, `object_key`, `encryption_key_ref`, `frame_size_bytes int NOT NULL DEFAULT 65536`, `frame_count int`, `submitted_at`, `validated_at`, `deleted_at`, `retention_reason NULL`.

**INVARIANT -- evidence is encrypted as a sequence of AEAD frames, not as one object** (R18; ADU-CON-02-A1 S4.3). Whole-object AES-GCM must be buffered entirely to verify its authentication tag, so five megabytes multiplied by concurrent viewers exhausts an API instance. Framed -- AES-256-GCM per ~64 KB frame, nonce from a counter, frame index authenticated so frames cannot be reordered or dropped -- the API decrypts and streams with constant memory. The two columns exist so a reader knows the framing without parsing the object; they are set at write and never updated.

**`financial.payout_credential`** -- specified in S13.6.

**`financial.access_log`** -- append-only: `subject_kind` (`PAYMENT_EVIDENCE`, `PAYOUT_CREDENTIAL`), `subject_id`, `actor_account_id`, `actor_role`, `order_id`, `reason text NULL`, `occurred_at`.

**INVARIANT -- screenshots are stored encrypted in an isolated boundary with its own access control and audit log, and are deleted once the payment is validated. Retention beyond validation only while a claim referencing that payment is open** (S10.3). The purge selects `validated_at IS NOT NULL AND retention_reason IS NULL`.

[!] **The two secrets in this schema have opposite lifecycles, and the purge job must be scoped by table rather than by schema.** A payment screenshot is deleted the moment the payment validates; a payout credential persists for the life of the seller and is destroyed only by S16.9 deletion. A job written against the schema instead of the table would purge every seller's bank details on the first run. This is the one place the merge could bite, and it is why `evidence.purge` in S24 names its table.

**INVARIANT -- every access to a payment evidence record is written to the access log, regardless of who performs it** (S10.3). The only read path logs. S10.3 is unusually pointed about why -- *"A log that records only operator access describes a boundary Adulis controls while ignoring the actor who reads the record most often."* The seller is a legitimate reader, not an exempt one, and `reason` is nullable precisely because seller-side access requires no justification while still being recorded identically.

### 13.4 Payout details

**`core.payout_details`** -- `seller_id`, `bank_code`, `account_last4 char(4)`, `state`, `requested_at`, `activates_at`, `activated_at`, `requested_by_account_id`, `step_up_challenge_id`.

**The account number is not in this table.** It lives in `financial.payout_credential` (S13.6), keyed by `payout_details_id`. `core` holds the last four digits and nothing more, so every seller, team, support and admin surface reads a masked value because that is the only value present -- not because it remembered to mask.

**INVARIANT -- only the Owner/Admin role may view or change payout details** (S10.4). The `PAYOUT_MANAGE` permission is granted to `OWNER` and `ADMIN` only in `role_permission`, and notably **not** to `SALES_SUPPORT`, who confirm payments daily.

**INVARIANT -- changing payout details requires step-up authentication** (S6.5, S10.4). `step_up_challenge_id NOT NULL` on any row entering `PENDING`.

**INVARIANT -- a payout change does not take effect immediately** (S10.4). `activates_at = requested_at + timing_config.payout_activation_delay`. During `PENDING`, the previous `ACTIVE` row remains the one read by order creation. A partial unique index enforces at most one `ACTIVE` row per seller.

**The seller can cancel a pending change without step-up authentication** -- reverting must always be easier than changing. `fn_cancel_payout_change` takes no challenge argument.

**INVARIANT -- a payout change, whether requested, activated or cancelled, notifies the seller's registered number and every Owner/Admin. Not suppressible, not affected by notification preferences** (S10.4). A trigger enqueues with `suppressible = false`, and the sender's preference filter carries `WHERE suppressible`. The seller learns within minutes rather than when a buyer says they paid someone else.

**INVARIANT -- every payout change is written to an immutable log** (S10.4): `core.payout_change_log`, append-only -- actor, timestamp, device and session reference, masked previous account, masked new account, outcome.

**INVARIANT -- payout details cannot be changed during the recovery cooling period** (S6.6, S10.4).

### 13.5 `core.order_payout_snapshot`

**INVARIANT -- the seller's payout details in effect at the moment the order is created are written onto the order and are immutable for the life of that order** (S8.5). Write-once row referenced by `order.payout_snapshot_id`.

Without this, a payout change mid-order silently reroutes payment for every order already placed -- the exact outcome an attacker compromising a seller session is trying to produce, and it would be invisible to the buyer, the seller and Adulis.

**Reissue is the one controlled path** (S8.5): `core.payment_instruction_reissue` -- `order_id`, `previous_snapshot_id`, `new_snapshot_id`, `actor_account_id`, `step_up_challenge_id NOT NULL`, `buyer_notified_at`, `sla_reset_at`, `occurred_at`. Append-only, single-order only (no bulk path exists in the function signature), and included in the order's evidence export.

### 13.6 The payout credential

C3 scopes masking to seller, team, support and admin surfaces and permits exactly one decryption path. v1.1 built that path in `core` and logged it. v1.2 moved it to a schema of its own. **v1.3 puts it where the same value already lives.**

**Why not a schema of its own.** ADU-PRD-01 S10.3 justifies the payment-evidence boundary on the grounds that *a payment screenshot carries both parties' bank details*. The seller's account number is therefore already inside that boundary -- encrypted, behind a logging function, under its own role. A second boundary for the same secret means two key references to rotate, two logs to reconcile, and an auditor asking *"who has seen this seller's bank account?"* having to query both and union the answers. One secret, one regime.

**`financial.payout_credential`** -- `payout_details_id` (bare uuid, no FK across the boundary), `account_ciphertext bytea`, `account_name_ciphertext bytea`, `encryption_key_ref`, `written_at`. Write-once; no `UPDATE` grant. Changing a bank account writes a new `core.payout_details` row with its own credential (S13.4).

**The only read path:**

```sql
CREATE FUNCTION financial.render_payment_instructions(p_order_id uuid, p_actor uuid)
RETURNS TABLE (bank_code text,
               account_ciphertext bytea,
               account_name_ciphertext bytea,
               encryption_key_ref text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = financial AS $$
BEGIN
  -- 1. Verify p_actor is the buyer on p_order_id.
  -- 2. Verify the order is in a payable state.
  -- 3. Read the payout snapshot captured on the order, never the seller's current record.
  -- 4. INSERT INTO financial.access_log (subject_kind => 'PAYOUT_CREDENTIAL', ...)
  --    in this transaction.
  -- 5. Return the ciphertext and the key reference. DO NOT DECRYPT -- R15.
END $$;

GRANT EXECUTE ON FUNCTION financial.render_payment_instructions TO adulis_app;
```

**INVARIANT -- key material never enters PostgreSQL** (R15; ADU-CON-02 v3.0 S8.2). v1.6 returned plaintext, which requires the decryption key to be reachable from a database session -- so the key transits the connection and can surface in a query log. Under R15 the function performs the same three checks and writes the same access-log row, then returns ciphertext plus the key version; the API decrypts with a key from the deployment secret store.

**The invariant that matters is preserved exactly.** *You cannot read the credential without the read being logged, because there is no other way to reach the ciphertext.* And the posture is strictly stronger than v1.6's: S13.6 justified encryption on the grounds that a dump or restored backup yields nothing in the clear, and under R15 an attacker holding a **live database connection** also yields nothing. `encryption_key_ref` names the key version, which is what makes rotation an added `_V2` and a re-encrypt job rather than a migration.

**The same rule binds `financial.read_payment_evidence`**, which already returns the row rather than the bytes: `object_key` and `encryption_key_ref` out, decryption in the API, `actor_role` derived under R5 exactly as in S7.3. Its signature drops `p_actor_role text` and becomes `(p_evidence_id uuid, p_actor uuid, p_reason text)`, deriving the role from `core.operator_grant` for an operator and from the seller relationship on the order for a seller -- a seller reading evidence on their own order is a legitimate reader logged identically, which is why `reason` is nullable.

**INVARIANT -- no column named `account_ciphertext` exists anywhere in `core`.** Cheaper to check than a revoked grant: Appendix C check 11 is a `grep`, and it fails loudly if a future migration reintroduces the column for convenience.

Four properties follow:

- **The masking invariant holds by structure.** Seller, team, support and admin surfaces read `account_last4` because it is the only value in `core`. There is nothing to forget to mask.
- **One query answers the auditor's question.** `SELECT ... FROM financial.access_log WHERE subject_kind = 'PAYOUT_CREDENTIAL'` -- or drop the predicate and get every read of a bank account number by any route, screenshot or credential, in one result set. That is the query a data-protection review actually asks for, and v1.2 could not produce it without a union across two roles.
- **A second unlogged read path stays conspicuous.** Adding one is a reviewed migration either way; the gain is that a new function in a three-table schema is visible where one among `core`'s seventy-seven is not. Review ergonomics, not a security boundary -- stated accurately here because v1.2 overstated it.
- **The log stays short.** One row per buyer per order, plus the evidence reads. Readable in full by the paid reviewer S23 requires.

**On encryption itself, since v1.2 assumed it rather than arguing it.** ADU-PROJ-01 S7.3 names three categories requiring specific handling under Proclamation 1321/2024, and payout details are not among them. The number is displayed to every buyer who places an order, so confidentiality against buyers is impossible by construction; and the attack S10.4 describes is a **write** attack -- change the details, collect from everyone thereafter -- defeated entirely by controls on the write path: step-up, activation delay, unsuppressible notification, immutable log, order snapshot. None of those depends on the value being encrypted.

Encryption buys exactly one thing: **a database dump or a restored backup does not yield every seller's bank account in the clear.** That is worth a column type for a company whose positioning is trust, and it is retained on that basis alone. Recorded here so the question is settled rather than rediscovered.

---

## 14. Handoff

### 14.1 `core.courier_custody_transfer` -- Event A

`order_id`, `courier_account_id`, `seller_confirmed_at`, `courier_confirmed_at`.

**INVARIANT -- Event A never completes an order, never counts toward seller trust level, never enables a review** (S11.2).

Expressed structurally: this table has **no column** for completion, level or review, and **no trigger** on it touches `order.state`, `seller_level_state` or `review`. Conflating the two events would make the trust ladder fakeable by any seller with one cooperative courier -- so they are two tables, not one table with a `kind` column, precisely so that a generated code path cannot reach the wrong behaviour by passing the wrong enum value.

### 14.2 `core.handoff_scan` -- Event B

`order_id`, `scanned_by_account_id`, `nonce uuid UNIQUE`, `signed_at` (device clock, inside the token), `reported_clock_offset_ms`, `corrected_at`, `received_at` (server), `validity`, `counts_toward_level boolean`, `review_badge`.

**INVARIANT -- a courier can never perform the buyer's scan, on any client, under any circumstance** (S11.2):

```sql
ALTER TABLE core.handoff_scan
  ADD CONSTRAINT handoff_scanned_by_buyer
  FOREIGN KEY (order_id, scanned_by_account_id)
  REFERENCES core."order" (id, buyer_account_id);
```

The buyer is the party asserting receipt. A courier scanning on the buyer's behalf would let a seller manufacture verified handoffs at will -- so the account that scans must be the account on the order, as a foreign key, not as a check somewhere in a service.

**INVARIANT -- a token nonce already seen is rejected as replay, always, regardless of timestamp** (S11.4). `UNIQUE (nonce)`. A replay is a unique-violation, which is the cheapest and most reliable rejection available.

**INVARIANT -- the signed timestamp inside the scanned token governs order completion, not the moment the scan reaches the server** (S11.4).

**INVARIANT -- server receipt time governs level advancement.** New in v1.4, and the two are separated deliberately.

**Why they were separated.** S11.4 used one test for two decisions with opposite failure costs. Getting *completion* wrong hurts the buyer -- they have their goods and no record, and their stock was released to someone else. Getting *level advancement* wrong corrupts the trust ladder, which is the product's only real differentiator. The first argues for generosity toward a clock the platform cannot verify; the second argues for a clock nobody can manipulate. One test cannot serve both.

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
| Nonce seen | `REJECTED_REPLAY` | -- |

`level_credit_grace` is per-market configuration, default **24 hours**. It covers essentially every honest late sync -- a buyer's phone regains signal within hours, not days -- while removing the attacker's ability to farm at leisure.

**`CHECK (signed_at >= order_qr_token.issued_at)`.** A scan cannot predate the token it scanned, which alone caps backdating at the order's own lifetime.

**Honest skew is corrected, not punished.** Cheap Android devices frequently carry a correct NTP-synced UTC clock and a misconfigured timezone, or simply drift. The client reports its observed offset from the last successful bootstrap (ADU-API-01 S3.1); the server subtracts it. A malicious client lies about the offset too -- but the floor at `issued_at` bounds the lie, and a reported offset that disagrees with the population feeds `level_velocity_flag`. **An honest buyer with a wrong clock must never cost an honest seller a level-counting handoff**, and under S11.4 as written they could.

[!] **The cost, stated plainly.** A genuinely offline handoff that reaches the server beyond window plus grace completes the order but does not advance the ladder. That is exactly the treatment S11.4 already gives a `LATE` scan, so no new outcome is introduced -- only a different test for which scans receive it. The seller sees it, and it should be rare.

[!] **This contradicts ADU-PRD-01 S11.4 as written**, which says an in-window late scan *"completes the order and counts toward trust level, even if the server had already expired it."* Under v1.4 it completes the order always, and counts toward level only if it arrived inside the grace. Recorded as **W11** in S29.

**And a correction to how ADU-API-01 v1.0 and v1.1 sized this.** Both said a colluding buyer with a manipulated clock can manufacture verified handoffs. True, and overstated: **a seller with colluding buyers can already do that by scanning promptly with correct clocks, entirely inside the window.** Backdating adds no capability -- only the convenience of farming at leisure and recovering expired orders. S5.2's distinct-buyer, velocity and graph controls were always the primary defence and remain so. This change removes the convenience; it does not close the underlying attack, and nothing at the data layer can.

**INVARIANT -- stock is never re-decremented when an expired order is completed by a late-syncing scan** (S11.4). The completion path for an already-expired order writes a `stock_event` with `reason = 'RECONCILIATION'` and `delta = 0`, recording the discrepancy and notifying the seller. Re-decrementing could drive the count negative and violate the non-negativity constraint -- the transaction would fail, and a doorway handoff would be lost to an arithmetic accident.

**Where the released stock was reserved by a different buyer in the interval**, the reconciliation trigger inserts a `moderation_queue_item` of kind `DOUBLE_ALLOCATION`. Two buyers hold claims on one item and no software resolves that -- but the platform must notice it rather than let one of them discover it at a doorway.

**G1.4 -- the token is a server-minted HMAC over `(order_id, nonce, key_version)`.** Ratified as built; no document held it before.

**What it defends against, and what it deliberately does not.** It defends against **fabrication by anyone not holding the server key**, and against **replay by the `nonce` unique index**. It does not defend against the buyer, because the buyer is one of the two parties -- and the composite foreign key to `("order".id, buyer_account_id)` already makes a scan from any other account structurally impossible.

**A third party who photographs the QR gains nothing.** They can read the token; they cannot write a scan, because the composite key requires the buyer's account.

**Client-side signing was the alternative and is worse in every direction** -- key distribution to phones, key theft from a device, and it still would not defend against the party holding the key.

### 14.3 Confirmation tiers

`core.order_confirmation` -- `order_id`, `tier`, `source_scan_id NULL`, `confirmed_at`.

**INVARIANT -- only a scanned handoff counts toward trust level** (S11.3). The recompute function filters `handoff_scan.counts_toward_level = true`; it never reads `order_confirmation`. A tapped confirmation publishes a review at medium weight and advances nothing.

---

## 15. Reviews

**`core.review`** -- `order_id UNIQUE`, `buyer_account_id`, `seller_id`, `seller_rating smallint CHECK (1..5)`, `body text`, `badge`, `published_at`, `anonymised_at NULL`.

**`core.review_item_rating`** -- `review_id`, `product_id`, `item_rating smallint`. One review per order, N item ratings -- because S12 requires item quality to aggregate to the **product** while a single order may contain several.

**INVARIANT -- two ratings, always separate, never averaged together** (S12). Two columns in two tables. There is no `overall_rating` column anywhere, so nothing can compute one by accident and display it.

**INVARIANT -- a review may only be written by the buyer who holds the order it references** (S6.1):

```sql
ALTER TABLE core.review
  ADD CONSTRAINT review_by_order_buyer
  FOREIGN KEY (order_id, buyer_account_id)
  REFERENCES core."order" (id, buyer_account_id);
```

**INVARIANT -- a seller can never prevent a review from publishing. Evidence determines the badge, not the right to publish** (S12). `published_at` is set by the insert trigger and there is no seller-writable column on this table -- no `hidden`, no `approved`, no `visible`. `badge` is derived from `order_confirmation.tier`, so refusing to scan lowers the badge and silences nothing.

**INVARIANT -- reviews are anonymised, never deleted** (S16.9). Deletion nulls `buyer_account_id` and sets `anonymised_at`; the row survives. A seller cannot erase their own reliability history by closing the account.

---

## 16. Claims and evidence export

**`core.claim`** -- `order_id`, **`reservation_id NULL` (C8)**, `opened_by_kind`, `opened_by_account_id NULL`, `trigger`, `opened_at`, `review_deadline` (`opened_at + 2 days`), `outcome NULL`, `outcome_reason`, `decided_by`, `decided_at`.

`CHECK ((opened_by_kind = 'BUYER') = (opened_by_account_id IS NOT NULL))` -- a system-opened claim has no claimant, and a buyer-opened one must name theirs.

**Which paths set `reservation_id`** -- specified in v1.1, because C8 left it ruled but unassigned:

| Path | `reservation_id` |
|---|---|
| S9.4 -- seller cancelled a line citing stock that was not current | **Set** to that line |
| S10.5 -- refund reported and not acknowledged | **Set** -- a refund is per-line |
| S9.2 -- fulfilment window elapsed on a paid order | Null -- order-level |
| S14 -- SLA breach, goods not received, not as described | Null -- order-level |
| S16.8 -- safety suspension terminating a paid order | Null -- order-level |

**Integrity -- added in v1.2.** The assignment table above tells code what to write; these two constraints stop it writing something else.

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

**INVARIANT -- a claim's `reservation_id`, where present, names a line on that claim's own order.** Without the composite FK, nothing stopped a claim citing a line from a different order entirely -- and since evidence is attached automatically by claim type (below), the dispute would have been reviewed against the wrong line's stock history.

**INVARIANT -- at most one open claim exists per scope.** One per line, plus one order-level, and no second claim at the same scope while the first is undecided.

**The consequence, recorded because it is a behaviour and not just a constraint: a trigger firing against an already-open claim at the same scope appends evidence rather than opening a second claim.** S14's triggers are largely sequential stages of one failure -- SLA breach, then goods not received, then refund promised and not delivered -- rather than independent disputes. Treating them as separate claims would demote the seller once per stage under S14's unconditional rule, so a single seller failure could cost three levels. One claim, growing its evidence set as the situation develops, is both the correct account of what happened and the only version that does not multiply the penalty.

**`core.claim_evidence_item`** -- `claim_id`, `kind`, `reference uuid`, `attached_at`.

**Evidence is attached automatically by claim type** (S14). A trigger on claim insert populates the set. Manual assembly at review time loses the evidence that was current at the moment of the dispute, and the payment screenshot in particular is on a deletion schedule (S13.3) -- opening a claim sets `retention_reason = 'OPEN_CLAIM'` on the evidence row in the same transaction, which is what stops the purge job from destroying the only proof.

**INVARIANT -- an upheld claim always demotes the seller's level** (S14, S5.2). Trigger, unconditional.

**INVARIANT -- deletion never removes evidence relied upon in a resolved claim, and never removes moderation history** (S16.9). No `DELETE` grant on either table.

**`core.evidence_export`** -- `claim_id NULL`, `order_id`, `requested_by`, `generated_at`, `object_key`, `expires_at`. S14: Adulis does not file police reports; it produces an export and cooperates with lawful process. **For Phase 2 sellers this export is the buyer's primary recourse and must be fast and complete** -- which is why evidence is assembled at claim time rather than at export time.

---

## 17. Chat and the chatbot

### 17.1 `chat` schema -- the operational record

> **D-66 / D-73 -- the anchor is on the MESSAGE, and `chat.conversation`'s `product_id` and `order_id` are dropped.**
>
> `one_conversation_per_pair UNIQUE (seller_id, buyer_account_id, market_id)` is unchanged, so **a buyer and a seller have exactly one thread** -- which is what a thread is. A per-conversation anchor therefore answered a buyer's **second** product question against the **first** product's slots.
>
> **That is a wrong answer with better containment metrics than the missing anchor it replaced** -- a regression that measures as an improvement, which S15.3's loop would then optimise toward. The missing anchor at least escalated, which is honest.

**`chat.message` carries `product_id uuid NULL` and `order_id uuid NULL`, with `CHECK (num_nonnulls(product_id, order_id) <= 1)`.** Slot resolution reads the anchor of **the message being answered**. The anchor must belong to the seller being talked to -- 404 on mismatch, checked per message.

**A thread is a relationship; a question is about a thing.** Anchoring the thread anchored the wrong noun.

[!] **Nothing forbids rewriting a message's anchor** (D-86). No code path updates one, and the grant permits it; the conversation-era anchor earned an explicit write-once trigger for the same risk. **An anchor rewritten after the bot answered falsifies the containment record retroactively.** Whether a message's anchor is immutable after send is unruled.


**`chat.conversation`** -- `seller_id`, `buyer_account_id`, `market_id`, `started_at`, `last_message_at`. Unique together.

**G1.10 -- `product_id uuid NULL` and `order_id uuid NULL`, at most one set**, enforced by `CHECK (num_nonnulls(product_id, order_id) <= 1)`. Set at creation from wherever the conversation began.

> **Without an anchor a slotted template cannot be filled, so the bot escalates instead of answering -- and that is worse than it looks.** Containment then measures the missing anchor rather than the bot, and S15.3's improvement loop optimises against a signal that is wrong about which intents are failing.
**`chat.message`** -- `conversation_id`, `sender_kind`, `sender_account_id NULL`, `body`, `locale`, `sent_at`, `read_at`.
**`chat.bot_turn`** -- `message_id`, `turn_index`, `resolution_path`, `intent_id NULL`, `confidence`, `model_id NULL`, `tokens_in`, `tokens_cached`, `tokens_out`, `latency_ms`, `escalated`.

**INVARIANT -- the model never generates a response. It returns an intent ID** (S15.1). `bot_turn` has an `intent_id` and **no `generated_text` column**. The body sent to the buyer is always rendered from `nlu.answer_template`. There is nowhere to put model-generated prose, so none can be stored or sent.

**Free sellers carry the load manually and the burden must be visible** (S15): `chat.v_seller_chat_burden` -- unanswered count, median response time, out-of-hours question count.

### 17.2 `nlu` schema -- the identity-stripped library

**`nlu.intent`** -- global: `code`, `description`, `created_at`, `retired_at`. Expected inventory 50-70 (S15.1).
**`nlu.intent_phrase`** -- `intent_id`, `locale`, `text`, `embedding vector(N)`, `source`. HNSW index for layer 3.
**`nlu.answer_template`** -- `intent_id`, `locale`, `seller_id NULL`, `template`, `slots text[]`. **Intents are global; answers are per-seller** (S15.1) -- a null `seller_id` is the global default.

[!] `answer_template.seller_id` is the **one** identifier permitted in `nlu`, and it is a bare uuid with **no foreign key** to `core.seller`. Stated explicitly because it is the obvious place for a well-meaning agent to add a foreign key and quietly join the two stores S15.3 requires separated. Appendix C check 4.

**`nlu.unmatched_phrase`** -- `text`, `locale`, `market_id`, `observed_at`. Written by an ETL job from escalated turns with identifiers removed. **No `conversation_id`, no `buyer_id`.**
**`nlu.regression_case`** -- `text`, `locale`, `expected_intent_id`, `frozen_at`.
**`nlu.regression_run`** -- `ran_at`, `change_reference`, `precision_before`, `precision_after`, `accepted boolean`.

**INVARIANT -- a frozen regression set runs before and after every update; a precision drop reverts the change** (S15.3). `regression_case` is append-only with no `UPDATE` grant -- a "frozen" set that can be edited to make a run pass is not a regression set.

### 17.3 Metering

**`billing.inference_usage_month`** -- `seller_id`, `month date`, `cost_minor`, `cap_minor`, `warned_at_70`, `warned_at_90`.

**INVARIANT -- the bot never goes dark. Only layer 4 is metered. At the cap, layers 0-3 continue and everything else escalates** (S15.1). The cascade checks the cap **only before layer 4**. Layers 0-3 have no cap read in their code path, so an outage in the metering table cannot silence the bot.

`cap_minor` = 15% of that seller's tier revenue, computed at month start and stored, so a mid-month tier change does not retroactively move the cap.

---

## 18. Subscriptions and entitlements

### 18.1 `billing.subscription`

`seller_id`, `state`, `tier`, `term`, `beta_started_at`, `beta_ended_at`, `trial_started_at`, `trial_ends_at`, `current_period_start`, `current_period_end`, `locked_rate`, `locked_rate_currency`, `price_schedule_version_id`.

**INVARIANT -- `BETA` is a distinct subscription state, not a $0 Listed subscription** (S16.10). It is a value in the state enum, not a tier with a zero price. Beta cohort behaviour is the evidence for every launch decision in ADU-PROJ-01 S12, and it is worthless if it cannot be separated from sellers who chose Free on the merits -- so the separation is in the type system, where a query cannot accidentally blend them.

**INVARIANT -- the trial is 60 days from each seller's own signup date, never a calendar cutoff** (S16.3).

[!] **The beta-to-paid transition is open** (S16.10, S25): whether the 60-day trial runs in addition to the beta period or is consumed by it. **The schema is neutral** -- four independent columns. Either ruling is a value written at conversion, not a migration. This needs an answer before the first cohort converts, not before it is onboarded.

**`billing.subscription_state_transition`** -- append-only.

**INVARIANT -- suspension never deletes seller data and never resets trust level** (S16.4). No code path from a subscription state change reaches `seller_level_state` or any catalogue table other than `visibility`. Team logins are **disabled, not deleted**: `seller_team_member.suspended_at` rather than a row removal.

### 18.2 Pricing

**`billing.price_schedule`** -- `market_id`, `tier`, `price_minor`, `currency`, `usd_reference_minor`, `fx_rate`, `prepay_quarterly_discount`, `prepay_annual_discount`, `derived_at`, effective range.

**INVARIANT -- every market has its own price schedule** (S16.6). No global row.
**INVARIANT -- the rate is locked when a paid term begins and holds for that term** (S16.6).
**INVARIANT -- the rate used is logged against every subscription record** (S16.6). The version reference is `NOT NULL` on any state carrying a price.

### 18.3 Entitlements

**INVARIANT -- entitlements are resolved by a service at read time, never stored as a boolean column** (S16.5).

`billing.tier_definition` (versioned: product cap, chatbot scope, blue tick, broadcast, analytics scope, team, support tier, API) and `core.ladder_config` level unlocks.

```sql
CREATE FUNCTION billing.fn_effective_limit(p_seller_id uuid, p_capability text)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  -- the intersection of tier entitlement and trust level (S16.5)
$$;
```

**INVARIANT -- the effective limit for any capability is the intersection of tier entitlement and trust level** (S16.5). One function, called by every capability gate. **No table anywhere carries a `has_chatbot` or `can_broadcast` boolean.** Appendix C check 3.

**Broadcast eligibility requires Trusted level as well as Pro tier** (S16.1) -- the same intersection. Tier grants the capability; level grants the right to use it.

**INVARIANT -- payment never buys a badge or a level** (S13.1). The intersection function reads the level; it never writes it. There is no path in the other direction, by construction.

### 18.4 Beta entitlements

`tier_definition` carries a row for the `BETA` state with S16.10's grid: chatbot on all products, unlimited products, account-control verification free, **no blue tick**, **no broadcasts** (requires Trusted, which no beta seller can have earned), views/reservations/conversion analytics, no team accounts, no data export.

### 18.5 Collection and suspension

**`billing.collection_record`** -- `subscription_id`, `amount_minor`, `reminder_sent_at`, `marked_transferred_at`, `reconciled_at`, `reconciled_by`, `provider_kind`, `provider_ref`.

**INVARIANT -- the payment collection provider sits behind an adapter interface** (S16.7): `provider_kind` and `provider_ref`, never a provider-specific column.

**No purchase surface exists at MVP** (S16.7) because beta sellers pay nothing. When it arrives it is part of the seller console -- ADU-ARCH-01 removes the seller app, so the In-App Purchase machinery that required a distinct session audience has nothing left to keep apart.

**Suspension** (S16.8) -- `seller.status` distinguishes `BILLING_SUSPENDED` from `SAFETY_SUSPENDED`, because they must not behave the same way.

**INVARIANT -- billing suspension never cancels an active order.** Order functions check `status <> 'SAFETY_SUSPENDED'` for existing-order operations and `status = 'ACTIVE'` for forward-looking ones. A buyer with an order in flight sees no change to that order.

**Safety suspension** writes `moderation_event` with an explicit `active_orders_decision` recorded at the time. Where orders terminate: unpaid orders cancel and release stock; **paid orders open a claim automatically on the buyer's behalf** rather than cancelling (S16.8) -- which is why `claim.opened_by_kind` admits `SYSTEM`.

**INVARIANT -- moderation reasoning is never disclosed to third parties** (S16.8). `moderation_event.reason` is not readable on any buyer-facing path, and the buyer notification template has no slot for it. The buyer is told what happens next, never why the seller was suspended.

### 18.6 Seller deletion

**INVARIANT -- deletion is blocked while any of six obligations is unresolved, and the seller is shown exactly which** (S16.9):

```sql
CREATE FUNCTION core.fn_deletion_blockers(p_seller_id uuid)
RETURNS TABLE (blocker text, count int, resolving_action text) ...
```

Six independent checks -- non-terminal reservations, evidence awaiting confirmation, orders confirmed and awaiting handoff, refunds unreported or unacknowledged, open claims, `PAST_DUE` subscription. `fn_delete_seller` raises unless the function returns zero rows. S24 requires each blocker tested independently, which this shape makes possible.

**INVARIANT -- for a company seller, only the Owner may initiate deletion** (S16.9). Not Admin, not any other role.

**INVARIANT -- deletion requires step-up authentication** (S6.5).

**INVARIANT -- a deleted seller's phone number does not become immediately reusable for a new seller account** (S16.9). `core.phone_reuse_block` -- `phone_hash bytea`, `blocked_until`, `market_id`. Hashed, not stored in the clear: the block must outlive the account whose personal data was scrubbed.

Effects follow S16.9's table exactly: storefront unpublished then purged on the media lifecycle, identity fields scrubbed, **verification attestation retained and the keyed ID hash surviving**, payout purged, transactional records anonymised, reviews anonymised, team access revoked, courier assignments ended, moderation and audit retained in full.

---

## 19. Follows, feed and broadcasts

**`core.follow`** -- `buyer_account_id`, `seller_id`, `state`, `created_at`, `changed_at`, `notification_preference`. `UNIQUE (buyer_account_id, seller_id)`.

**INVARIANT -- one canonical follow state. Following, unfollowing and per-seller notification preferences resolve to one server-side relationship regardless of which of the six surfaces initiated it** (S17.1.1). One row, `UNIQUE` on the pair. Six surfaces cannot produce six states because there is one row to write.

**INVARIANT -- following is available before purchase, from every surface where a seller is identified** (S17.1). No column references an order. There is no gate to remove later, because none was built.

**Per C4 there is no deferred-follow table.** A web follow intent emits `follow_intent_web` (S20) and nothing else. `follow_intent_web` measured against `follow_created` is the instrument S17.1.1 asks for; if the gap is wide, deferred follow gets rebuilt on that evidence rather than reinstated on assumption.

**Adulis followers are not social-platform followers** (S17.1). `follow` has no relationship to `seller_social_account.follower_count_at_verification`, and no view joins them. A seller with 80,000 social followers begins here with none.

**`core.seller_activity`** -- `seller_id`, `kind`, `reference uuid`, `occurred_at`.

**INVARIANT -- the following feed contains only sellers the buyer follows. It never introduces a seller the buyer has not followed, by any mechanism** (S17.2). The feed query is a join from `follow` to `seller_activity`, ordered by `occurred_at DESC`. **No ranking table, no score column, no impression log, no candidate generator exists.** The feed is a query, not a recommender -- and a recommender cannot be built by accident on a schema with nowhere to store a score.

**`core.broadcast`** -- `seller_id`, `kind`, `body_template`, `sent_at`. `fn_send_broadcast` calls `fn_effective_limit(seller_id, 'BROADCAST')`, which is the Pro-or-Business **and** Trusted intersection.

---

## 20. Notifications

**`core.notification`** -- `recipient_account_id`, `channel`, `template_key`, `locale`, `slots jsonb`, `order_id NULL`, `suppressible boolean`, `state`, `scheduled_for`, `sent_at`.

**INVARIANT -- notification content is selected by order state at send time, not by a single template** (S17.3). The sender re-reads `order.state` immediately before dispatch and picks the template then. A buyer whose payment was confirmed overnight must never receive an expiry warning queued the previous evening.

**INVARIANT -- no notification is sent for an order past `PAYMENT_CONFIRMED`** (S17.3, S9.2). The sender's guard is `WHERE o.clock_stopped_at IS NULL`, the same column the expiry job uses. One column governs both, so the two rules cannot drift apart.

**INVARIANT -- translated strings are never assembled from concatenated fragments** (S17.3, S23.1). `slots jsonb` plus a whole-sentence template per locale. There is no `prefix`/`suffix` column and no concatenation helper. Word order differs between English and Amharic, and fragment assembly produces text that is grammatically wrong in one of them.

**Two notifications only** (S9.3): the morning after (08:00 EAT) and two hours before expiry. Both name the seller and state the deadline as a **time, never a duration** -- a duration is stale the moment it is read from the notification tray, so the slot is a timestamp and the template formats it.

**The in-app fallback is not optional** (S9.3, S17.3). `device.notification_permission = 'DENIED'` routes to `IN_APP` with a persistent badge and countdown on the order card. Android 13 and later let buyers refuse notifications, and a refused permission must not mean a lost order.

---

## 21. Moderation

**`core.content_report`** -- `reporter_account_id NULL`, `target_kind`, `target_id`, `reason_code`, `body`, `reported_at`, `resolved_at`.

**Store-mandated, build in V1** (S18): a report mechanism on **every** piece of user content. `target_kind` enumerates all of them; adding a user-content surface without adding its enum value is a compile-time failure in the generated types.

**`core.block`** -- `blocker_account_id`, `blocked_account_id`, `created_at`.

**`core.moderation_queue_item`** -- `kind`, `target_kind`, `target_id`, `queued_at`, `due_at`, `claimed_by`, `resolved_at`.

`due_at = queued_at + 24 hours` -- **action on reported content within 24 hours** (S18) is a column an overdue query can find, not a target in a document.

**`core.moderation_event`** -- append-only and immutable: `actor_account_id`, `target_kind`, `target_id`, `decision`, `reason`, `active_orders_decision NULL`, `occurred_at`.

**`core.prohibited_keyword`** -- per market, versioned, covering the twelve categories of ADU-00.

---

## 22. Analytics

**`analytics.event_definition`** -- `name`, `version int`, `required_keys text[]`, `key_types jsonb`, `introduced_at`, `retired_at`. `UNIQUE (name, version)`.

**INVARIANT -- every meaningful action emits a versioned event. A definition change creates a new event version; it never edits an existing one** (S20). `event_definition` is append-only. Changing a definition means inserting `(name, version + 1)`; there is no path that edits version 1, so historical events remain interpretable against the definition they were written under.

**`analytics.event`** -- partitioned monthly by `occurred_at`:

| Column | Notes |
|---|---|
| `id`, `name`, `version`, `occurred_at` | FK to `event_definition (name, version)` |
| `market_id`, `seller_type`, `eligibility_path`, `seller_level` | **Real columns, not payload keys** (S20) |
| `actor_account_id NULL`, `seller_id NULL`, `order_id NULL`, `device_id NULL` | |
| `payload jsonb` | Everything else |

**`eligibility_path` is the most important field in this version** (S20). Audience-path and identity-path sellers must be measurable as separate cohorts from the first day of Phase 2 -- on churn, conversion, claim rate and first-sale time. That is the evidence for whether dropping the gate worked, and S20 is explicit that it cannot be reconstructed later. It is a column, indexed, `NOT NULL` on every seller-scoped event.

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

All 68 event names in S20, plus the chatbot turn fields, are seeded as version 1 definitions in the first migration. ADU-WEB-01 S12's eight website events use the same registry, but the website writes them to the waitlist store (S25) and they are imported, per C7.

---

## 23. Ledger -- custody readiness

**`ledger.transaction`** -- `id`, `kind`, `occurred_at`, `reference_kind`, `reference_id`.
**`ledger.entry`** -- `transaction_id`, `account_code`, `direction`, `amount_minor`, `currency`, `party_kind`, `party_id`.

**INVARIANT -- every payment event writes a ledger entry, recording amount, currency, parties, direction and state, with Adulis's balance at zero** (S22).

**INVARIANT -- financial records are append-only** (S22).

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

A scheduled assertion job raises an alert if any row is non-zero. **Adulis holds no buyer money before the licence** (ADU-00 rule 1, ADU-PROJ-01 S7.1) is the most valuable structural feature of the business through V3, and a query that can prove it on demand is worth more than a policy that asserts it. When the licence arrives, custody becomes a change in who holds the balance -- and escrow is designed against this ledger, which is why it exists now with every balance at zero.

---

## 24. Scheduled work

graphile-worker in the `jobs` schema. Postgres is the sole datastore, including the queue.

| Job | Cadence | Notes |
|---|---|---|
| `order.expire_sweep` | 1 min | Idempotent (S9.1); skips `clock_stopped_at IS NOT NULL` |
| `notification.send` | 1 min | Re-reads order state at send (S17.3) |
| `notification.morning_reminder` | Daily 08:00 EAT | Per market timezone |
| `stock.confidence_nudge` | Hourly | Levels 1-5, 3-hourly once critical (S13.3) |
| `level.recompute` | On write + nightly sweep | Nightly catches window expiry |
| `financial.purge_payment_evidence` | Hourly | **Scoped to `financial.payment_evidence` by name**, never to the schema -- payout credentials share it and must not be purged (S13.3) |
| `media.lifecycle` | Daily | S7.4 |
| `subscription.warn` | Daily | 14, 3, 1 day (S16.3) |
| `subscription.collect_reminder` | Per schedule | SMS (S16.7) |
| `waitlist.retention_purge` | Daily | 12 months (S25) |
| `nlu.harvest_unmatched` | Daily | Identity-stripped ETL (S15.3) |
| `analytics.create_partition` | Monthly | |
| `ledger.assert_zero` | Hourly | S23 |
| `social_post.availability_check` | Daily | S9.6 |
| `buyer_cooldown.decay` | Daily | 30-day decay (S9.5) |
| `idempotency.purge_expired` | Hourly | S12.8 -- 24-hour records |
| `rate_limit.purge_stale` | Hourly | S12.9 -- buckets older than the widest window |
| `order.close_confirmation_window` | 1 min | **Two branches, not one** -- D-55. **24h, seller silent:** S12.4a exactly -- no cancellation, stock held, order stays `PAYMENT_SUBMITTED`, `SYSTEM` claim opened, miss recorded. **12h, buyer silent after a rejection:** ordinary expiry -- cancel, release stock, no claim. v1.11's row described only the second and applied it to both (S12.4) |
| `notification.push_seller` | 1 min | Native push to the seller's registered devices (S6.4) |
| `device.purge_unbound` | Daily | C6 -- unbound devices and their carts |

**INVARIANT -- every job is idempotent.** Not a convention: each is either guarded by a partial unique index on its effect, or written as a compare-and-set on a state column. A job that runs twice must produce what one run produced, because at-least-once delivery is what the queue guarantees.

---

## 25. The waitlist store (separate, per C7)

Deployed with the website, independently of product infrastructure.

**`waitlist.application`** -- `reference_code`, `full_name`, `phone_e164`, `primary_platform`, `primary_handle`, `secondary_platform NULL`, `secondary_handle NULL`, `follower_count_self_reported int NULL`, `sells_what`, `city`, `consent_at`, `consent_text_version`, `submitted_at`, `purge_after`, `reviewed_by NULL`, `reviewed_at NULL`, `outcome NULL`.

**INVARIANT -- `follower_count_self_reported` is optional and never validated against a threshold** (ADU-WEB-01 S7.1). No `CHECK`, no `NOT NULL`, and no rejection path exists in the schema -- there is no `outcome = 'REJECTED_ON_FOLLOWERS'` value to write. Every applicant is accepted onto the list.

**Platform is an enum, not free text** (ADU-WEB-01 S7.1), because eligibility depends on it and a typed platform name cannot be joined to anything later.

**Two handles are captured** because a seller on both platforms is assessed on their **highest single account, never the sum** (S4.1). Capturing both is what makes that comparison possible.

**INVARIANT -- `purge_after = submitted_at + 12 months`, written as a column, not applied by a job's hard-coded interval.** ADU-WEB-01 S7.3 requires the consent line, the privacy notice and the implementation to state the same number. A column makes the implemented number readable in one query by anyone checking that the three agree.

[!] **The DPIA must cover this table before the first submission** (ADU-PROJ-01 S14, ADU-WEB-01 S7.3). It is the earliest hard external gate in the project and it lands before any product table exists.

**Import path.** At cohort onboarding the application row is read once to pre-fill the seller record, and `follower_count_self_reported` is written to `core.seller.waitlist_follower_claim` -- **a distinct column from `seller_social_account.follower_count_at_verification`.** Self-reported and verified counts are never blended, because the difference between them is itself a signal, and because ADU-PROJ-01 S12's follower-count evidence gate depends on the verified number alone.

---

## 26. Invariant enforcement matrix

Every PRD invariant, the mechanism, and where it is checkable. Abbreviated to the mechanisms that are not simple `NOT NULL` or FK.

| PRD | Invariant | Mechanism | Shere |
|---|---|---|---|
| S3 | No S6.5 action is reachable from the mobile app | `core.permission.surfaces` -- a step-up permission has `'{CONSOLE}'` and the function refuses a `MOBILE` session | 6.9a |
| S6.6 | A deletion OTP cannot become a login | Deletion OTP purpose cannot issue a session -- trigger | 6.5 |
| S4.6 | A seller offers at least one fulfilment method before publishing | `fn_publication_readiness` returns `NOT_SATISFIED` for `FULFILMENT_CONFIG` | 13.0 |
| S10.3 | Boundary audit identity is derived, never supplied | `read_attestation` / `read_payment_evidence` take no role parameter -- R5 | 7.3, 13.3 |
| S5.3 | Public stats are O(1) to maintain and never a materialized view | Trigger-maintained table; Appendix C check 15 -- R16 | 8.3 |
| S4.1 | Eligibility from per-market config; Phase 2 needs no code change | `eligibility_config` versioned rows + `fn_evaluate_eligibility` | 5.3, 7.4 |
| S4.1 | Threshold is a config record with a null-permitted value | Nullable column, no sentinel | 5.3 |
| S4.2 | Identity path holds a full attestation before first listing | Readiness function, no provisional state | 7.4 |
| S4.3 | ID verification always attests a natural person | Table keyed on `person_id`, no `seller_id` | 7.3 |
| S4.4 | Keyed ID hash once per person, referenced by each account | `person.id_hash` UNIQUE; `person` never deleted | 6.2 |
| S4.6 | Readiness computed server-side as one resolved state | Single function returning all items | 9.4 |
| S5.1 | Level never manual, never purchasable, never tier-affected | No UPDATE grant; function references no billing table | 8.1 |
| S5.1 | Level entered on eligibility (C5) | Trigger on eligibility evaluation, `ON CONFLICT DO NOTHING` | 8.1 |
| S5.2 | Scanned handoff counts only from a distinct buyer | `counts_toward_level` written by trigger | 8.2 |
| S5.2, S14 | Upheld claim always demotes | Unconditional trigger | 8.2, 16 |
| S6.2 | Seller bound to one phone number | `account.phone_e164` UNIQUE + FK | 6.1 |
| S6.4 | Revocation immediate, not at token refresh | Session row read per request | 6.6 |
| S6.4 | New-device sign-in notifies, not suppressible | Insert trigger enqueues with `suppressible = false` | 6.6 |
| S6.5 | Six actions require fresh step-up, incl. direct API calls | `step_up_challenge_id` as a function parameter | 6.7 |
| S6.6 | Payout locked for cooling period after recovery | `payout_locked_until` written in the approval transaction | 6.8 |
| S7 | Stock never mutated without a StockEvent | `stock_count` derived; guard trigger | 10.1 |
| S7 | Price is the variant's (C1) | `variant.price_minor`; `base_price` read only at variant creation | 9.2, 9.3 |
| S7.4 | Originals resized and discarded | No `original_key` column | 9.5 |
| S7.4 | No server-side transcoding in V1 | No rendition table | 9.5 |
| S7.5 | Storefront search scope is exactly one seller | Function signature takes `seller_id`; no cross-seller path | 9.6 |
| S7.5.1 | One post link, many products | Join table | 9.6 |
| S7.5.1 | A pasted link resolves only within the tagging seller | Conflict returns nothing + moderation flag | 9.6 |
| S7.6 | Lookup returns sellers, never products | Function return type is `core.seller` | 9.6 |
| S8.1 | Cart holds one seller, enforced on add | Composite FK, anonymous-safe via `device_id` (C6) | 11.2 |
| S8.2 | Cart has no effect on stock | No trigger writes `stock_event` | 11.2 |
| S8.3 | Whole cart revalidated in the order transaction | One function, one transaction | 12.3 |
| S8.4 | Price captured and immutable | Write-once trigger | 12.1 |
| S8.5 | Payout captured onto the order and immutable | `order_payout_snapshot`, write-once | 13.5 |
| S8.5 | Reissue logged, single-order, step-up | Append-only table, no bulk signature | 13.5 |
| S9.1 | Duplicate live reservations structurally impossible | `EXCLUDE USING gist` | 12.1 |
| S9.1 | Stock release on expiry idempotent | Partial unique index on `(order_id, reason)` | 12.4 |
| S9.1 | Two state machines, order terminal derived (C2) | Two legal tables + fail-closed guard triggers | 12.2 |
| S9.1 | The legal set cannot widen at runtime | Legal tables writable only by `adulis_migrate` | 12.2 |
| S9.1 | No market goes live on an unratified state machine | `fn_guard_market_live` on `market.is_live` | 12.2.1 |
| S14 | A claim's line belongs to the claim's order (C8) | Composite FK `claim_line_belongs_to_order` | 16 |
| S14 | One open claim per scope; stages append evidence (C8) | Partial unique index `claim_one_open_per_scope` | 16 |
| S9.2 | Clock stops permanently at `PAYMENT_CONFIRMED` | `CHECK` + absent transitions | 12.4 |
| S9.4 | Cancellation/refund/release at line level | Reservation-scoped tables and rate views | 12.5 |
| S10.3 | Every evidence access logged, any actor | Only read path is a logging function | 13.3 |
| S10.4 | Only Owner/Admin may view or change payout | `role_permission` + first-statement check | 13.4 |
| S10.4 | Masking scoped; one logged disclosure path (C3) | `financial` schema, own role, one function, shared access log | 13.6 |
| S10.4 | No unlogged decryption path can be added quietly | No `account_ciphertext` column exists in `core` at all | 13.6 |
| S10.3, S10.4 | One query answers who saw a bank account number | Both secrets share `financial.access_log` | 13.6 |
| S10.4 | Activation delay; previous details remain in effect | Partial unique index on one `ACTIVE` row | 13.4 |
| S10.4 | Payout change notifies, not suppressible | Trigger + `WHERE suppressible` in sender | 13.4 |
| S11.2 | Event A never completes, levels or enables review | Separate table; no trigger reaches those tables | 14.1 |
| S11.2 | A courier can never perform the buyer's scan | Composite FK to `(id, buyer_account_id)` | 14.2 |
| S11.3 | Only a scanned handoff counts toward level | Recompute reads `handoff_scan` only | 14.3 |
| S11.4 | Signed timestamp governs **completion**; replay always rejected | Validity trigger; `nonce` UNIQUE | 14.2 |
| S11.4 | Server `received_at` governs **level credit** (A5) | Trigger tests `received_at` against window + `level_credit_grace` | 14.2 |
| S8.3 | A retried write does not create a second order | `idempotency_record`, unique on `(key, actor, endpoint)` | 12.8 |
| S23 | Rate limiting on auth, OTP, reservation, claim | `rate_limit_bucket`; phone keyed by hash | 12.9 |
| S11.4 | Never re-decrement on late sync | Reconciliation event with `delta = 0` | 14.2 |
| S12 | A seller can never prevent a review publishing | No seller-writable column on `review` | 15 |
| S13.1 | No identity image ever uploaded | No column exists | 7.3 |
| S13.1 | KYC vendor behind a vendor-agnostic interface | `verifier_kind` + `vendor_reference` | 7.3 |
| S13.2 | Never publishes an accusation | `seller_public_stats` has no text column | 8.3 |
| S15.1 | The model never generates a response | `bot_turn` has no generated-text column | 17.1 |
| S15.1 | The bot never goes dark | Cap read only before layer 4 | 17.3 |
| S15.3 | Two stores, separated | `nlu` holds no FK to `chat` or `core` | 3, 17.2 |
| S16.2 | RBAC server-side on every endpoint | `fn_has_permission` as first statement | 6.9 |
| S16.5 | Entitlements resolved at read time | No boolean entitlement column anywhere | 18.3 |
| S16.5 | Effective limit is tier  intersect  level | Single intersection function | 18.3 |
| S16.10 | `BETA` is a distinct state | Enum value, not a $0 tier | 18.1 |
| S17.1.1 | One canonical follow state; no deferred follow (C4) | `UNIQUE (buyer, seller)`; no token table | 19 |
| S17.2 | Feed never introduces an unfollowed seller | No score, ranking or candidate table | 19 |
| S17.3 | Content selected by order state at send time | Template resolved at dispatch | 20 |
| S19 | New market by configuration, not code | Every dimension is a versioned config row | 5.3 |
| S20 | Every action emits a versioned event | `event_definition` append-only; validation trigger | 22 |
| S22 | Ledger append-only, Adulis balance zero | Deferred balance trigger + assertion view | 23 |
| S23.1 | Strings never assembled from fragments | `slots jsonb`, whole-sentence templates | 20 |

---

## 27. Indexing and performance

The binding constraint is **first paint of a web storefront on a low-end Android over a slow connection** (S23). That makes the storefront read path the only query set tuned in advance; everything else is tuned against measurement.

**Storefront path** -- one query, no N+1:
- `product (seller_id, visibility, display_order)` covering index
- `product_variant (product_id)` with `INCLUDE (stock_count, stock_confirmed_at, price_minor)`
- `seller_public_stats (seller_id)` -- a trigger-maintained table, so level and handoff count cost one primary-key lookup rather than an aggregate over `handoff_scan` (R16)

**Search** -- `pg_trgm` GIN on `product.name`, `seller.store_name`, `seller.handle`.
**Cascade layer 3** -- HNSW on `nlu.intent_phrase.embedding`, per locale.
**Hot writes** -- `stock_event (variant_id, occurred_at DESC)`; `analytics.event` partitioned monthly with a BRIN on `occurred_at`.
**Expiry sweep** -- partial index `ON core."order" (expires_at) WHERE clock_stopped_at IS NULL`.
**Session read** -- primary-key lookup per authenticated request (S6.6). Budgeted, not accidental.

**Target infrastructure cost is under USD 50/month at 1,000 sellers** (ADU-PROJ-01 S10). A single managed Postgres carries this comfortably; the trigger-maintained stats table exists so that the storefront read never becomes the reason it does not. ADU-CON-02-A1 models the whole system to ten thousand sellers at roughly 41% of the smallest database tier.

---

## 28. Migration order

**Fifteen migrations**, each independently reviewable. (v1.6 said "fourteen" and listed fifteen; corrected.) Ordering matters because the composite foreign keys in later migrations depend on the unique keys in earlier ones.

1. Extensions, roles, schemas, domains, **all enum types (Appendix A)**, shared trigger functions
2. Markets and all configuration tables
3. Accounts, persons, devices, **`account_device` (R17)**, OTP, sessions, step-up, recovery
4. `verification` schema and its functions
5. Sellers, social accounts, team, courier, eligibility, ladder-entry trigger, **`seller_availability`**, **`seller_availability_override` and `fn_seller_availability_state` (R27)**, **`seller_fulfilment_method` (R13)**, **`operator_grant` (F6)**, **`permission` and `role_permission` seeded from ADU-AUTH-01 S15/S16**
6. Categories, attributes, products, variants, media, social posts
7. Stock events and the derived-count triggers
8. Trust ladder, level events, anti-gaming, **public stats as a trigger-maintained table (R16)**
9. Cart, orders, reservations, **both legal tables seeded ratified at 17 + 6 rows (R8'), both guards, and `fn_guard_market_live`**, order functions, `ready_at` and `fn_mark_order_ready` (R12)
10. **`financial` schema** -- payment evidence, payout credential, shared access log; payment submissions, payout details, snapshots
11. Handoff, custody transfer, confirmation tiers
12. Reviews, claims, evidence export
13. `chat` and `nlu` schemas
14. `billing`, `ledger`, `analytics`, moderation, notifications, follows, jobs
15. **Transport tables** -- `idempotency_record`, `rate_limit_bucket`, and their purge jobs (S12.8, S12.9)

### 28.1 Deferred objects and dropped constraints -- register SD

Six objects whose S28 placement conflicts with their own dependencies. **Each was resolved during Tier 1 by dropping a constraint or deferring the object, and each is recorded here so the deferral is not lost.**

| # | Object | Wants | Placed | Resolution |
|---|---|---|---|---|
| D1 | `*_config.created_by_account_id` | `core.account` (m3) | m2 | **Bare `uuid`, no FK.** Configuration precedes accounts, and the alternative is moving every config table after identity |
| D2 | `core.seller.category_id` | `core.category` (m6) | m5 | **Bare `uuid`, no FK** |
| D3 | `core.fn_enter_ladder` | `seller_level_state` (m8) | m5 | Created; plpgsql resolves at runtime, so it is **dormant for three migrations** |
| D4 | `core.fn_has_permission` | `permission`, `role_permission` (05b) | 05a | Created in 05a; same runtime resolution |
| D5 | New-device notification trigger (S6.6) | `core.notification` (m14) | unassigned | **Deferred to migration 14** |
| D6 | `core.order_courier_assignment` | `core."order"` (m9) | grouped with m5 | **Deferred to migration 9**, with the courier RLS policy it belongs to |

[!] **D1 and D2 leave two columns without referential integrity, and that is a real cost, not a free win.** A `created_by_account_id` pointing at a deleted account will not raise. **Appendix C candidate for v1.11:** an orphan check on both columns, run against a populated database rather than a schema.

[!] **D5 is the one to watch.** It is a security-relevant notification -- new-device sign-in, unsuppressible under S6.6 -- and it is the only deferral here that is *unassigned* in S28 rather than merely early. **Migration 14 must not ship without it**, and nothing currently enforces that.

**`core.seller_availability` was created by migration 5 all along and v1.7's list did not name it.** Corrected above. A migration list that omits a table leaves the agent to guess an ordering, and guessing right is not the same as being told.

**Migrations 5, 7 and 9 are the three to review by hand.** Migration 5 now seeds the permission catalogue, and a wrong `surfaces` array there is a surface restriction that silently does not exist.

**Migrations 7 and 9 remain the concurrency-critical pair.** Migration 7's stock triggers are the concurrency-critical path ADU-PROJ-01 S13.5 flags. Migration 9's state machine is where a wrong transition silently turns a paid order into an expired one. Everywhere else, a mistake raises an exception; in those two, it produces wrong data.

---

## 29. Corrections required in other documents

The schema is unblocked. What remains is write-back: six corrections so that ADU-PRD-01 and ADU-00 stop saying things that cannot be built.

| # | Document | Correction | Why it matters |
|---|---|---|---|
| **W1** | ADU-PRD-01 S10.4 | Scope the masking invariant to seller, team, support and admin surfaces; state the single logged buyer-disclosure path (C3) | **Highest priority.** As written, an engineer building from the PRD alone builds a product that cannot take a payment |
| **W2** | ADU-PRD-01 S7, S8.4 | State that price is a variant attribute; `product.base_price` is a seed (C1) | Prevents a per-product pricing implementation that would need migrating through live orders |
| **W3** | ADU-PRD-01 S8.1, S9.1 | Replace the single lifecycle diagram with the two machines and their transitions (C2) | S9.1 as drawn cannot be implemented; S12.2 here is the replacement |
| **W4** | ADU-PRD-01 S24 | Strike the deferred-follow test line (C4) | A required test for a mechanism S17.1.1 removed |
| **W5** | ADU-00 trust ladder  -  ADU-PROJ-01 S3.3 | `New` is earned by eligibility satisfied, not by ID verified (C5) | As written, the entire Phase 1 cohort holds no level and the ladder accumulates nothing |
| **W6** | ADU-PRD-01 S10.1 | State the state a rejected payment returns the order to (`NOTIFIED`) | S12.2's rejection path is currently an inference this document had to make |
| **W7** | ADU-PRD-01 S14 | First claim trigger reads *"payment confirmed with no seller response within SLA."* The S10.2 SLA is the **confirmation** SLA, so this must mean payment **submitted** | Determines whether R-2's expiry auto-opens a claim. As written the trigger describes a state in which the SLA has already been met |
| **W8** | ADU-PRD-01 S9.1 | `EXPIRED_UNCLAIMED` is listed as terminal but S11.4 requires a late in-window scan to complete such an order | R-1. Two sections of the PRD currently contradict each other on whether the state is terminal |
| **W9** | ADU-PRD-01 S23 | Isolated boundaries are named as `verification` and `payment_evidence`. The second is renamed **`financial`** and now also holds the payout ciphertext | A boundary named in the PRD under a name the schema does not use is the drift S13.5 warns about |
| **W10** | ADU-PRD-01 S5.2 | Anti-gaming limits how often one buyer can advance one seller, and says nothing about *when* they may claim the handoff occurred | The clock residual belongs where the anti-gaming rules are, as a known limit |
| **W11** | ADU-PRD-01 S11.4 | An in-window late scan *"counts toward trust level, even if the server had already expired it."* Under S14.2 it always completes the order, and counts toward level only inside `level_credit_grace` | A5. The PRD currently makes a promise the ladder cannot safely keep |

**Two cross-document items, unchanged from v1.0 and still open:**

- **Hosting criteria.** ADU-PROJ-01 S10's hosting decision must include `pgvector` and `btree_gist` availability. Without the first the chatbot cascade has no layer 3; without the second S9.1's duplicate-reservation invariant has no implementation.
- **Stock confidence level 3.** S13.3's level-3 consequence assumes a chatbot the Free tier does not have. Not a contradiction, but the seller-facing copy should not promise it.

**Three PRD open items this schema does not block on**, recorded so they are not re-litigated during build: trust ladder thresholds, New-level caps, and fulfilment window length are `core.ladder_config` / `core.timing_config` values. They ship at defaults and are set by an `INSERT` when the beta produces the numbers.

---

## 30. Corrections -- where the build is right and v1.11 was wrong

**The T4 register found fifteen of these, and this is the more dangerous direction of error.** A document that describes something the code does not do invites the next reader to "fix" working code. Each row below is **ratified as built**; where a printed body or count differs, **the build governs and the print is superseded.**

| # | v1.11 printed | The build does, and it is right |
|---|---|---|
| D-15 | `order_clock_consistency` as printed forbids ratified row 17 | The corrected `CHECK` |
| D-29 | The courier RLS policy casts a GUC straight to `uuid` | `nullif(...,'')::uuid` -- the printed form raises `22P02` on an empty setting |
| D-22 | `fn_publication_readiness` is `STABLE sql` | `plpgsql VOLATILE`. **It must emit `seller_publication_blocked`**, and a `STABLE` function cannot write |
| D-14 | `fn_mark_order_ready`'s printed body contradicts its own idempotency claim | Idempotent by state -- `ready_at IS NULL` in the predicate |
| D-21 | S9.4 says ten readiness items | **Nine**, per the wire contract. R7(c) removed `ACTIVE_HOURS` and this section was not updated with it |
| D-41 | S20's notification table has no read column | `read_at` exists -- API S12.14 requires read state to sync across surfaces |
| D-47 | S3's grant table gives `adulis_jobs` no way to reach `core` | `USAGE` on the schema plus narrow table grants. **Without them all twenty jobs were dead on arrival** |
| D-11 | S14.2 calls a cross-table rule a `CHECK` | A trigger, because a `CHECK` cannot see another table |
| D-19 | An upheld claim demotes via `MODERATION` with no printed `moderation_event` write | The decision trigger writes one -- the `CHECK` requiring it would otherwise fail |
| D-08, D-12, D-17 | Three tables and mappings described without columns | Built and commented; **printed here at last** in S5.4 and S5.5's pattern |
| D-06 | `waitlist.application` is in the manifest and no migration owns it in S28 | Built in migration 0017. S28's list corrected |
| D-10 | S20 counts 65 event names, S22 says 68 | **72 seeded.** Now derived by query, not asserted -- see Appendix A's rule |
| D-18, D-40 | Appendix B omits two tables the bodies require | Both exist. Appendix B reconciled; check 14 bidirectional |
| D-50, SR-1 | Nothing states the definer discipline | **S4.4a states it; check 10 enforces the class** |
| D-55 | S24's confirmation-window row cancels and releases stock | **Two branches** -- S12.4a for the 24h case, ordinary expiry for the 12h |

**The pattern is one thing.** Every entry is a place where somebody built from a document, found it did not work or did not match, and **wrote down what was true instead of quietly diverging.** That is the only reason this table can exist -- a build that silently worked around fifteen defects would have produced a schema nobody could reason about from the documents, and nobody would know.

---

## 30b. The delivery layer, and four rulings the transcription produced

**Migration 0043, transcribed from ADU-AUTH-01 v2.6 S5.6, S6, S9.1, S9.2, S10.1, S10.2, S12.1, S12.2, S12.3 and S30.**

### 30b.1 `core.otp_delivery_attempt`

**One challenge, many attempts.** `UNIQUE (otp_challenge_id, attempt_no)`, `provider`, `provider_message_id`, `status`, `failure_class`, and the three timestamps. **No OTP plaintext, ever.**

> **The single-column shape would have been wrong, and it is the obvious one.** Adding `delivery_provider` and one `provider_message_id` to `core.otp_challenge` reads as the small change -- **and failover produces a second transport attempt against the same live code**, which one column cannot hold. AUTH v2.6 S12.1 forbids it by name.

**Transport state never decides security state.** `DELIVERED` does not mean authenticated; `FAILED_FINAL` does not invalidate a code the user already holds. **Validity lives in `core.otp_challenge` and nowhere else.**

### 30b.2 `core.platform_otp_budget` -- the first platform-scoped configuration

Every other configuration row in this schema is **per market** -- `timing_config`, `ladder_config`, `eligibility_config`, `legal_config`, `identity_config`. **A global daily OTP ceiling is not a fact about a market**, and putting it on one market's row would mean picking a market to hold a number that governs all of them.

**So it is a new shape rather than a new column**, and it is worth naming as one: the second platform-scoped table this schema will ever want is now cheap.

### 30b.3 D-183 -- `is_live` is withdrawn

**`is_live` and `activation_state` are two truths about one market, and `is_live` is the one that decides which market a new account joins.** That is D-104's territory, and AUTH v2.6 never mentions it -- an omission rather than a decision.

> **RULING -- every market resolution reads `activation_state = 'ACTIVE'`. `is_live` is withdrawn.**
>
> **`SUSPENDED` then means what suspension should mean: no new entry, existing trade continues.** No new OTP issued, no new device assigned to that market, and **every account already there is unaffected.** That is a genuinely useful state, and a boolean cannot express it.

**Done in migration 0046.** Both readers moved -- `/v1/bootstrap` and `orders.service.ts` (D-116) -- the structural test extends to cover them, and ~35 fixtures were swept. **Two writers sat outside the `*.spec.ts` glob and the first sweep missed them**, which is worth remembering the next time a sweep is scoped by a file pattern: **a glob is a guess about where a thing lives.**

> **RULING D-216.4 -- bootstrap SERVES a returning device from a `SUSPENDED` market. It does not 503.**
>
> `SUSPENDED` means *no new entry, existing trade continues*, and **a device already assigned to that market is not new entry.** Refusing it would be the boolean behaviour `is_live` was withdrawn to escape, arriving through the state that replaced it. **Only the assignment of a NEW device is refused.**

### 30b.4 D-184 -- the installed event names win

**AUTH v2.6 S30 names nineteen events absent from the catalogue**, not the four S30.1 calls out. All nineteen are seeded. **Two collide with installed names:**

| Installed, canonical | v2.6's name, seeded and never emitted |
|---|---|
| `otp_delivery_confirmed` | `otp_delivered` |
| `step_up_challenged` | `step_up_requested` |

> **RULING -- the installed names are canonical. The new pair is seeded because `event_definition` is append-only, and nothing emits them, ever.**
>
> **Two live names for one event splits every query that counts it** -- and continuity beats coherence, because the installed names already carry data and a rename splits a historical series for a naming preference.

**`otp_delivery_confirmed` is also the more honest of its pair.** S13 says a callback reports **transport status**; *confirmed* names the source, where *delivered* asserts a fact nobody observed.

**A test asserts nothing emits the superseded pair.** Without it, a future contributor reads S30, finds the definition seeded, and starts writing to it -- **and the split arrives quietly, which is the only way it could arrive.**

### 30b.5 D-181, D-182 -- `failure_class` and `sms_compliance_status` stay TEXT

**Both are named by v2.6 and never enumerated.** Inventing values before a real provider's error taxonomy exists is **designing rather than transcribing**, and check 16 would freeze the invention.

**TEXT now; enums when real values exist, through a document amendment.** Recorded as a decision so the next reader does not read it as an omission.

**And S7.1's provider lifecycle gets no table.** `Fallback = NONE` is `sms_fallback_provider IS NULL`, and **a state machine with one live transition is a table waiting to disagree with the column beside it.**

### 30b.6 D-180 -- the column landed and the service half is owed

**Audience is chosen at VERIFY, not bound at creation.** There was no `audience` column and `auth.schemas.ts` takes `audience` in the verify body, **so a MOBILE challenge can mint a CONSOLE session and v2.6 S5.2's two invariants are unenforced.**

[!] **Be precise about the severity, because it is not what it first looks like.** An attacker holding the victim's code can sign in as them on any surface -- **the binding does not prevent takeover. It prevents surface conversion**: a code obtained under a mobile pretext minting a console session. The SMS body names no surface, so **the person entering the code cannot tell which one they are authorising.** S11's step-up template names its action for exactly this reason; the sign-in template names nothing.

> **The reason to close it before anything is built on it: an invariant that is stated and unenforced is worse than one that is absent**, because the next thing built assumes it holds. T8's skeptic pass already found a guard scoped by `body.audience` and called it voluntary. **That was this, one layer up.**

**Persist at request, ignore at verify, reject the field.** AUTH v2.6 S31.1's three tests are the acceptance criteria.

---

### 30b.7 The challenge is stamped, not resolved

**Migrations 0044 and 0045.** D-180, D-193 and D-203 were found separately by three lenses and are one defect:

> **A value the challenge should have carried was re-resolved later, from a source that could differ.** Audience from the request body at verify. Market from the account rather than the device. The attempt budget from a market lookup rather than from the challenge.

> **INVARIANT -- every parameter a challenge is governed by is STAMPED on it at creation. Verification reads the challenge and re-resolves nothing.**

**`core.otp_challenge.market_id`** is stamped from the **device's** market. Verification takes the TTL, the attempt budget and the audience from the row, never from a fresh lookup, and **`POST /v1/auth/otp/verify` rejects an `audience` field rather than ignoring it** -- a field silently discarded is a field a client keeps sending.

**D-203 leaked through a quantity rather than a response.** S17 forbids a *response* that reveals account existence; **the number of responses is not a response.** With `otp_max_attempts` per market and resolved from the **account's** market, counting refusals before the 429 told an attacker whether a phone was registered -- **and no misconfiguration was required, only a second market.**

**D-180 never prevented takeover.** Someone holding the code signs in either way. **It prevents surface conversion** -- a code obtained under a mobile pretext minting a console session -- and the sign-in SMS names no surface, **so the person entering the code cannot tell which one they are authorising.**

> **RULING D-208 -- `audience` joins S5.3's one-live-challenge tuple.** The rule always read `(phone, purpose, audience)` and the column did not exist, **so the rule was never wrong -- only unimplementable.** Stamping makes it expressible.

### 30b.8 Transport before supersession, and the race it created

> **A challenge that has not been transported is not live and cannot be verified against. Supersession happens at transport acceptance.**

**There is exactly one verifiable challenge at every instant**, which is what S5.3 protects. **Superseding at mint left a failed resend with two dead codes** -- the old destroyed, the new undelivered, and a late-arriving first SMS now worthless. **A code the user cannot have received is not a code they hold**, and S5.3's purpose is that only one code *works*, not that only one row exists.

[!] **The ruling created a race and the adversarial pass found it.** The window in which two challenges exist and one is live is a window **two concurrent transports can both close** -- retiring both of a user's codes and leaving them with none. **Lock-serialised, newest-wins, with a concurrency test.**

**Worth recording as a shape rather than an incident: a rule that introduces a window introduces a race in that window.** The fix was correct and incomplete, and the completion was found by the pass rather than by the ruling.

---

## 31. Corrections -- where the build is right and this document was wrong

**Thirty-one, across three work orders.** Each is ratified as built; where a printed body, count or constraint differs, **the build governs and the print is superseded.**

| # | This document printed | The build does, and it is right |
|---|---|---|
| D-06 | `waitlist.application` in the manifest, in no migration | Built in migration 15 |
| D-08 | `billing.tier_definition` described, never given columns | Versioned rows, nullable `tier` XOR `subscription_state`, eight typed capabilities |
| D-10 | S20 counts 65 event names, S22 says 68 | The union of two authoritative lists, seeded and counted by query |
| D-11 | S14.2 calls a cross-table rule a `CHECK` | The `BEFORE INSERT` validity trigger -- a `CHECK` cannot see another table |
| D-12 | `seller_public_stats` carries rates and no counters | Each rate carries its two counters; **stock confidence is not stored** -- it would drift |
| D-13 | Rate thresholds, no rate definitions | Three helper functions, one denominator each, NULL failing closed |
| D-14 | `fn_mark_order_ready` uses `INTO STRICT` | Idempotent by state, as its own invariant claims |
| D-15 | `order_clock_consistency` forbids ratified row 17 | A `CASE`: the two CANCELLED terminals admit either clock, because both entry paths are ratified |
| D-16 | A read-only financial boundary | `write_payment_evidence` as the narrow definer commit path; cross-currency with no fx source **refuses** |
| D-17 | A claim-evidence catalogue, no per-trigger mapping | Attach every kind whose referent exists -- **over-inclusion is reviewable, omission is not** |
| D-18, D-40, D-59, D-68, D-70 | Appendix B omits five tables the bodies require | All five exist; Appendix B is now generated |
| D-19 | An upheld claim demotes with no printed `moderation_event` write | The decision trigger writes one -- claim to moderation_event to level_event, one audit chain |
| D-21 | S9.4 says ten readiness items | **Nine.** R7(c) removed `ACTIVE_HOURS` and this section was not updated with it |
| D-22 | `fn_publication_readiness` is `STABLE sql` | `plpgsql VOLATILE` -- **a STABLE function cannot emit the event its own invariant demands** |
| D-29 | The courier policy casts a GUC straight to `uuid` | `nullif(...,'')::uuid` -- **a custom GUC's post-transaction default is the empty string** |
| D-41 | S20's notification table has no read column | `read_at` with a partial unread index |
| D-47 | S3 gives `adulis_jobs` no path to `core` | `USAGE` plus narrow table grants -- S3.1a |
| D-49 | -- | Every table owned by its schema's owner, not by whoever ran the migration |
| D-50, SR-1 | Nothing states the definer discipline | S4.4a, four clauses, check 10 enforcing the class |
| D-55 | S24's confirmation-window row releases stock | Two branches -- S12.4a at 24h, ordinary expiry at 12h |
| D-58 | Appendix A omits `OPERATOR_ATTESTED` | Generated |
| D-61 | Deferred thresholds are `NOT NULL` | Nullable, consumers fail closed -- S5.5a |
| D-63 | -- | **A new database-enforced refusal needs a translator entry in the same change**, or enforcement that works reads as enforcement that is broken |
| D-64 | `fn_delete_account` un-binds a device and leaves its sessions | Sessions revoked and `account_device` removed in the scrub's transaction |
| D-66, D-73 | The chat anchor is on the conversation | On the message -- S17.1 |
| D-67 | `seller_courier_invite` has a total `UNIQUE` | Partial on `revoked_at IS NULL AND claimed_at IS NULL`, plus two account FKs |
| D-72 | `rate_limit_subject_kind` has no `SELLER` | Recorded as `ACCOUNT` under a distinct `bucket_key` -- **the only wrongness is the label**, and adding an enum value is a document amendment |
| D-79 | -- | `/healthz` carries `@Public()`. **It answered 401 in the assembled application, and both its tests built a standalone module where no global guard exists** |
| D-83 | -- | **Exactly one suite may own a global sweep, and no test asserts a global count** |
| D-90 | Three documents, three wrong counts of the still-`NOT NULL` deferred columns | Ten, enumerated from `information_schema` |
| D-105 | -- | `NODE_ENV` asserted at boot, never consulted at a call site. **Nothing in this repository set it, so every guard on it was a no-op** |

**What the table is really a record of.** Every row is a place where somebody built from this document, found it wrong, and **wrote down what was true instead of quietly diverging.** A build that silently worked around thirty-one defects would have produced a schema nobody could reason about from the documents, and nobody would know.

---

## 30a. Two tables the build needed and no document printed

**Both are D-40's mechanism repeating: a capability given endpoints by ADU-API-01 and a table by nothing.** Each is pinned by name in check 14's body-over-manifest list until this revision, and each is in Appendix B now.

### 30a.1 `billing.purchase_intent` -- D-68

G1.7 rules that **an intent expires after 24 hours** and **the rate is locked at intent creation**. S18.5 stopped at `billing.collection_record` and printed no intent.

> **The collection record is not the intent, and treating it as one would have been the obvious move.** It is the **reconciliation artifact** -- the row an operator matches a bank line against -- and **expiring it would void, under an operator's hands, the record they were mid-way through matching.** The two objects have opposite lifetimes.

One row per open purchase - `collection_record_id UNIQUE` - `tier`, `term`, `price_schedule_version_id`, `amount_minor`, `currency` carrying the locked quote - `created_at`, `expires_at`, `reconciled_at`, `cancelled_at`.

**State is timestamps, not an enum.** A row is live when `reconciled_at IS NULL AND cancelled_at IS NULL AND expires_at > now()`. **Expiry is then a fact about the row rather than an event somebody has to remember to fire** -- and check 16 freezes the enum catalogue, so a state enum would be a document amendment rather than a migration.

### 30a.2 `core.seller_ownership_transfer` and five functions -- D-70

This document named `fn_transfer_seller_ownership` in three places and printed **no arguments, no return type and no body anywhere**. G1.6 supplied the policy and no schema, and **a 24-hour delay needs a pending record**.

**`fn_request_ownership_transfer` - `fn_cancel_ownership_transfer` - `fn_activate_due_ownership_transfer` - `fn_ownership_transfer_blockers` - `fn_notify_ownership_transfer`.** Five, because **the act has four moments and one function cannot hold them.** State is timestamps, for the same reason as above.

**The recipient is named by `seller_team_member.id`, not by account id.** G1.6 requires the recipient already be known to the store, and **a membership id is the only identifier that cannot name a stranger.** It is also what the console holds.

[!] **The delay is a literal `interval '24 hours'`, not `timing_config.payout_activation_delay`** (D-71). The two are equal today and are not the same decision: reading the payout column would couple a flat rule to a per-market configurable, so **a market that shortened its payout delay would silently shorten the window in which a compromised Owner session can be caught handing the store away.** Whether the transfer delay is per-market is unruled.

[!] **`fn_activate_due_ownership_transfer` must never raise for an ordinary outcome** (D-74). It runs at the top of every seller-scoped transaction, so the outgoing owner's own next request activates the transfer and is then judged by what the activation did -- `fn_has_permission` finds no relationship, the endpoint 404s correctly, **and the raise rolls the activation back with it.** The observable behaviour was exactly right and the store never moved. It now attempts the activation inside the handler's transaction while that succeeds, and once more in a transaction of its own when it did not.

---

## Appendix A -- Enum catalogue

> **GENERATED from `db/checks/fixtures/appendix-a.json`** -- the form check 16 executes -- **never written by hand.** Three revisions running, a hand-maintained appendix announced a correction it did not perform; this one cannot, because it is rendered from the thing the check already reads.
>
> **There is no asserted count. The check is the count.** `verify:appendix` compares this section against the fixture in both directions, so the document, the fixture and the database agree by construction.

**`core`** -- `market_phase` - `platform` - `account_status` - **`device_platform` (`ANDROID`, `IOS`, `WEB`)** - `notification_permission` - `otp_purpose` - `session_audience` (`MOBILE`, `CONSOLE`) - `fulfilment_method` - `operator_role` - `step_up_action` (eight values, one per step-up permission) - `recovery_decision` - `team_role` - `seller_entity_type` - `seller_status` - `social_verification_status` - `follower_count_source` - `eligibility_path` - `eligibility_outcome` - `id_verification_requirement` - `threshold_basis` - `trust_level` - `level_change_source` - `attribute_data_type` - `idempotency_actor_kind` - `rate_limit_subject_kind` - `product_visibility` - `unpublished_reason` - `media_class` - `social_post_status` - `stock_event_reason` - `cart_status` - `order_state` - `reservation_state` - `cancelled_by` - `payment_submission_state` - `payout_state` - `scan_validity` - `confirmation_tier` - `review_badge` - `claim_opener_kind` - `claim_trigger` - `claim_outcome` - `claim_evidence_kind` - `follow_state` - `seller_activity_kind` - `broadcast_kind` - `notification_channel` - `actor_channel` - `claim_state` - `claim_severity` - `claim_remedy` - `notification_state` - `report_target_kind` - `moderation_queue_kind` - `active_orders_decision` - **`market_activation_state`** - **`otp_delivery_status`** - **`sender_registration_status`** - **`sms_provider`** - **`sms_sender_mode`**

**Other schemas** -- `verification.verifier_kind` (`KYC_VENDOR`, `VIDEO_CALL`, **`OPERATOR_ATTESTED`**) - `financial.retention_reason` - `financial.secret_subject_kind` - `chat.message_sender_kind` - `chat.resolution_path` - `nlu.phrase_source` - `billing.subscription_state` - `billing.subscription_tier` - `billing.subscription_term` - `ledger.entry_direction` - `waitlist.platform`

**The fixture carries every value; this list carries every type.** For values, read the fixture -- it is what check 16 executes, and a second transcription here would be the fifth copy of a fact.

**Five types are new in migration 0043** and each carries its reasoning in the migration header.

**`otp_delivery_status` is an enum, and that breaks the T6 timestamp pattern deliberately.** `purchase_intent` and `seller_ownership_transfer` carry state as timestamps **to avoid a document amendment when none was planned**; one is planned here. And its six values are not stages -- **`DEFINITIVE_NOT_SENT` and `DELIVERY_UNKNOWN` are terminal classifications a timestamp cannot express.** A row does not pass through them on the way somewhere else.

**`device_platform` gained `WEB` in migration 0040** (D-108). **Declaring a browser `ANDROID` to satisfy a `NOT NULL` would have put a false statement in a column the new-device payout lock's neighbourhood reads** -- the same reasoning that gave `verifier_kind` its `OPERATOR_ATTESTED` value rather than reusing `KYC_VENDOR`. **An audit-adjacent column that says something other than what happened is worse than one that says less.**

**`chat.resolution_path` mirrors S15.1's six cascade layers exactly**, so containment is a `GROUP BY` rather than a derivation.

[!] **The fixture's own `_provenance` string has twice disagreed with its contents** (D-58, and again at T8). It is prose inside a machine-read file, which is the same defect one level down. **`verify:appendix` should read `.types` and ignore `_provenance`, or the provenance should be generated too.**

---

## Appendix B -- Table manifest

> **GENERATED from `pg_class` across the nine schemas holding tables, partitions excluded.** **Every per-schema count is derived from its own list**, never stated beside it -- v1.12's core heading read 84 above a list of 85, which is the failure this generation removes.

**116 tables.** Two are new in migration 0043 -- **`core.otp_delivery_attempt`** and **`core.platform_otp_budget`** (S30b). Five are check 14's body-over-manifest rows, folded in and flagged: **`core.category_market_availability`** [D-18] - **`core.notification_preference`** [D-40] - **`core.seller_courier_invite`** [D-59] - **`billing.purchase_intent`** [D-68] - **`core.seller_ownership_transfer`** [D-70].

| Schema | Tables |
|---|---|
| `core` | **90** |
| `verification` | 2 |
| `financial` | 3 |
| `chat` | 3 |
| `nlu` | 6 |
| `billing` | 7 |
| `ledger` | 2 |
| `analytics` | 2 |
| `waitlist` | 1 |

**22 append-only tables**, each carrying both the trigger and the `REVOKE` (S4); check 5 asserts the count and both mechanisms.

**The full per-table list lives in `db/checks/fixtures/` and is compared against this section by `verify:appendix`.** Reproducing 116 names here would be a fourth copy of a fact that has already drifted three times -- **the count and the exceptions are what a reader needs; the enumeration is what a check needs.**

[!] **Migration 1 creates TEN schemas.** The tenth is `jobs`, which holds graphile-worker's own objects and none of ours -- which is why check 14 scopes its `IN (...)` to nine and why counting `CREATE SCHEMA` statements gives a different number.

---

## Appendix C -- Migration review checklist

**Sixteen checks** a reviewer can run against generated DDL without reading it line by line. Each corresponds to an invariant that is enforced by an **absence** -- the failure mode where an agent "completes" the schema and silently removes a guarantee. Run these before reviewing anything else.

| # | Check | Expected | Guards |
|---|---|---|---|
| 1 | `grep -ci "original_key\|image_url\|photo_url" migrations/` | **0** | No identity or product original is ever stored (S7.3, S9.5) |
| 2 | `grep -i "generated_text\|response_text" chat migration` | **0 in `bot_turn`** | The model never generates a response (S17.1) |
| 3 | `grep -iE "has_chatbot\|can_broadcast\|is_pro\|blue_tick +bool"` | **0** | Entitlements resolved at read time, never stored (S18.3) |
| 4 | `grep -E "REFERENCES (core\|chat)\." nlu migration` | **0** | The two stores stay separated (S17.2) |
| 5 | Count `trg_append_only` triggers; count `REVOKE UPDATE, DELETE` | **22 each**, same tables | Append-only means the grant says so (S4, Appendix B) |
| 6 | `grep -iE "score\|rank\|weight\|affinity" feed and follow migration` | **0** | The feed is a query, not a recommender (S19) |
| 7 | `grep "EXCLUDE USING gist" migrations/` | **>= 8** -- one per config table, one on `reservation`. Availability is no longer versioned | Duplicate reservations impossible; configs never overlap (S4, S12.1) |
| 8 | `grep "fn_guard_stock_count\|fn_apply_stock_event"` | **Both present, both attached** | Stock never moves without an event (S10.1) |
| 9 | Composite FKs present, by name | `cart_line_variant_seller`, `cart_line_single_seller`, `handoff_scanned_by_buyer`, `review_by_order_buyer` | Cross-seller and cross-buyer errors are structurally impossible |
| 10 | **Privilege query, not a grep**, and since v1.12 it also asserts the definer class of S4.4a: **no `SECURITY DEFINER` function is `PUBLIC`-executable, and none is owned by a superuser** (SR-1, D-50).  -- `adulis_app` holds **no table-level privilege** in `verification` or `financial`: `SELECT count(*) FROM information_schema.table_privileges WHERE grantee='adulis_app' AND table_schema IN ('verification','financial')` | **0** | Two isolated boundaries reachable only through the **five** logging functions -- `read_attestation`, `write_attestation`, `id_hash_matches`, `read_payment_evidence`, `render_payment_instructions` (S7.3, S13.6). v1.9 said four |
| 11 | `grep -c "account_ciphertext" core migrations` | **0** | The column exists only in `financial` (S13.6) |
| 12 | `grep -E "(INSERT\|UPDATE\|DELETE).*_state_transition_legal.*adulis_app"` | **0** | The state machine cannot widen at runtime (S12.2) |
| 13 | `grep "fn_guard_market_live"` | **Present and attached to `core.market`** | No live market on an unratified machine (S12.2.1) |
| 14 | `SELECT count(*) FROM information_schema.tables WHERE table_schema IN (...)` | **symmetric difference empty, both ways** | Manifest agreement (Appendix B) -- bidirectional since v1.12, like check 16 |
| **15** | `grep -ci "MATERIALIZED VIEW" db/migrations/` -- **`db/migrations/` only, never `db/`**, or it matches the check file whose job is to forbid it | **0** | `seller_public_stats` is a trigger-maintained table; a materialized view here is O(entire history) per refresh -- R16, S8.3 |

| **16** | Appendix A <-> `pg_type`: symmetric difference between this document's enum list and `SELECT typname FROM pg_type WHERE typtype='e'` | **empty both ways** | The catalogue cannot drift from the schema -- D6 |

> **D7 -- check 10 was unsatisfiable as written, and this is the correction.** The grep forbade *any* `GRANT ... ON SCHEMA verification ... adulis_app` -- **including the `USAGE` grant without which the `SECURITY DEFINER` function is uncallable.** Taken literally, identity verification could not work at all, and the agent proved it empirically rather than arguing about it.
>
> **The invariant that actually matters:** `adulis_app` holds `USAGE` on both schemas and `EXECUTE` on the four named functions, **and no privilege on any table within them.** The escorted-visitor design (S7.3) requires the schema to be enterable; what it forbids is reading the furniture.

> **A standing rule that makes all of these mean something: `adulis_app` is never a superuser, in any environment.** Under superuser every boundary check passes while proving nothing -- check 10 returns zero rows because privileges are irrelevant, not because they are correct, and the entire test suite certifies an unenforced boundary. The local `docker compose` role must be created with the same grants as production.

**Check 14 is the cheapest and catches the most.** A count that is high means something was invented; a count that is low means something was skipped. Either way it is one query, and it runs before anyone reads a migration.

**One check that is not a `grep`, and belongs to the reviewer rather than the agent:**

```sql
SELECT from_state, to_state FROM core.order_state_transition_legal WHERE ratified_at IS NULL
UNION ALL
SELECT from_state::text, to_state::text FROM core.reservation_state_transition_legal WHERE ratified_at IS NULL;
```

**Zero rows, from migration 9 onward.** S12.2.1 is ratified in v1.7, so this query is now a regression check rather than an outstanding item: any row it returns is a transition someone added without ratifying it, and `fn_guard_market_live` will refuse to set a market live until it is resolved.

**A second reviewer query, for the seeded permission catalogue (migration 5):**

```sql
-- 1. Exactly eight permissions require step-up.
SELECT count(*) FROM core.permission WHERE requires_step_up;              -- 8

-- 2. They are the eight of ADU-AUTH-01 v2.2 S16.3, and no others.
SELECT code FROM core.permission WHERE requires_step_up
EXCEPT SELECT unnest(ARRAY[
  'seller.payout:update','seller.orders:reissue_instructions','seller.staff:admin',
  'seller.subscription:update','seller.account:delete','seller.sessions:revoke_all',
  'seller.identity:manage','seller.ownership:transfer']);                 -- 0 rows

-- 3. And the reverse: none of the eight is missing from the seed.
SELECT unnest(ARRAY[ /* the same eight */ ])
EXCEPT SELECT code FROM core.permission WHERE requires_step_up;           -- 0 rows

-- 4. Seed size.
SELECT count(*) FROM core.permission;        -- 42
SELECT count(*) FROM core.role_permission;   -- 139
```

**D2 -- v1.8's version of this query did not compile.** It selected `key` where the column is `code`, and filtered on `requires_step_up`, which the table **did not have** until v1.9 added it. The query written to catch D1 could never have been run, which is why D1 survived two revisions.

**Query 3 is the one v1.8 lacked in principle as well as in syntax.** A one-directional `EXCEPT` catches a permission that should not require step-up; it says nothing about one that should and does not -- and **that is the direction D1 failed in.** Both directions, or the check is half a check.

---

*Binding data model, v1.16 -- one line removed. S0 stated a table count through three revisions while the appendices said something else, inside the revision written to stop exactly that, and the reason it survived is that the gate parses the appendices and nothing reads the body. Removing the number rather than correcting it is the point: a number with no checker and no reader schedules its own next finding. From v1.15: migrations 0044 to 0046, and one sentence that was right about itself. Three defects found by three lenses turned out to be one: a value the challenge should have carried was re-resolved later from a source that could differ, and one stamped column closes all of them. The transport-before-supersession ruling was correct and incomplete -- it opened a window, and a window is a race, which the adversarial pass found and the ruling did not. `is_live` is gone and `SUSPENDED` now means what suspension should mean. And the transcription gate, built to abolish witnessing-yourself, was checking one side against a literal in its own source: a gate that reads one side from a constant has one witness whatever its header claims. From v1.14: the schema ADU-AUTH-01 v2.6 needs, and four rulings that transcribing it produced. The delivery layer is two tables and five enums, and the shape worth noticing is that transport state is separate from security state: one challenge, many attempts, and DELIVERED never means authenticated. Three of the four rulings came from the transcription refusing to guess -- `failure_class` left TEXT because inventing a provider's error taxonomy is designing, two colliding event names seeded rather than reconciled because picking a winner is a ruling, and no table for a state machine with one live transition. The fourth is `is_live`, withdrawn: it and `activation_state` were two truths about one market and the boolean was the one deciding where a person's account lives. And D-180 is recorded rather than fixed here, because an invariant that is stated and unenforced is worse than one that is absent, and the next thing built on it assumes it holds. From v1.13: the revision that stops writing its own appendices. Three times running this document announced an appendix correction and did not perform it, and every one stayed green because nothing checked them; Appendix A and Appendix B are now generated from the fixtures the checks already read, and a gate compares them. The definer discipline gains a fourth clause the billing trap proved was not implied by the other three: an owner with no privileges lends none. Deferral becomes a stated principle rather than a per-column decision, because for four work orders a NOT NULL column held a value nobody had decided -- which is an invention with a deadline, and the ladder was safe only because the table was empty. S31 lists thirty-one corrections where the build was right and this document was wrong, which is the more dangerous direction and the only one a green build cannot catch. From v1.12: founder rulings, and fifteen corrections in the direction that matters. The rulings: identity verification becomes operator-only with an enum value that says so, the NEW level gets a real exit at sixty days or fifty orders, courier invites stop being a registration oracle, and a product finally gets the slug doctrine 5 always required. The corrections are all one shape -- someone built from this document, found it wrong, and wrote down what was true. **Two of them, SR-1 and D-50, were boundaries that were open for four work orders while every test passed**, which is why S4.4a now states the definer discipline the whole design assumed and no document had ever written. From v1.11: It absorbs amendment A3 and closes two defects that A3 either introduced or failed to catch: a standing gate whose lookup depended on a uniqueness guarantee that does not hold under its own predicate, and an Appendix A block this document announced as withdrawn and left in place. Both were found by machinery rather than by reading -- check 16 against `pg_type`, and someone building the function and reading the index beneath it. **An assertion in prose that nothing executes will drift**, which this document has now said three times and demonstrated three times. From v1.10: It absorbs amendments A1 and A2, names the columns of five tables the document had only described, and records six deferrals so they cannot be lost. The register that produced it was written by an agent instructed to transcribe and not design, and the value of that instruction is visible in every SC item: each is a table described in prose that nobody could build, found by someone trying to build it. **Values are deferred to ADU-VAL-01 rather than guessed** -- an unnamed column blocks a migration, an unseeded row blocks only the market seed, and knowing which is which is most of what this revision does. From v1.9: Eight faults blocked Tier 1 and all eight were in this document: a step-up constraint that named six codes where there are eight and left three unconstrained; the reviewer query written to catch that, which did not compile; an unseeded role_permission; a function named as defined and never written; a timezone lookup on a column that does not exist; an enum appendix covering one schema of nine; a privilege check that forbade the grant its own design requires; and three tables with no columns. The pattern underneath most of them is one thing: **an assertion in prose that nothing executes will drift, and no amount of care prevents it.** v1.9's answer is not better lists but fewer -- a total constraint instead of an enumeration, and a check that compares the catalogue against `pg_type` instead of a number in a heading. It discharges ADU-AUTH-01 v2.0's F3, ADU-CON-01's R2, R5, R8', R9 and F6, and ADU-CON-02 v3.0's R12, R13, R15, R16, R17, R18 and R19. **The transition set is ratified**: 17 order rows and 6 reservation rows, with R-2 corrected -- a submitted payment never expires, and S12.4a says what happens instead. **109 tables**, **66 enum types across 232 values**, 22 append-only, **sixteen** Appendix C checks. Three things in this document are load-bearing absences rather than features: there is no `PAYMENT_SUBMITTED -> EXPIRED_UNCLAIMED` row, there is no materialized view, and `seller_availability_override` has no `is_closed` column. The API contract, ADU-API-01, is drawn from this document: every endpoint maps to one of the named functions above, and no endpoint writes a table directly where a function exists.*
