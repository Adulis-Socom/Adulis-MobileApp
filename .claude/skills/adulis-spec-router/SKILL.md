---
name: adulis-spec-router
description: >-
  Routes Adulis engineering tasks to the correct binding specification and blocks stale, conflicting, open, or out-of-scope implementation. Use before architecture, backend, database, API, auth, frontend, mobile, seller-console, website, or security changes.
allowed-tools: Read Glob Grep
disallowed-tools: Edit Write Bash
metadata:
  owner: "shared"
  priority: "P0"
  version: "1.0.0"
---

# Adulis Spec Router


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources

- Business: `ADU-00_One_Page_Business_Model_v9_1.md`
- Project: `ADU-PROJ-01_Project_Documentation_v9_0.md`
- Product: `ADU-PRD-01_Product_Requirements_v8_5.md`
- Seller surfaces: `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md`
- Database: `ADU-DB-01_Database_and_Data_Model_v1_6.md`
- API: `ADU-API-01_API_Contract_v1_3.md`
- Auth: `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md`
- Browser security: `ADU-SEC-01_Content_Security_Policy_v1_0.md`
- Public web: `ADU-WEB-01_Public_Website_Specification_v1_0.md`
- Build/operations: `ADU-CON-02_Seller_Console_System_Design_v3_0.md`
- Descriptive only: `ADU-PD-01_Adulis_V1_Product_Description_v1_0.md`

## Routing procedure

1. Restate the requested change as one or more engineering decisions.
2. Classify each decision: product behaviour, database enforcement, wire/API, identity/access, seller-surface placement, browser security, public website, infrastructure/operations, or descriptive.
3. Read the governing source for each class.
4. Search for `INVARIANT`, `RULING`, `open item`, `pending`, `reissue`, and the feature name.
5. Compare newer architecture/operations rulings to the current dependent binding spec.
6. Return exactly one status per decision: `CLEAR`, `CLEAR_WITH_CONSTRAINTS`, `SPEC_VERSION_GAP`, `SPEC_CONFLICT`, `OPEN_DECISION`, `OUT_OF_SCOPE`, or `MISSING_SOURCE`.
7. For non-CLEAR statuses, do not implement that decision.

## Non-negotiable interpretation rules

- Never use ADU-PD-01 to override a binding source.
- Never resurrect Telegram; ARCH v2.0 removed it.
- Never resurrect the Omnivo name in current code/copy except historical references.
- Do not convert ADU-CON-02 v3.0 pending write-backs into silent edits to DB/API/AUTH/SEC/PRD.
- A founder instruction may authorize an interim ruling, but record the exact source/ruling and the unreissued document debt.

## Output contract

```text
ADULIS SPEC ROUTE
Decision: <short name>
Status: <one status>
Governing source(s): <filename + section>
Current rule: <supported statement>
Constraints: <invariants>
Version gap/conflict/open item: <if any>
Implementation allowed now: YES / NO
Required next action: <specific>
```
