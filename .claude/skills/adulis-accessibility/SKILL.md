---
name: adulis-accessibility
description: >-
  Implements and reviews accessibility across Adulis public web, seller PWA, and mobile, including keyboard/focus, forms, error summaries, semantic HTML, touch targets, screen readers, dynamic text, and state announcements. Use for all new interactive UI and accessibility QA.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.1.0"
---

# Adulis Accessibility


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

All four surfaces: test actual keyboard/focus, native screen readers where available, responsive web 320–1440px, scaling and contrast. English-first; preserve expansion readiness. Use semantic colors; dark foreground on lime, contrast-checked derived text colors; never communicate status by color alone.

## Governing sources (legacy executable references unless noted)
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — binding public-web form/navigation/mobile rules.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — required states/empty states/localisation.
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — mobile/PWA surface behavior.

## Web baseline
- semantic HTML first; ARIA only to fill a semantic gap;
- keyboard-only operation and visible focus;
- logical focus order and skip link where specified;
- 44x44px minimum interactive target where the website spec requires it;
- submit buttons remain enabled so validation can be triggered and explained;
- server-side validation remains authoritative;
- public forms work with JavaScript disabled where governing surface design requires it;
- error summary is a list of links that focuses each invalid field;
- required fields identified before submission;
- no information conveyed by color alone.

## Native baseline
- meaningful accessibility labels/roles/states;
- screen-reader announcement for async success/error/state changes;
- target sizes appropriate for touch;
- dynamic text/large font resilience;
- focus management after navigation/modal/action errors;
- reduced-motion consideration;
- actions distinguishable without color alone.

## Review procedure
1. Identify the primary task and first focus target.
2. Test keyboard/screen-reader path conceptually and with available tooling.
3. Test error path, not only success.
4. Test 200% text/long Amharic strings where applicable.
5. Verify modal/dialog/menu focus trapping/restoration.
6. Check dangerous actions have clear labels and consequences.

## Output contract
```text
ACCESSIBILITY REVIEW
Surface/screen:
Keyboard/touch:
Focus:
Semantics:
Form/error handling:
Screen reader/state announcements:
Text scaling/Ge'ez:
Contrast/non-color cues:
Findings + fixes:
```
