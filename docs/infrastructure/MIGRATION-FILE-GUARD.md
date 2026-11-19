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

If a check fails, the runner is not started. Nothing is applied. Every refusal is written to stderr (progress
goes to stdout), so a caller that discards stdout, as `test-db.sh` does, still sees why.

## Use

The ordinary command is the guarded one:

```
pnpm db:migrate                                 # checks 1, 2, 3 and 5, then applies what is pending to a DISPOSABLE database
pnpm db:migrate --dry-run                       # the same checks and the classification, nothing applied, on any target
pnpm db:migrate:guarded --expect-commit <sha> --confirm-target=<database>@<host>:<port>
                                                # all five checks and the persistent-target rule, then applies
pnpm db:migration-guard                         # directory against the pin, no database
pnpm db:migration-guard --db                    # also the database history (DATABASE_URL_MIGRATE)
pnpm db:migration-guard --base <ref>            # the manifest only appends to the one committed at <ref>
pnpm db:migration-pin                           # pin newly added migrations (see Adding a migration)
```

`pnpm db:migrate` is `migration-guard.mjs up --no-source-check`. It is the command for the disposable pair
(`test-db.sh`, `db:reset` of a marked database, `db:determinism`), CI, and the native test harness: none of
those has a clean commit to compare, and every one of them has marked its database disposable first.

### Which database is this

Before the runner starts, `up` classifies the target (`classification:` line, after the `target:` line):

| Class | When |
|---|---|
| DISPOSABLE | the host is exactly `localhost`, `127.0.0.1`, `::1` or `[::1]`; the URL names its port, and the port is not the protected development port (5434); and a read-only query through the same URL finds the database comment `adulis:disposable-test-database` (or `adulis:disposable-test-database:setup`, which `test-db.sh` sets while it builds the pair) |
| PERSISTENT-DEV | the protected development port (5434, whatever host name or address is written and whatever the database says about itself: no mark is read or accepted there), or a loopback database that carries no disposable mark |
| UNKNOWN | everything else: a host that is not exactly a loopback name (an alias, an address, a machine name, a hosted database), a URL without an explicit port, or a mark that could not be read. UNKNOWN is never treated as disposable |

A DISPOSABLE target needs nothing more. **Any other target is applied to only with both of these**, on the command
line of that run (never from the environment or `.env`):

- `--expect-commit <sha>`: the full 40-character sha, equal to the checkout's HEAD, with no changed tracked file
  anywhere in the repository and `db/migrations` and the manifest clean (the source check). `pnpm db:migrate` skips it
  and so is refused: use `pnpm db:migrate:guarded`.
- `--confirm-target=<database>@<host>:<port>`, exactly the target of this run: the database from the URL, the host as
  written in the URL, the port the driver will use. It is the form `pnpm db:reset` already requires.

The authorization is appended to `.adulis-db-admin.log` (git-ignored) before anything is applied; a record that cannot
be written stops the run. A dry run is allowed on every target and only reports the classification and the command an
apply would need. When nothing is pending nothing is applied and nothing is needed. The refusal names the target, the
class, what is missing and the full command. `node ops/scripts/migration-guard.mjs authorize --expect-commit <sha>
--confirm-target=...` runs only this gate (exit 0 when an apply would be allowed). `db:reset` runs it, and `verify` (the
migration files against their pin), before it records or drops anything, for every kind of target, so the migration that
follows the drops cannot be refused after them; a persistent database is then migrated with the same two arguments.

Recommended routine for a persistent database: read the `target:` and `classification:` lines, run `pnpm db:migrate
--dry-run`, then upgrade it with `pnpm db:migrate:guarded --expect-commit <sha> --confirm-target=...` from a clean
checkout of the approved commit. A migration you are still writing is applied to a disposable pair first
(`bash ops/scripts/test-db.sh up`).

A deployment to a hosted database is UNKNOWN to this rule and has no commit or confirmation to give; until the
deploy command is changed deliberately, the pre-deploy step is refused.

The source check reads the checkout's OWN git metadata: the directory the guard lives in must be the top level of a git
repository. A directory with no `.git` of its own is refused even when it sits inside another repository (git would otherwise
walk up and judge it by that repository's HEAD), and `GIT_DIR`, `GIT_WORK_TREE` and the other variables that move git to another
repository are ignored. A hosted build that carries no git metadata (or no git) is refused with `SOURCE: cannot read the git HEAD ...
an artifact without git metadata cannot satisfy that`: it cannot satisfy a persistent-target rule that compares a commit with
git HEAD, and no flag turns that into an allowance. `ops/scripts/release-artifact.mjs` describes such an artifact (see below) but
does not authorise anything.

### The identity of an artifact's migration set

`node ops/scripts/release-artifact.mjs write --commit <full sha> --out <file>` records, at build time, the commit the build says
it is and the sha256 of the migration manifest (which lists every migration file's hash); it refuses a tree whose files are not
exactly its pinned set, and never overwrites an existing record. `node ops/scripts/release-artifact.mjs verify --info <file>
--expect-commit <full sha>` recomputes the manifest hash, checks every migration file against the manifest, and compares the
record with the commit the pipeline expects (and with git HEAD when the checkout has its own). It catches a migration edited
together with its own manifest line after the record was made, which the directory check alone accepts. It does NOT prove that
anyone approved the commit (an unsigned record can be rewritten by whoever can rewrite the artifact), and nothing reads a record
when a migration is applied: `pnpm db:migrate`, `pnpm db:migrate:guarded` and the guard's `up` never consult it, a test fails if
they do. It is the first building block for an approved deployment path; the approval itself is a separate, not yet decided part.

The target is `DATABASE_URL_MIGRATE`, from the environment or from `.env` (the scripts load it with
`--env-file-if-exists=.env`), and nothing else: there is no default host or database. The command refuses if
the variable is not set, or is not a plain `postgres://` or `postgresql://` URL (a plain host name or address, and one
plain database name as the whole path, and no query key other than `sslmode`, `ssl`, `uselibpqcompat`, `application_name`
and `connect_timeout`); a malformed string is refused before anything connects. A percent-encoded host is refused, so is
any control or whitespace character anywhere in the string (the URL parser silently drops some of them, the driver does
not), and so is every other query key: `host`, `port` and `dbname` would re-target the connection, `options` would
replace the read-only startup option the guard sets for its history read, and a key such as `connectionString` would be
read as configuration by anything that parses the raw string. A `.env` that points at a persistent database makes `pnpm db:migrate` upgrade that
database, now only ever from the pinned set. Before it reads anything, `up` and `verify --db` print
`target: host:port/database` (never the credentials), so a run against an unintended database is visible at
once. The port printed is the one the driver will use: the URL's own, else `PGPORT`, else 5432 (a `PGPORT` that is
not a port number is refused). Name the port in the URL when it matters. `DATABASE_URL_MIGRATE` must be a direct connection: the history is read over a read-only session opened
with a startup option, and a pooler that rejects startup options makes the guard refuse (nothing is applied).

The command line is strict. An unknown or repeated flag, a flag without its value, and an `up` without
`--expect-commit <sha>` or an explicit `--no-source-check` are refusals with exit 2, never defaults: a typo
such as `--dryrun` must not turn a dry run into a real apply, and the two source rules exclude each other.

### The manifest only appends

`pnpm db:migration-guard --base <ref>` compares the manifest with the one committed at `<ref>` (for example
`origin/dev`) and refuses if any entry that was there is now missing, renamed, reordered or has a different hash.
A new migration appends; nothing else changes. This is what catches a merged migration that was edited together
with its manifest line, which every other check accepts. CI runs it on every push and every pull request (the step
"The migration manifest only appends to the base branch's"): a pull request is compared with its base branch, a push
with the commit where the pushed branch left `dev`. The comparison fails closed: a base that this clone has not fetched,
a commit whose tree git cannot read, a shallow or damaged clone and git failing to start all refuse. Only a commit whose
tree git lists successfully, without a manifest in it, counts as "no manifest yet".

## Every way a migration runs

| Way | Guarded by |
|---|---|
| `pnpm db:migrate` | the guard, `up --no-source-check`; applies only to a DISPOSABLE target |
| `pnpm db:migrate:guarded --expect-commit <sha> --confirm-target=...` | the guard, `up` with the source check and the persistent-target rule |
| CI: the "Migrations apply" step and the `migrate` gate | `pnpm db:migrate` |
| `bash ops/scripts/test-db.sh up` (the disposable pair) | `pnpm db:migrate` |
| `pnpm db:reset` | `pnpm db:migrate` for a marked database; for a persistent one `pnpm db:migrate:guarded` with the same commit and confirmation, proven before anything is dropped |
| `pnpm db:determinism` (two scratch databases) | the guard, with the scratch URL as `DATABASE_URL_MIGRATE`; each scratch database is marked disposable first |
| the deploy blueprint's pre-deploy command (`ops/render.yaml`, `ops/runbooks/deploy.md`) | `pnpm db:migrate` (a hosted database is UNKNOWN: refused until the command is changed deliberately) |
| `pnpm worker:install` | not guarded, and not `db/migrations`: it installs the job queue library's own tables (schema `jobs`) |
| `node ops/scripts/release-artifact.mjs` | not a way to migrate: it writes and checks a record of the migration set's identity, and applies nothing |
| `db/init/*.sql` | not guarded, and not `db/migrations`: extensions and local logins on the first start of an empty local data directory |

`node-pg-migrate` is started by the guard and by nothing else in the repository: no package script,
workflow, runbook or script starts it, and `migration-default-path.test.mjs` fails if one does (a few
runbooks and records still mention it in prose). The migrations are hand-written SQL files with no down
section, so nothing needs the runner's `create` or `down`. Running node-pg-migrate directly (its binary in
`node_modules`, or through pnpm, npx or yarn) skips every check above and is not a way to migrate this
repository; a file in the repository cannot stop a person from starting a program that is
installed on their machine.

## Adding a migration

1. Write `db/migrations/NNNN_name.sql`, the next number, as hand-written SQL with LF line endings (the
   repository stores migrations as LF, see `.gitattributes`).
2. Pin it in the same change: `pnpm db:migration-pin`, then commit `ops/migrations.manifest.json` with the
   migration. A new file with CRLF line endings is refused at this step (git would store it as LF, and the
   pin of its CRLF bytes would then fail in CI as a changed file): convert it to LF and pin again.
3. Apply it to your development database with `pnpm db:migrate`.

Until step 2, `pnpm db:migrate` refuses with `UNEXPECTED file in the migrations directory: ... pnpm
db:migration-pin` and applies nothing; CI fails the same way (its "Migrations apply" step and the `migrate`
gate), and so does the `migration-guard` gate. `db:migration-pin` pins ADDED files only. A missing, renamed or
changed historical file is refused and is never re-pinned; changing history means editing the manifest by
hand, which then shows in review. Migrations are never rewritten once they are merged.

Three situations have an exit that does not touch history:

- **Editing your own migration before it is merged.** After the first pin, an edit shows as `CHANGED` and
  `db:migration-pin` refuses to re-pin it. Delete your own new entry, the last one, from
  `ops/migrations.manifest.json` and pin again. If you already applied the earlier version to a development
  database, reset that database (`pnpm db:reset`; it refuses a database that is neither disposable nor named in
  its confirmation) rather than editing its history table. Never do this for a migration that has merged.
- **A development database that is ahead of your checkout** (you applied a branch's migration, then switched
  back): the command refuses it (`APPLIED but not pinned`). Switch back to the branch that has the migration, or
  reset the development database with `pnpm db:reset`.
- **Two branches that each added a migration** conflict in the manifest. Keep the one that merged first,
  renumber the other file to the next number, and pin again.

## Limits

- It pins contents, not behaviour: a pinned migration is still applied as written.
- The rule lives in the guard, not in the database. A database comment is a mark anyone with the right to comment on the
  database can set, so a deliberate misuse is caught by review. The confirmation proves intent, not authority: the guard
  cannot know whether the commit was approved.
- The protected-port rule (no mark is accepted on port 5434, whatever the comment says) is in the migration guard and in the
  shared URL rules of `ops/scripts/lib/disposable-db.mjs`, which `assert-disposable-db`, the gate runner, `db:reset`,
  `db:determinism` and `verify:console-e2e` use. `apps/api/test/db-target.ts` keeps its own copy of the rules for the Jest
  suites and does not have it yet: until it does, those suites accept a hand-set mark on the protected port.
- "No changed tracked file" is `git status --untracked-files=no`. It does not see files hidden with the skip-worktree or
  assume-unchanged flags, and it ignores ignored files.
- The classification and the runner use separate connections, and `localhost` is resolved again for each connection. Nothing
  here makes the two resolve differently, and nothing proves they cannot.
- `pnpm db:reset` accepts loopback hosts only; the compose service names `db` and `postgres` are no longer accepted, because the guard
  classifies them UNKNOWN. A reset reaches a database through its published loopback port.
- The runner reads the SQL files after the guard hashed them. On a checkout that is being edited that is a window of a few
  seconds; an immutable checkout (CI, a deployed build) has none.
- The ordinary checks compare the manifest with the directory only. A hand edit of an old migration together with
  its manifest line passes them; `--base` (run by CI on pushes and pull requests) refuses it, and review is the check for a
  change that is never pushed to the repository.
- It cannot stop a direct run of the installed node-pg-migrate program (see above).
- A restore is the only way back from an applied migration (the down migrations raise); the guard does not change that.
