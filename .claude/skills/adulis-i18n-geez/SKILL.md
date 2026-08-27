---
name: adulis-i18n-geez
description: >-
  Implements and reviews Adulis English/Amharic localisation, Ge'ez layout resilience, complete-sentence message resources, API error keys/slots, font fallback, and untranslated-key handling. Use whenever adding or changing user-visible strings or localized layouts.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.0.0"
---

# Adulis I18N + Ge'ez


## Shared source protocol

Before acting:
1. Read `${CLAUDE_PROJECT_DIR}/.claude/reference/DOCUMENT_AUTHORITY.md` if present.
2. Locate the exact governing filenames listed below with `Glob`. Do not substitute an older revision when a newer named revision is required.
3. Read only the relevant sections first; expand if necessary.
4. If a required source is absent, output `MISSING_SOURCE` and name it.
5. If the task crosses a known unreissued-spec boundary, output `SPEC_VERSION_GAP` and do not guess.


## Governing sources
- `ADU-PRD-01_Product_Requirements_v8_5.md` — localisation/font invariant.
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — public-site translation/form/layout rules.
- `ADU-API-01_API_Contract_v1_3.md` — message_key + slots and locale completeness.
- `ADU-CON-02_Seller_Console_System_Design_v3_0.md` — shared locale catalogue/CI.

## Rules
- Latin family first; Ethiopic fallback second. Preserve digits, ADULIS, TikTok, Instagram and mixed-script strings.
- No translated-fragment concatenation. Every resource is a complete sentence/template with named slots.
- API errors resolve from stable message keys and typed slots, not server-rendered English.
- No fixed-height container whose content can expand in Amharic.
- Public site: do not machine-translate missing Amharic copy when the website spec says fallback to English pending human translation.
- Missing locale keys must be visible in CI; do not hide them with arbitrary inline fallback strings.
- Test long realistic Ge'ez text, Latin brand names, digits, dates, money and mixed strings.

## Workflow
1. Add English key/template first with named slots.
2. Determine whether Amharic translation is approved/human-supplied or should intentionally fall back.
3. Run locale completeness policy appropriate to the surface/contract.
4. Test 360px/mobile and dense desktop layouts.
5. Check labels, validation messages, error summaries, buttons, tabs, tables, badges and empty states.

## Forbidden behavior
- string concatenation that assumes English word order;
- raw API prose as translation source;
- Ethiopic-only primary font family;
- reducing font size to hide overflow rather than fixing layout;
- inventing machine-translated legal/product copy where sources prohibit it.

## Output contract
```text
I18N REVIEW
Keys/templates changed:
Slots:
Amharic status: APPROVED / FALLBACK / MISSING-BLOCKER
Font/mixed-script check:
Expansion/360px check:
API key completeness:
Layout fixes:
```
