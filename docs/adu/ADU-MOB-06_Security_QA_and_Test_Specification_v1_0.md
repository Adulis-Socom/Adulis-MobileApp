# ADU-MOB-06 -- Buyer Mode: Security, QA and Test Specification

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Status:** **Binding test specification for the mobile workstream, and the security posture that specification tests.** It is **ADU-QA-01's mobile chapter**, not a second quality document -- its IDs, severities and defect standard are ADU-QA-01's, unchanged.
**Scope:** Buyer Mode. The Companion inherits Part A and re-derives Part B.
**Drawn from:** **ADU-QA-01 v1.0**  -  ADU-MOB-01 **v1.1**  -  ADU-MOB-02 **v1.0**  -  ADU-MOB-03 **v1.0**  -  ADU-MOB-05 v1.0  -  ADU-SEC-01 v1.0  -  ADU-DPIA-01 v1.0  -  ADU-AUTH-01 v2.8  -  ADU-DB-01 v1.19  -  ADU-PROJ-01 v9.0 S12, S14
**Encoding:** ASCII.

---

## 0. What this is

### 0.1 It is ADU-QA-01's mobile chapter

**ADU-QA-01 already decides how quality works here** -- the test ID convention, the six severities, the defect standard, the traceability matrix, and the rule that *"a test that asserts something no document states is not a test, it is an opinion with a green tick."* **None of that is restated and none of it is varied.**

This document supplies what that handbook could not: **the mobile surface did not exist when it was written.** It fills in `QA-MOBILE-*`, the mobile half of `QA-HANDOFF-*`, `QA-PAY-*`, `QA-L10N-*` and `QA-PERF-*`, and it states the device-side security posture those tests exist to check.

> **Where this document and ADU-QA-01 disagree, ADU-QA-01 governs.** Where either and a product document disagree, **the product document governs and both are wrong.**

### 0.2 Two halves, one reason

**Part A is the security posture. Part B is how we find out whether it holds.** They are one document because on this surface they are the same list read twice: every line in Part A that is not testable is a line that will stop being true without anyone noticing, and **S8 is the audit that says which lines those are.**

### 0.3 The rulings

| # | Ruling | S |
|---|---|---|
| **T1** | **The over-the-air update channel is the largest security exposure in the product, and no document has named it.** It gets the same protections as production deploy | 3.1 |
| **T2** | **The three release credentials are treated as production secrets** -- the EAS token, the Play service-account key, the App Store Connect key | 3.2 |
| **T3** | **A ruling with no mechanical check is recorded as a promise, not as a control** | 8 |
| **T4** | **The negative case is the test.** A journey that only proves the happy path is not counted | 7 |
| **T5** | **Every performance and rendering number is measured on the reference Android.** A simulator figure is not evidence -- restated from B17 because this is the document that would otherwise accept it | 9 |
| **T6** | **Test data is seeded, deterministic and produced by a script**, never by clicking through the app | 10 |
| **T7** | **The manual pass has a script and a signature.** *"I checked it"* is not evidence at a gate | 9.2 |

---

# PART A -- SECURITY

## 1. The threat model, in order of probability

**Most mobile threat models start with an attacker. This one starts with what will actually happen**, which for an Ethiopian buyer app is a phone being lost, a seller having an incentive, and a release credential sitting in a CI variable.

| # | Threat | Likelihood | What defends it | Severity if it lands |
|---|---|---|---|---|
| **1** | **The phone is lost, stolen, borrowed or shared** -- unlocked | **High. This is the one that happens** | Token in Keychain/Keystore; **no authenticated response at rest**; revoke from another device, effective on the next request; deletion re-verifies the number even with a session (B23) | **S1** |
| **2** | **A seller coaches buyers to tap instead of scan** | **High, and it is rational for them** | **Not a technical control.** Placement (M6), and the scan-to-tap ratio watched from the first beta handoff | **S1-T. Trust manufacture** |
| **3** | **A release credential leaks** -- EAS, Play, App Store Connect | Moderate, and it is a one-person repository | S3.2 | **S1. Code execution in every install** |
| **4** | **A third party photographs the QR at the doorway** | Moderate | **They gain nothing.** The token is server-minted, the nonce is single-use, and only the buyer on the order can write a scan at all -- composite FK to `("order".id, buyer_account_id)` | None, and the design is why |
| **5** | **The buyer sets the device clock back** to backdate a handoff | Low, but it is free to try | `received_at` governs level credit; `corrected_at` is floored at `issued_at`; the offset is reported and the server decides | **S1-T** |
| **6** | **A repackaged or tampered APK** | Low | **Nothing to extract.** No key, no crypto, no secret in the bundle (B12). The API is the authority for every decision | Low, by construction |
| **7** | **Deep-link or QR payload injection** | Low | Shape-validated before routing or interpolation; the WebView is origin-confined | **S2** |
| **8** | **Account enumeration through the OTP path** | Low from the app, high in consequence | Byte-identical refusals, with no `where practical` exception (AUTH v2.8 S17) | **S1** |
| **9** | **CGNAT collapses an IP-keyed limiter** and locks out a neighbourhood | **Moderate, and it is an accident rather than an attack** | The OTP IP limiter is disabled until `TRUSTED_PROXY_HOPS` is proven (RUL-04 S2) | **S3 at scale, invisible as churn** |

> **Threat 2 has no technical control and it is the second most likely thing on the list.** That is not a gap to be closed with code -- **it is the reason S20.3's counter exists**, and the reason M6 is a placement ruling rather than a copy suggestion. **A QA function that only tests code would never see it.**

## 2. The device

**The three that do the work are in ADU-MOB-01 S14 and are not restated.** What follows is what tests them, and the two things S14 does not cover.

### 2.1 The disk assertion, and how it is actually checked

> **INVARIANT -- after a full session, the app container holds no `/v1/*` response body, no bank detail, no phone number, no token outside secure storage, and no scan.**

**This is checked by looking, not by reasoning.** After a complete journey on the reference device -- browse, reserve, view instructions, submit evidence, scan, review -- the app container is pulled and **searched for known seeded strings**: the seeded account number, the seeded buyer's phone, a product name from an authenticated response, and the order reference.

**Seeded strings are the mechanism.** A grep for the word *"token"* proves nothing; a grep for the specific thirteen digits of the seeded bank account proves exactly the thing the invariant claims. `QA-MOBILE-010`.

### 2.2 Logging and redaction, checked the same way

ADU-MOB-01 S14.2's never-logged list is an allow-list inverted for a client. **The check is the same shape:** run the journey with logging at maximum, capture everything the app emitted, and search for the seeded values. `QA-MOBILE-011`.

**And the one that is easy to forget:** the store-provided crash reports (Play vitals, Xcode Organizer) are the only crash channel (B2), and **a crash stack can carry a string that was on the heap.** The check is that no seeded value appears in a deliberately-crashed build's report.

### 2.3 What S14 does not cover, and should

- **Screen recording and the app switcher snapshot.** Both platforms capture a thumbnail of the app when it is backgrounded, and it persists. **MB-17 is the screen that matters** -- an account number in a switcher thumbnail is a disclosure to whoever picks the phone up. **This is the one place a privacy overlay on background is worth the complexity**, and it is not the same thing as blocking screenshots, which ADU-MOB-01 S7.5 rejected for good reasons that do not apply here. **S13 F3.**
- **The keyboard.** A third-party keyboard sees every keystroke, including the OTP and the phone number. **It cannot be prevented and should not be**, but it is a disclosure worth recording in ADU-DPIA-01 rather than discovering later.

## 3. The release path -- the largest exposure in the product, and it is not the app

> **RULING T1 -- the over-the-air update channel is a code-execution path into every installed copy of the app, and no document in this set has named it.**

### 3.1 Over-the-air updates

**ADU-MOB-01 S19.2 treats OTA as a rollback story, which it is.** Read from the other side, it is this: **whoever can publish an update runs JavaScript on every buyer's phone, without a store review, within minutes.**

**That is a larger blast radius than a production API deploy**, because the API can be rolled back in one place and an update has already run by the time anyone notices.

> **The protections, and they are the same ones production deploys get:**
>
> - **The publishing credential is a production secret** (T2), not a convenience token in a developer's shell profile.
> - **The Expo account carries multi-factor authentication.** It is the single credential between an attacker and every install.
> - **No update publishes from a developer machine.** It publishes from CI, from `main`, after the gates -- the same rule ADU-CON-02 S19 applies to a promote.
> - **Every update is a version bump and is reported** (B7), so an unexpected runtime version in the `X-Adulis-Client` distribution is a detectable event rather than a rumour. **S20.3 already collects the distribution; this is the second use for it.**
> - **The rollback runbook is written before the first incident**, which ADU-MOB-01 S19.2 already requires.
>
> **`expo-updates` supports code signing.** It is not adopted at MVP -- it adds key management to a project whose defining ruling is that the device holds no key -- **but the reason is written down here rather than left as an omission**, and the reopen trigger is the day more than one person can publish.

### 3.2 The three credentials

> **RULING T2 -- these are production secrets and are handled as such.**

| Credential | What it grants | Rule |
|---|---|---|
| **EAS / Expo token** | **Publish an update to every install** | CI only. Scoped as narrowly as the service allows. Rotated on any suspicion, and on any change in who has access |
| **Google Play service-account key** | Upload and release to production | CI only. Never in a developer's home directory |
| **App Store Connect API key** | Upload and submit | CI only. **The `.p8` is downloadable exactly once** and is therefore a secret that cannot be re-fetched, only replaced |

**All three live in the CI secret store, none in the repository, and the secret scanner already in ADU-REPO-01's gate list runs repository-wide on every push.**

> [!] **The signing identities are separate and are the ones that cannot be replaced casually.** The Android upload key and Apple's certificates -- **losing the Android signing key means the app cannot be updated, ever, by anyone**, and the recovery is a new listing with a new install base. **EAS-managed credentials with a downloaded backup, stored where a lost laptop does not lose it**, is the whole of what this needs and it is a fifteen-minute task nobody schedules.

### 3.3 Dependencies

**B2's no-third-party-SDK ruling is a security control before it is a privacy one**: the supply chain is Expo, React Native, and a short list of `expo-*` modules. **Every version is pinned exact** (ADU-MOB-01 S20.4), the lockfile is committed, and **a new dependency is a document change, not a code change.**

**Renovate monthly, advisories immediately, the Expo SDK as one PR.** The mobile-specific addition: **an SDK major carries native changes and therefore a store round**, so it is a release decision, and it must never be taken in the same week as a submission.

## 4. What is deliberately not defended, and why

**Each of these is a control a competent reviewer will ask about. Each has an answer, and the answer is written down so it is not re-litigated under time pressure.**

| Not implemented | Why |
|---|---|
| **Certificate pinning** | B18. A pin lives in native config and cannot be fixed over the air; a rotated Cloudflare certificate becomes a total outage fixable only by a store round. Reopen if the app ever holds a credential surviving revocation |
| **Root / jailbreak detection** | Trivially bypassed, punishes legitimate users, and **there is nothing on the device worth protecting from its owner** |
| **Screenshot blocking on payment instructions** | S7.5. **The buyer needs that number in their bank app**; blocking it makes them retype thirteen digits, which is how money reaches the wrong account |
| **Client-side cryptography of any kind** | B12, and it is the most important absence in the app |
| **A biometric requirement** | Biometric is a local device unlock, never a factor Adulis verifies (AUTH S8.4). Default off for a buyer-only account |
| **Obfuscation of the JavaScript bundle** | It protects nothing here. There is no secret in the bundle to protect, and it makes a crash report unreadable, which is the only crash channel we have |

---

# PART B -- QA

## 5. What a mobile test can prove, and what it cannot

**ADU-QA-01 S1 gives four properties that make Adulis's serious defects quiet. The mobile surface adds a fifth, and it changes the test strategy.**

> **Fifth property: the client is the only witness to the moment that matters.** The scan happens at a doorway, on a device we do not own, on a network we cannot see. **Every other failure in this product leaves a server-side trace; a scan that never left the phone leaves none at all.**
>
> **The consequence for testing is specific:** the server-side suites can prove that a scan which arrived was handled correctly, and they cannot prove anything about scans that did not arrive. **Only a device test can, and only if it is run with the network actually off** -- not mocked, not stubbed, off.

**What each layer can honestly claim:**

| Layer | Proves | Cannot prove |
|---|---|---|
| **Static / grep gates** | An absence. **The strongest evidence in the whole suite**, because it is complete rather than sampled | That present code is correct |
| **Unit** | A pure function's behaviour: the error mapper, `Intl` formatting, image downscaling, shape validation, the state-to-action mapping | Anything about the device, the network, or a real response |
| **Contract** | That the generated client matches the committed spec, and that the spec moved additively | That the server behaves as the spec says |
| **Integration, against a real API** | Headers, idempotency, 401 handling, the error surface | Rendering, layout, permission, camera |
| **Device journeys (Maestro)** | That a real build completes a real journey on a real emulator | Physical camera, App Links, push, glyph rendering, performance |
| **The manual device pass** | **Everything the layers above structurally cannot** | Nothing repeatable, which is why it has a script and a signature (T7) |

## 6. The layers, and what lives in each

### 6.1 Static -- fourteen gates, and they are the best evidence we have

**Eleven from ADU-MOB-01 S18.1 plus three from ADU-MOB-03 S8.** They are repository-wide, never path-filtered, and each is an invariant that would otherwise be a habit.

> **A grep gate is the only kind of test that is complete rather than sampled.** *"`fetch(` appears nowhere outside `src/api/`"* is a statement about the whole codebase; every other test in this document is a statement about the cases someone thought of. **When a ruling can be expressed as an absence, expressing it as an absence is strictly better than testing for it.**

### 6.2 Unit -- where the buyer app's real logic lives

**Most of this app is rendering. The parts that are not are these, and each has a defect that reaches a buyer:**

| Module | The test that matters |
|---|---|
| **The error mapper** | Every code in ADU-MOB-01 S5.1 maps to its own catalogue entry. **A 404 renders as not-found and never as a permission message** (`QA-AUTHZ-*`) -- rendering a scope failure as *"you are not allowed"* re-creates the enumeration oracle in copy |
| **The default branch** | An unrecognised order state, error code and scan outcome each render the honest string and not a blank (B1, S3.4) |
| **`Intl` formatting** | Money from `{amount_minor, currency}`, dates in the market timezone, **and the Hermes `Intl` presence check** -- a stripped `Intl` renders every price and deadline wrong in exactly one locale |
| **The clock offset** | Recorded and transmitted, **never applied to a timestamp** (S6.4) |
| **Image downscale** | The output fits the cap **and the transaction reference is still readable** -- the second half is a human check (S9.2), and the unit test only owns the byte count |
| **The idempotency key lifecycle** | Minted at mount, persisted, reused across attempts, deleted on success or cart change (B6) |
| **Deep-link parsing** | Malformed handle and slug are rejected before routing |

### 6.3 Contract

`@adulis/api-client` regenerated from the committed `contracts/openapi.json`, diff must be empty; the spec's own diff must be additive. **This is what makes ADU-API-01 S3.1's additive-only invariant enforceable rather than aspirational** -- a removal or retype fails the mobile build the same day it fails the console's.

### 6.4 Device journeys -- five, and one changed

**ADU-MOB-01 S18.1's five, with the handoff journey rewritten by the offline withdrawal:**

| # | Journey | Crosses |
|---|---|---|
| 1 | Install to storefront by deep link | The install seam, the link map |
| 2 | Anonymous cart to first reservation, including identity creation | The most consequential seam in the funnel |
| 3 | Payment instructions to evidence submitted | The single decryption path and the upload |
| 4 | **Scan with the network down, retry with it restored, outcome rendered** | **Rewritten.** v1.0 read *"scan offline to synced"*, which tests a feature that no longer exists |
| 5 | Claim filed with evidence | The DPIA's minimisation rule as a screen |

**Journey 4 is the one to write first and the one most likely to be written wrong.** *Network down* means the emulator's network is off, not a mocked failure -- **a mocked failure proves the error branch renders and proves nothing about whether the app queued something it should not have.**

## 7. The negative-case corpus

> **RULING T4 -- the negative case is the test. A journey that proves only the happy path is not counted at a gate.**

**Each row is a defect that would ship green without it.**

| # | The negative case | What it catches | Sev |
|---|---|---|---|
| **N1** | Kill the process mid-`POST /v1/orders`, relaunch, retry | **A second order, a second stock decrement, a buyer charged twice** (B6) | **S1** |
| **N2** | Leave MB-21 while `SENDING`; then search the container | A queue that was not supposed to exist (B25, gate 10) | **S2** |
| **N3** | Resend a byte-identical scan | `replay: true` rendered as failure at a doorway | **S2** |
| **N4** | Set the device clock back an hour, then scan | Backdated evidence credited (threat 5) | **S1-T** |
| **N5** | Revoke the session server-side, then act | The cart, the device id or the idempotency key destroyed with the token (B4) | **S2** |
| **N6** | Raise `min_supported_client` above the build, then open a deep link and a push | Something routing past the floor | **S2** |
| **N7** | Submit a 12 MP screenshot as evidence | `EVIDENCE_TOO_LARGE` shown to a buyer trying to pay (B10) | **S3** |
| **N8** | Add a second seller's product to a cart | A silent merge instead of `CART_SELLER_CONFLICT` | **S2** |
| **N9** | Reserve a cart whose lines changed underneath | Fewer than six reconciliation states, or an auto-corrected cart | **S2** |
| **N10** | Sign in with a number that has no account, and one that does | **Non-identical refusals** -- the enumeration oracle (AUTH S17) | **S1** |
| **N11** | Verify with `audience` in the body | A client coding against a corrected document (D-180) | **S3** |
| **N12** | First sign-in with the age box unticked | `AGE_DECLARATION_REQUIRED` shown as a toast rather than at the checkbox | **S4** |
| **N13** | Deny notification permission, then let an order approach expiry | The badge-and-countdown fallback missing (PRD S9.3) | **S3** |
| **N14** | Deny camera permission on MB-21 | The tap alternative unreachable -- **an order that cannot be completed at all** | **S3** |
| **N15** | Delete an account with an open order, a claim and a pending refund | A blocker list showing one item, or *"and 2 more"* | **S3** |
| **N16** | Render every screen at the largest OS text size, in Amharic | **D1's clipped Ge'ez, D4's fixed height, D10's truncation** | **S2** (per ADU-QA-01 S5.2's note) |
| **N17** | Return an unknown `state`, error code and scan outcome from a stub | A blank screen where a default branch belongs | **S2** |
| **N18** | Walk every user-content surface looking for a report control | A store-mandated capability missing on one surface (ADU-MOB-05 S6) | **S1-S** |
| **N19** | Grep the built bundle and the locale catalogue for tier and price terms | **The App Store rejection, before it is a rejection** | **S1-S** |
| **N20** | Search the container and the logs for seeded values after a full session | Authenticated data at rest (S2.1) | **S1** |

> **N16 is classified S2 and it looks like S4.** ADU-QA-01 S5.2 already makes this point about the missing-glyph failure: it makes published figures invisible across an entire language's screens, **and it is invisible to a reviewer who does not read Amharic.** Classify by consequence.

## 8. The ruling audit -- which rulings have a check, and which are promises

> **RULING T3 -- a ruling with no mechanical check is recorded as a promise, not as a control.**

**Fifty-odd rulings are live across ADU-MOB-01, -02, -03 and -05.** This is what actually enforces them.

| Enforcement | Rulings | Confidence |
|---|---|---|
| **A grep gate** -- complete, not sampled | B2, B5, B8, B12, B15, B25, D1, D2, D5, and the IAP string rule (S16) | **Highest.** These cannot silently stop holding |
| **A unit or integration test** | B1, B4, B6, B7, B10, B16 (partially), S5.1's error surface, S6.4's offset | High |
| **A device journey** | B20, B25's retry behaviour, M1, M6, and the deep-link half of B8 | Moderate. Sampled, and only on an emulator |
| **The manual device pass only** | B16's Ge'ez guarantee, B17's budgets, D1's Android clipping, D3's bundle size, D11's reach, every accessibility line | **Low, and it is the only check.** S9.2 is why it has a script |
| **A counter, after the fact** | **B9 / M6's scan-versus-tap ratio, B22's floor discipline** | **Detects, does not prevent** |
| **Nothing mechanical at all** | **M2** (no entitlement state) -- partially covered by the string gate  -  **M7** (disclosure is an interstitial)  -  **M9** (nothing auto-copied)  -  **M11** (sign-out and delete separation)  -  **M12** (labelled countdowns)  -  **D9** (toasts)  -  **D12** (`PriceBlock` reuse)  -  **B19** (no recruitment CTA)  -  **B21** (what an OTA may carry)  -  **T1's publish discipline** | **Promises.** Each is a review-checklist line and nothing else |

> **The last row is the finding.** **Ten rulings, several of them store-rejection-class, are held up by a person remembering.** M11 and M12 in particular are one careless refactor from being wrong, and neither would fail a build.
>
> **Three of them can be cheaply mechanised and should be** (S14 Q2): a lint rule forbidding `Clipboard.setString` outside a handler (M9); a lint rule forbidding `PriceBlock` outside `features/storefront` and `features/cart` (D12); and a snapshot test asserting that MB-32's sign-out and delete entries are non-adjacent (M11). **The rest are genuinely human**, and saying so is more useful than pretending otherwise.

## 9. Devices and the manual pass

### 9.1 The matrix

> **RULING T5 -- measured on the reference Android. A simulator number is not evidence.**

| Device | Why it is on the list |
|---|---|
| **Low-end Android, 2 GB, oldest supported OS** | **The binding constraint** (PRD S23, PD-01 S14). Every performance budget is measured here and nowhere else |
| **Oldest iPhone in support** | The other store's floor |
| **One mid Android** | ADU-QA-01 S12 already asks for it. It is where *"works on my phone"* and *"works on the cheap one"* diverge |
| Emulators | Journeys only. **Never a gate for camera, App Links, push, glyphs or performance** |

### 9.2 The manual pass has a script and a signature

> **RULING T7 -- *"I checked it"* is not evidence at a gate.**

**The manual pass is a numbered script, run in order, with a result recorded per line, a build SHA, a device, a date and a name.** It exists because six things in this product **cannot** be automated at reasonable cost, and all six are release gates:

1. **The Ge'ez render** -- wordmark, both platform names, at least one figure, as characters, in both locales, at the largest text size, **on Android specifically** (D1).
2. **Evidence legibility** -- a real screenshot from a real cheap phone, downscaled, still readable.
3. **App Links and Universal Links** on physical devices, from a real link, with the app installed and uninstalled.
4. **Push** -- registration, delivery, tray collapse, deep-link on open.
5. **The scan** at a real distance, in real light, off a real screen and a real print.
6. **The performance budgets** in ADU-MOB-01 S13.

> **Item 5 is the one that will be done indoors and should not be.** ADU-MOB-03 S4.1 makes the scan the only outdoor surface in the app. **Test it outdoors, at midday, at arm's length**, or the contrast ruling is untested and the first evidence will be a seller saying it does not work.

## 10. Test data

> **RULING T6 -- seeded, deterministic, produced by a script.**

**Clicking through the app to create a fixture is how a suite becomes unrepeatable**, and on this product it is also how a tester accidentally becomes the only person who can reproduce a defect.

**The seed must be able to produce, on demand:** a seller at each trust level  -  an order in each state including both payment-rejected branches  -  a cart whose lines are stale in each of the six reconciliation ways  -  a claim of each type  -  **a valid QR for a ready-for-handoff order**  -  a buyer with and without an account for the enumeration test  -  **and the review credential of ADU-MOB-05 S3.2.**

**Known seeded strings are part of the contract**, because S2.1 and N20 search for them: a specific bank account number, a specific phone, a specific product name.

> **Teardown deletes what the suite created, by id. Never by a global predicate** (RUL-04 S3). This is house doctrine and the D-83 instance is still open; **a mobile suite that adds a second predicate teardown is repeating a defect the register already names.**

## 11. Release-gate evidence

**ADU-PROJ-01 S12 lists the gates. ADU-MOB-01 S25 lists the mobile ones. ADU-MOB-05 S8 lists the paperwork ones. This document produces the evidence, or states plainly that it cannot.**

**The evidence pack, per submission:**

| Gate class | Evidence |
|---|---|
| Static | CI run URL, all fourteen gates green, on the submitted SHA |
| Unit / contract | Coverage of the S6.2 modules and a green contract diff |
| Journeys | Maestro run output, five journeys, on the submitted SHA |
| **Negative corpus** | **S7's twenty cases, each with a result** -- this is the one that gets abbreviated under pressure |
| Manual | The signed script from S9.2, with device, build and date |
| Performance | Numbers against S13's budgets, from the reference Android |
| Paperwork | ADU-MOB-05 S8's checklist |

> **ADU-QA-01's rule stands and is the reason this section exists: a gate is met or it is not, never *"met with a note".*** Where one cannot be met and the decision is to ship anyway, **that is an accepted risk with a name against it, not a passed gate.** With one person holding every role, this is the sentence doing the most work in the entire quality system -- **there is nobody else to say it.**

## 12. Exploratory charters

**Time-boxed, ninety minutes, one charter each, findings written up against ADU-QA-01 S5.3's defect standard.**

| Charter |
|---|
| **Be a buyer with a bad connection.** Every screen, network toggling throughout. Look for anything that claims success it was not told |
| **Be a buyer at a doorway.** MB-21 only, outdoors, one-handed, with someone waiting. Look for anything that needs two hands or a second look |
| **Be a careless thumb.** Every destructive control, every adjacent pair, at the largest text size |
| **Be an Amharic reader.** Every screen, no English. Look for anything that only makes sense in the other language |
| **Be a store reviewer with no context and no Ethiopian SIM.** Only the ADU-MOB-05 S3.3 kit. **Stop at the first thing you cannot do** |
| **Look for the price.** Every screen, every error path, the chat surface, the About screen. **Try to make a tier name appear** |

> **The last charter is the highest-value ninety minutes in this document.** It is an adversarial search for an S1-S defect, run by the person who most wants it not to exist, which is exactly the tension ADU-QA-01 S2.3 says must be protected.

---

## 13. Findings

| # | Finding | Kind | Where |
|---|---|---|---|
| **F1** | **ADU-QA-01 S1's fourth property still says the handoff scan *"is created offline"*.** It is one of the four premises the whole handbook is built on, and the offline withdrawal removed it. **Some tests it implies are still right** -- backdating, late arrival, replay -- **and some test a feature that does not exist** | **Residue of a withdrawn feature, in the document that decides what gets tested** | S0.1 |
| **F2** | **ADU-QA-01 is owned by *"QA Engineer #1"*, who does not exist.** ADU-REPO-01 S3 is one owner, every path. **The consequence is not cosmetic**: S2.3's independence rule -- *"the QA engineer must be able to write 'this gate is not met' and have that stand"* -- has no second person to stand on | **Stale role, with a real consequence** | S11 |
| **F3** | **The app-switcher snapshot is undefended on MB-17.** Both platforms capture and persist a thumbnail on background, and that screen holds an account number. **No document mentions it**, and it is not the same question as the screenshot blocking S7.5 rightly rejected | **Absence** | S2.3 |
| **F4** | **The over-the-air publishing credential has no stated handling anywhere.** It grants code execution in every install, with no store review and no rollback window | **Absence. The largest exposure in the product** | S3.1 |
| **F5** | **Ten rulings have no mechanical check**, several of them store-rejection-class, and three of those could be lint rules for an hour's work | **Enforcement gap** | S8 |
| **F6** | **ADU-MOB-01 S18.1's fifth Maestro journey still reads *"scan offline to synced"*** -- a device test for a withdrawn feature. **Third instance of the same residue class**, after the Zustand line and ADU-QA-01 S1 | **Residue** | S6.4 |

> **F1, F6 and ADU-MOB-03's F1 are the same defect three times**, in three documents, all from one deletion. **The lesson is not that the deletion was careless** -- ADU-MOB-AMD-01 anticipated over-deletion and got the opposite failure. **It is that a withdrawn feature leaves residue in every document that ever depended on it, and the amendment set only listed the ones it knew about.** A grep for `offline` across the whole document set, not just the mobile ones, is an hour and it is owed.

**Documents to reissue:**

| Document | Change |
|---|---|
| **ADU-QA-01 -> v1.1** | S1's fourth property rewritten: the scan is a foreground request; **what is still true is that its timestamp originates on a device we do not control** (**F1**)  -  ownership corrected to the sole engineer, with S2.3's independence problem stated rather than assumed away (**F2**)  -  the `QA-MOBILE-*` area populated from S7 |
| **ADU-MOB-01 -> v1.2** | Journey 5 rewritten (**F6**)  -  **plus the S3.4 Zustand line, gates 12-14, and ADU-MOB-05's two corrections, all already owed.** This reissue is now four documents' worth of debt and should not wait longer |
| **ADU-SEC-01 -> v1.1** | The release-path credentials and the OTA channel (**F4**), which is a security control and belongs in the security document rather than here |
| **ADU-DPIA-01 -> v1.1** | The app-switcher snapshot and the third-party-keyboard disclosure (**F3**), alongside the on-device inventory row and the report-response commitment already owed |

---

## 14. Open items

| # | Item |
|---|---|
| **Q1** | **The privacy overlay on background** (F3). Cheap, and it changes one screen's behaviour |
| **Q2** | **The three cheap lint rules** in S8 -- clipboard, `PriceBlock`, sign-out adjacency |
| **Q3** | **Whether `expo-updates` code signing is adopted.** Not at MVP; the trigger is the day more than one person can publish |
| **Q4** | **The mid Android.** ADU-QA-01 S12 has asked for it since August |
| **Q5** | **Release-gate thresholds.** ADU-QA-01 S12 already records that several gates say *"meaningful share"* -- **the pass mark must be written down in advance or the gate is decided after the fact by whoever wants to ship.** That applies with more force here, where the same person builds, tests and decides |
| **Q6** | **Who runs the sixth exploratory charter.** It is an adversarial search against one's own work, and S8's independence problem is at its sharpest there |

---

*Binding test specification and device security posture, v1.0 -- the mobile chapter of ADU-QA-01 rather than a rival to it. Seven rulings, nine threats ordered by what will actually happen, twenty negative cases and an audit of what enforces the fifty-odd rulings this workstream has accumulated. **Two things in it are worth more than the rest.** The first is S3: **the over-the-air update channel is a code-execution path into every installed copy of the app, with no store review and no rollback window, protected by one account credential that no document in this set has ever mentioned** -- a larger blast radius than a production deploy, sitting outside every threat model written so far. The second is S8, which counts how many rulings are actually enforced and finds **ten that are held up by a person remembering**, several of them store-rejection-class. **Six findings, three of which are the same residue in three different documents**, all left by one deletion that the amendment set could only account for where it knew to look. **ADU-MOB-07, release and operations, is the last in the series** -- and ADU-MOB-01 v1.2 now owes four documents' worth of corrections and should not wait for it.*
