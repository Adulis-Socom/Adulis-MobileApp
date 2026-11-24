---
name: adulis-ui-state-mapper
description: >-
  Maps Adulis server-resolved states, permissions, errors, loading/offline conditions, and allowed actions into explicit UI states without inventing business logic. Use when designing screens, forms, order cards, onboarding readiness, deletion blockers, or error/empty states.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.1.0"
---

# Adulis UI State Mapper


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Distinguish live, preview, internal simulation, deferred. Checkout review says no order placed/no money collected. No fake PAID, handoff, review or trust in public release. Story/Scene visibility server-authoritative; countdown is presentation only. Clear prior tenant/session state; reject late responses. Unknown outcome is not success.

## Governing sources (legacy executable references unless noted)
- `ADU-API-01_API_Contract_v1_11_ASCII.md`
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
