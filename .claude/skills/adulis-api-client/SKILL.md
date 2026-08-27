---
name: adulis-api-client
description: >-
  Implements Adulis frontend API consumption from the published OpenAPI contract, including generated types, credentials by surface, idempotency keys, localisable errors, client headers, cache policy, and additive-version compatibility. Use whenever frontend code calls the API.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis API Client


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-API-01_API_Contract_v1_3.md` — primary.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md` — credentials/authorization.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — browser cookie/CORS/cache constraints.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — openapi-typescript/openapi-fetch and PWA network-only rules.

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
