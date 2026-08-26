# Adulis Platform — Agent Instructions
This file is loaded in every agent session. It is maintained like code:
it changes in the same PR as any decision that changes it.
Read `.claude/reference/DOCUMENT_AUTHORITY.md` before any implementation work.

# Suggested CLAUDE.md snippet

Paste/adapt this into the repository's root `CLAUDE.md`.

## Adulis specification discipline

- Company name is **Adulis**. `Omnivo` is retired except in historical filenames.
- Before implementation, identify the governing ADU document. Read `.claude/reference/DOCUMENT_AUTHORITY.md`.
- Never invent an answer to an open product, database, API, legal, security, or infrastructure question.
- When a later binding architecture record depends on an unreissued lower-level spec, return `SPEC_VERSION_GAP` and stop that part of implementation.
- Product behaviour belongs to the PRD; database-enforceable invariants belong in PostgreSQL; the API exposes resolved state; clients display state and send intents.
- Adulis uses one API, one PostgreSQL datastore, two backend processes (API/worker), and no per-surface backend.
- Every state-changing API endpoint calls a named database function where one exists.
- Frontend types are generated from OpenAPI; do not hand-author duplicate DTOs.
- Do not introduce Redis, brokers, Elasticsearch, microservices, BFFs, Kubernetes, JWT sessions, or an ORM write path without a reissued binding architecture decision.

## Load-bearing absences — completing the schema is the defined failure
Eleven absences are invariants. Never add: `original_key` on media · a generated chatbot reply-text column · `has_chatbot` or any stored entitlement boolean · a score column on the feed · an Accept-Reservation action or state · a bulk reissue path · operator impersonation · an image column on identity verification · a free-text column on `seller_public_stats` · an FK from `nlu` into `core`/`chat` · a seller-writable column on `review`.

## Non-negotiable mechanics
- Every database access runs inside a transaction whose first statement sets `adulis.account_id`, `adulis.actor_role`, `adulis.seller_id` via `set_config(..., true)` — the third argument is transaction-local and is the entire RLS control. Never `SET`, never `set_config(..., false)`.
- `CREATE MATERIALIZED VIEW` is a forbidden phrase (R16).
- Table count is **109** under the ADU-DB-01 v1.9 manifest (Appendix B: core 84 + 25); a different count is wrong somewhere — stop and report it. Appendix C check 14 asserts it from Tier 2.
- Enum types are **66**, and there is deliberately no asserted count in the document any more: v1.9 replaced the number with Appendix C **check 16**, which compares Appendix A against `pg_type` in both directions. `db/checks/fixtures/appendix-a.json` is the transcription both the check and the tests compare against.
- The step-up surface restriction is a **column** (`core.permission.requires_step_up`) and a **total** CHECK, never a list of codes. v1.8's enumeration left three of the eight step-up permissions unconstrained; do not reintroduce a list.
- No string-built SQL outside the `sql` template tag. No secrets in code. No edits to generated files (`openapi.json`, `schema.d.ts`, the generated client).
- Stop at the boundary of the assigned slice/tier; end every session by listing what was NOT done.
