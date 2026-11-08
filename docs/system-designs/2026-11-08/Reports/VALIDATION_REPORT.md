# Validation report — 8 November 2026

- Complete designs: **34**
- Updated designs: **24**
- Unchanged designs: **10**
- PDFs / Markdown / JSON: **34 / 34 / 34**

## Rebuild

- All 34 PDFs rebuilt successfully from bundled JSON sources using the supplied renderer.
- Every updated document contains a final normative Post-October-13 reconciliation section.

## Critical semantic checks

- KB_zero_surcharge: **PASS**
- KB_account: **PASS**
- AUTH_three_context: **PASS**
- MOB_app_id: **PASS**
- MOB_three_modes: **PASS**
- SCN_zero_tag: **PASS**
- SCN_private: **PASS**
- FUL_eligibility: **PASS**
- MKT_locale: **PASS**
- FIN_zero: **PASS**
- WEB_fee_guard: **PASS**

## Contract/static validators

- Contract/event/permission static fixture validator: **PASS**.
- Handoff field/index/FK static validator: **PASS**.
- These validators remain specification/static fixtures; they do not claim deployed runtime, provider, migration or PostgreSQL execution.

## Visual QA

- **PASS** — Rendered cover + last two pages of every updated PDF into four contact sheets; inspected at readable scale. Also inspected full-size cover/final pages for MOB, KB, SCN, AUTH, FUL and WEB.
- No clipping, overlap, missing glyphs, broken tables, footer/header collision or unreadable amendment pages observed.

## Result

**PASS**

Historical October validation artifacts are retained under `Historical_Evidence/October_13_Validation/` for traceability only.