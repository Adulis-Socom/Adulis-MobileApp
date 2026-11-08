# Repair report - November 8 reconciled system-design pack

Repair date: 9 November 2026

## Why this edition was rebuilt

The earlier November archive was ZIP-valid, but it contained a large, deeply nested working-tree structure (renderer caches, temporary scripts, historical nested archives, and bundled renderer font files). On Windows, the combination of a long extraction location plus long internal paths can produce extraction/opening failures that look like file corruption. The previous deliverable also contained internal build artifacts that were not needed by a consumer of the system-design manuals.

## Repairs applied

1. Rebuilt all 34 current PDFs from the November 8 editable JSON/Markdown source set.
2. Rewrote each rebuilt PDF with a clean object/xref structure using PyMuPDF.
3. Renamed deliverable files to short portable identifiers (for example `ADU-MOB-02_v4.3.pdf`). `FILE_INDEX.csv` maps every portable filename to the original full filename/title.
4. Removed Python caches, renderer temp directories, nested historical ZIPs and renderer font binaries from the deliverable.
5. Kept all 34 complete Markdown sources and all 34 complete JSON sources.
6. Kept the current editable SVG graphics and current contract/static registry.
7. Kept only current November reconciliation/correction/validation reports in the main package; old October evidence is intentionally not duplicated.
8. Generated new SHA-256 checksums after repair.

## Validation performed on the repaired edition

- ZIP/archive compression test: PASS.
- PDFs: 34/34 present.
- Markdown sources: 34/34 present.
- JSON sources: 34/34 present.
- SVG graphics: 217 parsed successfully.
- Every PDF opened and every page was traversed/text-decoded with PyMuPDF: PASS.
- Every PDF was fully parsed by Ghostscript with `-dPDFSTOPONERROR` and a null-page device: PASS.
- Every PDF passed `pdfinfo`: PASS.
- All current JSON files parse as UTF-8 JSON: PASS.
- All current Markdown/CSV/code text files pass UTF-8 and NUL-byte checks: PASS.
- First and last pages of all 34 PDFs were raster-rendered and visually reviewed: PASS.

## Result

**PASS - repaired portable edition.**

The system-design content was not changed by this repair. The repair only rebuilds/normalizes the generated files and improves package portability.
