# ADU-MOB-05 -- Buyer Mode: Store Submission and Compliance Dossier

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Status:** **Operating dossier.** It carries the administrative track, the declarations both stores require, and the gate that must be green before either submission. **It rules on nothing the product does**; where it disagrees with ADU-MOB-01 or ADU-MOB-02, they decide and this document is wrong.
**Scope:** Buyer Mode, first submission to both stores.
**Drawn from:** ADU-MOB-01 v1.1  -  ADU-MOB-02 v1.0  -  ADU-MOB-00 v1.1  -  ADU-DPIA-01 v1.0  -  ADU-PRD-01 v8.5  -  ADU-ARCH-01 v2.0 S4  -  ADU-LEG-01 v1.0  -  ADU-PROJ-01 v9.0 S9.2, S12  -  **and the two stores' current published rules, retrieved 5 September 2026 (S11)**
**Encoding:** ASCII.

---

## 0. What this is

**Every other document in this series is about what to build. This one is about what has to be true for anyone to be allowed to install it.**

None of it is code. Most of it has a lead time measured in weeks, none of it can be done in the week of submission, and **all of it is invisible until it is simultaneously blocking.**

### 0.1 Why it is written now

ADU-MOB-00 S8 lists the administrative track and says to start it early. **This is that list, verified against the stores' own published rules rather than remembered**, with the lead times the stores themselves state.

**One item on it corrects a figure this workstream has been carrying.** ADU-MOB-01 S24 Q2 says D-U-N-S is *"1-4 weeks by itself."* **Apple states up to 7 business days** -- five for Dun & Bradstreet, two for Apple to receive the record. **The lead time that actually threatens the schedule is not that one** (S1.3).

### 0.2 The dated-fact discipline

> **RULING S1 -- every external fact in this document carries its retrieval date and its source, and this document expires.**
>
> **Store rules move, and they move without notice to us.** Apple's external-link position changed in 2025 and differs by storefront; Play's tester requirement moved from twenty to twelve; target API levels move annually. **A compliance document that states a rule without a date is a document that will be followed after it stops being true**, which is exactly the failure ADU-MOB-00 S1 is about, arriving from outside the document set instead of inside it.
>
> **Re-verify every line in S1, S4 and S5 in the week before submission.** If the re-verification is skipped, this document is a hypothesis.

### 0.3 The rulings

| # | Ruling | S |
|---|---|---|
| **S1** | **Every external fact is dated and sourced. Re-verify before submission** | 0.2 |
| **S2** | **Organization enrolment on both stores, not individual** -- and on Play it is what avoids the closed-testing gate | 2.1 |
| **S3** | **App Review gets a server-side allowlisted review credential, never a demo mode** | 3.2 |
| **S4** | **The review kit includes a scannable QR for a seeded order.** Apple's own guideline names a sample QR code as the kind of resource review needs | 3.3 |
| **S5** | **Both stores' declarations are generated from ADU-DPIA-01's inventory, not written by hand** | 4 |
| **S6** | **No demo mode, no review-only branch, no build variant that behaves differently for a reviewer** beyond the credential | 3.2 |
| **S7** | **The UGC obligations are four, and the app currently satisfies two.** Filtering and published contact information are missing | 6 |

---

## 1. The administrative track

### 1.1 What is verified, and what is not

| Item | Status, 5 Sep 2026 | Source |
|---|---|---|
| **Google Play developer registration from Ethiopia** | **Supported** | Play Console Help, supported locations |
| **Google Play merchant registration from Ethiopia** | **NOT supported** | " |
| **Play closed-testing gate (12 testers / 14 days)** | Applies to **personal** accounts created after 13 November 2023. **Not stated as applying to organization accounts** | Play Console Help |
| **Play target API level for new apps** | **Android 16 (API 36)** or higher; deadline 31 August 2026, extension to 1 November 2026 available | Play Console Help |
| **D-U-N-S lead time** | **Up to 7 business days** -- 5 with D&B, 2 for Apple to receive it. **Expediting does not shorten it** | Apple Developer Help |
| **Apple organization enrolment requirements** | D-U-N-S, legal entity (no sole proprietorship, no DBA, no branch), **work email on the organization's domain**, **a public website on that domain**, binding authority, possibly notarised documents by region | Apple Developer Support |
| **Apple Developer Program fee** | **99 USD/year**, card must be **chargeable in USD** | " |
| **Apple enrolment availability from Ethiopia** | **NOT VERIFIED.** Apple publishes no region list; it states only that enrolment *"may not be supported in certain regions"* | " |

> [!] **The unverified line is the expensive one.** **Confirm with Apple Developer Support that an Ethiopian legal entity can enrol, before spending anything on a D-U-N-S number or a domain.** It is one email and it is on the critical path for the entire iOS half of this product.

### 1.2 What Ethiopia's merchant status actually means

**Play supports developer registration from Ethiopia and does not support merchant registration.**

**For the buyer app this changes nothing.** It is free, it contains no in-app purchase, and it needs no merchant account -- **a merchant profile is for taking money through Google Play, and Adulis takes no money anywhere** (payment goes buyer-to-seller, off-platform, by design).

> **But it settles an argument the set has only ever settled on guideline grounds.** ADU-ARCH-01 S4 and ADU-API-01 S4.1 keep subscriptions off the mobile binary because of the In-App Purchase rules. **It now also happens to be mechanically impossible**: Play billing from an Ethiopian developer account cannot be set up at all, because the merchant registration that would carry it is unavailable in this location.
>
> **That is a stronger fact than a guideline, because guidelines move and this does not** -- and it removes the last version of *"could we just sell the subscription in the app?"* that a future reader might raise.

**The $25 Play registration fee is still paid to Google**, and the $99 Apple fee annually, and both need an international card. **That is ADU-PROJ-01 S9.2's open blocker and it is the true head of the critical path** (S1.3).

### 1.3 The critical path, in order

```text
  international card that works for both stores        <- ADU-PROJ-01 S9.2, unowned
        |
        +----> confirm Apple enrolment is available for an Ethiopian entity
        |            (one email, do it in parallel, do it first)
        v
  the domain decision                                  <- ADU-MOB-01 S24 Q1
        |     needed for: App Links, Universal Links, the deletion web URL,
        |     the privacy policy URL, AND Apple's organization enrolment,
        |     which requires a public website and an email on that domain
        v
  D-U-N-S request  (up to 7 business days)
        v
  Apple organization enrolment  +  Play organization registration
        v
  App Store Connect / Play Console records, declarations, review kit
        v
  submission
```

> **The domain moved.** ADU-MOB-01 Q1 records it as blocking App Links and therefore tier 3. **It also blocks Apple organization enrolment**, because Apple requires a work email on the organization's domain and a publicly available website at it. **That makes the cheapest unblocked decision on the list also the earliest one**, and it is still unmade.

### 1.4 The rest of the track

| Item | Lead time | Note |
|---|---|---|
| **Reference devices** | A decision and a purchase | Tier 0's gate (B17). Duty-free under ADU-LEG-01 S6.4 |
| **Privacy policy and terms, hosted** | Days, once the domain exists | **Required in App Store Connect metadata and reachable inside the app** (Apple 5.1.1(i)) |
| **The deletion web URL** | Days | **Required by Play in addition to the in-app path** (S4.6) |
| **Published contact information** | Hours | **Required by Apple 1.2 for user-generated content** and currently absent (S6) |
| **Amharic human translation** | Weeks, external | The Ge'ez release gate, not a store gate |
| **Territory selection** | Hours | Decide before the first TestFlight, not at submission |
| **Age rating questionnaires** | Hours | Both stores. S4.5 |

---

## 2. The accounts

### 2.1 Organization, on both, and one reason is worth money

> **RULING S2 -- organization enrolment on both stores.**

**Apple:** an organization is the only enrolment that carries a company name on the listing, and Adulis is a company (ADU-LEG-01). It requires the D-U-N-S, the domain and the website.

**Google Play:** **organization registration is what keeps the app off the closed-testing gate.** Play requires **personal** accounts created after 13 November 2023 to run a closed test with at least twelve testers, continuously opted in for at least fourteen days, before production access. The published requirement is stated for personal accounts and is not stated as applying to organizations.

> [!] **Verify this one specifically before registering** (S1). It is the single cheapest thing to get wrong: registering as an individual to save a form would add **at least two weeks plus twelve recruited testers** to the first release, at the exact moment nobody has two weeks.

### 2.2 What the store listing says, and what it must not

The listing is marketing copy, and **ADU-WEB-01 S3's copy invariants bind it exactly as they bind the app** (ADU-MOB-01 S16.3). No *buyer protection*, no *guaranteed*, no *safe*, no *secure transaction*, no implication that Adulis holds or verifies money.

**Screenshots are app screenshots.** Not composites with marketing claims layered over them, and **no screenshot may show a price, a tier name or anything from the seller console.**

---

## 3. Giving App Review access -- the hardest problem in this dossier

### 3.1 The problem, stated plainly

**The app's only authentication is a phone OTP to an Ethiopian number. A reviewer in Cupertino or Mountain View cannot receive one.**

Without a way in, a reviewer sees the anonymous surfaces and nothing else -- no order, no payment, no scan, no claim, **which is the entire product** -- and rejects the build as incomplete or unreviewable. **The discovery point, if this is not solved in advance, is the rejection**, and that costs a full review cycle for a problem that takes an afternoon.

**Apple's guideline 2.1 is explicit about the obligation:**

> *"include demo account info (and turn on your back-end service!) if your app includes a login. If you are unable to provide a demo account due to legal or security obligations, you may include a built-in demo mode in lieu of a demo account **with prior approval by Apple**."*

### 3.2 The answer is a credential, not a mode

> **RULING S3 -- a server-side allowlisted review credential. RULING S6 -- no demo mode, no review branch, no build that behaves differently for a reviewer.**
>
> **A demo mode requires prior approval by Apple** -- which is a process, with a timeline, on the critical path, for a worse outcome. **And a second authentication path inside the shipped binary is a second attack surface**, on an app whose entire authentication story is one phone and one code. It is the thing an attacker would look for, and it would be there in every buyer's install.
>
> **The shape:** one allowlisted phone number whose OTP is a fixed known value, resolved server-side at challenge creation. **Named account. Revocable. Logged. Time-boxed to the review window.** It changes no client code, appears in no bundle, and can be turned off the day the app is approved.
>
> **It belongs to ADU-AUTH-01**, not to the mobile workstream -- the client cannot tell that anything is different, which is the point. **S9 F1** records that no document currently specifies it.

### 3.3 The review kit -- and Apple names the missing piece itself

Apple's *Before You Submit*:

> *"Provide App Review with full access to your app... provide either an active demo account or fully-featured demo mode, plus any other hardware or resources that might be needed to review your app (e.g. login credentials or **a sample QR code**)."*

> **RULING S4 -- the review kit includes a scannable QR for a seeded order.**
>
> **The reviewer cannot complete the core flow without one.** The buyer's scan is the product's central action, the code is minted by a seller in a different application, and a reviewer has no seller. **Apple's own guideline lists a sample QR code as an example of what to supply** -- this is not an edge case we are inventing, it is the case the guideline was written for.

**The kit, prepared before submission and attached to both reviews:**

| # | Item |
|---|---|
| 1 | **The review phone number and its fixed code**, with one line saying the code is fixed for this account only |
| 2 | **A seeded seller** with published products, images, a fulfilment note and at least one review |
| 3 | **A seeded order in each state a reviewer would want to see** -- awaiting payment, payment submitted, confirmed, ready for handoff, completed |
| 4 | **A printable or attachable QR for the ready-for-handoff order**, valid for the review window |
| 5 | **Notes explaining that payment happens outside the app**, buyer to seller, and pointing at guideline 3.1.3(e) |
| 6 | **Notes explaining that a scan is the primary completion path** and where the alternative is |
| 7 | The privacy policy URL, the deletion URL, and published contact information |

> **Item 5 is the one that prevents a whole class of rejection.** A reviewer looking at a commerce app that takes no payment will reasonably wonder where the payment is. **Say it before they ask.**

### 3.4 Two rehearsals nobody schedules

- **Sign in as the reviewer would**, on a device with a non-Ethiopian SIM or none, from the store build, with the kit as the only information. **If it cannot be done, the kit is wrong.**
- **Scan the supplied QR from the supplied account**, end to end, on the reference device. A QR that has expired by the time review opens it is a rejection with an unhelpful reason.

---

## 4. The declarations

> **RULING S5 -- both stores' declarations are generated from ADU-DPIA-01's inventory, not written by hand.**
>
> They ask the same questions in different words, they are answered months apart, and **an inconsistency between them is a compliance finding on a plate.** One source, two renderings. **ADU-DPIA-01 S4's inventory is that source, and it is currently missing the on-device row** (ADU-MOB-01 F7).

### 4.1 Apple App Privacy labels

Declared per data type, per purpose, and per whether it is linked to identity or used for tracking.

**What Buyer Mode actually collects, from the app's side:** a phone number (identity), the account and order records the buyer creates, payment evidence images, free text in reviews, claims and chat, and a device push token. **Nothing else.**

**Three answers this app can give that most cannot, and each should be given deliberately:**

- **No tracking.** No third-party SDK of any kind (B2), so **App Tracking Transparency does not apply and no ATT prompt exists.** A prompt that exists for no reason is itself a review question.
- **No advertising identifier.**
- **No data collected by third parties**, because there are none in the binary.

### 4.2 Google Play Data safety

The same inventory, plus Play's own additional questions: whether data is encrypted in transit, whether users can request deletion, and **the deletion URL** (S4.6).

**Reconcile line by line with S4.1 before either is submitted.** They will be filled in on different days by the same person, which is exactly how they diverge.

### 4.3 Privacy manifest and required-reason APIs -- an Expo-specific submission blocker

**Since 1 May 2024, App Store Connect rejects uploads that use required-reason APIs without declared reasons in a privacy manifest.** It applies to first-party app code as well as third-party SDKs.

> [!] **Expo does not generate `PrivacyInfo.xcprivacy` for you.** Expo SDK packages that use required-reason APIs ship their own manifest in the package, **but the app's own manifest is configured by hand** through `expo.ios.privacyManifests` in the app config, and third-party libraries have to be inspected for theirs.
>
> **This is a build-configuration task with a submission-blocking failure mode**, it is invisible to every gate in ADU-MOB-01 S18.1, and its natural discovery point is the first upload. **It belongs in Tier 0**, not in Tier 9 -- the cost of doing it early is an hour; the cost of doing it late is a failed upload on submission day.

**Apple emails within minutes of an upload if declarations are missing**, which makes an early throwaway upload the cheapest possible test.

### 4.4 Permission purpose strings

**Every permission the app requests has a purpose string a reviewer can check against a visible feature** (ADU-MOB-01 S25).

| Permission | Feature it must map to | Note |
|---|---|---|
| **Camera** | MB-21, the handoff scan | The clearest of the three. Say what it scans and why |
| **Photo library** | MB-18, payment evidence | **Read-only, and only at the moment of choosing.** No library enumeration |
| **Notifications** | MB-34 | Requested **after the first reservation, never at launch** -- which is also the ordering a reviewer sees, and it reads as deliberate |

**Apple 5.1.1(ii):** *"Ensure your purpose strings clearly and completely describe your use of the data."* **A generic string is a rejection with a slow round trip.**

### 4.5 Age rating

Both stores ask a questionnaire. **Two answers need care:**

- **User-generated content: yes.** Reviews, chat, claims. Answering no would be false and it is checkable.
- **Unrestricted web access: qualified.** The app contains one WebView, confined to two embed origins with navigation outside it opening the system browser (B8). **That is not unrestricted web access**, and the distinction should be stated in the review notes rather than left for a reviewer to guess.

**The age declaration in MB-04 is a self-declaration for the product's own reasons and is not an age gate for rating purposes.** Do not describe it as one.

### 4.6 Account deletion -- both halves, and the web half is Play's

**Apple 5.1.1(v):** *"If your app supports account creation, you must also offer account deletion within the app."*

**Google Play requires both**: an in-app path **and** a web link where deletion can be requested. Play's requirements for that URL are specific -- it must load without error, the deletion path must be **prominently featured and easily discoverable on the page**, and the page must **reference the app or developer name as it appears on the store listing.** It is declared in the Data safety form.

> **A privacy policy that mentions deletion in a paragraph does not satisfy this.** It is a page whose visible purpose is deletion.

**Both halves are already designed:** MB-37 is the in-app path, and it is deliberately the long way round -- explain, phone, code, confirm -- with every blocker rendered from `items[]`. **The web page is ADU-WEB-01's and is blocked on the domain** (S1.3).

---

## 5. The In-App Purchase position, in the stores' current words

**This is the risk ADU-ARCH-01 S4 flags and the one the whole set spends most effort on. Here is the current text, and it is better for us than the set assumes in one place and worse in another.**

### 5.1 The rule that makes the design correct

> **Guideline 3.1.3(e), Goods and Services Outside of the App:** *"If your app enables people to purchase physical goods or services that will be consumed outside of the app, you must use purchase methods other than in-app purchase to collect those payments."*

**Adulis sells physical goods, handed over in person. Not only is in-app purchase not required -- it is forbidden for this flow.** The buyer app's entire payment model is the one the guideline prescribes.

**Put this in the review notes** (S3.3 item 5). It converts the reviewer's most obvious question into a citation.

### 5.2 The rule that binds B19, and the storefront detail that matters

> **Guideline 3.1.1(a):** *"These entitlements are not required for developers to include buttons, external links, or other calls to action in their **United States storefront** apps. In all other storefronts, except for the United States storefront, where this prohibition does not apply, apps and their metadata may not include buttons, external links, or other calls to action that direct customers to purchasing mechanisms other than in-app purchase."*

> [!] **Read the storefront clause carefully, because it is the opposite of the comfortable reading.** The relaxation is **United States only**. **Adulis's storefront is Ethiopia**, and there the prohibition applies in full.
>
> **So ADU-MOB-01 B19 -- no seller-recruitment call to action -- is not a cautious guess. It is the rule as written**, for the storefront this app ships in. A *"Sell on Adulis"* control leading to a site where a seller eventually subscribes is a call to action directing a customer to a purchasing mechanism other than in-app purchase.
>
> **And the same clause covers the app's metadata**, which means the store listing itself must not mention seller pricing or link to it. S2.2.

**Note also 3.1.3(b), Multiplatform Services**: content acquired elsewhere may be *accessed* in the app **provided those items are also available as in-app purchases within the app.** Adulis offers no seller capability in Buyer Mode at all, so the clause does not bite -- **but it is the clause that would bite the Seller Companion**, and ADU-CMP-01 inherits that question rather than this document answering it.

### 5.3 What this means for MB-39

**ADU-MOB-02 named the About screen as the highest copy risk in the app, and 3.1.1(a) is why.** No price, no tier name, no *upgrade*, no billing link, no seller-recruitment invitation, and **the web link goes to the privacy and terms pages rather than to the site root**, because the site root is where the pricing lives.

---

## 6. User-generated content -- four obligations, and we have two

> **Guideline 1.2:** apps with user-generated content *"must include: A method for filtering objectionable material from being posted to the app  -  A mechanism to report offensive content and timely responses to concerns  -  The ability to block abusive users from the service  -  Published contact information so users can easily reach you."*

**Buyer Mode carries user-generated content on four surfaces**: reviews, chat messages, claim free text, and -- from the other side -- seller-authored product listings and storefront copy the buyer sees.

| Obligation | Status |
|---|---|
| **Report offensive content** | **Built.** MB-28, on every piece of user content, with the release gate being to walk the list |
| **Block abusive users** | **Built.** MB-29, store-mandated alongside report and already in ADU-PRD-01 S18 |
| **A method for filtering objectionable material from being posted** | **MISSING.** No document in the set specifies one |
| **Published contact information** | **MISSING.** No document names where it is published or what it is |
| **Timely responses to concerns** | **An operational commitment nobody has made.** A report control with nothing behind it is worse than the absence, because it is a promise |

> **RULING S7 -- these are four obligations and the app satisfies two. The gap is a submission blocker and it is not a client-side one.**
>
> **Filtering is a server-side question** -- it belongs with the review, message and listing write paths, not with a screen -- and it does not have to be sophisticated to satisfy the guideline: a blocklist applied at write time, plus the report path already built, is the shape most apps ship. **What it cannot be is absent.**
>
> **Published contact information is an afternoon**: a support address, on the site, in the listing, and reachable from MB-39. **It is the cheapest unstarted item in this dossier.**
>
> **And "timely responses" is a commitment the founder makes, once, in writing** -- what the response window is, who reads the queue. **A report queue nobody reads is the finding an investigator makes later**, and ADU-DPIA-01 is the document it lands in.

---

## 7. The rejection register

**What a first submission of this app is most likely to be rejected for, most likely first.** Each has a prevention and a response, because the response matters: **a rejection answered by conceding the wrong thing is how a product loses its architecture in a support thread.**

| # | Likely rejection | Prevention | If it happens |
|---|---|---|---|
| **1** | **Reviewer cannot sign in** (2.1) | S3, in full | Supply the credential and the QR. **Do not build a demo mode in response** -- it needs prior approval and it is worse |
| **2** | **Missing privacy manifest reasons** (upload rejection, not review) | S4.3, done in Tier 0 | Read Apple's email; it names the API |
| **3** | **Account deletion not found** (5.1.1(v)) | MB-37, plus the path named in the review notes | Point at the path. **Do not move deletion to a shortcut** that reuses the session -- B23 |
| **4** | **Purpose string too vague** (5.1.1(ii)) | S4.4 | Rewrite the string, resubmit. Cheap and fast |
| **5** | **"Where is the payment?"** | Review note citing 3.1.3(e) | Cite it again. **Do not add an in-app payment method** |
| **6** | **UGC moderation incomplete** (1.2) | S6 | **This one is a real gap, not a misunderstanding.** Build the filter |
| **7** | **Play Data safety mismatch** | S5, one source | Correct the form, not the app |
| **8** | **Metadata mentions seller pricing** (3.1.1(a)) | S2.2 | Edit the listing |
| **9** | **App appears incomplete** because a reviewer could not reach the core flow | S3.3's seeded states | The kit, again |

> **The register's real content is the third column.** Every entry in it says *do not concede the architecture*, because a rejection arrives with time pressure attached and the fastest-looking fix is usually the one that breaks a binding invariant.

---

## 8. The pre-submission gate

**ADU-MOB-01 S25 is the product gate. This is the paperwork gate, and both must be green.**

**Accounts and identity**

- [ ] International card works and has been charged successfully by both stores
- [ ] **Apple enrolment confirmed available for an Ethiopian entity** (S1.1)
- [ ] D-U-N-S issued; organization enrolment complete on Apple; organization registration complete on Play
- [ ] Domain live, website public, work email on the domain

**Declarations**

- [ ] App Privacy labels and Data safety form **reconciled line by line against ADU-DPIA-01 S4**, including the on-device row F7 adds
- [ ] Privacy manifest complete; **a test upload has passed** (S4.3)
- [ ] Age rating questionnaires completed on both, with the WebView answer qualified in the notes
- [ ] Privacy policy and terms live, linked in store metadata **and reachable inside the app**
- [ ] **Deletion web URL live**, deletion prominent on the page, app or developer name on it

**Review access**

- [ ] Review credential active, named, revocable, logged, time-boxed
- [ ] Seeded seller, seeded orders in five states, **QR valid through the review window**
- [ ] Review notes carry: payment is outside the app (3.1.3(e)), scan is the primary completion path, the WebView's scope
- [ ] **Both rehearsals in S3.4 done, on a device with no Ethiopian SIM**

**Content**

- [ ] No price, tier name, upgrade prompt or billing link **in the app or in the listing metadata**
- [ ] Screenshots contain no console surface and no price
- [ ] **Report control on every piece of user content**, verified by walking the list
- [ ] **Block control present**
- [ ] **A filtering mechanism exists on every write path that accepts free text** (S6)
- [ ] **Published contact information** on the site, in the listing, and reachable from MB-39
- [ ] The response commitment for reports is written down

**Build**

- [ ] Target API 36 or higher (Play, current requirement)
- [ ] Every performance budget met on the reference Android
- [ ] The Ge'ez pass done on both devices, in both locales, at the largest text size

---

## 9. Findings

| # | Finding | Kind | Where |
|---|---|---|---|
| **F1** | **No document specifies the App Review credential.** ADU-AUTH-01 has no allowlist concept, and the review problem has been named in three of this workstream's documents without an owner | **Absence. Submission blocker** | S3.2 |
| **F2** | **The four UGC obligations are met by two.** Filtering at write time and published contact information appear in no document, and the response commitment behind the report control has never been made | **Absence. Submission blocker** | S6 |
| **F3** | **The privacy manifest is an Expo-configuration task with an upload-blocking failure mode**, currently in no work order and naturally discovered on submission day | **Absence** | S4.3 |
| **F4** | **The domain blocks Apple organization enrolment as well as App Links.** ADU-MOB-01 Q1 records only the second, which understates it -- it is the earliest item on the critical path, not a tier 3 item | **Understated dependency** | S1.3 |
| **F5** | **D-U-N-S is up to 7 business days, not 1-4 weeks.** ADU-MOB-01 S24 Q2 overstates it, which is the less common failure and still a defect: **it makes the card problem look like the smaller of the two, and the card problem is the one with no owner and no stated lead time at all** | **Wrong figure** | S1.1 |

**Documents to reissue:**

| Document | Change |
|---|---|
| **ADU-AUTH-01 -> v2.9** | The App Review credential: an allowlisted number with a fixed code resolved at challenge creation, named, revocable, logged and time-boxed (**F1**) |
| **ADU-PRD-01 -> v8.6** | S18 gains the write-time filtering obligation and the published-contact requirement, with the response commitment (**F2**) |
| **ADU-MOB-01 -> v1.2** | S24 Q1 restated: the domain blocks enrolment, not only App Links (**F4**)  -  Q2's D-U-N-S figure corrected (**F5**)  -  **plus the S3.4 Zustand line and gates 12-14 already owed from ADU-MOB-03** |
| **ADU-MOB-WO-01 -> v1.1** | WO-0 gains the privacy manifest and a throwaway upload to test it (**F3**) |
| **ADU-DPIA-01 -> v1.1** | The report-response commitment, alongside the on-device inventory row already owed |

---

## 10. Open items

| # | Item |
|---|---|
| **Q1** | **The international card.** ADU-PROJ-01 S9.2, still unowned, and now demonstrably the head of the critical path rather than one item on it |
| **Q2** | **Apple enrolment availability for an Ethiopian entity.** One email to Apple Developer Support. **Do it before anything else on the track** |
| **Q3** | **The domain.** Now blocking four things, not one |
| **Q4** | **What the filtering mechanism is** (F2). A server-side decision, not a screen |
| **Q5** | **The report-response commitment** -- window and owner |
| **Q6** | **Release territories.** Ethiopia certainly; whether the diaspora storefronts open at launch is a marketing decision with a compliance consequence, since **3.1.1(a)'s relaxation applies only to the United States storefront** and shipping there changes nothing we would use |

---

## 11. Sources

**All retrieved 5 September 2026. Re-verify before submission (S1).**

- Apple, [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) -- 1.2, 2.1, 3.1.1(a), 3.1.3(b), 3.1.3(e), 5.1.1(i), 5.1.1(ii), 5.1.1(v), 5.1.2
- Apple, [D-U-N-S Number](https://developer.apple.com/help/account/membership/D-U-N-S/) -- eligibility and the 7-business-day lead time
- Apple, [Enrollment support](https://developer.apple.com/support/enrollment/) -- organization requirements, fee, region caveat
- Apple, [Privacy updates for App Store submissions](https://developer.apple.com/news/?id=3d8a9yyh) -- privacy manifests and required-reason APIs
- Expo, [Privacy manifests](https://docs.expo.dev/guides/apple-privacy/) -- what Expo does and does not generate
- Google, [Supported locations for developer and merchant registration](https://support.google.com/googleplay/android-developer/answer/9306917?hl=en) -- Ethiopia: developer yes, merchant no
- Google, [App testing requirements for new developer accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en) -- 12 testers / 14 days, personal accounts after 13 Nov 2023
- Google, [Understanding Google Play's app account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) -- in-app path plus web URL, and the URL's requirements
- Google, [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en) -- API 36, 31 August 2026

---

*Operating dossier, v1.0. Seven rulings, one critical path, nine likely rejections and a gate. **The most useful thing in it is not a rule but a fact**: Ethiopia supports Google Play developer registration and does not support merchant registration, which means the subscription this product deliberately keeps out of the mobile binary could not have been sold through Play from here in any case -- a guideline argument replaced by a mechanical one, and mechanical facts do not move when Apple revises a paragraph. **The most expensive thing in it is a question nobody has asked**: whether an Ethiopian legal entity can enrol in the Apple Developer Program at all. Apple publishes no region list, says only that enrolment may not be supported in some places, and the answer is one email that gates the entire iOS half of the product. **Five findings, two of them submission blockers, and both are absences rather than mistakes** -- there is no App Review credential in any document, and of the four things Apple requires of an app carrying user-generated content, this one has built two. **ADU-MOB-06, the security, QA and test specification, is next.***
