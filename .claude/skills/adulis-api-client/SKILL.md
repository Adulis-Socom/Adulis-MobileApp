---
name: adulis-api-client
description: >-
  Implements Adulis frontend API consumption from the published OpenAPI contract, including generated types, credentials by surface, idempotency keys, localisable errors, client headers, cache policy, and additive-version compatibility. Use whenever frontend code calls the API.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.2.0"
---

# Adulis API Client

REPLACEMENT FOUNDATION (Batch 01B): `contracts/openapi.json` is generated from the replacement API and today holds only `/livez` and `/healthz`; `packages/api-client/src/schema.d.ts` is generated from it; both are committed from the Rebuild CI `generated-contract` artifact and checked by `pnpm verify:contract`. The Prism mock (`pnpm mock:api`) is archived. A missing endpoint is GAP-RB-06: use the typed fixture port (GOV-06), never a hand-written DTO.


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Live requests use generated contract types; isolated typed fixture ports are permitted for approved missing contracts. Never cast around a missing wire contract or pass fixture IDs to live APIs. Clear tenant/session data on context switch and ignore late responses. Checkout is review only, never live order submission. The Reservation model is RETIRED (B02B-D01): call no /reservations/ path and hand-author no Reservation DTO; historical Reservation fields are read-only presentation at most.

## Governing sources (legacy executable references unless noted)
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — primary.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` — credentials/authorization.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — browser cookie/CORS/cache constraints.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — openapi-typescript/openapi-fetch and PWA network-only rules.

## Client rules
- Generate types/client from the repository's published OpenAPI spec using the configured `openapi-typescript` / `openapi-fetch` workflow.
- Do not hand-write duplicate DTOs or reinterpret enums.
- MOBILE uses bearer from native secure storage; console uses browser cookie and `credentials: include` as specified.
- Every state-changing POST carries an idempotency key with lifecycle tied to the user intent, not the request attempt.
- Render server errors via `message_key` + typed `slots/items`; never branch on English text.
- Ignore unknown additive fields safely.
- Authenticated `/v1/*` responses are network-only/no-store in the PWA; do not queue them offline.
- Respect request/client/device/locale headers defined by the current contract.

## Procedure
1. Regenerate before changing handwritten assumptions.
2. If generated types disagree with UI expectations, raise `CONTRACT_GAP`; do not cast around it.
3. Centralize error decoding, idempotency, credential presentation, and request identifiers.
4. Add tests for retries, 401/403/404 scope behavior, locale error rendering, and unknown additive fields.

## Forbidden behavior
- `as any` to bypass a contract mismatch;
- parsing error message strings;
- localStorage/sessionStorage for console credentials;
- creating a fresh idempotency key on every retry/double tap;
- caching authenticated API responses in service worker/cache storage.

## Output contract
```text
API CLIENT CHANGE
Endpoint:
Generated type:
Credential mode:
Idempotency lifecycle:
Error rendering:
Cache/network policy:
Compatibility behavior:
Contract gap:
Tests:
```
