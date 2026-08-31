# What governs, and where each part of it lives

## Current versions — all installed

| Document | Governs at | Where |
|---|---|---|
| **ADU-DB-01** | **v1.12** | [`docs/ADU-DB-01_..._v1_12.md`](../ADU-DB-01_Database_and_Data_Model_v1_12.md) |
| **ADU-AUTH-01** | **v2.5** | [`docs/ADU-AUTH-01_..._v2_5.md`](../ADU-AUTH-01_Authentication_and_Authorization_v2_5.md) |
| **ADU-API-01** | **v1.7** | [`docs/ADU-API-01_API_Contract_v1_7.md`](../ADU-API-01_API_Contract_v1_7.md) |
| **ADU-CON-02** | **v3.1** | [`docs/ADU-CON-02_..._v3_1.md`](../ADU-CON-02_Seller_Console_System_Design_v3_1.md) |
| **ADU-VAL-01** | **v1.1** -- a register, not a specification; S1.1 is machine-read and enforced (`pnpm verify:deferred-values`, the `deferred-values` gate of the one list) | [`docs/registers/`](../registers/) |
| The permission seed, §16.2a | v2.5, **unchanged from v2.3** — 42 codes, 139 grants | [`ADU-AUTH-01_v2_4_permission_seed.sql`](ADU-AUTH-01_v2_4_permission_seed.sql) |

**Installed at T5. The superseded copies are in [`docs/superseded/`](../superseded/)** rather than
deleted, because a register entry that cites "v1.10 §5.5" needs the text it cited.

> **[!] v1.11 was never installed here, and v1.12 is a complete document rather than a
> patch, so nothing is lost.** This repository governed at **v1.10 as amended by A3**;
> T5's table says v1.12 supersedes v1.11. A3's three rulings are all carried into v1.12's
> own §0.2 and §30, so the amendment is absorbed rather than dropped — but the jump is
> two revisions, not one, and it is recorded here rather than left for someone to notice.

**Amendments A1, A2 and A3 are all absorbed into the installed text** and cease to apply
separately. A3's history is retained below because the *reasoning* is not repeated in v1.12.

> **The three large documents were not installable until A3.5.** Every copy
> supplied in-session carried the same transit damage: three-byte UTF-8 glyphs
> losing their trailing bytes. A3.5 makes ADU specifications ASCII, ASCII copies
> were supplied, and they are now in `docs/`. `pnpm verify:docs-ascii` is the
> comparator that keeps them that way.

## AMENDMENT A3 — what it changed, and where it landed

A3 confirmed all three contradictions the CP-4 report raised. **All three were the
document's, and two of them ratified what the migrations already did.**

| | Ruling | Where it landed |
|---|---|---|
| **A3.1** | `fn_apply_stock_event` fires **`BEFORE INSERT`**, correcting §10.1's prose. Under `AFTER`, `RETURNING ... INTO NEW.resulting_count` is inert and **every stock event ships with NULL and nothing raises** | Already built that way — [`0008_stock_events...`](../../db/migrations/0008_stock_events_and_derived_count.sql) records the ruling |
| **A3.2** | The release index is **`UNIQUE (reservation_id, reason)`**, plus a **`CHECK` requiring the anchor** — a partial unique index does not constrain rows whose indexed column is NULL, so a release with a null `reservation_id` escapes it entirely | **Migration 09.** Recorded in 0008's §4 so the deferral cannot be lost |
| **A3.3** | **The standing gate raises `U0001`, not `U0002`.** Three cases, not two: never a member → 404; ever a member, not in good standing → 403 | [`0009_amendment_a3_standing_gate.sql`](../../db/migrations/0009_amendment_a3_standing_gate.sql) |
| **A3.4** | The four elided function bodies are **owed by v1.11** — correct not to build them | Logged, not lost |
| **A3.5** | **ADU specifications are ASCII.** §16.6's prose exemption is withdrawn | `pnpm verify:docs-ascii` |

**A3.3 landed as a new migration rather than an edit, and that is a departure
from what A3.6 asked for.** A3.6 says *"apply A3.3 in migration 05a, before
merge"* — but **05a had already merged**: work order T2 Task B directed it, and
PRs #1, #2 and #3 put migrations 01–06 on `main` in the previous session. A
migration is never edited after it merges, and editing 0005 in place would also
mean any database already carrying it never receives the fix, because
node-pg-migrate would not re-run a migration it has recorded. `CREATE OR REPLACE
FUNCTION` on an identical signature leaves every call site, grant and dependency
untouched.

**One addition to A3.3's body is this repository's, and it is flagged in the
migration.** `seller_team_member_live` is UNIQUE on `(seller_id, account_id)`
only `WHERE revoked_at IS NULL`, so a member revoked and later re-invited holds
**several rows** — and A3.3's lookup, which deliberately reads membership
*regardless of standing*, has no `revoked_at` filter to make it unique. A bare
`SELECT ... INTO` takes an arbitrary one, so a member in good standing could be
denied because the planner returned their old revoked row. An `ORDER BY` prefers
the live membership. **Reported for v1.11.**

## ADU-VAL-01 is a register. It governs nothing.

**It is never a build source**, and the distinction it exists to draw is between
a **column** (a schema decision, which ADU-DB-01 makes) and a **value** (a
business decision, which arrives later as a configuration row).

> **Its only operational use:** a value listed there as **OPEN** or **DEFAULT**
> is *deliberately* absent. **Do not report it as a spec gap, and do not invent
> one.**
>
> **A value missing from a document that does NOT appear in ADU-VAL-01 is still
> a gap — report it.**

`core.ladder_config`'s sixteen columns are the worked example: the columns are
named in ADU-DB-01 v1.10 §5.5 and built in migration 02; every value is
ADU-VAL-01 Group A, B or C and is deliberately unseeded. An unnamed column
blocks migration 8. An unseeded row blocks only the market seed, at Tier 4.

## What is checked mechanically, and by what

A rule nothing executes will drift. Each of these is a standing CI gate.

| Rule | Check |
|---|---|
| §16.2's matrix agrees with §16.2a's SQL, all 252 cells, both directions | `pnpm verify:permission-doc` — reads **v2.5** since T5 |
| Governed specifications are ASCII (A3.5) | `pnpm verify:docs-ascii` |
| Appendix A agrees with `pg_type`, both directions | Appendix C **check 16** |
| Appendix B's table manifest | Appendix C **check 14** (live from Tier 2) — **bidirectional since v1.12**, and the count is reconciled from the database rather than asserted |
| Eleven load-bearing absences | Appendix C checks 1–4, 6, 11, 15 |
| Every column, constraint and function | the migration that transcribes it, citing its section in its header |

## What Tier 1 and CP-4 found, and what came back

Four reissues and three amendments, and the pattern is worth keeping:

| Reported | Became |
|---|---|
| The step-up `CHECK` was an enumeration and had drifted, leaving three of eight unconstrained | **D1** — `requires_step_up` is a column and the constraint is total |
| Appendix C check 10 forbade the `USAGE` its own design requires | **D7** — restated as a privilege query |
| Check 15 matched the file whose job is to forbid the phrase | scoped to `db/migrations/` |
| v2.2's matrix arrived with 252 cells collapsed to one glyph; the seed was refused rather than guessed | **v2.3** — ASCII table plus generated SQL, and **§16.6** |
| Two forms with nothing comparing them | **v2.4 §16.6, second clause** — a comparator, as a CI gate |
| The *"of which write"* column did not reproduce and *write* was never defined | **R30** — withdrawn |
| A suspended team member kept every permission for up to seven days | **R28** — suspension is an authorization gate |
| `no_data_found` is `P0002`, and a deliberate denial shared `42501` with a misconfigured grant | **R29** — `U0001` and `U0002` |
| §10.1's prose said `AFTER`; its own body needed `BEFORE` | **A3.1** — prose corrected |
| §12.4's release index would silently not return stock on a multi-line order | **A3.2** — `(reservation_id, reason)` plus the `CHECK` |
| A suspended member was told the seller did not exist | **A3.3** — a suspended Admin is not a stranger |
| Three sessions of documents that could not be installed | **A3.5** — specifications are ASCII |

**The one that did not come back is worth naming too.** A1.1 withdrew a
correction I had reported as wrong, and confirmed the original: v1.8's Appendix
A always held 66 types, and migration 01 had been built from it. A check that
compares a document to a database cannot catch an error the two share — what
caught this was that the two versions of Appendix A disagreed with *each other*,
and the earlier one was reported rather than reconciled.

[!] **v1.10's Appendix A still carries the seven-type block A1.1 withdrew**, under
a note saying to treat it as provisional until check 16 runs green. Check 16 has
run green, against the 66-type catalogue, since Tier 1.
`db/checks/fixtures/appendix-a.json` is the governing transcription and records
the withdrawal. **Reported for v1.11.**

## Where the register lives

`docs/build-status/TIER-1-SPEC-GAPS.md`.
