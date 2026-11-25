---
name: adulis-backend-security-review
description: >-
  Performs a read-only adversarial security review of Adulis backend/database/API changes, prioritizing authorization, isolated financial/verification boundaries, OTP/recovery, payout takeover, RLS, SECURITY DEFINER, idempotency, and sensitive logging. Use before merging security-sensitive backend work.
allowed-tools: Read Glob Grep
disallowed-tools: Edit Write Bash
context: fork
metadata:
  owner: "CEO-backend"
  priority: "P0"
  version: "1.2.0"
---

# Adulis Backend Security Review

REPLACEMENT FOUNDATION CHECKS (Batch 01B): a new route that is neither `@Public()` nor `@Audiences(...)`, or a `@Public()` business route, is a finding; so is any change that weakens `apps/api/src/db/target-guard.ts`, grants to PUBLIC, gives the API SELECT/UPDATE/DELETE on `platform.event_outbox`, adds a field to `LOG_FIELDS` that can carry personal data, logs an error message or payload, puts domain data in a BullMQ job (jobs carry `source_event_id` only), or lets the cache Valkey become a readiness input or source of truth.


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Review fixture/release isolation, legacy payment endpoint exposure, Story public suppression, cross-tenant replay, distinct Operator authority and Staff inactivity. Distinguish confirmed reachability from hypotheses. Preserve read-only review; do not mutate persistent targets. Migration parity reviews only when separately authorized.

## Governing sources (legacy executable references unless noted)
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md`
- `ADU-SEC-01_Content_Security_Policy_v1_0.md`
- `ADU-DB-01_Database_and_Data_Model_v1_27_ASCII.md`
- `ADU-API-01_API_Contract_v1_11_ASCII.md`
- `ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md` for privacy-risk inventory only.

## Review scope
Search the actual diff and affected code for:
- BOLA/IDOR and cross-seller/buyer/courier scope leaks;
- missing negative permission cases;
- RLS bypass or unsafe transaction settings;
- SECURITY DEFINER owner/search_path/caller-derived audit identity;
- OTP enumeration, resend/attempt/rate-limit flaws;
- session fixation/revocation/recovery/new-device flaws;
- step-up bypass and payout takeover;
- isolated-schema grants or unlogged reads;
- SQL injection/string-built SQL;
- idempotency bypass or replay confusion;
- secrets/PII/bank details/evidence in logs;
- open redirect/caching mistakes that expose sensitive API data;
- worker jobs that mutate twice on retry.

## Severity
- `P0`: direct money reroute, cross-tenant disclosure, auth bypass, isolated-boundary bypass, secret/key exposure, corruption of trust/financial history.
- `P1`: exploitable authorization/recovery/reliability defect with production impact.
- `P2`: defence-in-depth or maintainability weakness with plausible security consequence.
- `P3`: hygiene issue.

## Review behavior
- Read-only. Do not silently patch while reviewing.
- Cite file/line and violated Adulis rule.
- Distinguish confirmed vulnerability from hypothesis.
- If no issue is found, say what attack classes were actually checked.

## Output contract
```text
BACKEND SECURITY VERDICT: ALLOW / ALLOW_WITH_FIXES / BLOCK
Findings:
[P0/P1/P2/P3] <title>
Evidence:
Adulis rule:
Exploit path:
Impact:
Required fix:
Required regression test:
Residual risk:
```
