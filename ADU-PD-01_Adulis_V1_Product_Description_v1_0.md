# ADU-PD-01 — Adulis V1 Product Description

**Version:** 1.0 · **Baseline date:** 24 August 2026
**Owner:** Founder / CEO
**Status:** Descriptive. **This document explains; it does not bind.** Where it and ADU-PRD-01 disagree on product behaviour, the PRD governs.
**Related:** ADU-00 v9.1 · ADU-ARCH-01 v2.0 · ADU-PRD-01 v8.5 · ADU-XREF-01 v1.5 · ADU-DB-01 v1.6 · ADU-API-01 v1.3 · ADU-AUTH-01 v2.0 · ADU-SEC-01 v1.0 · ADU-DPIA-01 v1.0

> **Read this first if you are new.** ADU-00 is the business model on one page. ADU-PRD-01 is fifteen thousand words of binding rules. **Nothing between them described the product as a thing a person uses**, and that is what this is.

> ⚠ **ADU-PRD-01 has not yet caught up.** V1 as described here reflects rulings taken after v8.5 was issued — the seller surface architecture, the payment confirmation window, availability, the dispute ladder, and Business tier moving post-MVP. The PRD revision to v8.6 is pending; the differences are itemised in ADU-XREF-01 §4 and ADU-ARCH-01 §9.

---

## 1. What Adulis is

**Adulis is the commerce layer for sellers whose customers already follow them on social media.**

An Ethiopian seller with twelve thousand followers on TikTok runs their entire business through direct messages. Their products are buried under unrelated posts. The same six questions arrive every day. Stock information is whatever they last remembered to say. A buyer who wants to know whether the blue one is still available waits four hours for an answer.

Adulis gives that seller an ordered storefront at one link, a chatbot that answers the repetitive questions from structured data, a reservation system that holds stock for two days, and a reputation built from evidence that goods actually changed hands.

**It sells software to sellers on subscription. It takes no commission and never touches buyer money.**

---

## 2. What it is not

Stating this early because each is a deliberate exclusion rather than a gap:

- **Not a marketplace.** V1 has no cross-seller search, no browse-by-category across the platform, no discovery. A buyer arrives because a seller sent them. Marketplace discovery is V3, and it is the precondition for opening to sellers with no audience.
- **Not a payment processor.** The buyer transfers money to the seller's bank account directly. Adulis relays evidence and records what both parties did.
- **Not an escrow.** Adulis holds no funds at any point, which is what keeps it outside Ethiopia's payment-licensing perimeter.
- **Not a delivery service.** A seller may add a courier they trust; that is handoff evidence, not logistics.
- **Not a social network.** Following exists so a seller can reach buyers again. There is no feed algorithm, no recommendations, and nowhere to store a ranking score.

---

## 3. Who it is for

**At launch: Ethiopian sellers on TikTok or Instagram who can prove they control the account**, in fashion and clothing, cosmetics, or electronics.

Creators, small businesses and shops are all eligible and all treated identically. **There is no follower minimum.** A threshold existed in earlier revisions and was retired for a reason worth repeating: five thousand was never measured, and guessing wrong is expensive in both directions. The controlled beta exists partly to find the real number, and it cannot find it while enforcing a guess.

**Buyers are anyone** who follows those sellers. They pay nothing, ever.

---

## 4. Three surfaces

| | Who | What it is for |
|---|---|---|
| **Public web** | Anyone, anonymous | Marketing pages and seller storefronts. Prove the value, drive an install |
| **Mobile app** — iOS and Android | Buyers **and sellers** | One account, two modes |
| **Seller console** — PWA | Sellers | The full management system |

**One account holds every role.** A seller browses and buys from other Adulis sellers in the same app. Switching between Buyer Mode and the Seller Companion never requires signing out, because roles are relationships on an account rather than separate accounts. A seller acting as a buyer creates a *buyer* transaction.

**The Companion and the console divide by verb.**

> **The Companion makes sellers fast.** Monitor — what is happening? Communicate — who needs me? Respond — what needs a decision now? Understand — how am I doing?
>
> **The console makes sellers capable.** Create — what am I selling? Configure — how does my business operate? Manage — catalogue, inventory, workflows. Administer — staff, account, verification, subscription, security.

The Companion is deliberately smaller and must not become a second seller application. At V1 it carries four surfaces: notifications, order detail with payment confirmation, the buyer inbox, and the mode switch. Overview and analytics arrive once beta data shows sellers reach for them on a phone.

**Sellers have no separate app to install.** There is one Adulis app, and it is the same one their buyers use.

---

## 5. The buyer's journey

**Discovery happens on social media, not on Adulis.**

A seller posts a video. The only link they control is the one in their bio — **neither TikTok nor Instagram permits an outbound link on an individual post**, so there is no way to link to a specific product, and no Adulis material may imply otherwise. That single bio link resolves to the seller's storefront.

**The storefront is a web page, and it answers everything.**

It loads without an app, without an account, and without JavaScript being necessary to read it. It shows the seller's products in the order the seller chose, each with the social post that created the desire, the current stock, and the moment that stock was last confirmed. It shows the seller's trust level and how many completed handoffs they have.

The storefront's job is to answer, as page content, every question the chatbot would answer — because a buyer on a slow connection who has to install an app to find out whether something is in stock does not install the app.

**Reserving requires the app.**

Tapping Reserve prompts an install. The buyer's identity is created at that moment — a phone number and a one-time code, nothing else. No password, no email, no social login.

**The reservation holds stock for 48 hours.** Creating an order decrements stock immediately; a cart holds nothing. Nothing waits on the seller — **there is no acceptance step**, and a buyer may reserve at any hour of any day.

**Payment is a bank transfer to the seller.**

The app shows the seller's bank details, captured onto the order at the moment it was created — so a later change to the seller's account cannot reroute a payment already in flight. The buyer transfers the money and uploads a screenshot.

**Two notifications stand between a reservation and silent expiry**: the morning after, and two hours before the deadline. Both name the seller and state the deadline as a time rather than a countdown, because "expires in four hours" is stale the moment it is read from a notification tray. A buyer who denied notification permission gets the same information as a badge and countdown on the order card, which is not a fallback but a requirement.

**Handoff is a scan, and the buyer performs it.**

At the doorway the seller or their courier displays a QR code and **the buyer scans it**. The buyer is the party asserting receipt; a courier can never scan on their behalf, on any client, under any circumstance. The scan works offline and syncs later — the timestamp signed on the buyer's device governs whether the order completes.

**Then a review, and it always publishes.**

---

## 6. The seller's journey

**Signing up proves you control the account you claim.**

A one-time code is posted to the linked TikTok or Instagram account; Adulis fetches and matches it, and captures the follower count at that moment. **From open release, a government-ID check follows** — as an identity control, not a badge, and not a paid feature.

**Nothing is public until the store is ready**, and the seller can see exactly what is missing at any time: eligibility, store profile, payout details, at least one product. Onboarding is a multi-step process a person leaves and returns to across days, on a phone, between other work — so the readiness list is persistent and returnable, never a wizard that must be completed in one pass.

**The catalogue is built in the console.** Products carry structured attributes — size, colour, capacity — and those attributes are what make the chatbot free: a question answered from a field costs nothing.

Up to five images per product, resized on receipt with the original discarded. Video is a click-to-load social embed by default, with a poster frame Adulis stores itself, and the product page works fully without it. A seller may add one short clip, compressed on their own device before upload.

**Stock is the seller's system of record, and its freshness is published.**

Confidence degrades when stock is not confirmed. At first the seller is nudged; then the product page shows a staleness notice; then the badge degrades; eventually broadcasts are blocked. **Every stock claim carries the moment it was last confirmed**, so a buyer is never told "in stock" without being told when that was true.

**Confirming payment is the seller's only gate on an order.**

The buyer's screenshot arrives as a notification. The seller opens their own bank app, checks the money actually landed, and confirms. **The action is labelled "Confirm Payment Received", never "Accept Payment"**, and carries a warning to verify in their own account first — because Adulis does not verify a bank transaction by looking at a picture of one, and the label must not suggest it does.

**Availability describes the store, not the system.** A seller declares when they are usually reachable — an hour a day or a full day, several windows or none at all. The app runs continuously regardless. A creator with no shopfront is not required to pretend they have one.

---

## 7. The trust architecture

**This is what Adulis actually sells, and it is the part worth understanding properly.**

Followers are purchasable. A buyer looking at an account with forty thousand followers cannot tell whether the seller has ever shipped anything. Adulis replaces that proxy with evidence it collects itself.

**Three levels, earned through completed scanned handoffs:**

| | Earned by | Unlocks |
|---|---|---|
| **New** | Eligibility satisfied | Limited products, a "new seller" badge, a transaction value cap |
| **Established** | A sustained run of scanned handoffs with good ratings | Full catalogue for the tier, cap lifted |
| **Trusted** | Sustained volume, high scan completion, low claims | Priority placement, broadcast eligibility |

**Levels fall as well as rise.** An upheld claim always demotes, regardless of volume.

**A level is never purchasable.** No tier, no payment and no advertising spend moves a seller up. This is enforced structurally rather than by policy: the function that computes a level reads handoffs, reviews, claims and configuration, and **references no billing table at all** — there is no join path from a subscription to a level, so no amount of generated code can create one.

**A seller with eighty thousand followers and no sales starts at New, exactly like everyone else.**

**What Adulis publishes about a seller is counted facts and nothing else**: trust level, completed handoffs, cancellation rate, confirmation rate, scan completion rate, unresolved claims, stock confidence. Never a characterisation. The published statistics table has no free-text column — a statistic that cannot hold a sentence cannot hold an accusation.

**Faking it is expensive by design.** A scanned handoff counts toward a level only when the scanning buyer is a distinct account with its own verified phone, and has not transacted with that seller more than a configured number of times in the window. Level rises that look unusual raise a review flag.

---

## 8. Payment, and what Adulis does not do

**Adulis holds no money at any point.** No escrow, no wallet, no custody, no remittance. This is the most valuable structural feature of the business: an instrument issuer in Ethiopia needs 100 million birr in a blocked account, and Adulis stays outside that perimeter entirely.

The consequence is honest and must be stated plainly, on the website and everywhere else: **Adulis records what happened and provides the evidence. It does not protect buyers, guarantee purchases, or recover money.** Every synonym for those things is forbidden in the product's own copy.

**The seller's bank details have exactly one path out of the system.** They are stored encrypted in an isolated boundary, masked to four digits everywhere a seller, team member or operator can see, and decrypted only to render payment instructions to the buyer on an order that is payable — a read that writes its own log entry in the same transaction.

**Changing a bank account is the highest-value attack in the system**, so it costs: a fresh one-time code, a 24-hour activation delay during which the previous details remain in effect, an unsuppressible notification to the seller and every administrator, and an immutable record. Cancelling a pending change requires nothing, because reverting must always be easier than changing.

---

## 9. When payment goes wrong

**A submitted payment opens a 24-hour window for the seller to check and confirm.** After one hour without a response the buyer may raise a claim; the order itself survives until the window closes.

**If the seller says the payment did not arrive, the buyer gets one more attempt in a twelve-hour window.** A second rejection ends the order and the buyer starts again. That cap exists because submitting evidence is free and holds stock — without it, one person could freeze a seller's entire catalogue with photographs of a wall.

**If the seller is wrong or dishonest, there is a ladder:**

The buyer files a claim and provides proof they sent the money — **a single transaction record, not a bank statement.** A statement reveals a balance, a salary and every other payee; a transaction record proves the same fact.

Adulis reviews it and asks the seller to either refund or deliver the item — **the seller chooses which.** A seller maintaining non-receipt provides their own transaction record. Where both appear truthful, each party raises a trace with their own bank and Adulis accepts the written response as evidence; Adulis has no standing to ask a bank about someone else's account and does not pretend to.

**If the seller took the money and refuses to return it**, the buyer receives an evidence export of their own transaction and files a police report. **Adulis discloses the seller's verified legal name and ID type to law enforcement on a documented request — never to the buyer.** The buyer may publish a review of what happened, and an upheld claim carries the strongest badge in the system, because a claim reviewed against both parties' bank records is better evidence than a scan at a doorway.

**The seller's trust level drops to New and a suspension review opens.**

---

## 10. Handoff and evidence

**Reviews always publish.** A seller can never prevent one, delay one, or have one removed. What evidence exists determines the badge, not the right to speak:

| | Badge |
|---|---|
| A claim upheld against the seller | **Strongest** |
| The buyer scanned the QR | Verified handoff |
| The buyer tapped "I received it" | Confirmed by buyer |
| Neither | Unverified |

Only a scanned handoff advances a trust level. A tapped confirmation publishes a review at medium weight and moves nothing — otherwise the ladder would be trivially fakeable.

**Where a courier is involved there are two separate events**, and conflating them would make the ladder fakeable by any seller with one cooperative courier. The seller-to-courier custody transfer is an internal record: it never completes an order, never counts toward a level, and never enables a review. Only the courier-to-buyer scan produces buyer-facing evidence.

**Two ratings, never averaged.** Item quality aggregates to the product; seller quality aggregates to the seller and feeds the ladder. There is nowhere in the system to store a combined score.

---

## 11. The chatbot

**It never writes anything.** This is the design decision most often misunderstood, so it is worth being precise: a language model is used, and only to classify a question into an intent. **Every response the buyer sees is a template filled from structured data.**

Six layers, cheapest first:

| | |
|---|---|
| **0** | The product page already answers it — the question is never asked |
| **1** | A quick-reply chip built from a structured field |
| **2** | Exact or keyword match against the intent library |
| **3** | Embedding similarity |
| **4** | A model, returning an intent identifier and nothing else |
| **5** | Escalate to the seller with full context |

**Only layer 4 costs money**, capped per seller at 15% of what that seller pays. At the cap, layers 0–3 keep working and everything else escalates. **The bot never goes dark.**

Output is English and Amharic, fully templated. Amharic free-text *understanding* is deferred — chips carry the load, which is a deliberate choice rather than a shortcut, because a bot that misunderstands Amharic and answers confidently is worse than one that offers buttons.

**Every escalation teaches it.** Unmatched text is logged, stripped of identifiers, and becomes example phrases — roughly two hundred a month, and up to three new intents. A frozen set of several hundred hand-labelled real messages runs before and after every change, and a drop in precision reverts it.

**Human chat is free on every tier.** The AI cascade is what is metered. Those two must never be conflated in either direction.

---

## 12. What V1 does not include

| Not in V1 | Where it goes |
|---|---|
| Marketplace discovery, cross-seller search | V3 — and the precondition for opening to sellers with no audience |
| Advertising | V4 |
| Crowd Commerce, group buying | V5, gated on a licence |
| Adulis delivery | V6 |
| Escrow, wallets, custody | After a licence or a licensed partner |
| **Team accounts, roles, bulk operations, data export, public API** | Business tier, post-MVP |
| **The blue tick** | Post-MVP |
| Brand proposals and the deals fee | V2 |
| Amharic free-text understanding | Measured first |

**Business tier is not sold at V1.** It was listed at fifty dollars with capabilities the product could not yet deliver — a tier that lists a capability it cannot deliver is a churn mechanism arriving at the top of the price list.

---

## 13. The commercial position at V1

**Controlled-beta sellers are their own tier.** They pay nothing and they are not on the free tier — the distinction matters because beta behaviour is the evidence for every launch decision, and it is worthless if it cannot be separated from sellers who chose free on the merits.

Beta sellers get **the chatbot on every product**, unlimited products, free account-control verification, and basic analytics. No blue tick, no broadcasts, no team accounts.

**The chatbot is included during the beta even though it is paid afterwards**, because the intent library cannot improve without real buyer questions asked of real sellers. Withholding it would mean the loop starts from nothing on the day it starts mattering commercially. **This is stated to beta sellers in advance** — a seller who discovers at conversion that a feature they relied on now costs money churns, and is right to.

**Every new seller gets sixty days free from their own signup date**, never a calendar cutoff.

**A founding rule, stated because it decides arguments:**

> **Core commerce is never paywalled.** A free seller can receive a reservation, take payment, confirm it, hand off and be reviewed. Sellers pay for automation, intelligence, scale and advanced capability — never for the basic ability to complete a transaction.

---

## 14. What shaped the product

Four constraints did more to determine the design than any feature decision.

**No cloud provider operates in Ethiopia.** Everything must work on a low-end Android over a slow connection. The storefront is server-rendered, targets under forty kilobytes on first response, and never depends on JavaScript to be read.

**Two people build it.** The CEO takes the back-end; the COO/CTO takes the front-end, and owns four surfaces. Almost every architectural choice favours fewer moving parts: one database and no message broker, no Redis, no search cluster, no video transcoding. **Correctness lives in database constraints rather than application code**, because generated code is plausible far more often than it is correct and the failure mode is silent.

**Card penetration is low and bank transfer is normal.** Payment is manual, prompted by SMS, mirroring how Ethiopians already pay utilities. This is not a limitation being worked around; it is the market condition that makes the product necessary.

**Amharic is a layout constraint, not a translation pass.** Ge'ez strings run longer, the character set is large enough that font weight is measurable on a slow connection, and a font family covering only Ethiopic renders every Latin character and every digit as an empty box — including the company name and every published figure. Every screen is validated in Ge'ez with realistic strings before it ships.

---

## 15. Known limits

Stated because a product description that lists only strengths is a brochure.

**Buyers are not protected.** Adulis holds no money, so the best outcome a dispute can produce is a seller who chooses to pay back. The mitigations — mandatory identity, transaction caps at New, prominent disclosure, fast evidence, rapid demotion — reduce the risk and none of them removes it. **Full resolution waits on a payment licence.**

**A buyer who installs the app with no deep link arrives at a generic home screen.** Recovery is pasting the social post or searching the seller's handle. How many buyers this loses is measured rather than assumed, and if the number is large a deferred deep-link service becomes worth paying for — on that number, not on principle.

**Phone-number authentication is vulnerable to SIM swap.** Push notification to existing devices and a payout lock on new-device sign-in bound it; hardware-bound credentials would close it and are premature for this device base.

**The buyer's name, phone and delivery details reach an independent seller**, and Adulis cannot technically control what happens next. That is inherent to a marketplace where the seller ships the goods. It is managed by contract, disclosure and takedown — never eliminated.

**Hand review does not scale.** Every waitlist application is read by a founder. That is adequate at twenty or thirty sellers and it is not adequate at three hundred, and the beta must produce either a threshold or a substitute control before intake grows.

---

## 16. V1 in one page

**Adulis V1 gives an Ethiopian social seller:**

an ordered storefront at one bio link · a chatbot that answers from structured data and never invents · a 48-hour reservation that holds stock · verification that proves they control their audience · payment instructions captured onto each order so they cannot be rerouted · a scan at the doorway that turns a delivery into evidence · a trust level earned from that evidence and purchasable by nobody · reviews they can never suppress · and a phone app that tells them the moment something needs them.

**It gives an Ethiopian buyer:**

a page that loads on a bad connection and tells them what is actually in stock and when that was last true · a seller's real record rather than their follower count · a reservation that holds the item while they get to a bank · an order card that never lies about its own deadline · and a route to a claim with real evidence when it goes wrong.

**And it gives Adulis:**

a subscription business that takes no commission, touches no money, needs no licence to operate, and whose defensible asset is a record of who actually delivers — which is the one thing a competitor cannot buy, copy or fabricate.

---

*Descriptive document. Where this and ADU-PRD-01 disagree on product behaviour, the PRD governs — and ADU-PRD-01 v8.6 is pending. What is described here is V1 as currently ruled.*
