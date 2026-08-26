# `db/checks` — ADU-DB-01 v1.8 Appendix C, as fifteen executable checks

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

## Two places this harness is deliberately stronger than Appendix C's literal text

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
`adulis_app` in `verification` and `financial`. **Recorded for amendment in
ADU-DB-01 v1.9.**
