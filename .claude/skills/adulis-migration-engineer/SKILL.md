---
name: adulis-migration-engineer
description: >-
  Authors and reviews Adulis PostgreSQL migrations preserving SQL-first migration history during authorized Drizzle migration, with role/grant safety, deterministic schema output, lock/rewrite analysis, and Appendix-C verification. Use whenever creating or changing database migrations.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.1.0"
---

# Adulis Migration Engineer


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Approved target Fastify, Drizzle, BullMQ/Valkey, not immediate execution. Follow CONTROLLED_MIGRATION_PLAN_2026-11-24.md: inventory/restore proof, HTTP parity, Drizzle domain migration preserving SQL/RLS, one consumer per job family at cutover, generated contracts/CI, authorized retirement. Preserve data by default; no schema push, snapshot recreation, rewrite of applied migrations or persistent operation without approval. PostgreSQL outbox durable. The Reservation model is RETIRED (B02B-D01): retirement needs a controlled forward migration with a manifest (the Reservation dependency inventory), tested only on disposable databases; any persistent-data reconciliation needs separate founder approval.

## Governing sources (legacy executable references unless noted)
- `ADU-DB-01_Database_and_Data_Model_v1_27_ASCII.md`
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md`
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` when roles/permissions change.

## Current migration posture
- PostgreSQL 17.
- Hand-authored SQL migrations through the repository's node-pg-migrate workflow.
- The migration role is not a runtime role.
- Generated ORM DDL is not authoritative.
- Apply migrations twice to empty databases and diff schema dumps for determinism.
- Integration tests use a real PostgreSQL service; constraints/triggers/RLS are not mockable.

## Procedure
1. Locate existing migration conventions and numbering; do not invent a parallel system.
2. Read the exact DB section/manifest entry being implemented.
3. Verify current manifest and governing contract; stop on unreissued changes.
4. Analyze: lock strength, table rewrite, backfill, index build, constraint validation, rollback, grants, RLS, function ownership, search_path, triggers.
5. Preserve historical rows and append-only semantics.
6. Do not change existing financial/state history in place to "match" a new rule.
7. Make the migration deterministic and rerunnable only through the migration framework, not ad-hoc shell SQL.
8. Update tests and relevant Appendix-C checks.
9. Highlight migrations affecting stock/state machines for manual line-by-line review.
10. Pin the new file in the same change with `pnpm db:migration-pin` and commit `ops/migrations.manifest.json`; apply it only with `pnpm db:migrate` (it runs the migration-file guard). Never start `node-pg-migrate` directly.

## Hard blocks
- A migration depending on unreissued contracts without explicit interim authorization.
- Prisma/TypeORM/ORM schema generators as DDL authority.
- `UPDATE`/`DELETE` grants on append-only records.
- function ownership or `SECURITY DEFINER` changes without explicit audit.
- a table-count change not explained by a governing manifest/ruling.
- Any migration containing `CREATE MATERIALIZED VIEW` (R16). This prohibition applies immediately and does not require the DB v1.7 reissue: a prohibition cannot create a version conflict.

## Output contract
```text
MIGRATION REVIEW
Source section:
Objects changed:
Lock/rewrite risk:
Data backfill:
Grants/RLS/functions:
Rollback posture:
Determinism checks:
Appendix-C checks:
Manual-review requirement:
Spec status:
```
