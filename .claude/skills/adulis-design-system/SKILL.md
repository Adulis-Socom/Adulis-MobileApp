---
name: adulis-design-system
description: >-
  Builds and reviews the shared Adulis visual/interaction system across public web, seller PWA, and mobile while preserving platform differences, responsive behavior, translation expansion, accessibility, and approved design tokens. Use for primitives, tokens, reusable components, layout patterns, or visual consistency.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.2.1"
---

# Adulis Design System

REPLACEMENT FOUNDATION (Batch 01B): `packages/tokens` is the CTO palette, LIGHT ONLY; the dark mode and the legacy blue accent are removed; action roles are primary, secondary and highlight (lime, dark text, one standout action per screen); `info` is the approved NEUTRAL role, #333846 on #F4F5F7 (RB25-D14): never a new blue or brand-adjacent hue, and always carried by icon, label and text, never colour alone. `pnpm verify:tokens` enforces TS/CSS parity, exact CTO values, retired-theme absence and 36 contrast pairs.


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

Latest CTO palette is working visual direction: primary #111111, secondary #F4F5F7, accent #C4FE29, danger/like #EF4444, gray #7E8494, border #E5E7EB, background #F5F5F7. Use shared semantic tokens, one standout accent action per screen, dark text on lime and contrast-tested derived colors. The prototype terracotta theme is superseded (B02-D03). Authorised variants (B02-D04), adopted only after measured contrast: white #FFFFFF surface, #5B6272 accessible secondary text, #B91C1C accessible danger text, #111111 on lime, stronger control boundaries where the border is the only cue. No per-app palette or unapproved dark theme. Impeccable reviews design but follows these Adulis requirements and never overrides them; where its advice conflicts with this skill, this skill wins and the conflict is reported. Token change needs separate PR.

Measured WCAG contrast (GOV-SKILL-01, 2026-11-25; the base palette is unchanged): #111111 on #C4FE29 15.79, on #F5F5F7 17.34, on white 18.88 (pass). #7E8494 on #F5F5F7 3.43 and on white 3.74: fails 4.5 for ordinary text, passes 3.0 for large text and non-text only. #EF4444 as text on white 3.76 and on #F5F5F7 3.46, and white text on #EF4444 3.76: fails 4.5 for ordinary text. #E5E7EB border on white 1.24 and on #F5F5F7 1.14: decorative only, below the 3.0 non-text contrast needed to identify a control by its border. White on #C4FE29 is 1.2: never. Proposed derived variants, not yet adopted: gray text #5B6272 (5.61 on #F5F5F7), danger text #B91C1C (5.94 on #F5F5F7, 6.47 on white). A shared-token PR must re-measure before adopting them.

## Governing sources (legacy executable references unless noted)
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — public-web global interface rules.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — localisation/product states.
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — surface roles.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — shared tokens/primitives direction.

## Principles
- Reuse tokens/primitives; do not duplicate near-identical components per surface without a platform reason.
- Preserve native interaction conventions in mobile; visual consistency does not mean identical layout.
- Mobile-first where the product/public web specifies low-end Android as binding.
- Content sizes containers. No fixed heights for translated content.
- Latin-first font stack with Ethiopic fallback; never use an Ethiopic-only family as the primary family.
- Every list/form pattern includes empty/error/loading/disabled-or-unavailable semantics where appropriate.
- Distinguish business-state badges from decorative color chips; never encode critical status by color alone.

## Component review checklist
Typography, spacing, target size, focus, hover/pressed, disabled/unavailable semantics, high-density desktop use, 360px behavior, long Amharic strings, numbers/Latin brand names on Amharic pages, reduced motion, contrast, and error placement.

## Forbidden behavior
- fixed-height cards/buttons/forms to force visual alignment;
- runtime CSS-in-JS if it conflicts with current CSP direction;
- new one-off primitives when an existing design token/component covers the need;
- visual treatment that implies trust/safety not supported by product facts.

## Output contract
```text
DESIGN SYSTEM REVIEW
Primitive/pattern:
Surfaces:
Existing component/token reused:
Responsive behavior:
Ge'ez expansion:
Accessibility:
Platform-specific divergence:
New token/component justified: YES/NO
```
