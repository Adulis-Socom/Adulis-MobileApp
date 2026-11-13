# ADU-MOB-07 -- Buyer Mode: Release and Operations

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Status:** **Binding operating manual for the mobile workstream after it ships.** ADU-MOB-01 S19-S21 decide the rules; **this decides the procedures**, and where they disagree ADU-MOB-01 governs.
**Scope:** Buyer Mode, from the first submission onward.
**Drawn from:** ADU-MOB-01 **v1.1** S19-S21  -  ADU-MOB-05 v1.0  -  ADU-MOB-06 v1.0  -  ADU-QA-01 v1.0  -  ADU-CON-02 v3.2 S19-S21  -  ADU-REPO-01 v1.3  -  ADU-PROJ-01 v9.0 S12
**Encoding:** ASCII.
**Closes:** the ADU-MOB series.

---

## 0. What this is

**ADU-MOB-01 S19 says an over-the-air update carries defect fixes only. This says who publishes it, from where, after what, and what they do when it is wrong.**

Everything here is a procedure. **None of it is new policy**, with one exception that is stated as a ruling because no document has ever addressed it: what happens to a product whose entire operation depends on one person being available (S1).

### 0.1 The rulings

| # | Ruling | S |
|---|---|---|
| **O1** | **The continuity minimum is three artefacts and it is not optional.** Signing keys off the machine, a written release runbook a stranger could follow, and a second person on both store accounts | 1.2 |
| **O2** | **The two-person rule cannot be met and is replaced explicitly, not quietly.** A twenty-four-hour hold on anything irreversible | 1.3 |
| **O3** | **Nothing publishes from a developer machine.** Store submissions and over-the-air updates publish from CI, from `main`, after the gates | 3 |
| **O4** | **A rejection is answered from the register, never improvised** | 6.5 |
| **O5** | **The support path is a product surface and it does not exist yet.** A published address that nobody reads is worse than none | 9 |
| **O6** | **The first two weeks are a watch, not a rest.** A named daily check with a written result | 10 |
| **O7** | **The version floor is never raised in the same week as a store release** | 5 |

---

## 1. The one-person problem, stated first because everything else assumes it away

### 1.1 What one person holds

**ADU-REPO-01 S3 is one owner, every path. That is correct for a codebase. It is a different fact for an operation.**

| Held by exactly one person | Consequence if unavailable for two weeks |
|---|---|
| The Android upload / signing key | **If it is also lost, the app can never be updated by anyone** -- the recovery is a new listing and a new install base |
| The Apple certificates and the App Store Connect key | No submission, no update |
| The EAS / Expo publishing credential | **No over-the-air fix.** A JavaScript defect stays live for the duration |
| Both store account logins | No response to a rejection, no reply to a review, no metadata change |
| The API, the database, the deploy | Everything |
| Every runbook that exists only as memory | The recovery of all of the above |

**This is not a criticism of the arrangement.** It is the arrangement ADU-00 describes and it is correct at this stage. **What is not correct is leaving it undocumented**, because the failure mode is not gradual: the product is fully operational until the moment it is entirely unoperable.

### 1.2 The continuity minimum

> **RULING O1 -- three artefacts, none of which costs more than an afternoon.**
>
> 1. **The signing keys and store credentials exist somewhere a lost or stolen laptop does not lose them.** EAS-managed credentials with a downloaded backup, in a password manager or a sealed physical copy. **The Android key is the one with no recovery path**, and it is the cheapest catastrophic loss available in this project.
> 2. **The release runbook is written to be followed by somebody who has not done it before** -- S6.1, which is written that way deliberately. A runbook that says *"submit as usual"* is a note to oneself, not a procedure.
> 3. **A second person is an account holder on both stores**, with their own credentials, even if they never use them. Both platforms support it, it costs nothing, and it is the difference between a two-week absence being an inconvenience and being an outage with no console access.
>
> **All three are cheap now and none of them can be done retrospectively at the moment they are needed.**

### 1.3 The two-person rule, replaced honestly

**ADU-MOB-01 S19.1 carries a two-person rule from the console: the merger is not the submitter.** It cannot be met. **ADU-MOB-00 S9.1 and ADU-MOB-06 S8 already record the same problem for review and for gate-keeping.**

> **RULING O2 -- where a two-person rule cannot be met, it is replaced by a stated substitute rather than dropped silently.**
>
> **The substitute is time.** Anything irreversible -- a store submission, a version-floor raise, a production over-the-air publish -- **is prepared one day and executed the next**, with the checklist re-read cold.
>
> **The reason is specific and is not about discipline.** The value of a second reviewer is not their expertise; it is that they did not make the assumptions. **Twenty-four hours is the cheapest available approximation of not being the person who wrote it**, and it catches the class of mistake that is obvious to anyone except its author.
>
> **It is not a substitute for the paid senior review** in ADU-PROJ-01 S14, and it must never be described as one.

---

## 2. Channels and cadence

| Channel | Purpose | Who has it | Publishes from |
|---|---|---|---|
| **development** | Dev client against local or staging | The engineer | Local |
| **preview** | Internal testing -- Play internal track, TestFlight internal | The founders, on the reference devices | **CI, on merge to `main`** |
| **production** | The store binary and its update channel | Buyers | **CI, on a tag** |

**Cadence, and it is deliberately unequal:**

- **Over-the-air fixes: as needed**, and they should be rare. A high OTA rate is a signal about the gates, not about responsiveness.
- **Store releases: no more than fortnightly at launch, monthly after.** Every store release is a review round, a risk of rejection, and a version-floor decision. **The store is not a deploy target and treating it as one is how a small team spends its weeks on submissions.**
- **The Expo SDK: on its own PR, never in a release week** (ADU-MOB-06 S3.3). It carries native changes and therefore a store round.

## 3. The release procedure

> **RULING O3 -- nothing publishes from a developer machine.**
>
> Not a store build, not an over-the-air update, not a metadata change that can be scripted. **CI, from `main`, after the gates.** A build produced locally has no evidence attached to it and cannot be reproduced by anyone, including its author a month later.

```text
  merge to main
        |
        v
  CI: the fourteen gates + unit + contract + Maestro     <- ADU-MOB-06 S6
        |
        v
  preview build (EAS)  ->  install on BOTH reference devices
        |
        v
  walk the affected journeys ON THE DEVICE, not the simulator
        |
        v
  [24-hour hold if the next step is irreversible]         <- O2
        |
        v
  tag  ->  CI production build  ->  submit
        |
        v
  the evidence pack is filed                              <- ADU-MOB-06 S11
```

**The evidence pack is filed whether or not anyone asks for it.** It is what makes a later question -- *"was the Ge'ez pass done on that build?"* -- answerable rather than a matter of recollection.

## 4. What may go over the air, and what may not

**ADU-MOB-01 B21 is the rule. This is the test to apply to a specific change.**

| Ask | If yes |
|---|---|
| Does it change a permission, a native module, an icon, an entitlement or the app's stated purpose? | **Store submission.** No exceptions |
| Does it change what data is collected, or anything on a privacy label or Data safety form? | **Store submission.** And update the declaration in the same release |
| Does it add a capability a reviewer has not seen? | **Store submission** |
| Is it a defect fix, a copy correction, or a layout fix inside the reviewed purpose? | **Over the air** |
| Is it a new screen for an existing capability? | **Judgement, and the answer is store** at MVP. The ambiguity is in the word *material*, and this project does not spend its first year finding the edge |

> **Every update is a version bump and is reported** (B7). **An unexpected runtime version appearing in the `X-Adulis-Client` distribution is a security event**, not a curiosity -- it means something published that nobody intended (ADU-MOB-06 S3.1).

## 5. The version floor

**ADU-MOB-01 B22 is the rule: raised only when an older client would produce a *wrong* result, never for convenience, and never before a fix is live on both stores.**

> **RULING O7 -- the floor is never raised in the same week as a store release.**
>
> A store release takes days to propagate and some buyers on metered data do not update for weeks. **Raising the floor while the fix is still rolling out locks out the buyers it was meant to protect**, and they cannot tell the difference between an app that is enforcing a floor and an app that is broken.
>
> **The order is: publish, wait, measure, then raise.** S20.3's install-distribution counter is read **before** the raise, and the number of installs it would cut off is written down before the decision, not after.

## 6. Runbooks

**ADU-MOB-01 S20.5 names five. Here are eight, written to be followed by someone who has not done them** (O1).

### 6.1 `store-release`

1. Confirm the gate evidence exists for the SHA being released (ADU-MOB-06 S11).
2. Confirm no floor raise is scheduled this week (O7).
3. Tag; CI builds and uploads.
4. Update store metadata, screenshots and release notes. **Re-check that no screenshot shows a price or a console surface** (ADU-MOB-05 S2.2).
5. **Confirm the review credential is active and the seeded QR is valid through the review window** (ADU-MOB-05 S3.3).
6. Submit. Record the submission date and the build number.
7. On approval: release; watch S7's vitals for 48 hours before considering it done.

### 6.2 `ota-hotfix`

1. **Apply the S4 test.** If any answer says store, stop.
2. Fix on `main`, gates green.
3. **24-hour hold does not apply to a defect actively harming buyers.** It applies to everything else.
4. CI publishes to the production channel.
5. **Watch the runtime-version distribution** until the new version is the majority.
6. Record what the defect was and which gate did not catch it. **That second half is the point** -- an OTA that produces no gate change will be needed again.

### 6.3 `rollback-ota`

1. Republish the previous update. **Seconds, and it is the reason this runbook exists before the first incident.**
2. Confirm the runtime-version distribution moves back.
3. **A rollback is not a fix.** File the defect.

### 6.4 `raise-version-floor`

1. Confirm the fix is live and available **on both stores**.
2. Read the install distribution; **write down how many installs the raise cuts off.**
3. 24-hour hold (O2).
4. Raise. Watch `UPGRADE_REQUIRED` responses -- **a rise beyond the predicted number means the prediction was wrong**, and the floor comes back down.

### 6.5 `store-rejection`

> **RULING O4 -- answered from ADU-MOB-05 S7's register, never improvised.**

1. Find the rejection in the register. **Nine of the likely ones are already there with a prepared response.**
2. **Read the third column before writing anything.** Every entry says *do not concede the architecture*, because a rejection arrives with time pressure attached and the fastest-looking fix usually breaks a binding invariant.
3. If it is not in the register, **it is a finding**: answer it, then add it, with what would have prevented it.
4. Reply in the Resolution Center with the citation where one exists -- 3.1.3(e) for the payment question, the deletion path for 5.1.1(v).
5. **Never add a demo mode in response to a sign-in rejection** (ADU-MOB-05 S3.2).

### 6.6 `review-credential-rotation` -- new

**The App Review credential (ADU-MOB-05 S3.2) is a live authentication bypass for one account.**

1. It is enabled before submission and **disabled on approval**, not left on.
2. It is rotated after each review round.
3. Its use is logged, and **any use outside a review window is an incident.**

### 6.7 `signing-key-recovery` -- new

1. **Android:** if the upload key is lost but Play App Signing is enabled, request an upload key reset through Play Console. **If Play App Signing was never enabled, there is no recovery** -- the app cannot be updated and a new listing is the only path. **Confirm Play App Signing is on before the first release; it is the single decision that makes this recoverable.**
2. **Apple:** certificates are re-issuable from the developer account. **The App Store Connect `.p8` is downloadable exactly once** -- if lost, revoke and create a new one.
3. Either way: the backup in O1 is what makes this a runbook rather than an obituary.

### 6.8 `scan-failure-spike` -- new, and it is the one most likely to be needed

**Scan submission failure rate rises above threshold, by client version** (ADU-MOB-01 S20.2).

1. **Split by client version first.** A single version means a client defect and an `ota-hotfix`; all versions means the server or the network.
2. **Then split by first-attempt versus after-retry** (S20.3). If retry is closing the gap, the network is bad and the retry budget is working. If it is not, buyers are in places with no signal and **the tap share will rise, which is the ruling's cost arriving** (ADU-MOB-AMD-01 G4), not a defect.
3. **Check the tap ratio in the same sitting.** These two numbers are meaningless apart.
4. If it is a client defect: hotfix, then ask why no negative case in ADU-MOB-06 S7 caught it.

## 7. Monitoring, with no crash SDK

**B2 leaves a hole and it is stated rather than hidden.** The substitutes:

| Source | Gives | Does not give |
|---|---|---|
| **Play Console vitals** | Crash rate, ANR rate, by device model and OS | Breadcrumbs, user context, or same-day latency |
| **Xcode Organizer** | Crashes, hangs, launch time | The same |
| **The API's own logs, by `X-Adulis-Client`** | **Everything in S20.3's counters, computed without a client SDK** | Anything about a client that never reached the network |
| **Store reviews and ratings** | **The only unsolicited buyer feedback channel that exists** | A representative sample |

> **The last row is easy to dismiss and should not be.** With no analytics, no crash SDK and no support desk, **a one-star review saying the app crashes on a particular phone is a bug report** -- and it is the only one that will arrive. It is read in the same weekly slot as the vitals.

**Reopen trigger for the hole:** ADU-CON-02 O-4 and the DPIA processor work, at the first release where the store-provided rate is not enough to act on. **A self-hosted collector adds no processor**, which is what makes it the likely answer rather than a vendor.

## 8. Alarms and severity

**The two mobile alarms are ADU-MOB-01 S20.2's. The severity table is ADU-QA-01 S5.2's**, and it is not varied here. What this document adds is the mobile mapping:

| Situation | Severity | Why |
|---|---|---|
| An order created twice | **S1** | Money, and the buyer's own bank charged twice |
| A scan the server accepted rendered to the buyer as a failure | **S1** | The buyer completes again by tapping, and the seller loses a verified handoff **that the server already recorded** |
| A tier name or price reachable in the app | **S1-S** | A rejection round costs weeks |
| A published runtime version nobody intended | **S1** | Code execution in every install (ADU-MOB-06 S3.1) |
| Missing-glyph boxes on an Amharic screen | **S2** | Invisible to a reviewer who does not read Amharic (ADU-QA-01 S5.2) |
| A scan that never reached the server | **Not an incident** | **It is the ruling** (B25). The incident is the app being wrong about what happened |

## 9. The support path, which does not exist yet

> **RULING O5 -- the support path is a product surface, and a published address that nobody reads is worse than no address at all.**

**ADU-MOB-05 S6 found that Apple's guideline 1.2 requires published contact information for an app with user-generated content, and that no document names it.** This is that gap seen from the operations side, and it is larger than a missing line in a listing.

**What a buyer can currently do when something goes wrong:** leave a review, or nothing. **There is no in-app support surface, no address, and no queue.**

**The minimum, and all of it is cheap:**

| Piece | What it is |
|---|---|
| **A published address** | On the site, in both store listings, and reachable from MB-39 |
| **The request id** | Already rendered in selectable text on every transport error (ADU-MOB-01 S4.6). **It is the only thing that makes a buyer's message actionable**, and the support reply should ask for it by name |
| **A stated response window** | Apple 1.2 requires *"timely responses to concerns."* **A number, written down, that one person can actually meet** -- and at this scale that is days, not hours, and saying so is better than implying hours |
| **A queue somebody reads** | On a named day, at a named time, in the same weekly slot as the vitals |
| **The report queue** | The `POST /v1/reports` control exists on every user-content surface. **Nothing currently reads what it produces.** A report control with nothing behind it is a promise, and it is the promise a regulator asks about |

> **The last row is the serious one.** ADU-MOB-02 built the report control because two stores require it. **Building it and not reading it is worse than not building it**, because it tells a buyer their report was received.

## 10. The first two weeks

> **RULING O6 -- a named daily check with a written result. The launch is a watch, not a rest.**

**Most of what this product needs to learn arrives in the first fifty handoffs and never arrives again**, because after that everyone involved has adapted to whatever the app does.

**Daily, for fourteen days, written down:**

| # | Check | Looking for |
|---|---|---|
| 1 | Crash and ANR rate by device model | A model-specific failure, which is the one the reference device cannot find |
| 2 | **Scan first-attempt rate, retry rate, and the tap ratio together** | **B25's cost arriving.** Three numbers, one reading (S6.8) |
| 3 | OTP requested -> delivered -> verified, split by platform | A delivery or autofill defect presenting as churn |
| 4 | Orders created versus idempotent replays | B6 working, and connections being worse than modelled |
| 5 | `UPGRADE_REQUIRED` responses | Anything unexpected in the version distribution |
| 6 | New store reviews, both stores | The only unsolicited feedback there is |
| 7 | The report and support queues | **Because week one is when a report control that nobody reads becomes visible** |

**Weekly thereafter**, folded into ADU-CON-02 S20.5's existing half-hour, which gains the mobile lines.

> **One thing to resist for the whole fortnight: shipping a store release.** The instinct after launch is to fix everything visible immediately. **Every store release is a review round and a chance of rejection**, and the defects worth fixing in week one are almost all over-the-air ones. **Batch the rest.**

## 11. Deprecating a client

**The contract is additive-only precisely so that old clients keep working** (ADU-API-01 S3.1). **A version is therefore never deprecated for age.**

**A client is cut off only by a floor raise**, only for a wrong result (B22), and only by the procedure in S6.4. **There is no schedule, no sunset policy and no support window**, and the absence is deliberate: a stated sunset window is a commitment to do work on a date, and this operation cannot make that commitment.

**What is watched instead** is the tail of the install distribution. **If a version below the floor persists, the buyers on it are not ignoring an update -- they are unable to take one**, and that is a fact about devices or data cost rather than about them.

## 12. Cost, operationally

**ADU-MOB-01 S21's figures are unchanged and are not restated.** What changes after launch:

- **EAS paid tier is bought when a release waits**, not before. The trigger is a queue delay that costs a day, not a feeling that the free tier is limiting.
- **The store fees recur.** The Apple $99 is annual and **an expired membership removes the app from the store** -- a calendar entry, made now, is the whole of the mitigation.
- **The reference devices are replaced when they stop receiving OS updates**, because the binding constraint is *the oldest supported OS* and a device that has fallen off it no longer represents it.

## 13. The reissue register for the whole series

**The series owes corrections to thirteen documents. Several land on the same target and should be done as one pass.**

| Target | Owed by | Contents |
|---|---|---|
| **ADU-MOB-01 -> v1.2** | MOB-03, MOB-05, MOB-06 | S3.4's Zustand scan-queue line  -  S18.1 gains gates 12-14  -  S18.1's fifth Maestro journey rewritten  -  S24 Q1 restated (the domain blocks Apple enrolment, not only App Links)  -  S24 Q2's D-U-N-S figure corrected to 7 business days. **Four documents' worth of debt on one target; do this first** |
| **ADU-REPO-01 -> v1.4** | MOB-01, MOB-03 | S5 gains R-6 (`packages/tokens` imports nothing)  -  S7's repository-wide gate list gains gates 10-14  -  S1's ownership table corrected |
| **ADU-API-01 -> v1.12** | MOB-01, AMD-01 | AMD-01 section B  -  S12.6.1's signing wording (**F1, still open after four versions**)  -  `X-Adulis-Client`'s version pair  -  the client-event allow-list reconciled  -  S12.18 marked for both surfaces  -  a documented 400 for a malformed device header |
| **ADU-AUTH-01 -> v2.9** | MOB-01, MOB-05 | S4.4's autofill suffix  -  S8.4's biometric hint  -  **the App Review credential** |
| **ADU-PRD-01 -> v8.6** | AMD-01, MOB-01, MOB-05 | AMD-01 section A  -  S23.1's mobile Ge'ez clause  -  S3's client matrix  -  **S18 gains write-time filtering and published contact information** |
| **ADU-DB-01 -> v1.20** | MOB-01 | S26's retired invariant rows  -  one sentence on what `offline_sync_horizon` is not. **No migration** |
| **ADU-DPIA-01 -> v1.1** | MOB-01, MOB-05, MOB-06 | The on-device inventory row  -  crash reporting as an existing platform relationship  -  the report-response commitment  -  the app-switcher snapshot and third-party keyboard |
| **ADU-QA-01 -> v1.1** | MOB-06 | S1's fourth property rewritten  -  ownership corrected  -  `QA-MOBILE-*` populated |
| **ADU-SEC-01 -> v1.1** | MOB-06 | The release-path credentials and the over-the-air channel |
| **ADU-VAL-01 -> v1.1** | MOB-01, MOB-02 | D3's horizon  -  the fulfilment window  -  the delivery fee |
| **ADU-CON-03 -> v1.4** | MOB-03 | The shared token values, and the console's reconciliation against them |
| **ADU-MOB-WO-01 -> v1.1** | MOB-01, MOB-05 | The gate count, ADU-REPO-01 v1.3, SQLite scoped to one row, **the privacy manifest and a throwaway upload** |
| **ADU-PROJ-01 -> v9.1** | MOB-01 | S9.1's client table  -  S9.2's card blocker with an owner  -  S12 gains the mobile gates |

> **A good share of these are corrections to documents this workstream itself produced in the last week.** That is not a failure rate; **it is what a series does when each document reads the previous ones properly.** The failure would be leaving them.

---

## 14. Findings

| # | Finding | Kind | Where |
|---|---|---|---|
| **F1** | **No document states what happens if the sole engineer is unavailable.** One person holds the signing keys, both store accounts, the publishing credential and every runbook that exists only as memory. **The product is fully operational until it is entirely unoperable** | **Absence. Continuity** | S1 |
| **F2** | **Play App Signing is nowhere confirmed as enabled**, and it is the single decision that makes a lost Android signing key recoverable rather than terminal | **Absence, with a one-way door** | S6.7 |
| **F3** | **The report queue has no reader.** `POST /v1/reports` is built and store-mandated; nothing in any document says who reads what it produces or when | **Absence. Regulatory and store exposure** | S9 |
| **F4** | **The two-person rule appears in three documents and can be met in none of them.** ADU-MOB-01 S19.1, ADU-MOB-00 S9.1 and ADU-QA-01 S2.3 each assume a second person | **Inherited assumption** | S1.3 |
| **F5** | **The Apple membership renewal has no calendar entry.** An expired membership removes the app from the store, and the failure is silent until a buyer cannot find it | **Absence, and trivially fixed** | S12 |

**Documents to reissue** -- these join S13:

| Document | Change |
|---|---|
| **ADU-PROJ-01 -> v9.1** | The continuity minimum as a named risk with the three artefacts (**F1**), and the two-person substitution (**F4**) |
| **ADU-PRD-01 -> v8.6** | The support path and the report-queue reader (**F3**), alongside the filtering obligation already owed |
| **ADU-MOB-05 -> v1.1** | Play App Signing confirmed before the first release (**F2**); the renewal calendar entry (**F5**) |

---

## 15. Open items

| # | Item |
|---|---|
| **Q1** | **Who the second store account holder is** (O1). It costs nothing and cannot be done retrospectively |
| **Q2** | **The support address, its queue and its response window** (O5) |
| **Q3** | **Who reads the report queue, and on what day** (F3) |
| **Q4** | **Confirm Play App Signing before the first release** (F2) |
| **Q5** | **The store-release cadence after launch.** Fortnightly is proposed; it is a founder decision and it shapes how much goes over the air |
| **Q6** | **When the crash-reporting hole is closed** (ADU-CON-02 O-4). The trigger is written; the date is not |

---

## 16. What this series produced

**Eight documents, and the thing they were really for.**

| Document | What it decided |
|---|---|
| **ADU-MOB-AMD-01** | The offline withdrawal, and the five things not to delete with it |
| **ADU-MOB-00 v1.1** | How to work: check the version before trusting the sentence; record every conflict |
| **ADU-MOB-01 v1.1** | What the app is, and the twenty-three rulings about what it must not do |
| **ADU-MOB-02 v1.0** | Forty screens, fourteen states, and the twenty-second retry budget at a doorway |
| **ADU-MOB-03 v1.0** | Twenty-eight components, and the Android font setting that shaves the marks off Ge'ez |
| **ADU-MOB-04 v1.0** | The wireframe brief, and the table of things a generator will draw that this product forbids |
| **ADU-MOB-05 v1.0** | The submission dossier, verified against the stores' current rules rather than remembered |
| **ADU-MOB-06 v1.0** | The threat model, twenty negative cases, and the audit of which rulings are actually enforced |
| **ADU-MOB-07 v1.0** | This: how it runs, and what happens when the one person who runs it cannot |

**The pattern worth keeping.** Every document in this series found defects in the ones before it, and **the most valuable finding in each was an absence rather than a mistake** -- a signing sentence that invited a key on the device, a font setting nobody had written down, a store rule that had moved, a report control nobody reads, a person with no backup.

> **None of those were found by thinking harder about the document being written.** They were found by reading the previous ones against a new question. **That is the argument for writing the next document rather than starting the build**, and it is also the argument for stopping now: the questions this series had to ask have been asked.

**What is next is not another document. It is ADU-MOB-01 v1.2 and the twelve reissues in S13, then WO-0.**

---

*Binding operating manual, v1.0, and the last document in the ADU-MOB series. Seven rulings, eight runbooks, and one finding that is not about software at all: **every credential, every key, every store account and every procedure in this product is held by one person, and no document has ever said what happens if that person is unavailable for two weeks.** The mitigation is three artefacts and an afternoon -- keys off the machine, a runbook a stranger could follow, a second account holder -- and none of them can be created at the moment they are needed. **The second finding is smaller and sharper**: the report control that two app stores require is built, and nothing in any document says who reads what it produces. Building it and not reading it is worse than not building it, because it tells a buyer their report was received. **Reissues are owed across thirteen documents, and a good share of them correct work this series produced in the last week** -- which is what a series does when each document reads the previous ones properly, and the only failure would be leaving them. **ADU-MOB-01 v1.2 is the next thing to write, and after it, the first line of code.***
