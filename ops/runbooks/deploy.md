# Runbook — deploying the API and the worker

**Status:** ready to follow. **`ops/render.yaml` EXISTS since T23 Phase 4 (D-289) and has never been applied** -- step 0 says what that means.
**Frequency:** every promote to production; staging is automatic on merge to `main`.
**Owner:** CEO. **Source:** ADU-CON-02 v3.1 S18 (hosting), S19 (environments), S20.2 (heartbeat) ·
T6 Phase D.

---

## Why this is a runbook

ADU-CON-02 S19 gives staging `Auto on merge to main` and production `Manual promote`. A
manual promote is a person following steps, and the two steps that are easy to miss are
the ones nothing in the repository can do for you:

- **`pnpm worker:install`**, which is not part of `pnpm db:migrate` and cannot be. It
  installs graphile-worker's own tables using the DDL role, because the worker's first
  statement would otherwise be `create schema if not exists jobs` — and that needs
  `CREATE` on the DATABASE, a standing privilege the runtime role must not hold
  (register D-52). A worker that boots without it fails on its first task, not at
  startup.
- **Giving the runtime roles a LOGIN password.** Migration 01 creates every role
  `NOLOGIN`, because a password in a migration is a secret in git. Every environment
  provisions its own.

Neither leaves a trace when skipped until something is already wrong.

---

## Step 0 — `ops/render.yaml` exists and has never been applied

ADU-CON-02 v3.1 S18 says *"`render.yaml` keeps infrastructure in the repo"* and names the
topology: `adulis-db` (Postgres 17, PITR, private-network only) · `adulis-api` ×2
(`node dist/main.js`, `/healthz`) · `adulis-worker` (`node dist/worker.js`) · a pre-deploy
job running `pnpm db:migrate`.

**The file now exists (T23 Phase 4, D-289) and its first line says it has never been
applied.** That line is deleted by the person who applies it and by nobody else.

D-80 kept the file out for seventeen orders with a good argument -- "inventing a
`render.yaml` that has never been applied would be a file that looks authoritative and
has never been true" -- and T23 Phase 1 went looking for the account that would settle
it, found no credentials of any kind, and parked. So the argument still stands, and what
answers it is `pnpm verify:render-yaml` (gate `render-yaml`): it checks every claim the
blueprint makes about THIS REPOSITORY -- that each script it runs exists, that
`/healthz` is a route the API serves and is `@Public`, that the pre-deploy runs
`worker:install`, that every variable `.env.example` declares is declared there, that no
secret carries a literal value. It cannot check that Render accepts the schema, and it
prints that limitation rather than implying otherwise.

**It describes STAGING only.** Production is deliberately absent: a blueprint carrying
two environments before either has ever been applied doubles the number of untrue
statements in the file. Until it is applied, the services are still created by hand to
the topology above -- but the topology is now a file you can diff instead of a paragraph
you can misread.

---

## Before the first deploy, once per environment

1. **The four extensions.** `db/init/00-extensions.sql`, run as the DDL role. Render's
   managed Postgres does not run an init directory.

   ```bash
   psql "$DATABASE_URL_MIGRATE" -v ON_ERROR_STOP=1 -f db/init/00-extensions.sql
   pnpm db:verify-extensions
   ```

2. **Migrate**, which creates the six roles among everything else.

   ```bash
   pnpm db:migrate
   ```

3. **Give the runtime roles a LOGIN password.** They are `NOLOGIN` until you do.

   ```bash
   psql "$DATABASE_URL_MIGRATE" -v ON_ERROR_STOP=1 \
     -c "ALTER ROLE adulis_app  LOGIN PASSWORD '<from the secret store>'" \
     -c "ALTER ROLE adulis_jobs LOGIN PASSWORD '<a DIFFERENT one>'"
   ```

   > **`adulis_app` is never a superuser, in any environment.** Under a superuser every
   > boundary check passes while proving nothing: Appendix C check 10 returns zero rows
   > because privileges are irrelevant, not because they are correct.

4. **`pnpm worker:install`.** The step this runbook exists for.

   ```bash
   DATABASE_URL_MIGRATE=... pnpm worker:install
   ```

   It reads `DATABASE_URL_MIGRATE`, not `DATABASE_URL_JOBS` — it is DDL — and it also
   moves ownership of graphile's tables to `adulis_jobs`, because graphile puts RLS on
   them and a non-owner with full DML boots fine and then fails on its first insert.

5. **The three key secrets**, versioned (`..._V1`), as environment values and never in
   git: `EVIDENCE_ENCRYPTION_KEY_V1`, `PAYOUT_ENCRYPTION_KEY_V1`, `IDENTITY_HASH_KEY_V1`.
   Rotation is *add* `_V2` and run the re-encrypt job; `encryption_key_ref` exists for
   this.

---

## Every deploy

1. **CI is green on the commit being promoted.** `pnpm ci:local` and CI run the same
   list (`ops/scripts/gates.mjs`), so a green local run now means what a green CI run
   means — that was not true before T6 Phase D, and the difference shipped a stale
   contract once already.

2. **Pre-deploy job: `pnpm db:migrate`.** Render runs it before the new instances take
   traffic. A migration that fails stops the deploy, which is the intent.

3. **`pnpm worker:install` whenever the worker image changes** — it is idempotent, so
   running it on every deploy is the safe habit rather than remembering which deploys
   need it.

4. **Watch `/healthz` on both API instances.**

   ```bash
   curl -s https://api.adulis.example/healthz | jq
   ```

   | Body | Means |
   |---|---|
   | `{"status":"ok","db":"up","worker":"up"}` | Deployed and healthy |
   | `{"status":"degraded",...,"worker":"stale"}` | **The API is fine. The WORKER is not.** |
   | `{"status":"degraded",...,"worker":"never_started"}` | The worker has never beaten — step 4 above, or the worker service is down |
   | HTTP 503 | The database is unreachable from that instance |

   > **A stale worker does not 503, deliberately** (register D-51). S20.2 wants
   > `/healthz` to redden when the worker dies; S18 makes a 503 here the signal that
   > pulls an instance out of Render's rotation. A 503 for a dead *worker* would remove
   > every healthy API instance and turn "orders stop expiring" into "the storefront is
   > down" — a strictly worse outcome caused by the monitoring rather than the fault.
   > **The uptime check must alarm on the BODY, not on the status code.**

   > `/healthz` answers without a credential, and that is load-bearing: it was a live
   > defect that it did not (register D-79). Render sends no `Authorization` header, so
   > a 401 there marks every instance unhealthy and no deploy ever goes live.

5. **The worker beats every five minutes.** If `worker_last_beat_at` stops moving, the
   reservation clock has stopped and nothing else will say so for 48 hours.

---

## Rolling back

Render keeps previous deploys; promote the prior one. **Migrations do not roll back** —
none of `db/migrations/*.sql` carries a Down section, by design (a migration is never
edited after it merges; you roll forward with a new one). So a rollback of the
application against a migrated database is safe only where the newer migration was
additive, which every migration in this repository has been. **Check that before
promoting backwards**, and if a migration was not additive, the rollback is a
roll-forward migration plus a deploy.

---

## Still owed

The ADU-CON-02 S20.6 set beyond this one: `rollback` (as its own runbook, with the
migration question answered per release), `restore-drill`, `incident`, `sms-failover`,
`key-rotation`, `db-upgrade`. Each needs a deployment that exists. And `ops/render.yaml`
— step 0.
