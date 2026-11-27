# RBL-01 -- Clean workspace, legacy archive and old-to-new path map

Status: governance record for the clean rebuild (RB25-D01). It moves no file; removal of legacy runtime
files happens only as each replacement lands in its own Stage B or surface work order.

## 1. Refs (created 25 November 2026)
| Ref | Points at | Purpose |
|---|---|---|
| branch `rebuild/2026-11-25` | 64d2e8ca9c10717fa7c4933b8e3cc4fca62b64e5 (pinned dev) | the rebuild INTEGRATION branch; topic PRs target it; it replaces dev only through a reviewed PR at final replacement |
| tag `dev-baseline-rebuild-20261125` | 64d2e8c | the pinned starting point |
| tag `recovery/legacy-dev-20261125` | 64d2e8c | legacy lineage archive (migrations 0001-0062) |
| tag `recovery/pr-191-482938f` | 482938f0398a89e81a2d70ab88bdeadc5011c530 | draft #191 (retirement, migration 0063): evidence only |
| tag `recovery/pr-188-3e1d09b` | 3e1d09b990785503a0156a330b08a8af76cefab5 | draft #188 (responsive/isolation suite): evidence only |
The `recovery/**` and `dev-baseline-*` tag patterns are protected by the repository ruleset
`protect-recovery-tags` (no deletion, no update, no non-fast-forward), so these refs are immutable. dev, main,
#191, #188 and the founder's checkout are untouched. No force-push, no reset.

## 2. Old-to-new path map (target topology)
"Legacy" files remain on the integration branch until the named order replaces them; the archive tag is the
permanent copy, and **no target build imports or builds an archived path**.

| Legacy path (dev 64d2e8c) | Files | Replacement | Order |
|---|---|---|---|
| `apps/api` (NestJS on Express, Kysely, Graphile jobs) | 250 | `apps/api`: NestJS on Fastify modular monolith; a second entry point for the worker (one codebase, two processes) | ARC-BE-02, ARC-BE-04 |
| `db/migrations` 0001-0062, `db/checks`, `db/init`, `ops/migrations.manifest.json` | 63 + 21 + 2 + 1 | new Drizzle migration lineage from an empty baseline plus reviewed SQL for RLS/constraints/functions; location chosen in ARC-BE-03 | ARC-BE-03 |
| `apps/console` (React/Vite) | 106 | `apps/console`: clean shell rebuilt; conforming assets reused only after SC-FE-00 verification | SC-FE-00, SC-FE-01 |
| `apps/mobile` (Expo) | 324 | `apps/mobile`: Expo Router shell rebuilt; Mobile paused until its stage | MOB-FE-01 |
| (none) | - | `apps/storefront`: independent Next.js SSR | SF-FE-01 |
| (none) | - | `apps/operator`: separate privileged origin | OP-FE-01 |
| `packages/tokens` | 5 | kept (REUSE VERIFIED); legacy blue/terracotta values removed from the target theme | ARC-BE-05 |
| `packages/locale` | 19 | kept (structure REUSE VERIFIED); keys of removed screens purged | ARC-BE-05 |
| `packages/config` | 4 | re-verified presets | ARC-BE-05 |
| `packages/api-client`, `contracts/openapi.json` | 9 + 1 | regenerated from the replacement API by the generators only | ARC-BE-02, ARC-BE-05 |
| `.github/workflows/ci.yml`, `ops/scripts/gates.mjs` and gate scripts | 59 (ops/scripts) | new gate list (GOV-04); legacy gates retired with their subjects | ARC-BE-05 |
| `ops/native`, `ops/provider-verify`, `ops/runbooks` | 61 + 2 + 8 | reviewed at their surface stage (native at MOB-FE-12, runbooks at REL-07) | per stage |
| `ops/render.yaml` (staging, branch main, never applied) | 1 | replacement topology per DEPLOY-01 | REL-08 |
| `docs/*` (specifications, registers, build history) | ~400 | kept as documentation; `docs/rebuild` holds the rebuild governance | - |
| `.claude/` (skills, references) | 37 | kept; authority updated by GOV-02 | GOV-05, RBL-05 |

## 3. Active target topology
One backend (API + worker processes) over one PostgreSQL (new lineage) and Valkey (queue and rebuildable
cache, separated per DEPLOY-01), four clients (Console, Mobile, Storefront, Operator) that reach it only
through the generated client, shared packages (tokens, locale, config, api-client). No BFF, no app-to-app
import, no legacy runtime. See RBL-04 for the ownership map and contract register.

## 4. Workspaces
The rebuild uses fresh worktrees from the pinned refs; the founder's existing checkout (on an infra branch)
is never reset or switched by the rebuild.
