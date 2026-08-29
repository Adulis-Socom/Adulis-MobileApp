# Adulis document authority and fail-closed rules

Use exact filenames when locating source documents. Do not infer a newer revision from an older one.

## Current supplied baseline

- `ADU-00_One_Page_Business_Model_v9_1.md` — current business constitution; supersedes v9.0.
- `ADU-PROJ-01_Project_Documentation_v9_0.md` — current supplied project baseline.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — binding product behaviour.
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — binding seller-surface architecture.
- `ADU-DB-01_Database_and_Data_Model_v1_12.md` — binding database enforcement baseline. Installed at T5; carries ADU-RUL-01's rulings and the fifteen T4 documentation corrections.
- `ADU-API-01_API_Contract_v1_7.md` — binding wire contract baseline. Installed at T5.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_5.md` — binding identity/access baseline. Installed at T5.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — binding browser-security baseline.
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — binding public-website baseline.
- `ADU-CON-02_Seller_Console_System_Design_v3_1.md` — binding architecture/operations record and standing developer manual. Installed at T5.
- `ADU-CON-01_Seller_Console_Source_Analysis_v1_0.md` — analysis and build basis; its §6 endpoint gap register is the build register for missing endpoints; informative, not binding.
- `ADU-CON-02-A1_Capacity_Model_and_Failure_Analysis_v1_0.md` — **binding annex** to ADU-CON-02 v3.0; source of rulings R16–R19 and of the six ADU-CON-05 load tests.
- `ADU-LEG-01_Startup_Designation_and_IP_v1_0.md` — legal/IP baseline; founder working document, not legal advice.
- `ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md` — founder working draft for professional review; do not treat legal conclusions as final legal advice.
- `ADU-PD-01_Adulis_V1_Product_Description_v1_0.md` — descriptive only; never overrides binding documents.

## Authority by question

1. **Product behaviour:** `ADU-PRD-01 v8.5` governs.
2. **Database enforcement:** `ADU-DB-01 v1.12` governs.
3. **API/wire behaviour:** `ADU-API-01 v1.7` governs.
4. **Authentication/authorization:** `ADU-AUTH-01 v2.5` governs.
5. **Seller surface placement:** `ADU-ARCH-01 v2.0` governs.
6. **Browser security:** `ADU-SEC-01 v1.0` governs.
7. **Public website:** `ADU-WEB-01 v1.0` governs, subject to PRD on product facts.
8. **Business doctrine:** `ADU-00 v9.1` governs.
9. **Build/operations sequencing:** `ADU-CON-02 v3.1` governs unless doing so requires an unreissued dependent specification.

## Known version gaps — fail closed

`ADU-CON-02 v3.0` explicitly requires future reissues of:
- ADU-DB-01 -> v1.7
- ADU-AUTH-01 -> v2.1
- ADU-API-01 -> v1.4
- ADU-SEC-01 -> v1.1
- ADU-PRD-01 -> v8.6
- ADU-PROJ-01 -> v9.1
- ADU-DPIA-01 -> v1.1

Examples include the 107-table build target, remembered-device sessions (R17), R16 seller-public-stats table, **R15 ciphertext-returning `render_payment_instructions` (API-side decryption)**, R18 framed evidence streaming, R19 analytics retirement, and related write-backs.

**Rule:** if a requested implementation depends on a v3.0 ruling that has not yet been written into the governing dependent specification, report `SPEC_VERSION_GAP`. Do not silently merge or invent the missing specification. Implementation may proceed only when the governing document is reissued or the founder explicitly authorizes an interim implementation against the named ruling.

## Required statuses

- `CLEAR` — sources agree and implementation may proceed.
- `CLEAR_WITH_CONSTRAINTS` — implementation may proceed under listed invariants.
- `SPEC_VERSION_GAP` — a later ruling exists but the governing dependent spec has not been reissued.
- `SPEC_CONFLICT` — binding documents disagree and no explicit precedence resolves it.
- `OPEN_DECISION` — source marks the decision open or undecided.
- `OUT_OF_SCOPE` — belongs to a later product/version/phase.
- `MISSING_SOURCE` — required source file cannot be located in the repository.

Never convert any non-CLEAR status into code by guessing.
