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
  version: "1.0.0"
---

# Adulis Backend Security Review


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-AUTH-01_Authentication_and_Authorization_v2_0.md`
- `ADU-SEC-01_Content_Security_Policy_v1_0.md`
- `ADU-DB-01_Database_and_Data_Model_v1_6.md`
- `ADU-API-01_API_Contract_v1_3.md`
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
