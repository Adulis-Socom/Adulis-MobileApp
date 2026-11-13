# ADU-MOB-PLAN-01 -- Buyer Mode: Documentation Plan and Workstream Register

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Status:** **Planning record for the mobile workstream. Not itself a specification.** It decides what documents exist, what each is allowed to decide, and in what order they are read. **It decides no app behaviour.**
**Supersedes:** nothing.
**Registers:** ADU-MOB-AMD-01, ADU-MOB-00 v1.1, ADU-MOB-01 v1.1, ADU-MOB-02 v1.0, ADU-MOB-03 v1.0, ADU-MOB-04 v1.0, ADU-MOB-05 v1.0, ADU-MOB-06 v1.0, ADU-MOB-07 v1.0, ADU-MOB-WO-01 v1.1, ADU-MOB-WO-02 v1.0, ADU-MOB-WO-03 v1.0
**Encoding:** ASCII.

---

## 0. What this document is

**ADU-BOT-00 is the model for this document, with one difference that changes everything about how it should be read.**

### 0.1 It was written last, and that is the first finding

**ADU-BOT-00 was written before its series existed. This was written after.** Twelve documents were produced in a week, each reading the ones before it, and **this is the index arriving at the end rather than the plan arriving at the start.**

**That was not a mistake and it was not free.** S13 says what it cost, in specific terms, so the next workstream can decide deliberately rather than by accident.

**What it produces:**

1. **The register** -- every document, what it decides, what it is *not* allowed to decide (S1).
2. **What is registered and deliberately unwritten**, with its trigger (S2).
3. **The dependency graph and the critical path to a first submission** (S3).
4. **One consolidated decision register**, deduplicated across all twelve documents (S4).
5. **One consolidated findings register**, grouped by failure class rather than by document (S5) -- and the reissue debt that follows from it (S6).

### 0.2 How to read the series

**Three entry points, and they are different documents:**

| Reader | Start at |
|---|---|
| **Deciding whether the app may do something** | ADU-MOB-01 -- the rulings |
| **Building a slice today** | ADU-MOB-WO-01/02/03, then the sections each names |
| **Wondering what is blocked and by whom** | **This document, S4** |

---

## 1. The register

**Twelve documents in five groups.** Each entry states what it decides and, where it matters, **what it is not allowed to decide** -- a document that rules outside its line is the drift ADU-PROJ-01 S13.5 warns about.

### Group A -- Governance and doctrine

#### ADU-MOB-PLAN-01 -- Documentation Plan and Workstream Register
**This document.** Decides what documents exist and how the series is maintained. **Decides no app behaviour and no schedule.**
**Status:** issued v1.0

#### ADU-MOB-00 -- Mobile Build Guidelines
**Decides:** how to work. Version-drift discipline, the conflict-recording rule, the local environment, the facts in the binding set that are easy to misread, the administrative track's existence, and what "done" means.
**Does not decide:** anything about the product. It is habits, not architecture.
**Owner:** CEO  -  **Status:** issued **v1.1**
**Note:** v1.1 struck three things v1.0 asserted -- an offline requirement assigned to the wrong mode, a cryptographic primitive that exists in no document, and an instruction not to register findings.

#### ADU-MOB-AMD-01 -- Offline Withdrawal Amendment Set
**Decides:** the withdrawal of offline capability in full, across eight documents, plus **the five things that must not be deleted with it**.
**Status:** issued v1.0. **Applied to ADU-MOB-01 v1.1 and ADU-MOB-00 v1.1; still owed by six others** (S6).

### Group B -- Architecture

#### ADU-MOB-01 -- Buyer Mode System Design, Build and Operations Guide
**Decides:** what the app is and, mostly, what it must not do. Twenty-three live rulings, the technology register, the surfaces and their constraints, the repository seam, the build tiers and the CI gates. **The binding architecture record for this workstream.**
**Does not decide:** screens, copy, components, or the store relationship in operational detail.
**Blocks:** everything.
**Status:** issued v1.1. **Owes v1.2** -- five corrections from three later documents (S6).

### Group C -- Design

#### ADU-MOB-02 -- Content Architecture
**Decides:** what a buyer sees, where, and in what state. Forty screens, fourteen states, twelve rulings, the empty-state catalogue, and the copy that is an invariant.
**Does not decide:** visual design, components, or architecture. **Where it and ADU-MOB-01 disagree, ADU-MOB-01 wins.**
**Blocks:** ADU-MOB-03, ADU-MOB-04, and every work order from tier 3 on.
**Status:** issued v1.0

#### ADU-MOB-03 -- Design System and Component Inventory
**Decides:** what those screens are made of. Twelve rulings, twenty-eight components, and **the values in `packages/tokens`, which the console has imported for months and no document had authored.**
**Does not decide:** any screen, any copy, any brand identity beyond the token roles.
**Blocks:** ADU-MOB-04, and WO-0's token package.
**Status:** issued v1.0

#### ADU-MOB-04 -- Wireframe Generation Brief
**Decides:** how the screens get drawn, and **how the drawings are graded.** Eight rulings, forty briefs, ten paste-ready prompts, three rounds.
**Does not decide:** anything binding. **No wireframe is a source of truth.**
**Produces:** **ADU-MOB-04-R1** (S2).
**Status:** issued v1.0. **Not yet run.**

### Group D -- Assurance and compliance

#### ADU-MOB-05 -- Store Submission and Compliance Dossier
**Decides:** the administrative track, the declarations, review access, the rejection register and the paperwork gate. **Every external fact is dated and sourced, and the document expires.**
**Does not decide:** any product behaviour. Where it and a product document disagree, the product document governs.
**Blocks:** the first submission, and nothing before it.
**Status:** issued v1.0. **Re-verify S1, S4 and S5 in the week before submission.**

#### ADU-MOB-06 -- Security, QA and Test Specification
**Decides:** the device-side security posture, the threat model, the twenty negative cases, the test layers and **the audit of which rulings are actually enforced.**
**Is:** ADU-QA-01's mobile chapter. **Its IDs, severities and defect standard are ADU-QA-01's, unchanged.**
**Blocks:** the release-gate evidence pack.
**Status:** issued v1.0

#### ADU-MOB-07 -- Release and Operations
**Decides:** the procedures behind ADU-MOB-01 S19-S21's rules. Seven rulings, eight runbooks, the monitoring model without a crash SDK, and **the continuity minimum.**
**Does not decide:** any rule ADU-MOB-01 already sets.
**Status:** issued v1.0

### Group E -- Execution

#### ADU-MOB-WO-01 / -02 / -03 -- Work Orders, tiers 0-8
**Decide:** nothing. **Working instruments.** Each slice names what to read, what to build, what not to build, the absences that bind it, a two-halved gate and a review checklist.
**Status:** WO-01 issued **v1.1**; WO-02 and WO-03 issued v1.0.
**Note:** **tier 9 is not a work order.** Hardening and submission are ADU-MOB-05 S8 and ADU-MOB-06 S11.

---

## 2. Registered and deliberately unwritten

**Listed so they are not forgotten and not started early. Each has a trigger.**

| ID | Document | Trigger | Why not now |
|---|---|---|---|
| **ADU-MOB-04-R1** | Wireframe Rulings Register | **After round 2 of ADU-MOB-04.** Reissues ADU-MOB-02 to v1.1 and ADU-MOB-03 to v1.1 in one pass | It records defects that drawing finds. **Writing it before the drawing is inventing its own content** |
| **ADU-CMP-01** | Seller Companion System Design | **After the buyer app ships**, on beta evidence rather than assumption (ADU-ARCH-01 S3.1) | The seam is drawn in ADU-MOB-01 S17.3 so the boundary exists; the document waits for the evidence |
| **ADU-MOB-08** | Post-launch tuning record | The first month where a counter in ADU-MOB-01 S20.3 moves unexpectedly | It would be written from invented numbers |

> **[!] Writing any of these before its trigger fires means inventing the data it is meant to be derived from.** ADU-BOT-00's Group G makes the same point, and it is worth restating because **the temptation is strongest when the build is late and writing feels like progress.**

---

## 3. Sequence and critical path

```text
ADU-MOB-AMD-01   the withdrawal
     |
     v
ADU-MOB-00 v1.1  how to work
     |
     v
ADU-MOB-01 v1.1  what the app is        <- binding; blocks everything
     |
     +-------------------+-------------------+
     |                   |                   |
     v                   v                   v
ADU-MOB-02          ADU-MOB-05          ADU-MOB-06
screens, states     submission          security, QA
     |              (parallel,               |
     v               long lead)              |
ADU-MOB-03                |                  |
components, tokens        |                  |
     |                    |                  |
     v                    |                  |
ADU-MOB-04                |                  |
wireframe brief           |                  |
     |                    |                  |
     v                    |                  |
ADU-MOB-04-R1  -----> reissues -02 and -03   |
     |                    |                  |
     +--------------------+------------------+
                          |
                          v
            ADU-MOB-WO-01 / -02 / -03
                       BUILD
                          |
                          v
         ADU-MOB-05 S8  +  ADU-MOB-06 S11
              the two submission gates
                          |
                          v
                    FIRST SUBMISSION
                          |
                          v
              ADU-MOB-07  operations
                          |
                          v
              ADU-CMP-01  (triggered)
```

### 3.1 The critical path is not the documents

**Every document in this series is written.** The chain that decides when an app exists runs through three things, none of which is a writing task:

```text
  an international card that works for both stores      <- no owner
        |
        v
  the domain            <- blocks App Links, the deletion URL,
        |                  the privacy policy URL, AND Apple
        |                  organization enrolment
        v
  D-U-N-S (7 business days)  ->  enrolment  ->  submission
```

**In parallel, and equally unstarted:** the reference devices, which gate the device half of **every** work-order gate, and therefore gate tier 3.

> **The build is not the constraint and has not been for a week.** Nine work orders can start today against the local API. **What cannot start is finishing**, because half of every gate is a physical device nobody has ordered and every submission is behind a card payment nobody owns.

---

## 4. The consolidated decision register

**Every open decision in the series, deduplicated.** Where the same item appeared in three documents it appears once here, with everything it blocks.

**Ranked by what it blocks.**

### 4.1 Blocking the critical path

| # | Decision | Blocks | Source |
|---|---|---|---|
| **D1** | **The international card for both store fees** | **Everything downstream.** Neither store accepts an application from an account that cannot pay | ADU-PROJ-01 S9.2, MOB-05 Q1 |
| **D2** | **Confirm Apple enrolment is available to an Ethiopian entity** | The entire iOS half. **Apple publishes no region list.** One email | MOB-05 Q2 |
| **D3** | **The domain** | App Links, Universal Links, the deletion web URL, the privacy policy URL, **and Apple organization enrolment** | MOB-01 Q1, MOB-05 S1.3 |
| **D4** | **Reference devices** | Tier 0's gate, and the device half of every gate after it | MOB-01 Q7 |
| **D5** | **Confirm Play App Signing is enabled** | Nothing today. **A one-way door**: without it, a lost Android key means the app can never be updated by anyone | MOB-07 F2 |

### 4.2 Blocking a build slice

| # | Decision | Blocks | Source |
|---|---|---|---|
| **D6** | **The QR payload encoding** -- D-156 records it as interim | **WO-6 entirely.** Both halves of a scan contract have to agree on bytes | MOB-01 Q11 |
| **D7** | **The scan retry budget** -- twenty seconds proposed | **WO-6's copy and behaviour**, and ADU-VAL-01 D3's floor | MOB-02 M1 |
| **D8** | **The OTP verify body** -- AUTH v2.8 and API v1.11 disagree | **WO-2's shape.** Build against AUTH v2.8; isolate it in one module | MOB-00 N1 |
| **D9** | **The delivery fee** | MB-12's total. Either ruling is a migration | MOB-01 Q6 |
| **D10** | **The fulfilment window length** | MB-16's confirmed-state copy | MOB-01 Q5 |
| **D11** | **The client-event allow-list** -- four names across two closed lists of two | Two events stay wired to a no-op | MOB-01 F3 |

### 4.3 Blocking submission

| # | Decision | Blocks | Source |
|---|---|---|---|
| **D12** | **The App Review credential** -- an allowlisted number with a fixed code | Review access. **In no document, named in three** | MOB-05 F1 |
| **D13** | **Write-time content filtering** | Apple 1.2. **Server-side, and the only item in the series with no owner at all** | MOB-05 F2 |
| **D14** | **Published contact information**, and who reads the report queue, and by when | Apple 1.2, and a regulatory question behind it | MOB-05 F2, MOB-07 F3 |
| **D15** | **Amharic human translation** | The Ge'ez release gate, not a store gate | MOB-01 Q8 |
| **D16** | **Release territories** | The listing. **3.1.1(a)'s relaxation is United States only** | MOB-05 Q6 |

### 4.4 Cheap, and worth doing before they are needed

| # | Decision | Note |
|---|---|---|
| **D17** | **A second account holder on both stores** | Costs nothing, **cannot be done retrospectively** |
| **D18** | **Keys and credentials off the machine** | The Android key has no recovery path |
| **D19** | **The Apple renewal calendar entry** | An expired membership removes the app from the store, silently |
| **D20** | **`brand.base`** | The one token that is a founder decision. **The other three derive from it** |
| **D21** | **The three cheap lint rules** -- clipboard, `PriceBlock`, sign-out adjacency | An hour, and it moves three rulings from *promise* to *control* |
| **D22** | **The icon set and its licence** | A dependency, and it must not be an icon font |

### 4.5 Open, not blocking, and deliberately unscheduled

**Article 22 hosting opinion** (above this workstream)  -  **crash reporting** (behind the DPIA; trigger written, date not)  -  **dark mode** (token change when reopened)  -  **`POST /v1/devices` folding into bootstrap** (an opportunity, with a blast radius)  -  **`expo-updates` code signing** (trigger: more than one publisher)  -  **a paid store-guidelines review**  -  **the mid Android**  -  **the app-switcher privacy overlay**  -  **the console's token reconciliation**  -  **store-release cadence after launch**  -  **release-gate thresholds**, which ADU-QA-01 has asked for since August and which **must be written down in advance or the gate is decided after the fact by whoever wants to ship.**

---

## 5. The consolidated findings register

**Roughly thirty-five findings across the series. Grouped by failure class, because the class is more useful than the count.**

### Class 1 -- Build-time traps: a plausible implementation that a binding rule forbids

| Finding | Where it would surface |
|---|---|
| **"The client signs once" against "client-side signing is worse in every direction."** The plausible output is an HMAC key in every APK | Code review, if anyone reads both documents. **Otherwise: never** |
| **`includeFontPadding: false`** -- the standard React Native recipe, which clips Ge'ez on Android | **A person, on an Android device, reading Amharic.** Nothing else |

> **These two are the highest-value findings in the series and they have the same shape**: widely-recommended, compiles clean, passes every gate, and breaks a binding requirement. **Both are now one grep each.**

### Class 2 -- Contradictions between binding documents

The OTP verify body (D8)  -  the client-event allow-list (D11)  -  the OTP IP limiter, documented in the contract and disabled in the authentication specification  -  ADU-PRD-01's retired iOS invariant, which ADU-API-01 v1.11 has since resolved in the other direction.

> **Every one of these was found by reading two documents together.** None is visible from inside either.

### Class 3 -- Absences with no owner

**The App Review credential** (D12)  -  **write-time content filtering** (D13)  -  **published contact information and the report-queue reader** (D14)  -  **the over-the-air publishing credential's handling**  -  **the continuity minimum** -- what happens if the sole engineer is unavailable for two weeks  -  **the app-switcher snapshot on the payment screen**  -  **the on-device row in the DPIA inventory.**

> **This is the largest class and the least visible one.** Each is a thing every document assumed another document owned.

### Class 4 -- Residue from the offline withdrawal

**Three instances, in three documents, from one deletion:** ADU-MOB-01 v1.1 S3.4's Zustand list still names the scan-queue view model; S18.1's fifth Maestro journey still reads *"scan offline to synced"*; **ADU-QA-01 S1's fourth premise -- one of the four properties the whole QA handbook is built on -- still says the handoff scan is created offline.**

> **ADU-MOB-AMD-01 anticipated over-deletion and got the opposite failure.** The lesson is that **a withdrawn feature leaves residue in every document that ever depended on it, and the amendment set could only list the ones it knew about.** A `grep -i offline` across the entire corpus, not just the mobile documents, is an hour and it is owed.

### Class 5 -- Stale figures and roles

D-U-N-S stated as 1-4 weeks; it is **up to 7 business days**  -  the session described as sliding when it is absolute  -  *"124 contract path keys"*, which was three quantities counted as one  -  **ADU-QA-01 owned by "QA Engineer #1", who does not exist**  -  ADU-REPO-01 S1's ownership table  -  **the two-person rule, assumed by three documents and meetable by none.**

### Class 6 -- One-way doors

**Play App Signing** (D5). It is the only finding in the series where the wrong answer is unrecoverable rather than expensive.

---

## 6. The reissue debt

**Thirteen targets. Several collect items from three or four documents and should be done as one pass each.**

| Target | Owed by | Contents |
|---|---|---|
| **ADU-MOB-01 -> v1.2** | -03, -05, -06 | S3.4's Zustand line  -  S18.1 gains gates 12-14  -  S18.1's fifth Maestro journey  -  S24 Q1 restated  -  S24 Q2's D-U-N-S figure. **Do this first: five corrections, one file** |
| **ADU-API-01 -> v1.12** | AMD-01, -01 | AMD-01 section B  -  **S12.6.1's signing wording, open across four contract versions**  -  the `X-Adulis-Client` pair  -  the client-event allow-list  -  S12.18 marked for both surfaces  -  a 400 for a malformed device header |
| **ADU-AUTH-01 -> v2.9** | -01, -05 | S4.4's autofill suffix  -  S8.4's biometric hint  -  **the App Review credential**  -  **S5.2 versus API S5 reconciled** |
| **ADU-PRD-01 -> v8.6** | AMD-01, -01, -05, -07 | AMD-01 section A  -  S23.1's mobile Ge'ez clause  -  S3's client matrix  -  **S18 gains write-time filtering, published contact information and the response commitment** |
| **ADU-REPO-01 -> v1.4** | -01, -03 | R-6  -  gates 10-14 in the repository-wide list  -  S1's ownership table |
| **ADU-DB-01 -> v1.20** | -01 | S26's retired invariant rows  -  one sentence on what `offline_sync_horizon` is not. **No migration** |
| **ADU-DPIA-01 -> v1.1** | -01, -05, -06 | The on-device inventory row  -  store crash reporting as an existing relationship  -  the report-response commitment  -  the app-switcher snapshot and third-party keyboard |
| **ADU-QA-01 -> v1.1** | -06 | S1's fourth property  -  ownership  -  `QA-MOBILE-*` populated |
| **ADU-SEC-01 -> v1.1** | -06 | The release-path credentials and the over-the-air channel |
| **ADU-VAL-01 -> v1.3** | -01, -02 | D3's horizon  -  the fulfilment window  -  the delivery fee |
| **ADU-CON-03 -> v1.4** | -03 | The shared token values, and the console's reconciliation |
| **ADU-PROJ-01 -> v9.1** | -01, -07 | S9.1's client table  -  S9.2's card blocker **with an owner**  -  S12's mobile gates  -  **the continuity minimum and the two-person substitution** |
| **ADU-MOB-05 -> v1.1** | -07 | Play App Signing before the first release  -  the renewal calendar entry |

> **A good share of these correct documents this series produced in the last week.** That is what a series does when each document reads the previous ones properly. **The failure would be leaving them**, and the debt has now reached the size where it is one work session rather than thirteen.

---

## 7. Rules for this workstream

1. **One authoritative name per thing.** Where a concept exists in the built schema, use the built name or issue a migration.
2. **A document decides only what S1 says it decides.**
3. **Read the whole document when revising it.** ADU-API-01 v1.11 recorded what surgical editing preserves: *"exactly the part nobody re-read."* **That defect is D8, in this workstream, today.**
4. **The document is amended first, then the code.**
5. **A deferred decision goes into ADU-VAL-01 or S4 of this document** -- never into a comment or a memory.
6. **Record every conflict before choosing.** ADU-MOB-00 S2.2. **Every finding in S5 class 2 came from someone doing this.**
7. **Restate no count.** Cite the document that owns it.
8. **MVP means MVP.**

---

## 8. Ownership, and the review that cannot be self-performed

| Role | Documents | Reality |
|---|---|---|
| **CEO** | All, as author and as builder | One person writes the specification, writes the code, tests it, and decides whether it ships |
| **Amharic language reviewer** | The release gate on every Amharic path | **External. Mandatory.** Machine output satisfies the compiler, not the gate |
| **Senior engineering review** | ADU-PROJ-01 S14's forty hours | **Not substituted by anything in this series**, and ADU-MOB-06 says so explicitly |
| **Data protection review** | ADU-PROJ-01 S14 | Already mandatory. The mobile surface extends its scope |
| **Second store account holder** | -- | **D17. Not a review role. An availability one** |

> **[!] Three documents assume a second person and none of them can have one.** ADU-MOB-01 S19.1's two-person release rule, ADU-MOB-00 S9.1's review model, ADU-QA-01 S2.3's independence rule -- *"the QA engineer must be able to write 'this gate is not met' and have that stand."*
>
> **ADU-MOB-07 O2 replaces the first explicitly with a twenty-four-hour hold**, on the reasoning that the value of a second reviewer is not their expertise but that they did not make the assumptions. **The other two are not solved and are not solvable at this headcount.** What is available is naming them, which is what this row does.

---

## 9. The gate to a first submission

**Nothing here is a document. Every line is a thing that must be true.**

| | Item | Source |
|---|---|---|
| 1 | Card, Apple enrolment confirmed, D-U-N-S, both organizations enrolled | D1, D2, MOB-05 S8 |
| 2 | Domain live, website public, work email on it | D3 |
| 3 | Reference devices in hand; **`DEFERRED-GATES.md` empty** | D4, WO series |
| 4 | **Play App Signing confirmed on** | D5 |
| 5 | D6, D7, D8, D11 ruled; the two client events wired | S4.2 |
| 6 | The twenty negative cases each with a recorded result | MOB-06 S7 |
| 7 | **App Review credential live, seeded QR valid through the window** | D12 |
| 8 | **Write-time filtering and published contact information exist** | D13, D14 |
| 9 | Declarations reconciled to ADU-DPIA-01; **privacy manifest tested by a throwaway upload** | MOB-05 S4 |
| 10 | The Ge'ez pass, on both devices, in both locales, at the largest text size | MOB-01 S25 |
| 11 | The signed manual script; the evidence pack filed | MOB-06 S9.2, S11 |
| 12 | **The continuity minimum: keys off the machine, a runbook a stranger could follow, a second account holder** | MOB-07 O1 |

> **Items 7, 8 and 12 belong to no work order and to no other workstream's queue.** They are the three most likely to be discovered in the week of submission.

---

## 10. Start now, regardless of anything else in this plan

**Five items with lead times that depend on no ruling. They will be the constraint if they start late, and four of them are not engineering.**

| Item | Why now |
|---|---|
| **The card, and the Apple availability email** | **D1 and D2 gate everything and neither is a writing task.** The email is one paragraph and it can be sent today |
| **The domain** | Blocks four things, and it is a decision rather than work |
| **The reference devices** | They gate the device half of every gate in nine work orders |
| **The Amharic reviewer** | External, weeks, and the release gate depends on it |
| **The continuity minimum** | An afternoon. **It cannot be created at the moment it is needed** |

---

## 11. What this plan does not settle

| Open | Owner | Needed before |
|---|---|---|
| **Whether wireframes are drawn at all before the build starts** | CEO | ADU-MOB-04 exists; running it is a choice, and skipping it means the defects it would find surface in code |
| **Whether ADU-MOB-04-R1 is a document or a v1.1 of two documents** | CEO | Round 2 completes |
| **When the reissue debt in S6 is paid** | CEO | **It grows stale, not smaller.** ADU-MOB-01 v1.2 is the head of it |
| **Whether the Companion inherits ADU-MOB-02's screen numbering** | CEO | ADU-CMP-01 begins |
| **Who reads the report queue** | CEO | **Before the first buyer can file one**, not before submission |

---

## 12. What writing the plan last cost

**Stated concretely, because the next workstream can choose either order and should choose deliberately.**

**What it bought.** Every document was written with the previous ones in hand, and **each found defects in them** -- the design system found a stale line in the architecture record, the compliance dossier found two wrong figures, the QA specification found a stale premise in the QA handbook. **A plan written first would have found none of those**, because none was visible until someone tried to write the next document.

**What it cost, in four specific ways:**

1. **The residue class went unnoticed for three documents.** A register maintained from the start would have listed every document that depended on the offline capability, and the withdrawal would have been checked against that list rather than against memory.
2. **The two-person assumption propagated into three documents** before anyone noticed it could not be met anywhere.
3. **Three absences had no owner because no document was responsible for noticing that** -- the App Review credential, the content filtering, the report-queue reader. Each was assumed to belong to another document, and a register is exactly the instrument that catches that.
4. **The reissue debt accumulated to thirteen targets** rather than being paid document by document.

> **The honest conclusion is that both orders are right for different things**, and the choice is not between planning and doing. **Write the register first, and keep writing it** -- it costs an hour per document and it is the only artefact in the set whose job is to notice what no single document can see.

---

*Planning record. **Nothing here is a specification**, and every rule it appears to state belongs to a document named beside it. Twelve documents, three unwritten and triggered, twenty-two open decisions and roughly thirty-five findings in six classes. **The two most valuable findings in the whole series have the same shape** -- a widely-recommended implementation that compiles clean, passes every gate, and breaks a binding requirement -- and both are now one grep each. **The largest class of finding is the one no document could have found alone**: seven absences that every document assumed another one owned, three of which block a store submission and one of which has no owner even now. **The critical path has not run through a document for a week.** It runs through a card payment, a domain, an email to Apple, and two phones nobody has ordered.*
