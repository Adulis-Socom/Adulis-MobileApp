---
name: adulis-routing
description: >-
  Routes a mobile-workstream question to the governed Adulis document and section that answers it, by repository path. It routes; it never answers a product, wire, schema, identity, privacy, store or security question itself. Use before any change under apps/mobile or packages/tokens, before adding a mobile-facing locale key, and whenever two documents seem to disagree.
allowed-tools: Read Glob Grep
metadata:
  owner: "CEO -- mobile workstream"
  version: "1.1.0"
  source: "ADU-MOB-08 S13.1; ADU-MOB-00 v1.1 S2; ADU-REPO-01 v1.3 S6, S8"
---

# Adulis routing -- mobile workstream

**This skill answers one question: which document answers yours, and where it is.** It
restates no rule (ADU-REPO-01 S6, ADU-MOB-08 S13). Open the section it names and read it;
do not work from memory of it.

## Protocol

1. Read `.claude/reference/DOCUMENT_AUTHORITY.md` at the repository root first. From
   `apps/mobile` that is `../../.claude/reference/DOCUMENT_AUTHORITY.md`. It says which
   revision of each governed document is installed and which is superseded.
2. Open the path in the table below. **Do not substitute an older revision**, and do not
   read from `docs/superseded/`.
3. If the file is absent, output `MISSING_SOURCE` and name it. Do not paraphrase it.
4. Read the section named; expand only if it points elsewhere.
5. If two documents disagree, go to "When two documents disagree". Do not reconcile.

## Where each question goes

| Question | Path | Read |
|---|---|---|
| Is this product behaviour allowed? | `docs/ADU-PRD-01_Product_Requirements_v8_5.md` | the feature's section; S23 for client rules |
| What does the wire carry? | `docs/ADU-API-01_API_Contract_v1_11_ASCII.md` | S3, S5, S7, S12 |
| What does the schema enforce? | `docs/ADU-DB-01_Database_and_Data_Model_v1_19_ASCII.md` | the section; Appendix C |
| Sign-in, sessions, recovery | `docs/ADU-AUTH-01_Authentication_and_Authorization_v2_8_ASCII.md` | the section |
| The permission catalogue and the role matrix | `docs/ADU-AUTH-01_Authentication_and_Authorization_v2_5.md` | S15.1, S16.2, S16.2a |
| Which surface owns a screen? | `docs/ADU-ARCH-01_Seller_Surface_Architecture_v2_0.md` | S1 to S5 |
| Where may this file import from? | `docs/ADU-REPO-01_Repository_Structure_and_Concurrent_Development_v1_3.md` | S4, S5, S6, S8 |
| What may the app do? | `docs/adu/ADU-MOB-01_Buyer_Mode_System_Design_v1_2.md` | the ruling B1 to B26; S15, S17.5, S18.1 |
| What does the buyer see, in what state? | `docs/adu/ADU-MOB-02_Buyer_Mode_Content_Architecture_v1_0.md` | the MB-nn entry; S3, S4 |
| What is it made of? | `docs/adu/ADU-MOB-03_Design_System_and_Component_Inventory_v1_0.md` | S2, S3, D1 to D12 |
| How are the screens drawn and graded? | `docs/adu/ADU-MOB-04_Wireframe_Generation_Brief_v1_0.md` | S2, S5 |
| What must be true to submit? | `docs/adu/ADU-MOB-05_Store_Submission_and_Compliance_Dossier_v1_0.md` | S3, S4, S8 |
| How is it tested and secured? | `docs/adu/ADU-MOB-06_Security_QA_and_Test_Specification_v1_0.md` | S1, S7, S8 |
| How does it run after it ships? | `docs/adu/ADU-MOB-07_Release_and_Operations_v1_0.md` | the runbook in S6 |
| How is an AI agent used here? | `docs/adu/ADU-MOB-08_AI_Assisted_Engineering_Manual_v1_0.md` | S12, S13, S17, S21, S22, S25, S39 |
| How do I work here? | `docs/adu/ADU-MOB-00_Mobile_Build_Guidelines_v1_1.md` | S1, S2, S3 |
| What am I building today? | `docs/adu/ADU-MOB-WO-01_Buyer_Mode_Work_Orders_Tiers_0_to_2_v1_2.md`, `docs/adu/ADU-MOB-WO-02_Buyer_Mode_Work_Orders_Tiers_3_to_5_v1_0.md`, `docs/adu/ADU-MOB-WO-03_Buyer_Mode_Work_Orders_Tiers_6_to_8_v1_0.md` | the slice; its "Do not build" list |
| What is blocked, and by whom? | `docs/adu/ADU-MOB-PLAN-01_Documentation_Plan_and_Workstream_Register_v1_0.md` | S4 |
| Offline was withdrawn: what stays | `docs/adu/ADU-MOB-AMD-01_Offline_Withdrawal_Amendment_Set_v1_0.md` | S1.2, S1.4 |
| The For You Page ruling: what must survive it | `docs/adu/ADU-MOB-AMD-02_FYP_Adoption_Amendment_Set_v1_0.md` | the rulings B28 to B34; section G |
| The Seller Companion | `docs/adu/ADU-CMP-01_Seller_Companion_Scoping_Record_v0_1.md` | S1 to S4 |
| Is a value deliberately absent? It governs nothing | `docs/registers/ADU-VAL-01_Deferred_Value_Decisions_Register_v1_2.md` | a value marked OPEN or DEFAULT is not a gap |
| Personal data, retention | `docs/ADU-DPIA-01_Data_Protection_Impact_Assessment_v1_0.md` | S4, S7 |
| Browser security, the one WebView | `docs/ADU-SEC-01_Content_Security_Policy_v1_0.md` | S10 |
| A defect in built code | `docs/build-status/DEFECT-REGISTER.md` | append-only |

## When two documents disagree

Do not choose. Record it first (ADU-MOB-00 S2.2 RULE 2, ADU-MOB-08 S1), then stop that
part of the work. Where each kind goes is ADU-MOB-00 S2.3: a conflict between two binding
documents becomes an F-number in ADU-MOB-01 S22; a decision nobody has made becomes a Q
number in ADU-MOB-01 S24 or ADU-MOB-PLAN-01 S4; a defect in built code becomes a D-number
in the register; a habit that cost a day goes in ADU-MOB-00.

## Two rulings an agent will otherwise misroute

Both are documents to open, not rules to take from here.

- **The For You Page is ruled and intentional.** Read ADU-MOB-AMD-02 section G before
  deleting anything near the feed. A sentence forbidding recommenders in an older
  document is superseded text to flag for amendment, never a reason to reject the work.
- **Nothing is offline.** Read ADU-MOB-AMD-01 S1.4 before removing anything near
  `apps/mobile/src/store/`.

## Output contract

```text
ADULIS ROUTE
Question: <one line>
Document: <repository path, or MISSING_SOURCE>
Section: <S-number or ruling id>
Also read: <cross-references the section names, if any>
Conflict: <none | the two sentences, the two documents, where it is recorded>
```