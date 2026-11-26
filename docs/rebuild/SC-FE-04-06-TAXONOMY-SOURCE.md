# SC-FE-04..06 -- taxonomy source (RB-B02B-06): status and where the evidence is

26 November 2026. ASCII only. The CMO/CSO archive was supplied and fingerprinted this session. It is SUBMITTED and UNRATIFIED.

- Archive: `Adulis taxonomy.zip` (the brief calls it `Adulis taxonomy - Copy.zip`), SHA-256
  `377aba802a39b0b37c4066cb37254fe01184c80bea787336f3607492147c47a9`, equal to the expected value. 77 `.xlsx` entries, 76 valid workbooks;
  the 77th is an Excel lock file (`~$Fashion_Categories.xlsx`).
- Summary manifest in this repository: `docs/rebuild/taxonomy/TAXSRC-v1.summary.json` (per-workbook SHA-256, class, sheets, every attribute header
  with its value count; the 15,705 allowed values are kept in the full manifest with the batch evidence, matched by the same hashes).
- Classes: 1 major-category workbook (Fashion, Cosmetics, Electronics: founder-approved), 3 category lists (26 categories), 6 subcategory
  lists (Fashion only, 72 subcategories), 66 attribute workbooks (1,374 attribute columns).
- Gaps: 20 of 26 categories have no subcategory list (Fashion Accessories, Shapewear, Traditional Clothing; all 7 Cosmetics; all 10 Electronics);
  6 listed subcategories have no attribute workbook (Outdoor and Utility Bags; Kids Swimwear, School Uniforms, Traditional Clothing, Baby Clothing; Unisex Shoes).
- Nothing in the workbooks says whether an attribute is required, searchable, filterable, comparable or Variant-defining, or whether a value is a
  choice, a free-text prompt or a measured field. The Console therefore hard-codes none of it: category tree, attribute definitions,
  allowed values, required flags and publication blockers all arrive in the server (or fixture) response.
- Unresolved decisions TX-01..TX-10 and 12 data-quality findings: batch report 16. Conflicts: report 17.
