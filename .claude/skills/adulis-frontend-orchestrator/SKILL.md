---
name: adulis-frontend-orchestrator
description: >-
  Orchestrates Adulis frontend/UI work across public web, seller PWA, mobile Buyer Mode, and Seller Companion. Use for any multi-step frontend feature to select the correct surface, API contract, UI states, design system, i18n, accessibility, security, and performance checks.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis Frontend Orchestrator


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — surface placement.
- `ADU-API-01_API_Contract_v1_3.md` — client contract.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — product behavior.
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — marketing/public-site rules.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — browser security.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — front-end stack/build sequence.

## Surface decision
Classify the requested feature first:
- **Public web/storefront:** anonymous marketing/browse/install conversion.
- **Seller PWA:** create, configure, manage, administer.
- **Buyer Mode:** full buyer commerce experience.
- **Seller Companion:** monitor, communicate, respond, understand; deliberately smaller than PWA.

If a feature is proposed on the wrong surface, stop and report the architecture mismatch before coding.

## Workflow
1. Run spec status check.
2. Identify user, surface, task, success condition, and dangerous actions.
3. Read the API contract; use generated client types rather than handwritten DTOs.
4. Map every server state/error/permission to UI states; do not infer authoritative state.
5. Reuse design tokens/primitives before creating new patterns.
6. Implement loading, empty, offline/stale, success, recoverable error, and terminal states as applicable.
7. Validate English + Amharic/Ge'ez layout.
8. Validate accessibility and low-bandwidth behavior.
9. Validate CSP/session/app-store restrictions for the target surface.
10. Add tests and record contract gaps instead of working around them locally.

## Forbidden behavior
- business-state calculation in client;
- handwritten API response types that duplicate generated contracts;
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
