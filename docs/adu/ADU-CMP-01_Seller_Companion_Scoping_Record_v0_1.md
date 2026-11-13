# ADU-CMP-01 -- Seller Companion: Scoping Record and Constraint Register

**Version:** 0.1  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer
**Status:** **Scoping record. NOT a system design, and deliberately not one yet.** It carries what is already binding on the Companion, the analysis that can be done today, and the evidence v1.0 needs. **It decides no screen and no feature.**
**Trigger for v1.0:** the buyer app ships and the controlled beta produces handoff evidence (ADU-ARCH-01 S3.1, ADU-MOB-PLAN-01 S2).
**Drawn from:** ADU-ARCH-01 v2.0 **S1, S3.1, S4, S5, S10**  -  ADU-MOB-01 v1.1 **S17.3**  -  ADU-CON-03 v1.3  -  ADU-MOB-05 v1.0 **S5**  -  ADU-MOB-AMD-01 v1.0 **G3**  -  ADU-AUTH-01 v2.8  -  ADU-API-01 v1.11  -  **Apple App Review Guidelines, retrieved 5 September 2026**
**Encoding:** ASCII.

---

## 0. Why this is v0.1 and not v1.0

**ADU-ARCH-01 S3.1 phases the Companion on beta evidence rather than on assumption, and ADU-MOB-PLAN-01 S2 registers it as deliberately unwritten with that trigger.** Writing the full system design today would mean inventing the evidence it is supposed to be derived from -- which is the failure that register exists to prevent.

**So this document does the half that does not need evidence.** A surprising amount of the Companion is already decided by documents written about something else: the seam is drawn, the permission model closes most of the scope by itself, and **one store guideline constrains the Companion far more tightly than it constrains Buyer Mode** -- which nobody has written down, because ADU-MOB-05 S5.2 explicitly handed the question here.

**What v1.0 adds is in S8. What it needs first is in S7.**

> **[!] The one thing to resist.** The Companion looks easy -- four screens on a phone the seller is already holding. **The IAP position in S4 is the reason it is not**, and it is worth settling before a single screen is drawn, because it decides which capabilities may ever appear in the binary at all.

---

## 1. What is already binding

**Nothing here is re-decided by the ADU-CMP series.** It is carried.

| Rule | Source | Note |
|---|---|---|
| **The Companion monitors and responds; everything else happens in the console** | ADU-ARCH-01 S1 | The console is the full seller management system. **This is a scope rule, not a phasing one** |
| **The Companion ships after the buyer app, on beta evidence** | ADU-ARCH-01 S3.1 | The trigger for v1.0 |
| **iOS carries seller functionality** -- a release-checklist item, not an API control | ADU-API-01 v1.11 S4 | The retired Telegram-era invariant does not apply. ADU-MOB-00 S4.7 |
| **Event A, the seller-to-courier custody transfer, has no offline requirement** | ADU-ARCH-01 S5 | A two-sided confirmation made **before** the courier sets out |
| **Scanning lives in Buyer Mode.** The Companion never scans | ADU-ARCH-01 S5, ADU-DB-01 S14.2 | The composite foreign key to `("order".id, buyer_account_id)` makes a Companion-side scan **structurally impossible**, not merely forbidden |
| **The QR is fetched by the seller and displayed at the doorway** | ADU-API-01, the `qr` endpoint | *"Cached by the app for offline display."* **The Companion's one genuinely offline behaviour, and it is display, not capture** |
| **Mode switching never re-authenticates.** One session reaches both surfaces | ADU-AUTH-01 S3 | Roles are relationships on an account |
| **All eight step-up permissions are `CONSOLE`-only** | ADU-AUTH-01, D-34 | **This closes most of the Companion's scope by itself.** S3 |
| **`revoke-others` is `CONSOLE`-only** | D-34 | No control on either mobile surface |
| **The verbatim labels bind the Companion exactly as they bind the console** | ADU-CON-03 S4.1 | S5.2 |
| **Adulis never asserts that a payment is genuine** | ADU-ARCH-01 S3.3 | No tick, no "verified", no green state against a payment, on any surface |
| **There is no Accept Reservation control anywhere in the product** | ADU-ARCH-01 S3.2 | Not on the console, not here |
| **No mobile path reaches a `SECURITY DEFINER` function the web path does not** | ADU-ARCH-01 S10 | Constrains what the Companion may call |
| **Google Play merchant registration is unavailable in Ethiopia** | ADU-MOB-05 S1.2 | Play billing is not an option for the Companion either, whatever the guidelines allow |

---

## 2. The seam, already drawn

**ADU-MOB-01 S17.3 drew this before either side existed**, on the rule that *"a boundary added after the fact is a refactor and a boundary drawn first is a directory."*

| | Buyer Mode | Seller Companion |
|---|---|---|
| Routes | `app/(tabs)`, `app/s`, `app/cart`, `app/orders`, `app/scan`, `app/claims`, `app/chat?as=buyer` | `app/(seller)/...`, entered **only** through the mode switch |
| Requests | **No `X-Adulis-Seller` header, ever** | `X-Adulis-Seller` on every `/v1/seller/*` call |
| Scope | `?as=buyer` | `?as=seller&seller_id=` |
| Shared | The API client, the session, the device row, the locale catalogue, the primitives | Same |
| Not shared | **Nothing in `src/features/*` is imported across the seam** | Nothing |

> **INVARIANT, carried unchanged -- no Buyer Mode module sends `X-Adulis-Seller`, and no Buyer Mode request carries `as=seller`.** Enforced by a dependency-cruiser rule and grep gate 6, **which is already in CI from WO-0** and guards a directory that does not exist yet.
>
> **The failure it prevents is ADU-AUTH-01 S8.3's two-tab bug arriving on a phone, where it is worse**: one screen, one session, and a seller confirming a payment on the wrong store.

**What this means for v1.0:** the Companion is **not a second app and not a second binary.** It ships into the same install, behind a mode switch, reusing the session and the device row. **Everything in ADU-MOB-01, ADU-MOB-03, ADU-MOB-05, ADU-MOB-06 and ADU-MOB-07 applies to it unchanged** -- the tokens, the components, the threat model, the release procedure, the store account. **ADU-CMP-01 v1.0 is a content architecture and a permission map, not a system design of comparable size to ADU-MOB-01.**

---

## 3. The permission model draws most of the scope by itself

**Eight step-up permissions are `CONSOLE`-only.** That is not a phasing decision that can be revisited in v1.0 -- **a `MOBILE` session cannot obtain them**, so the corresponding capabilities cannot appear in the Companion at all without a change to ADU-AUTH-01.

**What that removes, before anyone designs anything:**

| Console screen | Why it cannot be in the Companion |
|---|---|
| **SC-24 Payout** | Step-up, `CONSOLE`-only. **The highest-value target in the system** and it stays on one surface |
| **SC-25 Team**, and ownership transfer | Step-up |
| **SC-26 Subscription** | Step-up **and** S4's problem, twice over |
| **SC-29 Closure and deletion** | Step-up |
| **SC-27's `revoke-others`** | D-34 |
| **SC-22 Identity and verification** | Step-up |

**What remains is exactly what ADU-ARCH-01 S1 already said the Companion is: monitor and respond.** The permission model and the architecture agree, which is worth noticing rather than assuming -- **it means the scope is enforced by the server, not only by a document.**

---

## 4. The In-App Purchase problem, which belongs to the Companion and not to Buyer Mode

**ADU-MOB-05 S5 settled Buyer Mode's position and explicitly deferred this one.** It is the single most important open question about the Companion and it can be answered today.

### 4.1 Why Buyer Mode is safe and the Companion is not

**Buyer Mode sells nothing.** Guideline **3.1.3(e)**: *"If your app enables people to purchase physical goods or services that will be consumed outside of the app, you must use purchase methods other than in-app purchase to collect those payments."* Buyers buy physical goods, handed over in person. **In-app purchase is not merely unnecessary there -- it is forbidden.**

**The Companion is different, and the difference is the customer.** In the Companion, **the seller is Adulis's customer, and what Adulis sells them is a digital subscription.** That is squarely inside the in-app-purchase rules rather than outside them.

### 4.2 The clause that decides it

> **Guideline 3.1.3(b), Multiplatform Services** *(retrieved 5 September 2026)*: *"Apps that operate across multiple platforms may allow users to access content, subscriptions, or features they have acquired in your app on other platforms or your web site, including consumable items in multi-platform games, **provided those items are also available as in-app purchases within the app**."*

**Read the conditional.** A seller subscribes on the web console. If the Companion then lets them **access a feature they acquired by that subscription**, the clause's permission is conditioned on that feature also being purchasable in the app.

**And Buyer Mode's escape does not apply here**: guideline **3.1.1(a)**'s relaxation on external links and calls to action is **United States storefront only**, and Adulis ships in Ethiopia (ADU-MOB-05 S5.2).

**Nor is Play an alternative.** Merchant registration is unavailable in Ethiopia, so Play billing cannot be set up from here at all (ADU-MOB-05 S1.2).

### 4.3 The position this document proposes

> **PROPOSED RULING C1 -- the Seller Companion contains no tier-gated capability. Every capability in it is available to every seller, regardless of subscription state.**
>
> **This is not a restriction on what the Companion does. It is a rule about which capabilities are eligible to be in it.**
>
> **The reasoning:** if no capability in the Companion is acquired by subscription, then no capability in it is being *accessed* under 3.1.3(b), and the conditional never fires. The Companion becomes, for guideline purposes, what Buyer Mode already is -- **an app that sells nothing and gates nothing.**
>
> **The alternative is to offer the subscription as an in-app purchase**, which means Apple's commission on Adulis's only revenue line, on a business whose margins are ADU-00's. **That is not a trade this document will make, and Play could not carry the other half of it anyway.**
>
> **The consequence, stated as a scope rule:** a capability that is entitlement-gated in the console **is not a Companion candidate**, however useful it would be on a phone. Chatbot configuration, analytics beyond the free set, broadcasts, bulk operations, team -- all out, not because they are hard but because they are paid.

### 4.4 The finding that makes C1 cheap

**The four surfaces ADU-CON-03 already marks "Companion parity" are all free-tier capabilities.**

| Surface | Entitlement |
|---|---|
| **SC-03 Orders** | Every tier |
| **SC-04 Order detail**, including the payment decisions and the handoff region | Every tier |
| **SC-20 / SC-21 Inbox and conversation** | **Human messaging is free on every tier** |
| **SC-30 Notification centre** | Every tier |

> **The guideline and the product scope already agree, and the agreement is a coincidence until it is written down.** C1 turns it into an invariant, and the cost of adopting it today is **zero**, because nothing anyone wants in the Companion is currently on the wrong side of it.
>
> **The cost of not adopting it is a scope argument in eighteen months**, when a paid capability is the obvious thing to put on a phone and the reason it cannot be there has been forgotten.

### 4.5 What follows for the binary

**Buyer Mode and the Companion are one binary** (S2). **So the IAP rules do not partition by surface** -- ADU-MOB-01 S16's invariant, *no price, tier name, upgrade prompt or billing link anywhere in the bundle*, **already covers the Companion and always did.**

**Two consequences that are easy to get wrong:**

- **A seller in the Companion who reaches a paid capability must not be told the tier that would unlock it.** The error is `TIER_LIMIT_REACHED` rendered from the app's own catalogue, naming the capability and **where it is configured** -- which is the console -- and **never the tier and never a route to change one** (ADU-AUTH-01 S18.1, ADU-API-01 S4.1).
- **"Open the console" is a link to a management surface, not to a purchasing mechanism**, provided the page it lands on is not the pricing page. **That distinction is the whole of the difference**, and it belongs in v1.0 as a copy invariant.

---

## 5. The candidate surfaces

**Four, and they are already marked in ADU-CON-03.** Listed as candidates, not as scope -- **S7's evidence decides which of them a seller actually reaches for on a phone.**

### 5.1 The list

| # | Console origin | What it is on a phone |
|---|---|---|
| **1** | **SC-03 Orders** | The list, filtered to what needs action. **The only surface a seller touches every day** |
| **2** | **SC-04 Order detail** | The two payment decisions, per-line Can't Fulfil, Mark Ready, and **Show QR** |
| **3** | **SC-20 / SC-21 Inbox and conversation** | Buyer questions, time-sensitive, and the reason a phone beats a desk |
| **4** | **SC-30 Notification centre** | Read state syncs with the console -- **the same list, two surfaces** |

### 5.2 Five rules that come with them, unchanged

**These are ADU-CON-03's and they bind here identically. They are listed because a phone is where they are most likely to be softened for space.**

1. **The payment decisions are equally weighted.** Neither is the safe default, and **the instruction sits adjacent and always visible**: *"Verify the payment in your own bank or payment account before confirming."* **Not behind a disclosure. Not in a tooltip.** On a small screen the temptation to collapse it is strongest, and it is the sentence that carries the whole product's honesty about money.
2. **Confirming without opening the evidence is a normal path.** The seller's bank app is the real check. **The UI must not nag, block, or mark evidence as unread-and-required.**
3. **The whole handoff region requires `PAYMENT_CONFIRMED`** -- all three controls, not only Mark Ready (R20). **Render it disabled with one line, never hide it**: a region that disappears makes a seller wonder what they broke.
4. **The clock changes meaning with state, and at `PAYMENT_CONFIRMED` there is no clock at all.**
5. **The verbatim labels are invariants**: *Confirm Payment Received*, *Payment Not Received*, *Can't Fulfil*, *Mark Ready*. **Never "Accept", never "Approve", and there is no Accept Reservation control.**

---

## 6. The QR at the doorway -- ADU-MOB-AMD-01 G3

**The one open question the offline withdrawal left pointing at this document.**

**Buyer Mode is online-only** (B25): the scan is a foreground request with in-session retry, and if it fails the buyer completes by tapping. **The seller's half is asymmetric**, and the asymmetry is real rather than an oversight:

| | Buyer | Seller |
|---|---|---|
| What happens at the doorway | **Captures** evidence and sends it | **Displays** a code fetched earlier |
| If the network is down | The scan fails visibly; the tap is the fallback | **The QR may already be in hand** |

**`GET /v1/seller/orders/{id}/qr` is documented as cached by the app for offline display.** That is display of a server-minted token, not capture, and **it survives the withdrawal untouched** -- ADU-MOB-00 v1.1 S4.4 states the corrected form: *offline capture and sync are nobody's; offline display of the QR is the Companion's.*

**What v1.0 must decide, and cannot decide today:**

| # | Question | Why it needs evidence |
|---|---|---|
| **G3.1** | **When is the QR fetched?** On opening the order, on Mark Ready, or on a deliberate "prepare for handoff" action | It depends on how far ahead of the doorway a seller opens the order, which the beta measures |
| **G3.2** | **How long may a cached QR be displayed before it is refetched?** | It interacts with the server's late-arrival tolerance (B24) and with the nonce's single use |
| **G3.3** | **What does the seller see when the fetch fails and nothing is cached?** | **The symmetric case to B25**, and the honest answer may be *"ask the buyer to tap I received it"* -- which is a worse record for the seller and should be stated plainly rather than hidden |
| **G3.4** | **Does the cached QR persist across a process kill?** | It is the one place the Companion would write something to disk, and **ADU-MOB-01 S9.2's disk table currently forbids it** |

> **G3.4 is the one that touches an invariant.** *"No `/v1/*` response body on disk"* is a Buyer Mode invariant enforced by grep gate 5 **across the whole app**. A cached QR is a `/v1/*` response body. **Either the gate gains a narrow, named exception with its reasoning, or the QR is memory-only and G3.3 becomes the common case.**
>
> **That is a decision with a CI consequence, and it is exactly the kind of thing that gets made by accident in a pull request.** It is recorded here so it is made deliberately.

---

## 7. What v1.0 needs, and what evidence answers it

**Six questions. Each names the observation that answers it, and every one is available from the controlled beta at no extra cost** -- these are counters the buyer app already collects or things a founder sees by watching.

| # | Question | The evidence |
|---|---|---|
| **E1** | **Do sellers reach for a phone for orders, or do they wait for the desk?** | Console session times of day and device class, against the hours orders actually arrive |
| **E2** | **How long before the doorway does a seller open the order?** | Time from `Mark Ready` to the buyer's scan. **Answers G3.1 and G3.2 directly** |
| **E3** | **How often does the seller's QR fetch fail at the doorway?** | The gap between orders marked ready and handoffs completed by scan, split by time of day. **The tap ratio is the same number from the other side** |
| **E4** | **Which console screen do sellers open most on a small viewport?** | ADU-CON-03's screens are already responsive; the console tells us this **without the Companion existing** |
| **E5** | **Does the payment-confirmation window get missed more by sellers without a phone surface?** | `SYSTEM` claims from the confirmation-window lapse, against seller device class |
| **E6** | **Is the two-sided custody transfer with a courier used at all?** | Event A volume in the beta. **If it is near zero, the courier half of the Companion is not built** |

> **E4 is the cheapest and it can be measured today.** The console is responsive; sellers on phones are already using it. **A Companion justified by a screen nobody opens on a small viewport is a Companion built on an assumption**, and the console has been quietly collecting the answer since it shipped.

---

## 8. What v1.0 will contain

**Written down now so the scope does not expand while nobody is looking.**

| Section | Contents |
|---|---|
| **The permission map** | Every Companion surface against `fn_has_permission(account, seller, permission, MOBILE)`. **Absent permission renders nothing** -- the console's rule, unchanged |
| **The content architecture** | `CM-nn` screens, in ADU-MOB-02's format, for the surfaces E1-E6 justify |
| **The mode switch** | Entry, exit, seller selection where an account holds more than one, and **the guarantee that switching never re-authenticates** |
| **The QR lifecycle** | G3.1 to G3.4, ruled |
| **The IAP position** | C1, ratified or replaced |
| **The store delta** | What changes in ADU-MOB-05 when a seller surface enters the binary. **Screenshots, the age rating's answers, and the review credential now needing a seller account** |
| **The test delta** | What ADU-MOB-06 gains. **The cross-seller isolation cases are the important ones** |

**What v1.0 will not contain:** anything the console does better at a desk, anything entitlement-gated (C1), anything requiring step-up (S3), and a scanner.

---

## 9. Findings

| # | Finding | Kind |
|---|---|---|
| **F1** | **The Companion's IAP exposure is materially worse than Buyer Mode's and no document has stated it.** ADU-ARCH-01 S4 names the risk in general terms; the specific clause is 3.1.3(b), and its conditional is what decides which capabilities may ever be in the binary | **Absence. Architectural** |
| **F2** | **The cached QR is a `/v1/*` response body on disk**, which grep gate 5 forbids across the whole app. **The Companion cannot cache it without either an exception or a ruling** | **Contradiction between a built gate and a documented behaviour** |
| **F3** | **E4 is measurable today and nobody is measuring it.** The console is responsive and sellers are already using it on phones; **the single most useful piece of Companion evidence is being discarded daily** | **Absence** |
| **F4** | **ADU-MOB-05's review kit assumes a buyer account.** When a seller surface enters the binary, **App Review needs a seller account with orders in each state as well** -- and the seeded seller already exists for the buyer's kit, so this is small if it is remembered and a rejection round if it is not | **Absence, downstream** |

**Documents to reissue when v1.0 lands** -- not now:

| Document | Change |
|---|---|
| **ADU-MOB-01 -> v1.3** | S9.2's disk table gains the QR row or explicitly refuses it (**F2**); S18.1's gate 5 gains its exception or does not |
| **ADU-MOB-05 -> v1.2** | The review kit's seller half (**F4**); screenshots; the age-rating delta |
| **ADU-MOB-06 -> v1.1** | Cross-seller isolation cases; the mode-switch threat |
| **ADU-ARCH-01 -> v2.1** | C1 recorded as the Companion's scope rule, with its reasoning |

---

## 10. What to do before v1.0

| # | Action | Cost |
|---|---|---|
| **1** | **Ratify or replace C1** (S4.3). It decides which capabilities are eligible, and **it is free to adopt today and expensive to adopt later** | A ruling |
| **2** | **Start measuring E4** -- console sessions by viewport and screen. **The instrument exists; nobody is reading it** | An afternoon |
| **3** | **Rule F2** -- whether gate 5 gains a named exception for the QR, or the QR is memory-only | A ruling with a CI consequence |
| **4** | **Do nothing else.** The seam is drawn, the permissions close the scope, and everything remaining needs beta evidence | -- |

---

*Scoping record, v0.1. **This is deliberately not a system design**, because ADU-ARCH-01 phases the Companion on beta evidence and ADU-MOB-PLAN-01 registers it as unwritten until that evidence exists -- and writing it now would mean inventing the data it is meant to be derived from. **What can be written today turned out to be more than expected.** The seam was drawn a week ago; the permission model closes most of the scope without anyone deciding anything, because all eight step-up permissions are console-only; and **one guideline clause nobody had read against this surface decides which capabilities may ever appear in the binary at all.** Buyer Mode is safe from in-app purchase because it sells nothing and its goods are physical. **The Companion is not safe by the same argument, because in it the seller is the customer and what Adulis sells them is a subscription** -- and the multiplatform clause that would permit web-acquired access is conditioned on the same thing being purchasable in the app. **The proposed answer costs nothing today**: no capability in the Companion is tier-gated, which is already true of all four candidate surfaces, and turning a coincidence into an invariant is the cheapest architectural decision in this document. **Three things to do, one of them a measurement the console has been discarding since it shipped.***
