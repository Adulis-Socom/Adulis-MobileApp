---
name: adulis-api-boundary
description: >-
  Reviews the contract seam between Adulis backend and frontend: OpenAPI, resolved state, localisable errors, idempotency, additive mobile compatibility, surface authorization, caching, and payload budgets. Use for endpoint or client-contract changes.
allowed-tools: Read Glob Grep
disallowed-tools: Edit Write Bash
metadata:
  owner: "shared"
  priority: "P0"
  version: "1.1.0"
---

# Adulis API Boundary


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Separate target design from executable OpenAPI. Missing live contracts are CONTRACT_GAP. Authorized frontend-only work may use typed, versioned, development-only fixtures, without live fallback, release inclusion or financial side effects. Test tenant/market/audience isolation and Story visibility. No new live payment contract. The Reservation model is RETIRED (B02B-D01): a retired Reservation operation answers with a fail-closed error and the contract changes only through the CI generation workflow; no compatibility route may re-enable it.

## Governing sources (legacy executable references unless noted)
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — primary wire contract.
- `ADU-DB-01_Database_and_Data_Model_v1_27_ASCII.md` — enforcement authority.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product behaviour.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` — permissions/surfaces.
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — Companion/PWA placement.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — build/CI sequencing. Check current contract gaps.

## Backend checks
- Every state-changing endpoint calls the named database function where one exists.
- No business invariant is reimplemented only in NestJS.
- Every write is idempotent from the client perspective.
- Errors are machine-readable/localisable (`message_key` + typed slots/items), never rendered prose.
- Authorization resolves server-side per request.
- No internal identifier is public where the contract forbids it.
- Anonymous/cacheable versus authenticated/no-store behavior matches the contract.
- Storefront payload target and pagination rules remain intact.

## Frontend checks
- Client types come from generated OpenAPI output; no duplicate handwritten DTOs.
- Client displays resolved state and sends intents; it does not calculate expiry, eligibility, trust level, or entitlement.
- State-changing requests supply idempotency keys using one key per user intent, not one per network retry.
- API errors are rendered through locale keys and slots.
- Older mobile clients survive additive fields and compatible behavior.

## Output contract

```text
API BOUNDARY REVIEW
Backend: PASS / REVISE / BLOCK
Frontend: PASS / REVISE / BLOCK
Breaking wire change: YES / NO
Pinned-mobile compatibility impact: <...>
Authorization surface impact: <...>
Locale/error impact: <...>
Required coordinated changes: <...>
```
