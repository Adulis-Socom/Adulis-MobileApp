# Tier status and reissue debt — back-end

> **UPDATED 27 August 2026, third Tier 1 session. TIER 1 IS COMPLETE.**
>
> Migrations 01-05 are built, applied, tested and deterministic. The permission
> catalogue and the 139-grant role matrix are seeded and verified. **Gate C is
> met**: Appendix C runs sixteen checks at **7 PASS / 9 PENDING / 0 FAIL**, the
> four checksums hold, and the 252-cell matrix reproduces through
> `core.fn_has_permission` in both directions - 139 grants pass, 113 non-grants
> raise, zero disagreements. 117 tests, 6 suites.
>
> **Governing versions:** ADU-DB-01 **v1.9 as amended by A1** · ADU-AUTH-01
> **v2.3** · ADU-API-01 v1.5 · ADU-CON-03 v1.1. Amendment A1 settled all four
> blockers the previous session reported, and ADU-AUTH-01 v2.3 delivered the
> matrix in ASCII plus generated SQL, which survived transit where v2.2's glyphs
> did not.
>
> ⚠ **Read [`docs/amendments/README.md`](../amendments/README.md) before
> `docs/`.** ADU-AUTH-01 §16 and the seed are installed there at v2.3; §1-14 and
> §17-25 are the v2.1 text in `docs/`, which v2.3 states is unaltered. ADU-DB-01
> v1.9 is not installed - its substance is carried by amendment A1, by
> `db/checks/fixtures/appendix-a.json` (which check 16 asserts against `pg_type`
> every CI run), and by the section citations in each migration header. **Drop
> the UTF-8 originals of ADU-DB-01 v1.9 and ADU-AUTH-01 v2.3 into `docs/` to
> finish the job**; the README says exactly what to move.
>
> **[`TIER-1-SPEC-GAPS.md`](TIER-1-SPEC-GAPS.md) is now the queue for ADU-DB-01
> v1.10**, and it supersedes §2 of this document for DB-01. One item in it has a
> live security consequence and is one line either way: whether a **suspended**
> team member keeps their permissions until their session expires (§A1).
>
> Three reissues remain outstanding and none blocks a migration: **ADU-PRD-01
> v8.6**, **ADU-PROJ-01 v9.1**, **ADU-DPIA-01 v1.1**. §2.5-2.7 still describe
> them accurately.

**Produced:** 26 August 2026, Tier 0 session · **Author:** AI coding agent, CEO back-end session
**Governing document:** ADU-CON-02 v3.0 §15 (the nine tiers), §23 (documents to reissue)
**Authority rules:** `.claude/reference/DOCUMENT_AUTHORITY.md`

**Sources read, in the order the work order set them:** `DOCUMENT_AUTHORITY.md` ·
ADU-CON-02 v3.0 §15, §23 · ADU-CON-01 §5, §6 · ADU-CON-02-A1 §4 · ADU-DB-01
§28–29 (plus Appendix B and Appendix C, which §28's gates depend on) ·
ADU-API-01 §12–13 (plus §15) · ADU-AUTH-01 §15–§25.

---

## 0. The one-paragraph answer

**Tier 0 is complete. Tier 1 cannot start.** Not because of missing engineering,
but because the document Tier 1 is built from has not been written. ADU-CON-02
v3.0 carries four rulings (R16–R19) and inherits eleven more (R1–R11 from
ADU-CON-01, plus R15) whose governing lower-level specifications are still at
their pre-ruling revisions. **Seven documents owe a reissue.** One of them —
**ADU-DB-01 v1.7** — blocks Tiers 1 through 8 outright, and one item inside it
(R2, the `session_audience` collapse) has a deadline: it must be taken **before
any permission row is seeded**, or it stops being a migration and becomes a data
migration.

The cheapest path to an unblocked build is not seven reissues. It is one:
**ADU-DB-01 v1.7 turns Tier 1 from `SPEC_VERSION_GAP` into `CLEAR`.**

---

## 1. Per-tier status

Status vocabulary is `DOCUMENT_AUTHORITY.md`'s. `blocked-by-tier` means the tier
has no gap of its own — it is waiting on an earlier tier.

| Tier | Owner | Contents (ADU-CON-02 §15) | Status | Pending document |
|---|---|---|---|---|
| **0** | Both | Repo, toolchain, CI skeleton, compose, health check | **COMPLETE** | — |
| **1** | Naod | Migrations 1–5: roles, schemas, 54 enums, config, accounts, sessions, `verification`, sellers, **permissions seeded** | **SPEC_VERSION_GAP** | **ADU-DB-01 v1.7** |
| **2** | Naod | Migrations 6–15 **+ v1.7**: `operator_grant`, `seller_fulfilment_method`, `order.ready_at`, derived-role functions, R16 stats table, ratified transition set, autovacuum tuning | **SPEC_VERSION_GAP** + blocked by Tier 1 | **ADU-DB-01 v1.7** (named in the tier's own contents) |
| **3** | Naod | The pipeline: both credentials, **remember-device (R17)**, session read, permissions, tx settings, error mapper, idempotency, rate limits, locale, `/bootstrap`, OpenAPI publish | **SPEC_VERSION_GAP** + blocked by Tiers 1–2 | **ADU-AUTH-01 v2.1** (R17) · **ADU-API-01 v1.4** (credentials) · **ADU-SEC-01 v1.1** (device cookie) |
| **4** | Naod → Abenezer | Onboarding: seller, profile, company, social, identity, availability, fulfilment, readiness | **SPEC_VERSION_GAP** + blocked by Tier 3 | **ADU-PRD-01 v8.6** (R7 availability; the readiness set drops from ten codes to nine) · **ADU-API-01 v1.4** (gap-register endpoints 9, 10) |
| **5** | ″ | Catalogue, media commit, stock, confidence | **blocked-by-tier** (4) | **ADU-API-01 v1.4** for gap-register endpoints 2–8 |
| **6** | ″ | Orders, payment confirm/reject, **evidence viewer with R18 framing**, per-line cancel, refunds, mark ready, couriers on orders, QR | **SPEC_VERSION_GAP** + blocked by Tier 5 | **ADU-DB-01 v1.7** (R5 derived-role signature, R18 framing note) |
| **7** | ″ | Payout (change/cancel/history), team, ownership transfer, sessions, subscription, closure, deletion | **SPEC_VERSION_GAP** + blocked by Tier 6 | **ADU-DB-01 v1.7** (`seller.ownership:transfer` has no function) · **ADU-API-01 v1.4** (no endpoint) · **ADU-PRD-01 v8.6** (§16.2 role matrix) |
| **8** | ″ | Analytics (+ **R19 retirement job**), notifications + prefs, reports, seller reviews/claims, courier mgmt, `/v1/events` | **SPEC_VERSION_GAP** + blocked by Tier 7 | **ADU-DB-01 v1.7** (R19 job + window) · **ADU-API-01 v1.4** (13 of the 28 gap-register endpoints land here) |
| **9** | Both | Hardening — ADU-CON-05, seeded by A1 §6's six load tests | **blocked-by-tier** (8) | **ADU-CON-05 does not exist.** A1 §6 specifies its six tests; the document itself is unwritten |

### 1.1 Tier 0 — what was actually gated, and what it cost

§15's Tier 0 gate is *"CI green; compose yields Postgres with the four
extensions."* Both hold: `pnpm db:verify-extensions` prints four PASSes against
`pgvector/pgvector:pg17`, and `.github/workflows/ci.yml` runs install →
typecheck → lint → test → build → extensions → two greps.

**§13's definition of a working setup is NOT met, and cannot be.** It reads
*"`db:check` prints fifteen passes and the console signs in the seeded seller."*
Neither is achievable at Tier 0: there are no checks to run and no seller to
sign in. `pnpm db:check` prints `0 checks present (pre-v1.7)` by design. This is
the expected Tier 0 state, not a failure — but it means **§13's day-one script
does not fully succeed until Tier 3**, and a new developer should be told that
rather than left to conclude their machine is broken.

### 1.2 Why Tier 1 is blocked, item by item

Tier 1 is *"migrations 1–5 … permissions seeded"*. Five separate things inside it
need ADU-DB-01 v1.7:

| # | Item | Why v1.6 is not enough | Source |
|---|---|---|---|
| 1 | **`session_audience` enum** | v1.6 Appendix A has `MOBILE · SELLER_WEB · COURIER_WEB`; ADU-AUTH-01 v2.0 uses `MOBILE · CONSOLE` throughout. **R2 accepts the collapse.** The enum is created in migration 1 | ADU-CON-01 F2 / R2 |
| 2 | **`core.permission` + `role_permission` seed** | The catalogue lives in ADU-AUTH-01 §15 and the matrix in §16; ADU-DB-01 v1.6 defines the tables but seeds neither. AUTH-01 §25 assigns the seed to v1.7 | ADU-AUTH-01 §25 |
| 3 | **`surfaces` array values** | AUTH-01 §17/§24 write `surfaces = '{CONSOLE}'`; ADU-DB-01 §6.9a's DDL says `ARRAY['SELLER_WEB']`. **One of the two is wrong in a constraint that guards the payout boundary** | ADU-CON-01 F2 |
| 4 | **`timing_config` columns** | Must gain `otp_ttl`, `otp_max_attempts`, `step_up_freshness`, `new_device_payout_lock`, **and the four R17 session/idle values**. Migration 2 creates the config tables | ADU-AUTH-01 §25 · R17 |
| 5 | **`verification.read_attestation` signature** | Must lose `p_actor_role` and derive the role (**R5**). The function is created in migration 4, inside Tier 1 | ADU-CON-01 F5 / R5 |

> ### The one item with a deadline
>
> **R2 must be taken before any permission row is seeded.** ADU-CON-01 states it
> plainly: *"One migration, taken before any permission row is seeded, or it is a
> data migration afterwards."* Seeding the catalogue under the v1.6 enum and
> collapsing it later means rewriting live `permission.surfaces` arrays and every
> `role_permission` row that references them — under §19's expand → migrate →
> contract discipline, against code already running. **Ordering this correctly
> costs nothing today and is expensive from Tier 1 onward.**

### 1.3 The check-count arithmetic, which does not currently work

Three documents give three different numbers, and they cannot all be right:

| Source | Says |
|---|---|
| ADU-DB-01 v1.6 Appendix C, prose | *"**Twelve** checks"* |
| ADU-DB-01 v1.6 Appendix C, the table | Rows numbered **1–14** |
| ADU-CON-02 v3.0 §13, §15, §16 | *"`db:check` … must print **fifteen** passes"* |

The reconciliation is R16: v1.7 adds **check 15** (`grep -c "MATERIALIZED VIEW"`
= 0). So the intended series is 14 → 15, and **Appendix C's own prose figure of
"twelve" is stale in v1.6 and should be corrected to fourteen in the same pass.**

The same problem afflicts check 14's expected value:

| Source | Table count |
|---|---|
| ADU-DB-01 v1.6 Appendix B and check 14 | **105** |
| ADU-CON-01 F6 (adds `operator_grant`) | **106** |
| ADU-CON-02 v3.0 §15 Tier 2, and `CLAUDE.md` | **107** |

**The 106 → 107 difference is `core.seller_fulfilment_method`**, which
ADU-CON-02 §15 Tier 2 adds and ADU-CON-01 F6 predates. So the trail is
105 (v1.6) + `operator_grant` + `seller_fulfilment_method` = **107**, and
**ADU-CON-01 F6's "105 → 106" is stale relative to ADU-CON-02 v3.0.** v1.7 must
state 107 and move check 14 to it.

This matters more than a number: Appendix B itself warns that *"this figure read
16 in v1.1 and v1.2 and was wrong both times"* for the append-only count, and
that a wrong manifest *"disarms the check that verifies"* the invariant. Check 14
is described as *"the cheapest and catches the most."* A check whose expected
value is stale is a check that passes when it should fail.

---

## 2. Reissue debt register — the founder's writing queue

Seven documents, ordered by how much they unblock. Every row is compiled from
ADU-CON-02 §23, the rulings in ADU-CON-01 §5, ADU-CON-02-A1 §4, ADU-AUTH-01 §25
and ADU-DB-01 §29.

### 2.1 ADU-DB-01 → v1.7 — **the critical path. Blocks Tiers 1–8.**

| From | Must absorb |
|---|---|
| **R16** (A1 §4.1) | §8.3 reworded: `core.seller_public_stats` is a **plain table**, one row per seller, updated in O(1) by the triggers already firing on `handoff_scan`, `review`, `claim` and level events — **never a `MATERIALIZED VIEW`**. Appendix C gains **check 15**: `grep -c "MATERIALIZED VIEW" migrations/` = 0 |
| **R18** (A1 §4.3) | Framing note on `financial.payment_evidence`: ~64 KB AEAD frames, AES-256-GCM, per-frame nonce from a counter, frame index authenticated. The 5 MB `EVIDENCE_TOO_LARGE` cap stands |
| **R19 v2** (A1 §4.4, tightened by v3.0) | `analytics.retire_partitions` job + the **90-day** live window as a config value. **Note the change:** A1 §4.4 says *six months*; ADU-CON-02 §0.1 tightens it to 90 days because 153–225 GB live at 10k sellers priced managed storage out. **v1.7 must carry 90 days, not A1's six months** |
| **v3.0 §15 Tier 2** | Per-table autovacuum tuning for `rate_limit_bucket`, `idempotency_record` and the `jobs` schema (aggressive `autovacuum_vacuum_scale_factor` on high-churn tables) |
| **R2** (CON-01 F2) | `session_audience` collapses to `MOBILE` · `CONSOLE`; the `step_up_is_web_only` `CHECK`; **every `surfaces` array**; the `permission` seed. **Before any permission row is seeded** |
| **R5** (CON-01 F5) | `verification.read_attestation` and `financial.read_payment_evidence` **lose `p_actor_role`** and derive it server-side. New invariant: *actor_role in either access log is derived from the caller's actual grants and is never a function parameter.* **Before the evidence viewer is built (Tier 6)** |
| **R6** (CON-01 F6) | New table `core.operator_grant`, five operator roles seeded |
| **R7** (CON-01 F7) | Delete `active_hours_version_id` from §13.2's `core.payment_submission` column list — **§13.1 and §13.2 contradict each other one section apart in v1.6** |
| **R8** (CON-01 F8) | **Ratify the 24 transition rows**, adopting R-1 (`LATE_SYNC_RECOVERY` + reconciliation `StockEvent`), R-2 (`SYSTEM` claim in the same transaction) and R-3 (`CANCELLED_BY_SELLER` whenever any line was seller-cancelled or refunded). See open question **Q-1** — R-2 is contested |
| **R9** (CON-01 F9) | Correct the two stale rows in §26's invariant matrix (iOS seller audience; no web sign-in at MVP) |
| **AUTH-01 §25** | `timing_config` gains `otp_ttl`, `otp_max_attempts`, `step_up_freshness`, `new_device_payout_lock`, session lifetimes and idle timeouts · `account` gains `age_declared_over_18`, `age_declared_at` · `team_role` gains `seller.ownership:transfer` · `core.permission` seeded from §15, `core.role_permission` from §16 |
| **v3.0 §15 Tier 2** | `core.seller_fulfilment_method`, `order.ready_at`, derived-role functions |
| **Housekeeping** | **Appendix B → 107 tables**; **check 14 → 107**; Appendix C prose *"Twelve checks"* → **fourteen**, then fifteen with R16 |

### 2.2 ADU-AUTH-01 → v2.1 — blocks Tier 3

| From | Must absorb |
|---|---|
| **R17** (v3.0 §4.3, adopting A1 RR-17) | §8.1's lifetimes table rewritten: **remembered device 7 days absolute / 8 hours idle; any other device 12h / 30min.** `MOBILE` unchanged (30 days sliding, 5 devices) |
| ″ | The device-remember mechanic: a second long-lived `__Host-adulis_device` cookie, opaque, bound to the `(account, device)` row, revocable like any session, listed in the sessions screen as a named device |
| ″ | All four values live in `timing_config` (per market) |
| ″ | The client shows the idle warning **5 minutes before either idle limit** |
| ″ | Passkeys/WebAuthn recorded as the post-MVP path to near-zero SMS — **roadmap note, not built** |

*Effect if adopted: ~1.5 → ~0.25 console OTPs/seller/day; the SMS line falls from
~$6,500/month to ~$2,000 at 10k sellers, and what remains is transaction-shaped.*

### 2.3 ADU-API-01 → v1.4 — blocks Tiers 3–8

ADU-CON-02 §23 records this as *"unchanged list"* — the list is in ADU-CON-01 F12
and ADU-AUTH-01 §25:

| From | Must absorb |
|---|---|
| **R3** (CON-01 F3) | §5 records **two credential presentations**: `__Host-adulis_session` cookie for `CONSOLE`, `Authorization: Bearer` for `MOBILE`. Both ADU-SEC-01 §4 and ADU-AUTH-01 §5.1 already flag this as a change v1.3 has not absorbed |
| **R4** (CON-01 F4) | Billing group audience — **§12.12 contradicts §4.1** |
| **R10** (CON-01 F10) | `GET /v1/conversations` requires an explicit scope: `?as=buyer` or `?as=seller&seller_id=…`, **no default** |
| **R5** (AUTH-01 §25) | §13's function mapping updated for the derived-role signatures |
| **CON-01 §6** | **The 28-endpoint gap register** — 14 blocking, 11 required for a full management system, 3 deferrable. *"79 → roughly 104 endpoints. That number, not the screen count, is the honest size of the back-end task"* |
| **R2 knock-on** | §4's surface table and every **M** marking's counterpart, under the two-audience model |

### 2.4 ADU-SEC-01 → v1.1 — blocks Tier 3

| From | Must absorb |
|---|---|
| ADU-CON-02 §23 | §4 notes the second `__Host-adulis_device` cookie (R17) |
| **Also required, and not in §23's list** | **§5.2's console policy still specifies `script-src 'self' 'nonce-{NONCE}' 'strict-dynamic'`.** ADU-CON-02 §3.9 supersedes it with `script-src 'self'` on the Vite-emits-no-inline-scripts argument. `apps/console/public/_headers` follows v3.0 today and records the divergence in the file. **v1.1 should ratify the nonce-free policy and carry the reopen trigger** — *the moment the console origin ever serves user-influenced content* |

### 2.5 ADU-PRD-01 → v8.6 — blocks Tier 4 and Tier 7

Eleven write-backs from ADU-DB-01 §29 (W1–W11), plus:

| From | Must absorb |
|---|---|
| **W1** *(highest priority)* | §10.4 — scope the masking invariant to seller/team/support/admin surfaces and state the single logged buyer-disclosure path (C3). *As written, an engineer building from the PRD alone builds a product that cannot take a payment* |
| **W2–W11** | Price is a variant attribute (C1) · the two state machines replace the single lifecycle diagram (C2) · strike the deferred-follow test (C4) · `New` is earned by eligibility satisfied (C5) · the state a rejected payment returns to, `NOTIFIED` (W6) · the first-claim trigger means payment **submitted** (W7, and **R-2 depends on it**) · `EXPIRED_UNCLAIMED` terminality (W8) · boundary renamed `financial` (W9) · anti-gaming clock residual (W10) · the late-scan level-credit promise (W11) |
| **R7** (CON-01 F7) | Rewrite §4.6 and §10.2: availability is **informational, minimum one hour per window, zero windows valid, no change log, wall-clock SLA**. Strike the two §24 retroactivity tests. **Remove `ACTIVE_HOURS` from the readiness set — API §7.1's ten codes become nine** |
| **AUTH-01 §25** | §16.2 gains the role matrix and **ownership transfer as distinct from staff administration** · §6.6 payout lock extends to new-device sign-in · §6.4 new-device notification goes push-first · §16.7 adapter requirement extends to the SMS gateway |

### 2.6 ADU-PROJ-01 → v9.1 — blocks nothing in the build

| From | Must absorb |
|---|---|
| ADU-CON-02 §23 | The **hosting ruling** (§18: Render Frankfurt, Cloudflare Pro) · **§10's cost table replaced by §21's split** into infrastructure vs cost-of-revenue |
| **AUTH-01 §25** | §8.2 gains recovery review with a response target · §12 gains **OTP delivery rate** as a release gate · §13.1 records the SIM-swap residual |
| **CON-01 F12** | R1 (§11 phase 1) · §8.3's two-developer rewrite · recovery SLA |
| **DB-01 §29** | Hosting criteria must name `pgvector` **and** `btree_gist` availability. *Without the first the chatbot cascade has no layer 3; without the second §9.1's duplicate-reservation invariant has no implementation.* **`ops/provider-verify/probe.sql` now tests both** |

### 2.7 ADU-DPIA-01 → v1.1 — blocks nothing in the build; blocks launch posture

| From | Must absorb |
|---|---|
| ADU-CON-02 §23 | Processors: **Render and the SMS pair** · the **R15/R18 boundary** · the **remembered-device retention line** (R17 changes how long a session identifier lives on a device) |
| **AUTH-01 §25** | R15 closes on §13 · age declaration enters the §4 inventory · R6's law-enforcement disclosure gains an operator role · §7.4's automated-decision review path is an authorization concern |

### 2.8 Not owed a reissue

- **ADU-ARCH-01 v2.0** — *"No change. It is the document the others must catch up to"* (CON-01 F12).
- **ADU-CON-02-A1 v1.0** — *"stands as the test record"* (§23). Binding annex; not amended.

---

## 3. Tier 1 pre-flight

**References for the day Tier 1 opens. Not implementation, and nothing below is
built.**

### 3.1 The migrations (ADU-DB-01 §28, items 1–5)

| # | Contents | Notes for the reviewer |
|---|---|---|
| **1** | Extensions, roles, schemas, domains, **all enum types (Appendix A — 54 types)**, shared trigger functions | *"All created in migration 1, so no later migration invents a value."* Carries the **R2** `session_audience` decision. Ordering matters throughout §28 because later composite FKs depend on earlier unique keys |
| **2** | Markets and all configuration tables | Where **R17's four session values** land in `timing_config`, plus the four AUTH-01 §25 additions |
| **3** | Accounts, persons, devices, OTP, sessions, step-up, recovery | `account` gains `age_declared_over_18`, `age_declared_at` |
| **4** | **`verification` schema and its functions** | `read_attestation` must ship **already carrying R5's derived-role signature** — building it with `p_actor_role` and fixing it later means rewriting an append-only access log's semantics |
| **5** | Sellers, social accounts, team, courier, eligibility, ladder-entry trigger | Where `core.permission` / `core.role_permission` are seeded from AUTH-01 §15 and §16 |

> **§28 says *"Fourteen migrations"* and then lists fifteen.** Items 1–15 are
> enumerated; the prose count is wrong. ADU-CON-02 §15 Tier 2 says *"migrations
> 6–15"*, which agrees with the list, not the prose. **v1.7 should correct the
> word to fifteen.**

**Neither of Tier 1's migrations is on §28's hand-review list** — those are 7
(stock triggers, the concurrency-critical path) and 9 (the state machine).
Everywhere else a mistake raises an exception; in those two it produces wrong
data. Tier 1 still gets read line by line per §15, but the two that must not be
skimmed arrive in Tier 2.

### 3.2 The permission seed source

- **Catalogue: ADU-AUTH-01 §15.** *"`core.permission` is a closed set. A
  permission code that is not in this catalogue does not exist"*, and
  `role_permission` carries an FK to it. Naming is `<domain>.<resource>:<action>`,
  lower snake case, no abbreviation.
- **Matrix: ADU-AUTH-01 §16.** Six roles — Owner, Admin, Sales/Support,
  Inventory, Analyst, Campaign — across twenty permission groups.
- **§15.2's nine operator permissions** exist as a catalogue but have no model
  behind them (**R6**); they are seeded with `core.operator_grant` in Tier 2.
- **At MVP only `OWNER` is reachable.** The matrix ships anyway: the enum values
  are in the schema and the grants are seeded, because *"adding roles later to a
  system that assumed one is far harder than leaving five unused."*
- **Two invariants to encode, not infer:** `seller.ownership:transfer` is its own
  permission, Owner only, with step-up; and **`seller.staff:admin` never permits
  changing the Owner.** Without the split, an Admin can demote the Owner and
  promote themselves, acquiring the only two powers Admin lacks.

### 3.3 Which Appendix C checks apply at Tier 1

§15's Tier 1 gate names checks **1, 4, 10, 11, 12** — all five exist in v1.6 and
all five are greps, runnable the moment the migrations do.

| # | Check | Expected | Guards |
|---|---|---|---|
| 1 | `grep -ci "original_key\|image_url\|photo_url"` | **0** | No identity or product original is ever stored (§7.3, §9.5) |
| 4 | `grep -E "REFERENCES (core\|chat)\." nlu migration` | **0** | The `nlu` store stays separated |
| 10 | `grep -E "GRANT .* ON SCHEMA (verification\|financial) .* adulis_app"` | **0** | Both isolated boundaries readable only through logging functions |
| 11 | `grep -c "account_ciphertext" core migrations` | **0** | The column exists only in `financial` |
| 12 | `grep -E "(INSERT\|UPDATE\|DELETE).*_state_transition_legal.*adulis_app"` | **0** | The state machine cannot widen at runtime |

**Every one expects zero.** These guard invariants enforced by an *absence* —
the failure mode where an agent "completes" the schema and silently removes a
guarantee. Note that check 4's guard is only partly exercised at Tier 1: the
`nlu` schema arrives in migration 13 (Tier 2).

The gate's second half — *"every §15 permission exists"* — is a query against the
seeded catalogue, not a grep, and is the half that needs v1.7.

**`db/checks/` is empty and stays empty until v1.7.** Writing these five now
would mean fixing their expected values against a manifest that is about to
change, and check 15 does not exist yet. `pnpm db:check` prints
`0 checks present (pre-v1.7)`.

---

## 4. Open questions — not answered here

Per `DOCUMENT_AUTHORITY.md`, no non-`CLEAR` status is converted into code by
guessing. These need the founder, not the agent.

| # | Question | Status | Where it bites |
|---|---|---|---|
| **Q-1** | **R-2 is ruled both ways.** ADU-CON-01 F8/R8 rules *"ratify row 6, and open a `SYSTEM` claim in the same transaction"* for a buyer-paid order that expires. **ADU-API-01 §15 states "R-2 is closed — a submitted payment never expires."** If a submitted payment never expires, R8's row-6 scenario cannot occur and its claim never fires; if it can occur, API-01 §15 is wrong | **SPEC_CONFLICT** | Tier 2's ratification. Also depends on **W7** — if §14's trigger is not corrected to read payment *submitted*, R-2's claim never fires either way |
| **Q-2** | **`surfaces` is `{CONSOLE}` or `ARRAY['SELLER_WEB']`** — AUTH-01 §17/§24 versus DB-01 §6.9a. R2 resolves the *direction*, but the `CHECK` that guards the payout boundary is currently written two ways | **SPEC_CONFLICT** | Tier 1, migration 1. Resolved by taking R2 |
| **Q-3** | **The "§11 never-log list" does not exist.** The Tier 0 work order cites it; no §11 in any supplied document contains one. ADU-CON-02 §3.12 points to §20.3, which defines the weekly counters instead | **MISSING_SOURCE** | `apps/api/src/common/logging.ts` implements the **allow-list** §3.12 actually specifies, and carries a derived, individually-cited `NEVER_LOG` constant marked *pending confirmation*. The allow-list already excludes everything by construction, so this is not blocking — but the canonical list should be written |
| **Q-4** | **The exact names inside §19's `R2_*` and `SMS_*` globs.** §19 fixes the count (~13) and names `DATABASE_URL`, `DATABASE_URL_MIGRATE` and `CONSOLE_ORIGIN` exactly; the rest are globs | **OPEN_DECISION** | `.env.example` uses names traced to the columns they serve, marked as Tier-0 placeholders. Renaming later is a documentation amendment, not a code change |
| **Q-5** | **`AGENTS.md` or `CLAUDE.md`?** ADU-CON-02 §12 and §14.3 both name **`AGENTS.md`** as the file loaded every session. The skills pack ships `CLAUDE_MD_SNIPPET.md` and the work order directs a root **`CLAUDE.md`**. This session created `CLAUDE.md` as directed | **OPEN_DECISION** | Cosmetic today; §14.3 and §20.4 both make "the file" a maintained artefact that changes in the same PR as any decision touching it. **Two files with one job is the drift §13.5 warns about** — pick one and amend §12/§14.3 to match |
| **Q-6** | **SMS primary vendor** — AfroMessage or GeezSMS, *"selected by measured delivery rate in Phase 0"* | **OPEN_DECISION** (§22, O-5b) | Blocks launch, not the build. `SMS_PRIMARY_API_KEY` is a placeholder for a vendor not yet chosen |
| **Q-7** | **ADU-CON-05 does not exist.** A1 §6 specifies its six load tests and §15 makes it Tier 9's contents | **MISSING_SOURCE** | Tier 9. Test 6 — *"the pooled-connection settings-leak test under load"* — already has its unit-level counterpart in `apps/api/src/common/db/request-context.spec.ts` |
| **Q-8** | **Delivery fee.** `seller_fulfilment_method` carries no fee column, deliberately | **OPEN_DECISION** (§22, O-6) | Tier 4. *"Either PRD ruling is a migration"* — so the ruling is cheaper before Tier 4 than after |
| **Q-9** | **Repository name.** The remote is `Adulis-MobileApp-Andriod`; ADU-CON-02 §12 names the monorepo **`adulis-platform`**, and this repository now contains the API, the console and the database — not an Android app | **OPEN_DECISION** | Nothing technical. But §12's *"one pnpm monorepo, `adulis-platform`"* and a repository called `MobileApp-Andriod` will confuse every future reader, and the name also carries a typo (*Andriod*) |

---

## 5. What unblocks the most, in order

1. **ADU-DB-01 v1.7** — turns Tier 1 `CLEAR` and removes the gap from Tiers 2, 6,
   7 and 8. Nothing else comes close. **Take R2 first inside it.**
2. **ADU-AUTH-01 v2.1** — R17 only; the smallest document on the list and the one
   with a priced consequence (~$4,500/month at 10k sellers).
3. **ADU-API-01 v1.4** — the 28-endpoint gap register is the honest size of the
   back-end task and the front-end cannot generate a client without it.
4. **ADU-SEC-01 v1.1** — small, and it ratifies a policy already deployed in
   `apps/console/public/_headers`.
5. **ADU-PRD-01 v8.6** — W1 is marked *highest priority* by ADU-DB-01 §29 and is
   the one where building from the PRD alone yields a product that cannot take a
   payment.
6. **ADU-PROJ-01 v9.1** and **ADU-DPIA-01 v1.1** — neither blocks a tier; both
   block an honest launch posture.

---

*Compiled at Tier 0 from the supplied baseline. Every status above is traceable
to a named section; nothing is inferred across a revision boundary. Where two
binding documents disagree, the disagreement is recorded as a question rather
than resolved by this agent.*
