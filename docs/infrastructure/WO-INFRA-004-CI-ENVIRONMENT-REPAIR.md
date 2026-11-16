# WO-INFRA-004 -- CI environment and gate reliability repair

**Status: COMPLETE.** 13 November 2026.

## 1. Work order
WO-INFRA-004, CI environment and gate reliability repair.

## 2. Objective
- Fix the seed's environment contradiction without weakening any environment guard.
- Make it impossible for mandatory checks to select nothing and pass.

## 3. Investigations performed
- Read `gates.mjs`, `seed.mjs`, `db-reset.mjs`, `db-determinism.mjs`, `verify-console-e2e.mjs`, the root
  scripts and `ci.yml`.
- Traced `NODE_ENV` from `.env`, through `gates.mjs`, `pnpm` and `--env-file-if-exists`, to each script.
- Read the CI logs of runs 34129602933 (main) and 34147378670 (branch).
- Probed what `pnpm list` prints for an empty selection: `[]`, exit 0.

## 4. Confirmed findings

**AUD-003 (ISSUE-INFRA-003).**
- `gates.mjs` drops `NODE_ENV=development`, and CI sets none.
- `seed.mjs` allows only development or test.
- In CI the seed therefore refused (`NODE_ENV=unset`) and gate `migrate` went red on main from
  2026-09-07. Locally it passed only because `pnpm db:seed` re-reads `.env`.
- A gate's `steps` could not carry an environment. `determinism` and `console-e2e` had already been
  fixed the same way, one level up.

**AUD-004 (ISSUE-INFRA-004).** With `ADULIS_SCOPE_FILTER='...[origin/main]'`:
- **On a push to main** the base is the commit itself, so `typecheck`, `build` and `test` printed "No
  projects matched the filters" and exited 0. The three console-dist gates then passed as "not
  selected".
- **On a branch that changes only root files** (CI, `ops/`, `db/migrations`, `tsconfig.base.json`, the
  lockfile) the same thing happened. Those files belong to the excluded root project.
- **A migration-only change never ran the API suites,** which are what test the database functions.
- An unmerged commit, `810fb27` on `ci/scope-filter-main-push`, covers only the main-push case, and does
  it in the workflow.

## 5. Root causes
- **AUD-003:** a gap in the runner's data model (no per-step environment).
- **AUD-004:** pnpm treats an empty selection as success; scoping is by package directory only.

## 6. Files inspected
As in section 3.

## 7. Files modified
**`ops/scripts/gates.mjs`:**
- The `migrate` gate's seed step is `{ cmd: ['pnpm', 'db:seed'], env: { NODE_ENV: 'test' } }`. Only that
  step declares an environment.
- The step runner accepts `{ cmd, env }`.
- `scopeDecision()` and `resolveScope()` drop the scope, and print why, when either of these holds:
  - a changed file is outside `apps/` and `packages/` and is not documentation (`docs/`, `*.md`,
    `.claude/`);
  - the filter selects no package.
- An appended gate, `gate-runner`, runs the tests.
- The list runs only when the file is executed as a script, so the test can import it.

**`ops/scripts/gates.test.mjs` (new):** 10 tests, 13 after the review hardening (`bac327a`); see `WO-INFRA-004-GATE-REGRESSION-TESTS.md`.

`seed.mjs`, `db-reset.mjs`, `db-determinism.mjs` and `verify-console-e2e.mjs` are **unchanged**: every
guard still refuses unset, production and staging.

## 8. Verification commands
- `node --test ops/scripts/gates.test.mjs`;
- `node ops/scripts/gates.mjs --only migrate` on the disposable database;
- the seed run directly with `NODE_ENV` unset, `production` and `staging`;
- the mutation script `mutate-gates.cjs`;
- CI runs 43320430973 and 43321921280.

## 9. Actual results
- **10 of 10 tests pass**, and all five mutations are killed (`logs/gate-runner-mutation.log`). After the review: 13 of 13, and 10 of 10 mutations killed (`gate-runner-mutation-2.log`).
- **Seed guards** (`logs/aud-003-seed.log`): unset, `production` and `staging` each refuse with exit 2.
  The fixed gate passes and creates the SEED market.
- **CI run 43320430973:**
  - The banner read `scope: UNSCOPED - 28 changed root input(s), e.g. .env.example, .gitattributes,
    .github/workflows/ci.yml`.
  - Gate `migrate` (with the seed) passed in CI for the first time since 2026-09-04.
- **Production React build:**
  - CI does not set `NODE_ENV`, and the build gates still inherit it.
  - The `production-react` and `no-unsafe-eval` gates pass locally.
  - `console-e2e` builds explicitly with `NODE_ENV=production`, and passed locally.
- **Push and pull-request behaviour:**
  - Push was verified in CI on this branch.
  - A pull request uses the same filter against `origin/main`, so the same decision applies. It is
    covered by the unit tests; no pull request was opened (the batch does not merge).

## 10. Security assessment
- **No guard was weakened.** `NODE_ENV=test` is set for one step only.
- **`db:migrate` and the build gates still inherit,** so a deliberate `NODE_ENV=production` still reaches
  every guard that checks it.
- **`db-reset` still refuses non-local hosts.**

## 11. Regression assessment
- **Local runs:** unchanged; no scope filter means a full run, as before.
- **CI on branches:** runs everything when root inputs changed. That is slower, and intended.
- **CI on main:** now runs everything. `810fb27` would do the same in the workflow; both can coexist.
- **Gate list:** append-only rule kept (`gate-runner` appended); no gate was renumbered.

## 12. Issues encountered
ISSUE-INFRA-003, 004, 012.

## 13. Issues resolved
ISSUE-INFRA-003, 004.

## 14. Issues remaining
ISSUE-INFRA-012: `810fb27` and the uncommitted `ci.yml` edits in the other checkout overlap this file.
Reconcile them at merge.

## 15. Founder decisions required
None blocking. ADU-REPO-01 S7's scoping intent is kept for app-only changes.

## 16. Commit SHA
`bbbadac`

## 17. Final status
**COMPLETE.**

## Addendum (WO-INFRA-006 review, `bac327a`)

The independent review found fail-open paths in this work order's own changes. All are fixed:
- the main guard could run nothing through a junction (ISSUE-INFRA-018);
- `docs/` was exempt although a suite reads `docs/amendments/*.sql` (ISSUE-INFRA-019);
- the gate environment overrode a deliberate `NODE_ENV` (ISSUE-INFRA-020).

It also found two pre-existing ones, both fixed:
- `--only` with a typo passed with zero gates (ISSUE-INFRA-021);
- a scoped run assumed the console was "not selected" without checking (ISSUE-INFRA-022).

The regression tests and mutation results above include them.
