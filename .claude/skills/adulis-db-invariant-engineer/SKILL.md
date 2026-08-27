---
name: adulis-db-invariant-engineer
description: >-
  Designs and implements Adulis database-enforceable invariants using PostgreSQL constraints, triggers, grants, RLS, and functions. Use for schema rules, state transitions, stock, scoping, append-only data, derived state, or concurrency-sensitive data behavior.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis DB Invariant Engineer


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-DB-01_Database_and_Data_Model_v1_6.md` — primary.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product behavior.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md` — permission/scoping rules.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — pending v1.7 rulings must be flagged.

## Doctrine
Use the strongest layer capable of expressing the rule:
1. Constraint
2. Trigger
3. Database function
4. Service only when PostgreSQL cannot hold the rule

Database rules:
- money = `bigint` minor units + currency code;
- timestamps = `timestamptz` UTC;
- append-only = grant/revoke plus guard trigger where specified;
- configuration = versioned rows/effective ranges, not constants/settings singleton;
- isolated boundaries = separate schemas/roles with logged function-only access;
- derived state stays derived;
- open product decisions remain schema-neutral;
- absence of a column can be a load-bearing invariant; do not "complete" the schema.

## Workflow
1. Run the spec router mentally or invoke it if needed.
2. Identify the exact product invariant and failure mode.
3. Identify ownership/scope and concurrency case.
4. Choose enforcement mechanism in doctrine order.
5. Preserve existing table/schema/role manifests unless the governing DB revision authorizes a change.
6. Write migration/function changes only when sources are clear.
7. Add negative tests proving the database refuses the illegal state without relying on the API.
8. Check RLS, grants, SECURITY DEFINER ownership/search_path, and composite FKs.
9. Note Appendix-C impact and any manifest-count change.

## Forbidden behavior
- No stored `has_chatbot`, `can_broadcast`, or equivalent entitlement boolean.
- No identity-image storage path.
- No generated chatbot reply-text column.
- No cross-identity FK from the NLU phrase store.
- No ranking/recommendation score before its governed phase.
- No runtime widening of legal transition tables.
- No direct app-role access to isolated `verification` or `financial` schemas.
- No `CREATE MATERIALIZED VIEW` anywhere in the schema. `core.seller_public_stats` is a plain table maintained in O(1) by triggers (ADU-CON-02 v3.0 R16; pending ADU-DB-01 v1.7 Appendix C check 15). A materialized view here re-aggregates every seller's history per refresh and is the known build-time capacity trap.

## Output contract
```text
DB INVARIANT PLAN
Rule:
Governing source:
Enforcement level:
DDL/function change:
Concurrency proof:
Authorization/scope proof:
Negative tests:
Appendix-C impact:
Manifest impact:
Status: CLEAR / BLOCKED_BY_SPEC
```
