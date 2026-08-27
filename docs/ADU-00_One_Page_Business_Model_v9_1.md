# ADULIS — Founder One-Page Business Model v9.1

**Model:** Audience-gated commerce subscription for two years, then open with earned trust; expanding into structurally similar markets
**Baseline date:** 24 August 2026 · **Supersedes:** ADU-00 v9.0
**Headquarters:** Addis Ababa, Ethiopia
**Related:** ADU-PROJ-01 v9.0 · ADU-PRD-01 v8.5 · ADU-WEB-01 v1.0 · ADU-ARCH-01 v2.0 · ADU-DB-01 v1.6 · ADU-API-01 v1.3

> **Naming.** The company is **Adulis**. It was formerly called Omnivo; that name is retired. Where an older document says Omnivo, it means Adulis.

---

## WHAT CHANGED FROM v9.0

| | v9.0 | v9.1 (current) |
|---|---|---|
| **Identity evidence** | *"We verify, then delete the evidence… images are deleted the same day"* | **"We never receive the evidence."** No identity image is ever uploaded to Adulis. Rule 6 |
| **Trust ladder, New** | Earned by *ID verified* | **Earned by eligibility satisfied.** ADU-PRD-01 §5.1 governs |
| **Seller surface** | Not stated | **One mobile app with Buyer Mode and a Seller Companion; a PWA console for full management.** No seller app store listing of its own |
| **Core commerce** | Implied by the free tier | **Stated as a rule.** Sellers pay for automation and scale, never for the ability to complete a transaction |
| **Related chain** | Pointed at ADU-PRD-01 v8.4 and the retired OMN-PROJ-01 | Corrected |

**Nothing else changed.** Pricing, the founder compensation split, the version sequence, the geographic sequence and the rules we do not break are carried forward unaltered.

**Why rule 6 changed.** The old wording described a system that receives identity photographs and deletes them. **We never receive them** — verification happens at the vendor or on a live call, and Adulis stores an attestation. ADU-PRD-01 §13.1 has always said so, and the public website is required to state *"Adulis never stores identity photographs"* in fixed wording. This page said something weaker, and this page is what gets read aloud.

---

## THE CORE RULE

> **Adulis is the dedicated commerce layer for sellers whose audience lives on social media — and, from year 3, for sellers building an audience here instead. It sells software to sellers on subscription. It holds no buyer money until it holds a licence to do so.**

**Discovery on social → buyer taps the bio link → web storefront proves the value → buyer installs the app → reserves → seller fulfils → QR handoff scan → review publishes**

**The bio link is the only outbound link.** Neither TikTok nor Instagram permits a per-post outbound link, so a seller cannot link to an individual product from a post. One Adulis profile link sits in the bio; everything else is navigation inside the product. Any material that implies otherwise is wrong.

---

## THE FOUR PROBLEMS WE SOLVE

| Problem | Current reality | Adulis response |
|---|---|---|
| **Products get buried** | A buyer who saw a product last week must scroll past unrelated content to find it | Ordered dedicated storefront; each product carries the post that created the desire |
| **Customer service collapses at volume** | DMs go unanswered, information is stale, quality depends on who is replying | Per-seller chatbot answering 24/7 at consistent quality, with last-confirmed stock timestamps |
| **Scammers buy followers to look legitimate** | Followers are purchasable; buyers cannot tell | Account-control verification, government ID, and a trust level earned through evidenced handoffs |
| **No accountability for catfishing or poor quality** | Reputation lives in comments and DMs | Reviews evidenced by a scanned handoff, plus published reliability statistics |

---

## HOW PEOPLE REACH ADULIS

| Surface | Who | What it is for |
|---|---|---|
| **Public web** | Anyone, anonymous | Marketing pages and seller storefronts. Browse, prove value, drive an install |
| **Mobile app** | Buyers **and sellers** | One account, two modes. **Buyer Mode** is the full buyer experience; the **Seller Companion** is monitor, communicate, respond, understand |
| **Seller PWA** | Sellers | The full management system — catalogue, inventory, store setup, staff, verification, subscription, advanced analytics |

**One account holds both roles.** A seller browses, reserves and buys from other Adulis sellers in the same app, and switching modes never requires signing out. A seller acting as a buyer creates a **buyer** transaction.

**The Companion makes sellers fast. The PWA makes sellers capable.** The Companion is deliberately smaller and never becomes a second seller application.

---

## WHO MAY OPEN A SELLER ACCOUNT

**Phase 1 — audience required.** Any seller type — creator, business or shop — with a TikTok or Instagram account they can prove they control. Account-control verification captures the follower count at the moment of verification.

**The minimum follower count is not set, and none is enforced during the controlled beta.** Every applicant is accepted onto the waitlist and reviewed by hand. What audience size actually predicts a seller who succeeds is one of the questions the beta exists to answer, and no amount of reasoning answers it.

Any threshold set afterwards is **per-market configuration** — published, never secret, and never applied retroactively to a seller already verified. Where a threshold exists, it is measured against the **highest single connected account, never the sum**: a seller with 3,000 on each platform is very likely the same audience counted twice.

**Phase 2 — open to anyone.** No social account required. Trust is earned on the platform instead of imported into it.

**Three conditions must be met before the gate drops. It is not a date.**

1. **V3 marketplace discovery must be live.** A seller with no audience has no buyers unless Adulis supplies them.
2. **Government ID verification becomes mandatory** for any seller without a verified audience. It is the only remaining identity anchor.
3. **The trust ladder must be operating**, so that a brand-new seller is visibly new and constrained.

**Phase 1 and Phase 2 are per-market states, not global ones.**

---

## THE TRUST LADDER

Trust is earned through **completed, scanned handoffs** — evidence Adulis already collects.

| Level | Earned by | Unlocks |
|---|---|---|
| **New** | **Eligibility satisfied** | Limited published products; "new seller" badge; no boosted placement |
| **Established** | A sustained run of scanned handoffs with good ratings | Full catalogue; standard placement |
| **Trusted** | Sustained volume, high scan completion, low claims | Priority placement; broadcast eligibility |

Levels can fall as well as rise. Thresholds are per-market configuration, published, and never secret.

**A seller with a large following and no sales starts at New, exactly like everyone else.** An audience was only ever a proxy for trust. Once real evidence exists, the proxy retires.

> **New is entered on eligibility, not on ID verification.** In Phase 1 most sellers qualify by audience and hold no ID attestation. Tying New to ID would leave a whole cohort with no level, and the ladder must accumulate from the first handoff or it means nothing on the day it starts mattering.

---

## WHO PAYS, AND FOR WHAT

**The seller pays a monthly subscription.**

| Tier | Price | What it includes |
|---|---|---|
| **Free — Listed** | $0 | Storefront, 10 products, verification badge, reservations, reviews, buyer chat. No chatbot. |
| **Assisted** | $10/mo | Unlimited products, chatbot on top 10, low-stock alerts, basic analytics |
| **Verified Pro** | $25/mo | Blue tick, chatbot on all products, follower broadcasts, full analytics |
| **Business** | $50/mo | Multi-user logins, custom chatbot flows, exports, campaigns, API |

USD is the currency of record. Local prices are derived, re-published every two months, and locked for the duration of a paid term. Payment is manual bank transfer prompted by SMS. Prepay: **5% for three months, 10% annually.** Expansion markets carry regional pricing.

**Controlled-beta sellers sit outside this table.** They pay nothing and they are not on the Free tier. Their entitlements are set in ADU-PRD-01 §16.10 and include a first version of the chatbot.

**Every new seller receives 60 days free from their own signup date.** The blue tick is excluded — except where ID verification is mandatory, in which case it is a condition of selling rather than a paid feature.

**The free tier has no reservation cap.**

**Brands pay to send a proposal.** A creator sets a submission fee of $5–$100. Adulis charges **20% of that fee**; the brand pays the creator's 80% directly. A filter, not a growth engine.

**Buyers pay nothing, ever.**

> ⚠ **Business tier is post-MVP.** Team accounts, RBAC, custom flows, bulk operations, the API and data export arrive with the seller console's later phases. The tier is not sold before it can be delivered.

---

## WHO DOES WHAT

**BUYER** — discovers on social or, from V3, on Adulis; browses on web; installs the app; reserves; pays the seller directly; scans at handoff; reviews honestly.

**SELLER** — owns product, price, stock accuracy, legality, quality, fulfilment, delivery and all refunds. **Maintains stock in Adulis as their system of record.** **Confirms that payment was actually received**, by checking their own bank account.

**COURIER** — a person the seller adds and trusts. Scans at handoff. The seller's agent, not Adulis's.

**ADULIS** — verification, storefront, chatbot, reservations, handoff evidence, trust levels, reliability scoring, reviews, analytics, broadcasts, proposal filtering, moderation and claim workflow. **From V3, discovery.**

---

## THE RULES WE DO NOT BREAK

**1. Adulis holds no buyer money before the licence.** No escrow, no wallet, no custody. This keeps us outside the payment-licensing perimeter, where an instrument issuer needs 100 million ETB in a blocked account.

**2. On Deals, we collect only our 20%.** The brand pays the creator's 80% directly.

**3. We charge only for observable events.** Published statistical rates do the enforcement, not adjudication.

**4. We never call anyone a scammer.** We publish facts we can prove from our own logs.

**5. A seller can never suppress a review.** Scanning earns a stronger badge; refusing to scan does not silence the buyer.

**6. We never receive the evidence.** Identity verification happens at the vendor or on a live call. Adulis retains the date, the verifier, the ID type, the legal name, a keyed hash of the ID number, a verified boolean, and for company sellers the representative's stated relationship. **No identity image is ever uploaded to Adulis systems** — there is no place to put one.

**7. We are asset-light by default.**

**8. We enter a new market only when the last one is profitable.**

**9. A seller's level is earned, never bought.** No tier, no payment and no advertising spend moves a seller up the ladder. The moment trust is purchasable, it is worthless.

**10. Core commerce is never paywalled.** A free seller can receive a reservation, take payment, confirm it, hand off and be reviewed. Sellers pay for automation, intelligence, scale and advanced capability — never for the basic ability to complete a transaction.

**11. Adulis never asserts that a payment is genuine.** The seller checks their own bank account and confirms. A screenshot is evidence the buyer submitted, not proof the money arrived.

---

## PROHIBITED PRODUCTS

Illegal, stolen, counterfeit, fraudulent or exploitative goods; firearms, ammunition, explosives and prohibited weapons; illegal drugs and unauthorised controlled substances; sexual exploitation material; prohibited hazardous goods; IP-infringing products; and anything barred by local law, an applicable foreign jurisdiction, a payment or logistics partner, or Adulis policy.

---

## VERSION SEQUENCE

**V1** Core social commerce — subscriptions · **V2** Deals — proposal filtering · **V3** Marketplace discovery **← the gate cannot drop before this ships** · **→ payment licence or licensed partner** · **V4** Advertising · **V5** Crowd Commerce and Group Buying · **V6** Delivery service

---

## GEOGRAPHIC SEQUENCE

**Phase 1:** Ethiopia only. Prove retention, chatbot containment, handoff adoption and willingness to pay.

**Phase 2 onward:** sequential entry into countries sharing Ethiopia's constraints — many social sellers, low card penetration, a usable local payment rail, no entrenched competitor, legal ability to operate, demonstrated ability to repatriate revenue.

**Maximum two new markets per year.** The binding constraint is execution capacity.

---

## FOUNDER COMPENSATION

**Each founder draws a minimum monthly amount, creditable against a share of monthly profit.** The founder pool is **4% of monthly profit** — **CEO 1.5%, COO 1.25%, CMO 1.25%**. Where the profit share exceeds the draw, the founder receives the difference; where it falls short, the founder keeps the draw. Reviewed annually.

The draw exists because profit-share-only compensation pays the founders close to nothing in the first two years, and because a pure profit share makes every growth investment feel like a personal pay cut in the month it is made.

**The split, the draw, and the accounting treatment must be recorded in the shareholders' agreement and confirmed with an accountant before signature.**

---

## LAUNCH SCOPE

**Market:** Ethiopia. **Segment:** any social seller with a verified account, with no follower minimum during the controlled beta. **Categories:** fashion and clothing, cosmetics, electronics. **Languages:** English throughout; Amharic templated output at launch.

**Build:** back-end by the CEO, front-end by the COO/CTO. The front-end owns four surfaces — buyer mode, Seller Companion, seller PWA and the public site — which is the binding constraint on delivery sequencing.

---

## FOUNDER RULE

Every decision should remain consistent with these principles unless the founders formally change the model and reissue this page.

*This is a founder working definition. It is not legal, tax, accounting, payment or data-protection advice. The professional review gates listed in ADU-PROJ-01 must be completed before the affected capability is enabled.*
