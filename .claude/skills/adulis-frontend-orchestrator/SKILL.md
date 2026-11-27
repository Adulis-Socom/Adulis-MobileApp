---
name: adulis-frontend-orchestrator
description: >-
  Orchestrates Adulis frontend/UI work across public web, seller PWA, mobile Buyer Mode, and Seller Companion. Use for any multi-step frontend feature to select the correct surface, API contract, UI states, design system, i18n, accessibility, security, and performance checks.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.1.0"
---

# Adulis Frontend Orchestrator


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Seller Console -> Mobile (Buyer/Companion/Courier) -> Storefront -> Operator; frontend then backend per surface, Company Website excluded. Pause Mobile while Console active, UNLESS RB27-D01..D08 (controlled parallel execution, `docs/amendments/REBUILD-2026-11-27-CONTROLLED-PARALLEL-EXECUTION.md`) is merged: then Lane 2 builds Mobile, Storefront, Operator frontends one at a time on its own lane branch while Lane 1 builds the Console, and shared resources go through the root coordinator. Preserve conforming code; use typed, dev-only fixtures, no live fallback/release inclusion. Real checkout review; transactional, handoff and purchase-derived flows internal only. Ponytail instead of Superpowers, Impeccable for UI (it follows Adulis requirements). Subscription purchase UI and Payout UI are disabled or deferred (B02-D01/D02); the mobile billing-CTA prohibitions are unchanged. The Reservation model is RETIRED (B02B-D01): no Reservation UI, countdown, cancellation, fixture or API call. The Seller Console is light-theme-first (B02B-D03); Courier invitations remain, live delivery execution is deferred (B02B-D02). CLEAN REBUILD (RB25-D06): the shared platform skeleton (Batch 01B) comes before any new frontend, a limited exception to frontend-first; new frontends are built only on the replacement lineage, never on the legacy API, schema or generated legacy contract.

## Governing sources (legacy executable references unless noted)
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — surface placement.
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — client contract.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product behavior.
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — marketing/public-site rules.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — browser security.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — front-end stack/build sequence.

## Surface decision
Classify the requested feature first:
- **Seller Storefront:** public browse and app handoff; no web checkout. Company Website excluded.
- **Seller PWA:** create, configure, manage, administer.
- **Buyer Mode:** discovery, messaging, Cart and checkout review; transactions deferred.
- **Seller Companion:** monitor, communicate, respond, understand; deliberately smaller than Console.
- **Courier:** mobile context; live delivery deferred.
- **Operator:** separate privileged console, Founder model, inactive Staff variant.

If a feature is proposed on the wrong surface, stop and report the architecture mismatch before coding.

## Workflow
1. Run spec status check.
2. Identify user, surface, task, success condition, and dangerous actions.
3. Read the API contract; use generated client types rather than handwritten DTOs.
4. Map every server state/error/permission to UI states; do not infer authoritative state.
5. Reuse design tokens/primitives before creating new patterns.
6. Implement loading, empty, offline/stale, success, recoverable error, and terminal states as applicable.
7. Validate English and text expansion readiness; Amharic release deferred.
8. Validate accessibility and low-bandwidth behavior.
9. Validate CSP/session/app-store restrictions for the target surface.
10. Add tests and record contract gaps instead of working around them locally.

## Forbidden behavior
- business-state calculation in client;
- handwritten API response types that duplicate generated contracts; separate typed fixture ports permitted for approved missing contracts;
- Seller Companion growing into full seller management;
- billing/price/tier/upgrade surfaces inside mobile;
- fixed-height layouts that clip translation;
- silently hiding an API/spec gap with frontend logic.

## Output contract
```text
FRONTEND FEATURE PLAN
Surface:
User task:
Governing source:
API endpoints/types:
UI state map:
Design-system impact:
I18N/Ge'ez:
Accessibility:
Security/app-store:
Low-bandwidth/offline:
Tests:
Contract/spec gaps:
```
