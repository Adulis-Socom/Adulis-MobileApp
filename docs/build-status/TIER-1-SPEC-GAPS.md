# Tier 1 — specification gaps in ADU-DB-01 v1.8

**Produced:** 26 August 2026, Tier 1 session · **Author:** AI coding agent, CEO back-end session
**Governing rule:** Work order T1 §3 — *"Transcribe, do not design. Where you believe something is missing, report it — do not fill it in."* §9 — *"If ADU-DB-01 v1.8 appears to contradict itself, stop and report it… the correct response is a document amendment, not a judgement call in SQL."*

**This is the founder's writing queue for ADU-DB-01 v1.9.** Every item below is a
place where migrations 02–05 cannot be transcribed, with the exact question that
unblocks it. Nothing here is a preference, and nothing here has been guessed into
SQL.

---

## 0. Where Tier 1 actually stands

| Migration | Status |
|---|---|
| **01 foundation** | **Built, applied, tested, deterministic.** Fully specified once the two counting defects in §A are read as counting defects |
| **02 configuration** | **Blocked.** 4 of 7 tables have no column names |
| **03 identity** | **Blocked.** 1 table has no column list; 1 trigger has a forward dependency |
| **04 verification** | **Blocked.** One of its two functions is named across the document set and defined nowhere |
| **05a seller** | **Blocked.** One function reads a column that does not exist; two tables are prose |
| **05b permission seed** | **Blocked, and this is the serious one.** §B |

**Reading the shape of this rather than the list:** v1.8 is precise wherever it is
enforcing something and loose wherever it is merely holding a place. Every
`CREATE TABLE` block, every `CHECK`, every function body in the document is exact.
The gaps are all in tables whose *contents are policy* — configuration — and in
one seed whose source document changed underneath it.

---

## A. Counting defects — resolved by recounting, not by a ruling

Both were built against the enumeration rather than the summary figure, because
Appendix B states the document's own doctrine for exactly this case: *"Recount it
whenever the manifest changes; it is not decorative."*

### A1 · Enum types: 54 vs 56 vs 66

| Location | States |
|---|---|
| Appendix A header | *"54 types"* |
| §0.1 (v1.8 changes) | *"Enum types unchanged at 56"* |
| §0.2 (v1.7 changes) | *"**56** enum types"* |
| Appendix A, enumerated | **66** — 55 in `core`, 11 in other schemas, 230 values, no duplicates |

Migration 01 creates the 66 enumerated types. **Work order T1 Gate B's figure of
56 inherits the same defect** and should read 66.

*Amendment:* set Appendix A's header and §0.1's count to 66.

### A2 · Schemas: nine vs ten

| Location | States |
|---|---|
| §3 header | *"Nine schemas in one Postgres cluster"* |
| §3 table | core · verification · financial · chat · nlu · billing · ledger · analytics · **jobs** |
| Appendix B manifest | …analytics · **waitlist** (no `jobs`) |
| Appendix A | places an enum at **`waitlist.platform`**, while stating all enum types are created in migration 1 |

`waitlist` must therefore exist in this cluster for migration 01 to run at all —
which also settles, in the affirmative, whether §25's *"its own store, in its own
schema, with its own credentials"* means a separate database. It does not.

Migration 01 creates **ten** schemas.

*Amendment:* §3 to read ten and list both `jobs` and `waitlist`; confirm in §25
that the waitlist store is a schema in the product cluster with its own role, not
a separate database — **or**, if it genuinely is a separate database, move
`waitlist.platform` out of migration 1 and drop `waitlist.application` from
Appendix C check 14's count of 109.

---

## B. The permission catalogue — four defects in the one constraint that guards the payout boundary

**This is the blocking item, and it is the one work order T1 §0 predicted:**
*"A wrong `surfaces` array in the permission seed is a surface restriction that
silently does not exist. Nothing raises… The first symptom is a payout change
succeeding from a mobile session, months later."*

### B1 · The `step_up_is_web_only` CHECK does not constrain three of the eight step-up permissions

§6.9a:

```sql
ALTER TABLE core.permission ADD CONSTRAINT step_up_is_web_only CHECK (
  code NOT IN ('seller.payout:update', 'seller.instructions:reissue',
               'seller.staff:admin', 'seller.subscription:update',
               'seller.account:delete', 'seller.sessions:revoke_all')
  OR surfaces = ARRAY['CONSOLE']::core.session_audience[]
);
```

Because the shape is `code NOT IN (…) OR surfaces = '{CONSOLE}'`, **any code absent
from that list is unconstrained.** Against ADU-AUTH-01 v2.1 §17's set of eight,
three are absent:

| Step-up permission (AUTH-01 v2.1 §17) | Constrained by the CHECK? |
|---|:--:|
| `seller.payout:update` | yes |
| `seller.staff:admin` | yes |
| `seller.subscription:update` | yes |
| `seller.account:delete` | yes |
| `seller.sessions:revoke_all` | yes |
| **`seller.orders:reissue_instructions`** | **no** |
| **`seller.identity:manage`** | **no** |
| **`seller.ownership:transfer`** | **no** |

All three could be seeded `surfaces = '{MOBILE, CONSOLE}'` and the constraint
would pass. `seller.ownership:transfer` reachable from a mobile session is the
worst of the three: ADU-AUTH-01 §16 introduced that permission *specifically*
to stop an Admin acquiring the store, and §9.1 lists it among the actions no
`MOBILE` session may reach.

### B2 · One code in the CHECK is not a permission that exists

`seller.instructions:reissue` appears in no catalogue. ADU-AUTH-01 v2.1 §15.1
names it **`seller.orders:reissue_instructions`**. A `NOT IN` entry naming a code
that is never inserted constrains nothing — it is inert, and inert in a way no
test detects unless a test asks for the code by name.

### B3 · Four codes in §6.9a do not exist in the catalogue at all

§6.9a's "Companion Phase 1 grants, for reference" list:

| §6.9a says | ADU-AUTH-01 v2.1 §15.1 says |
|---|---|
| `seller.reservations:read` | `seller.orders:read` |
| `seller.reservations:respond` | `seller.orders:respond` |
| `seller.payment_receipt:confirm` | `seller.payment:confirm` |
| `seller.instructions:reissue` | `seller.orders:reissue_instructions` |

These read as v1.6-era names that the v1.7 reissue updated in AUTH-01 and not in
DB-01. **AUTH-01 v2.1 §15 is the catalogue** (*"`core.permission` is a closed set.
A permission code that is not in this catalogue does not exist"*), so DB-01 §6.9a
is the side that needs correcting.

### B4 · Appendix C's own reviewer query cannot run against §6.9a's table

Appendix C:

```sql
SELECT key FROM core.permission WHERE 'CONSOLE' = ANY(surfaces) AND requires_step_up
EXCEPT SELECT unnest(ARRAY[ … the correct eight … ]);
```

§6.9a defines:

```sql
CREATE TABLE core.permission (
  code     text PRIMARY KEY,
  surfaces core.session_audience[] NOT NULL
);
```

There is no `key` column and no `requires_step_up` column. **Work order T1 §6 Gate
C requires this query to return zero rows; as written it does not execute.**

Note that Appendix C's query carries the *correct* set of eight, including
`seller.orders:reissue_instructions` — so the document knows the right answer in
one place and the wrong one in another, ten sections apart.

### B5 · The §16 role matrix is group-level; the seed is code-level, and no mapping is given

ADU-AUTH-01 v2.1 §16 has **20 rows** ("Orders read", "Catalogue write, publish",
"Store write, availability", …). §15.1 has **42 permission codes**. Seeding
`core.role_permission` requires a row per (role, code) — 6 × 42 = up to 252
decisions — and the mapping from 20 groups to 42 codes is nowhere stated.

Three concrete places the mapping cannot be inferred:

- **`seller.fulfilment:write` has no row in the matrix at all.** It is new in
  AUTH-01 v2.1 §15.1, which explains why it was separated from
  `seller.store:write` — *"an Inventory role that can declare how goods reach
  buyers without also being able to rename the store is a distinction Business
  tier will want"* — but §16's "Store write, availability" row was not updated, so
  whether Inventory gets it is exactly the question left open.
- **`○` means "read-only variant where one exists"**, which is undefined per code.
  "Orders read" carries `○` for Inventory and Campaign — a read-only variant of a
  read permission is not a thing.
- **The bare `:read` codes** — `seller.products:read`, `seller.stock:read`,
  `seller.store:read` — appear in no matrix row.

*This is the item to write first.* A code-level matrix — 42 rows × 6 roles,
explicit true/false — removes all of B5 and makes the Gate C negative-case test
mechanical.

---

## C. Tables with no column specification

Prose sketches, not column lists. Each blocks its migration.

| Migration | Table | What the document gives | What is missing |
|---|---|---|---|
| 02 | `core.locale_pack` | *"Available locales, formats"* | **Every column name.** No reference anywhere else in the document set |
| 02 | `core.identity_config` | *"KYC vendor reference, accepted document types, verification hours"* | **Every column name.** Is "accepted document types" an enum array or a lookup table? |
| 02 | `core.legal_config` | *"Terms version, retention periods, prohibited categories, invoice format"* | **Every column name.** "Retention periods" is plural and unnamed; "prohibited categories" overlaps `core.prohibited_keyword`, which is its own table |
| 02 | `core.ladder_config` | 3 columns named elsewhere: `distinct_buyer_window`, `max_handoffs_per_buyer`, `new_level_transaction_cap_minor`; plus `new_level_product_cap` | *"Established/Trusted thresholds"* and *"demotion rules"* have no column names. Thresholds against **what measure** — completed handoffs, scan-completion rate, upheld-claim rate? ADU-CON-03's SC-13 shows all three |
| 02 | `core.timing_config` | ~19 columns named across §5.3, §6.6a, §12.4a and ADU-AUTH-01 §25 | *"cancellation-penalty ladder"* (§9.5's 1 hour → 1 day → 2 days escalation) has no column name or shape |
| 03 | `core.buyer_profile` | *"One per account… derived views, not stored counters"* | **No column list.** Presumably `(id, account_id, created_at)`, but the document does not say so |
| 05a | `core.seller_company_detail` | *"registration identifier, trade licence number, TIN, representative `person_id`, representative relationship"* | Descriptions rather than column names; only `person_id` is given as an identifier |

**A note on what is *not* on this list.** Column *types* are frequently absent —
`core.seller` names `store_name`, `handle`, `description`, `published_at` without
types — and that is not treated as a gap: §4's conventions settle them (every
timestamp is `timestamptz`, money is `_minor bigint` plus a currency, enums are in
Appendix A). Only missing **names** block transcription.

---

## D. References to things that do not exist

### D1 · `verification.write_attestation` is named everywhere and defined nowhere

- ADU-API-01 v1.5 §13 maps `POST /v1/seller/identity-verification` to it.
- ADU-DB-01 v1.8 §0.4's change table claims v1.5 **defined** it: *"Missing
  functions | Named in ADU-API-01, defined nowhere | **`financial.read_payment_evidence`
  and `verification.write_attestation` defined**"*.
- §7.3 defines `read_attestation` and mentions `id_hash_matches`. **There is no
  `write_attestation` anywhere in the document.**

The change note asserts the fix for precisely the defect that is still present.

### D2 · `fn_seller_availability_state` reads a column `core.market` does not have

§13.1b:

```sql
  SELECT m.timezone INTO v_tz
    FROM core.seller s JOIN core.market m ON m.id = s.market_id
```

§5.1 names the column **`display_timezone`**. The function will not compile
against the specified table.

This one is worth pausing on: §13.1b's own INVARIANT calls the timezone
resolution *"the single most likely defect in the feature and… the reason the
function exists rather than a `WHERE` clause in three services."* The function
written to prevent the defect does not run. Work order T1 §5 makes the same
timezone rule one of *"three things in 5a to get exactly right"*, and §8 requires
a test constructed around 00:30 and 23:30 local so that a UTC implementation
fails — a test that cannot be written until the column name is settled.

*Amendment:* either rename `core.market.display_timezone` to `timezone`, or fix
§13.1b to read `m.display_timezone`. The second is the smaller edit.

---

## E. Ambiguities — one reading has to be chosen, and it is not this agent's to choose

| # | Location | Question |
|---|---|---|
| E1 | §5.2 `core.market_phase_gate` | *"…`dpia_revisited_at timestamptz`, each with `attested_by` and `attested_at`"* — **per condition** (four pairs, eight columns) or **per row** (one pair)? The word "each" points at per-condition; one pair per row is what most schemas do |
| E2 | §28 vs §8.1 | `core.seller_level_state` is created by migration 8 per §28's grouping, but §28 migration 5 places the ladder-entry **trigger** that inserts into it, and §8.1 is emphatic the trigger must not move later. Work order T1 §5 resolves this by listing `seller_level_state` in migration 5 — **confirm that ordering in §28** |
| E3 | §5.3 vs §28 | `billing.price_schedule` is listed among §5.3's configuration tables but `billing` is migration 14. Migration 2 is assumed to mean the six `core.*` configuration tables only |
| E4 | §6.6 | The new-device notification trigger on `session` insert *"enqueues the notification"* — `core.notification` is migration 14. Does the trigger land in migration 3 and stay dormant, or in migration 14? |
| E5 | §7.3 | `verification.read_attestation` derives the role from `core.operator_grant`, created one migration later. Work order T1 §4 anticipates this and rules that the function stays in migration 4 — **which works**, because a `plpgsql` body is not validated at creation |

---

## F. One defect in Appendix C itself

**Check 10 as literally written is unsatisfiable by a working system.** Verified
empirically before it was written up, not assumed:

```
grep -E "GRANT .* ON SCHEMA (verification|financial) .* adulis_app"   expected 0
```

PostgreSQL requires `USAGE` on a schema before any role may reference **any**
object in it, including calling a function. With §7.3's DDL exactly as written —
`REVOKE ALL ON SCHEMA verification FROM adulis_app`, then
`GRANT EXECUTE ON FUNCTION verification.read_attestation TO adulis_app` — the call
raises `insufficient_privilege`. The boundary function is uncallable, so identity
verification does not work at all.

Adding `GRANT USAGE ON SCHEMA verification TO adulis_app` makes the call succeed
and leaves a direct `SELECT` on `verification.identity_attestation` **still
denied**. `USAGE` conveys namespace visibility and no data access.

So the invariant is not *"no `GRANT` on the schema"*. It is *"`adulis_app` holds no
privilege on any **table** in those schemas, and `EXECUTE` on nothing but the
named boundary functions"* — which is what `db/checks/check-10-isolated-boundaries.mjs`
asserts. Work order T1 §3 already classifies check 10 as a live-database query
rather than a grep, which is the right call for this reason.

*Amendment:* restate check 10 in Appendix C as a privilege query.

---

## G. Recommended order of work for v1.9

1. **§B5 — the code-level role matrix.** Largest unblock: it is the whole of
   migration 5b, and 5b is the migration §0 of the work order says to slow down for.
2. **§B1–B4 — reconcile §6.9a with ADU-AUTH-01 v2.1 §15/§17.** Four small edits:
   the CHECK's eight codes, the four stale code strings, and either adding
   `requires_step_up` to `core.permission` or rewriting Appendix C's query against
   `code`. **Until this lands, three step-up permissions are unprotected by the
   only constraint that protects them.**
3. **§C — column names for six tables.** Mostly configuration; each is a short
   table like §5.1's.
4. **§D1, §D2 — two broken references.** `write_attestation` needs a definition;
   `m.timezone` needs one word changed.
5. **§A, §E, §F — counts, ambiguities, and check 10.** Editorial, and none blocks
   a migration once 1–4 are done.

*Items 1 and 2 unblock migration 05b. Item 3 unblocks 02, 03 and 05a. Item 4
unblocks 04 and completes 05a.*
