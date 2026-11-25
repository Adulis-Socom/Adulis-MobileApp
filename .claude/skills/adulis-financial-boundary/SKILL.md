---
name: adulis-financial-boundary
description: >-
  Implements and reviews Adulis financial isolated-boundary code: payout ciphertext, payment evidence, access logs, evidence streaming, ledger records, retention, and the legacy seller payment confirmation (stale since WO-001C, K-1: block new work on it). Use whenever code can disclose or mutate bank-related or payment-evidence data.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.1.0"
---

# Adulis Financial Boundary


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Payment authority undecided (D24-01–03); no PSP, Seller confirmation, real paid Orders, refunds, settlement, credentials or surcharge. Checkout A is real Seller-scoped Cart/review only; C is isolated internal simulation. Subscription Option B (B02-D01): no purchase, manual transfer billing, payment instructions, purchase intent, transfer confirmation or paid upgrade; keep status and entitlement resolution. Payout Option A (B02-D02): deferred entirely, no bank-detail collection, edit or disclosure path, never a readiness requirement; keep existing data and controls. Add no financial behavior by inference. Preserve existing data, permissions, encryption and audit until authorized quarantine.

## Governing sources (legacy executable references unless noted)
- `ADU-00_One_Page_Business_Model_v9_1.md` — no custody/payment-verification doctrine.
- `ADU-DB-01_Database_and_Data_Model_v1_27_ASCII.md` — `financial` schema, roles, append-only/ledger.
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — evidence/disclosure endpoints.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` — who may access what.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — browser evidence presentation.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — R15 (functions return ciphertext + key reference; decryption in the API) and R18 (framed streaming) are both pending DB/API write-backs; flag either as `SPEC_VERSION_GAP` unless interim authority is recorded. The prohibitions in this skill (no keys stored in the database, no unlogged reads, no client-side decryption) hold under both versions and apply now.
- `ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md` — privacy risk context, not legal sign-off.

## Non-negotiable product posture

Payment authority is undecided (D24-01); preserve existing financial isolation until authorized quarantine, never extend the legacy paths.

- Adulis does not hold buyer money before licence/partner authority.
- No escrow, wallet, or Adulis-held seller balance in V1.
- Do not assert payment is genuine or select a provider in this MVP.
- No Seller or fixture establishes real PAID.
- Financial records remain append-only where specified; preserve existing ledger invariants without new financial behavior.

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
