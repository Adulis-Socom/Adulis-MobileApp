# Clean rebuild governance (Batch 01A)

Authority: `docs/amendments/REBUILD-2026-11-25-CLEAN-LINEAGE.md` (RB25-D01..D11). Execution plan: the founder's
clean-rebuild master plan (106 work orders; held with the founder inputs, indexed here). These files are
governance and preparation only; Batch 01A writes no feature code and starts no Stage B work.

| Order | File | What it is |
|---|---|---|
| GOV-03 | `GOV-03-WORKORDER-INDEX.csv` | all 106 work orders: stage, acceptance case, evidence, sources |
| GOV-03 | `GOV-03-SOURCE-TO-WORKORDER.csv` | design documents and supplements -> owning work orders (gaps marked) |
| GOV-03 | `GOV-03-PROTOTYPE-TO-WORKORDER.csv` | prototype screens -> work orders and disposition |
| GOV-03 | `GOV-03-REUSE-LEDGER.csv` | existing assets: REUSE VERIFIED / REBUILD / DEFER / ARCHIVE / GAP |
| GOV-04 | `GOV-04-REGRESSION-AND-TEST-HARNESS.md`, `GOV-04-REGRESSION-MAP.csv` | pinned legacy evidence; behaviours to carry; new CI gate plan |
| GOV-06 | `GOV-06-FIXTURE-AND-RELEASE-BOUNDARY.md` | typed fixture port and release-negative tests for every client |
| GOV-07 | `GOV-07-BUILD-SCOPE-AND-RELEASE-DECISIONS.md` | build target (not a launch decision), data ownership, risks, open decisions |
| RBL-01 | `RBL-01-LINEAGE-AND-PATH-MAP.md` | integration branch, protected archive tags, old-to-new path map |
| RBL-02 | `RBL-02-REPLACEMENT-DATABASE-AND-DATA-POLICY.md` (+ `ops/rebuild/disposable-db.sh`) | the new empty disposable database target; legacy data policy |
| RBL-03 | `RBL-03-PR191-FINDINGS-AS-REQUIREMENTS.md`, `RBL-03-FINDING-DISPOSITION.csv` | #191 findings as requirements; all 52 carried findings disposed |
| RBL-04 | `RBL-04-ARCHITECTURE-DECISION-AND-CONTRACT-REGISTER.md`, `RBL-04-EVENT-REGISTER.csv` | ADR, ownership, audiences, contracts, capability matrix, event register |
| SC-FE-00 | `SC-FE-00-CONSOLE-SOURCE-TO-SCREEN.md` | Seller Console route map, authorization matrix, reuse decisions, missing-contract register (GAP-SC-01..07), SC-FE-01 plan |
GOV-01, GOV-02 and GOV-05 evidence lives in the batch report folder; GOV-02's changes are the addendum and the
scoped authority wording in CLAUDE.md, `.claude/reference` and five skills.

## Batch 01B -- clean shared platform foundation (Stage B, ARC-BE-01..06, RBL-05)

| Order | Where | What |
|---|---|---|
| ARC-BE-01 | `pnpm-workspace.yaml`, `ops/rebuild/disposable-db.sh` (+ `.test.sh`) | active workspace = `apps/api` + `packages/*`; legacy runtime removed from the active tree (archive tag keeps it); hardened disposable target with 25 negative tests |
| ARC-BE-02 | `apps/api/src` (`main.ts`, `app.ts`, `platform/`, `config/`) | NestJS 11 on Fastify 5: env validation, request/correlation ids, redacted pino, problem envelope, deny-by-default auth seam, exact origins, `/livez` `/healthz`, graceful shutdown, OpenAPI generation |
| ARC-BE-03 | `apps/api/db/bootstrap.sql`, `apps/api/db/migrations/` (location chosen here, RBL-01 S2), `apps/api/src/db/` | three non-superuser roles; Drizzle-applied reviewed SQL; target guard; transaction-local context |
| ARC-BE-04 | `apps/api/src/events/`, `apps/api/src/worker/`, `apps/api/src/worker.ts` | EVT-01 outbox, relay with leases, delivery registry, processed-event idempotency, dead letters, BullMQ, queue/cache Valkey separation |
| ARC-BE-05 | `packages/tokens`, `packages/locale`, `packages/api-client`, `.github/workflows/rebuild-ci.yml` | CTO palette light-only with contrast gate; clean English-first catalogue (Amharic PENDING, not public); generated client; replacement CI |
| ARC-BE-06 | `ops/rebuild/verify-retired-absence.mjs` | executable proof that no retired architecture is active |
Reports, checkpoints and the verification matrix live in the batch report folder (WO-REBUILD-20261125-01B).
