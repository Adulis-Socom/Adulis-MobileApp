---
name: adulis-db-invariant-engineer
description: >-
  Designs and implements Adulis database-enforceable invariants using PostgreSQL constraints, triggers, grants, RLS, and functions. Use for schema rules, state transitions, stock, scoping, append-only data, derived state, or concurrency-sensitive data behavior.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.2.0"
---

# Adulis DB Invariant Engineer


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Drizzle is the approved target, not authority to bypass PostgreSQL constraints, RLS or named SQL functions. Preserve transaction-local set_config and migration history. PostgreSQL durable truth; Valkey rebuildable coordination/cache. Story/Scene eligibility is server-owned, same-Seller/Market and fail-closed; expiry independent of delayed jobs. No new financial state or DDL outside authorized work orders. The Reservation model is RETIRED (B02B-D01): add no Reservation constraint, trigger or function; physical retirement is a controlled forward migration with a manifest, never a rewrite of applied migrations, a dropped table or deleted stock/audit history. CLEAN REBUILD (RB25-D01/D04): those preservation rules bind the ARCHIVED legacy lineage and its database. In the replacement lineage, 'migration history' means the replacement's own chain; model only active domains as their stage arrives; no Reservation, legacy Order family, payment, payout, handoff or paid-commerce placeholder table; invariants still live in PostgreSQL (constraints, RLS, functions).

REPLACEMENT FOUNDATION (Batch 01B): roles `adulis_migrator` (owner), `adulis_api`, `adulis_worker`, none superuser or BYPASSRLS; `withRequestContext` in `apps/api/src/db/client.ts` sets the three settings with `set_config(..., true)` first; RLS policies key on `current_setting('adulis.account_id', true)` (pattern proven in `test/roles-and-rls.int.ts`); the eventing tables are `platform.*` with an immutability trigger on outbox facts. New domain invariants arrive with their domain migration, never as placeholders.

## Governing sources (legacy executable references unless noted)
- `ADU-DB-01_Database_and_Data_Model_v1_27_ASCII.md` — primary.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product behavior.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` — permission/scoping rules.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — historical build rules; verify current manifest.

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
