---
name: adulis-api-boundary
description: >-
  Reviews the contract seam between Adulis backend and frontend: OpenAPI, resolved state, localisable errors, idempotency, additive mobile compatibility, surface authorization, caching, and payload budgets. Use for endpoint or client-contract changes.
allowed-tools: Read Glob Grep
disallowed-tools: Edit Write Bash
metadata:
  owner: "shared"
  priority: "P0"
  version: "1.0.0"
---

# Adulis API Boundary


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-API-01_API_Contract_v1_3.md` — primary wire contract.
- `ADU-DB-01_Database_and_Data_Model_v1_6.md` — enforcement authority.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product behaviour.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md` — permissions/surfaces.
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — Companion/PWA placement.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — build/CI sequencing; watch pending API v1.4.

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
