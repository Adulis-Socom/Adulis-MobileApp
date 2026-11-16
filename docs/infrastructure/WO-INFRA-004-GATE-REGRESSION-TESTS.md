# WO-INFRA-004 -- Gate regression tests

The tests are in `ops/scripts/gates.test.mjs`. They run with `node --test ops/scripts/gates.test.mjs`
and as the appended gate `gate-runner`. They import `gates.mjs` with no scope filter, so the import
spawns nothing and needs no database.
- Tests 1 to 3 and 5 to 10 came with `bbbadac`.
- Tests 4 and 11 to 13 came with `bac327a`, after the independent review (ISSUE-INFRA-018 to 022).

## Tests

| # | Test | Guards against |
|---|---|---|
| 1 | The seed step, and only it, declares `NODE_ENV=test`; `db:migrate` and the gate as a whole declare none | AUD-003 returning; forcing the whole gate into test mode |
| 2 | `determinism` and `console-e2e` declare `NODE_ENV=test` | the same class in the other destructive gates |
| 3 | `typecheck`, `build` and `test` force no environment | a test-mode console build (production React must ship) |
| 4 | A gate's environment fills an unset `NODE_ENV` and never overrides `staging` or `production` | seeding or resetting an environment the caller named (ISSUE-INFRA-020) |
| 5 | No filter: full run | local behaviour |
| 6 | Nothing changed against the base (a push to main) runs everything, not zero packages | AUD-004, main |
| 7 | A root-only change runs everything: `ci.yml`, `ops/scripts/gates.mjs`, `db/migrations`, `pnpm-lock.yaml`, `tsconfig.base.json`, `docker-compose.yml`, and a non-Markdown file in `docs/` | AUD-004, root inputs; ISSUE-INFRA-019 |
| 8 | A root input beside a package change still runs everything | partial scoping after a migration |
| 9 | Package changes with Markdown or `.claude/` keep the scope and report the selected names | ADU-REPO-01 S7's scoping intent; ISSUE-INFRA-022 |
| 10 | Markdown only: the filter selects nothing, so everything runs | a silent empty selection |
| 11 | `git diff` failed, or pnpm could not evaluate the filter: full run | a missing base ref; pnpm output that is not JSON |
| 12 | Run as a script, `--list` prints every gate id | a main guard that runs nothing (ISSUE-INFRA-018) |
| 13 | `--only` with an unknown or empty id exits 2 and never prints "PASS all" | "PASS all 0 gates" (ISSUE-INFRA-021) |

## Results
- **Locally:** 13 of 13 pass.
- **CI 43321921280:** the earlier 10 pass (`# pass 10`).
- **The 13-test version** is verified in the CI run at `bac327a` (WO-INFRA-006 report).

## Mutation check (`logs/gate-runner-mutation-2.log`)

Each mutation reverts one fix in `gates.mjs`; the file was restored byte-identical after each run.
**Result: 10 of 10 killed.**

| Mutation | Failing tests |
|---|---|
| The seed step loses `NODE_ENV=test` | 1 |
| The whole gate is forced to test instead of the step | 1 |
| The gate environment overrides an explicit `NODE_ENV` | 1 |
| Root inputs no longer drop the scope | 2 |
| `docs/` exempt again | 1 |
| An empty selection keeps the scope | 2 |
| A pnpm failure keeps the scope | 1 |
| A failed `git diff` keeps the scope | 1 |
| The main guard never runs | 2 |
| `--only` with a typo passes zero gates | 1 |

The junction case itself was verified outside the test runner: through an NTFS junction to the checkout,
the committed guard printed 0 lines of `--list` and the fixed guard printed 30.

## Database-dependent verification
- **Disposable PostgreSQL** (`infra-gates-pg`):
  - `gates.mjs --only migrate,determinism,gate-runner` passes.
  - `NODE_ENV=staging` makes the seed refuse, and the gate fails.
  - `--only migrat` exits 2.
  - Log: `logs/post-review-recheck.log`.
- **CI:** gate `migrate` passes on a fresh service container (43320430973, 43321921280).
