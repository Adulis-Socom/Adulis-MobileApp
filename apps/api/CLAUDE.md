# `apps/api` -- replacement backend: API + worker + database lineage

Loaded with the root `CLAUDE.md`. **Start backend sessions here.** This file describes the REPLACEMENT
lineage only (RB25-D01, rebuild branch `rebuild/2026-11-25`). The archived legacy lineage (NestJS on Express,
Kysely, Graphile Worker, node-pg-migrate, migrations 0001-0062) lives at tag `recovery/legacy-dev-20261125`
and is evidence, never a build source. Its rules (Appendix C counts, `db:migration-pin`, `fn_has_permission`
SQLSTATEs) do not apply here until a domain work order re-establishes an equivalent.

**Governing documents:** RBL-04 (ADR, ownership, contracts) -> ARCH-PLATFORM-01, DEPLOY-01, EVT-01, OBS-01,
AUTH-02, PRV-01, CSP-01 (Nov 24 effective edition) -> `docs/amendments/REBUILD-2026-11-25-CLEAN-LINEAGE.md`.
Read `docs/rebuild/README.md` first.

## What exists (foundation, Batch 01B)

| Piece | Where | Rule |
|---|---|---|
| API process | `src/main.ts`, `src/app.ts` | NestJS 11 on Fastify 5; `/v1` prefix for every business route; `/livez`, `/healthz` unprefixed |
| Worker process | `src/worker.ts` | same codebase, no HTTP; outbox relay + BullMQ consumers |
| Config | `src/config/env.ts` | zod; each process parses only its own variables; never echo a value |
| Errors | `src/platform/problem.ts` | ONE envelope (RFC 9457 + items[]); closed catalogue; keys `error.<group>.<code>` must exist in `@adulis/locale` |
| Auth seam | `src/platform/auth.ts` | **deny by default**: `@Public()` or `@Audiences(...)` + an `Authenticator`; the only authenticator is "nobody" until AUTH-02 (SC-BE-02) |
| Origins | `src/platform/http.ts` | exact allow-list; Origin implies a browser audience that must equal the session's |
| Logging | `src/platform/logging.ts` | pino ALLOW-LIST; a field is logged because it is named; no message, payload, URL query or credential |
| Database | `src/db/*`, `db/bootstrap.sql`, `db/migrations/` | Drizzle access + reviewed SQL; target guard before anything else |
| Eventing | `src/events/*`, `src/worker/*` | EVT-01 outbox, delivery registry, processed-event marker, dead letter |

**Nothing else exists.** No Seller, catalogue, auth, chat or any business endpoint, table, event or job:
each arrives with its own work order. A missing contract is a GAP, never a licence to invent one.

## Database discipline

- **Three roles, never a superuser at runtime.** `adulis_migrator` (owns objects, runs `db:migrate`),
  `adulis_api`, `adulis_worker` -- created by `pnpm db:bootstrap` (superuser, once). The target guard refuses a
  superuser or BYPASSRLS role for migrate, API and worker. Grants are least privilege per migration.
- **Target safety first.** `src/db/target-guard.ts` runs before bootstrap, migrate, API and worker start:
  name `adulis_rebuild[_suffix]`, the identity comment, no legacy marker (`public.pgmigrations`,
  `graphile_worker`, `core.reservation`), applied history a subset of the local journal. Never weaken it to
  get a database to accept; never point anything at `adulis-postgres` (host 5434).
- **Migrations**: reviewed SQL in `db/migrations/NNNN_name.sql`, listed in `db/migrations/meta/_journal.json`,
  applied by `pnpm db:migrate` (Drizzle migrator, advisory-locked). Separate statements with
  `--> statement-breakpoint`. Never edit a merged migration; roll forward. Header names the document and
  section it transcribes. Single writer: the backend owner.
- `src/db/schema.ts` mirrors the SQL; `test/lineage.int.ts` fails if they disagree column for column.
- **Transaction-local context**: `withRequestContext` sets `adulis.account_id`, `adulis.actor_role`,
  `adulis.seller_id` with `set_config(..., true)` as the FIRST statement. Never `SET`, never `false`.
- The load-bearing absences and the retired models in root `CLAUDE.md` apply in full. No placeholder tables.
- **No asserted table counts** (ARC-BE-03); `test/lineage.int.ts` asserts the exact table SET instead.

## Eventing discipline

- A cross-domain fact leaves its owner ONLY through `appendEvent(tx, ...)` inside the owner's transaction.
  Never call BullMQ from a request path (dual write).
- The production registry (`src/events/registry.ts`) is EMPTY. RBL-04-EVENT-REGISTER's ACTIVE rows are build
  scope, added one by one by their owner work order. DORMANT financial events are never added.
- Consumers write their effect in the transaction that inserts the processed-event marker. BullMQ jobId
  dedup is an optimisation, never the correctness boundary.
- Jobs carry `source_event_id`, never the event payload: Valkey holds no domain data.

## Commands

```
pnpm --filter @adulis/api build | typecheck | test             # unit specs, no services
pnpm --filter @adulis/api test:integration                     # needs TEST_DATABASE_URL_BOOTSTRAP, QUEUE_VALKEY_URL, CACHE_VALKEY_URL
bash ops/rebuild/disposable-db.sh up | verify | env            # local disposable PostgreSQL (127.0.0.1:55440)
pnpm --filter @adulis/api db:bootstrap && pnpm --filter @adulis/api db:migrate
pnpm generate:openapi && pnpm generate:api-client              # generators only; CI checks the committed copies
```

`contracts/openapi.json` and `packages/api-client/src/schema.d.ts` are generator output: never hand-edit
(this directory's `.claude/settings.json` denies it). Local heavy runs follow the RAM policy in the batch
reports; prefer CI (`.github/workflows/rebuild-ci.yml`).
