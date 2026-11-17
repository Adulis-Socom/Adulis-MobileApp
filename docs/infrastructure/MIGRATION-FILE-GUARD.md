# Migration-file guard

Applies to: any database that must not be upgraded from an unverified set of migration files, above
all a persistent one. Script: `ops/scripts/migration-guard.mjs`. Pin: `ops/migrations.manifest.json`.
Tests (gate `migration-guard`): `ops/scripts/migration-guard.test.mjs`.

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

```
pnpm db:migration-guard                      # directory against the pin
pnpm db:migration-guard --db                 # also the database history (DATABASE_URL_MIGRATE)
pnpm db:migrate:guarded --dry-run --expect-commit <sha>   # every check, no runner
pnpm db:migrate:guarded --expect-commit <sha>             # every check, then node-pg-migrate up
```

`pnpm db:migrate` is unchanged and unguarded (CI and local development use it on fresh databases). A
persistent database is upgraded with `db:migrate:guarded`.

The command line is strict. An unknown or repeated flag, a flag without its value, and an `up` without
`--expect-commit <sha>` (or an explicit `--no-source-check`, for a throwaway database) are refusals with
exit 2, never defaults: a typo such as `--dryrun` must not turn a dry run into a real apply.

## Adding a migration

A new migration is pinned in the same change: `node ops/scripts/migration-guard.mjs write`, then commit the
manifest. A test fails if `db/migrations` and the manifest disagree. `write` pins ADDED files only. A missing,
renamed or changed historical file is refused and is never re-pinned; changing history means editing the
manifest by hand, which then shows in review. Migrations are never rewritten.

## Limits

- It does not make the plain `pnpm db:migrate` safe; it makes the guarded path safe.
- It pins contents, not behaviour: a pinned migration is still applied as written.
- A restore is the only way back from an applied migration (the down migrations raise); the guard does not change that.
