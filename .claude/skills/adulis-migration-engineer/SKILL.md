---
name: adulis-migration-engineer
description: >-
  Authors and reviews Adulis PostgreSQL migrations using the current SQL-first node-pg-migrate doctrine, with role/grant safety, deterministic schema output, lock/rewrite analysis, and Appendix-C verification. Use whenever creating or changing database migrations.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis Migration Engineer


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-DB-01_Database_and_Data_Model_v1_6.md`
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md`
- `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md` when roles/permissions change.

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
3. Check `SPEC_VERSION_GAP` before using CON v3 rulings that require DB v1.7.
4. Analyze: lock strength, table rewrite, backfill, index build, constraint validation, rollback, grants, RLS, function ownership, search_path, triggers.
5. Preserve historical rows and append-only semantics.
6. Do not change existing financial/state history in place to "match" a new rule.
7. Make the migration deterministic and rerunnable only through the migration framework, not ad-hoc shell SQL.
8. Update tests and relevant Appendix-C checks.
9. Highlight migrations affecting stock/state machines for manual line-by-line review.

## Hard blocks
- A migration depending on DB v1.7-only rulings without explicit interim authorization.
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
