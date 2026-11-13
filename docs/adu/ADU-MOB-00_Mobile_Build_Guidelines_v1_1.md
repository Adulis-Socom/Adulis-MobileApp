# ADU-MOB-00 -- Mobile Build Guidelines

**Version:** 1.1  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO -- sole engineer (ADU-REPO-01 v1.3 S3)
**Supersedes:** ADU-MOB-00 v1.0
**Status:** **Operating guidance, not a binding record.** Where this document and a binding document disagree, the binding document wins and this one is corrected -- S2.
**Scope:** How to build the Adulis mobile app day to day. **What to build is ADU-MOB-01.**
**Verified against:** ADU-DB-01 **v1.19**  -  ADU-API-01 **v1.11**  -  ADU-AUTH-01 **v2.8**  -  ADU-REPO-01 **v1.3**  -  ADU-RUL-04 v1.0  -  ADU-MOB-01 **v1.1**  -  ADU-MOB-AMD-01 v1.0  -  the defect register to **D-180**
**Encoding:** ASCII.

---

## 0. What this is, and what v1.1 changed

### 0.1 The division of labour, stated once

**ADU-MOB-01 is the architecture record. This is the habits document.** ADU-MOB-01 says what the app is, what it must never do, and which ruling each of those comes from. This says what to have open on day one, which sentences in the binding set are easy to misread, what to start before you write any code, and what "done" means.

**Neither replaces the other, and this one never overrides it.** A rule that appears here and in ADU-MOB-01 has one stale copy within a month, so where the two would overlap, this document **cites** rather than restates -- the same discipline ADU-REPO-01 S6 applies to `CLAUDE.md`.

> **Plain terms:** if you are deciding *whether* the app may do something, read ADU-MOB-01. If you are deciding *how to spend today*, read this.

### 0.2 What changed in v1.1

| # | Change | S |
|---|---|---|
| **A** | **S4.4 is deleted.** *"Offline is real, and it is the Companion's half"* is gone. **Nothing is offline** -- ADU-MOB-AMD-01, adopted as ADU-MOB-01 B25. The replacement is one short section | 4.4 |
| **B** | **The Ed25519 sentence is struck.** The primitive appears in **no** governing document. What is minted is a server-side HMAC, and D-156 records the built shape | 4.3 |
| **C** | **S2's *"or register findings against it"* is struck.** A build guideline may not instruct a builder to stop recording conflicts | 2.2 |
| **D** | **S8 gains the reference devices**, because S9 makes a physical Android a tier 0 gate and a gate blocked on hardware belongs in the slow-things list | 8 |
| **E** | **S5 gains the In-App Purchase rule**, which `apps/mobile/CLAUDE.md` already carries as its entire non-obvious content (ADU-REPO-01 S8), plus in-app account deletion, the bootstrap-failure behaviour, the Ge'ez mechanism and CGNAT | 5, 4.9, 4.10 |
| **F** | **S4.1 is corrected in the other direction.** The market is not *"assigned at first bootstrap"*; ADU-RUL-04 S1 sets it at insert by whichever door was used | 4.1 |
| **G** | **S4.7 is unchanged.** It was right, and the review that said otherwise was wrong -- recorded because a withdrawn criticism is worth as much as an upheld one | 4.7 |
| **H** | New: **the OTP verify body disagreement (N1)**, which tier 2 is built around and which neither document can be followed through while it stands | 4.5 |

### 0.3 How this version was produced, stated plainly

**v1.1 restates the whole document rather than patching v1.0's text.** The four corrections and five additions above are large enough that a diff would have been harder to read than a reissue, and the offline deletion alone removes a section and changes three others.

> [!] **Diff this against your copy of v1.0 before you discard it.** The sections v1.0 got right -- the version-drift rule, the test rules, the App Review OTP problem, the definition of done -- are carried forward **in substance**, and where a line was v1.0's own it is quoted. If a sentence you valued is not here, it was dropped by omission rather than by decision, and it should go back.

---

## 1. The first rule: check the version before you trust the sentence

**This was the best thing in v1.0 and it is first for a reason.**

Every document in this set carries its predecessors' change tables, retained-for-history rows, and *"what changed in vN"* blocks. **A sentence found by grep is as likely to be history as law.**

> **RULE 1 -- before citing a sentence, look at which section it sits under and which version that section belongs to.**

Two instances from this workstream, both recent, both by careful readers:

- **The reviewer's error.** ADU-MOB-01's evaluation claimed S4.7 resurrected a retired invariant, citing API v1.11 line 278 and DB v1.19 line 404. **Both lines are *retained for history* entries describing the Telegram-era design.** The current text says the opposite, and MOB-00 v1.0 had it right. The finding was withdrawn.
- **The author's error.** ADU-MOB-01 v1.0 stated the mobile session was *"30 days, sliding on activity"*. **ADU-AUTH-01 v2.8 S19.1: "Mobile 30 days is absolute."** The design was written against v2.5 and nobody re-read the section.

**And the general form, which costs more than either instance:** ADU-MOB-01 v1.0 was written against a set that had moved four to seven versions in every direction. **A design document four versions behind the contract it describes is the same defect at document scale.** v1.1 exists because of it.

### 1.1 Do not restate a count

**Do not carry a number from another document into a sentence here.** Table counts, path-key counts, migration counts, permission counts. Cite the document that owns it.

The reason is measured, not theoretical: *"124 contract path keys"* survived in ADU-MOB-01's header until D-100 showed it was **three quantities counted as one** -- 124 catalogue entries, 110 path keys, 129 operations. ADU-DB-01's S0 carried *"109 tables"* for three revisions the same way. **A number restated is a number that goes stale where it was restated.**

---

## 2. Using this with the binding set

### 2.1 The loop

**Document -> work order -> agent within one slice -> a command that verifies -> review -> PR.** Unchanged from ADU-CON-02 S14.2.

**When the agent's output and a binding document disagree, the document wins.** Amend the document first, then the code. Never the reverse, and never both at once.

### 2.2 Record the conflict. Always.

> **v1.0 said the builder should follow ADU-MOB-01 *"and not register findings against it."* That clause is struck and this section replaces it.**
>
> **RULE 2 -- when you find two binding documents that disagree, you write it down before you choose one.**

A build guideline that tells a builder to stop recording conflicts is asking them to resolve a contradiction silently, in code, where nobody will find it. **Every serious finding in this workstream came from someone reading two documents together and noticing** -- the signing contradiction that would have put an HMAC key in every APK, the four client events across two closed lists of two, the verify body that differs between AUTH and API.

The escalation is cheap: name the two sentences, name the two documents, and put it in the design document's findings register. It costs a paragraph. **Choosing one silently costs a migration or a store round.**

### 2.3 Where a conflict actually goes

| Kind | Goes to |
|---|---|
| Two binding documents disagree | **ADU-MOB-01 S22**, as an F-number, with both quotations |
| A decision nobody has made | **ADU-MOB-01 S24**, as a Q-number, with what it blocks |
| A defect in built code | The defect register, as a D-number |
| A habit that cost you a day | **Here**, in the section it belongs to |

---

## 3. The local environment

### 3.1 Day one

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

**Working setup means:** the development build installs on the reference device, `GET /v1/bootstrap` succeeds against the local API, and the seeded buyer signs in with an OTP read from `.dev-sms.log`. **If any of that fails, fixing it is the day's work.** Do not start a feature on a half-working environment; you will spend the week unable to tell your bug from your setup.

### 3.2 Six operational facts, each of which costs a day if met later

- **OTPs go to a gitignored `.dev-sms.log`, not to the terminal.** `console.*` is banned in `apps/api` and the logger cannot carry an OTP. **On a shared or multi-user machine that file must not be used at all** -- its `0600` mode is a no-op on Windows, where ACLs inherit (ADU-RUL-04 S4).
- **`pnpm db:check` is sixteen checks.** Anything that says fifteen is stale.
- **Start the agent session from `apps/mobile`, not the repository root.** From the root it loads only the root instruction file, so it has none of this workstream's rules and all of the backend's. ADU-REPO-01 calls this *"the single most consequential operational habit in this document, and it costs nothing to adopt and is invisible when it is skipped."* Project settings load only from the directory you start in.
- **The Prism mock's base URL is an origin and nothing more.** `/v1` lives in the OpenAPI path keys; a base URL carrying `/v1` too produces `/v1/v1/bootstrap`. **Prism is pinned at 5.14.2** -- 5.15.7 and above require Node 24 and this repository is Node 22.
- **Each workstream gets its own database.** Different compose project, different port. Two suites against one database is how a teardown in one stream deletes a fixture in another (D-83, D-124). **This rule belongs in ADU-REPO-01 S6 and is currently stated only here** -- see S10 N5.
- **A physical device is not optional.** The camera, App Links, push registration, SMS autofill, the Ge'ez render and every performance budget are things a simulator answers incorrectly and confidently.

### 3.3 Expo Go is a false green

**Development happens in an Expo development build** (ADU-MOB-01 B20). Expo Go cannot load the config plugins this app depends on -- App Links and Universal Links, FCM and APNs registration, camera permission strings, secure storage.

*"It works in Expo Go"* means the feature was tested in an environment that shares neither the native configuration nor the signing identity of anything a buyer will install.

Two consequences to accept rather than discover: **the first build takes real minutes**, and **adding a native module means rebuilding the dev client.** Both are cheaper than debugging an App Link that never worked because it was never testable.

---

## 4. The mobile facts that are easy to get wrong

**Each of these is a sentence somewhere in the binding set that a competent reader gets backwards.** That is the entire selection criterion.

### 4.1 The device row, and where the market comes from

**Corrected in v1.1.** v1.0 said the device *"carries a `market_id` assigned at first bootstrap."* That was true of an older shape and is now wrong in a way that produces the wrong mental model.

> **ADU-RUL-04 S1 -- device creation is one function, and both doors call it.** `GET /v1/bootstrap` and `POST /v1/devices` *"both call it and neither implements it. The function resolves the market, sets it at insert, and is subject to the same rate-limit bucket."*

**So the client owes no ordering discipline at all.** The old trap -- register before bootstrapping, get a market-less row, and every later OTP request refuses forever -- **stops existing rather than being documented**, which is the stronger of the two fixes.

RUL-04 also records that folding the two endpoints into one is *"the right move whenever the mobile contract is next revised."* **This workstream is that revision.** It is carried as ADU-MOB-01 S24 Q10, not taken unilaterally, because the console depends on `/v1/bootstrap` too.

**What the client still owes:** the device id is generated once, stored in secure storage, never regenerated, and **its shape is validated before every send** -- see 4.8.

### 4.2 Identity is created at first reserve, and the age declaration rides with it

No sign-in prompt at launch, at browse, or on the storefront. Sign-in is offered from the orders tab and the account tab; **an account is created only inside the reserve flow.**

**The age declaration is built** (ADU-AUTH-01 v2.8 S18) -- `age_declared_over_18` in the verify body, `age_declared_at` alongside it, and `AGE_DECLARATION_REQUIRED` as its own error code so the client knows which input to correct.

> **The screen rule is the non-obvious half: the checkbox renders for everyone, and the client never first asks whether the phone has an account.** Rendering it only for new accounts would answer, on screen, the enumeration question ADU-AUTH-01 S17 forbids answering. The server requires the declaration only for creation; the client cannot know which case it is in, and that is deliberate.

**A date of birth is never collected.** Adulis sells no age-graded product, so a birth date would be data held for no purpose. **The copy never describes self-declaration as verification.**

### 4.3 The QR, the scanner's clock, and the sentence that is now struck

> **v1.0 said: *"The courier handoff protocol is Ed25519-signed and works offline."* Both halves are wrong and the section is replaced.**

**`ed25519` returns zero matches in ADU-DB-01 v1.19, zero in ADU-API-01 v1.11, and zero in the defect register.** So does `keypair`. There is no asymmetric signing anywhere in the specified system, and naming one in the section a builder reads immediately before writing the scanner is the most expensive kind of error this document can make.

**What is actually specified, and what D-156 records as built:**

> `GET /v1/seller/orders/{id}/qr` returns `{order_ref, nonce, signing_key_version, signature}` -- **a server-minted HMAC**, exactly as ADU-DB-01 S14.2 G1.4 ruled, having rejected client-side signing by name: *"key distribution to phones, key theft from a device, and it still would not defend against the party holding the key."*

> **RULE 3 -- the buyer's device holds no key and performs no cryptography.** `signature` is transcribed from the QR unchanged. ADU-MOB-01 B12, and CI greps `src/features/handoff` for crypto imports.

**What v1.0 got right here, and it is a genuine contribution: the scanner stamps the clock.** D-156: *"`signed_at` is deliberately NOT in it: the SCANNER stamps epoch milliseconds at scan time, so a `signed_at` baked into a printed code would be the moment the seller opened the modal."* That resolves a real ambiguity and the whole `corrected_at` / `received_at` split depends on it.

> [!] **One ruling is owed before the scanner exists.** D-156 records the QR payload encoding as **interim** -- one exported function producing compact JSON -- and asks for a decision on field names, ordering, and whether the payload should be JSON, a URL or compact binary at all. **The buyer's scanner is the second half of that contract and cannot be built against an interim.** ADU-MOB-01 S24 Q11.

### 4.4 Nothing is offline

> **This section replaces v1.0's *"Offline is real, and it is the Companion's half."* The founder ruling is that there is no offline mode; everything works online.** ADU-MOB-AMD-01, adopted as ADU-MOB-01 B25.

**The scan is a foreground request with in-session retry.** The scanner decodes, stamps `signed_at`, POSTs immediately. On failure the buyer sees a plain retry state and stays on the screen; the app retries on connectivity regain **while that screen is open**, with backoff, never silently. **If the buyer leaves the screen or the app is killed, the scan is gone** and the order is completed by tapping *I received it*.

**Gone with it:** the SQLite queue, the batch drain, the six client actions, the persisted clock offset, and the reinstall-persistence problem that had no achievable answer on Android.

> [!] **The deletion is the risk, not the feature.** Five things sit beside the deleted queue and are not part of it (ADU-MOB-01 S9.5). **The one that will be deleted by mistake is the persisted idempotency key for `POST /v1/orders`** -- it defends against a process kill mid-request, which happens on a *good* connection. Removing it re-opens ADU-API-01's gap A2 by name and produces a duplicate order, a duplicate stock decrement, and a buyer charged twice by their own bank.

**Two things that remain true and sound like offline:**

- **The server's late-arrival tolerance is kept in full** (ADU-MOB-AMD-01 B24). A buyer who fails, walks ten metres and scans again still gets a verified handoff. The client became impatient; the server did not.
- **The Companion caches the QR for display at a doorway.** That is display, not capture, and it belongs to ADU-CMP-01. **Offline display is the Companion's; offline capture is nobody's.**

**The column named `offline_sync_horizon` still exists and is still correct.** It is the server's tolerance window. Its name now describes a client capability that does not exist -- do not infer one from it (ADU-MOB-01 F11).

### 4.5 The OTP, and the disagreement tier 2 sits on

**Audience is stamped at challenge creation and travels on the *request*.** `{ phone, purpose, audience }` on request; **the verify call rejects `audience` outright** (D-180). A client that sends it on verify is coding against a document that was corrected.

> [!] **N1 -- the two documents do not agree on the verify body, and this is the request the whole of tier 2 is built around.**
>
> | Document | `POST /v1/auth/otp/verify` takes |
> |---|---|
> | **ADU-AUTH-01 v2.8 S5.2** | `{ challenge_id, code, device_id, age_declared_over_18 }` |
> | **ADU-API-01 v1.11 S5** | `{ phone, code, audience, device_id }` |
>
> Three differences. API v1.11's change table carries D-180 and says S12.2 was corrected -- **but S5's code block was not**, which is the failure that document names at its own S0: *"a surgical edit preserved exactly the part nobody re-read."*
>
> **A client developer reads S5 for the sign-in shape.** Sending a phone and sending a challenge id are different clients -- one keeps state between two screens and the other does not. **Resolve this before WO-2 is handed over.** Follow AUTH v2.8 in the meantime; it is the document that owns authentication and it is the one D-180 was written into.

**Also:** ADU-API-01 S10 documents a 10/hour IP limiter on `otp/request` that **ADU-AUTH-01 S15 and R41 have disabled** until trusted-proxy configuration is proven. Under RUL-04 S2 the disabling is the current truth. See 4.10 for why an IP bucket is the wrong instrument here anyway.

### 4.6 Version skew is the app's problem, not the API's

The contract is additive-only on `/v1`. `min_supported_client` is enforced at `/v1/bootstrap` and the app renders a blocking screen that **nothing routes past** -- not a deep link, not a push tap.

**`X-Adulis-Client` carries two versions, not one**: the store binary and the running JavaScript bundle. An Expo app can have a different pair after every over-the-air update, and a floor compared against the wrong one is a floor that does nothing. This is an open contract gap (ADU-MOB-01 F4) -- send both, in the shape the amendment specifies, and be tolerant when parsing.

**Raising the floor locks out every install below it, immediately.** It is a two-person action in spirit even with one engineer: measure how many installs it cuts off *before* raising it, and never raise it before the fix is live on both stores.

### 4.7 iOS carries seller functionality -- unchanged from v1.0

> **ADU-API-01 v1.11 S4:** *"iOS seller functionality | Design note | **Confirmed: release-checklist item, not an API control**."*

**v1.0 said this and was right.** The evaluation that called it a resurrected invariant was reading *retained for history* rows from the Telegram era as current text, and the finding was withdrawn (S1).

**It is recorded here rather than quietly dropped**, because a withdrawn criticism teaches the same lesson as an upheld one and this one teaches RULE 1.

### 4.8 A malformed device header is answered with 500

The app sends `X-Adulis-Device` on **every** request. A truncated or corrupted read from secure storage therefore produces an unrecoverable loop that, from the app's side, is indistinguishable from the server being down.

**The client half is a rule you implement today: validate the shape of your own device id before sending it, and re-register if it fails.** The server half -- a 400 with a code the client can act on -- is ADU-MOB-01 F13 and is owed by the contract.

### 4.9 In-app account deletion is a store blocker with no owner

Required by ADU-PRD-01 S23 and by both stores. **The only deletion path in the contract is titled *from the web*** and is marked for no surface but the public site (ADU-MOB-01 F9). It is callable from the app because it is anonymous, and no document says it must be.

**Build it, and build it the long way.** The app drives the same anonymous flow -- explain, then phone, then code, then confirm -- **and re-verifies the number by OTP even though a session is present.** A session must never mint a deletion ticket: a phone left unlocked in a shop should not be two taps from deleting an account. **The friction is the feature.**

`GET /v1/deletion/preview` exists so the explanation is server-supplied and cannot drift from what deletion actually does. **Every blocker it returns names its clearing action.**

### 4.10 Three environment facts about Ethiopia that change client code

- **Ge'ez rendering has no `unicode-range` on React Native.** That CSS mechanism is the whole of how ADU-CON-02 S9 guarantees mixed-script rendering on the web, and **it does not exist here** (ADU-MOB-01 F5). The guarantee becomes a *measured device gate* -- the wordmark, both platform names and at least one figure rendering as characters beside an Amharic line, checked on a real device -- or it becomes nothing. Bundle Inter and Noto Sans Ethiopic; **the default text style is the Latin family and no component sets an Ethiopic-only family.**
- **Amharic runs 30-50% longer than English.** Every screen is laid out for the longer string, and every screen is checked at the largest OS text size. A button that fits in English and clips in Amharic is a defect found by a buyer.
- **Mobile carriers run heavy CGNAT.** An IP-keyed bucket of ten an hour is not a limit on an attacker; it is a lockout on a neighbourhood, and it presents as churn rather than as an error. This is why `TRUSTED_PROXY_HOPS` is required configuration the API refuses to start without (ADU-RUL-04 S2), and why 4.5's disabled limiter is disabled.

---

## 5. What must never be in the bundle

**The client computes no business state.** Not expiry, not level, not entitlement, not eligibility. A countdown renders a server-supplied `expires_at` and refetches when it reaches zero; it never concludes that the order has expired, hides an action, or changes a state the server has not returned. **Rendering the distance to a server-supplied instant is display. Deciding what that instant means is computation.**

**The nine absences are ADU-MOB-01 S17.5 and are enforced by CI greps.** They are not restated here. What follows is the one an agent will breach without noticing.

### 5.1 The In-App Purchase constraint

> **RULE 4 -- no price, tier name, currency figure, upgrade prompt, subscribe call to action or billing link exists anywhere in the mobile bundle.**

This is **the single most likely cause of a store rejection** for this product, and ADU-REPO-01 S8 already makes it the entire non-obvious content of `apps/mobile/CLAUDE.md`. A build guideline that omits it is missing the one rule the repository has written down for this workstream.

**The leak is not a pricing screen. Nobody builds a pricing screen by accident.** The leak is an **error string** -- a seller-tier message, a plan-limit explanation, a "your subscription" line -- arriving through the shared locale catalogue because it was written for the console. That is exactly why the app renders errors from a greppable catalogue rather than from server prose, and why the CI gate scans `packages/locale` rather than the screens.

**Also forbidden: a "sell on Adulis" call to action.** Seller recruitment is a web-surface job at MVP.

### 5.2 What the app does when `/v1/bootstrap` fails

A 429 or 503 costs the caller the market, the locales, the clock reference and the client floor, all at once. **Decide this before tier 1, not during it.**

> **Cache the offset. Never cache the floor.**
>
> A stale floor is precisely how a below-floor client keeps running -- the one outcome the version-skew machinery exists to prevent. A stale clock offset is harmless: it was approximately right an hour ago and it is only ever transmitted, never applied.

---

## 6. Repository, collisions and merges

**ADU-REPO-01 v1.3 governs the tree, the four dependency rules and the three seams. It is not restated here.** What follows is the operational residue.

- **`contracts/openapi.json` is CI-authored.** Never hand-edit it, and never hand-edit the generated `@adulis/api-client`. Regenerate and commit; CI diffs both and fails on drift.
- **Regenerate conflicted artifacts rather than resolving them.** Lockfiles, generated clients, schema dumps: *"the correct value after a merge is neither side's."* Resolving a generated file by hand produces a state that no generator would ever produce and that nothing will reproduce.
- **Do not carry two open branches from two workstreams at once.** With one engineer and a shared register it buys nothing and it costs a merge that touches `packages/` from both sides.
- **CI is path-filtered by `pnpm --filter "...[origin/main]"`** (ADU-REPO-01 S7), which selects changed packages **and their dependents**. Two foot-guns come with it: `actions/checkout` needs `fetch-depth: 0` or there is no `origin/main` to compare against, and **a root script must not recurse into the workstream that calls it** -- `pnpm -r test` invoked from a package that defines `test` is an infinite descent that presents as a hung runner.
- **The boundary and grep gates are never path-filtered.** A gate that runs only when someone touches `apps/mobile` is off on exactly the push that moves a forbidden string into a shared package.

---

## 7. Tests -- five rules, and the one that keeps costing money

**These are v1.0's and they are kept.** The second is the one that describes how the console suite stayed green over a defect its own test claimed to cover.

> 1. **A check that cannot fail is worse than no check.** It occupies the slot a real check would have had and reports success while doing so.
> 2. **A test proves what it is pointed at, not what it claims.** Read the assertion, not the test name. A test called `rejects_expired_token` that asserts a 200 is a green light over a hole.
> 3. **Test the negative case or you have tested nothing.** The happy path is the path the implementation was written to satisfy.
> 4. **Integration tests run against a real Postgres.** Constraints, triggers, row-level security and `EXCLUDE` cannot be mocked, and mocking them tests the mock.
> 5. **A teardown deletes what its suite created, by id. Never by a global predicate.** ADU-RUL-04 S3 names this as house doctrine; the D-83 instance at `c2-catalogue.e2e.spec.ts:195` is still open. **A predicate teardown is a `DELETE` with a `WHERE` clause someone else's fixture also matches.**

### 7.1 The mobile-specific addition

**An emulator answers the wrong question confidently.** Camera, App Links, Universal Links, push registration, SMS autofill, Ge'ez glyph coverage and every performance budget must be checked on hardware. A gate that says "on a device" means on a device.

---

## 8. The administrative track -- start these before you write code

**Every item here has a lead time measured in weeks and none of them is a coding task.** They are listed first in importance rather than in sequence, and the reason this section exists is that all of them are invisible until the week of submission, when they are all blocking at once.

| Item | Lead time | Note |
|---|---|---|
| **International card payment for the two store fees** | Unknown, and it is the problem | **Neither store accepts an application from a developer account that cannot pay.** ADU-PROJ-01 S9.2 carries it as an open blocker with no owner. It gates everything below it |
| **D-U-N-S number** | **1-4 weeks by itself** | Required for Apple organization enrolment. Request it the same week you solve the payment problem, not after |
| **Apple Developer Program enrolment** | Days after D-U-N-S | ~$99/year |
| **Google Play organization registration** | Days | $25 one-off. **Organization registration is what exempts us from the 12-tester / 14-day closed-testing gate** -- a personal account would add two weeks to every release |
| **Reference devices** | A decision and a purchase | **New in v1.1.** S9 makes a real Android a tier 0 gate, so this blocks the first gate in the build. One low-end Android on a current OS and one iPhone. Duty-free under ADU-LEG-01 S6.4 |
| **Territory and availability** | Hours, once enrolled | Decide the release territories before the first TestFlight, not at submission |
| **The domain** | A decision | **Blocks App Links and Universal Links, and therefore tier 3.** The association files must be hosted at a name nobody has chosen. Cheapest unblocked decision on the list |
| **Amharic human translation** | Weeks, external | Machine output satisfies the compiler, not the release gate |

### 8.1 The App Review OTP problem -- solve it before the first submission

> **Reviewers cannot receive Ethiopian SMS.**

**This is the best item v1.0 contributed and it is not in any binding document.** The app's only authentication is a phone OTP to an Ethiopian number. A reviewer in Cupertino cannot receive one, cannot get past the sign-in screen, and rejects the build for being unusable.

**The discovery point, if you do not plan for it, is the rejection** -- which costs a full review cycle for a problem that takes an afternoon to fix.

**Fix it server-side, and pick one:**

- a **fixed review credential** -- one allowlisted phone number whose OTP is a known constant, active only for a named account, revocable, and logged; or
- a **server-side allowlist** that routes a specific number's OTP to a channel the reviewer can read.

**Whichever you choose, write it into ADU-MOB-05** (store submission and compliance dossier) with its revocation, and give the reviewer the credential in the App Review notes field. **Do not build a demo mode.** A second authentication path in the shipped app is a second attack surface, and it is the one an attacker will look for.

---

## 9. Definition of done

> **Done means a person did it on a device.**

**v1.0's rule, kept verbatim, and it is stricter than the split CI/device gate in the work orders.** It is the better rule: the CI half proves the code compiles and the greps pass, and neither of those has ever been the thing that was wrong.

**Per pull request, done is all of:**

- [ ] code + tests, including the negative case
- [ ] **both locale entries** -- English and Amharic, or it does not compile
- [ ] the tier's gate green
- [ ] **a screenshot of the screen in Amharic at the largest OS text size**
- [ ] `@adulis/api-client` regenerated, diff additive
- [ ] only the slice's files touched, and **what was not done is listed**
- [ ] every new dependency named in the PR, with whether it is a data processor

**Not five of seven.**

### 9.1 The review model, and its weakness stated

**Review is CI plus the agent's adversarial pass against its own work.** ADU-REPO-01 S3.1 records that `CODEOWNERS` has requested review from nobody since it was written, and branch protection does not apply on this plan -- so *"the review model has been CI and nothing else for the entire build."*

> [!] **A pass on your own work is a pass by the person who made the assumptions.** Where a change touches money, identity, or a boundary, the second pass is not optional and it is run against the document rather than against the diff.

---

## 10. What this document does not settle

| # | Item | Owner |
|---|---|---|
| **N1** | **The OTP verify body** -- AUTH v2.8 and API v1.11 disagree, and tier 2 is built on it (4.5) | ADU-API-01 v1.12 |
| **N2** | **The OTP IP limiter** -- documented in the contract, disabled in the authentication specification (4.5) | ADU-API-01 v1.12 |
| **N3** | **The age columns** -- `age_declared` returns zero matches in ADU-DB-01 v1.19 while AUTH v2.8 names `age_declared_over_18` and `age_declared_at` as built. Either the schema names them differently or **the schema document is behind the schema**, and the second is the one worth checking, because ADU-DB-01 is where a migration is audited from | ADU-DB-01 v1.20 |
| **N4** | **ADU-REPO-01 S1's ownership table says the mobile app is unassigned**; S3 says `* @NaodSolomon` and S9.1 applies exactly that reasoning to the console. The table is a v1.2 remnant | ADU-REPO-01 v1.4 |
| **N5** | **The separate-database rule lives only here** (3.2). By ADU-REPO-01 S6's own argument -- *"a rule restated in two places has one stale copy"* -- a structural rule stated **only** in a non-governing document is the same failure one step earlier. It belongs in S6's collision-surface table | ADU-REPO-01 v1.4 |
| **N6** | **The QR payload encoding** is interim and the ruling is owed before the scanner exists (4.3) | Founder ruling |
| **N7** | **The in-session scan retry budget** -- how long the screen retries before it offers the tap. It is now the whole of what a buyer experiences at a doorway with bad signal | ADU-MOB-02 |

---

*Operating guidance, v1.1. The premise is unchanged and it is right: a fresh surface should not re-learn what the console's build already paid for. What changed is that the mobile-specific half -- the half where this document claims its value -- had three errors in it, and all three sat in the sections a builder reads immediately before writing the hardest code in the app. **The offline section described a requirement that has since been withdrawn entirely. The scanner section named a cryptographic primitive that appears in no document in the set.** Both are now the other way round: nothing is offline, and the device holds no key. The third error was the instruction not to register findings, and it is struck hardest of all -- every serious defect in this workstream was found by somebody reading two binding documents together and writing down that they disagreed. **The one sentence worth carrying out of here on its own is the first: check which section a sentence sits under before you cite it.** Two careful readers got that wrong on this document alone, in opposite directions, within a week.*
