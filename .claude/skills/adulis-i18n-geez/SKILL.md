---
name: adulis-i18n-geez
description: >-
  Implements and reviews Adulis English/Amharic localisation, Ge'ez layout resilience, complete-sentence message resources, API error keys/slots, font fallback, and untranslated-key handling. Use whenever adding or changing user-visible strings or localized layouts.
allowed-tools: Read Glob Grep Edit Write
metadata:
  owner: "COO-CTO-frontend"
  priority: "P0"
  version: "1.2.0"
---

# Adulis I18N + Ge'ez

REPLACEMENT FOUNDATION (Batch 01B): `packages/locale` is a clean English-first catalogue; `am` entries are `{ status: 'PENDING' }` or `{ status: 'REVIEWED', text }` (machine-translated placeholders are not carried); `PUBLIC_LOCALES` is `['en']` until every entry is REVIEWED; `format(key, slots)` types slots from the English string; `test/catalogue.test.mjs` holds the mobile import boundary and slot agreement. Legacy screen copy is not imported; each surface adds verified keys.


## Shared source protocol

Read `.claude/reference/CURRENT_MVP_AUTHORITY.md` and `DOCUMENT_AUTHORITY.md` from the repository root. Locate the founder-provided Nov24 pack (or configured `ADULIS_SPEC_ROOT`), read `Governance/DECISION_REGISTER_2026-11-24.md` and applicable `Effective_Current_Designs/Markdown` amendment before the Nov8 body. If the necessary source cannot be read, report `MISSING_SOURCE`; do not guess. Historical executable references below describe what is built, not contrary design authority. Missing live contracts are `SPEC_VERSION_GAP` or `CONTRACT_GAP`; approved frontend-only typed fixtures may proceed without inventing a live contract. Confirm named work-order scope before editing. Preserve existing permission denials and safeguards.

## Current MVP constraints — 24 November 2026

English-first MVP, public Amharic deferred until human review. Preserve locale keys, named slots, Unicode, mixed-script readiness and existing completeness checks. Clearly distinguish placeholders from approved translation; no fabricated legal copy or public Amharic activation.

## Governing sources (legacy executable references unless noted)
- `ADU-PRD-01_Product_Requirements_v8_5.md` — localisation/font invariant.
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — public-site translation/form/layout rules.
- `ADU-API-01_API_Contract_v1_11_ASCII.md` — message_key + slots and locale completeness.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — shared locale catalogue/CI.

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
Amharic status: DEFERRED / PLACEHOLDER / HUMAN-APPROVED / MISSING-BLOCKER
Font/mixed-script check:
Expansion/360px check:
API key completeness:
Layout fixes:
```
