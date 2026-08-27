# ADU-AUTH-01 -- Authentication and Authorization

**Version:** 2.4  -  **Baseline date:** 27 August 2026
**Owner:** Founder / CEO (back-end)  -  COO/CTO (front-end)
**Status:** Binding specification for identity, access and privilege on every surface.
**Supersedes:** ADU-AUTH-01 v2.3
**Related:** ADU-PRD-01 v8.5 S6, S16.2  -  **ADU-DB-01 v1.10** S6  -  **ADU-API-01 v1.6**  -  ADU-ARCH-01 v2.0  -  ADU-CON-02 v3.0 + A1  -  ADU-SEC-01 v1.0  -  ADU-DPIA-01 v1.0

> **v1.0 scoped authorization out. That was wrong**, and this revision corrects it. *Who are you* and *what may you do* are one decision made in two halves, and separating them across documents is how a permission ends up enforced on one surface and not another.
>
> ADU-PRD-01 S6 settles the authentication **mechanism** -- phone OTP, for every actor -- and none of its **parameters**. S16.2 names five team roles and never says what any of them may do. Both gaps are closed here.

---

## 0.1 What changed in v2.4

**Three corrections, none of them to a grant.** The matrix is unchanged: 42 codes, 139 grants, the same two departures.

| # | Change |
|---|---|
| **R30** | The **"of which write" column is withdrawn** from S16.2's checksum table. It did not reproduce -- two careful readers computed 27/25 and 28/26 -- and *write* is nowhere defined |
| **S16.6** | Gains a **second clause: a two-form rule is only a check if something compares the forms.** `pnpm verify:permission-doc` is that comparator and is a standing CI gate |
| **S14, S18.1** | **Suspension is enforced in authorization, not only in authentication.** R28 |

**Everything else is carried forward from v2.3 unaltered.**

---

## 0.2 What changed in v2.3 -- retained for history

**v2.3 changes no grant. It changes the encoding.**

ADU-AUTH-01 v2.2 S16.2 rendered its matrix with `Y` and `--`. Both are three-byte UTF-8 characters, and in transit **every one of the 252 cells lost its trailing bytes and collapsed to the same glyph.** Granted and not-granted became indistinguishable, and the legend collapsed with them -- it read *"`a` is granted; `a` is not."* The seed could not be transcribed, and the agent correctly refused to guess: the prose pins Owner's 42, Admin's 40, the seven universal reads and S16.4's departures, but leaves Analyst's ten and the membership of 19 / 16 / 12 underdetermined -- **and a guess would have satisfied every checksum in ADU-DB-01 S6.9a.**

| # | Change |
|---|---|
| **S16.2** | The matrix is **ASCII only** -- `Y` and `.`, `YES` in the step-up column. No character above U+007F appears in it |
| **S16.2a** | **New: the seed as executable SQL.** 42 `INSERT` values and 139 grants, generated from the same source as the table. There is nothing left to transcribe |
| **S16.6** | **New: a rule.** Load-bearing data in this document set is ASCII; decorative glyphs may appear in prose and never in a cell whose value is the data |

**Why the SQL block is the real fix.** An ASCII table still has to be read by a human or a parser and turned into rows -- and a transcription step is a place where a defect can enter without anything raising. S16.2a removes the step. The table is for reading; the SQL is for running; both are generated from one source, so they cannot disagree.

**Everything else is carried forward from v2.2 unaltered** -- the same 42 codes, the same 139 grants, the same two departures, the same canonical eight.

---

## 0.2 What changed in v2.2 -- retained for history

**v2.2 exists because Tier 1 could not be built from v2.1.** The agent seeding `core.permission` from S15 and `core.role_permission` from S16 found that **S16 is a group matrix and the seed is code-level** -- twenty group rows against forty-two codes, with no stated mapping between them. It refused to invent one, which was correct.

| # | Area | v2.1 | v2.2 |
|---|---|---|---|
| **S16** | Role matrix | **Twenty group rows.** "Catalogue write, publish"  -  "Store write, availability" -- a group covering three or four codes, with `Y`, `o` and `--` and no definition of `o` | **All 42 codes x 6 roles, 139 grants.** Directly transcribable into `role_permission` |
| **S16.2** | `seller.fulfilment:write` | Added to S15.1 in v2.1 and **never added to the matrix** | Granted to Owner, Admin, Inventory -- on v2.1's own stated reasoning |
| **S16.3** | The eight step-up codes | Named in S17 | **Restated as the canonical list**, because ADU-DB-01 v1.8's `CHECK` disagrees with it and must be rebuilt from here |
| **S16.4** | -- | -- | **Two deliberate departures from the group matrix**, each with its reason, so a reviewer comparing the two knows which differences are decisions |

**What this revision does not change.** S15's catalogue is unaltered -- 42 codes, same groups, same `M` and `S` markings. Sections 1-14 and 17-25 are untouched. **This is a rewrite of one section into a form that can be seeded.**

### The defect this revision was written to feed

ADU-DB-01 v1.8 S6.9a constrains step-up permissions with:

```sql
CHECK (code NOT IN ( ... six codes ... ) OR surfaces = ARRAY['CONSOLE'])
```

**Three of the eight step-up permissions are absent from that list** -- `seller.orders:reissue_instructions`, `seller.identity:manage`, `seller.ownership:transfer` -- and **absence satisfies the first disjunct**, so each is unconstrained: a seed granting `seller.identity:manage` to `MOBILE` inserts cleanly. A seventh listed code, `seller.instructions:reissue`, **is not a permission that exists** and therefore constrains nothing either.

**The reviewer query in ADU-DB-01 Appendix C -- written to catch exactly this -- does not compile**, selecting `key` where the column is `code` and filtering on `requires_step_up`, which the table does not have.

**S16.3 below is the canonical list. ADU-DB-01 v1.9 rebuilds the `CHECK` and the query from it, and neither is authoritative here.**

---

## 0.2 What changed in v2.1 -- retained for history

**v2.1 is the reissue that closes v2.0's own recommendations.** v2.0 raised three findings and made two structural recommendations; ADU-DB-01 v1.7 and ADU-API-01 v1.4 have now adopted all of them, so this revision records what landed, closes what closed, and carries one new ruling of its own.

| # | Area | v2.0 | v2.1 |
|---|---|---|---|
| **R17** | Console session lifetime | 12 hours absolute, **30 minutes idle**, OTP every return | **Remembered devices: 7 days / 8 hours.** Unremembered keeps 12h/30min. S8.1a |
| **F3** | Boundary audit identity | **Open finding** -- a defect in ADU-DB-01 | **Closed.** ADU-DB-01 v1.7 S7.3 and S13.3 derive the role; the parameter is gone |
| **S12** | Courier audience | *Recommendation* -- collapse `COURIER_WEB` into `CONSOLE` | **Accepted and implemented.** ADU-DB-01 v1.7 carries two audiences |
| **S20.1** | Operator model | **No operator model at all** | **Structurally closed.** `core.operator_grant` exists in ADU-DB-01 v1.7 S6.11 -- with the role names reconciled (S20.1). The **surface** remains out of scope |
| **S5.1** | Credential presentation | *"a change to ADU-API-01 that it has not absorbed"* | **Absorbed.** ADU-API-01 v1.4 S5.1 |
| **S17** | The step-up `CHECK` | Stated `surfaces = '{CONSOLE}'` while ADU-DB-01 v1.6 said `ARRAY['SELLER_WEB']` | **Reconciled.** v2.0 was right and v1.7 now matches it |
| **S6** | SMS fallback | Required, no provider named | **Structure decided** (ADU-CON-02 S18): local aggregator primary, Twilio Verify secondary with voice fallback. **Vendor still pending Phase 0 measurement** |
| **S15.1** | Permission catalogue | -- | **`seller.fulfilment:write` added.** `seller.order_ready:update` gains the column and endpoint it lacked |
| **F1, F2** | SMS and SIM swap | Open | **Still open.** Neither is closed by anything in this revision, and S6 and S7 stand unaltered |

**The one new ruling is R17, and it came from a cost model rather than a threat model** -- which is unusual enough to be worth flagging. ADU-CON-02-A1 found that the 30-minute idle timeout, combined with OTP as the only sign-in factor, spends **$648/month on sign-in messages at 1,000 sellers and $6,500 at 10,000**, against a $50 infrastructure target. S6 already warned that *"session lifetime is partly an SMS-cost decision, not only a security one."* A1 put a number on it, and the number changed the ruling.

**Everything not listed above is carried forward from v2.0 unaltered.**

---

## 1. Scope, and three findings that come first

**Part I -- Authentication** (S2-S13): identity creation, sign-in, session issuance and lifetime, credential presentation, step-up, recovery, the deletion ticket, age declaration.

**Part II -- Authorization** (S14-S21): the four gates, the permission catalogue, the role matrix, surface scoping, entitlement, scope enforcement, buyer authorization, operator authorization.

**Out of scope:** the CSP and cookie work in ADU-SEC-01, which this document depends on rather than restates.

**Three things in the current design do not survive their threat model.** None is a defect in what is written -- each is a control that stops short of the attack:

| | Finding | Section |
|---|---|---|
| **F1** | **SMS is a single point of failure with no fallback**, and it is the only way anyone signs in | S6 |
| **F2** | **SIM swap defeats every account-takeover control specified**, including the one designed to catch it | S7 |
| ~~F3~~ | **Closed in v2.1.** ADU-DB-01 v1.7 derives the role inside both functions; the parameter no longer exists. S20.2 is retained because the reasoning is the reason the fix holds | S20.2 |

**F3 was new in v2.0 and it is closed in v2.1.** It was a defect in ADU-DB-01, which I wrote; ADU-DB-01 v1.7 S7.3 and S13.3 now derive the actor's role from actual grants. S20.2 records the fix and why it also turned a logging function into an authorising one.

**F1 and F2 remain open, and neither is closed by this revision.** SMS is still the only way anyone signs in, and SIM swap still defeats every account-takeover control specified here. R17 reduces the *number* of messages by roughly seventy percent (S8.1a), which reduces exposure and cost -- **it does not reduce dependence.** A seller who cannot receive one message still cannot sign in.

---

# PART I -- AUTHENTICATION

## 2. The mechanism, and what it excludes

**Phone number and one-time code. For buyers, sellers, team members, couriers and operators. Nothing else.**

ADU-PRD-01 S6.2 gives the reasoning and it is sound: it is the mechanism every Ethiopian seller already uses everywhere else, it needs no password reset flow, it creates no credential-breach surface, and it removes an entire family of screens from a product built by two people.

**What is deliberately absent:**

| Not used | Why |
|---|---|
| **Passwords** | A credential to breach, reset, rotate and phish. The reset flow would land on the phone anyway |
| **Email** | Many Ethiopian sellers do not have one they check. It would be a second unreliable channel, not a fallback |
| **Social login** | ADU-PRD-01 S6.1: none in V1. It would tie account access to a platform whose policy changes are outside our control -- the same platforms whose API access already sits behind an adapter for that reason (S13.1) |
| **Biometric as a factor** | Device biometric is a **local unlock**, never a factor Adulis verifies. S8.4 |
| **Passkeys / WebAuthn** | The eventual answer to S7, and premature. Support on the low-end Android that is the binding constraint is thin |

**INVARIANT -- a seller account is bound to one phone number, and that number is the authentication factor** (S6.2). **INVARIANT -- the bound number changes only through S9's recovery path, never through settings.**

---

## 3. Identity -- one account, roles as relationships

The model already exists and needs no change (ADU-DB-01 S6.1, ADU-ARCH-01 S2):

```text
core.account  -- phone_e164 UNIQUE, the authentication factor
   |--- buyer_profile          created at first reserve
   |--- seller (0..n)          owner
   |--- seller_team_member     on other sellers
   `--- seller_courier         for other sellers
```

**One sign-in reaches every role the account holds.** A seller browsing as a buyer, a courier who also sells, a person who owns one store and staffs another -- all ordinary, all one account, all one authentication.

**INVARIANT -- mode switching never re-authenticates.** Buyer <-> Seller is a UI affordance over relationships that already exist. Requiring a fresh OTP to look at one's own storefront would be friction with no security benefit, since the same session already reaches both.

**Buyer identity is created at the moment of first reserve** (S6.1) -- not at install, not at browse. The cart survives it: `core.cart` is keyed by `device_id` and binds `buyer_account_id` in the same transaction that creates the account (ADU-DB-01 S11.1).

---

## 4. The one-time code

### 4.1 Parameters

None of these appears in any existing document. Each is per-market configuration in `core.timing_config` unless marked fixed.

| Parameter | Value | Reasoning |
|---|---|---|
| **Length** | **6 digits** | 106 space. Against the attempt and rate limits below, brute force is not the threat -- interception is |
| **Alphabet** | Digits only, **fixed** | Entered on a phone keypad by people who may be reading it aloud from a notification |
| **Generation** | CSPRNG, uniform | Never a timestamp, counter or sequence |
| **Lifetime** | **5 minutes** | Long enough for a slow SMS on a congested network; short enough that an intercepted code expires before it is useful |
| **Attempts per challenge** | **5**, then the challenge is dead | Dead means dead -- no reset by requesting a new one |
| **Live challenges per (phone, purpose)** | **Exactly 1** | S4.2 |
| **Storage** | Hash only, never plaintext | `otp_challenge.code_hash` |
| **Comparison** | Constant-time | A timing oracle on a 6-digit code is a real one |

### 4.2 One live code at a time

**INVARIANT -- issuing a new challenge for a (phone, purpose) pair invalidates any previous live challenge for that pair.**

Without this, every resend multiplies the attack surface: three live codes mean three valid answers, and an attacker spraying guesses gets three chances per attempt rather than one. The attempt budget is per challenge, so several live challenges multiply the budget too.

The cost is a race: a user who requests a resend and then receives the *first* SMS enters a dead code. **The error must say so specifically** -- `OTP_SUPERSEDED`, rendered as *"that code has expired -- check for a newer message"* -- rather than the generic invalid-code message, which would send them round the loop again.

### 4.3 Request versus resend

**Ruled at X11.** One header cannot express two intents.

| | Endpoint | Idempotency key | Behaviour |
|---|---|---|---|
| **Transport retry** -- the code was sent, the response was lost | `POST /v1/auth/otp/request` | **Required** | Returns the stored response. **Sends nothing** |
| **Resend** -- the person never received the SMS | `POST /v1/auth/otp/resend` | **Not used** | Issues a new code, invalidating the previous one |

**A resend button calls resend. Only a lost response reuses a key.** Getting this backwards produces one of two failures: a person waiting for an SMS that was never dispatched, or a network retry burning the rate limit before anything arrives.

Resend carries **exponential backoff** -- 30s, 60s, 120s -- surfaced in the interface as a countdown rather than a rejected tap.

### 4.4 What the message says

**SMS is not confidential.** It renders on a lock screen and, on Android, is readable by any application holding SMS permission.

> **INVARIANT -- a sign-in code names no action.** *"483920 is your Adulis code."* Nothing about what it unlocks.
>
> **INVARIANT -- a step-up code names the action.** *"483920 -- confirm changing your Adulis payout account."*

**The asymmetry is deliberate and the second half is the security control.** A seller who receives a payout-change code they did not request has been told, in the clearest possible way, that someone is inside their account. That warning is worth more than the marginal confidentiality lost by naming the action, because an attacker who can read the SMS already has the code.

**INVARIANT -- no code is ever sent by a channel the account holder has not proven control of.** There is no email fallback and no alternate-number path.

---

## 5. Sign-in by surface

| Surface | Flow | Result |
|---|---|---|
| **Mobile app** | Phone -> OTP -> session, `audience = MOBILE` | Bearer token in native secure storage |
| **Seller console** | Phone -> OTP -> session, `audience = CONSOLE` | **httpOnly cookie** -- ADU-SEC-01 S4 |
| **Deletion page** | Phone -> OTP -> **ticket, not a session** | S10 |
| **Public web** | **None.** Anonymous | ADU-ARCH-01 S6.3 |

```
POST /v1/auth/otp/request   { phone, purpose: "SIGN_IN" }              -> 202
POST /v1/auth/otp/resend    { phone, purpose: "SIGN_IN" }              -> 202
POST /v1/auth/otp/verify    { phone, code, audience, device_id }       -> 200 + credential
```

`roles[]` is returned on verify and is a **rendering hint only**. Authorisation resolves server-side per request through `fn_has_permission`; a client that hides a control while the server permits the call is the failure S16.2 forbids.

### 5.1 Credential presentation differs by surface

From ADU-SEC-01 S4, and it is the control that decides whether an XSS is survivable:

| Surface | Credential | Why |
|---|---|---|
| `MOBILE` | `Authorization: Bearer <opaque>` | Native secure storage has no XSS surface |
| `CONSOLE` | `__Host-adulis_session` -- httpOnly, Secure, SameSite=Strict | **A token JavaScript can read is a token XSS can steal.** The console holds payout access |

**ADU-API-01 v1.4 S5.1 has absorbed this**, and the two documents now agree. The note in v2.0 flagging it as an unabsorbed change is discharged.

**Remembered devices add a second cookie, not a second credential.** `__Host-adulis_device` is an opaque token bound to a `core.account_device` row (ADU-DB-01 v1.7 S6.6a). It selects a session lifetime; it authenticates nothing on its own, and it does not weaken any step-up (S8.1a).

**Tokens are opaque and stateful in both cases.** Never a JWT: S6.4 requires revocation to take effect immediately, and a JWT invites the stateless validation that breaks it.

---

## 6. SMS delivery is a single point of failure

**Nothing in the document set addresses what happens when the SMS does not arrive.** OTP is the only way anyone signs in, so a delivery failure is not a degraded experience -- **it is a total inability to use the product**, for that person, with no path around it.

This is not hypothetical. SMS delivery in Ethiopia runs through a small number of operators, aggregator delivery is variable, and network congestion is routine. **A 90% delivery rate means one sign-in attempt in ten fails**, and the person experiencing it has no way to tell whether the problem is the network, the number they typed, or the product.

**The compounding failure is measurement.** A seller who cannot sign in does not file a support ticket -- they stop. That appears in the funnel as churn, gets attributed to the product, and the actual cause is invisible.

> **Required, and none of it is expensive:**
>
> **1. The SMS gateway sits behind an adapter interface**, exactly as ADU-PRD-01 S16.7 already requires of the payment collection provider, and for the same reason. **A second provider is configured before launch**, not after the first outage.
>
> **2. Automatic failover on non-delivery.** If the primary reports failure or does not confirm within a configured window, the resend goes out through the secondary. The user sees one countdown, not two providers.
>
> **3. Voice-call fallback** is offered after the second failed resend -- a call that reads the code aloud. Standard in markets with unreliable SMS, and it uses a different network path.
>
> **4. Delivery rate is a first-class metric from day one.** `otp_delivery_confirmed` against `otp_requested`, by provider and by operator prefix. **This belongs in ADU-PROJ-01 S12's release gates** -- if it is below a threshold set in advance, the product has a growth ceiling that no amount of marketing moves.

**A note on cost.** SMS is the one per-transaction cost in an architecture otherwise designed to have none (ADU-PROJ-01 S10). Every sign-in, every resend, every step-up is a message. **Session lifetime in S8 is partly an SMS-cost decision**, not only a security one -- a 30-day mobile session is roughly one message a month per buyer.

**v2.1 -- that sentence turned out to be the finding.** ADU-CON-02-A1 modelled the console's 30-minute idle timeout against real seller behaviour and found the specified design spends **$648/month at 1,000 sellers and $6,500 at 10,000**, rising linearly with no ceiling, against a $50 infrastructure target. The 3-per-hour phone limit in S22 begins locking out honest sellers at around fifteen hundred. S8.1a is the ruling that follows.

**Provider structure, decided in ADU-CON-02 S18:** an **Ethiopian aggregator as primary** and **Twilio Verify as secondary**, the latter also carrying the voice fallback of requirement 3 and any launch outside Ethiopia. Requirements 1 to 3 are therefore satisfied in structure.

[!] **Requirement 4 is not.** The primary vendor is still chosen **by measured delivery rate during Phase 0**, and until that measurement exists this section's central claim -- that delivery rate is a growth ceiling nobody can see -- remains untested rather than resolved.

---

## 7. SIM swap defeats every control currently specified

**This is the fundamental weakness of phone-only authentication, and the existing controls do not reach it.**

An attacker who ports a seller's number to their own SIM keeps **the same number**. Walk it through:

| Step | Control that should stop it | What happens |
|---|---|---|
| Attacker requests a sign-in code | Rate limits | Passes -- the request is legitimate in form |
| Code arrives on the attacker's SIM | -- | Received |
| Sign-in on a new device | S6.4's **new-device notification to the registered number** | **Delivered to the attacker.** The control fires and reaches the wrong person |
| -- | S6.6's **operator review** | **Never triggers.** It fires on a *number change*, and the number did not change |
| Payout change requested | Step-up OTP | **Delivered to the attacker** |
| -- | 24-hour activation delay + notification | Notification goes to the number (attacker) and every Owner/Admin -- **which, for a solo seller, is the same person** |
| After 24 hours | -- | Future payments reroute |

**Total time to compromise: about 24 hours. For a seller who is the only Owner on their account, nothing in the current design interrupts it.**

### 7.1 What already helps, and it is worth crediting

**ADU-PRD-01 S8.5 captures payout details onto the order.** A successful payout change **does not touch orders already placed** -- the payment instructions a buyer sees are read from the order's snapshot, not the seller's current record.

So the blast radius is **future orders only**, and there is no bulk reissue path (S8.5 permits reissue on a single named order and never in bulk). That is a genuinely good control and it was designed for exactly this attacker.

### 7.2 Two changes that close most of the rest

> **1. The new-device notification goes by push first, SMS second.**
>
> **A SIM swap moves the number. It does not move the app installation.** A push to the seller's existing registered devices reaches the real seller, on the phone they still hold, while the SMS reaches the attacker. The device registry already exists -- `core.device` carries a push token, platform and permission state per account.
>
> **INVARIANT -- a new-device sign-in on an account with any seller relationship notifies every registered device by push and the bound number by SMS.** Not suppressible, per S6.4.

> **2. The payout cooling period extends to a new-device sign-in, not only to recovery.**
>
> ADU-PRD-01 S6.6 locks payout changes for 7 days after an operator-reviewed recovery. **It does not lock them after an ordinary sign-in from an unrecognised device** -- which is precisely the SIM-swap path, because that path never touches recovery.
>
> **INVARIANT -- a payout change is blocked for `new_device_payout_lock` (default 24 hours) after the first sign-in from a device not previously seen on that seller account.** Stacked with the existing 24-hour activation delay, an attacker needs **48 hours under a push notification the real seller has already received.**

**Both are small.** The first reuses a table that exists. The second reuses a mechanism that exists -- S6.6's `payout_locked_until` -- and merely widens its trigger.

### 7.3 The residual, stated plainly

**Neither change eliminates SIM swap.** A seller who has lost their phone as well as their number, or who ignores the push, is still exposed. The complete answer is a credential bound to hardware rather than to a number -- **passkeys on the console**, which is the right eventual direction and premature for the device base this product targets.

**Record it in ADU-PROJ-01 S13.1 as a known limit** rather than leaving it to be discovered. It is the same honesty S3.4 already applies to the buyer-protection gap: the mitigations reduce it, and none of them closes it.

---

## 8. Sessions

### 8.1 Lifetimes

| Audience | Absolute | Idle | Concurrent |
|---|---|---|---|
| `MOBILE` | **30 days**, sliding on activity | -- | 5 devices |
| `CONSOLE`, remembered device | **7 days** | **8 hours** | 3 |
| `CONSOLE`, any other device | **12 hours** | **30 minutes** | 3 |

Per-market configuration -- four columns on `core.timing_config` (ADU-DB-01 v1.7 S6.6a). **INVARIANT -- both `CONSOLE` pairs are shorter than the `MOBILE` lifetime**, enforced by a `CHECK` on the configuration table so an edit cannot invert either.

**S6.4's reasoning survives the architecture change, by a different mechanism.** It held that *a buyer losing a session loses convenience; a seller losing one loses payout control.* Under ADU-ARCH-01 v2.0 one mobile session serves both modes -- but **payout control is not reachable from mobile at all** (`core.permission.surfaces`), so the short lifetime attaches to the surface where the dangerous capabilities live rather than to the person holding it.

**12 hours covers a working day**, which is the honest unit for a console session. **30 minutes idle** matters more: a console left open on a shared or borrowed laptop is the realistic exposure, not a stolen token.

### 8.1a Remembered devices -- R17

**The finding is economic, and S6 predicted it.** With a 30-minute idle timeout and OTP as the only sign-in factor, **every console return after a coffee break is one SMS.** A seller who checks their store morning, midday and evening costs three messages a day. ADU-CON-02-A1 modelled it: **$648/month at 1,000 sellers, $6,500 at 10,000** -- seven times the entire infrastructure budget at the lower figure -- and even the floor of one visit a day comes to $360. The specification, followed exactly, produced that. So the specification changes.

> **RULING R17 -- at console sign-in the seller may mark the device remembered.** A remembered device carries a 7-day absolute and 8-hour idle lifetime; every other device keeps 12 hours and 30 minutes.
>
> **Mechanics.** Remembering sets `__Host-adulis_device`, an opaque token whose hash is stored on `core.account_device` (ADU-DB-01 v1.7 S6.6a). It is revocable like any session, appears in the sessions list under a label the seller can read, and **revoking it ends every session it created, in the same transaction.**

**Why the longer window is safe here, and it is a real trade rather than a free one.** A longer session is a longer window for a stolen cookie. Four things carry that risk, and none of them is the session length:

1. **The cookie is `HttpOnly` and `__Host-`-prefixed**, so theft requires device compromise, not XSS (S5.1).
2. **Every step-up action in S9.1 demands a fresh OTP regardless of session age.** That is the control protecting money, and R17 does not touch it. An attacker holding a week-old remembered session still cannot change a payout account, transfer ownership, alter the team, purchase a subscription, delete the seller or revoke sessions.
3. **New-device sign-in still notifies unsuppressibly** and still triggers the payout lock of S7.2 -- a *remembered* device is one the seller has asserted; a *new* device is one the account has not seen, and the two are different facts.
4. **Revocation is still immediate**, because the session row is still read on every request (S8.2).

**The 30-minute idle was defending the borrowed-laptop case.** The remembered flag is precisely the seller asserting *this is not that laptop* -- and an unremembered device keeps the strict values, so the defence remains available to anyone who wants it. The checkbox is off by default; a seller must choose it.

**Effect:** roughly 1.5 console OTPs per seller per day become roughly 0.25. At 10,000 sellers, **$6,500/month becomes about $2,000**, and what remains is buyer signups and step-ups -- spend that maps one-to-one onto a new buyer or a protected money action, which is the correct shape for a cost rather than a leak.

[!] **This reduces SMS dependence in volume, not in kind.** F1 stands: a seller who cannot receive one message still cannot sign in at all. **Passkeys / WebAuthn are the path to near-zero** -- a second factor that is not a message, on a surface that is already a browser -- and they are recorded here as the post-MVP direction rather than built now.

### 8.2 Revocation

**INVARIANT -- revocation takes effect server-side immediately, not at next token refresh** (S6.4). The session row is read on every authenticated request -- one indexed primary-key lookup, and the price of the invariant.

- List active sessions with device, first seen, last activity, approximate location.
- Revoke any one, or **all others** -- which requires step-up (S9.1).
- **Recovery revokes every session on the account**, without exception. An account recovered while an attacker holds a live session is not recovered.

### 8.3 Active seller context

A person may own Store A and staff Store B. Every seller-scoped call must say which.

> **INVARIANT -- the active seller context is a request parameter, never session state.**
>
> `seller_id` travels in the path or an explicit header and is validated by `fn_has_permission(account, seller, permission, audience)` on **every** call.

**Session-held context is a bug waiting for a tab.** A seller with two stores open in two tabs, switching context in one, then acting in the other, lands the action on the wrong store -- and in this product that means confirming the wrong payment or cancelling the wrong order. Per-request context makes the class impossible.

### 8.4 Device biometric

The mobile app may require device biometric or PIN to open, unlocking the stored bearer token.

**INVARIANT -- biometric is a local device unlock and is never a factor Adulis verifies.** No biometric data reaches Adulis, is stored by Adulis, or appears in any table -- which also keeps Adulis clear of the biometric category in Proclamation 1321/2024's sensitive-data definition. Default **on** for accounts holding a seller relationship, and user-configurable.

---

## 9. Step-up authentication

### 9.1 The six actions

From ADU-PRD-01 S6.5, unchanged: changing payout details  -  reissuing payment instructions on an order  -  adding, removing or changing a team member's role  -  purchasing, upgrading or cancelling a subscription  -  deleting the seller account  -  revoking all other sessions.

**INVARIANT -- every one requires a fresh challenge regardless of an active session.**

**INVARIANT -- none is reachable from `MOBILE`.** `core.permission.surfaces` restricts all six to `CONSOLE`, enforced by a `CHECK` (ADU-DB-01 S6.9a), so the mobile client receives 403 from the permission function before any endpoint logic runs.

**Viewing payment evidence is deliberately not on the list**, and S6.5's reasoning is worth preserving: it is the seller's routine work, and a challenge on every order trains people to approve challenges without reading them.

### 9.2 Mechanics

```
POST /v1/auth/step-up/request  { action, target_ref }   -> 202  (SMS names the action, S4.4)
POST /v1/auth/step-up/verify   { challenge_id, code }   -> 200  { challenge_id, satisfied_at }
POST /v1/seller/payout         { ..., step_up_challenge_id }
```

| Parameter | Value |
|---|---|
| **Freshness window** | **5 minutes** from `satisfied_at` |
| **Uses** | **Exactly one.** Consumed by the action it authorised |
| **Binding** | To the `action` **and** the `target_ref` |

**INVARIANT -- a challenge satisfied for one action cannot authorise another**, and one satisfied for order A cannot authorise order B. Without the target binding, a seller tricked into approving a reissue on a trivial order has approved one on any order.

**The challenge id is a function parameter, not middleware.** ADU-DB-01 S6.7: the writing function takes it as an argument, so a code path that omits it does not compile. A guard decorator is something forgotten on the seventh endpoint, and the omission is invisible until it is exploited.

---

## 10. Recovery

| Situation | Path |
|---|---|
| New device, same number | Ordinary OTP. No review. **Triggers S7.2's push and payout lock for seller accounts** |
| Lost device, number retained | Ordinary OTP on the new device |
| **Number changed or SIM lost** | **Operator review. Never self-service** |

Operator review draws on evidence Adulis already holds: the identity attestation where one exists, account-control verification against the linked social account, order and device history, and the registered payout details.

**INVARIANT -- the reviewing operator's decision, the evidence relied on, and the reason are logged** (S6.6).

**INVARIANT -- payout details cannot be changed for `recovery_cooling_period` (default 7 days) after any recovery.** ADU-DB-01 S6.8 writes `payout_locked_until` in the same statement that approves the recovery -- one transaction, two effects, because the attack is *recover then immediately reroute* and the two writes must not be separable.

**During the cooling period the seller operates normally in every other respect.** They confirm payments, arrange handoffs, chat, refund. Only the bank account is frozen.

[!] **Recovery is founder work with no SLA.** ADU-PROJ-01 S8.2's table does not list it. A seller locked out mid-trade is an urgent case, and it should have a target response time set before the beta rather than after the first one.

---

## 11. The deletion ticket

Required by both app stores and specified in ADU-WEB-01 S6.2. **It is not a sign-in and must not become one.**

```
POST /v1/deletion/otp/request  { phone }               -> 202
POST /v1/deletion/otp/verify   { phone, code }         -> 200 { ticket, expires_at }
GET  /v1/deletion/preview      Authorization: Ticket    -> blockers as items[]
POST /v1/deletion/confirm      Authorization: Ticket
```

**INVARIANT -- an OTP with purpose `ACCOUNT_DELETION` cannot mint a session.** Enforced by a trigger in the database (ADU-DB-01 S6.5), not by remembering not to.

| Property | Value |
|---|---|
| Lifetime | **15 minutes** |
| Scope | The four deletion endpoints. **Rejected by every other endpoint** |
| Session | **None.** No cookie set, no bearer issued |
| Copy | The page states in its own words that it is not a sign-in |

**The explanation precedes the phone number** (ADU-WEB-01 S6.2): a person should know what they are requesting before identifying themselves, and a store reviewer looks for it on the landing step.

---

## 12. Team members and couriers

**INVARIANT -- both authenticate with their own phone number by OTP. Neither shares the seller's credentials** (S6.3).

| Actor | Invited by | Reaches |
|---|---|---|
| **Team member** | Owner or Admin, Business tier | Whatever their role grants, server-enforced on every endpoint |
| **Courier** | Any seller | **Currently assigned orders only.** Row-level security, and access ends with the assignment |

**Both use the console.** ADU-ARCH-01 v2.0 gives sellers no native app; couriers need one screen and will not install anything.

> **Accepted in v2.1 -- `COURIER_WEB` is collapsed into `CONSOLE`.** ADU-DB-01 v1.7 carries two audiences, `MOBILE` and `CONSOLE`.
>
> The courier's restriction is enforced by row-level security keyed on `current_setting('adulis.actor_role')`, **which is resolved per request, not per session** -- so a separate audience bought nothing the RLS policy did not already enforce, while forcing a person who is both courier and seller to hold two logins for one account, a case ADU-PRD-01 S6.3 calls ordinary.
>
> **The courier's isolation is unchanged and is stronger than an audience check ever was**, because it is on the table rather than on the session. A forgotten `WHERE` clause cannot widen it.

---

## 13. Age declaration

**ADU-DPIA-01 R15 records that no age check exists anywhere.** Identity is created at first reserve by phone OTP, with nothing asked.

> **Recommendation:** a **self-declared confirmation of being 18 or over** at identity creation, blocking below.

**Store the confirmation, not the date.** `account.age_declared_over_18 boolean` and `age_declared_at` -- not a date of birth. Adulis sells no age-graded product (the prohibited list in ADU-00 has no alcohol or tobacco category), so a date of birth would be data collected for no purpose, and data minimisation is a live obligation rather than a preference.

**Self-declaration is not verification and should not be described as such**, in the interface or in the privacy notice. It is the standard position where no specific verification mandate applies.

[!] **Whether a stronger check is required is a legal question, not a product one.** An age-verification provision was implemented alongside Proclamation 1321/2024 and its scope needs confirming. **This belongs with the ADU-DPIA-01 S11 legal review**, alongside Article 22.

---

# PART II -- AUTHORIZATION

## 14. Four gates, and they are independent

Authentication answers *who are you*. Authorization answers **five** separate questions, and **a request proceeds only if all five pass.**

> **v2.4 adds the standing gate, and it was previously missing rather than merely unnamed.** S18.1 places suspension at authentication -- *"team logins are disabled, not deleted."* **Disabling a login does not end a live session.** A member suspended for cause who holds a console session kept every permission until it expired: up to twelve hours, or **seven days on a remembered device under R17**. For an `ADMIN` that is payout access, staff administration and identity management for a week after the Owner suspended them.
>
> **R28 puts the check where it cannot be skipped** -- the same row `fn_has_permission` already reads to resolve the role, so it costs nothing and takes effect on the next request. Session revocation on suspension happens too, as hygiene; if it fails, the boundary still holds. **Suspension is an authorization question as much as an authentication one, and v2.3 treated it as only the latter.**

| Gate | Question | Enforced by | Failure |
|---|---|---|---|
| **Standing** | Is this person still a member in good standing? | `fn_has_permission` -- `suspended_at IS NULL AND revoked_at IS NULL` | `PERMISSION_DENIED` (`U0001`) |
| **Role** | May this person do this for this seller? | `fn_has_permission`, `core.role_permission` | `PERMISSION_DENIED` (`U0001`) |
| **Surface** | May they do it from *here*? | `core.permission.surfaces` | `PERMISSION_DENIED` (`U0001`) |
| **Entitlement** | Does this seller's tier and level include the capability at all? | `billing.fn_effective_limit` | `TIER_LIMIT_REACHED`  -  `LEVEL_LIMIT_REACHED` |
| **Scope** | Is this object actually theirs? | Composite foreign keys and row-level security | `404` |

**They are independent, and conflating them produces the wrong error.**

An Owner on the Free tier cannot configure custom chatbot flows. **That is not a permission failure** -- their role grants it and their surface allows it. The seller's *tier* does not include the capability. Returning `PERMISSION_DENIED` would tell an Owner they lack authority over their own store, which is both false and confusing.

Conversely, an Analyst cannot change a price on a Business-tier seller. Entitlement is satisfied; **the role is not**. Returning a tier error would tell them to upgrade a subscription that is already sufficient.

**A fifth check sits above all four and is not authorization:** the seller's own status. A `SAFETY_SUSPENDED` or `CLOSING` seller is blocked from forward-looking actions regardless of who is asking (ADU-PRD-01 S16.8, X14). That is a state gate, evaluated first.

---

## 15. The permission catalogue

**INVARIANT -- `core.permission` is a closed set. A permission code that is not in this catalogue does not exist**, and `role_permission` carries a foreign key to it, so a role cannot be granted a capability nobody defined.

**Naming: `<domain>.<resource>:<action>`.** Lower snake case, no abbreviation.

### 15.1 Seller domain

**M** = reachable from the Seller Companion on mobile. **S** = requires step-up. Everything unmarked is console-only.

| Group | Permission | | |
|---|---|---|---|
| **Orders** | `seller.orders:read` | **M** | |
| | `seller.orders:respond` | **M** | Cancel a line -- surfaced as *Can't Fulfil* |
| | `seller.order_ready:update` | **M** | Discharged in v2.1 -- `ready_at` and `fn_mark_order_ready` (ADU-DB-01 S12.6a), `POST /v1/seller/orders/{id}/ready` |
| | `seller.orders:reissue_instructions` | | **S** |
| **Payment** | `seller.payment_evidence:read` | **M** | |
| | `seller.payment:confirm` | **M** | *Confirm Payment Received* / *Payment Not Received* |
| | `seller.refunds:report` | | |
| **Catalogue** | `seller.products:read`  -  `seller.products:write`  -  `seller.products:publish`  -  `seller.media:write` | | |
| **Stock** | `seller.stock:read`  -  `seller.stock:write`  -  `seller.stock:bulk_write` | | |
| **Store** | `seller.store:read`  -  `seller.store:write`  -  `seller.availability:write`  -  **`seller.fulfilment:write`** | | New in v2.1 |
| **Messaging** | `seller.messages:read`  -  `seller.messages:send` | **M** | Free on every tier |
| **Handoff** | `seller.handoff:read` | **M** | Includes the QR |
| | `seller.handoff:custody_transfer`  -  `seller.couriers:manage` | | |
| **Feedback** | `seller.reviews:read` | **M**2 | |
| | `seller.claims:read`  -  `seller.claims:respond` | | |
| **Analytics** | `seller.analytics.basic:read` | **M**2 | |
| | `seller.analytics.full:read`  -  `seller.analytics:export` | | |
| **Notifications** | `seller.notifications:read` | **M** | |
| | `seller.notifications.preferences:write` | **M**2 | |
| **Automation** | `seller.chatbot:configure`  -  `seller.chatbot.flows:write`  -  `seller.broadcasts:send` | | |
| **Administrative** | `seller.payout:read`  -  `seller.payout:update` | | **S** |
| | `seller.staff:admin`  -  `seller.ownership:transfer` | | **S** |
| | `seller.subscription:update`  -  `seller.identity:manage` | | **S** |
| | `seller.account:delete`  -  `seller.sessions:revoke_all` | | **S** |

**M2** = Companion **Phase 2** (ARCH-01 S3.1). Built on beta evidence, not before.

**Two v2.1 notes on coverage.** `seller.fulfilment:write` is separated from `seller.store:write` deliberately: fulfilment configuration is a publication-readiness item (ADU-DB-01 S13.0), and an Inventory role that can declare how goods reach buyers without also being able to rename the store is a distinction Business tier will want. **Every permission in this catalogue now has an endpoint** in ADU-API-01 v1.4, except the three Automation permissions, which are recorded deferrals rather than gaps -- Business tier chatbot configuration and broadcasts ship when Business tier does.

**Two capabilities in v1.4 are deliberately *not* seller permissions.** `POST /v1/reports` and `POST /v1/events` are account-scoped, not seller-scoped: a buyer reporting a product holds no relationship with that seller, and requiring one would make the report path unreachable by the people most likely to need it.

### 15.2 Operator domain

See S20 -- these do not exist yet and that is the finding.

`operator.moderation:read`  -  `operator.moderation:decide`  -  `operator.claims:read`  -  `operator.claims:decide`  -  `operator.identity:verify`  -  `operator.identity:read`  -  `operator.evidence:read`  -  `operator.recovery:decide`  -  `operator.support:read`

---

## 16. The role matrix

ADU-PRD-01 S16.2 names six roles and describes none of them beyond *"whatever their role grants, server-enforced on every endpoint."* This is that grant, **at the level the database stores it**.

### 16.1 How this matrix was derived, and where it may be argued with

v2.1 stated the matrix by **permission group** -- twelve rows such as *"Catalogue write, publish"* -- using `Y`, `o` and `--`. A group row cannot be seeded: `core.role_permission` is keyed on `permission_code`, and *"Store write, availability"* covers four codes that do not all belong to the same role. **`o` was never defined at all.**

The expansion below applies three rules, stated so that any row can be checked rather than trusted:

1. **Where a group holds both a read and a write code, `o` resolves to the read.** A partial grant on a mixed group is a read grant; that is what partial means when the alternative is a write.
2. **Where a group holds only writes, `o` resolves to the narrowest code** -- the one whose consequences stop inside the role's own work.
3. **Reads that every role needs to do its job are granted to all six** -- `orders:read`, `products:read`, `stock:read`, `store:read`, `reviews:read`, `notifications:read`, `analytics.basic:read`. Withholding them produces a role that cannot see the thing it is meant to act on, and none of them exposes money, identity or a buyer's contact details.

### 16.2 The matrix -- 42 codes, 6 roles, 139 grants

**ASCII only.** `Y` granted  -  `.` not granted  -  `YES` in the Step-up column marks the eight of S16.3. Columns are Owner, Admin, Sales/Support, Inventory, Analyst, Campaign -- whose `core.team_role` values are `OWNER`, `ADMIN`, `SALES_SUPPORT`, `INVENTORY`, `ANALYST`, **`CAMPAIGN_MANAGER`**.

| Group | Permission code | Step-up | Own | Adm | Sal | Inv | Ana | Cam |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Orders | `seller.orders:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.orders:respond` |  | Y | Y | Y | . | . | . |
|  | `seller.order_ready:update` |  | Y | Y | Y | Y | . | . |
|  | `seller.orders:reissue_instructions` | YES | Y | Y | . | . | . | . |
| Payment | `seller.payment_evidence:read` |  | Y | Y | Y | . | . | . |
|  | `seller.payment:confirm` |  | Y | Y | Y | . | . | . |
|  | `seller.refunds:report` |  | Y | Y | Y | . | . | . |
| Catalogue | `seller.products:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.products:write` |  | Y | Y | . | Y | . | . |
|  | `seller.products:publish` |  | Y | Y | . | Y | . | . |
|  | `seller.media:write` |  | Y | Y | . | Y | . | Y |
| Stock | `seller.stock:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.stock:write` |  | Y | Y | . | Y | . | . |
|  | `seller.stock:bulk_write` |  | Y | Y | . | Y | . | . |
| Store | `seller.store:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.store:write` |  | Y | Y | . | . | . | . |
|  | `seller.availability:write` |  | Y | Y | . | . | . | . |
|  | `seller.fulfilment:write` |  | Y | Y | . | Y | . | . |
| Messaging | `seller.messages:read` |  | Y | Y | Y | . | . | . |
|  | `seller.messages:send` |  | Y | Y | Y | . | . | . |
| Handoff | `seller.handoff:read` |  | Y | Y | Y | Y | . | . |
|  | `seller.handoff:custody_transfer` |  | Y | Y | Y | Y | . | . |
|  | `seller.couriers:manage` |  | Y | Y | Y | . | . | . |
| Feedback | `seller.reviews:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.claims:read` |  | Y | Y | Y | . | Y | . |
|  | `seller.claims:respond` |  | Y | Y | Y | . | . | . |
| Analytics | `seller.analytics.basic:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.analytics.full:read` |  | Y | Y | . | . | Y | Y |
|  | `seller.analytics:export` |  | Y | Y | . | . | Y | . |
| Notifications | `seller.notifications:read` |  | Y | Y | Y | Y | Y | Y |
|  | `seller.notifications.preferences:write` |  | Y | Y | . | . | . | . |
| Automation | `seller.chatbot:configure` |  | Y | Y | . | . | . | Y |
|  | `seller.chatbot.flows:write` |  | Y | Y | . | . | . | Y |
|  | `seller.broadcasts:send` |  | Y | Y | . | . | . | Y |
| Administrative | `seller.payout:read` |  | Y | Y | . | . | . | . |
|  | `seller.payout:update` | YES | Y | Y | . | . | . | . |
|  | `seller.staff:admin` | YES | Y | Y | . | . | . | . |
|  | `seller.ownership:transfer` | YES | Y | . | . | . | . | . |
|  | `seller.subscription:update` | YES | Y | Y | . | . | . | . |
|  | `seller.identity:manage` | YES | Y | Y | . | . | . | . |
|  | `seller.account:delete` | YES | Y | . | . | . | . | . |
|  | `seller.sessions:revoke_all` | YES | Y | Y | . | . | . | . |

**Per-role totals**, as a checksum against the seed:

| Role | Permissions |
|---|:-:|
| `OWNER` | **42** |
| `ADMIN` | **40** |
| `SALES_SUPPORT` | **19** |
| `INVENTORY` | **16** |
| `ANALYST` | **10** |
| `CAMPAIGN` | **12** |

> **R30 -- v2.3's "of which write" column is withdrawn.** It stated 27 and 25 for Owner and Admin; any consistent definition taken from the action segment gives 28 and 26, and **the difference is one code both roles hold being counted as a read.** The candidates are `sessions:revoke_all`, `payment:confirm`, `refunds:report`, `claims:respond`, `orders:respond` and `orders:reissue_instructions` -- six codes on which reasonable people differ about whether they write.
>
> **A statistic two careful readers compute differently is not a checksum**, and defining *write* precisely earns nothing here. The permission totals stay because they are countable without a definition. **`ANALYST` holds zero writes stays**, because it holds under every candidate definition and is the only claim in the row that carries an invariant.

### 16.2a The seed, as executable SQL

Generated from the same source as S16.2, so the two cannot disagree. **ASCII only, and no transcription step.**

```sql
-- ADU-AUTH-01 v2.3 SS16.2a -- generated, ASCII only.
-- 42 permissions, 139 grants. Role values are core.team_role literals.

INSERT INTO core.permission (code, surfaces, requires_step_up) VALUES
  ('seller.orders:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.orders:respond', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.order_ready:update', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.orders:reissue_instructions', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.payment_evidence:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.payment:confirm', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.refunds:report', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.products:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.products:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.products:publish', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.media:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.stock:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.stock:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.stock:bulk_write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.store:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.store:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.availability:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.fulfilment:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.messages:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.messages:send', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.handoff:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.handoff:custody_transfer', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.couriers:manage', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.reviews:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.claims:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.claims:respond', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.analytics.basic:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.analytics.full:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.analytics:export', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.notifications:read', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.notifications.preferences:write', ARRAY['MOBILE','CONSOLE']::core.session_audience[], false),
  ('seller.chatbot:configure', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.chatbot.flows:write', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.broadcasts:send', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.payout:read', ARRAY['CONSOLE']::core.session_audience[], false),
  ('seller.payout:update', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.staff:admin', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.ownership:transfer', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.subscription:update', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.identity:manage', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.account:delete', ARRAY['CONSOLE']::core.session_audience[], true),
  ('seller.sessions:revoke_all', ARRAY['CONSOLE']::core.session_audience[], true);

INSERT INTO core.role_permission (role, permission_code) VALUES
  ('OWNER', 'seller.orders:read'),
  ('ADMIN', 'seller.orders:read'),
  ('SALES_SUPPORT', 'seller.orders:read'),
  ('INVENTORY', 'seller.orders:read'),
  ('ANALYST', 'seller.orders:read'),
  ('CAMPAIGN_MANAGER', 'seller.orders:read'),
  ('OWNER', 'seller.orders:respond'),
  ('ADMIN', 'seller.orders:respond'),
  ('SALES_SUPPORT', 'seller.orders:respond'),
  ('OWNER', 'seller.order_ready:update'),
  ('ADMIN', 'seller.order_ready:update'),
  ('SALES_SUPPORT', 'seller.order_ready:update'),
  ('INVENTORY', 'seller.order_ready:update'),
  ('OWNER', 'seller.orders:reissue_instructions'),
  ('ADMIN', 'seller.orders:reissue_instructions'),
  ('OWNER', 'seller.payment_evidence:read'),
  ('ADMIN', 'seller.payment_evidence:read'),
  ('SALES_SUPPORT', 'seller.payment_evidence:read'),
  ('OWNER', 'seller.payment:confirm'),
  ('ADMIN', 'seller.payment:confirm'),
  ('SALES_SUPPORT', 'seller.payment:confirm'),
  ('OWNER', 'seller.refunds:report'),
  ('ADMIN', 'seller.refunds:report'),
  ('SALES_SUPPORT', 'seller.refunds:report'),
  ('OWNER', 'seller.products:read'),
  ('ADMIN', 'seller.products:read'),
  ('SALES_SUPPORT', 'seller.products:read'),
  ('INVENTORY', 'seller.products:read'),
  ('ANALYST', 'seller.products:read'),
  ('CAMPAIGN_MANAGER', 'seller.products:read'),
  ('OWNER', 'seller.products:write'),
  ('ADMIN', 'seller.products:write'),
  ('INVENTORY', 'seller.products:write'),
  ('OWNER', 'seller.products:publish'),
  ('ADMIN', 'seller.products:publish'),
  ('INVENTORY', 'seller.products:publish'),
  ('OWNER', 'seller.media:write'),
  ('ADMIN', 'seller.media:write'),
  ('INVENTORY', 'seller.media:write'),
  ('CAMPAIGN_MANAGER', 'seller.media:write'),
  ('OWNER', 'seller.stock:read'),
  ('ADMIN', 'seller.stock:read'),
  ('SALES_SUPPORT', 'seller.stock:read'),
  ('INVENTORY', 'seller.stock:read'),
  ('ANALYST', 'seller.stock:read'),
  ('CAMPAIGN_MANAGER', 'seller.stock:read'),
  ('OWNER', 'seller.stock:write'),
  ('ADMIN', 'seller.stock:write'),
  ('INVENTORY', 'seller.stock:write'),
  ('OWNER', 'seller.stock:bulk_write'),
  ('ADMIN', 'seller.stock:bulk_write'),
  ('INVENTORY', 'seller.stock:bulk_write'),
  ('OWNER', 'seller.store:read'),
  ('ADMIN', 'seller.store:read'),
  ('SALES_SUPPORT', 'seller.store:read'),
  ('INVENTORY', 'seller.store:read'),
  ('ANALYST', 'seller.store:read'),
  ('CAMPAIGN_MANAGER', 'seller.store:read'),
  ('OWNER', 'seller.store:write'),
  ('ADMIN', 'seller.store:write'),
  ('OWNER', 'seller.availability:write'),
  ('ADMIN', 'seller.availability:write'),
  ('OWNER', 'seller.fulfilment:write'),
  ('ADMIN', 'seller.fulfilment:write'),
  ('INVENTORY', 'seller.fulfilment:write'),
  ('OWNER', 'seller.messages:read'),
  ('ADMIN', 'seller.messages:read'),
  ('SALES_SUPPORT', 'seller.messages:read'),
  ('OWNER', 'seller.messages:send'),
  ('ADMIN', 'seller.messages:send'),
  ('SALES_SUPPORT', 'seller.messages:send'),
  ('OWNER', 'seller.handoff:read'),
  ('ADMIN', 'seller.handoff:read'),
  ('SALES_SUPPORT', 'seller.handoff:read'),
  ('INVENTORY', 'seller.handoff:read'),
  ('OWNER', 'seller.handoff:custody_transfer'),
  ('ADMIN', 'seller.handoff:custody_transfer'),
  ('SALES_SUPPORT', 'seller.handoff:custody_transfer'),
  ('INVENTORY', 'seller.handoff:custody_transfer'),
  ('OWNER', 'seller.couriers:manage'),
  ('ADMIN', 'seller.couriers:manage'),
  ('SALES_SUPPORT', 'seller.couriers:manage'),
  ('OWNER', 'seller.reviews:read'),
  ('ADMIN', 'seller.reviews:read'),
  ('SALES_SUPPORT', 'seller.reviews:read'),
  ('INVENTORY', 'seller.reviews:read'),
  ('ANALYST', 'seller.reviews:read'),
  ('CAMPAIGN_MANAGER', 'seller.reviews:read'),
  ('OWNER', 'seller.claims:read'),
  ('ADMIN', 'seller.claims:read'),
  ('SALES_SUPPORT', 'seller.claims:read'),
  ('ANALYST', 'seller.claims:read'),
  ('OWNER', 'seller.claims:respond'),
  ('ADMIN', 'seller.claims:respond'),
  ('SALES_SUPPORT', 'seller.claims:respond'),
  ('OWNER', 'seller.analytics.basic:read'),
  ('ADMIN', 'seller.analytics.basic:read'),
  ('SALES_SUPPORT', 'seller.analytics.basic:read'),
  ('INVENTORY', 'seller.analytics.basic:read'),
  ('ANALYST', 'seller.analytics.basic:read'),
  ('CAMPAIGN_MANAGER', 'seller.analytics.basic:read'),
  ('OWNER', 'seller.analytics.full:read'),
  ('ADMIN', 'seller.analytics.full:read'),
  ('ANALYST', 'seller.analytics.full:read'),
  ('CAMPAIGN_MANAGER', 'seller.analytics.full:read'),
  ('OWNER', 'seller.analytics:export'),
  ('ADMIN', 'seller.analytics:export'),
  ('ANALYST', 'seller.analytics:export'),
  ('OWNER', 'seller.notifications:read'),
  ('ADMIN', 'seller.notifications:read'),
  ('SALES_SUPPORT', 'seller.notifications:read'),
  ('INVENTORY', 'seller.notifications:read'),
  ('ANALYST', 'seller.notifications:read'),
  ('CAMPAIGN_MANAGER', 'seller.notifications:read'),
  ('OWNER', 'seller.notifications.preferences:write'),
  ('ADMIN', 'seller.notifications.preferences:write'),
  ('OWNER', 'seller.chatbot:configure'),
  ('ADMIN', 'seller.chatbot:configure'),
  ('CAMPAIGN_MANAGER', 'seller.chatbot:configure'),
  ('OWNER', 'seller.chatbot.flows:write'),
  ('ADMIN', 'seller.chatbot.flows:write'),
  ('CAMPAIGN_MANAGER', 'seller.chatbot.flows:write'),
  ('OWNER', 'seller.broadcasts:send'),
  ('ADMIN', 'seller.broadcasts:send'),
  ('CAMPAIGN_MANAGER', 'seller.broadcasts:send'),
  ('OWNER', 'seller.payout:read'),
  ('ADMIN', 'seller.payout:read'),
  ('OWNER', 'seller.payout:update'),
  ('ADMIN', 'seller.payout:update'),
  ('OWNER', 'seller.staff:admin'),
  ('ADMIN', 'seller.staff:admin'),
  ('OWNER', 'seller.ownership:transfer'),
  ('OWNER', 'seller.subscription:update'),
  ('ADMIN', 'seller.subscription:update'),
  ('OWNER', 'seller.identity:manage'),
  ('ADMIN', 'seller.identity:manage'),
  ('OWNER', 'seller.account:delete'),
  ('OWNER', 'seller.sessions:revoke_all'),
  ('ADMIN', 'seller.sessions:revoke_all');
```

> **The role literals are `core.team_role` values, not the display names used in S16.2's column headings.** The sixth role is **`CAMPAIGN_MANAGER`** in the enum and *Campaign* in prose. A seed written from the headings fails on the cast -- which is the second reason S16.2a exists: a table for reading and SQL for running, generated together.

**Verify with the checksums of S16.2, not by reading the block.** 42 permission rows, 139 grant rows, 8 with `requires_step_up`, and per-role totals 42  -  40  -  19  -  16  -  10  -  12 with `ANALYST` at zero writes.

> **The `surfaces` values are derived from S15.1's `M` markings.** Twelve permissions are reachable from the Seller Companion and carry `{MOBILE, CONSOLE}`; the other thirty are `{CONSOLE}`. **Every step-up permission is `{CONSOLE}`**, which ADU-DB-01 S6.9a's total constraint enforces independently -- so a wrong array here fails at insert rather than at runtime.

> **INVARIANT -- the Owner holds all 42 and is the only role that does.** Admin lacks exactly two: `seller.account:delete` (S16.9) and `seller.ownership:transfer`.

> **INVARIANT -- Analyst holds no write permission of any kind.** Not one, no exception, and the count above is the assertion. A single write on this row makes the role something else.

### 16.3 The eight step-up permissions -- canonical

`seller.payout:update`  -  `seller.orders:reissue_instructions`  -  `seller.staff:admin`  -  `seller.subscription:update`  -  `seller.account:delete`  -  `seller.sessions:revoke_all`  -  `seller.identity:manage`  -  `seller.ownership:transfer`

> **This list governs.** ADU-DB-01 v1.8's `step_up_is_web_only` `CHECK` lists six, three of the eight are missing from it, and one code in it does not exist. **ADU-DB-01 v1.9 rebuilds the constraint and Appendix C's reviewer query from this section**, and the seed is verified against it rather than against the constraint.

**Every one carries `surfaces = '{CONSOLE}'`.** Seven are held by Owner and Admin; **`seller.ownership:transfer` and `seller.account:delete` are Owner alone.**

### 16.4 Two departures from v2.1's group matrix, each deliberate

Recorded so that a reviewer holding both versions knows which differences are decisions and which would be errors.

**1. Campaign loses the order-mutation grants.** v2.1 gave Campaign `o` on *"Orders respond, ready"*. **v2.2 grants it neither.** Cancelling an order line is what *Can't Fulfil* does, and every cancellation feeds the seller's published cancellation rate -- a trust-ladder input. A marketing role that can move a trust signal is a hole, and the group matrix's `o` there reads more like an unconsidered cell than a decision. Campaign keeps `orders:read`.

**2. Inventory gains handoff.** v2.1 gave Inventory `--` on *"Handoff, couriers"*. **v2.2 grants `handoff:read` and `handoff:custody_transfer`**, withholding `couriers:manage`. Inventory holds `order_ready:update` -- the person who marks an order ready is the person standing at the door when the courier arrives, and a role that can declare goods ready but cannot hand them over is incoherent. Managing the courier roster stays administrative.

**Two more resolutions worth naming, both following v2.1's own reasoning rather than departing from it:**

- **`seller.fulfilment:write` goes to Inventory**, resolving the `o` on *"Store write, availability"*. S15.1 already said why: *"an Inventory role that can declare how goods reach buyers without also being able to rename the store is a distinction Business tier will want."* Inventory does **not** get `store:write` or `availability:write`.
- **`seller.orders:reissue_instructions` is Owner and Admin only**, though Sales/Support does all other payment work. Reissuing instructions **re-transmits the payout details**, and S10.4's principle applies exactly: the people who touch money every day are the ones who must not be able to redirect it.

### 16.6 Encoding -- a rule this document set now follows

> **INVARIANT -- data that is load-bearing is ASCII.** A cell whose *value* is the data -- a grant, a flag, a state -- uses characters below U+007F. Decorative glyphs stay in prose, where losing one costs a reader nothing.

**The reasoning is not aesthetic.** v2.2's matrix used `Y` and `--`, which differ only in their second and third UTF-8 bytes. When those bytes were lost the two collapsed into one character, and **252 cells became indistinguishable while still looking like a well-formed table.** That is the worst class of corruption: it does not fail loudly, and a reader who did not know the original would seed 252 grants with confidence.

**Where a value must survive transit, give it twice in different forms.** S16.2 is a table for a human; S16.2a is SQL for a machine; both come from one generator. Corruption that damages one is visible against the other.

> **INVARIANT -- a value given in two forms is not verified until a comparator runs.** Two forms that nothing compares are two chances to be wrong, not a check. **`pnpm verify:permission-doc` compares all 252 cells of S16.2 against S16.2a in both directions and is a standing CI gate** alongside the Appendix C checks.
>
> **v2.2's collapsed matrix still parsed as a well-formed table** -- which is the whole argument. Corruption that leaves the structure intact is invisible to every check except one that reads the values and compares them to something.

### 16.5 The constraints this matrix satisfies

- **S10.4: only Owner/Admin may view or change payout details** -- *"no other role, including Sales/Support who confirm payments daily."* The people who touch money every day are the ones who must not be able to redirect it.
- **S16.9: only the Owner may delete.** No Admin, no other role.
- **S16.2: no role except Owner/Admin may change billing, delete the seller, or alter team membership.**
- **Analyst is read-only, without exception.** Not one write in the row.

> [!] **`seller.ownership:transfer` is new here, and it closes a hole.** S16.2 lets an Admin alter team membership. Combined with the one-Owner invariant, an Admin could demote the Owner and promote themselves -- **acquiring the only two powers Admin lacks, from a role that was never meant to have them.**
>
> Ownership transfer is therefore its own permission, granted to the Owner alone, with step-up. **INVARIANT -- `seller.staff:admin` never permits changing the Owner.**

> [!] **Admin is very nearly Owner, and that should be a deliberate choice.** Admin can change payout, manage staff, change the subscription and manage identity. The only differences are deletion and ownership. **For a shop with three staff that is probably too much** -- worth reconsidering when Business tier is designed, per X3's ruling that the commercial model is being rebuilt.

**At MVP only `OWNER` is reachable.** Business tier is post-MVP (X2, X3), so team members do not exist yet. **The matrix ships anyway** -- the enum values are in the schema, the grants are seeded, and nothing is reachable. Adding roles later to a system that assumed one is far harder than leaving five unused.

---

## 17. Surface scoping

**INVARIANT -- surface is a property of the permission, not of the role** (ADU-DB-01 S6.9a).

```sql
CREATE TABLE core.permission (
  code     text PRIMARY KEY,
  surfaces core.session_audience[] NOT NULL
);
```

`fn_has_permission(account, seller, permission, audience)` checks the role grant **and** the surface. A mobile session presenting at a payout change receives 403 from the function, before any endpoint logic runs.

**INVARIANT -- every step-up permission in S15.1 carries `surfaces = '{CONSOLE}'`**, enforced by a `CHECK` rather than a convention, because this is the boundary an agent widens while making the Companion "more useful."

[!] **v2.0 stated this `CHECK` with the value `CONSOLE` while ADU-DB-01 v1.6's DDL said `ARRAY['SELLER_WEB']`** -- two documents disagreeing inside the one constraint that guards the payout boundary. **v2.0 was right**; ADU-DB-01 v1.7 now matches it, and S12's collapse is what made the two reconcilable rather than merely renamed.

**Eight step-up permissions. S16.3 is the canonical list** and this section defers to it.

[!] **The mechanism described here does not currently hold, and v2.2 exists partly to say so.** ADU-DB-01 v1.8's `step_up_is_web_only` `CHECK` names six codes, omits three of the eight, and includes one that does not exist -- and because it is written `code NOT IN (...) OR surfaces = '{CONSOLE}'`, **an omitted code is unconstrained rather than caught.** The Appendix C reviewer query written to detect that does not compile against the table it queries. **ADU-DB-01 v1.9 rebuilds both from S16.3.** Until it ships, the seed is verified against S16.3 by test, not by constraint.

**Why in the database rather than the API.** The permission function is the first statement of every seller-scoped writing function (ADU-API-01 S13). A surface check in a NestJS guard is a decorator someone forgets on the seventh endpoint; a surface check inside the function that performs the write cannot be bypassed by a second endpoint reaching the same function.

---

## 18. Entitlement is not permission

`billing.fn_effective_limit(seller_id, capability)` resolves **the intersection of tier entitlement and trust level** (ADU-PRD-01 S16.5).

**INVARIANT -- no table carries a `has_chatbot` or `can_broadcast` boolean.** Entitlements resolve at read time. A stored boolean drifts from the subscription that justified it.

**Two inputs, both of which move without anyone touching a role:**

- **Tier** -- what the seller pays for. Changes on upgrade, downgrade, lapse.
- **Trust level** -- what the seller has earned. `New` caps published product count and transaction value; `Trusted` is required for broadcasts *in addition to* Pro tier.

**Trust level is therefore an authorization input, and it is computed automatically with no human in the loop** -- which is exactly what ADU-DPIA-01 S7.4 identifies as automated decision-making with significant effect. **The review path that finding requires is an authorization concern**, not only a privacy one: it is the route by which a person contests a machine-made restriction on their business.

### 18.1 The error must not name a tier on mobile

**INVARIANT -- a `TIER_LIMIT_REACHED` response to a `MOBILE` session names the capability and where it is configured, never the tier and never a route to change one.**

`slots: { capability: "custom_flows", configured_in: "console" }` -- rendered as *"Custom flows are configured in the Seller Console."*

Not a design preference. ADU-ARCH-01 S4: any price, tier name or link to a billing surface inside the app is a call to action directing a customer to an external purchasing mechanism, which is a documented App Store rejection. **The error contract is where that leaks if it leaks** -- which is why S7 of ADU-API-01 returns `message_key` and `slots` rather than server-composed prose.

---

## 19. Scope -- the strongest authorization control, and it is not a check

**Most authorization failures in a marketplace are not "you lack the role." They are "that is not yours."** Seller A requesting Seller B's order; a buyer requesting another buyer's payment instructions; a courier reading an order they were never assigned.

**Adulis enforces these with foreign keys and row-level security rather than with permission checks**, and that is materially stronger -- a check can be forgotten by a new endpoint; a constraint cannot.

| Rule | Mechanism |
|---|---|
| A cart holds one seller's items | `FOREIGN KEY (variant_id, seller_id) REFERENCES product_variant (id, seller_id)` |
| Only the order's buyer may scan its handoff | `FOREIGN KEY (order_id, scanned_by_account_id) REFERENCES "order" (id, buyer_account_id)` |
| Only the order's buyer may review it | Same shape, on `review` |
| A claim's line belongs to the claim's order | `FOREIGN KEY (order_id, reservation_id) REFERENCES reservation (order_id, id)` |
| A courier reads only currently assigned orders | **Row-level security**, `ended_at IS NULL` |
| Payment instructions go only to the buyer on a payable order | Verified inside `financial.render_payment_instructions` before decryption |

**INVARIANT -- a scope failure returns 404, never 403.** A 403 confirms the object exists, which turns any endpoint taking an identifier into an enumeration oracle. In this product an order reveals a transaction and a seller reveals a business. ADU-API-01 S7 already specifies *"404 not found or not visible to this caller"* -- this is the reasoning behind it.

---

## 20. Operator authorization -- the gap

### 20.1 There is no operator model at all

Moderation (S18), claim review (S14), identity verification (S13.1) and account recovery (S6.6) all describe an operator making decisions. **Nothing defines what an operator is.**

No operator table, no operator roles, no grants, and no distinction between *"can review claims"* and *"can read identity attestations."* In practice the operator is a founder, and the founder can do everything because nothing constrains anything.

**That is acceptable at three people and it is not acceptable in the audit log**, which is the part that matters -- ADU-DPIA-01 has to answer *who can read a bank record*, and the current answer is *anyone with a database connection*.

> **Adopted in v2.1 -- `core.operator_grant` exists** (ADU-DB-01 v1.7 S6.11): `account_id`, `role`, `granted_by_account_id`, `granted_at`, `revoked_at`, `revoked_by_account_id`, `reason`. **Append-only** -- revocation sets `revoked_at` and never deletes the row, because *who could read a bank record last March* is a question the audit logs cannot answer alone.
>
> **A founder holding all five is fine. A founder holding all five because none exist is not** -- the difference is that the first is a recorded decision and the second is an absence, and only the first survives the question *"who authorised that?"*

[!] **Role names reconciled.** v2.0 proposed `MODERATOR`  -  `CLAIM_REVIEWER`  -  `VERIFIER`  -  `SUPPORT`  -  `PLATFORM_ADMIN`; ADU-DB-01 v1.7 seeds `SUPPORT`  -  `MODERATOR`  -  `CLAIM_REVIEWER`  -  `IDENTITY_REVIEWER`  -  `ADMIN`. **The database governs**, and S15.2's operator permission codes bind to those five names. `IDENTITY_REVIEWER` is the clearer name -- `VERIFIER` reads as though it verifies identities rather than reviews attestations, and this role does the second.

**What is closed and what is not.** The **model** is closed: an operator is an account with a grant, which is what makes S20.2's derived role possible at all -- R5 now has something to derive *from*. The **surface** is not: ADU-CON-01 R6 puts the operator console on a separate deployment and its own origin, out of scope for the seller console and for this document. An operator has no seller relationship, so mixing operator grants into a seller-scoped surface gives the scope model two shapes in one codebase and widens the blast radius of a console compromise from one seller's payout to every seller's identity attestations.

[!] **The DPIA's open item does not close with the table.** ADU-DPIA-01 S7.4 R11 requires a human-review route for the trust ladder -- a person contesting a machine-made restriction on their livelihood needs someone with standing to hear it. `core.operator_grant` gives that person a role. **Nothing yet gives them a screen or a seller a way to ask.**

### 20.2 F3 -- the audit log records a role the caller declares about themselves -- **CLOSED in v2.1**

**A defect in ADU-DB-01, which I wrote. ADU-DB-01 v1.7 S7.3 and S13.3 have adopted the fix below in full**, and the `p_actor_role` parameter no longer exists on either function. This section is retained because the reasoning is the reason the fix holds, and a future agent restoring the parameter for convenience should find the argument here rather than rediscover it.

Through v1.6, the read functions guarding both isolated boundaries took the actor's role as a **caller-supplied parameter**:

```sql
verification.read_attestation(p_person_id, p_actor, p_actor_role text, p_reason)
financial.read_payment_evidence(p_evidence_id, p_actor, p_actor_role text, p_reason)
```

`p_actor_role` is written straight into the access log. **An operator reading a bank record therefore declares their own role into the log whose entire purpose is to hold them to account.** A compromised or careless caller writes whatever it likes, and the log looks correct.

The design intent was right -- ADU-PRD-01 S10.3 is emphatic that reading and logging must be one statement, and they are. **The parameter undoes it**, because the most contested field in the row is the one the reader supplies.

> **Fix -- derive the role, never accept it:**
>
> ```sql
> CREATE FUNCTION financial.read_payment_evidence(
>   p_evidence_id uuid, p_actor uuid, p_reason text DEFAULT NULL
> ) RETURNS financial.payment_evidence
> LANGUAGE plpgsql SECURITY DEFINER AS $$
> DECLARE v_role text;
> BEGIN
>   -- Derived from actual grants, never supplied:
>   --   an operator grant, or the seller relationship on this evidence's order.
>   -- No grant, no read.
>   ...
> END $$;
> ```
>
> **INVARIANT -- `actor_role` in either access log is derived server-side from the caller's actual grants and is never a function parameter.**
>
> This also closes a second hole quietly: with no grant lookup, the function **authorises nothing.** It logs a read it was going to perform anyway. Deriving the role makes the same query the authorization check -- **no grant, no row.**

**Landed in ADU-DB-01 v1.7.** Both functions derive the role -- from `core.operator_grant` for an operator, from the seller relationship on the order for a seller -- and raise `insufficient_privilege` where neither applies. ADU-API-01 v1.4 S13's mapping carries the new signatures.

**One consequence worth stating for whoever reads the access log first.** A seller reading evidence on their own order is a legitimate reader and is logged identically to an operator, with `reason` nullable because seller access requires no justification. And ADU-ARCH-01 S3.3 predicts **fewer evidence reads than payment confirmations** -- the seller's bank app is the real check -- so a low read-to-confirm ratio is the expected shape, not a sign the logging is broken.

### 20.3 What operators may never do

**INVARIANT -- no operator may act as a seller or a buyer.** No impersonation, no "log in as", no session assumption. Support reads through the same logged functions, with a reason, under their own identity.

Impersonation is the single most requested support feature and the one that destroys an audit trail, because every subsequent action is attributed to the person it was taken against. If a support case cannot be resolved by reading, it is resolved by asking the seller -- not by becoming them.

**INVARIANT -- no operator may set a trust level.** S5.1 permits a `MODERATION`-sourced level event, and only with a `moderation_event_id` -- so the change is logged with a reason or it is a constraint violation.

**INVARIANT -- no operator may read payout details in the clear.** The single decryption path in `financial.render_payment_instructions` verifies the caller is the buyer on a payable order. **An operator is neither**, and there is no second path.

**Break-glass.** No emergency access path exists today, and **undefined emergency access is worse than defined emergency access** -- it becomes a shared credential nobody logs. An `ADMIN` grant, time-boxed, self-expiring, alerting every other operator on use, is the shape. Not urgent at three founders; **required before the first non-founder operator.**

---

## 21. Failure semantics

| Situation | Status | Code |
|---|---|---|
| No credential, or invalid | 401 | `SESSION_EXPIRED`  -  `SESSION_REVOKED` |
| Authenticated, wrong surface | **403** | `PERMISSION_DENIED` |
| Authenticated, role lacks permission | **403** | `PERMISSION_DENIED` |
| Owner-only action attempted by Admin | 403 | `OWNER_ONLY` |
| Step-up missing or stale | 403 | `STEP_UP_REQUIRED`  -  `STEP_UP_EXPIRED` |
| Tier or level does not include it | **409** | `TIER_LIMIT_REACHED`  -  `LEVEL_LIMIT_REACHED` |
| **Object is not theirs** | **404** | Not found |
| Seller suspended or closing | 409 | `SELLER_UNAVAILABLE` |

**INVARIANT -- 403 never distinguishes "you lack the role" from "you lack the surface."** Both are `PERMISSION_DENIED` with the same body. Telling a caller *which* gate stopped them tells an attacker which one to work on.

**INVARIANT -- a scope failure is 404 and carries no detail.** No `items[]`, no slots naming the object.

---

# PART III -- COMMON

## 22. Rate limits

Consolidated. Phone-keyed limits use a **hash**, never the number -- the limit must work before an account exists, which is exactly when the raw number would otherwise sit in a counter table with no retention story. Same mechanism as `core.phone_reuse_block`.

| Endpoint | Limit | Subject |
|---|---|---|
| `otp/request` | 3 / hour | `PHONE_HASH` |
| `otp/request` | 10 / hour | `IP_HASH` |
| `otp/resend` | 3 / 15 min, backoff 30s -> 60s -> 120s | `PHONE_HASH` |
| `otp/verify` | 5 attempts per challenge, then the challenge dies | Challenge |
| **Phone lockout** | 3 dead challenges in an hour -> **1 hour block** | `PHONE_HASH` |
| `step-up/request` | 5 / hour | `ACCOUNT` |
| `auth/recovery` | 2 / day | `PHONE_HASH` |
| `deletion/otp/request` | 3 / hour | `PHONE_HASH` |

**v2.1 -- R17 relieves the pressure on the first row, and that was part of its point.** ADU-CON-02-A1 found the 3-per-hour phone limit beginning to lock out honest sellers at around fifteen hundred sellers, because a 30-minute idle timeout made ordinary console use look like repeated sign-in attempts. With remembered devices the console generates roughly one sixth the OTP requests, so the limit constrains attackers again rather than working sellers. **The limit itself does not change** -- the behaviour that was hitting it does.

**INVARIANT -- a rate-limit rejection never reveals whether the number belongs to an account.** `RATE_LIMITED` with `Retry-After`, identical for a known and an unknown number. The same rule governs verify: **`OTP_INVALID` does not distinguish a wrong code from an unknown phone.** Otherwise the sign-in form is an account-enumeration oracle, and in this product an account is a business.

---

## 23. Events

From ADU-PRD-01 S20: `session_created`  -  `session_revoked`  -  `new_device_signin`  -  `step_up_challenged`  -  `account_recovery_requested`  -  `account_recovery_resolved`  -  `notification_permission_result`.

**Five to add**, and the first two are the S6 instrument:

`otp_requested`  -  **`otp_delivery_confirmed`**  -  `otp_verify_failed`  -  `otp_superseded`  -  `age_declaration_recorded`

**INVARIANT -- the endpoint emits the event, never the client.** An event a crashed client failed to send is missing exactly when it mattered.

---

## 24. Test coverage

- One live challenge per (phone, purpose); a new issue kills the previous
- A dead challenge stays dead across a resend
- Constant-time comparison; no timing signal on a wrong code
- Verify does not distinguish wrong code from unknown phone
- Rate-limit response is identical for known and unknown numbers
- **`ACCOUNT_DELETION` OTP cannot mint a session** -- enforced in the database
- Deletion ticket rejected by every non-deletion endpoint
- Step-up bound to action **and** target; cross-use rejected
- Step-up expires at 5 minutes and is single-use
- **All six S6.5 actions reject a `MOBILE` audience at the permission function**
- Revocation takes effect on the next request, not at refresh
- Recovery revokes every session and sets `payout_locked_until` **in one transaction**
- **New-device sign-in on a seller account pushes to existing devices and sets the payout lock** (S7.2)
- Payout change blocked during both cooling periods
- Concurrent session cap enforced per audience
- Cart binds to the account created at first reserve, in the same transaction
- Mode switching issues no new credential

**The role matrix -- new in v2.2**

- **All 139 grants of S16.2 assert true**, and **every one of the 113 non-grants asserts false.** A matrix test that checks only positives passes on a seed that grants everything to everyone.
- Per-role totals match S16.2's checksum: 42  -  40  -  19  -  16  -  10  -  12.
- **`ANALYST` returns false for every write permission** -- asserted by iterating the catalogue, not by listing writes by hand, so a write added later is caught without anyone remembering to add a case.
- `OWNER` returns true for all 42; `ADMIN` returns false for exactly `seller.account:delete` and `seller.ownership:transfer`.
- **Each of the eight S16.3 permissions returns false for a `MOBILE` audience, for every role including `OWNER`.**
- `core.permission` holds exactly 42 rows and `core.role_permission` exactly 139 -- compared against a fixture, never against a query over the seed itself.
- **The fixture is derived from S16.2a's SQL, not retyped from S16.2's table.** A test that reads the same table a human transcribed proves only that both made the same mistake.

**Remembered devices -- R17**

- A remembered console session expires at the 7-day absolute and the 8-hour idle bound; an unremembered one at 12 hours and 30 minutes
- **A remembered session does not satisfy any step-up.** All eight S9.1 actions demand a fresh OTP on a six-day-old remembered session exactly as on a fresh one
- Revoking a remembered device **ends every session created from it, in one transaction**
- The device cookie alone authenticates nothing -- presented without a session cookie it yields 401, not a session
- A remembered device is still a **new** device the first time it is seen: the S7.2 notification fires and the payout lock is set
- `__Host-adulis_device` carries `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` and **no `Domain`**
- The stored value is a hash; the raw token appears in no table and no log

**Authorization**

- Every permission in S15 exists in `core.permission`; every `role_permission` row references one
- The S16 matrix is reproduced exactly by `fn_has_permission` for all six roles, **including every negative case**
- **Every step-up permission carries `surfaces = '{CONSOLE}'`** -- enforced by `CHECK`
- All eight step-up actions reject a `MOBILE` audience at the permission function
- `seller.staff:admin` cannot change the Owner; `seller.ownership:transfer` is Owner-only and requires step-up
- Analyst holds no write permission of any kind
- Sales/Support cannot read or change payout details
- A tier limit returns `TIER_LIMIT_REACHED`, never `PERMISSION_DENIED` -- and vice versa
- **A tier-limit response to `MOBILE` contains no tier name, price or billing URL**
- Cross-seller and cross-buyer access returns **404**, never 403
- 403 is identical for a role failure and a surface failure
- **`actor_role` in both access logs is derived, and the functions take no role parameter** (S20.2)
- A caller with no operator grant and no seller relationship receives no evidence row
- No endpoint permits operator impersonation of a seller or buyer

---

## 25. Changes required elsewhere

**v2.1 status.** Four of the six rows below have landed. What remains is recorded as debt, not as a plan.

| Document | Change | Status |
|---|---|---|
| **ADU-API-01 -> v1.4** | S5 records two credential presentations -- cookie for `CONSOLE`, bearer for `MOBILE` (S5.1)  -  S13's function mapping updated for the derived-role signatures (S20.2) | **[PASS] Landed** |
| **ADU-DB-01 -> v1.7** | `timing_config` gains `otp_ttl`, `otp_max_attempts`, `step_up_freshness`, `new_device_payout_lock`, session lifetimes and idle timeouts  -  `account` gains `age_declared_over_18` and `age_declared_at`  -  **`session_audience` collapses to `MOBILE` and `CONSOLE`** (S12, accepted)  -  **`core.permission` seeded with the full S15 catalogue and `core.role_permission` with the S16 matrix**  -  **new table `core.operator_grant`** (S20.1)  -  **both boundary functions derive the role** (S20.2)  -  `seller.ownership:transfer`  -  **`core.account_device` and the four console lifetime columns** (S8.1a) | **[PASS] Landed** -- except the S15/S16 seed, which is written into migration 5 and unverified until it runs |
| **ADU-PROJ-01 -> v9.1** | S8.2 gains recovery review with a response target  -  S12 gains **OTP delivery rate** as a release gate  -  S13.1 records the SIM-swap residual (S7.3)  -  **S10's cost model splits infrastructure from SMS** (S8.1a) | [OPEN] Outstanding |
| **ADU-PRD-01 -> v8.6** | S6.6 extends the payout lock to new-device sign-in (S7.2)  -  S6.4's new-device notification goes push-first  -  S16.7's adapter requirement extends to the SMS gateway  -  **S16.2 gains the role matrix** (S16)  -  **S16.2 gains ownership transfer as distinct from staff administration**  -  **the ownership-transfer product rules**, which exist in no document (below) | [OPEN] Outstanding |
| **ADU-DPIA-01 -> v1.1** | R15 closes on S13  -  age declaration enters the S4 inventory  -  **R6's law-enforcement disclosure gains an operator role** (S20.1)  -  **S7.4's automated-decision review path is an authorization concern** (S18)  -  **remembered-device retention** and the SMS processor pair enter the inventory | [OPEN] Outstanding |
| **ADU-SEC-01 -> v1.1** | S4 records the second `__Host-adulis_device` cookie (S8.1a) | [OPEN] Outstanding |

[!] **What ADU-DB-01 v1.9 owes this document.** The `step_up_is_web_only` `CHECK` rebuilt against S16.3's eight; Appendix C's reviewer query rewritten against `code` and the real step-up source; `core.role_permission` seeded with S16.2's 139 rows; and the per-role totals available as a checksum query. Until then Tier 1 cannot seed, which is why v2.2 was written before v1.9.

[!] **One gap this document opened and cannot close.** v2.0 added `seller.ownership:transfer` as a permission; ADU-API-01 v1.4 gives it an endpoint and ADU-DB-01 v1.7 gives it a function. **No document says what ownership transfer means as a product** -- who may receive a store, what notice the outgoing owner gets, whether they retain anything, what happens to an in-flight payout change or an open claim. The mechanism exists and the policy does not, and the mechanism must not ship first. **ADU-PRD-01 v8.6 owes it.**


---

*Binding specification for authentication and authorization, v2.4 -- the same 42 permissions and 139 grants. It withdraws a checksum column that two readers computed differently, requires that a value given twice be compared by something rather than merely given twice, and adds a fifth authorization gate that was missing rather than unnamed: a suspended team member kept every permission until their session expired, which R17 had quietly stretched to seven days. From v2.3: the same 42 permissions and 139 grants as v2.2, in an encoding that survives being sent. v2.2's matrix used two three-byte glyphs that collapsed into one another in transit, making granted and not-granted indistinguishable across 252 cells while the table still looked well-formed; S16.2 is now ASCII, S16.2a is the seed as executable SQL, and S16.6 makes the rule general. From v2.2: S16 is now a code-level matrix -- 42 permissions, 6 roles, 139 grants -- because the group matrix it replaced could not be seeded and an agent was right to refuse to invent the mapping. Two departures from the group version are recorded with their reasons: Campaign loses order mutation, because a marketing role that can move the cancellation rate can move a trust signal; and Inventory gains handoff, because a role that can mark goods ready and not hand them over is incoherent. S16.3 is the canonical step-up list, and ADU-DB-01 v1.8's constraint disagrees with it in three places -- that constraint, not this list, is the thing that is wrong. From v2.1: **F3 is closed**: both isolated boundaries now derive the actor's role from actual grants, which turned a logging function into an authorising one. **S12 is accepted**: two audiences, and the courier's isolation is on the table rather than the session. **S20.1 is structurally closed**: an operator is an account with a grant, which is what made F3's fix possible at all. And **R17 is the one new ruling** -- remembered console devices, taken from a cost model rather than a threat model, because S6 warned that session lifetime was partly an SMS-cost decision and ADU-CON-02-A1 put the number on it. **F1 and F2 remain open and are not closed by anything here.** SMS is still the only way anyone signs in; R17 reduces the volume by roughly seventy percent and the dependence not at all. Passkeys are the recorded direction, and a measured delivery rate from Phase 0 is the missing evidence.*
