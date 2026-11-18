# Migration-file guard

Applies to: any database that must not be upgraded from an unverified set of migration files, above
all a persistent one. Script: `ops/scripts/migration-guard.mjs`. Pin: `ops/migrations.manifest.json`.
Tests (gate `migration-guard`): `ops/scripts/migration-guard.test.mjs` (the checks) and
`ops/scripts/migration-default-path.test.mjs` (the ordinary command and every other way the repository
migrates run the guard).

## Why

`node-pg-migrate` applies whatever the migrations directory holds and records only names. A file that
is missing from the middle of the sequence is never noticed: the runner applies the others, exits 0, and
the database reaches a version whose schema nobody reviewed. A renamed, duplicated or edited file is not
noticed either.

## What it checks (all before anything is applied; the first problem refuses)

1. The directory holds exactly the pinned files: none missing, none unexpected, no duplicate number, no rename.
   `.gitkeep` is the only other entry allowed.
2. Every file's bytes equal the pinned sha256 (no unreviewed edit of a historical migration).
3. The pinned list is a clean sequence 0001..N.
4. With `--expect-commit <sha>`: the checkout is that commit, and `db/migrations` and the manifest are exactly
   as committed (no local edit, no untracked file).
5. The database history (`pgmigrations`) is exactly the first N pinned names, in order: no unknown, skipped,
   re-ordered or future version. `up` always reads it (read-only session); `verify --db` reads it on request.
   A missing `pgmigrations` table is an empty history; any other read error refuses.

If a check fails, the runner is not started. Nothing is applied.

## Use

The ordinary command is the guarded one:

```
pnpm db:migrate                                 # checks 1, 2, 3 and 5, then applies what is pending
pnpm db:migrate --dry-run                       # the same checks, nothing applied
pnpm db:migrate:guarded --expect-commit <sha>   # all five checks (the source check too), then applies
pnpm db:migration-guard                         # directory against the pin, no database
pnpm db:migration-guard --db                    # also the database history (DATABASE_URL_MIGRATE)
pnpm db:migration-pin                           # pin newly added migrations (see Adding a migration)
```

`pnpm db:migrate` is `migration-guard.mjs up --no-source-check`. It is the command for development
databases, the disposable pair (`test-db.sh`, `db:reset`, `db:determinism`), CI and the deploy pre-deploy
step: none of those has a clean commit to compare, and a deploy may have no git directory at all.
A persistent or shared database being upgraded to a reviewed release uses
`pnpm db:migrate:guarded --expect-commit <sha>` with the commit that was reviewed.

The target is `DATABASE_URL_MIGRATE`, from the environment or from `.env` (the scripts load it with
`--env-file-if-exists=.env`), and nothing else: there is no default host or database, and the command
refuses if the variable is not set. It upgrades whatever that variable names, so a `.env` that points at a
persistent database makes `pnpm db:migrate` upgrade that database, now only ever from the pinned set.
Before it reads anything it prints `target: host:port/database` (never the credentials), so a run against
an unintended database is visible at once.

The command line is strict. An unknown or repeated flag, a flag without its value, and an `up` without
`--expect-commit <sha>` or an explicit `--no-source-check` are refusals with exit 2, never defaults: a typo
such as `--dryrun` must not turn a dry run into a real apply, and the two source rules exclude each other.

## Every way a migration runs

| Way | Guarded by |
|---|---|
| `pnpm db:migrate` | the guard, `up --no-source-check` |
| `pnpm db:migrate:guarded --expect-commit <sha>` | the guard, `up` with the source check |
| CI: the "Migrations apply" step and the `migrate` gate | `pnpm db:migrate` |
| `bash ops/scripts/test-db.sh up` (the disposable pair) | `pnpm db:migrate` |
| `pnpm db:reset` | `pnpm db:migrate` |
| `pnpm db:determinism` (two scratch databases) | the guard, with the scratch URL as `DATABASE_URL_MIGRATE` |
| the deploy blueprint's pre-deploy command (`ops/render.yaml`, `ops/runbooks/deploy.md`) | `pnpm db:migrate` |
| `pnpm worker:install` | not guarded, and not `db/migrations`: it installs the job queue library's own tables (schema `jobs`) |
| `db/init/*.sql` | not guarded, and not `db/migrations`: extensions and local logins on the first start of an empty local data directory |

`node-pg-migrate` is started by the guard and by nothing else in the repository: no package script,
workflow, runbook or script names it, and `migration-default-path.test.mjs` fails if one does. The
migrations are hand-written SQL files with no down section, so nothing needs the runner's `create` or
`down`. Running node-pg-migrate directly (its binary in `node_modules`, `pnpm exec`, `npx`) skips every
check above and is not a way to migrate this repository; a file in the repository cannot stop a person from
starting a program that is installed on their machine.

## Adding a migration

1. Write `db/migrations/NNNN_name.sql`, the next number, as hand-written SQL.
2. Pin it in the same change: `pnpm db:migration-pin`, then commit `ops/migrations.manifest.json` with the
   migration.
3. Apply it to your development database with `pnpm db:migrate`.

Until step 2, `pnpm db:migrate` refuses with `UNEXPECTED file in the migrations directory: ... pnpm
db:migration-pin` and applies nothing; CI fails the same way (its "Migrations apply" step and the `migrate`
gate), and so does the `migration-guard` gate. `db:migration-pin` pins ADDED files only. A missing, renamed or
changed historical file is refused and is never re-pinned; changing history means editing the manifest by
hand, which then shows in review. Migrations are never rewritten.

## Limits

- It pins contents, not behaviour: a pinned migration is still applied as written.
- The plain command does not run the source check; a persistent database is upgraded with
  `pnpm db:migrate:guarded --expect-commit <sha>`.
- It cannot stop a direct run of the installed node-pg-migrate program (see above).
- A restore is the only way back from an applied migration (the down migrations raise); the guard does not change that.
