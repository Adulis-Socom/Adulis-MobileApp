# ADU-PROJ-01 — Adulis Project Documentation

**Version:** 9.0 · **Baseline date:** 23 August 2026
**Owner:** Founder / CEO
**Supersedes:** ADU-PROJ-01 v8.1, issued as OMN-PROJ-01 v8.1
**Related:** ADU-00 v9.0 · ADU-PRD-01 v8.4 · `Omnivo_10_Year_Simulation.xlsx` *(filename not yet renamed)* · App Store Deployment Guide

> **Naming.** The company is **Adulis**. Document identifiers move from the **OMN** series to the **ADU** series at this revision, following ADU-PRD-01 v8.4 and ADU-00 v9.0. Where older documents say Omnivo, they mean Adulis.

> Founder working baseline. Economic assumptions require validation through product, tax, payments, privacy, security, accounting and operational testing. Not legal or financial advice.

---

## 0. What changed in v9.0

v9.0 is a **consistency revision**. It renames the series, retires a number that ADU-PRD-01 v8.4 had already withdrawn, and removes references to two mechanisms the PRD deleted. No strategy changed.

| Area | v8.1 | v9.0 | Section |
|---|---|---|---|
| Company name | Omnivo | **Adulis**, OMN → ADU series | throughout |
| Minimum follower count | **5,000 on TikTok or Instagram** | **Not set.** None enforced during the controlled beta | §3.1 |
| Phase naming | "years 1–2" / "year 3 onward" | **Phase 1 / Phase 2**, per-market states rather than dates | §3, §4.2, §11 |
| Web seller console | Listed on web with no phase qualifier | **Post-MVP.** MVP has no web sign-in and no console | §9.1 |
| Short codes | Deferred deep linking, six characters, thirty-minute expiry; install attribution as a side effect | **Removed.** Post-link paste and seller handle lookup replace them | §9.3, §12, §13.1 |
| Public website | Not mentioned in any phase | **Added as the second Phase 0 workstream** | §11 |
| Version chain | Related pointed at OMN-PRD-01 v8.1, two revisions behind | Points at **ADU-PRD-01 v8.4** | header |
| Data protection gate | "before any identity processing" | Also **before the waitlist takes its first submission** | §14 |

**Two new risks are recorded** as a direct consequence of retiring the follower number: §13.1 *fabricated accounts are now cheap*, and §13.3 *the beta cohort is selected by hand and does not scale*.

Everything not listed above is carried forward from v8.1 unaltered.

---

## 1. What this document is

ADU-PROJ-01 describes the **project** — the business, its economics, its regulatory position, its operating model, its geographic and version sequence, and its risks. It answers *why* and *when*.

Feature-level rules live in ADU-PRD-01. Architecture lives in the system design drawn from ADU-PRD-01. The public website has its own specification, ADU-WEB-01.

Reading order for a new team member: ADU-00 → ADU-PROJ-01 → ADU-PRD-01.

---

## 2. The business in one paragraph

Sellers in Ethiopia — creators, small businesses and shops — sell physical goods to audiences built on TikTok and Instagram. Their commerce runs through DMs, which do not scale: products get buried, questions repeat, stock information is stale, and buyers cannot distinguish a real seller from someone who bought followers. Adulis gives each seller an ordered storefront, a chatbot that answers the repetitive questions, a reservation system, verification, and reviews backed by evidence of an actual handoff. Sellers pay a monthly subscription priced against the salesperson they would otherwise employ. Adulis takes no commission and does not touch buyer money. In Phase 1 the platform serves sellers who arrive with an audience; in Phase 2 it also serves sellers building one here, with trust earned through evidenced sales rather than imported. The same constraints that shaped the product exist across a large set of other countries, and the product travels to them.

---

## 3. Seller eligibility

### 3.1 Phase 1 — audience required

Any seller type with a **TikTok or Instagram account they can prove they control**. Creators, registered businesses and shop owners are all eligible. Account-control verification fetches the follower count at the moment of verification, so the data is captured for every seller at no additional cost.

**The minimum follower count is not set, and none is enforced during the controlled beta.** Every applicant is accepted onto the waitlist and reviewed by hand.

**Why the number went.** 5,000 was never measured. It was a reasonable guess at how large an audience must be before a storefront has something to convert, and guessing wrong is expensive in both directions: too high excludes sellers who would have succeeded, too low admits sellers who cannot make a first sale and churn having paid for nothing. The beta is the instrument for finding the real number and cannot find it while enforcing the guess. Captured follower counts, joined to whether that seller made a first sale and retained, are the input to the decision.

Any threshold set afterwards is **per-market configuration** — published, never secret, and never applied retroactively to a seller already verified. Where one exists it is measured against the **highest single connected account, never the sum**: a seller with 3,000 on each platform is very likely the same audience counted twice.

**The gate still exists for two reasons**, and both must be replaced before it can be removed:

- **Demand.** Adulis is a conversion layer on top of an audience the seller already built. A seller with no audience has nothing for the storefront to convert.
- **Fraud resistance.** A social account with a real, engaged following is expensive to fabricate and holds reputational value the owner will not burn for a single scam.

⚠ **The fraud-resistance argument is weaker without a number, and this should be recorded plainly.** A 5,000-follower account is expensive to fake; a 200-follower account is not. Removing the threshold removes most of what the gate was doing on fraud, and during the beta that work is being done instead by **hand-review of every applicant**. That is adequate for 20–30 sellers and does not scale. Whatever threshold or substitute control the beta produces has to carry this load before the cohort grows. See §13.1 and §13.3.

### 3.2 Phase 2 — open

The audience requirement is dropped entirely. Anyone may sell, including sellers with no social presence at all. Trust is earned through completed, scanned handoffs — the mechanism Upwork and Fiverr use, and one Adulis already collects evidence for.

**Three conditions gate the transition. It is not a date.**

**1. V3 marketplace discovery must be live.** This is the hard dependency. A seller with no audience has no buyers unless Adulis supplies them. Without cross-seller search, an ungated seller signs up, lists products and nothing happens. Dropping the gate before V3 admits sellers to a platform that cannot give them a single sale, and they churn within a month having paid for nothing.

**2. Government ID verification becomes mandatory** for any seller without a verified audience. It is the only identity anchor left. Note the inversion: ID verification is currently a paid premium (the blue tick). For ungated sellers it becomes a condition of selling.

**3. The trust ladder must be operating.** A brand-new seller must be visibly new and constrained, not indistinguishable from an established one.

**Phase 1 and Phase 2 are per-market states, not global ones.** A mature home market may be in Phase 2 while a new market opens in Phase 1.

### 3.3 The trust ladder

| Level | Earned by | Unlocks |
|---|---|---|
| **New** | ID verified | Limited published products; "new seller" badge; no boosted placement |
| **Established** | Sustained run of scanned handoffs with good ratings | Full catalogue; standard placement |
| **Trusted** | Sustained volume, high scan completion, low claims | Priority placement; broadcast eligibility |

Levels fall as well as rise. Thresholds are per-market configuration, published, and never secret. **A level is never purchasable** — no tier, payment or advertising spend moves a seller up.

An existing audience seller is not grandfathered above New on volume alone; account-control verification satisfies the identity requirement, but placement is still earned.

### 3.4 The buyer protection gap

**This is the most serious unresolved problem with dropping the gate, and it should be recorded plainly.**

Upwork and Fiverr protect first-time buyers with escrow: funds are held until delivery is confirmed. Adulis cannot do this before the NBE licence. A buyer transferring money to an unknown seller with no audience, no history and no escrow is undertaking the riskiest transaction on the platform — and it is precisely the transaction dropping the gate enables.

Available mitigations, none of them complete:

- Mandatory ID verification, so a defrauded buyer has a real person to name in a police report
- Transaction value caps at the New level
- Prominent new-seller disclosure at the reservation step, not buried
- A claim path that produces an evidence export fast
- Rapid level demotion and suspension on upheld claims

**None of these substitutes for escrow.** The honest position is that Phase 2 carries higher buyer risk than Phase 1, that the mitigations reduce rather than remove it, and that full resolution waits on the licence. Budget for a higher claim rate and slower claim resolution in Phase 2.

**Nothing on the public website may imply otherwise.** No "buyer protection", no "guaranteed", no "safe purchase". ADU-WEB-01 carries this as a copy invariant.

---

## 4. Revenue architecture

### 4.1 V1 — Subscription

Four tiers: $0, $10, $25, $50, all live from day one. USD is the currency of record; local prices are derived, re-derived every two months, and locked for any paid term. Prepay discounts are 5% for three months and 10% annually. Expansion markets carry regional pricing.

Collection is manual: an SMS reminder, then a bank transfer. This mirrors how Ethiopians already pay utilities and avoids card-rail dependency.

**Consequence to manage:** involuntary lapse is the dominant churn mechanism.

**Controlled-beta sellers sit outside the tier table.** They pay nothing and are not on the Free tier.

> ⚠ **Open item.** The beta entitlement set is not recorded in ADU-PRD-01. It matters commercially: the public website already tells sellers the chatbot is available from a paid tier after the beta, and the beta is understood to ship a first version of the chatbot. Settle this in ADU-PRD-01 v8.5 before the first cohort is onboarded.

### 4.2 Launch pricing

**Every new seller receives 60 days free from their own signup date** — not a calendar cutoff.

**The blue tick is excluded from the free period**, except where ID verification is mandatory, in which case it is a condition of selling rather than a paid feature. **This has a cost consequence: from Phase 2, verification labour scales with total signups rather than with Pro conversions.** It is the largest new operating cost the gate drop introduces.

### 4.3 V2 — Deals

A creator sets a proposal submission fee between $5 and $100. **Adulis collects only its 20% of the fee; the brand pays the creator's 80% directly.** A spam filter with a price, not a managed marketplace. Not a growth engine.

### 4.4 V3 — Marketplace discovery

Cross-seller search, categories, filters, ranking and comparison. **No new revenue engine.**

**V3's role has changed.** In earlier revisions it existed because V4 and V5 required it. It is now also the precondition for Phase 2 — the mechanism that supplies demand to sellers who bring none. That makes it a strategic dependency rather than a roadmap item, and it raises the bar on ranking quality, anti-gaming and new-seller impression allocation.

### 4.5 V4 — Advertising

Platform-wide sponsored reach, clearly labelled, $5 minimum campaign.

**Constraint from doctrine:** advertising may buy *visibility*. It may never buy *trust level*. Sponsored placement must be visually distinct from earned placement.

### 4.6 V5 — Crowd Commerce and Group Buying

**Crowd Commerce.** Buyers aggregate around a product; sellers compete to offer a bulk price. Adulis earns 5% of net completed merchandise value.

**Group Buying.** A small closed group forms, invites a seller, agrees the item, and each member pays their share.

Both are gated on the licence.

### 4.7 V6 — Delivery

Standard from $3, express from $20. A **narrow courier capability ships in V1** — a seller adding a trusted person to scan handoffs. That is handoff evidence, not a delivery business.

---

## 5. Geographic strategy

### 5.1 The thesis

**Adulis's constraints are its portable asset.** The product solves no card penetration, bank-transfer commerce, identity fraud, DM-based selling and a licensing perimeter that makes custody impossible. Those conditions do not exist in the United States or Western Europe. They exist across South Asia, East and Central Africa and Central Asia.

Modelling found sequential expansion into similar markets outperforms every alternative: +35% cumulative revenue in the conservative case, +113% in base, and more than tenfold in aggressive, against a home-market-only baseline.

### 5.2 Market selection criteria

All seven must hold:

1. **A large and growing population of social sellers** trading through DMs
2. **Low card penetration**
3. **A usable local payment rail** with an integrable provider
4. **No entrenched local creator-commerce competitor**
5. **Legal ability to operate**
6. **Demonstrated ability to repatriate revenue** — test with a small transfer before committing
7. **A supportable language**

Criteria 3 and 6 eliminate most markets that look attractive on 1 and 2.

**Consider a diaspora-adjacent first step** — Ethiopian communities abroad and immediate neighbours.

### 5.3 Pace and gating

**Maximum two new markets per year, each entry gated on the previous market reaching profitability.** Per-market entry cost is modelled at $25,000–50,000. **The binding constraint is execution capacity, not capital or market size.**

### 5.4 International payment structuring

**Collecting Adulis's subscription revenue.** Chapa is NBE-licensed and supports international cards, mobile money, international bank transfers and PayPal, so an Ethiopian company can collect from foreign sellers today. In expansion markets most sellers will not hold international cards, so **each market needs its own local rail**.

**Buyers paying sellers.** Adulis does not touch this.

**On mechanism:** "partnering with Stripe or PayPal" is not available. Stripe does not operate in Ethiopia. The realistic options are a holding entity in a supported jurisdiction, or a **merchant of record** such as Paddle or Lemon Squeezy. **For a three-founder team the merchant of record is very likely correct.**

**Timing: build the abstraction from day one; incorporate at month 9–12**, gated on retention data rather than the calendar.

---

## 6. Illustrative economics

Ten-year simulation, three scenarios, four configurations. Full model in `Omnivo_10_Year_Simulation.xlsx`.

**Current strategy — gated two years, then open, Ethiopia first, then similar markets:**

| | Conservative | Base | Aggressive |
|---|---|---|---|
| 10-year cumulative revenue | $3.71M | $59.8M | $1,118M |
| 10-year cumulative EBITDA | $0.53M | $28.2M | $620M |
| Sellers at year 10 | 32,919 | 444,081 | 5,030,380 |

### 6.1 What dropping the gate actually costs

Against the same strategy with the gate kept permanently:

| | Conservative | Base | Aggressive |
|---|---|---|---|
| Gate kept | $7.45M | $140.4M | $896M |
| Gate dropped at modelled year 3 | $3.71M | $59.8M | $1,118M |

**Dropping the gate is a variance-increasing decision.** It improves the aggressive case and materially worsens the conservative and base cases.

The mechanism is worth understanding, because it is counter-intuitive. **Growth was never limited by market size — it was limited by acquisition budget.** Organic growth plus what marketing spend can buy never approaches the ceiling the gate imposes. So removing the gate buys headroom that cannot be used, while churn rises and paid conversion falls across the entire base. You pay the cost of lower-quality supply without collecting the benefit of a larger market.

**This argues for the trust ladder rather than against dropping the gate.** The ladder preserves the fraud resistance and quality signal the gate provided while removing the exclusion. What the model penalises is dropping the gate and replacing it with nothing.

**Two assumptions carry this conclusion**, and both should be tested rather than trusted:

- **Open-phase churn and conversion.** The figures are blended across the legacy gated base and the new ungated cohort. The ungated cohort alone would be materially worse. If the ladder works better than assumed, the penalty shrinks.
- **Acquisition remains budget-limited.** If V3 discovery generates meaningful organic seller demand — sellers arriving because buyers are already there — this reverses, and the larger market becomes reachable.

⚠ **The simulation was run against a 5,000-follower Phase 1 gate.** That gate no longer exists as modelled. The headline figures are still directionally useful, but the Phase 1 seller-quality and churn assumptions should be re-derived once the beta produces real numbers. Do not quote these figures externally as though the modelled configuration matches the current one.

### 6.2 Correction retained

Prior documents claimed a nineteen-fold revenue improvement over the retired ticket model. That compared old revenue per *registered* seller against new revenue per *paying* seller. The correct like-for-like improvement is **about 6.2x**. Use 6x in all external material.

---

## 7. Regulatory position

### 7.1 The custody perimeter

The National Bank of Ethiopia requires a payment instrument issuer to hold **100 million ETB in a blocked account**. Staying outside this perimeter is the most valuable structural feature of the business through V3.

No escrow, no wallet, no holding of buyer funds, no remitting third-party money.

### 7.2 The licence milestone

**The licence is gated on capital, not on operating time.** Custody requires either a substantial raise or partnership with an already-licensed provider.

A payments lawyer's opinion is required on which NBE category actually applies; the capital number changes by an order of magnitude depending on the answer.

**The licence has become more valuable under Phase 2**, because escrow is the only complete answer to the buyer protection gap in §3.4.

**Plan against "after the licence is granted," not against a date.**

### 7.3 Data protection

Proclamation 1321/2024 governs sensitive personal data. Three categories require specific handling: identity verification (verify then delete, derived attestations only), payment screenshots (encrypted, isolated, deleted once validated), and buyer conversation records.

**A fourth category now exists: waitlist data.** The public website collects name, phone number, social handle, city and product category from prospective sellers, before any account exists. It is personal data, it is collected before the product ships, and it is retained for up to 12 months. The retention period stated on the website and in the privacy notice must agree, and both must agree with what is actually implemented.

**Phase 2 materially increases identity processing volume**, since ID verification becomes mandatory rather than optional. The DPIA must be revisited before the gate drops, not only before launch.

### 7.4 Defamation exposure

Adulis must never label a seller a scammer, fraudster or criminal. Published trust signals must be facts derivable from Adulis's own logs.

**Trust levels are safe ground** — a level is a factual statement about completed handoffs, not a character judgement. Keep the language descriptive: "New seller — 0 completed handoffs," never "unproven" or "risky."

### 7.5 Taxation

Foreign service costs carry 15% reverse-charge VAT. A merchant of record absorbs multi-jurisdiction sales tax. A VAT opinion is required before paid launch. **Company sellers will generally require compliant invoices** — confirm the format with the accountant.

---

## 8. Operating model

### 8.1 Founders and compensation

Three founders: CEO (accounting, economics, legal compliance, partnerships), COO/CTO (engineering), CMO/CSO (marketing and sales).

**Compensation: a creditable minimum monthly draw, plus a share of monthly profit.** The founder pool is **4% of monthly profit**, allocated **CEO 1.5%, COO 1.25%, CMO 1.25%** — pool shares of 37.5% / 31.25% / 31.25%. Where the profit share exceeds the draw, the founder receives the difference; where it falls short, the founder keeps the draw. Reviewed annually.

**Why the draw exists.** A pure profit share produced two failures. First, subsistence: in the base case a founder earns tens of dollars a month in year 1 against an Addis living wage of roughly $95–155, and nothing at all in the conservative case. Second, a pure profit share means every growth investment reduces founder income in the month it is made — paying the founders most for running the smallest version of the company.

A draw of roughly $200 for the CEO and $150 each for the COO and CMO costs about $6,000 a year and removes both failures.

**Three governance items to settle before the shareholders' agreement is signed:**

1. Does the 1.5 / 1.25 / 1.25 split reflect equity, or is equity separate and equal?
2. Does the split revisit if roles change?
3. **What is the accounting treatment?** A profit distribution is generally an appropriation of profit rather than a deductible expense. Confirm with an accountant before signature.

### 8.2 Work the founders perform until cash flow permits hiring

| Function | Load | Hire trigger |
|---|---|---|
| **Waitlist review** | Every applicant reviewed by hand — no automatic acceptance and no threshold to enforce | Application volume exceeds a few per day, or review latency exceeds the 5–7 business days promised on the website |
| **Identity verification** | ~5 min call plus scheduling; window 08:00–20:00 EAT | Queue exceeds capacity, or Pro sellers wait more than 48h |
| **Moderation** | Risk-flagged queue; 24h response required by app stores | Queue exceeds a few hours daily |
| **Claim review** | 2-day review window per claim | Claim volume exceeds a few per day |
| **Chatbot maintenance** | ~200 phrases and 0–3 intents monthly | Can remain founder work for a long time |
| **Amharic string set** | ~120 template strings plus all UI labels and both notification variants, human-translated once then maintained. **The website adds its own catalogue.** | Any new market or major feature |
| **Business tier account service** | Dedicated contact promised at $50 | Any meaningful Business-tier volume |

⚠ **Phase 2 breaks this table.** When ID verification becomes mandatory for every ungated signup, verification labour stops scaling with Pro conversions and starts scaling with total signups — a multiple of current volume. **Verification must be staffed or substantially automated before the gate drops.** A third-party KYC vendor is the realistic answer; founder video calls will not survive it.

Claim volume should also be expected to rise, since Phase 2 admits the transactions most likely to go wrong.

⚠ **Waitlist review is new founder work introduced by retiring the threshold.** With a 5,000 gate, eligibility enforced itself at no cost. Without one, a human reads every application. The website promises a 5–7 business day response, and that promise is now a staffing commitment.

### 8.3 Engineering capacity

One developer, beginner-level, working with AI coding agents under supervision. This is the binding constraint on every technical decision. Engineer #2 is the first post-raise hire.

**Phase 2 requires V3 discovery, ranking, anti-gaming and the trust ladder** — a substantially larger body of work than the eligibility change implies. Engineer #2 should be hired before the gate drops, not after.

**The public website is a separate codebase** (Next.js on Cloudflare) and does not consume mobile engineering capacity, but it does consume the same person. Budget it explicitly rather than treating it as free.

### 8.4 Support obligations by tier

Free: self-service. Assisted: 48-hour target. Pro: priority queue. Business: dedicated contact.

---

## 9. Platform and distribution

### 9.1 Clients

| Client | Audience | Purpose |
|---|---|---|
| **Public website (Next.js)** | Anyone, anonymous | Marketing pages and seller storefronts. Browse, prove value, drive install. **No account, no cart, no reservations.** |
| **iOS app** | Buyers only | Full buyer experience |
| **Android app** | Buyers and sellers | Full buyer and seller experience |

React Native with Expo managed workflow. iOS is buyer-only to avoid mandatory In-App Purchase on the seller subscription.

**The web seller console is post-MVP.** At MVP every seller operation happens in the Android app, and **there is no web sign-in of any kind**. The web tier arrives in three steps:

1. **MVP** — public web is anonymous browse only. The one authenticated exception is the account-deletion page, which proves identity by phone OTP for that request alone, issues no session and grants access to nothing else. Both app stores require it.
2. **Before paid launch** — a narrow authenticated web surface carrying subscription purchase only, roughly six screens (ADU-PRD-01 §16.7). **INVARIANT — it is never reachable from inside either app**, which is what keeps the apps outside In-App Purchase and Google Play Billing.
3. **Post-MVP** — the full seller console: shop setup, team management and RBAC, data export. **This is the primary surface for business sellers** when it arrives, because shops operate from desks with several staff.

⚠ **This resolves a contradiction.** ADU-PRD-01 v8.4 §3's client matrix marks seller setup, team management and data export as available on web with no phase qualifier, which reads as V1 scope. **ADU-PRD-01 v8.5 must carry the same qualification**, or an engineer building from §3 builds a console that MVP does not have.

### 9.2 Store readiness — start now

1. **Request a D-U-N-S number.** Free, 1–4 weeks, required for both stores.
2. **Register Google Play as an organization** — exempt from the 12-tester / 14-day closed-testing gate.
3. **Enrol Apple as an organization.**
4. **Solve international card payment** for both fees.
5. **Publish the account-deletion page.** Both stores require a publicly reachable deletion path before submission. It ships with the website, not with the app.

### 9.3 Link handling

**App installed:** Android App Links and iOS Universal Links, configured for every seller storefront URL. The seller's Adulis profile link sits in their social bio.

**There is no per-post outbound link.** Neither TikTok nor Instagram permits one. A seller cannot link to an individual product from a post, and no material may imply they can.

**App not installed:** the buyer browses the web storefront, installs, and recovers context by **pasting the social post link** or **searching the seller's handle** (ADU-PRD-01 §21.2).

⚠ **Short codes were removed in ADU-PRD-01 v8.4** and are no longer part of the design. Two consequences follow:

- **Per-seller install attribution is gone.** Attribution now comes from platform deep links where available, and otherwise from the seller a buyer first transacts with. It is weaker, and Pro sellers asking what Adulis did for them should be given the figures that are actually measurable rather than an estimate.
- **A buyer who installs with no deep link arrives at a generic home screen.** Seller handle lookup is the recovery path and is not optional. Measure `reserve_intent_web` against `first_reservation_created` for the same buyer; if the gap is wide, a deferred deep-link service becomes worth paying for — on that number, not on principle.

---

## 10. Cost control

| Line | Mechanism |
|---|---|
| **LLM inference** | Deterministic cascade; model classifies intent only; per-seller cap at 15% of tier revenue |
| **Notifications** | Push for app users; SMS for local sellers; Telegram for international |
| **Media** | No video hosting; social embeds click-to-load; images resized and CDN-served |
| **Database** | Single managed Postgres until measured pressure |
| **Verification** | Third-party KYC vendor before Phase 2; founder calls do not scale to mandatory verification |
| **Market entry** | Gated on prior-market profitability; maximum two per year |
| **Foreign services** | Budget with 15% reverse-charge VAT |

**Target infrastructure cost: under USD 50/month at 1,000 sellers.**

⚠ **Open item — product hosting location.** No major cloud provider operates an Ethiopian region. Local colocation or a nearby region are the options. **Requires a decision before product infrastructure is provisioned.**

**Resolved for the website only:** the public site runs on Cloudflare Pages with Workers. Zero egress, edge presence closer to Addis than any origin region, and it sits alongside the R2 media decision already taken. **This does not settle the product hosting question**, which involves a stateful Postgres and different constraints.

---

## 11. Delivery phases

| Phase | Scope | Gate to exit |
|---|---|---|
| **0 — Manual pilot** | No product software. 20–30 sellers across creators and shops. Collect DM screenshots. **Count the addressable population.** | Five numbers measured |
| **0b — Public website** | Marketing pages, seller waitlist, account-deletion page, both languages | Waitlist taking submissions; deletion page live; legal pages published |
| **1 — Controlled beta** | Web storefront, Android app, chatbot cascade, reservations, QR handoff, reviews, stock, account-control verification | Security review passed; VAT opinion received |
| **2 — Paid launch** | Subscription tiers including Business, blue tick, analytics, broadcasts, iOS buyer app, subscription web surface | Retention measured over six months |
| **3 — Deals** | Proposal submission, screening, moderation, fee split | Payment-posture opinion received |
| **4 — Marketplace** | V3 discovery, search, taxonomy, ranking, anti-gaming | Density and ranking quality proven |
| **5 — Gate drop** | Trust ladder live; KYC vendor integrated; mandatory ID verification; new-seller constraints | **V3 live · KYC scaled · ladder operating · DPIA revisited** |
| **6 — First expansion market** | Local payment rail, language pack, KYC vendor, regional pricing | Ethiopia profitable |
| **7 — Scale** | Second engineer, dedicated search, courier marketplace, further markets | Each entry gated on prior-market profitability |
| **8 — Custody** | Licence or licensed partner; escrow; Crowd Commerce, Group Buying | Licence granted |

**Phase 0 is not optional.** Three weeks, almost no cost, and it produces the willingness-to-pay answer, the chatbot intent inventory, and the addressable-market count.

**Phase 0b runs in parallel, not after.** The website is how the beta cohort is recruited — it is the waitlist's only front door, and the account-deletion page is an app-store precondition that must exist before either app is submitted. It is specified in ADU-WEB-01 and is a separate codebase from the product.

**Phase 5 is gated on Phase 4, not on the calendar.** If V3 is late, the gate drop is late. Dropping it early produces sellers who cannot make a sale.

---

## 12. Release gates for V1

| Gate | Evidence required |
|---|---|
| Storefront utility | Meaningful share of link visitors browse rather than bounce |
| Install conversion | Web-to-app conversion at the reserve step; `reserve_intent_web` against `first_reservation_created` for the same buyer identity |
| Context recovery after install | Post-link paste and seller handle lookup measurably return buyers to the seller they came from |
| Reservation reliability | Low duplicate and ghost reservation rates; auditable stock release |
| Handoff scan adoption | Scan completion rate high enough for verified reviews to dominate — **and high enough for the trust ladder to function** |
| Trial conversion | Sellers convert at the rate written down in advance, measured separately by seller type |
| Chatbot quality | High containment; low misclassification; regression set stable |
| Verification capacity | Repeatable process with escalation and revocation |
| Moderation | 24-hour response sustained |
| Business tier deliverability | Team RBAC, exports and dedicated contact deliverable at projected volume |
| **Amharic layout validation** | Every shipped screen reviewed in Ge'ez script with realistic strings, not placeholder text. No layout breaks, no truncated buttons, no clipped labels. **The font stack must render Latin and Ge'ez together** — an Ethiopic-only family drops every Latin character and digit. |
| **Notification delivery** | Both buyer notifications sent, delivered and acted on at measured rates, with the in-app fallback proven for buyers who denied permission |
| **Empty states** | Every list surface has a defined empty state. Checked by walking a brand-new seller account and a brand-new buyer account end to end. |
| **Follower-count evidence** | Captured counts joined to first-sale and retention outcomes, sufficient to answer whether a threshold should exist and what it should be |

**Scan completion rate now carries double weight.** It gates verified reviews and it is the currency of the trust ladder. If scan adoption is low, Phase 2 has no trust mechanism and cannot proceed.

---

## 13. Risks

### 13.1 Product

| Risk | Mitigation |
|---|---|
| Free tier too weak to drive buyer traffic | Full catalogue utility for buyers; manual conversation burden for sellers |
| Web-to-app drop-off at the reserve step | Web view answers what the bot would; measure `reserve_intent_web` against first reservation |
| Buyer installs with no deep link and cannot find the seller again | Seller handle lookup and post-link paste are hard requirements, not conveniences (§9.3) |
| Stock goes stale | Five-second stock update; graduated confidence penalties; claim path |
| Chatbot misclassifies | High confidence threshold, free escalation, frozen regression set |
| Amharic understanding is poor | Quick-reply chips carry the load; templated output |
| **Scan adoption too low for the ladder** | Measure from launch; Phase 2 cannot proceed without it |
| **Ungated sellers never make a first sale** | V3 as hard prerequisite; new-seller impression allocation in ranking |
| Shops and creators need different products | Measure separately; the seller console is where divergence shows first |
| **Buyer denies notification permission and loses the order** | In-app badge and countdown on the order card is a hard requirement, not a fallback; measure permission grant rate from launch |
| **Partial fulfilment mishandled** | Cancellation, refund and stock release operate per reservation line, not per order (PRD §9.4); buyer may cancel the remainder without penalty |
| **Fabricated accounts are cheap without a follower floor** | Hand review of every beta applicant; account-control verification still required; the beta must produce either a threshold or a substitute control before the cohort grows (§3.1) |

### 13.2 Trust and safety — Phase 2

| Risk | Mitigation |
|---|---|
| **Buyer defrauded by an ungated seller** | Mandatory ID; transaction caps at New; prominent disclosure; fast evidence export. **Not fully solvable before the licence.** |
| Ladder gamed by fake sales | Scan evidence requires a distinct buyer account; velocity and graph analysis; demotion on upheld claims |
| Scammers cycle through new accounts | Keyed ID hash detects the same person across accounts; device and payment-detail signals |
| Ranking becomes the product and is gamed | Published, non-secret criteria; sponsored placement visually distinct; never sell level |
| Claim volume exceeds review capacity | Staff before the gate drops; automate evidence assembly |

### 13.3 Economic

| Risk | Mitigation |
|---|---|
| **Gate drop lowers quality without delivering scale** | Trust ladder rather than nothing; measure ungated cohort separately from day one and be willing to re-impose a gate |
| **Verification cost scales with signups, not conversions** | KYC vendor before Phase 2; price the cost into the model before committing |
| **Hand-reviewed intake does not scale** | Adequate at 20–30 sellers, not at 300. The beta must produce a threshold or a substitute control before intake grows, or review latency breaks the 5–7 day promise made on the website (§8.2) |
| **Simulation assumes a gate that no longer exists** | Re-derive Phase 1 quality and churn assumptions from beta data before quoting the model externally (§6.1) |
| Addressable market smaller than estimated | Measure in Phase 0 |
| Trial cohorts churn at conversion | Success criteria written down in advance |
| Manual collection lapse | SMS cadence; prepay discounts; lapse measured as a first-class metric |
| Currency depreciation against USD pricing | Rate locked per term, re-derived every two months |
| Founder income insufficient in early years | Creditable minimum draw |

### 13.4 Expansion

| Risk | Mitigation |
|---|---|
| **Revenue cannot be repatriated** | Test a small transfer before committing; hard entry criterion |
| Local currency depreciates | Regional pricing per market |
| Sanctions or political instability | Legal screen per market |
| Market entry costs exceed estimate | Gate each entry on prior-market profitability |
| Execution capacity exceeded | Maximum two markets per year |

### 13.5 Engineering

| Risk | Mitigation |
|---|---|
| **V3 plus ladder plus KYC is a large body of work** | Engineer #2 before the gate drops; sequence deliberately |
| Business tier now in V1 scope | Sequence team RBAC, exports and API deliberately |
| Single beginner-supervised developer | Paid senior review of two subsystems |
| AI-generated code wrong under concurrency | Database constraints over application logic; invariant tests |
| Store rejection on first submission | Budget two to three rejection rounds |
| Custody arriving later | Ledger modelled from day one with Adulis's balance at zero |
| Multi-market configuration hard-coded | Currency, locale, payment rail, KYC vendor, eligibility and ladder thresholds are per-market configuration |
| **Documents drift out of agreement with each other** | Version chain checked at every revision; a number stated in two documents is stated authoritatively in one and referenced from the other |

---

## 14. Mandatory professional reviews

| Review | Scope | Before |
|---|---|---|
| **Senior engineering — 40 hours** | The verification subsystem and the reservation/subscription ledger | Any real identity data is captured |
| **Payments lawyer** | Which NBE category applies; whether the screenshot flow, the Deals fee split and the courier role stay outside the perimeter | Paid launch |
| **Data protection** | DPIA under Proclamation 1321/2024 | **The waitlist taking its first submission**, any identity processing — **and revisited before the gate drops** |
| **Accountant** | Founder compensation treatment; revenue recognition; reverse-charge VAT; VAT invoicing for company sellers | Shareholders' agreement signature |
| **Corporate/tax** | Foreign entity versus merchant of record | Month 9 |
| **Employment law** | Courier role classification | Any courier marketplace layer |
| **Consumer protection** | Platform liability for ungated seller conduct; required disclosures | Gate drop |
| **Per-market legal** | Operating legality, data regime, repatriation | Each market entry |

⚠ **The data protection gate moved earlier.** The website collects personal data from prospective sellers before any product exists, and states a 12-month retention period publicly. That statement is a commitment. The DPIA should cover it before the first submission, not after.

---

## 15. Founder doctrine

1. **V1 is the foundation.** Monetise labour-saving, trust and operational complexity — never the transaction.
2. **Never touch buyer money before the licence.**
3. **Publish facts, never accusations.**
4. **The seller can never silence a buyer.**
5. **The bot never goes dark.**
6. **Cost ceilings are code**, not policy.
7. **Fewest moving parts** that meet the requirement.
8. **A later version never launches to hide weakness in an earlier one.**
9. **A new market opens only when the last one is profitable.**
10. **Gate on what the seller brings, not on who they are.** An audience was a proxy for trust. When real evidence exists, the proxy retires — but it is replaced, never simply removed.
11. **Trust is earned, never purchased.** No tier, payment or advertising spend moves a seller up the ladder. The moment trust is purchasable, it is worthless.
12. **Measure before you set a number.** A threshold nobody measured is a guess with a decimal point. Where the evidence does not exist yet, say so and build the instrument that produces it.

---

*Founder working baseline. Security, payment, tax, accounting, consumer-protection and privacy reviews remain open.*
