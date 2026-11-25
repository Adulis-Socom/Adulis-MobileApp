---
name: adulis-spec-router
description: >-
  Routes Adulis engineering tasks to the correct binding specification and blocks stale, conflicting, open, or out-of-scope implementation. Use before architecture, backend, database, API, auth, frontend, mobile, seller-console, website, or security changes.
allowed-tools: Read Glob Grep
disallowed-tools: Edit Write Bash
metadata:
  owner: "shared"
  priority: "P0"
  version: "1.1.0"
---

# Adulis Spec Router


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Nov24 decisions control design, not execution authorization. Payment OPEN_DECISION; Checkout A+C and Stories decided. K-3/K-8 target stacks decided, migration separately gated. Resolve exact amended domain design before legacy contract. Old gap registers are historical evidence, not overrides. CTO palette supersedes earlier baseline for design direction and the prototype terracotta theme is superseded (B02-D03). Subscription Option B and Payout Option A are decided (B02-D01/D02): do not route them as OPEN_DECISION. The K-1 provider/backend-verified payment ruling is superseded by D24-01 and is not an approved direction. Missing source or approval blocks affected work only. The Reservation model is RETIRED (B02B-D01): route any request to create, extend or restore Reservation behaviour to a block, not to a specification. Courier invitations stay (B02B-D02); the Seller Console is light-theme-first (B02B-D03).

## Governing sources (legacy executable references unless noted)

The November 24 amended pack governs design intent. The installed November 8 pack is the baseline; see the shared protocol.

Repository specifications (position 5: what is built and gate-checked):

- Business: `ADU-00_One_Page_Business_Model_v9_1.md`
- Project: `ADU-PROJ-01_Project_Documentation_v9_0.md`
- Product: `ADU-PRD-01_Product_Requirements_v8_5.md`
- Seller surfaces: `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md`
- Database: `ADU-DB-01_Database_and_Data_Model_v1_27_ASCII.md`
- API: `ADU-API-01_API_Contract_v1_11_ASCII.md`
- Auth: `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` (v2.5 for the permission catalogue, matrix and seed)
- Browser security: `ADU-SEC-01_Content_Security_Policy_v1_0.md`
- Public web: `ADU-WEB-01_Public_Website_Specification_v1_0.md`
- Build/operations: `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md`
- Descriptive only: `ADU-PD-01_Adulis_V1_Product_Description_v1_0.md`

## Routing procedure

1. Restate the requested change as one or more engineering decisions.
2. Classify each decision: product behaviour, database enforcement, wire/API, identity/access, seller-surface placement, browser security, public website, infrastructure/operations, or descriptive.
3. Read the governing source for each class.
4. Search for `INVARIANT`, `RULING`, `open item`, `pending`, `reissue`, and the feature name.
5. Compare newer architecture/operations rulings to the current dependent binding spec, and compare the November design to the repository specification. A disagreement between those two is `SPEC_CONFLICT`.
6. Return exactly one status per decision: `CLEAR`, `CLEAR_WITH_CONSTRAINTS`, `SPEC_VERSION_GAP`, `SPEC_CONFLICT`, `OPEN_DECISION`, `OUT_OF_SCOPE`, or `MISSING_SOURCE`.
7. Implement CLEAR or CLEAR_WITH_CONSTRAINTS only within named work-order limits; block affected parts for other statuses.
8. A disagreement already recorded in `docs/mobile/WO-001C-CONTRACT-GAPS.json` takes its register status, mapped as follows:
   - a founder-ruled `LEGACY_SPEC_DRIFT` (K-2; the K-1 payment ruling is superseded by D24-01, so payment items stay `OPEN_DECISION`), `CONTRACT_DRIFT`, `MISSING_SCHEMA` or `MISSING_ENDPOINT` -> `SPEC_VERSION_GAP`: the ruling exists, and the executable contract has not been reissued;
   - `FOUNDER_DECISION_REQUIRED` or `OPEN_DESIGN_DECISION` -> `OPEN_DECISION` unless later explicit decisions resolve them; apply the current decision and execution gate.
   - `ALIGNED` -> `CLEAR`;
   - `PARTIALLY_ALIGNED` -> `CLEAR_WITH_CONSTRAINTS` for the aligned part only.
   Later explicit decisions can supersede earlier rulings; older evidence alone cannot.

## Non-negotiable interpretation rules

- Never use ADU-PD-01 to override a binding source.
- Never use the prototype to override the November pack. The prototype is UX and presentation only.
- Never resurrect Telegram; ARCH v2.0 removed it.
- Never resurrect the Omnivo name in current code/copy except historical references.
- Do not convert ADU-CON-02 v3.0 pending write-backs into silent edits to DB/API/AUTH/SEC/PRD.
- A founder instruction may authorize an interim ruling, but record the exact source/ruling and the unreissued document debt.

## Output contract

```text
ADULIS SPEC ROUTE
Decision: <short name>
Status: <one status>
Governing source(s): <filename + section>
Current rule: <supported statement>
Constraints: <invariants>
Version gap/conflict/open item: <if any>
Implementation allowed now: YES / NO
Required next action: <specific>
```
