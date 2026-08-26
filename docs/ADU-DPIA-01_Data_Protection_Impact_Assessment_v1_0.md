# ADU-DPIA-01 — Data Protection Impact Assessment

**Version:** 1.0 · **Baseline date:** 24 August 2026
**Controller:** Adulis (pre-incorporation — see §3.1)
**Owner:** Founder / CEO
**Status:** **Founder working draft prepared for professional review. Not legal advice, and not yet a completed DPIA.**
**Legal framework:** Personal Data Protection Proclamation No. 1321/2024 (FDRE)
**Related:** ADU-00 v9.1 · ADU-PROJ-01 v9.0 · ADU-PRD-01 v8.5 · ADU-WEB-01 v1.0 · ADU-ARCH-01 v2.0 · ADU-DB-01 v1.6 · ADU-API-01 v1.3 · ADU-XREF-01 v1.5

---

## 0. Status, and how to use this document

**This is not a completed DPIA and must not be relied upon as one.** It is a structured working draft: the processing inventory, the data flows, the risk register and the mapping of risks to controls that already exist in the system design. That is the part a founder can do accurately, and it is the part an external adviser would otherwise charge to reconstruct.

**What it is not:** a legal opinion on Proclamation 1321/2024, a determination of lawful basis, or a sign-off. I am not a lawyer, this is not legal advice, and three things in §2 have consequences serious enough that a qualified Ethiopian data protection practitioner must review them before **any** personal data is collected — including the first waitlist submission.

**How to use it.** Take §2 and §11 to counsel first; they are the questions that determine whether the current architecture is lawful at all. Everything from §4 onward is the evidence a reviewer will ask for, assembled in advance.

**Legal citations were verified against public sources on 24 August 2026** and are cited where relied upon. Implementing regulations and ECA directives were still developing at that date; **the position may have moved and should be re-checked.**

---

## 1. Why a DPIA is required, and what it covers

<cite index="14-1">Proclamation 1321/2024 obliges a controller to carry out a Data Protection Impact Assessment before beginning any processing likely to result in a high risk to the rights and freedoms of data subjects.</cite>

Adulis meets that threshold on several independent grounds. Any one would trigger it:

| Ground | Adulis processing |
|---|---|
| Large-scale processing of identity data | Government-ID verification of every seller from open release |
| Financial data | Payment evidence, payout credentials, bank records in disputes |
| Systematic evaluation producing significant effects | The trust ladder — automated, and it caps what a seller may sell (§7.4) |
| Data concerning vulnerable subjects | Buyers with no age verification (§9, R15) |
| Innovative use of technology | Automated social-account verification, embedding-based intent classification |
| Cross-border transfer | Every processor in the current architecture is outside Ethiopia (§2.1) |

**Scope of this assessment.** All Adulis processing at MVP and controlled beta: the public website and waitlist, seller storefronts, the buyer mobile app, the Seller Companion, the seller PWA, the back-end and its isolated boundaries, analytics, and the dispute-resolution ladder.

**Out of scope, pending their own assessment:** V3 marketplace discovery, advertising, Crowd Commerce, Group Buying, delivery, and any funds custody following an NBE licence.

---

## 2. Three findings that come before the risk register

These are not risk items to be mitigated. They are questions of legality that determine whether the architecture can ship.

### 2.1 Article 22 — data localisation. **The current architecture does not satisfy it.**

<cite index="29-1">Article 22 requires personal data collected locally to be stored on a server or data centre located in Ethiopia, and permits the ECA to designate categories of critical data that must remain within Ethiopian borders entirely.</cite> <cite index="30-1">Data designated critical or sensitive attracts heightened localisation and prior-approval requirements.</cite>

<cite index="29-1">This is a material departure from the GDPR, which permits transfers under safeguards without mandating local storage.</cite> An architecture designed against GDPR intuitions will be wrong here, and the Adulis architecture was.

**Every component currently specified stores or processes personal data outside Ethiopia:**

| Component | Where | Personal data involved |
|---|---|---|
| Cloudflare Pages + Workers | Global edge | Waitlist submissions transit it — name, phone, handle, city |
| Cloudflare R2 | Non-Ethiopian region | Product media; payment evidence and payout ciphertext under the current design |
| Product Postgres | **Undecided.** ADU-PROJ-01 §10 records that no major cloud provider operates an Ethiopian region | Everything |
| FCM / APNs | Google, Apple | Device tokens, notification content |
| KYC vendor (from open release) | To be selected | Identity documents, name, ID number |

**ADU-PROJ-01 §10 already carries hosting region as an open item** — *"local colocation or a nearby region are the options"* — and treats it as a cost and latency decision. **Under Article 22 it is a legality decision**, and "a nearby region" is very likely not available as an answer.

> **Required before any processing:** a legal opinion on (a) the scope of Article 22 as applied to a platform of this kind, (b) whether edge transit through Cloudflare constitutes storage, (c) which Adulis categories the ECA has designated or is likely to designate as critical, and (d) whether local colocation is the only compliant hosting answer.
>
> **This should be the first professional review commissioned, ahead of the payments and consumer-protection opinions already scheduled in ADU-PROJ-01 §14.** It is upstream of them: it determines where the system runs.

### 2.2 Registration and DPO are prerequisites, not follow-ups

<cite index="14-1">All data controllers must register with the ECA's Register of Data Processors.</cite> <cite index="15-1">Controllers and processors are required to register in order to process personal data, must notify the Authority of changes, and registration can be cancelled where information is false or requirements are breached.</cite>

**Processing without registration is therefore processing without authority.** The waitlist is scheduled to open in Phase 0b, in parallel with Phase 0 (ADU-PROJ-01 §11) — **before incorporation is complete.** That sequencing has to change or the first submission is unlawful.

On the DPO: <cite index="14-1">the officer must be free from instruction in the exercise of their tasks, must not be dismissed or penalised for performing them, and must report to the highest level of management, with contact details communicated to the ECA and made available to data subjects.</cite> <cite index="14-1">Engaging external counsel to serve as or support the DPO function is described as a viable and common approach in a market where the expertise is scarce.</cite>

**The independence requirement has a governance consequence for a three-founder company.** A DPO who reports to the highest level of management and cannot be penalised for their findings is difficult to satisfy internally when the highest level of management is three people who are also the entire staff. **External counsel is very likely the right answer**, and the cost belongs in the model now rather than being discovered at registration.

### 2.3 Cross-border transfer of sensitive data needs prior approval

<cite index="27-1">Cross-border transfer of sensitive personal data requires prior approval of the Authority.</cite> <cite index="11-1">General transfers are permitted only where there is proof of adequate protection in the recipient jurisdiction, explicit informed consent, necessity, or transfer from a public register.</cite>

**Note carefully what "sensitive personal data" means in this statute.** <cite index="12-1">The category covers racial or ethnic origin, political opinions, religious beliefs, health, genetic and biometric data, and sexual orientation.</cite> **Financial data and identity numbers do not appear in that list.**

That cuts two ways and both matter:

- **Adulis may not process "sensitive personal data" as legally defined at all** — it holds no health, biometric, political or religious data. The prior-approval requirement in §2.3 may therefore not bite.
- **But the data it does hold — bank records, ID numbers, payment evidence — is high-risk regardless of statutory label.** A DPIA that concluded "not sensitive, therefore low risk" would be wrong, and the risk register in §9 is built on actual harm rather than on the category label.

**Ethiopia has not ratified the Malabo Convention** and <cite index="22-1">is not party to any regional or international data protection treaty</cite>, so no treaty mechanism is available to support transfers.

---

## 3. Controller, processors, and accountability

### 3.1 Controller

**Adulis** (formerly Omnivo), Addis Ababa. **Incorporation is not yet complete** (ADU-PROJ-01 §8.1), which creates a gap: the entity that must register with the ECA and appoint a DPO does not yet exist, while the waitlist is scheduled to collect personal data in Phase 0b.

> **Action:** incorporation, ECA registration and DPO appointment must all precede the first waitlist submission. This reorders ADU-PROJ-01 §11.

**Scope basis.** <cite index="28-1">The Proclamation applies to processing by any controller or processor established in Ethiopia, whether the processing itself occurs inside or outside the territory.</cite> Adulis is established in Ethiopia and processes data of people in Ethiopia; it is squarely in scope on both limbs.

### 3.2 Processors

| Processor | Purpose | Location | Agreement in place |
|---|---|---|---|
| Cloudflare | Site hosting, edge, object storage | Global | **No** |
| Hosting provider (undecided) | Product database | **Undecided** | **No** |
| Google (FCM) | Push, Android | Outside Ethiopia | **No** |
| Apple (APNs) | Push, iOS | Outside Ethiopia | **No** |
| SMS gateway (undecided) | OTP, collection reminders | Likely local | **No** |
| KYC vendor (from open release) | Identity verification | Undecided | **No** |
| Payment collection provider | Subscription collection | Likely local | **No** |

**No processor agreement exists with any of them.** Each requires one before processing begins, and each requires an Article 22 assessment.

**Telegram was removed from the architecture at ADU-ARCH-01 v2.0** and no longer appears here. That removal deleted a processor relationship, a cross-border flow and an assessment obligation — worth recording as the clearest privacy benefit of that decision.

### 3.3 The seller is an independent controller, and no document says so

**This is the largest unaddressed gap in the current design.**

When a buyer places an order, the seller receives the buyer's **name, phone number and delivery information** (ADU-PRD-01 §6.3). The courier receives the same for assigned orders.

**Sellers are not Adulis staff and not Adulis processors.** They are independent businesses who determine their own purposes for that data — they keep customer records, message buyers directly, arrange deliveries. **In law they are almost certainly independent controllers**, receiving a controller-to-controller disclosure.

Nothing in the document set addresses this. There is no seller data-processing term, no instruction on retention, no restriction on secondary use, and no mechanism by which a buyer exercising erasure against Adulis reaches the seller who holds a copy.

> **Required:**
> - **Seller Terms must contain data protection obligations** — purpose limitation to fulfilling the order, no secondary marketing without the buyer's own consent, a retention limit, a security obligation, and a duty to assist with data-subject requests.
> - **The buyer privacy notice must disclose the disclosure** — that ordering shares their name, phone and delivery details with an independent seller, and that the seller is responsible for their own handling of it.
> - **The erasure process must tell the buyer plainly** that Adulis can erase its own records and cannot erase the seller's, and must name the route to the seller.

**Courier disclosure is better controlled and worth crediting.** ADU-DB-01 §6.9 enforces courier access by row-level security scoped to currently assigned orders, and access ends with the assignment. That is data minimisation implemented as a database policy rather than a service filter, and it is the correct shape.

---

## 4. Processing inventory

Fifteen activities. Retention figures are as currently implemented or specified; where a figure is not yet decided it says so.

| # | Activity | Data categories | Subjects | Retention | Where held |
|---|---|---|---|---|---|
| **P1** | Waitlist | Name, phone, platform, handle(s), city, product category, self-reported follower count | Prospective sellers | **12 months** | `waitlist` schema, separate store |
| **P2** | Account and authentication | Phone number (E.164), OTP codes (hashed), sessions, device, approximate location | Buyers, sellers, team, couriers | Life of account | `core` |
| **P3** | Identity verification | Legal name, ID type, verification date, verifier, **keyed HMAC of ID number**, verified boolean, company relationship | Sellers, company representatives | **Hash survives account deletion** — §7.2 | `verification` schema, isolated |
| **P4** | Social account verification | Handle, platform account id, follower count at verification | Sellers | Life of account | `core` |
| **P5** | Catalogue and storefront | Store name, description, product text and media | Sellers | Life of account + media lifecycle | `core`, R2 |
| **P6** | Orders and reservations | Buyer identity, items, prices, delivery information | Buyers, sellers | Retained anonymised after deletion | `core` |
| **P7** | Payment evidence | Screenshot **carrying both parties' bank details** | Buyers, sellers | **Deleted on validation**; retained only while a claim is open | `financial`, isolated, encrypted |
| **P8** | Payout credentials | Seller bank account, encrypted; last four digits in `core` | Sellers | Life of account; purged on deletion | `financial`, isolated |
| **P9** | **Bank records (disputes)** | Transaction record proving payment sent or not received | Buyers, sellers | **Deleted on claim resolution** | `financial`, isolated |
| **P10** | Buyer–seller conversations | Message content, timestamps | Buyers, sellers | Operational record; **not yet decided** | `chat` |
| **P11** | Intent phrase library | Message text with identifiers removed | — (identity-stripped) | Indefinite | `nlu`, **no FK to any identity** |
| **P12** | Trust level and statistics | Handoff counts, cancellation and confirmation rates, claims | Sellers | Retained anonymised after deletion | `core` |
| **P13** | Analytics events | Versioned event stream with market, seller type, eligibility path, level | Buyers, sellers | **Not yet decided** | `analytics` |
| **P14** | Moderation and audit | Reports, decisions, reasons, actor, evidence access logs | All | **Retained in full, permanently** | `core`, isolated schemas |
| **P15** | Device and notification | Push token, platform, permission state | Buyers, sellers | Life of device binding | `core` |

> ⚠ **Three retention periods are undecided — P10 conversations, P13 analytics, and media beyond the deleted-account case.** <cite index="21-1">The Proclamation requires personal data to be stored only for a reasonable period necessary to fulfil the original purpose or as prescribed by law.</cite> **An undecided retention period is a non-compliant one**, and these must be set before launch, not after.

### 4.1 The strongest existing controls, and why they matter here

Three design decisions materially reduce risk and should be presented to a reviewer as evidence of data protection by design, because they are unusual:

**No identity image is ever received.** ADU-PRD-01 §13.1 and ADU-00 rule 6: verification happens at the vendor or on a live call, and Adulis stores an attestation. **The database has no column for an image** (ADU-DB-01 §7.3), so the guarantee is structural rather than procedural. There is nothing to secure, nothing to delete, and no deletion to evidence.

**Reading the evidence writes the log, because there is no other way to read it.** The `verification` and `financial` schemas are owned by separate database roles with no grant to the application. The only read path is a `SECURITY DEFINER` function that inserts the access-log row in the same transaction. **An unlogged read is not possible**, rather than not permitted.

**The seller is a logged reader, not an exempt one.** ADU-PRD-01 §10.3 is explicit that a log recording only operator access ignores the actor who reads the record most often. Seller access to payment evidence is recorded identically to operator access.

---

## 5. Lawful basis

Determination of lawful basis is a legal question and is flagged for counsel. The working position:

| Activity | Working basis | Note for review |
|---|---|---|
| P1 waitlist | **Consent** | Explicit checkbox, linked notice, 12-month period stated at collection |
| P2 account | **Contract** | Necessary to provide the service |
| P3 identity verification | **Legal obligation / legitimate interest** | Fraud prevention. **Not consent** — consent that cannot be refused without losing the service is not freely given |
| P6 orders | **Contract** | |
| P7–P9 financial | **Contract and legitimate interest** | Dispute evidence |
| P10 conversations | **Contract** | |
| P11 phrase library | **Legitimate interest** | Identity-stripped before entry |
| P12 trust statistics | **Legitimate interest** | See §7.4 — automated decision-making |
| P13 analytics | **Legitimate interest** | Requires a balancing test not yet performed |
| P14 moderation and audit | **Legal obligation / legitimate interest** | Retained against erasure |

⚠ **Do not default to consent.** It is the weakest basis, it is withdrawable, and using it for processing the service cannot function without creates an obligation that cannot be met when it is withdrawn. Identity verification is the clearest example.

---

## 6. Necessity and proportionality

**Data minimisation is largely well served**, and three decisions deserve specific credit:

- **The keyed hash rather than the ID number.** ADU-PRD-01 §13.1 stores an HMAC, not the document number, and uses a rotatable key in a managed store. Duplicate detection works; the number itself is not held.
- **Masked payout everywhere but one path.** `core` holds four digits. The full value has a single decryption path, restricted to the buyer on a payable order, and it logs.
- **X15's bank-record rule.** The dispute ladder asks for **a single transaction record, not a full statement.** A statement reveals balance, salary and every other payee; a transaction record proves the same fact. This is the single best minimisation decision in the design and it should be stated in the claim interface, not buried in terms.

**Two areas are not minimised and should be reviewed:**

- **Analytics events carry `seller_type`, `eligibility_path` and `seller_level` on every event.** The purpose is legitimate — ADU-PRD-01 §20 needs cohort comparison for the Phase 2 decision. Whether every event needs all three, and for how long, has not been assessed.
- **Approximate session location** is recorded per session (ADU-DB-01 §6.6) for the new-device notification. Whether it needs retaining for the life of the session, or only long enough to send that notification, has not been assessed.

---

## 7. Data subject rights

<cite index="11-1">The Proclamation grants rights to be informed, to access, to rectify, to erase, to restrict processing, to object, to receive data in a transferable format, and to object to direct marketing and automated decision-making.</cite>

### 7.1 Where Adulis is well positioned

**Access** is partly built already. §14's **evidence export** assembles a buyer's order, chats, payment records and state history — built for disputes, and it serves a subject access request for transactional data with little adaptation.

**Deletion has a real, specified process.** ADU-PRD-01 §16.9 defines what deletion does field by field, and ADU-WEB-01 §6.2 requires a publicly reachable deletion path that explains the consequences before asking for a phone number. That is better than most platforms of this size.

**X14's `CLOSING` state** lets a seller stop new obligations arriving while they wind down, which is what makes deletion actually reachable rather than theoretically available.

### 7.2 Three erasure tensions that need a documented justification

Each is a deliberate design decision with a sound operational reason. **None is currently justified in writing against the statute's erasure exceptions**, and a reviewer will ask for exactly that.

| Retained after erasure | Reason | What is needed |
|---|---|---|
| **Keyed ID hash** | ADU-PRD-01 §16.9: without it, *deletion becomes the mechanism for evading duplicate-identity detection* — a suspended seller reappears under a new account | Justification under the fraud-prevention or legal-obligation exception, and disclosure in the privacy notice |
| **Reviews, anonymised** | A seller cannot erase their reliability history by closing the account. The review is also the **buyer's** expression, and the buyer's rights do not end because the seller left | Justification, plus a clear statement of whose data the review is |
| **Moderation and audit records** | Evidence relied on in resolved claims; safety history | Justification under legal-obligation or legitimate-interest exception |

**None of these is unreasonable.** All three are the sort of thing a regulator accepts when reasoned and disclosed, and rejects when discovered.

### 7.3 Portability is not addressed anywhere

No document specifies a data export for the subject's own use. **A buyer or seller has the right to receive their data in a transferable format**, and the only export mechanisms specified are the dispute evidence export and the Business-tier CSV/XLSX export — one is claim-scoped and the other is a paid feature.

> **A right cannot be behind a paywall.** A subject-access and portability export must be free and available to every user, and it must not be conflated with the Business-tier analytics export.

### 7.4 The trust ladder is automated decision-making with significant effect

**This is the finding most likely to be missed, and it is squarely in scope.**

The right to object to solely automated decision-making applies where the decision significantly affects the individual. The trust ladder:

- is **computed, never manual** — ADU-DB-01 §8.1 removes the `UPDATE` grant precisely so a human cannot set it;
- **caps what a seller may publish** and **caps their transaction value** at New level;
- **governs placement**, and from V3 will govern discovery;
- **demotes automatically and unconditionally** on an upheld claim.

That is an automated decision with a direct commercial effect on a person's livelihood.

**The design's own strengths help here.** Thresholds are per-market configuration, **published and never secret** (§5.1). The inputs are counted facts from Adulis's own logs, not inferred characteristics. There is no learned model and no opaque score — ADU-DB-01 §19 states the feed *"is a query, not a recommender"* and the same is true of the ladder.

**What is missing is a route to a human.**

> **Required:**
> - **A published explanation** of how a level is computed and what moves it — most of this already exists as configuration and simply needs surfacing to sellers.
> - **A review path** by which a seller may contest a level or a demotion and have a person look. §5.1 permits a moderation-sourced level event with a logged reason, so **the mechanism exists**; nothing currently lets a seller *invoke* it.
> - **Assessment of whether the New-level transaction cap is itself a significant effect** requiring the same route.

---

## 8. Data flows

```text
BUYER (Ethiopia)
  ├─ phone, OTP ──────────────► core.account
  ├─ order + delivery info ───► core.order ──────────► SELLER  ⚠ independent controller (§3.3)
  │                                        └────────► COURIER (RLS-scoped, assignment-bound)
  ├─ payment evidence ───────► financial (encrypted, logged read, deleted on validation)
  ├─ bank record (dispute) ──► financial (deleted on claim resolution)
  ├─ chat ───────────────────► chat ──► nlu (identifiers stripped, no FK back)
  └─ device token ───────────► core.device ─────────► FCM / APNs  ⚠ cross-border

SELLER (Ethiopia)
  ├─ waitlist ───────────────► waitlist schema (12 months)  ⚠ before incorporation (§3.1)
  ├─ ID verification ────────► KYC vendor / video call ──► verification (attestation only, no image)
  ├─ social handle ──────────► TikTok / Instagram API  ⚠ cross-border
  └─ payout account ─────────► financial (encrypted; masked in core)

ALL
  └─ every write ────────────► analytics.event ──► ⚠ hosting location undecided (§2.1)
```

**Three disclosures leave Adulis's control**, and each needs its own treatment: to the **seller** (§3.3, unaddressed), to **law enforcement** (§9 R6, process needed), and to **platform APIs** during account-control verification.

---

## 9. Risk register

Severity is the harm to the data subject if it occurs. **A red rating means the risk is not currently mitigated to an acceptable level.**

| # | Risk | Likelihood | Severity | Existing control | Residual |
|---|---|---|---|---|---|
| **R1** | **Article 22 breach — personal data stored outside Ethiopia** | **Certain** under current design | **High** | None | 🔴 **Unmitigated.** §2.1 |
| **R2** | **Processing before ECA registration** | High | High | None | 🔴 **Unmitigated.** §2.2 |
| **R3** | **No DPO appointed** | Certain today | Medium | None | 🔴 **Unmitigated** |
| **R4** | **Seller misuses buyer PII; no controller terms exist** | Medium | Medium | None | 🔴 **Unmitigated.** §3.3 |
| **R5** | Buyer bank record over-collected in a dispute | Medium | **High** | X15 requires a single transaction, not a statement | 🟡 Depends on enforcement in the claim UI |
| **R6** | Seller identity disclosed to the wrong party | Low | **High** | Ruled: identity goes to law enforcement only, never the buyer | 🟡 **No written disclosure process exists yet** |
| **R7** | Payment evidence accessed without justification | Medium | Medium | Isolated schema; only read path logs; seller access recorded identically | 🟢 Strong |
| **R8** | Payout credential exposed | Low | **High** | Separate schema and role; masked in `core`; one decryption path, buyer-scoped, logged | 🟢 Strong |
| **R9** | Identity image leaked | **Nil** | High | **No image is ever received.** No column exists | 🟢 Structural |
| **R10** | Erasure request cannot be fully honoured | Certain by design | Low–Medium | Documented per-field treatment | 🟡 **Justifications not written.** §7.2 |
| **R11** | Automated trust decision harms a seller with no recourse | Medium | Medium | Published thresholds; counted facts; no learned model | 🟡 **No human review route.** §7.4 |
| **R12** | Courier retains buyer data after assignment | Low | Medium | Row-level security; access ends with assignment | 🟢 Strong |
| **R13** | Sensitive content on a lock screen | Medium | Low–Medium | Notification asserts no state; payment evidence never in a preview | 🟢 Specified |
| **R14** | **Breach not notified within 72 hours** | Medium | High | None — **no incident response process exists** | 🔴 **Unmitigated.** <cite index="12-1">The Proclamation requires breach notification within 72 hours.</cite> |
| **R15** | **No age verification anywhere** | Certain | Medium–High | None. Identity is created at first reserve by phone OTP with no age check | 🔴 **Unmitigated.** An age-verification requirement was implemented alongside the Proclamation and Adulis has no gate |
| **R16** | Undecided retention becomes indefinite retention | High | Medium | None for P10, P13, media | 🔴 Set the periods |
| **R17** | No records of processing maintained | Certain today | Medium | This document is the start of one | 🟡 Formalise |
| **R18** | Rights of a deceased subject | Low | Low | None | 🟡 <cite index="27-1">Privacy rights survive the death of the data subject</cite> — a process is needed |
| **R19** | Waitlist data retained beyond 12 months | Low | Low | `purge_after` is a column, not a job constant; the number is checkable in one query | 🟢 Strong |
| **R20** | Chat content leaks into the phrase library | Low | Medium | `nlu` holds no foreign key to any identity table; separation is structural | 🟢 Strong |

**Seven red items.** Six are absences rather than defects — registration, DPO, seller terms, incident process, age gate, retention periods. They are the ordinary work of standing up a compliance programme. **R1 is different in kind**: it is not an absence but a conflict between the statute and the architecture.

---

## 10. Residual risk

**With the seven red items closed, residual risk is acceptable for a platform of this scale**, and the architecture would compare favourably with most.

Three properties carry that conclusion and none is cosmetic:

1. **The highest-risk data category is not held at all.** No identity image ever enters the system, and no column exists in which one could be placed.
2. **Access to the two most sensitive stores cannot be unlogged**, because reading and logging are the same statement in the same transaction.
3. **The most sensitive dispute evidence is minimised at collection** — a transaction record, not a statement.

**The unavoidable residual is §3.3.** Buyer name, phone and delivery details reach an independent seller, and Adulis cannot technically control what happens next. That is inherent to a marketplace where the seller ships the goods. It is managed by contract, disclosure and takedown — **never eliminated** — and the privacy notice must say so plainly rather than implying a control that does not exist.

---

## 11. Actions required, in order

| # | Action | Before |
|---|---|---|
| 1 | **Legal opinion on Article 22 and hosting** | **Any technical provisioning.** §2.1 |
| 2 | **Complete incorporation** | ECA registration |
| 3 | **Register with the ECA** | **The first waitlist submission** |
| 4 | **Appoint a DPO** — external counsel is likely the right answer | Registration |
| 5 | **Set the three undecided retention periods** — conversations, analytics, media | Launch |
| 6 | **Write the seller data-protection terms** (§3.3) | First seller onboarded |
| 7 | **Write the incident response and 72-hour notification process** | First personal data collected |
| 8 | **Decide the age-verification position** (R15) | First buyer account |
| 9 | **Write the erasure justifications** (§7.2) | Privacy notice publication |
| 10 | **Build the free portability export** (§7.3) | Launch |
| 11 | **Build the trust-level review path** (§7.4) | Ladder going live |
| 12 | **Processor agreements** with every party in §3.2 | Each engagement |
| 13 | **Law-enforcement disclosure process** (R6) | Dispute ladder going live |
| 14 | **Have this document reviewed and completed by a practitioner** | Reliance on it |

**Items 1 to 4 are sequential and they gate everything else.** ADU-PROJ-01 §11's Phase 0b — the public website and waitlist running in parallel with Phase 0 — cannot proceed until item 3 is done.

---

## 12. Review triggers

This assessment is reviewed when any of the following occurs:

- **The ECA issues implementing regulations or directives** — <cite index="16-1">further regulations were expected to provide a more detailed framework</cite> and the position on Article 22 in particular may change
- The hosting decision is taken
- A KYC vendor is selected
- **Phase 2 gate drop** — identity processing moves from a cohort to every signup, which is a change of scale, not of kind
- V3 discovery introduces cross-seller processing
- A funds custody licence changes what Adulis holds
- Entry into any new market
- Any personal data breach
- **Annually**, in any case

---

*Founder working draft. Not legal advice, and not a completed DPIA. The three findings in §2 — Article 22 localisation, registration as a prerequisite, and the DPO independence requirement — should go to counsel before any further technical or commercial commitment, because the first of them determines where the system can lawfully run.*
