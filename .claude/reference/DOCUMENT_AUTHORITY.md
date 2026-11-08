# Adulis document authority and fail-closed rules

Use exact filenames when locating source documents. Do not infer a newer revision from an older one.

## Precedence (founder decision, WO-001B, 9 November 2026)

1. **The founder's current explicit decisions**, including the accepted WO-001 / WO-001A decisions.
2. **The November 8 2026 reconciled system-design pack**: `docs/system-designs/2026-11-08/`, 34 complete designs, indexed with exact versions in `docs/system-designs/README.md`. In each of the 24 updated designs, the final "Post-October-13 reconciliation - current authority" section wins over earlier passages of that design for the topics it lists.
3. **The pack's November reconciliation and open-decision reports**: `Reports/POST_OCT13_RECONCILIATION_2026-11-08.md` (R-01 to R-23), `CORRECTION_SUMMARY_2026-11-08.md`, `OPEN_DECISIONS_AND_RELEASE_GATES.md`, `AMENDMENT_REPORT.md`.
4. **The approved prototype** (`AdulisCommercePlatformPrototype`, `dev` @ `f448d06`), for UX and presentation only. It never restores a rule the pack has replaced, such as its stale 0.5% surcharge or its "Account model unresolved" line (R-22, R-23).
5. **Older October and repository documentation**: the repository specification set listed below.

**What position 5 means for the repository specification set.** Those documents stay installed and are not moved. Several are parsed by gates (`verify:permission-doc`, `verify:transcription`, `appendix`, `deferred-values`, `surface-markers`, `docs-ascii`). ADU-DB-01 v1.19, ADU-API-01 v1.11 and `contracts/openapi.json` describe what is **built**, and they remain the executable contract for it. They no longer decide design intent where the pack speaks.

**Where the pack and the built system or repository specification disagree, the status is `SPEC_CONFLICT`.** Report it and stop that part of the work. Never change backend, database, API or client behaviour to match either side without a founder work order. The pack itself classes these gaps as implementation-contract corrections (R-20, R-21), and they are made by work order, not in passing.

## Known conflicts: November pack vs repository (recorded WO-001B; founder ruling or work order required)

Found while installing the pack, not by a full audit. The contract readiness audit owns the complete comparison. Absence from this list is not evidence of agreement.

| # | November pack (current design) | Repository / built system | Status |
|---|---|---|---|
| K-1 | **Payment.** Chapa gateway checkout; provider/backend verification is the canonical payment authority; no fallback to manual bank-transfer confirmation; no Seller role confirms payment (KB v3.3, FIN-01 v3.3, ORDER-01 v3.3, R-12) | PRD v8.5 puts a buyer payment gateway out of V1 scope and has the buyer pay the seller directly; the backend and console implement seller payment confirmation; the `adulis-seller-companion` skill's Phase-1 scope includes `Confirm Payment Received` | `SPEC_CONFLICT` |
| K-2 | **Discovery.** Scene-only For You feed with algorithmic ranking, Following, Nearby, Discounts, Locally Made (MOB-02 v4.3, REC-01 v3.2, R-03) | PRD v8.5 lists marketplace discovery and ranking as V3, out of V1 scope | `SPEC_CONFLICT` |
| K-3 | **Background execution.** BullMQ on Valkey is the sole ordinary engine, with "no Graphile Worker"; Valkey for rebuildable cache and rate coordination (ARCH-PLATFORM-01 v3.3, DEPLOY-01 v3.2, EVT-01 v3.2) | `graphile-worker` in PostgreSQL (`apps/api`); `STACK_BASELINE.md` and root `CLAUDE.md` reject Redis without a reissued binding architecture decision | `SPEC_CONFLICT`. Do not add Valkey or BullMQ, and do not remove graphile-worker |
| K-4 | **Courier audience.** One ordinary MOBILE session, Courier as a verified relationship (AUTH-02 v3.3, MOB-02 v4.3, R-20) | ADU-API-01 v1.11 S4 puts the Courier surface on `audience = CONSOLE`; the S12.17 Courier endpoints publish no response schemas | Contract correction owed (R-20). Mobile calls no Courier endpoint until it lands |
| K-5 | **Mode eligibility and client types.** Bootstrap exposes authoritative relationship/capability data for mode availability; the generated client exports path types (R-21) | No such bootstrap field; `@adulis/api-client` exports no generated path types (WO-001 gaps CG-1, CG-3) | Contract correction owed (R-21) |
| K-6 | **Same subject, different lineage.** AUTH-02 v3.3, CONSOLE-02 v4.3, CSP-01 v1.1, WEB-02 v4.2, DPIA-01 v1.1 | AUTH-01 v2.8/v2.5, CON-02 v3.2, SEC-01 v1.0, WEB-01 v1.0, DPIA-01 v1.0 | The pack governs design intent (position 2). Neither document states that it supersedes the other, and DPIA-01 is the same ID on two separate lineages. The repository copies stay installed for their gates |
| K-7 | **Encoding.** The designs are UTF-8 with non-ASCII typography | Amendment A3.5: ADU specifications are ASCII | Installed verbatim; reported by `verify:docs-ascii` as carried debt, not enforced. Founder decides whether ASCII copies are owed |

## Repository specification set (position 5 above)

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

**For design intent, read the November pack's design for the domain first** (index: `docs/system-designs/README.md`). The list below names the repository document for each question. Read it for what the built system implements and what the gates check. Where it disagrees with the pack, the status is `SPEC_CONFLICT` (see above).

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
