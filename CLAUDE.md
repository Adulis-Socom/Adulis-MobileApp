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
- Enum types are **66** (232 values), and there is deliberately no asserted count in the document any more: v1.9 replaced the number with Appendix C **check 16**, which compares Appendix A against `pg_type` in both directions. `db/checks/fixtures/appendix-a.json` is the transcription both the check and the tests compare against.
- **Read `docs/amendments/README.md` before `docs/`.** ADU-DB-01 governs at **v1.10 as amended by A3**, ADU-AUTH-01 at **v2.4**, ADU-API-01 at **v1.6** — all three now installed in `docs/`. Amendments A1 and A2 are absorbed into v1.10; **A3 is live** and governs where it and v1.10 disagree.
- **ADU specification documents are ASCII (A3.5).** No character above U+007F, in prose or in data — three sessions in a row lost documents to transit damage, and a document that will not install governs nothing. `pnpm verify:docs-ascii` enforces it on the governed set and reports the pre-A3.5 documents as debt.
- **`docs/registers/ADU-VAL-01` is a register, not a specification. It governs nothing and is never a build source.** A value listed there as OPEN or DEFAULT is *deliberately* absent: do not report it as a spec gap and do not invent one. A value missing from a document that does **not** appear in ADU-VAL-01 is still a gap — report it. The distinction is that a **column** is a schema decision (ADU-DB-01) and a **value** is a business decision that arrives later as a configuration row.
- The permission catalogue is **42 codes / 139 grants / 8 step-up / 12 mobile-reachable**, seeded by executing ADU-AUTH-01 v2.3 §16.2a's generated SQL rather than transcribing its table. Never hand-edit the seed: `pnpm verify:permission-doc` compares the table against the SQL over all 252 cells, and the tests compare the database against the authority `.sql`.
- The **Owner is `core.seller.owner_account_id`, and only that**. `core.seller_team_member` can never hold `role = 'OWNER'` — a CHECK enforces it.
- `core.fn_has_permission` returns `void` and **raises**, in **three cases, not two** (A3.3): **`U0002`** only where the account NEVER held a relationship (API: 404); **`U0001`** where it held one and is suspended or revoked, and where a role or surface fails (API: 403). A suspended Admin is not a stranger — telling them the seller does not exist is a lie that produces a support ticket. **`42501` is left to PostgreSQL and means a grant is misconfigured — it maps to 500 and is our defect.** Never raise `42501` deliberately: one code meaning both *you may not* and *our grants are wrong* hides a real privilege bug behind a clean denial. `U0003`–`U0999` are reserved.
- **A suspended team member loses every permission on the next request** (R28), because disabling a login does not end a live session and R17 stretched that to seven days. The membership lookup reads the row **regardless of standing** and decides afterwards, which is what makes U0001 and U0002 distinguishable — and it needs its `ORDER BY`, because `seller_team_member_live` is unique only `WHERE revoked_at IS NULL` and a re-invited member holds several rows.
- **`core.product_variant.stock_count` is not writable.** `fn_apply_stock_event` fires **`BEFORE INSERT`** on `core.stock_event` (A3.1 — §10.1's prose says AFTER and is wrong; under AFTER, `resulting_count` is silently NULL on every row). Overselling is a transaction failure, never a negative number.
- The step-up surface restriction is a **column** (`core.permission.requires_step_up`) and a **total** CHECK, never a list of codes. v1.8's enumeration left three of the eight step-up permissions unconstrained; do not reintroduce a list.
- No string-built SQL outside the `sql` template tag. No secrets in code. No edits to generated files (`openapi.json`, `schema.d.ts`, the generated client).
- Stop at the boundary of the assigned slice/tier; end every session by listing what was NOT done.
