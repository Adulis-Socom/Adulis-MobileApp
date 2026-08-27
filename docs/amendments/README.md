# What governs, and where each part of it lives

Read this before `docs/`.

## Current versions

| Document | Governs at | In `docs/`? |
|---|---|---|
| **ADU-DB-01** | **v1.10** — absorbs amendments A1 and A2 | ⚠ **no** — see below |
| **ADU-AUTH-01** | **v2.4** | ⚠ **no** — see below |
| **ADU-API-01** | **v1.6** | ⚠ **no** — see below |
| **ADU-VAL-01** | **v1.0** | ✅ [`docs/registers/`](../registers/) |
| §16.2a, the permission seed | v2.4, unchanged from v2.3 | ✅ [`ADU-AUTH-01_v2_4_permission_seed.sql`](ADU-AUTH-01_v2_4_permission_seed.sql) |

**Amendments A1 and A2 no longer govern.** Both are absorbed into ADU-DB-01
v1.10 §0.1 and are in `_superseded/`. So is the v2.3 §16 split file, which v2.4
replaces.

## ⚠ Three documents are not installed, and this is what to do about it

**ADU-DB-01 v1.10, ADU-AUTH-01 v2.4 and ADU-API-01 v1.6 were supplied
in-session, and the copies available carry transit damage in their prose** —
every three-byte UTF-8 glyph lost its trailing bytes, the same corruption v2.3
was written to defeat. Writing them out from those copies would put ~300 KB of
damaged text into `docs/` and enshrine it.

> **To finish: drop the UTF-8 originals of the three into `docs/`.** Nothing
> else is needed — the superseded versions are already moved out, and no path in
> this repository points at them.

**The build did not need them on disk, and here is why that is true rather than
convenient.** The load-bearing content of both reissues is **ASCII by
construction** and *is* installed and machine-checked:

| What | Where | Checked by |
|---|---|---|
| The 42 permissions and 139 grants | [`ADU-AUTH-01_v2_4_permission_seed.sql`](ADU-AUTH-01_v2_4_permission_seed.sql) | `pnpm verify:permission-doc` and `permission-matrix.spec.ts`, over all 252 cells in both directions |
| Appendix A, all 66 enum types | [`db/checks/fixtures/appendix-a.json`](../../db/checks/fixtures/appendix-a.json) | Appendix C **check 16**, against `pg_type` in both directions, every CI run |
| Appendix B, the 109-table manifest | Appendix C **check 14** | live from Tier 2 |
| Every column, constraint and function | the migration that transcribes it, citing its section in the header | Appendix C, and the integration suites |

Every migration header names the document, version and section it transcribes.
A reader asking *"where did this column come from"* has the answer in the file.

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

## What Tier 1 found, and what came back

Three sessions produced three reissues, and the pattern is worth keeping:

| Reported | Became |
|---|---|
| The step-up `CHECK` was an enumeration and had drifted, leaving three of eight unconstrained | **D1** — `requires_step_up` is a column and the constraint is total |
| Appendix C check 10 forbade the `USAGE` its own design requires | **D7** — restated as a privilege query |
| Check 15 matched the file whose job is to forbid the phrase | scoped to `db/migrations/` |
| v2.2's matrix arrived with 252 cells collapsed to one glyph; the seed was refused rather than guessed | **v2.3** — ASCII table plus generated SQL, and **§16.6**: a two-form rule is only a check if something compares the forms |
| The *"of which write"* column did not reproduce and *write* was never defined | **R30** — the column is withdrawn |
| A suspended team member kept every permission for up to seven days | **R28** — suspension is an authorization gate, not only an authentication one |
| `no_data_found` is `P0002`, and a deliberate denial shared `42501` with a misconfigured grant | **R29** — `U0001` and `U0002` |
| Seven tables described in prose and never given columns | **v1.10 §5.5, §5.2, §7.1** and the C-series |

**The one that did not come back is worth naming too.** A1.1 withdrew a
correction I had reported as wrong, and confirmed the original: v1.8's Appendix
A always held 66 types, and migration 01 had been built from it. A check that
compares a document to a database cannot catch an error the two share — what
caught this was that the two versions of Appendix A disagreed with *each other*,
and the earlier one was reported rather than reconciled.

## Where the register lives

`docs/build-status/TIER-1-SPEC-GAPS.md` — rewritten at the close of Tier 1.
