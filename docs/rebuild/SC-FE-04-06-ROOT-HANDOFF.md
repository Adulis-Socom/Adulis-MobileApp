# SC-FE-04 / 05 / 05S / 06 -- root handoff (taxonomy status, locale requirements)

Prepared 26 November 2026 by the root workstream. Source documents only; no feature code, nothing invented.

## 1. Taxonomy source status (RB-B02B-06)
The CMO/CSO archive (expected `G:\AdulisDevelopment\Inputs\Taxonomy\Adulis taxonomy - Copy.zip`) was NOT found on the SSD
when this was written (searched `G:\AdulisDevelopment`, depth 4). No source manifest or checksums exist because there is no
file to checksum. When it is supplied: put it in its OWN new directory, never extract into the repository, record SHA-256 per
workbook (expected: 76 workbooks), and classify every item into exactly one class below. It is incomplete and unratified.

| Class | What it is | Today |
|---|---|---|
| Governing category architecture | CATINV-01 v3.3 S40-S41: stable category identity, typed category-scoped attributes, backend publication blockers | design exists, no attribute list |
| Submitted CMO/CSO definitions | workbook content as received | none received |
| Founder-approved definitions | explicitly ratified items | only the three top-level codes FASHION, COSMETICS, ELECTRONICS (legacy lineage) |
| Provisional fixture definitions | synthetic, ids `fx_`, labelled "demonstration category" | to be written by SC-FE-04, never presented as official |
| Missing definitions | Cosmetics and Electronics attributes; Fashion subcategories (TAX-GAP-01..05) | open |
| Unresolved publication requirements | "category-specific required attributes" (CATINV-01) | rule exists, content undefined |

Editor contract (independent of the missing content): the Console hard-codes no category, attribute, allowed value or required
rule. All four arrive in the server/fixture response (category list, attribute definitions with type/required/allowed values,
publication blockers). One canonical attribute payload feeds Product editing, Search, filtering, recommendation and any later
scripted assistance; there is no second taxonomy. Missing official content blocks ONLY that category's acceptance; the generic
editor, Inventory, Scene, Story and Store work proceeds. Never declare the taxonomy complete.

## 2. Shared locale requirements
Full inventory (DRAFT, with section citations): `G:\AdulisDevelopment\WO-REBUILD-20261126-02B\reports\locale_requirements_SC-FE-04-06_DRAFT.md`.
Findings that matter to the Console session:
- Almost no copy is governed verbatim. Quoted in the designs: "Update stock" and "Confirm stock is accurate" (CON S53); Scene tabs
  and the Private badge (CON S59); "All tagged Products are currently out of stock." (CON S59, S121); two Scene notification texts
  (CON S121); public stock labels (CATINV S66). Everything else needs approved copy. Stories (SC-FE-05S) and Store/Courier
  (SC-FE-06) have none.
- No shared-package PR was opened: writing the rest would be inventing copy. When the Console session needs a key, checkpoint the
  exact key and proposed English to the root workstream; a shared change is its own PR (both languages, Amharic PENDING).
- Design disagreements NOT resolved here (need a ruling): `PRODUCT_TAG_REQUIRED` (SCN) vs `SCENE_PRODUCT_TAG_REQUIRED` (CATINV);
  `ALL_TAGGED_PRODUCTS_UNAVAILABLE` (SCN) vs `ALL_TAGGED_PRODUCTS_OUT_OF_STOCK` (CON, CATINV); two TikTok error-code sets
  (CATINV vs MEDIA); FUL S13 courier options vs CON "Private Courier Pools"; Story link "at most one" (STORY) vs "one" (CON).
- No strings for retired concepts: Reservation or stock hold, payment/PAID/payout, GMV, purchase-derived reviews, Courier pay.
