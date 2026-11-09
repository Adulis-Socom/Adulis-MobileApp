# WO-DISC-001A - Database governance sync and Scene foundation closure

Status: complete, pushed, awaiting founder review. Branch `discovery/wo-disc-001a-db-governance`,
from `8706a6fa2353348ba3487234baa1aa2beb153b4b` (the WO-DISC-001 head). No pull request, no merge,
`main` untouched. Part of the overnight batch of 10 November 2026; the morning register is
`docs/overnight/OVERNIGHT-ISSUES-2026-11-10.md`.

## 1. Why

WO-DISC-001 ended BLOCKED on one gate. Migration `0054_scene_posts.sql` added four tables
(`core.scene_post`, `core.scene_post_revision`, `core.scene_post_product`,
`core.scene_post_transition`). The installed ADU-DB-01 v1.19 Appendix B still printed `core` 90 and
116 tables, so `pnpm verify:appendix` compared the document with the database and failed (register
OVN-001, G-1). The founder authorised ADU-DB-01 v1.20 as a mechanical synchronisation.

## 2. What changed

| Item | Change |
|---|---|
| `docs/ADU-DB-01_Database_and_Data_Model_v1_20_ASCII.md` | New installed revision. Header (version, date, supersedes); new S0.1 recording the synchronisation; S30c summarising the four Scene tables in a few lines; Appendix B: **120 tables, `core` 94**, the four tables named. Appendix A unchanged (71 enum types). Every other section carried verbatim; the history sections renumbered 0.2 (v1.19) to 0.20 (v1.1) |
| `docs/superseded/ADU-DB-01_..._v1_19_ASCII.md` | v1.19, moved with `git mv` (history kept), the same convention as v1.16 at T24 |
| `ops/scripts/verify-docs-ascii.mjs` | The GOVERNED entry names v1.20 (the T24 edit). Nothing else |
| `ops/scripts/verify-appendix.mjs` | **Unchanged.** Since D-304 it resolves the newest installed revision, so it read v1.20 by itself; no count logic, exception or filter was touched |
| `.claude/reference/DOCUMENT_AUTHORITY.md`, `.claude/skills/adulis-spec-router/SKILL.md`, `docs/amendments/README.md`, `apps/api/CLAUDE.md` | Current-document references point at v1.20 |
| `apps/api/test/c1-onboarding.e2e.spec.ts` | Test-only date fix (section 4), separate commit |

The November 8 design pack was not touched (it does not own ADU-DB-01). No migration, function,
grant or Scene behaviour changed.

How Appendix B was produced: `pnpm generate:appendix` printed the manifest from `pg_class` on the
disposable database migrated 0001-0054 (`core` (94), "Total: 120 tables, 71 enum types"). The
installed document keeps its established form (a per-schema count table, the "**N tables.**"
sentence and the named exceptions), which is the form `verify:appendix` parses; the generator's
full name list is a report, not the installed text.

Not done, deliberately: v1.19 itself recorded a one-line D-301 correction to S4.4b "at the next
revision". That is a substantive edit, not a manifest synchronisation, so v1.20 does not carry it
(register OVN-023).

## 3. Proof the gate was not weakened

`pnpm verify:appendix` against the database migrated 0001-0054:

```text
ADU-DB-01 v1.20 -- the appendices agree with what generated them
  PASS  Appendix A and the fixture agree on all 71 enum types, both directions
  PASS  Appendix B and the database agree: 120 tables across 9 schemas, per-schema and in total
  PASS  the five body-over-manifest tables Appendix B flags all exist
```

`git diff 8706a6f -- ops/scripts/verify-appendix.mjs` is empty: the same comparison that was red in
WO-DISC-001 is green now because the document changed, not the gate.

## 4. The baseline date test (OVN-020)

`c1-onboarding` "GET lists ascending from today" PUT an availability override for `2026-09-11` and
expected it first in a list that reads `override_date >= CURRENT_DATE`. Today is 2026-11-10, so the
list was empty: `TypeError: Cannot read properties of undefined (reading 'date')`, reproduced on the
current tree before the change, and at `40a4dce` on a fresh 0001-0053 database during WO-DISC-001.
Production behaviour is correct.

The test now derives the next 11 September still ahead of today (the "Enkutatash" closure the
fixture describes), which is always inside the 24-month bound the PUT enforces. No production code
changed. `c1-onboarding`: 37 of 37.

## 5. Validation

On the disposable database (`adulis_gates`):

| Check | Result |
|---|---|
| `pnpm verify:appendix` | pass (v1.20, 120 tables, 71 enum types) |
| `pnpm verify:docs` | pass |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | pass |
| `pnpm db:check` | 16 of 16 |
| `pnpm db:determinism` | pass |
| `pnpm --filter @adulis/api test` | **698 of 698** (46 suites): the first fully green API run since the date defect, including the Scene suite |
| console, mobile, api-client, config, locale, tokens tests | pass |
| `pnpm verify:orphan-sweep` (after the full suite) | pass |

## 6. WO-DISC-001 formal closure

```text
WO-DISC-001 initially BLOCKED by the governed Appendix B mismatch (G-1)
-> WO-DISC-001A reissued ADU-DB-01 as v1.20
-> verify:appendix green, with the gate unchanged
-> WO-DISC-001 formally closed
```

**WO-DISC-001 COMPLETE -- READY FOR FOR-YOU / DISCOVERY API**

The original WO-DISC-001 record is unchanged apart from a dated addendum note at its top pointing
here; its BLOCKED verdict stands as history.

## 7. Commits

| Commit | Content |
|---|---|
| `6cfd683` docs(db): install ADU-DB-01 v1.20, Appendix B synchronised with migration 0054 | v1.20, v1.19 superseded, the current-document references |
| `810b598` test(api): derive the c1-onboarding override date instead of 2026-09-11 | the test-only date fix |
| docs(discovery): close WO-DISC-001 and record WO-DISC-001A | this record, the WO-DISC-001 addendum note, the overnight register |
