# `db/checks` — ADU-DB-01 v1.9 Appendix C, as sixteen executable checks

Run with `pnpm db:check`. Each check is one file so a reviewer can read one
check without reading the harness.

## Three states, and why the third exists

Most of these checks guard objects that do not exist yet. A binary harness would
print nine failures at Tier 1 and drown the two that are real.

| State | Meaning |
|---|---|
| `PASS` | The check ran and the invariant holds |
| `FAIL` | The check ran and the invariant is broken — **stop** |
| `PENDING` | The check's objects belong to a later tier. Not run, not a failure |

`pnpm db:check` exits non-zero **only on `FAIL`**.

## `CURRENT_TIER`

Holds the tier the repository has reached. Each check declares `liveAtTier`; the
harness runs it when `CURRENT_TIER >= liveAtTier` and reports `PENDING` otherwise.
It is a file rather than an inference so that "why is this PENDING" has an answer
a reviewer can read, and so that raising the tier is a reviewed one-line diff.

## Where this harness is deliberately stronger than Appendix C's literal text

Both are recorded because a check that diverges silently from its specification
is worse than no check.

**Comments are stripped before grepping.** Appendix C says the checks run
"against generated DDL". A raw grep cannot tell DDL from a comment about DDL, and
migration 8 will carry a comment reading *"never a `MATERIALIZED VIEW`"* — which
a literal check 15 would fail on. `_lib.mjs` removes comments and keeps
everything executable, including dollar-quoted function bodies.

**Check 10 queries privileges rather than grepping for `GRANT`.** Appendix C
writes it as `grep -E "GRANT .* ON SCHEMA (verification|financial) .* adulis_app"`
= 0. That is unsatisfiable by a working system: PostgreSQL requires `USAGE` on a
schema before any role may call a function in it, so
`GRANT USAGE ON SCHEMA verification TO adulis_app` is mandatory for
`read_attestation` to be callable at all — verified empirically, see the Tier 1
report. `USAGE` conveys no data access; the boundary is the absence of *table*
privileges. This check therefore asserts what the boundary actually is: zero
table, column, sequence or routine-other-than-the-named-function privileges for
`adulis_app` in `verification` and `financial`.

> **ADOPTED IN v1.9.** This was reported at the end of the previous Tier 1
> session and is now defect **D7** in the document: *"check 10 was unsatisfiable
> as written, and this is the correction... The invariant that actually matters:
> `adulis_app` holds `USAGE` on both schemas and `EXECUTE` on the four named
> functions, and no privilege on any table within them."* The check no longer
> diverges from Appendix C — Appendix C moved.

**Check 15 greps `db/migrations/`, never `db/`.** Also adopted in v1.9, which
now writes the check as *"`db/migrations/` only, never `db/`, or it matches the
check file whose job is to forbid it"*. The Tier-0 CI step that grepped all of
`db/` was retired for the same reason; see `.github/workflows/ci.yml`.

**Check 16 compares schema-qualified names, and compares values too.** New in
v1.9 (defect D6). Appendix C writes the query as
`SELECT typname FROM pg_type WHERE typtype='e'`, and `platform` exists in **both**
`core` and `waitlist` — so the literal query reports a duplicate that is not one,
and could mask a genuinely missing type behind a name that happens to exist in
another schema. The check compares `nspname.typname`. It additionally compares
each type's **values**, because a type whose name is right and whose values are
wrong is the likelier defect and the harder one to see: `session_audience` losing
`CONSOLE` would pass a name-only check. Names and values are reported as
separately-named failures so the two are never confused.

## The fixture is the specification

`fixtures/appendix-a.json` is Appendix A transcribed, and it is what check 16 and
the migration-01 test suite both compare the live database against. Reading the
catalogue out of the database and comparing it to itself would prove nothing —
the same point work order T1 §6 makes about the permission seed.

Its `_conflicts` block records the six enum types that v1.9's Appendix A defines
**twice and differently**. v1.9's D6 asserts that v1.8 was "a core-only catalogue"
whose non-core types were "absent"; v1.8 in fact carried an *Other schemas* table
of eleven, which v1.9 reproduces unchanged and then contradicts with an appended
block of seven it labels *"provisional until check 16 has run green once"*. The
carried-forward table governs here. Check 16 has now run green once — so the
appended block is what needs correcting, and that is a v1.10 item.
