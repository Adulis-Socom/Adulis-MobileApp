---
name: adulis-financial-boundary
description: >-
  Implements and reviews Adulis financial isolated-boundary code: payout ciphertext, payment evidence, access logs, evidence streaming, ledger records, retention, and seller payment confirmation. Use whenever code can disclose or mutate bank-related or payment-evidence data.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis Financial Boundary


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-00_One_Page_Business_Model_v9_1.md` — no custody/payment-verification doctrine.
- `ADU-DB-01_Database_and_Data_Model_v1_6.md` — `financial` schema, roles, append-only/ledger.
- `ADU-API-01_API_Contract_v1_3.md` — evidence/disclosure endpoints.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md` — who may access what.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — browser evidence presentation.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — R15 (functions return ciphertext + key reference; decryption in the API) and R18 (framed streaming) are both pending DB/API write-backs; flag either as `SPEC_VERSION_GAP` unless interim authority is recorded. The prohibitions in this skill (no keys stored in the database, no unlogged reads, no client-side decryption) hold under both versions and apply now.
- `ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md` — privacy risk context, not legal sign-off.

## Non-negotiable product posture
- Adulis does not hold buyer money before licence/partner authority.
- No escrow, wallet, or Adulis-held seller balance in V1.
- Adulis never asserts payment is genuine.
- Buyer submits evidence; seller checks the seller's own bank/payment account and confirms receipt.
- Financial records remain append-only where specified; V1 ledger proves Adulis balance remains zero.

## Boundary controls
- `financial` has no ordinary app-role table access.
- Reads happen through audited SECURITY DEFINER paths.
- An access log is written in the same transaction as disclosure.
- Browser evidence is authenticated/no-store and rendered from response bytes/blob, never a public predictable media URL.
- Key material does not live in PostgreSQL.
- Retention/deletion follows the governing transaction/claim rules; never log raw bank/evidence content.

## Procedure
1. Identify data classification and exact reader/action.
2. Verify permission, seller/order scope, and state before disclosure.
3. Verify audit row cannot be caller-forged; account for known AUTH finding F3 if relevant.
4. Preserve the isolated-schema grant boundary.
5. Treat CON v3 R18 frame-streaming as `SPEC_VERSION_GAP` until the dependent specs are reissued or interim authority is explicit.
6. Add disclosure, unauthorized, logging, retention, and memory/backpressure tests.

## Forbidden behavior
- public/signed CDN URL for payment evidence;
- screenshot treated as proof of settlement;
- storing encryption keys in DB;
- unlogged evidence/payout reads;
- decrypting in client code;
- custody/escrow/wallet semantics without new licensed architecture.

## Output contract
```text
FINANCIAL BOUNDARY REVIEW
Data:
Reader/action:
Authorization/scope:
DB access path:
Audit guarantee:
Encryption/key posture:
Browser/API caching posture:
Retention:
Ledger impact:
Version gap:
Verdict:
```
