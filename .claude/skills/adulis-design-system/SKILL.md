---
name: adulis-design-system
description: >-
  Builds and reviews the shared Adulis visual/interaction system across public web, seller PWA, and mobile while preserving platform differences, responsive behavior, translation expansion, accessibility, and approved design tokens. Use for primitives, tokens, reusable components, layout patterns, or visual consistency.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis Design System


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — public-web global interface rules.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — localisation/product states.
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — surface roles.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — shared tokens/primitives direction.

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
