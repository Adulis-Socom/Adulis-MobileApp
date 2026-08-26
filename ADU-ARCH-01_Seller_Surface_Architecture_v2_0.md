# ADU-ARCH-01 — Seller Surface Architecture

**Version:** 2.0 · **Baseline date:** 24 August 2026
**Owner:** Founder / CEO
**Status:** Binding architecture record. Supersedes the Telegram design of v1.1 in full.
**Supersedes:** ADU-ARCH-01 v1.1
**Related:** ADU-ARCH-02 v1.1 · ADU-PRD-01 v8.5 · ADU-PROJ-01 v9.0 · ADU-WEB-01 v1.0 · ADU-DB-01 v1.6 · ADU-API-01 v1.3 · ADU-XREF-01 v1.6

---

## 0. What changed in v2.0

v1.1 gave the seller a PWA console and a **Telegram bot** for notifications and quick actions, and made the mobile apps buyer-only. **v2.0 removes Telegram entirely.** The Adulis mobile app gains a **Seller Companion mode**, and native push becomes the seller notification channel.

| | v1.1 | v2.0 |
|---|---|---|
| Seller notifications | Telegram bot | **Native push**, iOS and Android |
| Seller quick actions | Telegram Tier 1 / Tier 2 | **Seller Companion inside the Adulis app** |
| Mobile apps | Buyer-only | **Buyer Mode + Seller Companion**, one app, one account |
| Seller console | PWA — full management | **Unchanged.** PWA remains the full management system |
| Third-party processors | Telegram | **None added** |
| In-App Purchase | Not a constraint — no seller app | **A constraint again.** §4 |

**Telegram is not part of the required architecture.** It may be reconsidered later as an optional integration; nothing in the build depends on it.

**Why the reversal.** Telegram existed to solve one problem: a PWA cannot push reliably on low-end Android or on iOS Safari. A native app with a Seller Companion **removes the problem rather than working around it** — and it removes a data processor, a per-market dependency and a whole action-tier boundary with it. The full assessment is ADU-ARCH-02 v1.1.

---

## 1. The architecture

```text
                           ADULIS
                              │
                         Backend / API
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
     Public web           Seller PWA          Mobile app
   (marketing +         Full seller           One account,
    storefronts)        management            two modes
                                                    │
                                          ┌─────────┴─────────┐
                                          │                   │
                                     Buyer Mode        Seller Companion
                                     Full buyer         Monitor
                                     experience         Communicate
                                                        Respond
                                                        Understand
```

**The boundary, and it decides every "where does this go?" question:**

| Mobile Seller Companion | Seller PWA |
|---|---|
| **Monitor** — what is happening? | **Create** — what am I selling? |
| **Communicate** — who needs me? | **Configure** — how does my business operate? |
| **Respond** — what needs a decision now? | **Manage** — catalogue, inventory, workflows |
| **Understand** — how am I doing? | **Administer** — staff, account, verification, subscription, security |

> **The Companion makes sellers fast. The PWA makes sellers capable.** The Companion is deliberately smaller and must not become a second seller application.

---

## 2. One account, two modes

**No schema change was required for this, and that is the strongest single argument for the design.**

ADU-PRD-01 §6.3 already reads: *"**INVARIANT — one person may hold buyer, seller, team member and courier roles on the same phone number.** Roles are relationships, not accounts."* ADU-DB-01 §6.1 implements it — `core.account` keyed by phone, with `buyer_profile`, `seller`, `seller_team_member` and `seller_courier` all referencing it.

```text
Adulis Account  (one phone number, one OTP)
│
├── Buyer profile
└── Seller profile(s)
```

- **Mode switching is a UI affordance over a relationship that already exists.** No sign-out, no second account, no merge, no migration.
- **A seller acting as a buyer creates a buyer transaction.** Orders reference `buyer_account_id`; nothing consults whether that account also owns a seller. Already true.
- **The active seller context is explicit** where an account owns or staffs more than one store (§4.4).

**INVARIANT — Buyer Mode loses nothing.** The Companion is additive. Every buyer capability in ADU-PRD-01 §2 remains.

---

## 3. What the Companion may do

### 3.1 Phase 1 — four surfaces

Per ADU-ARCH-02 §7, the Companion ships in two phases. **Phase 1 carries the entire reason for the change:**

| Surface | Contents |
|---|---|
| **Notifications** | Native push, deep-linked. Notification centre with categories |
| **Order detail** | Reservation and order information · **payment evidence viewer** · **Confirm Payment Received** · **Payment Not Received** · Can't Fulfil · mark ready · handoff status and QR |
| **Inbox** | Buyer conversations, manual replies, order context |
| **Mode switcher** | Buyer ⇄ Seller |

**Phase 2, built on beta evidence rather than assumption:** Overview dashboard, basic analytics, reviews, notification preferences. All four exist in the PWA. **Measure whether beta sellers reach for them on a phone before building them a second time.**

### 3.2 Reservations are never accepted

**INVARIANT — no seller action gates a reservation.** A buyer reserves whenever they choose; stock is decremented at order creation (§9.1); nothing waits on the seller before the buyer can pay.

The Companion's actions on a new reservation are **view** and **Can't Fulfil**, the latter mapping to §9.1's existing decline path with its existing effect on the published cancellation rate. **There is no "Accept reservation" and it must not be built.**

An **Acknowledge** action — non-blocking, recording that the seller has seen the order and feeding a response-time statistic of the kind §13.2 permits — is optional and not required for Phase 1.

### 3.3 Payment confirmation is the seller's only acceptance

The buyer submits evidence; **the seller checks their own bank account** and confirms or reports a problem (§10.1 step 4).

> **INVARIANT — the action is labelled "Confirm Payment Received", never "Accept Payment"**, and is accompanied by: *"Verify the payment in your own bank or payment account before confirming."*
>
> Adulis does not verify a bank transaction by looking at a screenshot. §10.1 is explicit that *"Adulis never asserts that a payment is genuine"*, and the label must not imply otherwise.

**A consequence for the evidence log.** The seller's primary check is their bank app, so **a payment confirmed without the evidence ever being opened is a normal path.** `financial.access_log` will show fewer reads than confirmations. That is good — a sensitive record read less often is a smaller exposure — but an auditor needs to know it is expected. In a dispute, whether the seller opened the screenshot is itself a fact in the record (X15).

### 3.4 What is never in the Companion

**INVARIANT — no action in ADU-PRD-01 §6.5 is reachable from the mobile app**, on any screen, by any route: payout changes, reissued payment instructions, team changes, subscription purchase, seller deletion, revoking sessions. Plus: identity and verification changes, ownership changes, and account-control phone changes.

**Enforced structurally, not by hiding UI.** ADU-DB-01 v1.6 §6.9 makes surface a property of the permission itself, so `seller.payout:update` has no mobile grant and there is no endpoint that would accept one.

### 3.5 Core commerce is never paywalled

> **Founder doctrine, adopted here and belonging in ADU-PROJ-01 §15:**
>
> **Sellers pay for automation, intelligence, scale and advanced capability — never for the basic ability to complete a transaction.**

The whole loop works on the free tier: buyer discovers → reserves → seller notified → buyer pays seller directly → buyer submits evidence → seller confirms receipt → prepares → marks ready → handoff → review. **No subscription gate sits inside it.**

Consistent with ADU-00's existing free tier, and with §15's rule that human buyer–seller chat is available on all tiers while the **AI cascade** is what is metered. **Free human messaging and paid automation must not be conflated in either direction.**

---

## 4. The hard constraint — the Companion is silent about subscriptions

**ADU-PRD-01 §3 carries the reason:** *"**INVARIANT — subscription purchase never happens inside either app.** No prices, no purchase flow, no link to purchase. This is what keeps the apps outside Apple's In-App Purchase and Google Play Billing requirements, both of which would take 15–30% in card rails incompatible with manual ETB bank transfer."*

v1.1 made this moot by having no seller app. **v2.0 reinstates it in full force.**

> **INVARIANT — the mobile app contains no price, no tier name, no "upgrade", no "manage subscription", and no link, button, banner or deep link to any billing surface.**
>
> Everything in the Companion is free to every seller. Where a screen meets a tier limit it names the capability and where it is configured — *"Custom flows are configured in the Seller Console"* — **never a tier, never a route to change one.**

**The specific trap.** A "Manage subscription → Open Seller Console" control is a call to action directing a customer to an external purchasing mechanism, which is the documented rejection pattern §16.7 already warns about. **It must not exist**, even though every other "Open Seller Console" deep link is fine.

⚠ **App Store rules in this area move, and my knowledge of the current guideline text may be out of date.** The shape of the risk is stable; the permissible wording is not. **Worth a paid review before first submission**, alongside the App Store territory question for Ethiopia already flagged in ADU-PROJ-01 §9.2.

---

## 5. Where the courier lives

**Courier uses the PWA.** Event A — the seller → courier custody transfer — is a two-sided confirmation made before the courier sets out, with no offline requirement.

**The QR is cached by the seller's app**, which is where the doorway problem is actually solved: a native app holds the token offline properly, where v1.1 had to rely on a Telegram-cached image and then withdrew even that when Telegram went seller-only.

Where a courier performs the handoff, the seller passes the QR to their own agent — ADU-00: *"COURIER — a person the seller adds and trusts… The seller's agent, not Adulis's."*

**INVARIANT — a courier can never perform the buyer's scan** (§11.2), unchanged. Scanning lives in Buyer Mode, in the native app, where §23's offline requirement belongs.

---

## 6. Codebases and sessions

### 6.1 Three deployments

| Deployment | Contents |
|---|---|
| **Public web** (Next.js, Cloudflare) | Marketing pages **and storefronts** — X6's ruling stands |
| **Seller PWA** | Authenticated console. Separate app, sharing a package for design tokens, the Amharic catalogue and primitives |
| **Mobile app** (React Native, Expo) | Buyer Mode + Seller Companion |

The public/authenticated split is a security boundary, and the two have different CSP, caching and session handling regardless.

### 6.2 Sessions

**`session_audience` becomes `MOBILE` · `SELLER_WEB` · `COURIER_WEB`.** One mobile session serves both modes, because one account holds both roles.

**§6.4's rule that seller sessions are shorter than buyer sessions is preserved by a different mechanism.** Its reasoning was *"a buyer losing a session loses convenience; a seller losing one loses payout control."* **Payout control is not reachable from mobile at all** (§3.4), so a mobile session carries the buyer lifetime and the shorter lifetime attaches to `SELLER_WEB`, where the dangerous capabilities live.

### 6.3 What replaced "no web sign-in"

ADU-PRD-01 §3.0's *"INVARIANT — there is no web sign-in at MVP"* is gone. Three rules replace it:

1. **INVARIANT — public marketing pages and storefronts remain anonymous.** No account, no cart, no reservation, no chat, no review.
2. **INVARIANT — the buyer never signs in on the web.** Every buyer action is in the app.
3. **The deletion path keeps its narrow OTP ticket.** It issues no session and grants access to nothing else.

---

## 7. CSP is a prerequisite

ADU-WEB-01's `'unsafe-inline'` on `script-src` carries a documented trigger: *"reopen if user-supplied content is ever rendered into a page."*

**That trigger has fired twice** — X6 put storefronts in the public codebase, and the seller PWA is an authenticated surface handling payout details.

> **Nonce-based `script-src`, no `unsafe-inline`, shipped before the console takes its first authenticated session.** A seller product description containing a script tag must not execute in a visitor's browser, and least of all in a browser holding a console session.

---

## 8. Audit and idempotency

**Every state-changing write records `actor_channel`** ∈ `WEB` · `MOBILE` · `SYSTEM`. A seller sees in the console every action taken from a phone, and a claim reviewer sees which surface produced each step.

**Every state-changing action is idempotent.** `core.idempotency_record` and the required `Idempotency-Key` header already cover the double-tap case the Companion makes likely: a seller pressing *Confirm Payment Received* twice on a poor connection produces one event.

**The backend is the source of truth.** ADU-PRD-01 §23: *"All state logic on the server. Clients display state and send intents."* A Companion action taken while the PWA is open in another tab converges, because neither client computes state.

---

## 9. Per-document impact

| Document | Change |
|---|---|
| **ADU-DB-01 → v1.6** | `telegram_binding` removed; **`core.permission` added** with surface scoping; `session_audience` → three values; `actor_channel` → `WEB`/`MOBILE`/`SYSTEM`; `notification_channel` drops `TELEGRAM`. **105 tables** |
| **ADU-API-01 → v1.3** | §12.15 Telegram group deleted; seller endpoints gain a mobile-reachable marking; **§3.1's version-skew rule applies to seller endpoints again**; §4's IAP note reinstated. **79 endpoints** |
| **ADU-00 → v9.1** | Architecture line; rule 6 rewritten (X4); trust ladder `New` (W5); Related header (X12) |
| **ADU-PROJ-01 → v9.1** | §5.2's eighth criterion withdrawn; **§8.3 rewritten for two developers**; §9.1 client table; §9.2 store readiness covers seller functionality; §10 notification costs; §15 gains the core-commerce doctrine |
| **ADU-PRD-01 → v8.6** | §3 client matrix rebuilt; §3.0 rewritten; §9.1 no acceptance gate; §10.1 confirmation wording; §16.7 IAP restored; plus the write-backs in ADU-XREF-01 §4 |
| **ADU-WEB-01 → v1.1** | §6.1's "no Log in link" reversed; §9 CSP; plus ADU-XREF-01 §4 |

---

## 10. What does not change

- **The trust architecture.** Levels, scanned handoffs, the distinct-buyer rule, published statistics.
- **The custody perimeter.** Adulis holds no buyer money.
- **The isolated boundaries.** `verification` and `financial` keep their roles, functions and access logs. **No mobile path reaches a `SECURITY DEFINER` function that the web path does not.**
- **The bio link.** One profile link; no per-post product link.
- **The reservation lifecycle**, the confirmation window and retry rule, X14's `CLOSING` state, X15's dispute ladder — all specified against behaviour rather than clients, and all intact.

---

*Binding architecture record. Telegram is removed from the required architecture. One constraint gates the iOS submission: the Companion must be silent about subscriptions, including any link to the console's billing pages. Under the two-developer split the front-end owns four surfaces, which is why §3.1 phases the Companion rather than building all twelve screens at once.*
