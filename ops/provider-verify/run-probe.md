# Provider capability probe — how to run it, and what a pass looks like

**Governing document:** ADU-CON-02 v3.0 §18 (Hosting — decided), open item O-1.
**Status of the probe itself:** disposable capability-test DDL. **Not the schema.**

---

## Why this exists

§18 rules that Adulis runs on managed PostgreSQL 17 on Render (Frankfurt), with
DigitalOcean Managed Postgres and then AWS RDS as ordered fallbacks. It also
attaches a condition to that ruling:

> **Mandatory verification before any commitment** (requirement 5 is on no
> feature page).

That parenthesis is the point. A managed provider's feature page tells you the
Postgres version and the backup policy. It does not tell you whether you may
create a schema owned by a role your application role cannot reach — which is
the property the `verification` and `financial` boundaries are built out of. So
we test it rather than assume it.

**Any failure disqualifies that provider that day.** Not "raises a question" —
disqualifies. `DATABASE_URL` means the application never knows which provider it
is talking to, so switching costs nothing before commitment and a great deal
after.

## What the probe does *not* do

It creates **no Adulis object**. Every role, schema, table and function it makes
carries a `probe_` prefix, exists for one statement's worth of proof, and is
dropped before the script ends. It must never be copied into `db/migrations/`.
The real schema is ADU-DB-01: nine schemas, six roles, 105 tables in v1.6 rising
to 107 under the pending v1.7.

The probe creates *six roles and two schemas* because those are the **shapes**
being tested, not because those are the real ones.

---

## Running it

Use a **scratch database**. Never one holding real data.

```bash
# Local (the compose instance) — this is the baseline transcript below.
docker exec -i adulis-postgres psql -U adulis_app -d postgres \
  -c "DROP DATABASE IF EXISTS adulis_probe;" -c "CREATE DATABASE adulis_probe;"

docker exec -i adulis-postgres psql -U adulis_app -d adulis_probe \
  -v ON_ERROR_STOP=1 -f /dev/stdin < ops/provider-verify/probe.sql
```

```bash
# Against a candidate provider's TRIAL instance.
psql "$PROVIDER_ADMIN_URL" -c "CREATE DATABASE adulis_probe;"
psql "$PROVIDER_PROBE_URL" -v ON_ERROR_STOP=1 -f ops/provider-verify/probe.sql
psql "$PROVIDER_ADMIN_URL" -c "DROP DATABASE adulis_probe;"
```

Needs a superuser, or a role with `CREATEROLE` and `CREATE` on the database.
**If the provider will not grant that much on a trial instance, that is itself a
finding** — migration 1 creates roles and schemas, so an account that cannot do
it here cannot run migration 1 there.

`ON_ERROR_STOP=1` is not optional: every capability raises an exception on
failure, and without it psql continues past the failure and still prints a
reassuring `PROBE COMPLETE` at the end.

---

## The capabilities, and why each is load-bearing

| # | Capability | If it fails |
|---|---|---|
| **1** | The four extensions install — `vector`, `btree_gist`, `pg_trgm`, `pgcrypto` | Without `vector` the chatbot cascade has no layer 3; without `btree_gist` the duplicate-reservation invariant of ADU-DB-01 §9.1 **has no implementation at all** (ADU-DB-01 §29) |
| **1b** | `EXCLUDE USING gist` actually rejects an overlap | Installed is not the same as usable. This is the constraint that makes duplicate reservations impossible; Appendix C check 7 expects at least 8 of them |
| **2** | Six roles can be created independently | ADU-DB-01 §3's six-role model does not fit |
| **3** | Two schemas owned by **different** roles | The `verification` and `financial` isolated boundaries (§§7.3, 13.3) collapse into ordinary schemas |
| **4a** | `REVOKE ALL` holds — the app role **cannot** `SELECT` the table | Appendix C check 10 becomes decorative, and an unlogged read of payment evidence becomes possible |
| **4b** | A `SECURITY DEFINER` function **can** be called by that same app role, and returns **ciphertext** | The escorted-access pattern is unavailable, and with it every logged read path |
| **4c** | The call wrote its access-log row in the same transaction | "Reading and logging are one statement" (ADU-DPIA-01 §4) stops being true — a DPIA commitment, not merely an engineering one |
| **5** | RLS filters on `current_setting('adulis.actor_role', true)` and **fails closed** when unset | §6.1's entire transaction-settings design has nothing to act on. A courier could read another seller's orders whenever code forgets a `WHERE` |

Capability 5 asserts three numbers, and the third matters most: with no identity
declared the policy must return **zero** rows. A policy that returns everything
when the setting is absent is worse than no policy, because it looks like one.

On 4b: the function returns **ciphertext, never plaintext**. That is ruling R15 —
key material never enters Postgres, so the boundary function hands back
ciphertext and a key reference and the API decrypts it (as ~64 KB AEAD frames,
R18). A probe that decrypted in-database would be certifying a shape the
architecture rejects.

---

## The §18 four-step checklist

The probe is **step 1 and the shape of step 2**. The remaining steps need
migrations that do not exist until Tiers 1–2, so they are recorded here unrun,
each with the tier that unblocks it.

| Step | §18 requirement | Status at Tier 0 |
|---|---|---|
| **1** | The four `CREATE EXTENSION`s succeed | **Done.** Capability 1 below, and `pnpm db:verify-extensions` |
| **2** | Migrations 1, 4 and 10 run — six roles, both isolated schemas owned by their roles, `REVOKE` holds, `SECURITY DEFINER` callable, RLS enforces | **Shape proven, migrations not run.** Capabilities 2–5 prove the instance *supports* every one of these. The migrations themselves are **Tier 1–2** and do not exist yet |
| **3** | `pnpm db:check` = 15 passes | **Blocked — SPEC_VERSION_GAP.** ADU-DB-01 v1.6 Appendix C defines **14** checks, and its check 14 expects **105** tables where ADU-CON-02 v3.0 requires **107**. Check 15 (`grep -c "MATERIALIZED VIEW"` = 0, R16) exists only in the pending **v1.7**. `db/checks/` is empty and `pnpm db:check` prints `0 checks present (pre-v1.7)` |
| **4** | A manual backup restores to a second instance where check 14 = 107 | **Blocked** by steps 2 and 3. This is also the first run of the §20.1 restore drill — "a backup that has never been restored is a hope" |

**Do not read a green step 1 as provider verification complete.** Steps 2–4 are
the ones that catch a provider whose managed role model quietly differs, and
they cannot run until the migrations exist. Re-run this whole file against the
chosen provider's trial instance before any commitment.

---

## Local baseline transcript

Captured by running the command above against the `docker-compose.yml` instance
(`pgvector/pgvector:pg17`, PostgreSQL 17.11) on 26 August 2026. This is the
reference a provider's output is compared against.

**Read `psql:/proc/self/fd/0:NN:` as "line NN of probe.sql"** — an artifact of
piping the file over stdin into the container, not part of the output.

**Compare content, not line order.** psql writes `NOTICE` to stderr and command
tags (`CREATE TABLE`, `DROP SCHEMA`) to stdout, so merging the two streams
interleaves them differently from run to run. Two runs of this probe produce the
same 126 lines in a slightly different order. Diff sorted output, or just check
that the eight `CAPABILITY ... PASS` lines and `TEARDOWN PASS` are all present.

```text
Timing is off.

=== ADULIS PROVIDER CAPABILITY PROBE ===
Disposable test DDL. Everything created here is dropped at the end.

DROP SCHEMA
DROP SCHEMA
psql:/proc/self/fd/0:55: NOTICE:  schema "probe_financial" does not exist, skipping
psql:/proc/self/fd/0:56: NOTICE:  schema "probe_core" does not exist, skipping
DROP TABLE
psql:/proc/self/fd/0:57: NOTICE:  table "probe_exclude_check" does not exist, skipping
DO
--- 1. Extensions ---
CREATE EXTENSION
CREATE EXTENSION
CREATE EXTENSION
CREATE EXTENSION
 extension  | version | result 
------------+---------+--------
 btree_gist | 1.7     | PASS
 pg_trgm    | 1.6     | PASS
 pgcrypto   | 1.3     | PASS
 vector     | 0.8.6   | PASS
(4 rows)

psql:/proc/self/fd/0:98: NOTICE:  CAPABILITY 1 PASS: all four extensions installed
DO
CREATE TABLE
INSERT 0 1
psql:/proc/self/fd/0:125: NOTICE:  CAPABILITY 1b PASS: EXCLUDE USING gist rejected the overlap (exclusion_violation)
DO

--- 2. Six roles ---
CREATE ROLE
CREATE ROLE
CREATE ROLE
CREATE ROLE
CREATE ROLE
CREATE ROLE
           role           | result 
--------------------------+--------
 probe_app                | PASS
 probe_financial_owner    | PASS
 probe_jobs               | PASS
 probe_migrate            | PASS
 probe_readonly           | PASS
 probe_verification_owner | PASS
(6 rows)

DO

--- 3. Two schemas, different owners ---
psql:/proc/self/fd/0:153: NOTICE:  CAPABILITY 2 PASS: six independent roles created
CREATE SCHEMA
CREATE SCHEMA
     schema      |         owner         | result 
-----------------+-----------------------+--------
 probe_core      | probe_app             | PASS
 probe_financial | probe_financial_owner | PASS
(2 rows)

DO

--- 4. REVOKE holds; SECURITY DEFINER crosses ---
psql:/proc/self/fd/0:180: NOTICE:  CAPABILITY 3 PASS: probe_core owned by probe_app, probe_financial owned by probe_financial_owner
SET
CREATE TABLE
CREATE TABLE
INSERT 0 1
REVOKE
REVOKE
REVOKE
REVOKE
CREATE FUNCTION
GRANT
GRANT
GRANT
RESET
SET
psql:/proc/self/fd/0:264: NOTICE:  CAPABILITY 4a PASS: direct SELECT denied (insufficient_privilege)
DO
psql:/proc/self/fd/0:277: NOTICE:  CAPABILITY 4b PASS: SECURITY DEFINER callable by probe_app; returned 78 bytes of ciphertext (never plaintext, R15)
DO
RESET
DO

--- 5. RLS on a transaction-local setting ---
psql:/proc/self/fd/0:290: NOTICE:  CAPABILITY 4c PASS: the read wrote its access-log row, actor_role=SELLER_OWNER
CREATE TABLE
INSERT 0 3
ALTER TABLE
ALTER TABLE
CREATE POLICY
GRANT
GRANT
SET
DO
psql:/proc/self/fd/0:347: NOTICE:  CAPABILITY 5 PASS: RLS filtered 3 rows to 2 (SELLER_OWNER), 1 (COURIER), 0 (unset)
RESET

--- Teardown ---
DROP TABLE
psql:/proc/self/fd/0:358: NOTICE:  drop cascades to 3 other objects
DETAIL:  drop cascades to table probe_financial.secret_ledger
drop cascades to table probe_financial.access_log
drop cascades to function probe_financial.read_secret(bigint)
DROP SCHEMA
psql:/proc/self/fd/0:359: NOTICE:  drop cascades to table probe_core.scoped_order
DROP SCHEMA
DROP OWNED
DROP OWNED
DROP OWNED
DROP OWNED
DROP OWNED
DROP OWNED
DROP ROLE
DROP ROLE
DROP ROLE
DROP ROLE
DROP ROLE
DROP ROLE
DO

=== PROBE COMPLETE — all capabilities passed ===

psql:/proc/self/fd/0:384: NOTICE:  TEARDOWN PASS: no probe_ roles or schemas remain
```

### Reading it

- **`NOTICE: ... does not exist, skipping`** at the top is expected on a virgin
  database. The pre-cleanup block is guarded so the probe is safe to re-run
  after a failed attempt.
- **Eight `CAPABILITY ... PASS` lines** must appear. Any failure raises and stops
  the script, so a truncated transcript is a failure even when nothing in it
  says so.
- **`TEARDOWN PASS: no probe_ roles or schemas remain`** must be present. If the
  probe ever leaves objects behind on a shared instance, drop them by hand
  before doing anything else — every one is prefixed `probe_`.
- **`drop cascades to ...`** notices during teardown are correct: the schemas own
  the tables and the function, so dropping them cascades by design.

### Result — local instance, 26 August 2026

| Capability | Result |
|---|---|
| 1 · four extensions install | **PASS** — vector 0.8.6, btree_gist 1.7, pg_trgm 1.6, pgcrypto 1.3 |
| 1b · `EXCLUDE USING gist` rejects an overlap | **PASS** — `exclusion_violation` raised |
| 2 · six roles | **PASS** |
| 3 · two schemas, different owners | **PASS** |
| 4a · `REVOKE` holds against the app role | **PASS** — `insufficient_privilege` |
| 4b · `SECURITY DEFINER` callable, returns ciphertext | **PASS** — 78 bytes, never plaintext |
| 4c · the read wrote its access-log row | **PASS** — `actor_role=SELLER_OWNER` |
| 5 · RLS filters and fails closed | **PASS** — 3 rows filtered to 2 / 1 / 0 |
| teardown | **PASS** — nothing left behind |

**This is a local Docker baseline, not provider verification.** It establishes
that the probe is correct and that the reference image passes it. Render,
DigitalOcean and AWS RDS each need their own run on a trial instance, recorded
below when they happen.

> ### [!] The 2026-08-26 baseline establishes LESS than that (T23, D-297)
>
> It was run as a **superuser**, and a superuser is the one principal for which
> this probe cannot fail. Run as a non-superuser `CREATEROLE` role — which is
> what every managed provider gives you — the probe **aborts at capability 3**:
>
> ```
> probe.sql:161  ERROR:  must be able to SET ROLE "probe_app"
> ```
>
> PostgreSQL 16 split role membership into ADMIN, INHERIT and SET.
> `createrole_self_grant` defaults to empty, so a `CREATEROLE` role that creates
> a role gets `admin_option=t` but **`set_option=f`** — and
> `CREATE SCHEMA ... AUTHORIZATION` requires SET. The same abort happens on the
> local container under a non-superuser, so **it is not a provider property**.
>
> **The precondition on line 61 below is therefore wrong.** "A superuser, or a
> role with CREATEROLE and CREATE on the database" is *not* sufficient on
> PostgreSQL 16+. The real requirement is that the role can **SET ROLE to every
> `AUTHORIZATION` target**, which a bare `CREATEROLE` role cannot do by default.
>
> **And it is not only line 161.** `SET ROLE` at lines 193, 255 and 322 fails the
> same way, so capabilities 4a, 4b and 4c would not run even if 161 were patched;
> `DROP OWNED BY` in the teardown fails too. **The same four constructs run
> through `db/migrations/` — including 86 `ALTER ... OWNER TO` statements across
> 24 files — so this is a finding about the schema's DDL path, not only about the
> probe.** D-297 carries the full analysis and the open rulings.
>
> ### THE PRECONDITION, CORRECTED — and Render PASSES it
>
> A second Render instance was provisioned with one statement, run once as the
> managed role against its own database:
>
> ```sql
> ALTER ROLE CURRENT_USER SET createrole_self_grant = 'set, inherit';
> ```
>
> It is permitted on managed Postgres, it persists across reconnects, and the role
> stays `rolsuper=f` / `is_superuser=off` throughout. The probe then ran **end to
> end as a non-superuser: 8 of 8, exit 0, `TEARDOWN PASS`.** So **capabilities 3,
> 4a, 4b, 4c and 5 are VERIFIED on Render** — the answer S18's "mandatory
> verification before any commitment" was asking for.
>
> **`'set'` alone is NOT sufficient — measured, not assumed.** With
> `createrole_self_grant = 'set'` the probe reaches 4b and then fails at line 290,
> `permission denied for schema probe_financial`: capability 4c does `RESET ROLE`
> and verifies the access-log row **as the outer role**, which needs INHERIT. So
> `inherit` is load-bearing for *this probe's verification step*, while `set` is
> what the blocking DDL construct itself requires — a distinction worth keeping,
> because a real migrating role would satisfy the second with an explicit grant
> rather than by inheriting a boundary owner's privileges.
>
> **This does not clear the migrations.** The probe proves the INSTANCE supports
> the shapes. `db/migrations/` has three further constructs, and at least one —
> `0023:510`, which needs `adulis_migrate` to hold CREATE on schema `financial`
> where `0023:499` grants only USAGE — is untouched by this GUC by inspection.
> D-297 stays open.
>
> ### STEPS 2 AND 3 ARE NOW GREEN ON RENDER (T23, D-300)
>
> Run on a third instance with **only `adulis_migrate` provisioned** and migration
> 0001 left to create the other five roles:
>
> **All fifty migrations applied as a non-superuser.** `node-pg-migrate ... up`
> exit 0, 117 tables, ten schemas with the correct owners, and **`pnpm db:check`
> 16 PASS / 0 PENDING / 0 FAIL** against the result.
>
> Which half of the GUC each failure needs, decomposed over four runs:
>
> | `createrole_self_grant` | result |
> |---|---|
> | `set, inherit` | **50/50 PASS**, `db:check` 16 PASS |
> | `set` only | fails in 0001, `permission denied for schema verification` -> needs **INHERIT** |
> | `inherit` only | fails in 0001, `must be able to SET ROLE "adulis_verification"` -> needs **SET** |
> | neither | fails in 0001, SET is reached first |
>
> **Both halves are required and both bite inside migration 0001** -- SET for
> `CREATE SCHEMA verification AUTHORIZATION` at 0001:86, INHERIT for creating the
> Appendix A enum types inside that schema. Line 85 succeeds because a role can
> always set-role to itself, which is also why the 68 `OWNER TO adulis_migrate`
> statements were never at risk.
>
> **One failure needs neither, and nothing in the repo anticipates it:**
> `CREATE TABLE "public"."pgmigrations"` -> `permission denied for schema public`,
> raised **before migration 0001 is read**. PostgreSQL 15+ revoked PUBLIC's CREATE
> on schema `public`. It needs `GRANT CREATE ON SCHEMA public TO adulis_migrate`.
>
> **The five-step contract, as measured:** owner creates `adulis_migrate` with
> LOGIN and CREATEROLE; `GRANT CREATE, CONNECT ON DATABASE`; `GRANT CREATE ON
> SCHEMA public`; `ALTER ROLE adulis_migrate SET createrole_self_grant = 'set,
> inherit'`; **and do NOT create the other five roles** -- pre-creating them
> leaves the GUC inert and breaks the deploy silently.
>
> **Step 3's blocker is also stale.** This file says `db:check` prints "0 checks
> present (pre-v1.7)". It is 16 checks now, and they pass.

### Render transcript — 2026-09-04, 8 of 8, non-superuser

From a pristine second trial instance with `createrole_self_grant = 'set, inherit'`
on the managed role and nothing else changed. 130 lines, the same length as the
local baseline above; it differs only in the `psql:` line-number prefix and in
`vector 0.8.0` against the local `0.8.6`.

```text
Timing is off.

=== ADULIS PROVIDER CAPABILITY PROBE ===
Disposable test DDL. Everything created here is dropped at the end.

psql:/tmp/probe.sql:55: NOTICE:  schema "probe_financial" does not exist, skipping
DROP SCHEMA
psql:/tmp/probe.sql:56: NOTICE:  schema "probe_core" does not exist, skipping
DROP SCHEMA
DROP TABLE
psql:/tmp/probe.sql:57: NOTICE:  table "probe_exclude_check" does not exist, skipping
DO
--- 1. Extensions ---
CREATE EXTENSION
psql:/tmp/probe.sql:77: NOTICE:  extension "vector" already exists, skipping
psql:/tmp/probe.sql:78: NOTICE:  extension "btree_gist" already exists, skipping
CREATE EXTENSION
psql:/tmp/probe.sql:79: NOTICE:  extension "pg_trgm" already exists, skipping
CREATE EXTENSION
psql:/tmp/probe.sql:80: NOTICE:  extension "pgcrypto" already exists, skipping
CREATE EXTENSION
 extension  | version | result 
------------+---------+--------
 btree_gist | 1.7     | PASS
 pg_trgm    | 1.6     | PASS
 pgcrypto   | 1.3     | PASS
 vector     | 0.8.0   | PASS
(4 rows)

psql:/tmp/probe.sql:98: NOTICE:  CAPABILITY 1 PASS: all four extensions installed
DO
CREATE TABLE
INSERT 0 1
psql:/tmp/probe.sql:125: NOTICE:  CAPABILITY 1b PASS: EXCLUDE USING gist rejected the overlap (exclusion_violation)
DO

--- 2. Six roles ---
CREATE ROLE
CREATE ROLE
CREATE ROLE
CREATE ROLE
CREATE ROLE
CREATE ROLE
           role           | result 
--------------------------+--------
 probe_app                | PASS
 probe_financial_owner    | PASS
 probe_jobs               | PASS
 probe_migrate            | PASS
 probe_readonly           | PASS
 probe_verification_owner | PASS
(6 rows)

DO

--- 3. Two schemas, different owners ---
psql:/tmp/probe.sql:153: NOTICE:  CAPABILITY 2 PASS: six independent roles created
CREATE SCHEMA
CREATE SCHEMA
     schema      |         owner         | result 
-----------------+-----------------------+--------
 probe_core      | probe_app             | PASS
 probe_financial | probe_financial_owner | PASS
(2 rows)

psql:/tmp/probe.sql:180: NOTICE:  CAPABILITY 3 PASS: probe_core owned by probe_app, probe_financial owned by probe_financial_owner
DO

--- 4. REVOKE holds; SECURITY DEFINER crosses ---
SET
CREATE TABLE
CREATE TABLE
INSERT 0 1
REVOKE
REVOKE
REVOKE
REVOKE
CREATE FUNCTION
GRANT
GRANT
GRANT
RESET
SET
DO
psql:/tmp/probe.sql:264: NOTICE:  CAPABILITY 4a PASS: direct SELECT denied (insufficient_privilege)
psql:/tmp/probe.sql:277: NOTICE:  CAPABILITY 4b PASS: SECURITY DEFINER callable by probe_app; returned 78 bytes of ciphertext (never plaintext, R15)
DO
RESET
psql:/tmp/probe.sql:290: NOTICE:  CAPABILITY 4c PASS: the read wrote its access-log row, actor_role=SELLER_OWNER
DO

--- 5. RLS on a transaction-local setting ---
CREATE TABLE
INSERT 0 3
ALTER TABLE
ALTER TABLE
CREATE POLICY
GRANT
GRANT
SET
DO
psql:/tmp/probe.sql:347: NOTICE:  CAPABILITY 5 PASS: RLS filtered 3 rows to 2 (SELLER_OWNER), 1 (COURIER), 0 (unset)
RESET

--- Teardown ---
DROP TABLE
psql:/tmp/probe.sql:358: NOTICE:  drop cascades to 3 other objects
DETAIL:  drop cascades to table probe_financial.secret_ledger
drop cascades to table probe_financial.access_log
drop cascades to function probe_financial.read_secret(bigint)
DROP SCHEMA
psql:/tmp/probe.sql:359: NOTICE:  drop cascades to table probe_core.scoped_order
DROP SCHEMA
DROP OWNED
DROP OWNED
DROP OWNED
DROP OWNED
DROP OWNED
DROP OWNED
DROP ROLE
DROP ROLE
DROP ROLE
DROP ROLE
DROP ROLE
DROP ROLE
DO

=== PROBE COMPLETE — all capabilities passed ===

psql:/tmp/probe.sql:384: NOTICE:  TEARDOWN PASS: no probe_ roles or schemas remain
```

### Provider runs

| Date | Provider | Instance | Result | Run by |
|---|---|---|---|---|
| 2026-08-26 | Local Docker | `pgvector/pgvector:pg17` (PostgreSQL 17.11) | **PASS** (8 of 8) — *as a SUPERUSER; see below* | Tier 0 bootstrap |
| **2026-09-04** | **Render (Frankfurt)** | Managed PostgreSQL **17.11**, trial | **FAIL (3 of 8)** — aborted at capability 3, `must be able to SET ROLE` | T23 Phase 1 |
| **2026-09-04** | **Render (Frankfurt)** | Managed PostgreSQL **17.11**, second trial instance | **PASS (8 of 8)** — after provisioning `createrole_self_grant`; see the precondition above | T23 Phase 1 |
| — | DigitalOcean (Frankfurt) | — | *not yet run* — fallback 1 | — |
| — | AWS RDS | — | *not yet run* — fallback 2 | — |
