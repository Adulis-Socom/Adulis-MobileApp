---
name: adulis-ui-state-mapper
description: >-
  Maps Adulis server-resolved states, permissions, errors, loading/offline conditions, and allowed actions into explicit UI states without inventing business logic. Use when designing screens, forms, order cards, onboarding readiness, deletion blockers, or error/empty states.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis UI State Mapper


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-API-01_API_Contract_v1_3.md`
- `ADU-PRD-01_Product_Requirements_v8_5.md`
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md`
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` for public forms/pages.

## Rule
The server owns business state. The client may own presentation state only.

For each screen, create a table:

| Server/API condition | Visible state | Primary action | API intent | Error recovery |
|---|---|---|---|---|

Cover where relevant:
- initial loading;
- empty;
- data ready;
- stale/refetching;
- offline;
- permission absent;
- entitlement/capability unavailable;
- recoverable validation/conflict;
- terminal business state;
- transport failure;
- version/upgrade-required state.

## Hard rules
- Never compute expiry, eligibility, trust level, entitlement, or legal transition from raw timestamps/fields in the client.
- Never invent "pending", "accepted", or other state because the UI wants a label.
- Multi-item failures use API `items[]`; render every blocker/failing line, not the first one only.
- A missing required state/action in the contract is `CONTRACT_GAP`.
- Permission absence is not permission denial; use the API/bootstrapped capability model rather than guesses based on role labels.

## Output contract
```text
UI STATE MAP
Screen:
Surface:
States:
Actions -> API intents:
Permission/entitlement handling:
Offline/stale handling:
Error keys/items:
Contract gaps:
```
