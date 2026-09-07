# Adulis document authority and fail-closed rules

Use exact filenames when locating source documents. Do not infer a newer revision from an older one.

## Current supplied baseline

- `ADU-00_One_Page_Business_Model_v9_1.md` — current business constitution; supersedes v9.0.
- `ADU-PROJ-01_Project_Documentation_v9_0.md` — current supplied project baseline.
- `ADU-PRD-01_Product_Requirements_v8_5.md` — binding product behaviour.
- `ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` — binding seller-surface architecture.
- `ADU-DB-01_Database_and_Data_Model_v1_19_ASCII.md` - binding database enforcement baseline. Installed at T24; v1.19 records the FIRST execution of the privilege model by a non-superuser: fifty migrations as `adulis_migrate`, `db:check` 16/0/0, and the five-line provisioning contract of S4.4b.1 measured rather than reasoned. v1.17 and v1.18 were never installed. Its Appendix A and Appendix B are GENERATED from `db/checks/fixtures/` and `pg_class` and compared by the `appendix` gate. 116 tables, 71 enum types.
- `ADU-API-01_API_Contract_v1_11_ASCII.md` - binding wire contract baseline. Installed at T20: S12's path strings are GENERATED from `contracts/openapi.json` rather than hand-written, and S12's surface markers are gate-compared to `core.permission.surfaces` in both directions. v1.10's substance is carried forward; v1.10 moved to `superseded/` at T22.
- `ADU-CON-03_Seller_Console_Content_Architecture_v1_3.md` - binding console content architecture (T15: three stale passages corrected -- G1.1 on SC-22, G1.6 on SC-25, S2.3's numbering)
- `ADU-RUL-06_Rulings_on_the_T13_Register.md` and `ADU-RUL-07_Contract_Rulings.md` - founder rulings, binding as scoped in each. Installed at T5.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` - binding identity/access baseline for AUTHENTICATION, SESSIONS, RECOVERY, OPERATOR AUTHENTICATION and ABUSE CONTROL. Installed at T22; supersedes v2.7's half. It withdraws v2.7 S20.1's "The lazy path stays", records S20.1a (a grant on a function is not a grant on what the function reads) and corrects S0.3: `IN_APP` has a writer.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_6.md` - SUPERSEDED as a governing document, STILL INSTALLED because a gate parses it: `pnpm verify:transcription` compares migration 0043 to its delivery layer in both directions. Do not move it to `superseded/` for the same reason v2.5 is not moved.
- `ADU-AUTH-01_Authentication_and_Authorization_v2_5.md` - STILL INSTALLED AND STILL CANONICAL, for the PERMISSION CATALOGUE, the 42x6 role-permission matrix and the executable SQL seed. v2.8 S0 supersedes v2.5 in part and leaves these three unchanged, explicitly, and does not reproduce them -- so v2.5 is not superseded and must not be moved to `superseded/`. `pnpm verify:permission-doc` parses it.
- `ADU-SEC-01_Content_Security_Policy_v1_0.md` — binding browser-security baseline.
- `ADU-WEB-01_Public_Website_Specification_v1_0.md` — binding public-website baseline.
- `ADU-CON-02_Seller_Console_System_Design_v3_2_ASCII.md` — binding architecture/operations record and standing developer manual. Installed at T10.
- `ADU-REPO-01_Repository_Structure_and_Concurrent_Development_v1_3.md` — binding repository structure, ownership and the four dependency rules. **Installed at T10, for the first time**: v1.2 was cited 77 times across 33 files -- including the `deps` gate's own title -- and existed in no directory (D-94, D-140).
- `ADU-CON-01_Seller_Console_Source_Analysis_v1_0.md` — analysis and build basis; its §6 endpoint gap register is the build register for missing endpoints; informative, not binding.
- `ADU-CON-02-A1_Capacity_Model_and_Failure_Analysis_v1_0.md` — **binding annex** to ADU-CON-02 v3.0; source of rulings R16–R19 and of the six ADU-CON-05 load tests.
- `ADU-LEG-01_Startup_Designation_and_IP_v1_0.md` — legal/IP baseline; founder working document, not legal advice.
- `ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md` — founder working draft for professional review; do not treat legal conclusions as final legal advice.
- `ADU-RUL-03_Console_Blockers_and_the_NODE_ENV_Class.md` — **binding rulings**, installed at T8. Unblocks D-101, D-102, D-104; adds the D-105 class finding (a guard on an environment nobody sets is not a guard) and two rules (a verification claim names its instrument; a boot smoke test joins the gates). Its S4 carries the age declaration verbatim.
- `ADU-PD-01_Adulis_V1_Product_Description_v1_0.md` — descriptive only; never overrides binding documents.

## Authority by question

1. **Product behaviour:** `ADU-PRD-01 v8.5` governs.
2. **Database enforcement:** `ADU-DB-01 v1.19` governs.
3. **API/wire behaviour:** `ADU-API-01 v1.11` governs.
4. **Authentication/authorization:** `ADU-AUTH-01 v2.8` governs for authentication, sessions, recovery, operators and abuse control; `ADU-AUTH-01 v2.5` remains canonical for the permission catalogue, the 42x6 matrix and the SQL seed. The split is recorded in `docs/amendments/README.md`.
5. **Seller surface placement:** `ADU-ARCH-01 v2.0` governs.
6. **Browser security:** `ADU-SEC-01 v1.0` governs.
7. **Public website:** `ADU-WEB-01 v1.0` governs, subject to PRD on product facts.
8. **Business doctrine:** `ADU-00 v9.1` governs.
9. **Build/operations sequencing:** `ADU-CON-02 v3.2` governs unless doing so requires an unreissued dependent specification.
10. **Repository structure, ownership and the dependency rules:** `ADU-REPO-01 v1.3` governs.

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
