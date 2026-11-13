# ADU-MOB-01 -- Buyer Mode: Mobile App System Design, Build and Operations Guide

**Version:** 1.2  -  **Baseline date:** 6 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Supersedes:** ADU-MOB-01 v1.1
**Corrected by:** ADU-MOB-03 v1.0 F1  -  ADU-MOB-05 v1.0 F4, F5  -  ADU-MOB-06 v1.0 F6 (withdrawn -- S0.1)
**Status:** Binding architecture record **and the standing operating manual for the mobile workstream.**
**Scope:** **Buyer Mode only.** The Seller Companion is deliberately excluded -- S0.4.
**Certified against:** a back end complete to ADU-CON-02 v3.1 tier 8 and carried forward through T20 -- the schema, the worker, the request pipeline and the endpoint groups, with Phase D's six measured load tests. **No mobile code exists yet.**
**Drawn from:** ADU-MOB-AMD-01 v1.0  -  ADU-MOB-00 v1.1  -  **ADU-API-01 v1.11**  -  **ADU-AUTH-01 v2.8**  -  **ADU-DB-01 v1.19**  -  **ADU-REPO-01 v1.3**  -  ADU-RUL-04 v1.0  -  ADU-ARCH-01 v2.0  -  ADU-CON-02 v3.2  -  ADU-CON-02-A1 v1.0  -  ADU-CON-01 v1.0  -  ADU-PRD-01 v8.5 (v8.6 pending)  -  ADU-PD-01 v1.0  -  ADU-SEC-01 v1.0  -  ADU-DPIA-01 v1.0  -  ADU-WEB-01 v1.0  -  ADU-PROJ-01 v9.0  -  ADU-VAL-01 v1.2  -  ADU-00 v9.1
**Encoding:** ASCII.

> **This document restates no count.** Not a table count, not a path-key count, not a migration count. Each is cited to the document that owns it. **v1.0 said "124 contract path keys", and D-100 showed that is three quantities counted as one** -- 124 catalogue entries, 110 path keys, 129 operations -- which is the same failure that left "109 tables" in ADU-DB-01's S0 for three revisions. A number restated here is a number that goes stale here first.

---

## 0. What this document is, and how to read it

**This is the mobile equivalent of ADU-CON-02, and it carries ADU-CON-01's job as well.** The console got two documents -- an analysis that found what blocked the build, then a design written against the rulings. The buyer app gets one, because the analysis it needed was small enough to fold in: the back end is finished, the contract is published, and the findings that came out of reading it fill a section rather than a document. They are in S22.

Three parts, the same shape as ADU-CON-02. **Part A** -- the system: what Buyer Mode is, with which technologies, and why each one won including what lost. **Part B** -- building it: where the app lives, the environment, how the agent is instructed, the tiers and their gates. **Part C** -- running it: releases, over-the-air updates, the version floor, monitoring, the store relationship, and what it costs.

**Two rules about this document itself**, carried unchanged from ADU-CON-02 S0: (1) when the agent's output and this document disagree, **this document wins** -- the document is amended first, then the code, never the reverse; (2) **MVP means MVP** -- every choice is the smallest thing that satisfies the binding invariants, and where a bigger option exists it lost on purpose.

> **Plain-terms boxes** like this explain a concept from zero. Read them once; skip them after.

### 0.1 What changed

**v1.2 is a correction release. It adds nothing and removes one sentence.** Four documents written after v1.1 read it and found five defects; this is those five, applied.

| # | Change | S |
|---|---|---|
| **1** | **S3.4's Zustand list loses *"the scan-queue view model"*.** v1.1 deleted the queue in S9 and left this line naming it, **in the section an agent reads to decide what the client store contains** | 3.4 |
| **2** | **S18.1 gains grep gates 12, 13 and 14** from ADU-MOB-03 S8. WO-0 requires fourteen; this document listed eleven, and the other three lived in a document WO-0 also reads. **They are now in one table** | 18.1 |
| **3** | **S24 Q1 restated.** The domain blocks **Apple organization enrolment** as well as App Links -- Apple requires a work email on the organization's domain and a public website at it. It is the earliest item on the critical path, not a tier 3 item | 24 |
| **4** | **S24 Q2's D-U-N-S figure corrected.** *"1-4 weeks"* is wrong; **Apple states up to 7 business days** -- five with D&B, two for Apple to receive it, and expediting does not shorten it | 24 |
| **5** | **S23 stops duplicating the reissue register.** ADU-MOB-PLAN-01 S6 consolidates thirteen targets across the whole series; this section keeps only what this document itself owes | 23 |

> **One correction was proposed and is withdrawn.** ADU-MOB-06 F6 recorded that S18.1's fifth Maestro journey still read *"scan offline to synced"*. **It does not** -- v1.1 rewrote it to *"scan with the network down, retry with it restored, outcome rendered"*, and the finding was written against a memory of v1.0. **Recorded rather than quietly dropped**, on this document's own rule that the reason a finding was withdrawn is worth as much as the finding.

> [!] **Change 1 is the third instance of one defect, and the class is the point.** The same deletion left residue in ADU-MOB-01 S3.4, in ADU-MOB-01 S18.1's journey list (fixed in v1.1), and in **ADU-QA-01 S1's fourth premise, which still says the handoff scan is created offline** -- one of the four properties that entire handbook is built on.
>
> **ADU-MOB-AMD-01 anticipated over-deletion and got the opposite failure.** A withdrawn feature leaves residue in every document that ever depended on it, and an amendment set can only list the ones it knows about. **A `grep -i offline` across the whole corpus, not only the mobile documents, is an hour and it is owed** (ADU-MOB-PLAN-01 S5, class 4).

### 0.1.1 What changed in v1.1

**v1.0 was written against a document set four to seven versions behind. v1.1 is what catching up changed, plus one founder ruling that deletes the hardest feature in the app.**

| # | Change | S |
|---|---|---|
| **A** | **Offline is withdrawn in full** (ADU-MOB-AMD-01). S9 is replaced by *Connectivity*; **B11, B13 and B14 are withdrawn**; B25 and B26 are adopted | 9 |
| **B** | **The mobile session is 30 days ABSOLUTE, with no idle timeout.** v1.0 said *"sliding on activity"*; ADU-AUTH-01 v2.8 S19.1 says *"Mobile 30 days is absolute"* | 4.4 |
| **C** | **The OTP flow is rewritten.** Audience travels on the **request** and is stamped at challenge creation; **verify takes `challenge_id` and the age declaration, and rejects `audience`** (D-180) | 4.3 |
| **D** | **Device creation is one function behind two doors** (ADU-RUL-04 S1). **F5's ordering trap no longer exists rather than being documented** | 4.1 |
| **E** | **The age declaration has a write path and is built.** v1.0's tenth finding is closed | 4.2, 22 |
| **F** | **S17 is rewritten against ADU-REPO-01 v1.3**, which exists now and governs the tree, the four dependency rules and the three seams | 17 |
| **G** | **No count is restated anywhere in this document** | header |

### The one that deletes the most, and the trap inside the deletion

**Change A removes the offline scan queue, the batch drain, the six client actions, the persisted clock offset and the reinstall problem that had no achievable answer on Android.** It is the largest single simplification available to this workstream.

> [!] **The risk is not the deletion. It is the deletion going one file too far.** The persisted idempotency key for `POST /v1/orders` sits beside the queue and **is not part of it**: it defends against a process kill mid-request, which happens on a good connection. Removing it re-opens ADU-API-01's gap A2 by name -- *"a retry on a flaky connection creates a second order"* -- and produces a duplicate order, a duplicate stock decrement, and a buyer charged twice by their own bank. **S9.5 lists the five things that stay.**

### 0.2 The series

**ADU-MOB-00** build guidelines (v1.1)  ->  **ADU-MOB-01** system design (this)  ->  **ADU-MOB-02** content architecture, the screen-by-screen equivalent of ADU-CON-03  ->  **ADU-MOB-03** design system and component inventory  ->  **ADU-MOB-04** wireframe generation brief  ->  build, against **ADU-MOB-WO-01** onwards  ->  **ADU-MOB-05** store submission and compliance dossier  ->  **ADU-MOB-06** security, QA and test specification  ->  **ADU-MOB-07** release and operations. The register that tracks them is **ADU-MOB-PLAN-01**.

**The Seller Companion is ADU-CMP-01.** Its **v0.1 scoping record is issued** -- the seam, the permission model and the In-App Purchase position, which is materially worse for the Companion than for Buyer Mode. **v1.0 waits for beta evidence**, because ADU-ARCH-01 S3.1 phases the Companion on evidence rather than on assumption.

**Every document in the series is now issued**, and the work orders are ADU-MOB-WO-01 v1.1, -WO-02 and -WO-03.

> **v1.0 named a four-document series and it was short by three.** The missing ones were not optional: a component inventory the wireframes could be drawn from, a compliance dossier the store submission needs weeks before it needs code, and a test specification. **ADU-MOB-05 is the one with a lead time** -- D-U-N-S, enrolment and payment (S24 Q2) are not writing tasks and they gate a submission date.

### 0.3 Why the buyer app is the harder half, stated at the top

The Companion is four surfaces on a phone the seller is already holding. **Buyer Mode is the only client for the entire buyer product.** Every capability in ADU-PRD-01 S2 that is not anonymous browsing lives here and lives nowhere else: identity creation, the cart, the reservation, the payment evidence, the QR scan, the review, the claim, the chat, the follow. ADU-PD-01 S4 puts it plainly -- *"reserving requires the app."*

It also owns the two hardest engineering problems in the product, and neither belongs to any other surface:

- **The handoff scan**, which is the only place in the product where a client's behaviour decides whether evidence exists at all. **v1.0 called this the offline problem; ADU-MOB-AMD-01 withdrew offline and it remains the hard one** -- the buyer is at a doorway, the seller is holding the code, and the scan either reaches the server in that moment or the seller loses a verified handoff (S9).
- **Version skew.** ADU-API-01 S3.1: *"Several app versions will be live simultaneously, for months, and the oldest cannot be assumed to have been updated at all."* The console reloads; a store-distributed binary on a metered connection does not.

### 0.4 What is out of scope, and why saying so matters

**The Seller Companion is not in this document.** Not its notification surface, not its order detail, not the payment evidence viewer, not the mode switcher. Twelve permissions carry `{MOBILE, CONSOLE}` in `core.permission` (ADU-AUTH-01 S16.2a) and every one of them belongs to ADU-CMP-01.

This matters because the two modes share a binary, a session and an account. **A boundary inside one codebase is only real if it is written down before the code is.** S17.3 states where the seam goes so that ADU-CMP-01 lands beside Buyer Mode rather than through it.

---

# PART A -- THE SYSTEM

## 1. Buyer Mode on one page

**One API, one bearer session, one device row, and nothing on disk that the server owns.**

```text
                          THE INTERNET
                               |
                    -----------------------
                    |     Cloudflare      |  DNS, TLS, edge cache,
                    |      (Pro plan)     |  edge rate limits, R2
                    -----------------------
        --------------------+-------------------------------
        |                   |                              |
  adulis.example      media.adulis               api.adulis.example
  Public storefront   Product images                       |
  (anonymous, the     3 derivatives           -------------------------
   install funnel)    public only              |  Render (Frankfurt)  |
        |                   ^                  |  api x2 + worker     |
        | App Link /        |                  |  PostgreSQL 17       |
        | Universal Link    |                  -----------------------
        v                   |                              ^
  ------------------------------------------------------   |
  |            THE ADULIS APP -- Buyer Mode            |---
  |  Expo / React Native, iOS + Android                |
  |  ------------------------------------------------  |
  |  secure store : session token, device id           |
  |  SQLite       : one idempotency key. Nothing else  |
  |  image cache  : public media only                  |
  |  camera       : the QR scan                        |
  |  FCM / APNs   : push, deep-linked                  |
  ------------------------------------------------------
```

- **The app holds no business rules.** ADU-PRD-01 S23: *"All state logic on the server. Clients display state and send intents."* Expiry, eligibility, level, entitlement, cancellation penalties and stock are read, never computed.
- **The app holds one credential and one identifier**, and they are different things. The session token authenticates; the device id is the anonymous cart key (ADU-DB-01 S6.4, S11.1) and authenticates nothing.
- **The app persists no authenticated data at all.** Every screen reads fresh or shows a retry. The one durable record it keeps is an idempotency key, which is not data -- it is what stops one order becoming two. S9.
- **The buyer's bulk never reaches the origin.** Anonymous storefront browsing happens on the web page the bio link resolves to, edge-cached, and A1 S3 shows that decision is why 10,000 sellers generate ~193 origin RPS. The app inherits the same posture: no polling, no prefetch of anything the buyer did not ask for.

> **INVARIANT -- there is no mobile back-end.** No BFF, no gateway, no mobile-specific endpoint. Buyer Mode calls the same NestJS service the console calls, and what it may do is decided inside the database by `core.fn_has_permission(account, seller, permission, audience)` with `audience = 'MOBILE'`. Carried from ADU-CON-02 S1 and it applies with equal force here.

## 2. What Buyer Mode is, and is not

**It is:** the storefront, the cart, the reservation, the payment relay, the handoff scan, the review, the claim, the chat, the follow list and the notification centre -- for one buyer, against one seller at a time.

**It is not**, and each of these is a deliberate exclusion rather than a gap (ADU-PD-01 S2):

| Not | Where it lives instead |
|---|---|
| A marketplace | No cross-seller search, no category browse across sellers, no discovery. V3 |
| A recommender | The feed is recency over the followed set. `GET /v1/feed` accepts no ranking parameter and **an endpoint that accepts one is one flag away from being a recommender** (ADU-API-01 S12.8) |
| A payment app | No wallet, no balance, no card, no processing. The buyer transfers from their own bank app |
| An escrow | Adulis holds no money at any point. The app must never imply otherwise -- S16 |
| A delivery app | No tracking, no courier map. The courier is the seller's agent |
| A seller app | S0.4. No catalogue, no stock, no payout, no analytics, no billing |
| Offline-capable | **Not at all** (ADU-MOB-AMD-01). Every operation requires the network, and a failed one fails visibly with a retry rather than showing yesterday's answer as today's. S9 |

## 3. The technology register

Each entry: *what it is -> why this one -> what lost.* Majors here; exact versions pinned in the repository and moved only under S20.4's rules.

### 3.1 React Native with Expo, TypeScript strict, on the same Node toolchain

> **Plain terms:** React Native renders a real native interface from React code. Expo is a managed layer over it -- prebuilt native modules (camera, secure storage, notifications), a build service that produces the store binaries without a Mac in the room, and an update service that can replace the JavaScript in an installed app without a store review.

**Already ruled in ADU-ARCH-01 S6.1** and not reopened here. What this document adds is the reasoning, because it is load-bearing for two later sections:

- **One language across five workstreams.** ADU-CON-02 S3.1's argument, unchanged: one skill set, one agent-instruction style, shared packages -- `packages/locale` and the generated API client are literally the same files the console imports. `strict: true`, no exceptions.
- **Expo's build service removes a hardware dependency.** iOS binaries otherwise require macOS. Neither founder is guaranteed one, and a build step that depends on a machine in Addis is a release process with a single point of failure.
- **The update service is the rollback story.** S19.2. A JavaScript defect in a store-distributed app is otherwise a multi-day outage.

*Rejected:* **Flutter** -- a second language halves the review capacity of a two-person team, which is ADU-CON-02 S3.1's rule and it does not stop applying at the app boundary. **Two native codebases** -- two of everything, against one front-end developer who already owns four surfaces (ADU-00, Launch scope). **A PWA instead of a native app** -- this is the option ADU-ARCH-01 v2.0 already killed: a PWA cannot push reliably on low-end Android or on iOS Safari, and it cannot hold a signed scan across a reinstall, run a camera reliably, or be listed in a store. **Bare React Native without Expo** -- the config-plugin work for App Links, FCM and secure storage is exactly the kind of native configuration a beginner-plus-agent team gets silently wrong.

### 3.2 Expo Router -- and the deep-link map is the reason

> **Plain terms:** Expo Router is file-based routing built on React Navigation. A file at `app/s/[handle]/p/[slug].tsx` *is* the route `/s/:handle/p/:slug`.

**Android App Links and iOS Universal Links are a binding requirement** (ADU-PRD-01 S21.1: *"configured for every seller storefront and product URL"*), and they are the mechanism by which the bio link -- the only outbound link the product has -- reaches the app at all.

With file-based routing **the link map is the directory listing**, reviewable in a diff. That is the same argument that put the console's CSP in a static `_headers` file (ADU-CON-02 S3.9): a security- or funnel-critical mapping that lives in code someone has to read is a mapping that drifts.

React Navigation is underneath, so nothing is given up. *Rejected:* hand-configured React Navigation linking -- one `linking.config` object that must be kept in step with the screen tree by discipline.

### 3.3 TanStack Query 5 -- the same choice, for the same stated reason

The product *requires* re-read semantics in two places and states them as invariants: the order card is **re-read on every view** (ADU-API-01 A6, S12.4) and the cart **re-checks availability on every view** (ADU-PRD-01 S8.2, ADU-DB-01 S11.2). That is Query's model.

Two mobile-specific settings that are not defaults and are not optional:

- `refetchOnWindowFocus` becomes **refetch on app foreground** via `AppState`. Returning to the app after four hours must not show a four-hour-old order card.
- **No persister, ever.** S9.2 makes this an invariant with a CI check.

*Rejected:* Redux for server state (Query owns it; the rest is component-local), and every offline-first sync engine -- there is nothing to sync (S9.1).

### 3.4 Zustand, scoped to what the server does not own

One small store for genuinely client state: the device id handle, the resolved locale, the upgrade banner's dismissal, the sign-in flow's transient state (including the `challenge_id` held between the two OTP screens), and **the scan screen's in-flight state -- which lives for the life of that screen and is written nowhere.**

> **v1.1 listed *"the scan-queue view model"* here, in the version that deleted the queue.** There is no queue and no view model of one (B25). **The scan screen's transient state is not a queue**: it exists while the screen is mounted, it is never persisted, and leaving the screen discards it. Grep gate 10 is what keeps that true.

> **INVARIANT -- no server-owned value is mirrored into Zustand.** Order state, stock, prices, levels, entitlements and deadlines come from Query and are rendered from the response. A copy of server state in a client store is a second source of truth that goes stale exactly when the network is bad, which is when the buyer is looking at it.

### 3.5 `openapi-typescript` + `openapi-fetch` -- generated from the same spec as the console

The client is generated from the API's own published `openapi.json` (ADU-CON-02 S11). **Not a second hand-written client**, and not a copy of the console's.

This is what makes ADU-API-01 S3.1's additive-only invariant enforceable rather than aspirational: **a removal, rename or retype inside `/v1` fails the mobile build on the same day it fails the console build**, in CI, before it can reach a store binary that then cannot be recalled.

### 3.6 Zod for input only -- and never for responses

Zod validates what the buyer types: the phone number's shape, a review's length, a claim's free text. It produces the form's type and the client-side feedback; the server remains the authority.

> **RULING B1 -- no API response is validated against a schema, and no response type is closed.**
>
> This looks like a lapse and it is the opposite. ADU-API-01 S3.1: *"every response is valid against the schema every supported client version holds. A client ignores fields it does not know."* A `z.object({...}).strict()` on a response turns the next **additive** API change -- a change the contract explicitly permits and CI explicitly allows -- into a crash in every installed copy of the app, which is a defect that cannot be fixed by fixing the server.
>
> The generated types describe the response; nothing enforces them at runtime. Where a value is missing or unrecognised, S6.3's default branch renders.

### 3.7 The device modules, each with the reason it is not a choice

| Module | Carries | The rule that requires it |
|---|---|---|
| `expo-secure-store` | The session token and the device id | ADU-SEC-01 S4 by analogy: a credential in general-purpose storage is a credential an attacker reads. Keychain / Keystore, never `AsyncStorage` |
| `expo-camera` | The QR scan | ADU-PRD-01 S11.1. The buyer is the party that scans |
| `expo-sqlite` | **One row: the order-creation idempotency key and its cart hash.** Nothing else | S5.2, S9.2 |
| `expo-notifications` | FCM and APNs registration, permission, the tray | ADU-ARCH-01 S0: native push is the notification channel |
| `expo-image` | Product media, disk-cached | S13. Public media only |
| `expo-image-manipulator` | Downscaling payment evidence before upload | ADU-API-01 S7.1's 5 MB cap meets a 12-megapixel screenshot from a cheap phone. S8.2 |
| `expo-updates` | Over-the-air JavaScript releases | S19.2 |
| `react-native-webview` | Social embeds, and **nothing else in the app** | ADU-SEC-01 S10. S7.4 |

*Rejected:* `AsyncStorage` for anything sensitive  -  any biometric library beyond the OS unlock (ADU-AUTH-01 S8.4: **biometric is a local device unlock and is never a factor Adulis verifies**)  -  any background-fetch scheduler (S9.6)  -  any third-party analytics, attribution, session-replay or crash SDK (S3.8).

### 3.8 No third-party SDK, and the crash-reporting hole that leaves

**ADU-WEB-01 S9's rule is that adding a third party to a personal-data flow creates a processor relationship nobody has assessed.** ADU-DPIA-01 S3.2 lists seven processors and records that **no processor agreement exists with any of them**; the mobile app is not the place to add an eighth by installing a package.

> **RULING B2 -- Buyer Mode ships with no third-party SDK of any kind at MVP.** No analytics, no attribution, no session replay, and **no crash-reporting SDK.**
>
> **The cost is real and is stated rather than hidden:** a crash on a low-end Android is otherwise invisible to us. The substitute is the crash reporting the stores already provide -- Play Console vitals and Xcode Organizer -- which add no processor, because the store relationship exists whether we use it or not. It is worse: no breadcrumbs, no user context, a day of latency. It is enough to see a crash rate move.
>
> **The reopen trigger, written down so it expires rather than being inherited:** a self-hosted collector (Sentry's own server) or an assessed vendor, taken with ADU-CON-02 O-4 and the DPIA processor work, at the first release where the store-provided rate is not enough to act on.

### 3.9 Consolidated rejections

GraphQL and tRPC (ADU-API-01 S3, and the version-skew argument binds hardest on mobile)  -  a mobile BFF (S1)  -  Redux  -  Realm / WatermelonDB / any offline-first engine (S9.1)  -  any background or deferred sync task (S9.1)  -  local scheduled notifications (S10.4)  -  client-side cryptography of any kind (S9.4 -- **this is the important one**)  -  certificate pinning (S14.3)  -  Firebase or Supabase as a back end (the rules live in our schemas and roles)  -  social login (ADU-AUTH-01 S2: none in V1)  -  an in-app browser for anything transactional (S16)  -  a "sell on Adulis" call to action (S16.2).

## 4. Identity, device and session -- three things, in the right order

The single most common way to get this wrong is to conflate the device with the account. They are created at different moments, they persist for different lengths of time, and one of them is not a credential.

### 4.1 The device row exists before anyone has an identity, and one function creates it

ADU-DB-01 S11.1, in order:

1. **First launch.** The app generates a UUIDv7 and registers it with `POST /v1/devices`, then sends it as `X-Adulis-Device` on every request thereafter. No account, no session, **no personal data** -- ADU-DB-01 S6.4 is explicit that a device row carries a push token and a permission state and nothing else, which is what makes it safe as the anonymous cart key.
2. **Browsing and cart building.** `core.cart` is keyed by `device_id`; `buyer_account_id` is null.
3. **First reserve.** Phone OTP creates the account, and in the same transaction `device.account_id` is set and every `ACTIVE` cart for that device is bound to it.
4. **Purge.** An unbound device with no activity beyond the retention window is deleted with its carts.

> **ADU-RUL-04 S1 -- device creation is one function, and both doors call it.** `GET /v1/bootstrap` and `POST /v1/devices` *"both call it and neither implements it. The function resolves the market, sets it at insert, and is subject to the same rate-limit bucket."*
>
> **v1.0 recorded an ordering trap here and it no longer exists.** Registering before bootstrapping used to leave `market_id` NULL, which made every later OTP request refuse with a message naming the call the client had already made. **The market is now set at insert by whichever door was used**, so the client owes no ordering discipline at all -- which is the difference between a rule someone maintains and a rule nobody can break.
>
> **RUL-04 records that folding the two endpoints into one is *"the right move whenever the mobile contract is next revised."* This workstream is that revision** -- carried as an open item rather than taken here, because it changes `GET /v1/bootstrap`'s contract and the console already depends on it. S24 Q10.

> **RULING B3 -- the device id is generated once and stored in secure storage, not in ordinary app storage, and it is never regenerated.**
>
> Not because it is secret -- it is not, and S4.4 says so. Because **losing it orphans the cart the buyer was building and mints a second device row.** At scale that is a corrupted denominator on every device-keyed measurement in ADU-PRD-01 S20, and for the individual buyer it is the basket disappearing between two launches.

> [!] **A malformed `X-Adulis-Device` is answered with 500, and the app sends that header on every request.** A truncated or corrupted read from secure storage therefore produces an unrecoverable loop the buyer cannot escape by retrying. **The app validates the shape of its own device id before sending it, and re-registers if it fails.** The server-side half is recorded in S22.

### 4.2 Identity is created at first reserve, and the app must not ask sooner

**INVARIANT -- there is no sign-in prompt at launch, at browse, or on the storefront.** ADU-PRD-01 S6.1: *"Browsing is fully anonymous on all clients. Identity is created at the moment of first reserve."*

An existing buyer arriving on a new device is a different case and does need a way in. The rule that separates them: **the app offers sign-in from the orders tab and the account tab; it creates an account only inside the reserve flow.** A launch screen that asks for a phone number is a launch screen that loses the buyer the storefront just earned.

**Age declaration rides on identity creation, it is built, and the screen rule is not obvious** (ADU-AUTH-01 v2.8 S18):

- A self-declared confirmation of being 18 or over, sent as `age_declared_over_18` **in the verify body**, stored as `account.age_declared_over_18` and `age_declared_at`. **A date of birth is never collected** -- Adulis sells no age-graded product, so a birth date would be data held for no purpose, and the copy must never describe self-declaration as verification.
- **INVARIANT -- the checkbox is rendered on the OTP confirmation screen for everyone, and the client does not first ask whether the phone belongs to an account** (S18.1). Rendering it only for new accounts would be a screen that answers the enumeration question S17 forbids answering.
- **The server requires it only for account creation**, and refuses with `AGE_DECLARATION_REQUIRED` rather than a bare `VALIDATION_FAILED`, *"because the client must know which input requires correction."* The app renders that code to the checkbox, not to a toast.

> **v1.0 recorded this as a blocked capability -- a specification with no column and no endpoint -- and ADU-MOB-WO-01 held the screen out of tier 2 on that basis. It is built. The screen is in scope.**

### 4.3 The OTP, rewritten by ADU-AUTH-01 v2.8

Parameters are S4.1 of that document and the app implements them rather than inventing them: 6 digits, 5 minutes, 5 attempts per challenge, one live challenge per `(phone, purpose, audience)`.

**The shape changed in three ways that matter to the client.**

```
POST /v1/auth/otp/request   { phone, purpose: "SIGN_IN", audience: "MOBILE" }
POST /v1/auth/otp/resend    { phone, purpose: "SIGN_IN" }
POST /v1/auth/otp/verify    { challenge_id, code, device_id, age_declared_over_18 }
```

1. **`audience` travels on the request and is stamped at challenge creation.** A `MOBILE` challenge mints a `MOBILE` session and nothing else.
2. **`verify` rejects `audience`** (D-180). v1.0 raised the risk that a caller could choose its own surface and walk past a control scoped to one; **that is closed, and this is the closure.** The client sends the field nowhere.
3. **`verify` carries `challenge_id`, not `phone`.** The app therefore **holds the challenge id between the two screens** -- in memory, for the life of the flow, never persisted.

> [!] **ADU-API-01 v1.11 S5 still prints the old body** -- `{ phone, code, audience, device_id }` -- including the field D-180 says is rejected. Its own change table records the correction to S12.2 and S5's code block was never re-read. **ADU-AUTH-01 v2.8 governs; the contradiction is S22 N1 and it is the one thing tier 2 cannot be built through.**

**Request and resend are different endpoints and the app must not confuse them** (S5.4, S5.5). A transport retry replays `POST /v1/auth/otp/request` with the stored `Idempotency-Key` and **sends no message**. The resend button calls `POST /v1/auth/otp/resend`, which is not idempotency-keyed, **supersedes the live code and generates a new one.** Delivery failover is a third thing and is invisible to the client: it transports *the same* OTP through a second provider, so one challenge, one code, one expiry, one attempt budget.

**`OTP_SUPERSEDED` gets its own screen state**, not the generic invalid-code message: *"that code has expired -- check for a newer message."* The race is ordinary -- a resend, then the first SMS arrives -- and the generic message sends the buyer round the loop.

**Resend backoff is 30s / 60s / 120s, rendered as a countdown, never as a rejected tap.**

**The attempt budget is burned on the server and survives a failed outer request** (S5.7). A client that retries a rejected verify has spent an attempt, and the screen must show four remaining rather than five.

> [!] **The Android autofill trap, which costs a day if it is met at submission rather than now.** Android's SMS Retriever fills the code automatically only when the message ends with an 11-character hash **derived from the app's signing certificate** -- and Play App Signing means the production hash comes from a key Google holds, not from the upload key. Three builds, three hashes. **Autofill silently not working in development is the expected state**, not a defect to chase, and the SMS template needs a per-build suffix that names no action and so breaches no invariant. The aggregator must pass 11 characters through untouched, which is a question for the AfroMessage integration.
>
> iOS needs none of this: `textContentType="oneTimeCode"` and the OS reads the code from any message.

### 4.4 The session, and what a 401 must and must not destroy

| | Value | Source |
|---|---|---|
| Credential | `Authorization: Bearer <opaque>` | ADU-API-01 S5.1 |
| Storage | Native secure storage | ADU-SEC-01 S4 |
| Absolute lifetime | **30 days, absolute** | ADU-AUTH-01 v2.8 S19.1 |
| Idle timeout | **None** | " |
| Concurrent devices | 5 | " |
| Revocation | Immediate, on the next request | ADU-AUTH-01 S8.2 |

**v1.0 said "sliding on activity" and that was wrong.** ADU-AUTH-01 v2.8 S19.1 is explicit: *"Mobile 30 days is absolute."* The difference is visible to the buyer -- a daily user is signed out on day thirty regardless of use, so **the app must handle an expiry that arrives without warning during an ordinary session**, which is a different screen from an idle timeout the console warns about five minutes ahead.

The session row is read on every authenticated request. The app's obligation is to notice the answer.

> **RULING B4 -- a 401 clears the session and **nothing else**.**
>
> On `SESSION_EXPIRED` or `SESSION_REVOKED` the app deletes the token, returns to anonymous browsing, and **keeps the device id, the cart, and the order idempotency key.** None of the three is the buyer's credential, and destroying them punishes a person whose session simply aged out on a phone they still hold.
>
> The failure this prevents is specific: an agent writing a "sign out" routine that clears secure storage wholesale takes the device id with it, which orphans the cart (B3) and **takes the idempotency key with it as well** -- so the retry that follows the re-authentication creates a second order (B6, S9.5).
>
> **v1.0 listed the unsynced scan queue here. There is no queue** (B25). A scan that has not reached the server when the session ends is gone, and the buyer completes by tapping.

**Biometric or PIN unlock** is offered (ADU-AUTH-01 S8.4). Default off for a buyer-only account; **default on where `roles[]` from `/v1/auth/otp/verify` shows any seller relationship** -- the app reads `roles[]` for this and for nothing else, because `roles[]` is *"a rendering hint only"* and a client that treats it as authorisation is the failure ADU-PRD-01 S16.2 forbids.

**New-device sign-in has a mobile-side obligation**: ADU-AUTH-01 S7.2 sends the notification **by push first, SMS second**, because a SIM swap moves the number and does not move the app installation. That control only works if the push token on the seller's *existing* devices is current -- so **the app refreshes and PATCHes its push token on every cold start**, not only at registration. It is the cheapest half of the only real defence against SIM swap in the product.

## 5. The request pipeline, client side

Every request leaves through one module. Every request carries the same headers, computed in the same place.

```text
  screen / mutation
        |
        v
  api client  (the ONLY module that calls fetch)
        |
        +-- Authorization: Bearer          when a session exists
        +-- X-Adulis-Client: ios|android/<runtime version>   S6.2
        +-- X-Adulis-Device: <device id>
        +-- X-Adulis-Clock-Offset: <ms>    from the last bootstrap, S6.4
        +-- Accept-Language: en|am
        +-- Idempotency-Key                on every state-changing POST, S5.2
        |
        v
  response  ->  no strict validation (B1)  ->  error mapper  ->  screen
```

> **RULING B5 -- `fetch` appears in exactly one file, and CI proves it.**
>
> `grep -r "fetch(" apps/mobile/src --exclude-dir=api` must be empty. This is the same move as ADU-CON-02 S6.2's second connection pool: the point is not the mechanism, it is that **`grep` yields the complete list of code that can reach the network**. A screen that calls `fetch` directly is a screen without headers, without the idempotency rule, without the error mapper, and without the version floor.

### 5.1 Errors are rendered from keys, never from server prose

ADU-API-01 S7: RFC 9457 Problem Details plus `items[]`, carrying `title_key`, `message_key` and typed `slots`. **No error body ever contains rendered prose.** The app formats from its own catalogue, per locale.

This is not a style rule. It is the mechanism that keeps a price out of a screen an App Store reviewer reads: `TIER_LIMIT_REACHED` to a `MOBILE` session names the capability and where it is configured and **never the tier and never a route to change one** (ADU-AUTH-01 S18.1, ADU-API-01 S4.1). A server that composed the sentence would be the leak.

The error surfaces the buyer app must render, each with its own state rather than a generic failure: `INSUFFICIENT_STOCK`, `DUPLICATE_RESERVATION`, `ILLEGAL_TRANSITION`, `CART_SELLER_CONFLICT`, `VARIANT_WITHDRAWN`, `SELLER_UNAVAILABLE`, `PAYLOAD_TOO_LARGE`, `EVIDENCE_TOO_LARGE`, `OTP_SUPERSEDED`, `RATE_LIMITED` (with `Retry-After`), `SCOPE_PARAMETER_REQUIRED`, `PERMISSION_DENIED`, `STEP_UP_REQUIRED`, 404-as-not-yours, and the two 409 payment-window codes.

**A 404 is rendered as "not found", never as "you are not allowed"** (ADU-AUTH-01 S19). A scope failure that the interface translates into a permission message re-creates, in copy, the enumeration oracle the status code was chosen to avoid.

### 5.2 Idempotency, and the one key that must outlive the process

Every state-changing `POST` carries `Idempotency-Key`. ADU-CON-02 S7's rule holds: **the key is minted when the control mounts, not on tap** -- a double-tap must be one key.

Mobile adds a case the console does not have, and it is exactly ADU-API-01's gap A2 (*"a retry on a flaky connection creates a second order"*):

> **RULING B6 -- the key for `POST /v1/orders` is persisted, not held in component state.**
>
> The sequence that breaks an in-memory key: the buyer taps Reserve on a bad connection; the request is in flight; Android kills the app for memory, or the buyer switches to their bank app and comes back to a remounted screen. A fresh key on retry is **a second order, a second stock decrement, and a duplicate the `EXCLUDE` constraint may or may not catch depending on the lines**.
>
> The key is written to SQLite alongside the cart's content hash when the checkout screen is entered, reused for every attempt, and deleted when the order is created or the cart changes. Same key plus a different body hash is a 409 from the server, which is the correct answer and the app renders it as *"your cart changed -- review it"*.
>
> The other state-changing calls keep the mount-time key: their failure mode is a duplicate message or a duplicate follow, not a duplicate order.

### 5.3 Rate limits are the buyer's experience, not an error

ADU-AUTH-01 S14 limits `otp/request` to 3/hour and `otp/resend` to 3/15 minutes, both keyed on a **phone hash** rather than the number. A buyer who mistypes twice is one attempt from a lockout.

> **INVARIANT -- the rejection never reveals whether the number belongs to an account.** ADU-AUTH-01 v2.8 S17 removed the last hedge: *"There is no `where practical` exception."* The app renders `RATE_LIMITED` with `Retry-After` as a wait, **byte-identically for a known and an unknown number**, and the same rule governs every other refusal on the sign-in path.

**Two things about IP-keyed limits that the client must not assume.**

**The OTP IP limiter is disabled** (S15, R41) until trusted-proxy configuration is proven, because behind a CDN every caller collapses to one subject and *"ten per hour for everybody"* is not a limit, it is an outage. **ADU-API-01 v1.11 S10 still documents it as 10/hour per IP.** AUTH governs; S22 N2.

**The bootstrap mint limiter is platform-scoped on purpose** (S15) -- a ceiling sized for the platform rather than for one caller. **A 429 there costs the app its entire configuration**: no market, no locales, no clock reference, no client floor. S6.1 says what the app does about it, and the answer is not to proceed.

> [!] **And an Ethiopian consideration neither document carries.** Mobile carriers here run heavy carrier-grade NAT, so thousands of buyers share an egress address. **Any IP-keyed budget is a limit on a neighbourhood, not on an attacker** -- and it will present as churn rather than as an error, which is the measurement failure ADU-AUTH-01 S6 already warns about for SMS delivery. Recorded for whoever sets the value when `TRUSTED_PROXY_HOPS` lands (ADU-RUL-04 S2).

## 6. Version skew -- the app's half of the contract

> **Plain terms:** a store binary is not a deployment. It reaches people when they choose, over a connection they pay for, and some of them never choose. Months after a release, a meaningful share of installs is running something older.

ADU-API-01 S3.1 makes three invariants binding. Two are the server's; the third is ours.

### 6.1 The floor is enforced at bootstrap, and nowhere else

`GET /v1/bootstrap` on every cold start and on every return to foreground after a configurable interval. It returns `server_time`, `min_supported_client`, `client_status`, the market and the feature flags.

| `client_status` | The app does |
|---|---|
| `OK` | Nothing |
| `UPGRADE_RECOMMENDED` | One dismissible banner **per version**, never a modal, never repeated after dismissal |
| `UPGRADE_REQUIRED` | A blocking screen with a store link, and **no route past it** |

> **INVARIANT -- no deep link, no push notification and no cached screen bypasses the `UPGRADE_REQUIRED` screen.** A notification tap that lands on an order card in a client the server has declared unsupported is precisely the *"incomprehensible failure at the moment it tries to reserve"* that enforcing at bootstrap exists to prevent.

The blocking screen states what to do in the buyer's own language and links to the correct store. It must render with no session, no network beyond the bootstrap call that produced it, and in both locales.

### 6.2 The client version reported is the running one, not the installed one

Because over-the-air updates replace the JavaScript inside an installed binary (S19.2), *"version"* has two meanings, and reporting the wrong one makes the floor useless.

> **RULING B7 -- `X-Adulis-Client` carries the runtime version -- the JavaScript bundle actually executing -- and the store binary version travels beside it.**
>
> `X-Adulis-Client: android/1.6.2` where `1.6.2` is the bundle. A binary at 1.4.0 that has taken an update to 1.6.2 behaves as 1.6.2 and must say so, or the floor either locks out a client that is current or admits one that is not.
>
> The native binary version is still needed -- some fixes cannot be delivered over the air -- and it travels as a second segment where one is present: `android/1.6.2 (bin 1.4.0)`. **This is an addition to ADU-API-01 S3.2's header description and is recorded in S23 as a write-back**, because the contract currently describes a single version and the build will produce two.

### 6.3 Unknown values render, they never crash

The corollary of B1. Every closed-set render -- order state, reservation state, review badge, claim state, notification category, error code, scan outcome -- **has a default branch**, and the default is honest rather than blank:

*"This order is in a state your app version does not recognise. Update Adulis to see it."*

A blank card on a slow phone is indistinguishable from a broken app, and the buyer's next action is to uninstall.

### 6.4 The clock offset is reported, never applied

`server_time` from bootstrap is *"the reference the client uses to compute the clock offset A5 requires"* (ADU-API-01 S3.1).

> **INVARIANT -- the app records `device_clock - server_time` at each successful bootstrap and transmits it. It never adjusts a timestamp with it.**
>
> ADU-DB-01 S14.2 computes `corrected_at = greatest(signed_at - reported_clock_offset, order_qr_token.issued_at)` on the server, floored at token issuance. **The server needs the raw pair.** A client that pre-corrects `signed_at` destroys the floor's information and, worse, makes an honest device indistinguishable from a lying one -- which is the exact discrimination the split between `corrected_at` and `received_at` exists to preserve.

**The offset survives the offline withdrawal, and ADU-MOB-AMD-01 B4 says why.** Online submission narrows the gap between a scan and its arrival; it does not remove the device clock from the calculation, because `signed_at` is still stamped by the scanner. **A cheap phone with a wrong clock must not cost an honest seller a level-counting handoff, and that was never an offline concern.** What changes is only that the offset is read from the last bootstrap in memory rather than from a persisted record.

## 7. The surfaces

Every Buyer Mode screen group, the endpoints it consumes, and the rule that constrains it. **ADU-MOB-02 turns this into screens and states; this table is the boundary those screens must not cross.**

### 7.1 Entry, recovery and the install seam

| Surface | Endpoints | Constraint |
|---|---|---|
| First launch | `POST /v1/devices`  -  `GET /v1/bootstrap` | No sign-in prompt (S4.2). No permission prompt (S10.2) |
| Home | `GET /v1/feed` when following, else the empty state | **The empty following list is the entire first experience of this surface for every new buyer** (ADU-PRD-01 S17.2, S23.2) |
| Paste a post link | `POST /v1/post-links/resolve` | Returns a **list** -- one post commonly features several products. Five states: one match, several, none, unrecognised, no longer available |
| Find a seller | `GET /v1/sellers/lookup?q=` | Returns sellers, never products, and **never suggests a seller the buyer did not search for** |
| Upgrade required | `GET /v1/bootstrap` | S6.1 |

**These two recovery paths are not optional.** ADU-PRD-01 S21.2: short codes were removed, nothing carries the specific product across an install, and *"the app's first screen must offer both."* Without them, a buyer who browsed on the web and installed arrives nowhere. `reserve_intent_web` against `first_reservation_created` is the release gate that measures the loss (ADU-PROJ-01 S12).

### 7.2 Storefront and product

| Surface | Endpoints | Constraint |
|---|---|---|
| Storefront | `GET /v1/storefronts/{handle}` | Trust level and completed handoff count are **page content, not a second call** |
| Products | `GET /v1/storefronts/{handle}/products` | **The seller's display order is the default.** Search and filters narrow; they never re-rank |
| Product | `GET /v1/storefronts/{handle}/products/{slug}` | Attributes, variants, stock **with `confirmed_at`** -- every stock claim carries when it was last true |
| Search within a seller | `GET /v1/storefronts/{handle}/search` | **Scope is one seller, always.** No parameter exists that widens it, and none may be added |
| Reviews | `GET /v1/storefronts/{handle}/reviews` | Badge per review. Two ratings, never averaged |
| Follow | `POST`/`DELETE /v1/sellers/{handle}/follow` | Available **before** purchase, from every surface where a seller is identified |

### 7.3 Cart, reserve and the disclosure

| Surface | Endpoints | Constraint |
|---|---|---|
| Cart | `GET /v1/cart`, `POST`/`PATCH`/`DELETE /v1/cart/lines...` | Re-checks on every view. Each line shows `available` **and `available_checked_at`** -- a cart is a draft and the interface has to say so |
| Second seller | 409 `CART_SELLER_CONFLICT` | Enforced by a composite foreign key, not a service check. The app offers to start a new cart, never to merge |
| Reserve | `POST /v1/orders` | Whole-cart revalidation in one transaction. Persisted key (B6) |
| Reconciliation | 409 with complete `items[]` | **Six per-line states rendered from `items[]` verbatim**: sold out, insufficient quantity, price changed, no longer published, variant withdrawn, seller unavailable. **The system never silently alters a cart** |
| New-seller disclosure | -- | ADU-PRD-01 S5.3: shown at the reservation step, stating no completed handoff history and that payment goes directly to the seller. **Not dismissible by default, not buried.** Emits `new_seller_disclosure_shown` |
| Transaction cap | 409 | A New-level seller's order value cap. The message names the limit, never the seller's level as a judgement |

### 7.4 The product video, and the only WebView in the app

ADU-PRD-01 S7.4: video is a click-to-load social embed with a poster frame Adulis stores itself, and **the product page must remain fully functional without the embed.**

> **RULING B8 -- the embed is a `WebView` pointed at the platform's own embed URL, loaded on tap, with the platform SDKs never loaded and navigation confined to the two embed origins.**
>
> ADU-SEC-01 S10's invariant is written for an `<iframe>` and there is no iframe in React Native. The properties it was protecting are what carry over: **no third-party script executes in our context**, no cookie is shared, and no request reaches TikTok or Instagram until the buyer asks for one -- which is a data-protection property the DPIA relies on and a performance property the low-end Android needs.
>
> Concretely: `originWhitelist` restricted to the two embed origins; `javaScriptEnabled` true (the embed needs it) with **no injected JavaScript of ours**; third-party cookies off; any navigation outside the whitelist opens the system browser rather than loading in place; the WebView is mounted on the product screen only and unmounted on leave.
>
> **The reopen trigger:** if either platform requires its SDK for embeds to play, the embed is dropped and the poster frame plus a link out is what ships. The product page works without it by design, and loading someone else's code into the app is not a trade this document will make.

### 7.5 Payment

| Surface | Endpoints | Constraint |
|---|---|---|
| Order card | `GET /v1/orders/{id}` | **Authoritative, re-read on every view.** `expires_at` is an absolute timestamp and is never rendered as a bare duration in a place that can go stale |
| Payment instructions | `GET /v1/orders/{id}/payment-instructions` | The single decryption path. `private, no-store` -- **never written to disk, never cached by Query, never included in a screenshot-able list view.** The response is held in memory for the life of the screen |
| Copy the account number | -- | An explicit copy control. **Nothing is ever placed on the clipboard automatically** |
| Submit evidence | `POST /v1/orders/{id}/payment-evidence` | Signed URL, then commit. Downscaled on device (S8.2) |
| Per-line cancel | `POST /v1/orders/{id}/reservations/{rid}/cancel` | Per line. The penalty ladder is disclosed **before** the tap, not after |
| Refund acknowledged | `POST /v1/orders/{id}/refunds/{rid}/acknowledge` | **An explicit buyer action, never inferred** |

**On screenshot blocking, considered and rejected:** the obvious instinct is `FLAG_SECURE` on the payment-instructions screen. It is wrong here -- the buyer needs the account number in their bank app, and blocking the screenshot pushes them to copy a thirteen-digit number by hand, which is how money reaches the wrong account. The account number is not a secret from the buyer; it is the thing being disclosed to them, on an order that is payable, by a function that logged the read.

### 7.6 Handoff, and what happens after it

| Surface | Endpoints | Constraint |
|---|---|---|
| Scan | camera, then `POST /v1/handoffs/sync` | S9 in full. **One scan per request** (ADU-MOB-AMD-01 B27) |
| Scan in flight | -- | Shown as **sending**, with a visible retry. **Never shown as complete before the server says so**, and never persisted |
| Confirm receipt | `POST /v1/orders/{id}/confirm-receipt` | The tapped tier. **Medium weight, advances no level** |
| Review | `POST /v1/orders/{id}/review` | One per order, terminal state required. **Two ratings, always separate.** It always publishes |
| Claim | `POST /v1/claims`, `/evidence`, `/evidence-export` | S7.7 |
| Report | `POST /v1/reports` | On **every** piece of user content. `subject_kind` spelling is the enum's, not this document's (D-44) |
| Block | -- | Store-mandated alongside report (ADU-PRD-01 S18) |

> **RULING B9 -- the tap confirmation is never the primary action on a screen where a scan is still possible.**
>
> Only a scanned handoff counts toward trust level (ADU-PRD-01 S11.3); a tapped confirmation publishes a review at medium weight and *"advances nothing."* Scan completion rate is a release gate carrying double weight (ADU-PROJ-01 S12) -- it gates verified reviews **and** it is the currency of the ladder.
>
> An interface that offers *Scan* and *I received it* as equal buttons teaches the cheaper one, and the cheaper one is the one a seller has an incentive to coach. So: the scan is the action; the tap is available underneath it, plainly labelled as the weaker record, reached in one more step. **This is not friction for its own sake -- it is the product's only differentiator being defended in the one place it can be lost.**

### 7.7 Claims -- one screen carries a data-protection ruling

ADU-DPIA-01 S6 calls the single-transaction rule *"the single best minimisation decision in the design"* and says it **should be stated in the claim interface, not buried in terms.**

> **INVARIANT -- the claim evidence screen asks for a single transaction record and says, in its own copy, that a full bank statement must not be uploaded and why.**
>
> A statement reveals a balance, a salary and every other payee. A transaction record proves the same fact. A buyer who uploads a statement has over-disclosed to a seller and to us, and the interface is the only place that can prevent it.

The evidence export (`POST /v1/claims/{id}/evidence-export`) returns the buyer's own order, chats and payment records and **carries nothing about who the seller is** -- seller identity goes to law enforcement through an operator path that is not in this contract.

### 7.8 Chat

| Surface | Endpoints | Constraint |
|---|---|---|
| Conversations | `GET /v1/conversations?as=buyer` | **`as` has no default.** Absent -> 400 `SCOPE_PARAMETER_REQUIRED` (R10). One account holds both roles and an unscoped list interleaves a seller's business with their own shopping |
| Start a conversation | `POST /v1/conversations` | Anchored on **exactly one** of `product_id` or `order_id` (G1.10). Without an anchor the assistant escalates instead of answering, and containment then measures the missing anchor rather than the assistant |
| Messages | `GET`/`POST /v1/conversations/{id}/messages` | Body carries `text` or `chip_id`. Human messaging is free on every tier |
| Bot replies | -- | `sender_kind: "BOT"`, rendered from `template_key` + `slots`. **Never assembled prose** |
| Escalate | `POST /v1/conversations/{id}/escalate` | Free, always available |

Chips carry the load in Amharic, deliberately: free-text Amharic understanding is deferred, and *"a bot that misunderstands Amharic and answers confidently is worse than one that offers buttons."*

### 7.9 Notifications, follows, account

| Surface | Endpoints | Constraint |
|---|---|---|
| Notification centre | `GET /v1/notifications?as=buyer`, `POST .../read`, `read-all` | Same scope rule as chat. Read state syncs across surfaces |
| Permission | `PATCH /v1/devices/{id}` + `POST /v1/events` | Requested **after the first reservation, never at first launch**. S10.2 |
| Feed | `GET /v1/feed` | Recency over the followed set. **No sort, no recommended, no similar_to** |
| Follow preferences | `PATCH /v1/follows/{handle}/preferences` | One canonical follow state regardless of which surface created it |
| Sessions | `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{id}` | Individual revoke only. **`revoke-others` is `CONSOLE`-only (D-34) and the app must not render a control for it** |
| Delete my account | `/v1/deletion/otp/request`, `/otp/verify`, `GET /v1/deletion/preview`, `POST /v1/deletion/confirm` | B23. Blockers arrive as `items[]`; **every blocker names its clearing action** |

> **RULING B23 -- in-app deletion drives the same anonymous ticket flow, and the app re-verifies the phone number by OTP even though a session is present.**
>
> ADU-PRD-01 S23 requires *"an in-app path plus a web-accessible URL"*, and Apple requires the in-app one before submission. **The only deletion path in the contract is ADU-API-01 S12.18, which is titled *from the web* and is specified with a web page order** -- nothing marks it reachable from `MOBILE` and nothing says the app must drive it (S22 **F9**).
>
> It is callable, because it is anonymous. The question is whether the app should shortcut it with the session it already holds, and the answer is no. `/v1/deletion/otp/verify` returns *"a single-purpose ticket, not a session"*, and the inverse must hold too: **a session must not mint a deletion ticket.** A phone left unlocked in a shop should not be two taps from deleting an account, and re-verifying the number is the only control between those two states. The friction is the feature.
>
> The app still owes the web page's order -- **explain, then phone, then code, then confirm** -- because *"a person should know what they are requesting before identifying themselves"*, and `GET /v1/deletion/preview` exists so that the explanation is server-supplied and cannot drift from what deletion does.

## 8. Media -- in both directions, and neither transits the API

### 8.1 Reading: three derivatives, and the list never asks for the largest

ADU-PRD-01 S7.4 retains thumbnail, card and full. **The app requests the derivative that matches the slot** -- thumbnail in a grid, card in a list, full only on a product screen the buyer opened.

This sounds obvious and it is the single largest data cost in the app. A storefront grid of thirty products at `full` is a buyer's metered megabytes spent on images they scrolled past, on the exact device class ADU-PRD-01 S23 makes the binding constraint.

`expo-image` disk cache, **public media only** -- `media.adulis.example` serves public product media and nothing authenticated ever enters an image cache.

### 8.2 Writing: the buyer's payment evidence

Signed URL -> direct `PUT` to R2 -> commit. **No multipart body through the API** (ADU-API-01 S12.10's doctrine, and the API's body limit is 256 KB precisely because media never transits it).

> **RULING B10 -- evidence is downscaled on device to fit the 5 MB cap, and `EVIDENCE_TOO_LARGE` is a defect in the client, not a message to the buyer.**
>
> A payment confirmation screenshot from a modern cheap Android is routinely 4-8 MB. An app that forwards it and renders the server's rejection has told a buyer, at the moment they are trying to pay, that their phone is wrong. The app resizes and re-encodes -- long edge capped, quality stepped down until the bytes fit -- and only then uploads. The cap stays where it is; the client stops meeting it by accident.
>
> **Legibility is the constraint that bounds the compression**: the evidence exists so a seller can read a transaction reference. The gate is a human one -- S18 tier 4 requires a real screenshot from a real low-end device to remain readable after processing.

Uploads are resumable where the platform allows, and a failed upload leaves the order in `PAYMENT_SUBMITTED`? **No -- it leaves it exactly where it was**, because the commit call is what advances the state. A dropped upload is a retry, not a half-submitted payment.

## 9. Connectivity -- online only, and the deletion that must not go too far

### 9.1 The doctrine

> **RULING B25 -- Buyer Mode is online-only. It queues nothing, retries nothing across a process lifetime, and never presents server state it did not just receive.**
>
> Adopted from ADU-MOB-AMD-01, which withdrew the offline scan queue in full. **This replaces v1.0's B11, and B13 and B14 are withdrawn with it.**
>
> **The scan is a foreground request with in-session retry.** The scanner decodes, stamps `signed_at`, and POSTs immediately. On failure the buyer sees a plain retry state and stays on the screen; the app retries on connectivity regain **while that screen is open**, with backoff, never silently. **If the buyer leaves the screen or the app is killed, the scan is gone.**
>
> [!] **The cost, stated rather than buried.** A buyer in a compound with no signal now completes the order by tapping *I received it* -- medium weight, no level credit -- where the previous design would have delivered a verified handoff minutes later. **The seller pays that cost, in poor-coverage areas, and scan completion rate is the number it moves.** It is already a release gate carrying double weight (ADU-PROJ-01 S12), and S20.3 watches it from the first beta handoff rather than at the gate.

**What is gone with it:** the SQLite queue, the batch drain, the six client actions, the persisted clock offset, `REJECTED_HORIZON` as a client-visible state the buyer can reach hours later, and the reinstall-persistence problem that had no achievable answer on Android. **That was the largest single piece of work in this document and it is now three paragraphs.**

*Rejected:* Realm, WatermelonDB, PowerSync and every offline-first replication layer -- they solve a problem this product no longer has, and they solved it by putting a second copy of business state on the phone. **Also rejected: a background sync task**, because there is nothing to sync.

### 9.2 What may touch disk

| May persist | Must never persist |
|---|---|
| The device id and session token (secure storage) | **Any `/v1/*` response body** |
| **One** idempotency key and its cart hash (S5.2) | Payment instructions, in any form |
| Public product images (image cache) | Order, cart, chat, notification or claim content |
| Locale, upgrade-banner dismissal, permission state | A scan, in flight or otherwise |
| | The OTP, the phone number, the challenge id, or any log containing them |

> **INVARIANT -- TanStack Query's persistence is not enabled, and no `/v1/*` response is written to disk.**
>
> ADU-API-01 S9 makes authenticated reads `private, no-store`, and ADU-CON-01 R11 refused the equivalent for the console's service worker -- **a rule that is no longer an exception carved out for one surface, because no surface has one.** A cached order card is a card that can lie, and the one thing ADU-API-01 A6 spends four mechanisms defending is that the order card never lies. CI check, S18.

### 9.3 The scan, in full

```text
  camera decodes the QR
        |
        v
  parse the token  ->  reject anything not a well-formed Adulis token
        |               (an unknown QR is a plain "that is not an Adulis code")
        v
  capture, once:
     { nonce, order_ref, signature }  <- read out of the token, INVENTED BY NOBODY
     signed_at                        <- device clock, epoch milliseconds, at scan time
     reported_clock_offset_ms         <- from the last bootstrap, held in memory
        |
        v
  POST /v1/handoffs/sync   -- an array of ONE
        |
        +-- success  ->  render the outcome  ->  done
        |
        `-- failure  ->  SENDING, with a visible Retry
                          retries while the screen is open, with backoff
                          buyer leaves -> the scan is gone -> offer confirm-receipt
```

**Outcome rendering is ADU-API-01 S12.6.1's table, with the local-copy column gone:**

| `outcome` | The buyer sees |
|---|---|
| `VALID` | Complete |
| `LATE` | Complete, badged *confirmed by buyer* |
| `REJECTED_REPLAY` | **Nothing** -- a replay reaching the buyer as a rejection is the worst possible answer at a doorway |
| `REJECTED_HORIZON` | Expired, explained plainly. Rare now, and if it is not rare something is wrong with the device clock |
| `REJECTED_SIGNATURE` | Nothing; logged |
| `REJECTED_UNKNOWN_ORDER` | Nothing; logged |

`replay: true` with a stored outcome is **success, not rejection.**

> **INVARIANT -- the app never predicts an outcome and never tells the buyer whether a scan counted toward the seller's level.** `counts_toward_level` is a server determination made against `received_at` and a grace window the client cannot see.

**The server's tolerance for a scan that arrives later than it was taken is kept in full** (ADU-MOB-AMD-01 B24) -- so a buyer who fails, walks ten metres and scans again at 18:42 still gets a verified handoff. **The client is online-only; the server did not become impatient.**

### 9.4 "The client signs once" -- and the trap in those three words

**This is the most important paragraph in the document, and ADU-API-01 v1.11 still carries the sentence that causes it.**

S12.6.1 opens: *"INVARIANT -- the client signs once, at the moment of scanning, and stores the signed blob."*

ADU-DB-01 S14.2 G1.4 says something that sounds compatible and is not: *"the token is a server-minted HMAC over (order_id, nonce, key_version)... **client-side signing was the alternative and is worse in every direction** -- key distribution to phones, key theft from a device, and it still would not defend against the party holding the key."*

**Read together by an agent building the scanner, the first sentence instructs it to sign and the second forbids the only way it could.** The plausible output is an HMAC key embedded in the app bundle -- a key shipped to every phone, extractable from any APK, forging any scan.

> **RULING B12 -- the buyer's device holds no key and performs no cryptography. `signature` is the server-minted token transcribed from the QR, unchanged.**
>
> *"Signs once"* means **captures once and freezes**: the tuple is fixed at the moment of the scan and every retransmission is byte-identical. That immutability is the entire mechanism -- it is what lets the server discriminate an idempotent retry from an attack.
>
> **Nothing is weakened by the device having no key.** The token is unforgeable because the server minted it; the nonce is single-use by a `UNIQUE` index; and only the buyer on the order can write a scan at all, by the composite foreign key to `("order".id, buyer_account_id)`. A third party who photographs the QR gains nothing.
>
> **Confirmed by D-156**, which records the built shape: `GET /v1/seller/orders/{id}/qr` returns `{order_ref, nonce, signing_key_version, signature}`, and *"`signed_at` is deliberately NOT in it: the SCANNER stamps epoch milliseconds at scan time."*
>
> **Enforced as an absence:** `apps/mobile/src/features/handoff/` imports no crypto module, and CI greps for it.

**ADU-MOB-AMD-01 B2 carries the correction to ADU-API-01's wording. Until it is applied, the contract still instructs the wrong thing**, and this section is the only place that says so.

> [!] **And one ruling is owed before this scanner exists.** D-156 records the QR payload encoding as **interim** -- one exported function producing compact JSON -- and asks for a ruling on field names, ordering, and whether the payload should be JSON, a URL or compact binary at all. **The buyer's scanner is the second half of that contract.** S24 Q11.

### 9.5 The five things that must not be deleted with the queue

**An agent told "remove offline" will over-delete, and one of these re-opens a defect the contract names by number.** Adopted from ADU-MOB-AMD-01 B26.

> 1. **The persisted idempotency key for `POST /v1/orders`** (S5.2). It defends against a process kill mid-request, which happens on a good connection. **Deleting it re-opens ADU-API-01's gap A2** and produces a second order, a second stock decrement, and a buyer charged twice by their own bank.
> 2. **The device id and session token in secure storage.** Persistence of a credential is not an offline capability.
> 3. **The public product-image cache.** It saves the buyer's metered data. It never holds an authenticated response.
> 4. **The in-app notification fallback** -- the badge and countdown where push permission was denied. That is an **online** surface reading `expires_at` from a live response (S10.3).
> 5. **`expo-updates` and the app shell.** A shipped bundle is not cached server state.

## 10. Push notifications

### 10.1 Registration

Token from FCM or APNs -> `PATCH /v1/devices/{id}` with the token and the permission state. **On every cold start**, not only at first grant: a rotated token that we never learn about is a device that silently stops receiving the SIM-swap warning (S4.4).

### 10.2 The permission is asked once, at the right moment

**INVARIANT -- notification permission is requested immediately after the first reservation, never at first launch** (ADU-PRD-01 S9.3).

A permission asked at launch is asked before the buyer has any reason to say yes, and both platforms give one chance. Asked after a reservation, the reason is on the screen: *the seller is holding your order for 48 hours.*

The result -- granted, denied, not asked -- goes to the device row **and** emits `notification_permission_result`, which is one of only two client-observed events the system permits (ADU-API-01 S11). See S22 F3: the contract currently names four such events across two sections that each claim to be a closed list of two, and the app emits nothing until that is reconciled.

### 10.3 The denied path is a requirement, not a fallback

**INVARIANT -- where permission is denied, the order card carries a persistent badge and a countdown with the same information the notification would have carried** (ADU-PRD-01 S9.3, S17.3; ADU-DB-01 S20). *"Android 13 and later let buyers refuse notifications, and a refused permission must not mean a lost order."*

> **A distinction that looks like a violation and is not.** ADU-PRD-01 S23 forbids clients computing expiry. A countdown rendered from `expires_at` -- an absolute RFC 3339 timestamp the server supplied -- is **display**, not computation. The client is not deciding when the order expires; it is formatting a moment the server decided, in the market's timezone, via `Intl`.
>
> The line is bright: the app may render the distance to a server-supplied instant. It may never conclude from that instant that the order *has* expired, change the order's state, hide an action, or take any decision the server has not already returned. When the moment passes, the app re-reads.

### 10.4 What the app must never do with a notification

> **RULING B15 -- the app schedules no local notification for any order deadline, ever.**
>
> This is the mobile shape of *"clients display state and send intents."* A locally scheduled reminder is the client asserting a future state, and the whole of ADU-API-01 S11.1 exists because **that assertion goes stale**: the buyer's payment confirms at 21:04 and the server's four mechanisms -- the dispatch guard, the TTL, the collapse key, and the displacing confirmation message -- combine to make sure the expiry warning never arrives. A local notification sits in the OS, outside every one of them, and fires at 21:30 telling a buyer who has paid that their order is about to be released.
>
> There is no local reminder that is safe, because the app cannot know what changed while it was closed.

**On open, the app deep-links to the order and re-reads it.** The payload carries `order_id`, `notification_id`, a deep link and display text and *"asserts no state the app cannot re-verify on open"*; the app must not render an amount, a deadline or a state name from the payload.

**Tray behaviour:** `tag = order_id` on Android so a newer message replaces an older one rather than stacking, matching the server's `collapse_key = "order:{order_id}"`. On iOS the server's collapse id does the same work; the client sets `threadIdentifier` so the buyer sees one thread per order.

**Lock-screen content is already safe by construction** (ADU-DPIA-01 R13): the two buyer notifications name the seller and a time, and payment evidence never appears in a preview because the buyer app never renders evidence at all.

## 11. Deep links

**One URL, two behaviours, no branching logic on the page** (ADU-PRD-01 S21.1): with the app installed, an Adulis storefront or product URL opens the app on that exact surface; without it, the same URL renders the public web storefront.

What that requires, all of it blocked on the domain decision (S24 Q1):

| Platform | Artefact | Trap |
|---|---|---|
| Android | `/.well-known/assetlinks.json` on the apex, served as `application/json`, no redirect | **The fingerprint must be the Play App Signing key's, not the upload key's.** They are different, and the difference is invisible until App Links silently degrade to a chooser dialog in production |
| iOS | `/.well-known/apple-app-site-association`, `application/json`, **no redirect, no query string** | Universal Links do not fire for a URL typed into Safari, or from some in-app browsers. The web page must stand alone -- it does, by design |

**Link handling rules the app owes:**

- **A deep link into an authenticated surface with no session lands on the anonymous equivalent, never a dead end.** A push into an order the buyer is signed out of shows sign-in, then the order.
- **A deep link never bypasses `UPGRADE_REQUIRED`** (S6.1).
- **Deep-link input is untrusted.** Handle and slug are shape-validated before they are routed or interpolated into a request.
- The link map lives in the route tree (S3.2) and every entry has a test in the T2 gate.

**Install attribution is weaker than it was and the honest figures are the ones we publish** (ADU-PROJ-01 S9.3): short codes are gone, attribution comes from platform deep links where available and otherwise from the seller a buyer first transacts with.

## 12. Localisation, and the Ge'ez mechanism that does not exist on mobile

The catalogue is the console's: `packages/locale`, where `en.ts` defines the key union and `am.ts` is `Record<MessageKey, string>`, **so a missing Amharic string is a compile error.** Whole sentences with named slots, never fragments. All formatting is `Intl` against the market timezone from `/bootstrap`; the wire carries `{amount_minor, currency}` and RFC 3339 UTC only.

> **RULING B16 -- the console's `unicode-range` mechanism has no equivalent in React Native, and the Ge'ez legibility guarantee therefore becomes a measured release gate rather than a declaration.**
>
> ADU-CON-02 S9 solves the mixed-script problem with per-family `unicode-range` in CSS: Inter first, Noto Sans Ethiopic as fallback, each carrying only its own glyphs. **React Native has no `unicode-range` and no font-family fallback list** -- a `Text` with `fontFamily: 'NotoSansEthiopic'` renders every Latin character and every digit from that font or from whatever the platform substitutes, and the platforms substitute differently.
>
> What ships instead: both families are bundled; **no component ever sets an Ethiopic-only family**; the default text style is Inter and the platform's own per-character fallback supplies Ge'ez, which both Android and iOS do reliably for text that is *not* forced into a custom family. The guarantee that ADU-PRD-01 S23.1 actually asks for -- *"the wordmark, both platform names and at least one figure must render as characters, not boxes"* -- is checked **on a physical device, in both locales, as a release gate**, because there is no build-time declaration that can promise it here.

Also carried, and each has bitten a mobile build before it bit a web one:

- **40% text expansion assumed in every container**; no fixed heights; no truncated button labels.
- **`allowFontScaling` is honoured**, and every screen is checked at the largest OS text size. A buyer on a cheap phone with large text is a real and common user, and a clipped payment instruction is a wrong bank transfer.
- Hermes ships `Intl`; the build verifies it rather than assuming it, because a stripped `Intl` renders every price and every deadline wrong in exactly one locale.
- **`AM_ENABLED` hides the switcher until human translation passes the gate** -- machine output satisfies the type check, not the release.

## 13. Performance -- the budget, and the device it is measured on

The binding constraint is unchanged and it is not the phone the developer owns: **a low-end Android over a slow, metered connection** (ADU-PRD-01 S23, ADU-PD-01 S14).

> **RULING B17 -- a physical reference device is purchased before Tier 0, and every performance gate is measured on it. A simulator number is not evidence.**
>
> Two devices: a low-end Android (2 GB RAM, Android 12 or the oldest supported) and the oldest iPhone in support. ADU-LEG-01 S6.4 notes Art. 33 duty-free import covers *"the low-end Android test devices that ADU-PRD-01 S23 makes a hard requirement"* -- so this is a budgeted line, not an afterthought.

**Budgets, proposed as defaults in the manner of ADU-VAL-01 S2 -- reasoned, not yet measured, and tuned by evidence rather than argument:**

| Budget | Default | Why this one |
|---|---|---|
| Cold start to first interactive screen | <= 3 s | Beyond this the buyer assumes the app is broken |
| Storefront screen usable, warm cache, 3G | <= 2 s | It competes with a web page that server-renders in one round trip |
| Android download size | <= 30 MB | Metered data; App Bundle with split ABIs, not a universal APK |
| Memory, storefront grid of 60 products | <= 200 MB | The 2 GB device has far less than that free |
| Data per storefront visit, images included | <= 1.5 MB | S8.1's derivative discipline is what buys this |

**No polling anywhere.** The order card re-reads on view and on foreground; the notification centre re-reads on view; nothing runs on a timer. A1 S4.5 recorded console polling as ~26% of all origin traffic and the first optimisation worth making after launch -- **the buyer app does not repeat that mistake, and on mobile it would additionally be spending the buyer's own money.**

## 14. Security posture on the device

### 14.1 The three that do the work

**The token is in Keychain / Keystore.** ADU-SEC-01 S4's table applies by analogy: general-purpose storage is readable by anything that gets code execution, and native secure storage has no XSS surface, which is why ADU-API-01 S5.1 keeps the bearer here rather than moving the console's cookie approach across.

**No authenticated data at rest** (S9.2). A lost or stolen phone yields the token -- which the buyer revokes from another device, immediately, on the next request -- and nothing else.

**The isolated boundaries are not reachable from here.** ADU-ARCH-01 S10: *"no mobile path reaches a `SECURITY DEFINER` function that the web path does not."* Buyer Mode reaches exactly one decrypting function, `financial.render_payment_instructions`, through one endpoint, on an order the caller is the buyer of, and that call writes its own access-log row in the same transaction.

### 14.2 Logging and redaction

Mirrors ADU-CON-02 S20.3's allow-list, inverted for a client: **never logged, never in a breadcrumb, never in a crash report** -- the phone number, the OTP, the session token, the device id, any bank account number, the order QR token, message content, and the contents of any `financial` response.

The `X-Adulis-Request-Id` from the response **is** logged, and it is what a buyer's support report is correlated by.

### 14.3 Certificate pinning -- considered, rejected, with a trigger

> **RULING B18 -- no certificate pinning at MVP.**
>
> Pinning defends against a compromised certificate authority. What it costs here: the API sits behind Cloudflare, whose certificates rotate on a schedule we do not control, and **a pin lives in native configuration, so a broken pin cannot be fixed over the air.** The failure mode is every installed copy of the app unable to reach the API, fixable only by a store round that takes days. That is a self-inflicted total outage traded against a threat that HSTS, TLS and Certificate Transparency already address.
>
> **Reopen if** the app ever carries a credential that survives session revocation, or if a market requires it.

### 14.4 The remaining rules

- **Deep-link and QR input is untrusted** and shape-validated before use.
- **The WebView is confined to embeds** (B8) and receives no injected script.
- **Nothing is written to the clipboard automatically.**
- **Root/jailbreak detection is not implemented** -- it is bypassed trivially, it punishes legitimate users, and there is nothing on the device worth protecting from its owner.
- **Over-the-air updates never change native permissions or materially change function** (S19.2).

## 15. What Buyer Mode never does

The mirror of ADU-CON-02 S10. **If a screen seems to need one of these, the screen is wrong.**

No price, tier name, upgrade prompt or billing link, anywhere, on any screen  -  no seller-recruitment call to action (S16.2)  -  no cross-seller search, browse or recommendation  -  no ranking, sorting or personalisation parameter on any request  -  no assertion that a payment is genuine  -  no characterisation of a seller in any direction  -  no computed expiry, level, entitlement or eligibility  -  no local deadline notification  -  no queued or deferred write of any kind  -  no cached authenticated response  -  no cryptographic operation  -  no third-party SDK  -  no `revoke-others` control  -  no seller, courier or operator capability of any kind.

## 16. The In-App Purchase constraint, applied to the surface where it is easiest to breach

ADU-ARCH-01 S4 and ADU-API-01 S4.1 are written about the Seller Companion, and the reflex is to treat them as somebody else's problem. **They bind the binary, and the binary is this one.**

> **INVARIANT -- no screen in Buyer Mode contains a price, a tier name, the word upgrade, a purchase flow, or any link, button, banner or deep link to a billing surface.** No endpoint Buyer Mode calls returns one; the billing group is `CONSOLE`-only and a `MOBILE` session receives **403, never a redirect -- a redirect is itself a link to an external purchase mechanism.**

### 16.1 Where it would actually leak

Not from a pricing screen nobody would build. From three ordinary places:

1. **An error string.** `TIER_LIMIT_REACHED` reaching the buyer's chat surface because a seller's chatbot cascade hit a cap. The app renders `message_key` + `slots` from its own catalogue, and **the catalogue is greppable** -- S18's string gate makes a tier name in `en.ts` or `am.ts` a build failure.
2. **A help or onboarding screen** explaining what Adulis is, written by someone reasonably describing the business.
3. **A "become a seller" affordance**, which is the natural product instinct and is dealt with next.

### 16.2 The seller-recruitment question, ruled the cheap way

> **RULING B19 -- Buyer Mode carries no seller-recruitment call to action at MVP.**
>
> The tempting control is *"Sell on Adulis -> opens the website."* ADU-ARCH-01 S4 names the shape of the trap: a control directing a customer to an external mechanism where they will eventually pay is *"the documented rejection pattern."* Whether a waitlist form is caught by that reading is a question about store guidelines that **move**, and ADU-ARCH-01 already flags that our knowledge of the current text may be out of date.
>
> The cost of not having it is close to zero: the beta cohort is recruited by hand from a waitlist the marketing site owns (ADU-WEB-01 S2), and every applicant is read by a founder. **We are trading a control worth almost nothing against a rejection round that costs weeks.**
>
> Reopen after the paid review in ADU-ARCH-01 S4, with a written answer, before the second submission -- not before the first.

### 16.3 The copy invariants are not a website thing

> **INVARIANT -- ADU-WEB-01 S3's copy invariants bind every string in this app.**
>
> Never *buyer protection*, *protects buyers*, *guaranteed*, *safe purchase*, *secure transaction*, *we make sure*, *we check*, or any synonym -- there is no escrow, and a claim here is a promise the company cannot keep. Never a seller characterisation in either direction. Never an implication that Adulis verified a payment. The buyer **scans**; they do not *confirm receipt* when what they did was scan, because those are two different evidence tiers and the distinction is the product.
>
> This needs saying because ADU-WEB-01 reads as a website document, ADU-CMO-01 M1 assigns ownership of those invariants to the CMO, and **the app's strings are written by a different person in a different repository.** The same claim is the same claim wherever it renders. S18's copy review covers `packages/locale` in full.

---

# PART B -- BUILDING IT

## 17. The repository, the seam, and day one

### 17.1 Where the app lives

**ADU-REPO-01 v1.3 governs the tree, the ownership and the boundaries, and it exists now.** v1.0 was written against a description of it. Five workstreams in one repository -- the shared backend, the database, the seller console, **the mobile app** and the storefront -- with one owner on every path, four dependency rules enforced by `dependency-cruiser`, and three seams.

**The four rules, verbatim, because the second is the one this workstream will break:**

| # | Rule |
|---|---|
| 1 | `apps/*` **may** import from `packages/*` |
| 2 | `apps/*` **may never** import from another `apps/*` |
| 3 | `packages/*` **may never** import from any `apps/*` |
| 4 | `packages/*` may import from other `packages/*`, acyclically |

> **Rule 2 will be broken helpfully.** A mobile developer needing a type the API already defines will import it from `apps/api/` because it is right there and it works. **The correct move is to move the shared thing into `packages/`, not to reach across** -- and with one engineer *"nobody is inconvenienced by a shortcut across a boundary, so nothing but the tooling objects."*

**The three seams, and the mobile app crosses only the first two:**

- **`contracts/openapi.json` -> `packages/api-client`.** CI is the file's only author; a hand-authored diff fails the build. **The mobile app imports `@adulis/api-client` and never `apps/api`.** If a type is missing there, the endpoint does not exist and the answer is the Prism mock.
- **`packages/tokens`** -- platform-neutral values. **The console consumes them through Tailwind; mobile consumes them directly. No component lives there**, because a React web button and a React Native button share values, not code.
- **`packages/locale`** -- `en.ts` defines the key union, `am.ts` is `Record<MessageKey, string>`, so a missing Amharic string is a compile error in whichever app first uses the key.

| May import | Must not import |
|---|---|
| `@adulis/api-client`, `@adulis/locale`, `@adulis/tokens`, `@adulis/config` | Anything under `apps/` -- not `apps/api` for a type, not for a Zod schema, not for a constant |

### 17.2 Inside `apps/mobile`

```text
apps/mobile/
|--- app/                            # Expo Router -- the file tree IS the link map
|   |--- _layout.tsx                 # providers: Query, locale, session, bootstrap gate
|   |--- (tabs)/                     # home/feed, orders, notifications, account
|   |--- s/[handle]/index.tsx        # storefront          <- App Link / Universal Link
|   |--- s/[handle]/p/[slug].tsx     # product             <- App Link / Universal Link
|   |--- cart/                       # cart, reconciliation
|   |--- orders/[id]/                # card, instructions, evidence, cancel, review
|   |--- scan/                       # camera, in-flight state, retry
|   |--- claims/                     # file, evidence, export
|   |--- chat/                       # conversations (as=buyer), messages
|   |--- auth/                       # phone, code + age declaration, sign-in
|   `--- upgrade-required.tsx        # the floor screen -- reachable with no session
|--- src/
|   |--- api/
|   |   `--- client.ts               # THE ONLY fetch in the app (B5). Wraps @adulis/api-client
|   |--- session/                    # secure store, device id, 401 handling (B4)
|   |--- bootstrap/                  # version floor, clock offset, market, flags
|   |--- features/
|   |   |--- storefront/ cart/ orders/ payment/ review/ claims/ chat/ follow/
|   |   `--- handoff/                # scan + retry. IMPORTS NO CRYPTO (B12)
|   |--- store/                      # SQLite: the order idempotency key. NOTHING ELSE
|   |--- notifications/              # registration, permission, deep-link routing
|   |--- i18n/                       # bindings onto @adulis/locale
|   `--- components/  lib/           # primitives on @adulis/tokens, Intl, image sizing, errors
|--- assets/fonts/                   # Inter + Noto Sans Ethiopic
|--- app.config.ts                   # config plugins: App Links, FCM/APNs, camera, secure store
|--- eas.json                        # build profiles and update channels
|--- maestro/                        # the five journeys that must not break (S18)
|--- CLAUDE.md                       # ADU-REPO-01 S8 -- the workstream's instruction file
`--- .claude/settings.json           # claudeMdExcludes + Read deny rules -- S17.5
```

> **v1.0 called the persistence directory `offline/`. It is `store/`, it holds one row, and the rename is the point** -- a directory named for a capability the app does not have is where that capability grows back.

### 17.3 The seam to ADU-CMP-01, written before either side exists

The Companion ships later into this same binary. **The seam is drawn now, because a boundary added after the fact is a refactor and a boundary drawn first is a directory.**

| | Buyer Mode | Seller Companion |
|---|---|---|
| Routes | `app/(tabs)`, `app/s`, `app/cart`, `app/orders`, `app/scan`, `app/claims`, `app/chat?as=buyer` | `app/(seller)/...`, entered only through the mode switch |
| Requests | No `X-Adulis-Seller` header, ever | `X-Adulis-Seller` on every `/v1/seller/*` call |
| Scope | `?as=buyer` | `?as=seller&seller_id=` |
| Shared | The API client, the session, the device row, the locale catalogue, the primitives | Same |
| Not shared | Nothing in `src/features/*` is imported across the seam | Nothing |

> **INVARIANT -- no Buyer Mode module sends `X-Adulis-Seller`, and no Buyer Mode request carries `as=seller`.** Enforced by a `dependency-cruiser` rule and a grep. The failure this prevents is ADU-AUTH-01 S8.3's two-tab bug arriving on a phone, where it is worse: one screen, one session, and a seller confirming a payment on the wrong store.

**Mode switching never re-authenticates** (ADU-AUTH-01 S3). One session reaches both, because roles are relationships on an account.

### 17.4 Day one

```bash
fnm install 22 && fnm use 22          # matches .nvmrc
corepack enable && corepack prepare pnpm@latest --activate
git clone git@github.com:<org>/<repo>.git && cd <repo>
pnpm install
docker compose up -d                   # Postgres 17 + the four extensions
pnpm db:migrate && pnpm db:check       # sixteen checks
pnpm db:seed
pnpm --filter api dev                  # api :3000
pnpm --filter mobile build:dev-client  # EAS development build, once
cd apps/mobile && pnpm dev             # Metro, against the LAN address of :3000
```

**Three corrections to v1.0, all from ADU-MOB-00 S1 and all accepted:**

- **OTPs are written to a gitignored `.dev-sms.log`, not printed to the terminal.** `console.*` is banned in `apps/api` and the logger cannot carry an OTP. **On a shared or multi-user machine that file must not be used at all** -- its `0600` mode is a no-op on Windows, where ACLs inherit (ADU-RUL-04 S4).
- **`pnpm db:check` is sixteen checks**, not fifteen.
- **One owner, every path.**

**And two operational facts from ADU-REPO-01 that cost a day if met later:**

- **Start the session from `apps/mobile`, not the repository root.** From the root an agent loads only the root instruction file -- so it has none of this workstream's rules and all of the backend's. *"The single most consequential operational habit in this document, and it costs nothing to adopt and is invisible when it is skipped."* Project settings load only from the directory you start in, which is why the per-app `settings.json` is not optional.
- **The Prism mock's base URL is an origin and nothing more.** `/v1` lives in the OpenAPI path keys; a base URL carrying `/v1` as well produces `/v1/v1/bootstrap`. Prism is pinned at 5.14.2 because >=5.15.7 requires Node 24 and the repository is Node 22.

**Definition of a working setup:** the development build installs on the reference device, `GET /v1/bootstrap` succeeds against the local API, and the seeded buyer signs in with an OTP read from `.dev-sms.log`. If any of that fails, fixing it *is* the day's work.

> **RULING B20 -- development happens in an Expo development build, not in Expo Go.**
>
> Expo Go cannot load the config plugins this app depends on -- App Links and Universal Links, FCM and APNs registration, the camera permission strings, secure storage. **"It works in Expo Go" is a false green**: it means the feature was tested in an environment that shares neither the native configuration nor the signing identity of anything a buyer will install.

**A physical device is not optional for this app.** The camera, App Links, push registration, SMS autofill, the Ge'ez render and every performance budget are all things a simulator answers incorrectly and confidently.

### 17.5 How we work, and what `apps/mobile/CLAUDE.md` carries

The loop is ADU-CON-02 S14.2's, unchanged: **document -> work order -> agent within one slice -> a command that verifies -> review against the checklist -> PR.** Output that disagrees with this document amends the document first.

**v1.0 said `AGENTS.md`. The instruction file is `apps/mobile/CLAUDE.md`** (ADU-REPO-01 S8), it is per workstream, and **it cites this document rather than restating it** -- *"a rule that appears in `CLAUDE.md` and in a document will drift, and the copy an agent reads first is the one it follows."*

**ADU-REPO-01 S8 already fixes its one non-obvious rule:** no price, no tier name and no billing link anywhere in the bundle. The rest of the file is the list below.

> **The nine absences in the buyer app.** Each is a thing a competent generated implementation would add, and each would break something named in a binding document.
>
> 1. **No cryptographic key and no signing code** in `features/handoff` or anywhere else (B12)
> 2. **No queued, deferred or background write** -- no outbox, no sync task, no retry across a process lifetime (B25)
> 3. **No persisted API response** -- no Query persister, no cached order (S9.2)
> 4. **No locally computed expiry, level, entitlement or eligibility** (ADU-PRD-01 S23)
> 5. **No locally scheduled notification** (B15)
> 6. **No price, tier, upgrade or billing string** in the catalogue or in any screen (S16)
> 7. **No `fetch` outside `src/api/client.ts`** (B5)
> 8. **No strict response schema** and no closed render without a default branch (B1, S6.3)
> 9. **No third-party SDK** -- analytics, attribution, crash or otherwise (B2)
>
> Plus, carried from the console's list and equally binding: `X-Adulis-Seller` is never sent from Buyer Mode; `revoke-others` has no control; no endpoint, field or event name is invented; and **stop at the slice boundary and list what was not done.**

**And one thing that is not an absence: `src/store/` holds exactly one row.** Absence 2 deletes the queue and **must not delete the key beside it** (S9.5).

**The review model is CI and the adversarial pass.** ADU-REPO-01 S3.1 established that `CODEOWNERS` requested review from nobody from the day it was written, and branch protection does not apply on this plan -- so *"the review model has been CI and nothing else for the entire build."* The substitute is the agent's adversarial pass against its own work, recorded per the review convention, **and its weakness is named: a pass on your own work is a pass by the person who made the assumptions.** Where a change touches money, identity or a boundary, the second pass is not optional.

**The printed review checklist, mobile:** [ ] only slice files touched  [ ] no new dependency without a line in the PR saying why and whether it is a processor  [ ] every new POST has an idempotency key minted at mount and both locale entries  [ ] every closed-set render has a default branch  [ ] no authenticated value reaches disk or a log  [ ] the screen renders at the largest OS text size and in Amharic  [ ] negative-case tests exist, not only the happy path  [ ] `@adulis/api-client` regenerated, diff additive.

**Definition of done, per PR:** code + tests + both locale entries + the tier's gate green + a screenshot of the screen in Amharic at large text + reviewed. Not five of six.

## 18. The build sequence -- nine tiers, gated

The front end trails the API by nothing here: **every endpoint this app calls already exists and is already merged.** That is the one large advantage this workstream has over the console's, and it means each tier's gate can be run against a real server from the first day rather than against a mock.

| Tier | Contents | Gate -- a command or a device, never an opinion |
|---|---|---|
| **0** | Toolchain, EAS build profiles, dev client, `app.config.ts`, fonts, the API client generated from `openapi.json`, **the mobile jobs added to the repository's existing workflow** (ADU-REPO-01 S7) | A development build installs on **both** reference devices and reaches `/v1/bootstrap` against staging; `pnpm --filter mobile typecheck lint test` is green from the repository root and from `apps/mobile` |
| **1** | Bootstrap, the version floor, the clock offset, locale, the error mapper, the API client module | Setting `min_supported_client` above the build produces the blocking screen, and **no deep link or push gets past it**; two consecutive bootstraps produce a stable offset |
| **2** | Device registration, OTP sign-in, **the age declaration**, session storage, 401 handling, biometric unlock | The device id is **one row across ten cold starts and a reinstall-free OS update**; a grep proves the token is in secure storage and never in `AsyncStorage`; **a verify call carrying `audience` is rejected by the server and the app never sends one**; a first-time sign-in with the box unticked returns `AGE_DECLARATION_REQUIRED` and the screen says so; a server-side revoke ends the session on the next request and **leaves the device id, the cart and the order idempotency key intact** (B4) |
| **3** | Anonymous browse: storefront, product, search and filters, seller lookup, post-link paste, deep links, the embed WebView | An App Link and a Universal Link each open the exact product **on a physical device**; the same URL renders the web storefront with the app uninstalled; a post link tagged on three products returns three; **the product screen is fully usable with the embed never tapped** |
| **4** | Cart, reserve, reconciliation, the New-seller disclosure, the transaction cap | **All six per-line failure states render from `items[]`**; killing the app mid-`POST /v1/orders` and retrying produces **exactly one order** (B6); the disclosure is not dismissible and emits its event |
| **5** | Payment: instructions, evidence capture and downscale, submit, per-line cancel, refunds | A 12 MP screenshot uploads inside the cap **and the transaction reference is still readable** (B10); after a full session, `find` over the app container yields **no `/v1/*` response body and no bank detail** |
| **6** | Handoff: scanner, the foreground submit, in-session retry, the six outcomes, pending UI, confirm-receipt | With the network off, a scan shows **SENDING with a visible Retry and no success**; restoring the network **while the screen is open** completes it and renders the real outcome; leaving the screen offers confirm-receipt and **writes nothing to disk** (`find` over the app container returns no scan); a byte-identical resend returns `replay: true` and the original outcome, rendered as success; **`grep -rn "crypto\|hmac\|subtle" src/features/handoff` = 0** (B12); **`grep -rn "expo-sqlite\|BackgroundFetch\|TaskManager" src/` = 0** (B25) |
| **7** | Review, claims and evidence, reports, blocks | A review publishes at each of the three badges; **the claim screen states the single-transaction rule in its own copy**; a report control exists on every user-content surface, checked by walking the list |
| **8** | Chat, follows, feed, notifications, preferences, sessions, deletion | `as=` is present on every conversation and notification request (grep); **permission denied produces the badge and countdown on the order card**; in-app deletion completes and the blocked branch lists every blocker |
| **9** | Hardening and submission -- ADU-MOB-05, ADU-MOB-06 | S25's gates, both stores' pre-submission lists, the Ge'ez pass, the performance budgets on the reference devices |

**Tiers 1 and 2 are read line by line by hand.** Everywhere else a mistake is visible; there, a mistake produces a session or a device row that is quietly wrong for the life of the install.

**Tier 6 before tier 7 is not negotiable**, for the same reason ADU-CON-02 puts tier 3 before tier 4: the review, the badge and the ladder all hang off the scan, and building the review surface first teaches the builder to think of the tap as the normal path.

> **Tier 6 got smaller and it did not get easier.** The queue, the drain and the reinstall problem are gone (S9.1). What is left is the part that was always hard: **a doorway, a decoded token, one request, and a buyer who will not wait.** The retry budget in G1 -- how long the screen retries before it offers the tap -- is the whole of the user experience of this tier, and it is still unruled (S24 Q12).

### 18.1 CI -- the mobile jobs inside an existing workflow

**v1.0 specified a workflow. ADU-REPO-01 v1.3 S7 already has one, and it is path-filtered**: jobs select their workstream with `pnpm --filter "...[origin/main]"`, so a backend-only push does not typecheck the app. **This document adds jobs to that workflow; it does not propose a second one.**

The mobile job, when the filter selects it: install -> strict typecheck -> lint -> unit tests -> **the grep gates** -> the generated client regenerated from the committed `contracts/openapi.json`, diff additive -> locale completeness (a missing Amharic key is already a compile error; CI proves the catalogue has no orphan keys) -> **Maestro flows on an emulator**. Red on any; there is no skip label.

> **The gates below are NOT path-filtered.** ADU-REPO-01 S7 runs the repository-wide boundary checks on every push regardless of what changed, and these join them. A gate that only runs when someone touches `apps/mobile` is a gate that is off on exactly the push that moves a forbidden string into a shared package.

| # | Check | Expected |
|---|---|---|
| 1 | `fetch(` outside `src/api/` | **0** (B5) |
| 2 | `AsyncStorage` in the same file as `token`, `session` or `device_id` | **0** |
| 3 | crypto, hmac or subtle imports under `src/features/handoff` | **0** (B12) |
| 4 | `scheduleNotificationAsync` anywhere | **0** (B15) |
| 5 | Query persister, or any `/v1/` response written to storage | **0** (S9.2) |
| 6 | `X-Adulis-Seller` or `as=seller` under Buyer Mode routes | **0** (S17.3) |
| 7 | Price, tier, currency, upgrade, subscribe or billing terms in `packages/locale` mobile keys | **0** (S16) |
| 8 | A `WebView` outside `features/storefront/embed` | **0** (B8) |
| 9 | Any dependency not listed in the reviewed manifest | **0** (B2) |
| **10** | **`expo-sqlite`, `expo-background-fetch`, `expo-task-manager`, or any outbox, queue or drain identifier under `apps/mobile`** | **0** (B25) -- **new in v1.1, and it is the gate that keeps the deleted feature deleted** |
| **11** | **`audience` in any request body under `src/features/auth`** | **0** (D-180, S4.3) |
| **12** | **A hex colour literal (`#rrggbb`) anywhere outside `packages/tokens`** | **0** (ADU-MOB-03 D5) |
| **13** | **`NotoSansEthiopic` anywhere under `apps/mobile/src`** | **0** (ADU-MOB-03 D2) |
| **14** | **`includeFontPadding` anywhere** | **0** (ADU-MOB-03 D1) |

**Check 7 is the one that silently matters.** It is the App Store rejection reduced to a build failure, and it works because the app renders errors from a catalogue rather than from server prose (S5.1). A tier name cannot reach a reviewer's screen unless someone typed it into a file CI reads.

**Check 10 is the one that matters loudly.** Offline was withdrawn by a ruling, and a ruling that is not a grep is a ruling that comes back in six months as *"just a small local cache."* **S0.1 change 1 is that ruling coming back inside this document**, which is why the gate exists rather than the sentence alone.

**Check 14 is the one nothing else can catch.** `includeFontPadding: false` is the standard React Native recipe for tidy Latin text, it appears in every styling guide, and **on Android it clips the ascenders and descenders of Ge'ez** -- in a build that compiles, passes the compile-time locale check, passes checks 1 to 13, and looks perfect in English on an iPhone. **Its only other discovery point is a person holding an Android device, reading Amharic** (ADU-MOB-03 D1).

> **Gates 12 to 14 are authored by ADU-MOB-03 S8 and listed here because WO-0 reads this section.** They are repository-wide like the rest: **a gate that runs only when someone touches `apps/mobile` is off on exactly the push that moves a literal into a shared package.**

> **Two foot-guns in the workflow itself, both from ADU-REPO-01 S7 and both cheap now.** `actions/checkout` needs `fetch-depth: 0` or `...[origin/main]` has no `origin/main` to compare against and the filter silently selects everything -- or nothing. And a root script must not recurse into the workstream that calls it; `pnpm -r test` invoked from a package that defines `test` is an infinite descent that presents as a hung runner.

**The five Maestro journeys** -- chosen because each crosses a seam that unit tests do not: install to storefront by deep link; anonymous cart to first reservation including identity creation; payment instructions to evidence submitted; **scan with the network down, retry with it restored, outcome rendered**; and claim filed with evidence. *Rejected:* Detox -- the configuration cost against one engineer is a week that buys nothing Maestro's flows do not.

---

# PART C -- RUNNING IT

## 19. Releases

### 19.1 Channels

| | Purpose | Who |
|---|---|---|
| **development** | Dev client against a local or staging API | The two developers |
| **preview** | Internal testing -- Play internal track, TestFlight internal | Founders, on the reference devices |
| **production** | The store binary and its update channel | Buyers |

A release is: merge -> CI -> preview build -> **walk the affected journeys on the reference device, not the simulator** -> submit or publish. **Two-person rule: the merger is not the submitter**, matching ADU-CON-02 S19's promote discipline.

### 19.2 Over-the-air updates, and the line they must not cross

> **Plain terms:** an over-the-air update replaces the JavaScript bundle inside an already-installed app. The native binary -- permissions, modules, the icon, anything the store reviewed -- is unchanged and can only be changed by a new submission.

**This is the reason Expo earns its place** (S3.1): a JavaScript defect in a store-distributed app is otherwise a two-to-seven-day outage on the store's timetable, and Ethiopian buyers on metered data do not update promptly even once the fix is live.

> **RULING B21 -- over-the-air updates carry defect fixes and copy changes only. Anything that changes what a reviewer approved goes through a store submission.**
>
> Not permissions, not a new native capability, not a change of purpose, not a new data collection, and **never anything that would alter a privacy label or a Data safety declaration.** Both stores permit JavaScript updates within the reviewed app's purpose and both treat a material change as a violation; the ambiguity is in the word *material*, and this project does not spend its first submission finding the edge.
>
> **Every update is a version bump** and is reported as such (B7), so the floor and the counters stay meaningful.

**Rollback is republishing the previous update** -- seconds, and it is why the `ota-hotfix` and `rollback-ota` runbooks exist before the first incident rather than after it.

### 19.3 The version floor is an operational lever, and a sharp one

Raising `min_supported_client` **locks out every install below it**, immediately, at their next launch.

> **RULING B22 -- the floor is raised only when an older client would produce a *wrong* result, never for convenience, and never before a fix is already published and available on both stores.**
>
> Wrong means: it would show a buyer a state that is not true, take a decision the server has since moved, or breach an invariant. It does not mean: it lacks a new screen, it looks dated, or supporting it is tedious -- the contract is additive-only precisely so that old clients keep working.
>
> The floor is a two-person action with the same weight as a production promote, and **the number of installs it would cut off is measured before it is raised** (S20.3).

## 20. Maintenance

### 20.1 What is watched, given there is no crash SDK

**Play Console vitals** (crash rate, ANR rate, by device model and OS) and **Xcode Organizer** (crashes, hangs, launch time), reviewed in ADU-CON-02 S20.5's weekly half-hour, which gains two mobile lines. Both stores' reviews and ratings are read in the same slot -- for this product they are the only unsolicited buyer feedback channel that exists.

Server-side, the mobile app is visible through the API's own logs by `X-Adulis-Client`, which is what makes S20.3's counters computable without a client SDK.

### 20.2 Alarms

The API's alarms are unchanged (ADU-CON-02 S20.2). Two are added and both are client-shaped:

- **Scan submission failure rate above a threshold, by client version** -- the one number where a client defect corrupts the trust ladder rather than merely annoying a buyer. **It is now a live-request failure rate rather than a sync backlog**, which makes it faster to read and harder to ignore.
- **`UPGRADE_REQUIRED` responses rising** -- either the floor was raised carelessly, or a build is failing to update.

### 20.3 The counters, weekly

Each watches something that could stop holding silently. Added to ADU-CON-02 S20.3's five:

| Counter | What it is really watching |
|---|---|
| **Scan submission success rate, first attempt and after in-session retry** | **B25.** The first number is coverage at the doorway; the gap between the two is what the retry budget is buying. If the first-attempt rate is poor and retry closes it, the budget is right; if retry closes nothing, the buyer is somewhere with no signal and the tap is the honest answer |
| **Scanned handoffs : tapped confirmations** | **B9, and now the number that carries the cost of the online-only ruling** (AMD-01 G4). A rising tap share was previously an interface defect; it can now also be coverage. Read it with the counter above or it will be misdiagnosed |
| **Scans abandoned -- the screen was left while SENDING** | The scans the previous design would have delivered minutes later and this one loses. **Nobody was counting this before because it could not happen.** Watched from the first beta handoff, not at the release gate |
| **OTP requested -> delivered -> verified, split by platform** | ADU-AUTH-01 S6's F1. A platform-specific gap is an autofill or template defect, not a network one |
| **Notification permission grant rate** | If it falls, the in-app fallback carries more orders and S10.3 becomes load-bearing |
| **Installs below the floor, and the distribution of `X-Adulis-Client`** | Read *before* raising the floor (B22), not after |
| **`reserve_intent_web` -> `first_reservation_created`** | ADU-PROJ-01 S12's release gate -- the honest measure of how many buyers the install seam loses |
| **Idempotent replays on `POST /v1/orders`** | B6 doing its job. A rise means connections are worse than modelled, not that something is broken. **If this falls to zero after a release, suspect that the key was deleted rather than that the network improved** (S9.5) |

> **The first three replace v1.0's two sync counters, and the substitution is not like for like.** v1.0 watched a queue draining; there is no queue. These watch a buyer at a doorway deciding whether to wait. **That is a product number now, not an infrastructure one**, and it is the number ADU-MOB-AMD-01 put at risk on purpose.

### 20.4 Dependencies

Renovate monthly batches; security advisories immediately; everything pinned exact. **The Expo SDK moves as one**, on its own PR, with the release notes read and both founders approving -- an SDK major carries native changes and therefore a store round, which makes it a release decision rather than a dependency bump. React Native is never upgraded independently of the SDK.

**A new dependency is a document change, not a code change**: it is named in the PR, checked against B2, and if it touches personal data it enters ADU-DPIA-01 S3.2 before it is installed.

### 20.5 Runbooks

Added to ADU-CON-02 S20.6's set: **`store-release`**  -  **`ota-hotfix`**  -  **`rollback-ota`**  -  **`raise-version-floor`**  -  **`store-rejection`** (what to change, what not to concede, who answers the reviewer).

**Severity, mobile-specific:** an order created twice, or a scan the server accepted that the app rendered as a failure, is **SEV-1** -- both are money-or-trust wrong in the ADU-CON-02 S20.6 sense, and both are silent from the server's side. **A scan that never reached the server is not an incident; it is the ruling** (B25). The incident is the app being wrong about what happened, not the network being down.

## 21. What it costs

**Infrastructure is unchanged** -- the app adds no server. Push is free on both platforms; media and API load are already in ADU-CON-02 S21's figures, and A1's model already priced 350 authenticated buyer-app requests per seller per day.

| Line | Amount | Note |
|---|---|---|
| Apple Developer Program | ~$99/year | Organization enrolment; requires the D-U-N-S number |
| Google Play | $25 one-off | Organization registration is what exempts us from the 12-tester / 14-day closed-testing gate |
| EAS Build and Update | $0 to ~$19-99/month | The free tier is workable at this release cadence; the paid tier buys queue priority, and it is bought when a release waits, not before |
| Reference devices | ~$150-300 once | B17. Duty-free under ADU-LEG-01 S6.4 |
| **Total** | **~$150-450 first year** | Against ADU-CON-02 S21's ~$65-105/month infrastructure |

> **[!] The cost is not the problem; paying it is.** ADU-PROJ-01 S9.2 item 4 -- *"solve international card payment for both fees"* -- is an open blocker of the same shape as ADU-CON-02's O-1, and it is easy to leave until the week of submission. **Neither store accepts an application from a developer account that cannot pay.** It has a lead time (D-U-N-S is 1-4 weeks by itself) and it is on the critical path for a launch date nobody has scheduled yet. S24 Q2.

## 22. Findings -- what reading the set against this build produced

**Thirteen entries. Ten stand, one was dissolved by a ruling in this version, one was closed by the back end, and three are new since v1.0.** A finding is not deleted when it stops applying; the reason it stopped is worth more than the finding was.

| # | Finding | Kind | Status | Where |
|---|---|---|---|---|
| **F1** | **"The client signs once" and "client-side signing is worse in every direction" instruct opposite implementations.** The plausible output is an HMAC key in the app bundle | **Contradiction. Build-time trap** | **Open. ADU-API-01 v1.11 still carries the sentence**; the correction is drafted in ADU-MOB-AMD-01 B2 and not yet applied | B12, S9.4 |
| **F2** | **"Must not be lost on reinstall" is not achievable on Android** by any store available to an app, and on iOS only via the Keychain | Was: unmeetable as written | **Dissolved by B25.** There is nothing to persist across a reinstall, so the requirement has no subject. **Retained because the reason a requirement was withdrawn outlives the requirement**, and because the next person to propose an offline queue will propose this with it | S9.1 |
| **F3** | **The client-event allow-list has four names across two sections that each call themselves a closed list of two.** ADU-API-01 S11 names `notification_permission_result` and `follow_intent_web`; S12.16 names `NotificationOpened` and `PaymentInstructionsViewed` | **Contradiction** | Open. **The app emits nothing until it is reconciled** | S10.2 |
| **F4** | **`X-Adulis-Client` describes one version and an Expo build has two** -- the store binary and the running bundle. The floor is meaningless against the wrong one | **Absence** | Open | B7 |
| **F5** | **The Ge'ez guarantee is specified as a CSS mechanism that does not exist in React Native.** `unicode-range` is the whole of how ADU-CON-02 S9 delivers it | **Unmeetable as written** | Open. The mobile substitute is a device-measured gate, S25 | B16 |
| **F6** | **ADU-PRD-01 v8.5 S3 still carries "INVARIANT -- the iOS app contains no seller functionality"**, which ADU-ARCH-01 v2.0 reversed. ADU-DB-01 S26's matrix carries the same retired row, already noted as R9 | **Stale invariant** | Open, and **now demonstrably stale rather than merely contested**: ADU-API-01 v1.11 S4 records the resolved position -- iOS seller functionality is a release-checklist item, not an API control | S23 |
| **F7** | **No document states where the app's persisted data sits in the DPIA inventory.** P15 covers the device row; the session token, the order idempotency key and the image cache are on a buyer's phone and appear nowhere | **Absence** | Open, and **much smaller than in v1.0** -- the scan queue is gone, so the inventory row is four short-lived items and none of them is an authenticated response body | S23 |
| **F8** | **The Android SMS Retriever hash changes the OTP message template**, and the production hash comes from Play App Signing rather than from our key. ADU-AUTH-01 S4.4 specifies the message with no room for it | **Absence** | Open | S4.3 |
| **F9** | **In-app account deletion is required by ADU-PRD-01 S23 and by both stores, and the only deletion path in the contract is titled *from the web* and marked for no surface but the public site.** It is callable from the app because it is anonymous, and no document says it must be | **Absence. Store blocker** | Open | B23 |
| **F10** | **The age declaration was specified with no column, no endpoint and no write path** | Was: blocked capability | **Closed.** ADU-AUTH-01 v2.8 S18 carries `age_declared_over_18` in the verify body, the columns, and `AGE_DECLARATION_REQUIRED` as its own error code. **The screen is in tier 2** | S4.2 |
| **F11** | **`offline_sync_horizon` survives a withdrawal that removed the thing it is named after.** The column is right and its value still matters -- it is the server's late-arrival tolerance (B24) -- but its name now describes a client capability that does not exist, and the next reader will reasonably infer one | **Naming defect** | **New in v1.1** (ADU-MOB-AMD-01 C2). Renaming it is a migration for a cosmetic gain; **documenting it is not**, and ADU-DB-01 S14.2 should carry a sentence saying what it is not | S9.3 |
| **F12** | **The QR payload encoding is recorded as interim and the ruling is still owed** -- field names, ordering, and whether the payload is JSON, a URL or compact binary. **The buyer's scanner is the second half of that contract**, and it cannot be built against an interim | **Absence. Blocks tier 6** | **New in v1.1** (D-156, ADU-MOB-AMD-01 G2) | S9.4, S24 Q11 |
| **F13** | **A malformed `X-Adulis-Device` is answered with 500**, and the app sends that header on every request. A corrupted read from secure storage therefore produces an unrecoverable loop that is indistinguishable, from the app's side, from the server being down | **Absence -- server-side input validation** | **New in v1.1.** The client half is ruled (validate the shape before sending, re-register on failure, B3); **the server half should be a 400 with a code the client can act on** | S4.1 |

**F1 is still the one that would have cost the most**, and it is the one that has moved least: the correction has been drafted twice and the contract has advanced four versions without it. It is the same shape as R16 -- a word in a binding document that invites a plausible wrong implementation, catchable for nothing today and a key rotation plus a store round later. **The difference is that R16's trap produced a performance cliff and this one produces a signing key in every buyer's APK.**

**F12 is the one that blocks soonest.** Tier 6 cannot be built against an encoding marked interim, and unlike F1 it cannot be worked around by writing the client carefully -- **both halves of a scan contract have to agree on bytes.**

## 23. Documents to reissue

> **ADU-MOB-PLAN-01 S6 is now the consolidated register.** It carries thirteen targets across the whole series, deduplicated, and it is where the debt is tracked. **This section keeps only what this document's own findings owe**, so the two do not drift.
>
> **Read the amendment set first.** ADU-MOB-AMD-01 sections A-D already specify the offline withdrawal's edits to six of these documents; where a row here and the amendment set touch the same document, they are one reissue, not two.

| Document | Change |
|---|---|
| **ADU-API-01 -> v1.12** | ADU-MOB-AMD-01 section B in full  -  S12.6.1's wording: *"the client **captures and freezes** the signed token once"*, with a sentence stating the device holds no key (**F1**)  -  S3.2's `X-Adulis-Client` gains the runtime/binary pair (**F4**)  -  S11 and S12.16 reconciled into **one** client-event allow-list with one length (**F3**)  -  S12.18 retitled *account deletion -- anonymous* and recorded as the path **both** the web page and the app drive, with the rule that a session never mints a ticket (**F9**)  -  a documented 400 for a malformed `X-Adulis-Device` (**F13**) |
| **ADU-PRD-01 -> v8.6** | ADU-MOB-AMD-01 section A in full  -  S23.1's font-stack invariant gains a mobile clause: the guarantee is a device-measured gate where `unicode-range` does not exist (**F5**)  -  S3's client matrix and S3.0 rebuilt, already owed under ADU-ARCH-01 S9 and ADU-CON-01 R1 (**F6**) |
| **ADU-AUTH-01 -> v2.9** | S4.4 permits a build-specific autofill suffix on the sign-in template, stated as carrying no action name (**F8**)  -  S8.4's biometric default recorded as read from `roles[]` as a rendering hint, never as authorisation |
| **ADU-DB-01 -> v1.20** | S26's retired invariant rows corrected -- already owed as R9 (**F6**)  -  S14.2 gains one sentence saying what `offline_sync_horizon` is **not** (**F11**). **No schema change is required by this document, and none is required by the offline withdrawal either** -- if a migration appears, something was deleted that B24 says stays |
| **ADU-DPIA-01 -> v1.1** | A new inventory row for **data at rest on the buyer's device** -- the session token, the device id, the order idempotency key, the image cache -- with its retention and the note that **no authenticated response is persisted at all** (**F7**)  -  the store-provided crash reporting recorded as an existing platform relationship rather than a new processor (B2) |
| **ADU-VAL-01 -> v1.1** | D3's horizon value, whose floor is set by the in-session retry budget (S24 Q12)  -  3.2's fulfilment window and 3.8's delivery fee, both of which this app has to render (Q5, Q6) |
| **ADU-REPO-01 -> v1.4** | S7's repository-wide gate list gains **grep gates 10 and 11** (S18.1). They are not mobile-scoped: gate 10 is the rule that keeps a withdrawn feature withdrawn, and a filtered gate is off on the push that reintroduces it through a shared package |
| **ADU-PROJ-01 -> v9.1** | S9.1's client table rebuilt for ADU-ARCH-01 v2.0  -  S9.2 gains the international card payment blocker with an owner and a date  -  S12 gains the mobile release gates in S25 |
| **ADU-MOB-00 -> v1.1** | ADU-MOB-AMD-01 section E2 -- S4.4 deleted, the Ed25519 sentence struck, S2's *"or register findings against it"* struck |
| **ADU-CON-02** | Unchanged. This document is its counterpart, not a correction to it |

## 24. Open items

**Fourteen. Five of them can be closed by one person in one sitting and three of those block a gate**, which is the only ranking that matters on a one-engineer workstream.

| # | Item | Blocks | Note |
|---|---|---|---|
| **Q1** | **The domain** (ADU-WEB-01 S14, ADU-SEC-01 S15) | **App Links and Universal Links (tier 3), the deletion web URL, the privacy policy URL, and -- corrected in v1.2 -- Apple organization enrolment** | Apple requires a work email on the organization's domain and **a publicly available website at it** (ADU-MOB-05 S1.1). v1.1 recorded only the App Link dependency, which understated it: **this is the earliest item on the critical path, not a tier 3 item**, and it is still the cheapest decision on the list |
| **Q2** | **International card payment for the two store fees** (ADU-PROJ-01 S9.2) | Both store enrolments, and therefore any submission | **v1.1 said D-U-N-S is *"1-4 weeks by itself"*. Apple states up to 7 business days** -- five with D&B, two for Apple to receive it, and expediting does not shorten it (ADU-MOB-05 S1.1). **The overstatement mattered in one direction: it made the card look like the smaller of the two problems, and the card is the one with no owner and no stated lead time at all.** ADU-MOB-05 S1.3 puts it at the head of the critical path |
| **Q3** | **Article 22 hosting opinion** (ADU-DPIA-01 S2.1, R1) | Everything, still | Not this document's item, and it is above it. Recorded so that no mobile plan is written as though it were resolved |
| **Q4** | **Crash reporting** (B2, ADU-CON-02 O-4) | Nothing yet | Behind the DPIA. Reopen when the store-provided rate is not enough to act on |
| **Q5** | **The fulfilment window length** (ADU-VAL-01 3.2) | The order card's copy after `PAYMENT_CONFIRMED` | The buyer's card has to say something about what happens next, and the answer is a number nobody has chosen |
| **Q6** | **The delivery fee** (ADU-VAL-01 3.8, ADU-CON-02 O-6) | The order total the buyer is shown | `seller_fulfilment_method` carries no fee column, so either ruling is a migration and a change to this screen |
| **Q7** | **Reference device selection** (B17) | Tier 0's gate | A decision plus a purchase, both cheap, both blocking a gate |
| **Q8** | **Amharic human translation** (ADU-CMO-01 action 9) | The Ge'ez release gate | Machine output satisfies the compiler, not the gate |
| **Q9** | **A paid store-guidelines review** (ADU-ARCH-01 S4) | B19's reopen, and confidence in the first submission | The shape of the IAP risk is stable; the permissible wording is not |
| **Q10** | **Whether `POST /v1/devices` folds into `GET /v1/bootstrap`** (ADU-RUL-04 S1) | Nothing. **It is an opportunity, not a blocker** | RUL-04 calls it *"the right move whenever the mobile contract is next revised"* and this workstream is that revision. It removes a round trip from every cold start on a slow network. It also changes a contract the console depends on, so it is a decision with a blast radius rather than a cleanup |
| **Q11** | **The QR payload encoding ruling** (D-156, **F12**) | **Tier 6.** Nothing in the scanner can be written against an interim | Field names, ordering, and whether the payload is JSON, a URL or compact binary. **The seller's half already ships in the console**, so the cheap answer is to ratify what D-156 built rather than to design a new one -- but it has to be ratified, because *interim* in a document an agent reads is an invitation |
| **Q12** | **The in-session retry budget** (ADU-MOB-AMD-01 G1) | Tier 6's user experience, and **ADU-VAL-01 D3's floor** | How long the scan screen retries, with what backoff, before it offers the tapped confirmation. **This is now the whole of what a buyer experiences at a doorway with bad signal**, and it is a product decision, not an engineering one. ADU-MOB-02 |
| **Q13** | **What the Companion does when the QR fetch fails at the doorway** (ADU-MOB-AMD-01 G3) | Nothing here | Symmetrical to B25 and belongs to ADU-CMP-01. Recorded so that the Companion is not written as though the seller's half were online-only by accident rather than by ruling |
| **Q14** | **Whether scan completion rate moves once buyers in poor coverage tap instead of scanning** (ADU-MOB-AMD-01 G4) | Nothing yet. **It is B25's reopen condition** | The number this ruling put at risk on purpose. Watched from the **first beta handoff**, not at the release gate, because by the gate it is too late to reconsider. S20.3 |

## 25. Release gates -- what must be true before either store submission

Each is a walk or a command, not an opinion. These join ADU-PROJ-01 S12.

**Correctness**

- [ ] Killing the app mid-order-creation and retrying produces exactly one order
- [ ] **With the network off, a scan renders SENDING and a Retry, never a success.** Restoring the network while the screen is open completes it and renders the server's outcome
- [ ] **Leaving the scan screen mid-send loses the scan, offers confirm-receipt, and writes nothing to disk** -- `find` over the app container returns no scan, no queue file and no SQLite database
- [ ] A byte-identical resend returns the original outcome with `replay: true`, and the buyer sees success
- [ ] No `/v1/*` response body, bank detail, phone number or token is on disk after a full session
- [ ] A revoked session ends access on the next request and **preserves the device id, the cart and the order idempotency key**
- [ ] An unrecognised order state, error code and scan outcome each render the default branch rather than a blank
- [ ] All six cart-revalidation failure states render from `items[]`
- [ ] A verify call never carries `audience`, and a first sign-in without the age declaration renders `AGE_DECLARATION_REQUIRED` at the checkbox

**The product's own rules**

- [ ] The New-seller disclosure appears at the reservation step, is not dismissible, and emits its event
- [ ] Scan is the primary action wherever a scan is possible; the tap is one step further (B9)
- [ ] The claim evidence screen states the single-transaction rule in its own copy
- [ ] A report control exists on every piece of user content
- [ ] No price, tier name, upgrade prompt or billing link exists anywhere -- grep gate 7 green and a manual copy review of `packages/locale`
- [ ] Storefront search and the feed accept no parameter that widens scope or ranks
- [ ] **Grep gates 10 and 11 green** -- no SQLite, no background task, no queue identifier, no `audience` in an auth request body

**The device**

- [ ] Both recovery paths -- paste a post link, search a seller -- are on the first screen after install
- [ ] An App Link and a Universal Link open the exact product on physical devices; the same URL renders the web storefront without the app
- [ ] Permission denied produces the badge and countdown on the order card
- [ ] Every screen renders in Amharic, at the largest OS text size, with **no missing-glyph box** -- wordmark, both platform names, and at least one figure, as characters
- [ ] Every performance budget in S13 met on the reference Android

**The stores**

- [ ] Account deletion completes **in the app** and at a public URL, with the blocked branch listing every blocker and its clearing action
- [ ] Privacy labels and the Data safety form reconcile line by line with ADU-DPIA-01 S4's inventory -- **including the on-device row F7 adds**
- [ ] Every permission the app requests has a purpose string a reviewer can check against a visible feature
- [ ] No IAP surface, no external purchase call to action, no billing deep link
- [ ] D-U-N-S issued, both organizations enrolled, both fees payable

**The one that is not a checkbox**

> **Q11 is ratified and F1's correction is in the contract before tier 6 is written**, not before submission. Both are cheap now and neither is cheap once a scanner exists: one is a byte format that has to match a shipped console, and the other is a key that would already be in every installed APK.

---

*Binding architecture record and standing operating manual for Buyer Mode, v1.2. The back end is finished and the contract is published, so this document specifies a client against a system that already refuses what it should refuse -- which is why almost every ruling here is about what the app must **not** do. **v1.1 was a subtraction**: a founder ruling withdrew offline in full, and with it went the queue, the drain, the batch contract, the persisted clock offset and a reinstall requirement that had no achievable answer on Android. **v1.2 is a correction, and it is smaller and more embarrassing.** Four documents written after v1.1 read it properly and found five defects, the sharpest of which is that **the version which deleted the scan queue still named it in the section an agent reads to decide what the client store holds** -- a single sentence, in the one place it could still be built from. The risk this document manages has not changed: **the persisted order idempotency key sits where the queue sat, is not part of it, and removing it produces a duplicate order the contract already names by number.** Nine absences, fourteen gates, no key on the device, no cached authenticated read, no computed state, no third-party SDK, no price, and nothing on disk that came from `/v1`. Thirteen findings go back to other documents; the oldest -- three words in the API contract that instruct an implementation ADU-DB-01 rejects by name -- has now survived four contract versions unamended. **Every document in the series is issued. What is next is not another document: it is `apps/mobile/CLAUDE.md`, a settings file, and WO-0.***
