# ADU-MOB-WO-03 -- Buyer Mode Work Orders, Tiers 6 to 8

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Prepared and executed by:** Founder / CEO -- sole engineer, with the coding agent
**Status:** Working instrument. **Not binding.** ADU-MOB-01 v1.1 and ADU-MOB-02 v1.0 govern.
**Source:** ADU-MOB-01 v1.1 S18  -  ADU-MOB-02 v1.0 MB-21 to MB-39  -  ADU-MOB-03 v1.0 S3, S4  -  ADU-MOB-05 v1.0 S6  -  ADU-MOB-06 v1.0 S7
**Follows:** ADU-MOB-WO-02 (tiers 3-5)  -  **Tier 9 is not a work order:** hardening and submission are ADU-MOB-05 S8 and ADU-MOB-06 S11
**Encoding:** ASCII.

---

## 0. Where this picks up, and the one hard blocker

**Tier 6 is the product.** Everything built so far exists so that this moment produces evidence.

### 0.1 Two things must be ruled before WO-6 starts

| # | Ruling owed | Why it cannot be worked around |
|---|---|---|
| **Q11** | **The QR payload encoding** -- D-156 records it as *interim*: field names, ordering, and whether the payload is JSON, a URL or compact binary | **Both halves of a scan contract have to agree on bytes.** The seller's half already ships in the console, so **the cheap answer is to ratify what D-156 built** rather than design a new one. But *interim* in a document an agent reads is an invitation |
| **Q12** | **The retry budget** -- ADU-MOB-02 M1 proposes twenty seconds of visible retry before the tap is promoted | It is **the whole of what a buyer experiences at a doorway with bad signal**, and it sets ADU-VAL-01 D3's floor. A product decision, not an engineering one |

> **These are the only two hard blockers left in the build.** Everything else in tiers 6 to 8 can be written today.

### 0.2 What tier 6 is not any more

**v1.0 of the tier table read *"scanner, queue, sync, the six outcomes."* There is no queue and nothing syncs** (B25). **The slice got smaller and it did not get easier**: what is left is a doorway, a decoded token, one request, and a buyer who will not wait.

> **The over-deletion warning applies to this slice above all others.** An agent told *"remove offline"* will reach for the persisted idempotency key sitting next to where the queue would have been. **It is not part of it** (ADU-MOB-01 S9.5), and deleting it re-opens ADU-API-01's gap A2 by name.

---

## WO-6 -- The handoff scan

**Purpose:** the only place in the product where a client's behaviour decides whether evidence exists at all.

### 6.1 Read first

ADU-MOB-01 v1.1 **S9 in full -- 9.1, 9.2, 9.3, 9.4, 9.5 -- and S7.6**  -  **ADU-MOB-02 MB-21, MB-22, MB-23, and S4.1's M6**  -  **ADU-MOB-03 S4.1 and R1**  -  **ADU-MOB-AMD-01 B24, B25, B26, B27**  -  ADU-DB-01 **S14.2 G1.4**  -  ADU-API-01 **S12.6, S12.6.1**  -  **D-156**  -  **ADU-MOB-06 S1 threats 4 and 5, S7 N2, N3, N4**.

### 6.2 Build

- **`R1 ScanViewfinder`, four states**, per ADU-MOB-03 S4.1. **The camera is the action; there is no scan button.**
- **The pipeline**: decode -> parse -> **reject anything not a well-formed Adulis token**, plainly -- *"that is not an Adulis code"* -> capture `{nonce, order_ref, signature}` **transcribed from the token** -> stamp `signed_at` from the device clock -> read the offset from memory -> **`POST /v1/handoffs/sync` as an array of one** (B27).
- **The retry budget of M1**, once ratified: 2s, 5s, 10s, then every 15s; **at twenty seconds `Complete without scanning` is promoted from a text control to a secondary button**; a 120s ceiling with manual retry remaining while the screen is open.
- **MB-22**: the outcome table rendered **from the server's `outcome` and never predicted**. `REJECTED_REPLAY` renders as **complete**. `replay: true` with a stored outcome is **success**. An unrecognised outcome renders the default branch.
- **MB-23**: two-step, neutral copy. *"This records that you received the order. It does not count toward the seller's level -- only a scan does."*
- **`DEVICE_PERMISSION_NEEDED` as a first-class state**: camera refused renders what the camera is for, a route to Settings, **and keeps the tap available**.
- **A confirmation on back-navigation while `SENDING`**, saying the scan will be lost and offering the tap.

### 6.3 Do not build

- **No cryptography.** No key, no signing, no `crypto`, `hmac` or `subtle` import anywhere under `features/handoff` (B12, gate 3). **`signature` is transcribed from the QR unchanged.**
- **No queue, no outbox, no SQLite table, no background task, no retry across a process lifetime** (B25, gate 10).
- **No optimistic success. No tick before the server answers.** There is no code path from a timeout to `confirm-receipt`.
- **No prediction of `counts_toward_level`.** The app never tells the buyer whether a scan counted.
- **No navigation away from the screen by the app itself.**
- **No manual code-entry field**, no torch or flip control as a primary affordance.

### 6.4 The absences that bind this slice

**Gate 3 -- zero crypto imports under `features/handoff`.** **Gate 10 -- zero `expo-sqlite`, background-fetch, task-manager or queue identifiers.** **Gate 5 -- nothing from `/v1/*` on disk.** **And the one that is not a gate: the persisted order idempotency key still exists after this slice** (S0.2).

### 6.5 Gate

**CI half** -- **`grep -rn "crypto\|hmac\|subtle" src/features/handoff` = 0**  -  **`grep -rn "expo-sqlite\|BackgroundFetch\|TaskManager" src/` = 0**  -  a stubbed `REJECTED_REPLAY` renders as complete  -  an unrecognised outcome renders the default branch  -  **a test asserting the order idempotency key module still exists and is still called** (S0.2).

**Emulator half** -- **network off: a scan shows `SENDING` with a visible Retry and no success** (N2)  -  **restoring the network while the screen is open completes it and renders the real outcome**  -  leaving the screen offers the tap and **`find` over the app container returns no scan** (N2)  -  a byte-identical resend returns the original outcome and is rendered as success (N3)  -  **the device clock set back an hour changes nothing the app sends beyond `signed_at`, and the app makes no claim about credit** (N4)  -  camera permission refused leaves the order completable (N14).

**Device half** (deferred) -- **the scan at a real distance, in real light, off a real screen and a real print** -- and **outdoors, at midday, at arm's length** (ADU-MOB-06 S9.2 item 5). **This is the check most likely to be done indoors, and it is the one that tests ADU-MOB-03 S4.1's whole reason for existing.**

### 6.6 Review checklist

[ ] no crypto import, and none added to a shared package either  [ ] no persistence of any scan, in any form  [ ] **the order idempotency key survives this slice** -- checked by running WO-4's N1 test again  [ ] `SENDING` is never rendered as success  [ ] the tap is not a peer of the scan in the framing state  [ ] the tap is promoted only after the ratified interval  [ ] the app never navigates away on its own  [ ] the outcome comes from the server in every branch  [ ] both locale entries.

---

## WO-7 -- Review, claims, evidence, report and block

**Purpose:** what happens after a handoff, and the two store-mandated capabilities that have to be on every surface rather than most of them.

### 7.1 Read first

ADU-MOB-01 v1.1 **S7.6, S7.7**  -  **ADU-MOB-02 MB-24 to MB-29**  -  **ADU-MOB-03 C5, R2, P4**  -  ADU-DPIA-01 **S6**  -  ADU-PRD-01 **S18**  -  **ADU-MOB-05 S6** -- the four UGC obligations  -  ADU-API-01 the claims and reports groups  -  **D-44**.

### 7.2 Build

- **MB-24**: `C5` write variant -- **two ratings, always separate**, free text optional. **One per order, terminal state required.** The screen says before submission that the seller cannot hide, reply to or remove it. **The badge is shown, not chosen.**
- **MB-25 / MB-26**: the claims list and detail. Evidence attached at claim time is **read-only**. A `SYSTEM`-opened claim reads as a statement of fact, not an accusation. **One open claim per scope** -- a second trigger appends evidence, and the screen shows one claim gaining evidence rather than a list that grows.
- **MB-27 as `R2`**: the single-transaction rule **in the screen's own copy**, naming what a statement would reveal. Then the picker, preview, submit. **The evidence export states what it contains before it is requested, and it carries nothing about who the seller is.**
- **MB-28 report**, on **every** piece of user content: product, storefront, review, message, seller. **`subject_kind` is the enum's spelling, not this document's** (D-44).
- **MB-29 block**, a separate control with its own confirmation, **naming any open order with that seller.**

### 7.3 Do not build

- **No review moderation of any kind** -- no hide, no dispute, no reply, no delete. There is no seller-writable column and there is no buyer-facing affordance either.
- **No multi-file evidence picker presented as the default**, and no copy suggesting more evidence is better.
- **No claim-type inference.** The evidence attached is what the claim type attaches, automatically, at claim time.
- Chat, notifications, account, deletion -- WO-8.

### 7.4 The absences that bind this slice

**No averaged rating anywhere, in any component** (`C5` has no single-number variant)  -  **no seller control over a review**  -  **no evidence assembled at review time**  -  **no seller identity in an evidence export.**

### 7.5 Gate

**CI half** -- `C5` cannot be constructed with one value  -  the export payload contains no seller identifier  -  a second claim trigger on an open scope appends rather than creates.

**Emulator half** -- **N18: walk every user-content surface and confirm a report control exists on each** -- product, storefront, review, message, seller. **This is a walk, not a claim**  -  block names an open order where one exists  -  **the claim-evidence interstitial cannot be skipped**  -  the empty claims list reads as good news and offers no action.

**Device half** (deferred) -- the interstitials at the largest OS text size in Amharic, **with the action still pinned** -- the claim-evidence rule is one of the three longest strings in the product.

### 7.6 Review checklist

[ ] two ratings, never one  [ ] the review screen states that it always publishes, before submission  [ ] the single-transaction rule is in the screen's own copy and names what a statement reveals  [ ] a report control exists on every user-content surface, verified by walking the list  [ ] block is separate from report  [ ] `subject_kind` matches the enum  [ ] the export carries no seller identity  [ ] both locale entries.

> [!] **This slice builds two of the four things Apple's guideline 1.2 requires** (ADU-MOB-05 S6). **Filtering objectionable material at write time and published contact information are server-side and site-side and are not in this work order** -- they belong to ADU-PRD-01 v8.6, and **they block submission, not this slice.** Record them in `DEFERRED-GATES.md` under tier 9 so they are not discovered by a reviewer.

---

## WO-8 -- Chat, follows, notifications, account and deletion

**Purpose:** everything that remains, including the two capabilities both stores require and one they will look for.

### 8.1 Read first

ADU-MOB-01 v1.1 **S7.8, S7.9, S10 in full, S16**  -  **ADU-MOB-02 MB-30 to MB-39, and M11**  -  **ADU-MOB-03 H4, S5.1**  -  ADU-AUTH-01 **S7.2, S8.2**  -  ADU-PRD-01 **S9.3, S15, S17.2, S23**  -  **ADU-MOB-05 S4.6, S5.3**  -  **ADU-MOB-06 S7 N13, N15, N19**.

### 8.2 Build

- **MB-30 / MB-31**: `as=buyer` on **every** conversation request -- absent is 400 `SCOPE_PARAMETER_REQUIRED`. Anchored on **exactly one** of a product or an order. **Bot replies rendered from `template_key` + `slots`, never assembled prose, and visibly marked as automatic.** `H4` chips, horizontally scrollable, **wrapping rather than truncating**. **Escalate is free and always available.** **No suggested replies and no generative composer.**
- **Push registration**: token from FCM or APNs -> `PATCH /v1/devices/{id}` with the token and permission state, **on every cold start**, not only at first grant. **This is the tier 2 obligation deferred into this slice** -- a rotated token nobody learns about is a device that silently stops receiving the SIM-swap warning.
- **MB-34**: requested **immediately after the first reservation, never at launch**, with the reason on the screen.
- **The denied path is a requirement**: the order card carries a **persistent badge and a countdown** with the same information the notification would have carried (N13).
- **MB-33**: the notification centre, `as=buyer`, re-read on view, **nothing polls**. Read state syncs across surfaces.
- **On open, deep-link to the object and re-read it.** **Nothing is rendered from a push payload** -- no amount, no deadline, no state name. `tag = order_id` on Android; `threadIdentifier` on iOS.
- **MB-35**: follows and per-seller preferences. **MB-38**: language, **switcher hidden until `AM_ENABLED`.**
- **MB-32**: the account screen, both variants, with **sign out and delete separated by at least one other item and styled differently** (M11).
- **MB-37**: **explain -> phone -> code -> confirm**, in that order. **The app re-verifies the number by OTP even though a session is present** -- a session never mints a deletion ticket. **`O6` renders every blocker with its clearing action.**
- **MB-39**: version, privacy, terms, **published contact information**, licences.

### 8.3 Do not build

- **No local notification of any kind, ever** (B15, gate 4). **A locally scheduled reminder is the client asserting a future state**, and it fires at 21:30 telling a buyer who paid at 21:04 that their order is about to be released.
- **No `revoke-others` control** -- still.
- **No price, tier name, upgrade prompt or billing link on MB-39**, and **the web link goes to the privacy and terms pages, not the site root**, because the site root is where the pricing lives.
- **No "become a seller" invitation** (B19). Outside the United States storefront this is the rule as written, not a caution (ADU-MOB-05 S5.2).
- **The two client events stay wired to a no-op** until the allow-list is reconciled.

### 8.4 The absences that bind this slice

**Gate 4 -- zero `scheduleNotificationAsync`**  -  **gate 6 -- no `as=seller` under Buyer Mode routes**  -  **gate 7 -- no price, tier, currency, upgrade, subscribe or billing term in `packages/locale`**  -  **no state asserted from a push payload**  -  **no polling anywhere.**

### 8.5 Gate

**CI half** -- gates 4, 6 and 7 pass  -  **N19: grep the built bundle and both locale files for tier and price terms**  -  a conversation or notification request without `as=` is impossible to construct  -  no timer drives a refetch.

**Emulator half** -- **N13: deny notification permission, then confirm the order card carries the badge and countdown**  -  **N15: attempt deletion with an open order, an unresolved claim and a pending refund, and confirm all three render with their clearing actions**  -  deletion re-verifies the phone number  -  a push tap on a signed-out session lands on sign-in and then the order  -  bot messages are visibly marked.

**Device half** (deferred) -- push delivery, tray collapse behaviour, and deep-link-on-open **on both devices**  -  the account screen at the largest OS text size, **with sign out and delete measurably separated**  -  **the whole app walked in Amharic, no English** (ADU-MOB-06 S12's fourth charter).

### 8.6 Review checklist

[ ] `as=buyer` on every conversation and notification request  [ ] no local notification  [ ] the push token is refreshed on every cold start  [ ] nothing is rendered from a payload  [ ] the denied-permission fallback exists on the order card  [ ] deletion re-verifies and renders every blocker  [ ] sign out and delete are not adjacent  [ ] MB-39 contains no price, tier, upgrade or seller-recruitment text  [ ] published contact information is present  [ ] nothing polls  [ ] both locale entries.

---

## 9. After WO-8

**Tier 9 is not a work order.** Hardening and submission are **ADU-MOB-05 S8's paperwork gate** and **ADU-MOB-06 S11's evidence pack**, and both are checklists rather than slices.

**What must be true before the first submission is prepared:**

| # | Item | Owner |
|---|---|---|
| 1 | **`DEFERRED-GATES.md` is empty** -- every device half run, on both reference devices | This series |
| 2 | **The twenty negative cases in ADU-MOB-06 S7 each have a recorded result** | " |
| 3 | **The client-event allow-list is reconciled** and the two no-ops are wired | ADU-API-01 v1.12 |
| 4 | **Write-time filtering and published contact information exist** (Apple 1.2) | ADU-PRD-01 v8.6 -- **server-side, and a submission blocker** |
| 5 | **The App Review credential and the seeded QR** | ADU-AUTH-01 v2.9, ADU-MOB-05 S3.3 |
| 6 | **The paperwork track** -- card, enrolment, domain, D-U-N-S, declarations | ADU-MOB-05 S1 |

> **Items 3, 4 and 5 are not code and none of them is this workstream's.** They are the three that will be discovered late if nobody carries them, and **item 4 is the one with no owner at all.**

---

*Working instrument, three slices, and the end of the build. **WO-6 is the smallest of the nine work orders and the only one with a hard blocker in front of it** -- an encoding recorded as interim, on a contract whose other half already ships. **The instruction that matters most in this document is a negative one**: the persisted order idempotency key sits where the deleted scan queue used to be, and the slice that removes every trace of queueing is the slice most likely to take it too. WO-6's review checklist runs WO-4's duplicate-order test again for exactly that reason. **After WO-8 there is no more building** -- what remains is a device with every deferred gate run against it, twenty negative cases with recorded results, and three items that belong to other documents and have been waiting since the first week.*
