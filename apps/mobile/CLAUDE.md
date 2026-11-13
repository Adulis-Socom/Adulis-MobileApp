# apps/mobile -- Buyer Mode

**Adulis mobile app. Expo + React Native, TypeScript strict.**
**Governed by `docs/adu/ADU-MOB-01_Buyer_Mode_System_Design_v1_2.md`.**

> **This file CITES the documents. It does not restate them** (`docs/ADU-REPO-01_Repository_Structure_and_Concurrent_Development_v1_3.md` S6). Every rule you need is in a file in this repository now; open it and read the section. One rule is inlined below because ADU-REPO-01 S8 requires this file to carry it, and it is marked. Where an inlined line and its document disagree, **the document wins and this file is corrected.**

---

## 0. The prime rule

**The document is amended first, then the code. Never the reverse.**
`docs/adu/ADU-MOB-01_Buyer_Mode_System_Design_v1_2.md` S0.

If your output disagrees with a governing document, **stop and say so.** Do not resolve the disagreement in code. Record the conflict, naming both sentences and both documents: `docs/adu/ADU-MOB-00_Mobile_Build_Guidelines_v1_1.md` S2.2, RULE 2. Where each kind of conflict is filed: ADU-MOB-00 S2.3.

**MVP means MVP.** ADU-MOB-01 S0.

---

## 1. Which document answers which question

Start every question here. `.claude/reference/DOCUMENT_AUTHORITY.md` says which revision governs; `.claude/skills/adulis-routing/SKILL.md` is the same map as a skill.

| Question | Document |
|---|---|
| What may the app do? The rulings B1 to B26 | `docs/adu/ADU-MOB-01_Buyer_Mode_System_Design_v1_2.md` |
| What does the buyer see, and in what state? MB-00 to MB-39 | `docs/adu/ADU-MOB-02_Buyer_Mode_Content_Architecture_v1_0.md` |
| What is it built from? Tokens, 28 components, D1 to D12 | `docs/adu/ADU-MOB-03_Design_System_and_Component_Inventory_v1_0.md` |
| How are the screens drawn and graded? | `docs/adu/ADU-MOB-04_Wireframe_Generation_Brief_v1_0.md` |
| What must be true to submit to a store? | `docs/adu/ADU-MOB-05_Store_Submission_and_Compliance_Dossier_v1_0.md` |
| Threat model, negative cases, what is actually enforced | `docs/adu/ADU-MOB-06_Security_QA_and_Test_Specification_v1_0.md` |
| How does it run after it ships? Runbooks | `docs/adu/ADU-MOB-07_Release_and_Operations_v1_0.md` |
| How is an AI agent used here? Tooling, subagents, access model | `docs/adu/ADU-MOB-08_AI_Assisted_Engineering_Manual_v1_0.md` |
| How do I work here? Version drift, the local environment | `docs/adu/ADU-MOB-00_Mobile_Build_Guidelines_v1_1.md` |
| What am I building today? Tiers 0 to 2 | `docs/adu/ADU-MOB-WO-01_Buyer_Mode_Work_Orders_Tiers_0_to_2_v1_2.md` |
| Tiers 3 to 5 | `docs/adu/ADU-MOB-WO-02_Buyer_Mode_Work_Orders_Tiers_3_to_5_v1_0.md` |
| Tiers 6 to 8 | `docs/adu/ADU-MOB-WO-03_Buyer_Mode_Work_Orders_Tiers_6_to_8_v1_0.md` |
| What is blocked, and by whom? S4 | `docs/adu/ADU-MOB-PLAN-01_Documentation_Plan_and_Workstream_Register_v1_0.md` |
| Offline was withdrawn: what stays | `docs/adu/ADU-MOB-AMD-01_Offline_Withdrawal_Amendment_Set_v1_0.md` |
| The For You Page is ruled and intentional: what must survive it | `docs/adu/ADU-MOB-AMD-02_FYP_Adoption_Amendment_Set_v1_0.md` |
| The Seller Companion, which ships later into this binary | `docs/adu/ADU-CMP-01_Seller_Companion_Scoping_Record_v0_1.md` |
| Product behaviour | `docs/ADU-PRD-01_Product_Requirements_v8_5.md` |
| Wire behaviour, errors, versioning | `docs/ADU-API-01_API_Contract_v1_11_ASCII.md` |
| Schema and its invariants | `docs/ADU-DB-01_Database_and_Data_Model_v1_19_ASCII.md` |
| Sign-in, sessions, step-up | `docs/ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md`; the permission catalogue and the role matrix are `docs/ADU-AUTH-01_Authentication_and_Authorization_v2_5.md` |
| Which surface owns a screen | `docs/ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` |
| Repository boundaries, the four rules, the three seams | `docs/ADU-REPO-01_Repository_Structure_and_Concurrent_Development_v1_3.md` |
| Personal data, retention | `docs/ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md` |
| Browser security, the one WebView | `docs/ADU-SEC-01_Content_Security_Policy_v1_0.md` |
| Is a missing value deliberately absent? It governs nothing | `docs/registers/ADU-VAL-01_Deferred_Value_Decisions_Register_v1_2.md` |

**Never invent an endpoint, a field, an error code or an event name.** If it is not in `@adulis/api-client`, it does not exist: say so and stop. ADU-MOB-01 S17.5, and ADU-MOB-08 S39 for the shape of the finding to write instead.

---

## 2. The one rule inlined here, and why

> **[inlined]** **No price, tier name, currency figure for a subscription, the word *upgrade*, a purchase flow, or any link, button, banner or deep link to a billing surface exists anywhere in this bundle.**
>
> Authoritative: `docs/adu/ADU-MOB-01_Buyer_Mode_System_Design_v1_2.md` S16 and S16.1, `docs/ADU-API-01_API_Contract_v1_11_ASCII.md` S4.1, `docs/ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` S4.
>
> It is inlined because `docs/ADU-REPO-01_Repository_Structure_and_Concurrent_Development_v1_3.md` S8 names it as this file's content. Read S16.1 for the three ordinary places it leaks; grep gate 7 scans `packages/locale`, not the screens.

---

## 3. What the app must never do

Nine absences, each a thing a competent implementation would add: ADU-MOB-01 S17.5. The longer never-does list: ADU-MOB-01 S15. The content architecture's own version: ADU-MOB-02 S18.

> [!] The absence that deletes too much is absence 2. Read ADU-MOB-01 S9.5 and ADU-MOB-AMD-01 S1.4 before removing anything near `src/store/`, which holds one row.

---

## 4. The seam to the Seller Companion

ADU-MOB-01 S17.3 draws it; `.dependency-cruiser.cjs` and grep gate 6 enforce it. The Companion's own scope is ADU-CMP-01. The scope parameter rule for conversations and notifications is ADU-MOB-01 S7.8 and S7.9.

---

## 5. Before you write anything

- **Start the session from `apps/mobile`, not the repository root.** ADU-REPO-01 S8; ADU-MOB-08 S12. From the root you load the backend's rules and none of these.
- **Do not read into `apps/api`, `apps/console`, `apps/storefront` or `db/`.** The repository-root `.claude/settings.json` denies it (D-25: the settings file moved there with the session). If you need a type from there, you need the published contract instead: `@adulis/api-client`, generated from `contracts/openapi.json`.
- **Never hand-edit** `contracts/openapi.json` or the generated client. ADU-REPO-01 S5.1.
- **A new dependency is a decision, not a code edit.** ADU-MOB-01 B2 and S20.4; the ten questions to answer first are ADU-MOB-08 S21. Record it in `scripts/gates/allowed-dependencies.json`, which grep gate 9 compares to `package.json` in both directions.
- **Do not install or register a global tool, plugin or MCP server.** ADU-MOB-08 S17.6 and S25; ADU-MOB-WO-01 v1.2 WO-0a. That is operator setup.

---

## 6. Stop at the boundary

Build only what the work order lists. When you reach its edge, stop and list what you did not do. ADU-MOB-WO-01 v1.2 S1, and ADU-MOB-01 S17.5's closing paragraph.

A work order's *Do not build* section is not a suggestion about sequencing. If something the work order needs does not exist, say what is missing, name the document that should carry it, and stop. ADU-MOB-08 S39.

---

## 7. Done, and review

Definition of done per pull request: ADU-MOB-00 S9. The printed review checklist: ADU-MOB-01 S17.5. The review model and its named weakness: ADU-MOB-01 S17.5 and ADU-MOB-00 S9.1.

Where a change touches money, identity or a boundary, run the second pass against the document rather than against the diff, with the `product-invariant-reviewer` subagent in `.claude/agents/`. Its brief is ADU-MOB-08 S14.

---

## 8. This repository's own facts, which no document carries

- The fourteen gates are one script, `scripts/gates/run.mjs`, run by `pnpm verify:mobile-gates` and by the `mobile-gates` entry in `ops/scripts/gates.mjs`. The table they implement is ADU-MOB-01 S18.1 and ADU-MOB-03 S8; the readings taken where those tables disagree with their own documents are in `docs/build-status/DEFECT-REGISTER.md`, D-365, D-366, D-367, D-379, D-380 and D-381.
- `DEFERRED-GATES.md` beside this file holds every gate half that needs a device, an emulator, an EAS login or a store account. Tier 3 does not start until it is empty: ADU-MOB-WO-01 v1.2 S1.1.
- `PRIVACY-MANIFESTS.md` lists the third-party iOS privacy manifests in the dependency tree. ADU-MOB-05 S4.3.
- The repository-root `.claude/settings.json` carries the read and edit denials and three deterministic hooks (D-25 moved it there from beside this file, because root-anchored `/path` rules can be written and `../` rules cannot). `README.md` beside this file explains what each hook does; the rule that hooks are deterministic only is ADU-MOB-08 S22.
- The local environment, the OTP log, the mock's base URL and the development-build rule are ADU-MOB-00 S3.

> **Verify the boundary loaded** with `/permissions` and `/context` on the first session in this directory. Project settings load only from the directory you start in, so a root settings file does not apply here. ADU-REPO-01 S8.