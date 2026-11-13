# ADU-MOB-AMD-01 -- Offline Withdrawal Amendment Set

**Version:** 1.0  -  **Baseline date:** 5 September 2026
**Owner:** Founder / CEO
**Status:** Amendment set. **Applying it withdraws offline capability from the Adulis clients** and reissues seven documents.
**Ruling source:** Founder ruling, 5 September 2026 -- *"There is no such thing as offline mode. Everything needs to work online."*
**Amends:** ADU-PRD-01 v8.5  -  ADU-API-01 v1.11  -  ADU-DB-01 v1.19  -  ADU-ARCH-01 v2.0  -  ADU-CON-01 v1.0  -  ADU-VAL-01 v1.0  -  ADU-MOB-00 v1.0  -  ADU-MOB-01 v1.0
**Encoding:** ASCII.

---

## 0. What this is, and why it is document zero

**A ruling that lives only in a conversation is not a ruling.** ADU-PRD-01 S23 currently reads *"the QR handoff scan must work offline and sync later"*, and ADU-API-01 S14 currently reads *"scan capture and queued sync are the only offline-capable operations."* An agent given a mobile work order reads those, not this decision. **Until they are amended, the offline queue is still specified, and a capable agent will build it.**

This set is written before ADU-MOB-02, before the design system, and before any work order, because every one of those inherits the answer.

### 0.1 How to apply

Each amendment gives an **anchor** -- text as it stands today, quoted exactly enough to locate once -- and the **replacement**. Where an amendment deletes rather than replaces, it says what must not be deleted with it, because **the wrong deletions are the expensive part of this change** (S1.4).

### 0.2 What is on the wire, and what is not

| Amendment | Wire | Schema | Breaking |
|---|---|---|---|
| **A** ADU-PRD-01 | No | No | No |
| **B** ADU-API-01 | **No -- see B24 and B27** | No | No |
| **C** ADU-DB-01 | No | **No -- nothing is dropped** | No |
| **D** ADU-ARCH-01, ADU-CON-01, ADU-VAL-01 | No | One config **value** | No |
| **E** ADU-MOB-00, ADU-MOB-01 | No | No | No |

> **The whole of this change is a client change and a documentation change.** No endpoint moves, no column drops, no migration runs. That is deliberate and S1.2 says why.

---

## 1. The ruling, in full

### 1.1 What is withdrawn

> **RULING -- the Adulis clients are online-only. No client persists an unsent write, retries a request across a process lifetime, or presents stale server state as current.**

Withdrawn with it: the local scan queue, background or deferred sync, the batch-drain model, the persistence-across-reinstall requirement that had no achievable answer on Android, and every design consequence that hung off them.

### 1.2 What is deliberately kept, and this is the important half

> **RULING B24 -- the server's tolerance for a scan that arrives later than it was taken is KEPT, unchanged, including every column and outcome that implements it.**
>
> `core.handoff_scan` keeps `signed_at`, `reported_clock_offset_ms`, `corrected_at`, `received_at`, `validity` and `counts_toward_level`. The `corrected_at` floor at `order_qr_token.issued_at` stays. `LATE`, `REJECTED_HORIZON` and `REJECTED_REPLAY` stay. `level_credit_grace` stays.
>
> **Three reasons, and the first decides it.**
>
> **The doorway did not stop existing.** The ruling changes what the *client* does about a weak signal, not whether weak signal happens. A buyer who scans, fails, walks ten metres and scans again at 18:42 is now the ordinary case rather than the exceptional one -- and the tolerance is exactly what makes that scan count as a verified handoff instead of a lost one.
>
> **Scan completion rate is the currency of the trust ladder** and a release gate that carries double weight (ADU-PROJ-01 S12). Deleting the tolerance would not simplify the product; it would quietly lower the number Phase 2 is gated on, in the places where deliveries actually happen.
>
> **It is already built, tested and proven.** Removing it costs a migration, a code deletion and a test rewrite, and buys nothing. **A simplification that requires work in order to remove a safety net is not a simplification.**

### 1.3 The scan at the doorway -- what the client does now

> **RULING B25 -- the scan is a foreground request with in-session retry, and nothing more.**
>
> The scanner decodes the QR, stamps `signed_at` at that moment (D-156), and **POSTs immediately.** On failure the buyer sees a plain retry state and stays on the screen; the app retries on connectivity regain **while that screen is open**. There is no queue, no background task, no persistence.
>
> **If the buyer leaves the screen or the app is killed, the scan is gone.** The order is then completed by `POST /v1/orders/{id}/confirm-receipt` -- the tapped tier, medium weight, no level credit -- which already exists and already means exactly that.
>
> [!] **The cost, stated rather than buried.** A buyer in a compound with no signal completes the order by tapping instead of scanning. The seller loses the verified badge and the level credit for that handoff. Under the previous design they would have got it minutes later; they now get it only if signal returns before the buyer walks away. **That is the price of the ruling, it is paid by sellers in poor-coverage areas, and it is the number to watch** (S5).
>
> **Retry budget:** the screen retries for as long as the buyer leaves it open, with backoff, and never silently. **It must not auto-navigate away from a pending scan.**

### 1.4 The five things that must not be deleted with the queue

**An agent told "remove offline" will over-delete, and one of these would reintroduce a defect the contract names by number.**

> **RULING B26 -- the following are not offline features and are unaffected by this ruling.**
>
> 1. **The persisted idempotency key for `POST /v1/orders`** (ADU-MOB-01 B6). It defends against a process kill mid-request, which happens on a good connection. **Deleting it re-opens ADU-API-01's gap A2** -- *"a retry on a flaky connection creates a second order"* -- and produces a second order, a second stock decrement and a buyer charged twice by their own bank.
> 2. **The device id and session token in secure storage.** Persistence of a credential is not an offline capability.
> 3. **The public product-image cache.** It saves the buyer's metered data on images they already loaded. It never holds an authenticated response.
> 4. **The in-app notification fallback** -- the badge and countdown on the order card where push permission was denied (ADU-PRD-01 S9.3, S17.3). That is an **online** surface reading `expires_at` from a live response.
> 5. **`expo-updates` and the app shell.** A shipped bundle is not cached server state.
>
> **What this leaves:** the app's local storage holds a device id, a session token, one idempotency key, a locale preference, and images. **Nothing else, and no `/v1/*` response body, ever.**

---

# SECTION A -- ADU-PRD-01, into the pending v8.6

## A1. S23 -- the non-functional table

**Anchor**

| **Offline** | The QR handoff scan must work offline and sync later. |

**Replacement**

| **Connectivity** | **The clients are online-only.** No client queues an unsent write, retries across a process lifetime, or renders stale server state as current. A handoff scan is a foreground request with in-session retry; where it cannot be sent, the buyer completes by tapped confirmation at its lower evidence weight (S11.3) |

## A2. S11.4 -- rewritten, and its title changes

**Anchor:** the whole of S11.4, *"Offline scans and late sync"*, beginning *"A handoff happens in a doorway with no signal"* and ending *"...must not be lost on reinstall within the sync horizon."*

**Replacement**

> ### 11.4 Late-arriving scans
>
> A scan is submitted the moment it is taken. **It may still reach the server later than it was taken** -- a slow uplink, a retry after a failed attempt, a buyer who moves to find signal. The rules below govern that gap, which is now measured in seconds and minutes rather than hours.
>
> **INVARIANT -- the timestamp stamped by the scanning device governs order completion, not the moment the scan reaches the server.** The scanner stamps epoch milliseconds at scan time; the token itself carries no timestamp, because a timestamp printed into a rendered code would be the moment the seller opened the screen.
>
> **INVARIANT -- server receipt time governs level advancement.** Completion trusts the device; level credit trusts the server. The two tests were separated because their failure costs are opposite, and that reasoning is unchanged.
>
> | Condition | Outcome |
> |---|---|
> | Corrected scan timestamp within the reservation window | **Valid verified handoff.** The order completes and, where receipt is inside the window plus `level_credit_grace`, counts toward trust level |
> | Corrected timestamp after the window closed | **Late.** The order completes; a review publishes at *confirmed by buyer* weight; no level credit; the order does not reopen |
> | Submitted more than `scan_submission_horizon` after its timestamp | Rejected |
> | Nonce already seen with a different payload | **Rejected as replay**, always |
>
> **INVARIANT -- stock is never re-decremented when an expired order is completed by a late scan.** The completion path writes a reconciliation `StockEvent` with `delta = 0`, records the discrepancy and notifies the seller. Where the released stock was reserved by a different buyer in the interval, both orders are flagged for the moderation queue.
>
> **Design consequence for the app.** A scan in flight is shown as **sending**, with a plain retry control, and the buyer stays on the screen until it settles. **It is not persisted, it does not survive leaving the screen, and it must never be shown as complete before the server says so.** Where it cannot be sent, the buyer is offered the tapped confirmation and told plainly that it is the weaker record.

## A3. S24 -- the test list

**Anchor**

- **Offline scan reconciliation: in-window late sync completes the order without re-decrementing stock; out-of-window sync does not advance trust level; replayed nonce is rejected; sync beyond the horizon is rejected**

**Replacement**

- **Late-scan reconciliation: an in-window late submission completes the order without re-decrementing stock; an out-of-window submission does not advance trust level; a replayed nonce is rejected; a submission beyond the horizon is rejected**
- **A scan that cannot be sent is never shown as complete, and the tapped confirmation is offered with its weight stated**

---

# SECTION B -- ADU-API-01, to v1.12

## B1. S14 -- the non-functional table

**Anchor**

| **Offline** | Scan capture and queued sync are the only offline-capable operations (S23) |

**Replacement**

| **Connectivity** | **None. Every operation requires the network.** A write that times out is retried with the same idempotency key, in session; no client holds a queue |

## B2. S12.6.1 -- rewritten, and it absorbs the F1 correction already owed

**Anchor:** the opening invariant of S12.6.1.

> **INVARIANT -- the client signs once, at the moment of scanning, and stores the signed blob. Every retry transmits the identical bytes.** It never re-signs.

**Replacement**

> **INVARIANT -- the client captures the token once, at the moment of scanning, stamps `signed_at`, and freezes that tuple for the life of the attempt. Every retry transmits the identical bytes.** It never re-derives any part of it.
>
> **INVARIANT -- the scanning device holds no key and performs no cryptographic operation.** `signature` is **the server-minted token, read out of the QR code and transmitted unchanged** -- ADU-DB-01 S14.2 mints it as an HMAC over `(order_id, nonce, key_version)` and rejects client-side signing by name. `nonce` and `order_ref` are likewise read out of the token; **the client invents none of the three.**
>
> **"Freezes" is not a cryptographic claim.** What the client guarantees is immutability across the retries of one attempt, which is what lets the server tell an idempotent retry from an attack. The discriminator is the payload, not the nonce.

> **This replaces amendment A1 of the ADU-API-01 v1.8 set, which was drafted and not applied.** The wording is folded in here because this amendment rewrites the same paragraph.

**Anchor**

**Request.** Up to **50** scans; above that, 413 `PAYLOAD_TOO_LARGE`. `Idempotency-Key` covers a whole-batch retry; the per-nonce rules below cover a partial resend, which is the more common case because the client drops items as they settle.

**Replacement**

> **Request.** An array of scans. **The online-only clients send exactly one** (ADU-MOB-AMD-01 B27); the array shape, the 50-item cap and the per-item envelope are retained unchanged, so no client and no server code changes and a batching caller remains possible without a contract revision.
>
> `Idempotency-Key` covers a retry of the whole request. The per-nonce rules below cover the case where the same scan is submitted twice.

**And the outcome table's client-action column** loses *"Drop the local copy"* and *"Drop"* throughout -- there is no local copy. `REJECTED_HORIZON` reads *"Show as expired, explain plainly"*; the two logged rejections read *"Log; surface nothing"*.

> **RULING B27 -- the wire contract does not change; the client's use of it narrows.** Adding a single-scan endpoint would be tidier and would cost a contract revision, a second code path and a second set of tests to keep in step with the first. **An array of length one is free.**

## B3. S12.6 -- the QR row

**Anchor**

| GET | `/v1/seller/orders/{id}/qr` **M** | The seller displays; the buyer scans (S11.1). **409 `ORDER_NOT_READYABLE` before `PAYMENT_CONFIRMED`** -- R20. **Cached by the app for offline display at a doorway** |

**Replacement**

| GET | `/v1/seller/orders/{id}/qr` **M** | The seller displays; the buyer scans (S11.1). **409 `ORDER_NOT_READYABLE` before `PAYMENT_CONFIRMED`** -- R20. **Fetched when the screen opens; held in memory for the life of that screen and not persisted** |

## B4. S3.2 -- `X-Adulis-Clock-Offset` is retained, and the reason is restated

**No text change to the header row.** Add beneath it:

> **The offset is still reported and still corrected server-side**, because `signed_at` is still stamped by the device and still floored at token issuance. Online submission narrows the gap; it does not remove the device clock from the calculation. **A cheap phone with a wrong clock must not cost an honest seller a level-counting handoff**, and that was never an offline concern.

## B5. S1 -- the gap register

**A3** keeps its resolution and gains a line: *"The batch shape is retained under ADU-MOB-AMD-01 B27; the online-only clients send one item."*
**A5** is unchanged. The scan timestamp is still signed by a device the buyer controls, and the floor at `issued_at` is still what bounds the lie.

---

# SECTION C -- ADU-DB-01, to v1.20

## C1. S14.2 -- nothing is removed, and the document says so

**No DDL change. No migration.** Add to S14.2:

> **The client is online-only from ADU-MOB-AMD-01, and this section is unchanged by that.** `signed_at`, `reported_clock_offset_ms`, `corrected_at`, `received_at`, `validity` and `counts_toward_level` all remain, for the reason in B24: the gap between when a scan is taken and when it arrives is now seconds rather than hours, **and it is not zero.** A scan retried after a failed attempt, or taken where the uplink is slow, is the ordinary case this machinery now serves.
>
> **The alternative was considered and rejected.** Having the server stamp receipt as the governing time would delete `corrected_at`, the offset and the floor -- and it would make every scan taken at a doorway and submitted from the road count as taken from the road. It buys a smaller schema at the cost of the tolerance, and it costs a migration to obtain.

## C2. `timing_config` -- one value moves, one name is now wrong

| Column | Change |
|---|---|
| `offline_sync_horizon` | **The value is reopened** -- ADU-VAL-01, Section D3. **The column and the `REJECTED_HORIZON` outcome are retained**: they now bound how stale a client-stamped timestamp may be, which is an anti-backdating control and was always partly that |
| `level_credit_grace` | Unchanged at 24 hours. It now almost never binds, and it costs nothing to keep |

> [!] **`offline_sync_horizon` is now a misleading name for a control that no longer defends against offline anything.** The honest name is `scan_submission_horizon`. **A rename is a migration and is deferred to the next time the DB is opened for another reason** -- recorded here so the next author does not have to re-derive it, in the manner of `RECOVERY_COOLING`. **Until then the column name is wrong and the documents say what it means.**

---

# SECTION D -- the three one-line amendments

## D1. ADU-ARCH-01 S5

**Anchor**

**The QR is cached by the seller's app**, which is where the doorway problem is actually solved: a native app holds the token offline properly, where v1.1 had to rely on a Telegram-cached image and then withdrew even that when Telegram went seller-only.

**Replacement**

> **The QR is fetched when the seller opens the handoff screen and is held only for the life of that screen.** Under ADU-MOB-AMD-01 no client holds it offline. The doorway problem is not solved by caching; it is **bounded** -- by in-session retry, by the server's tolerance for a late-arriving scan (B24), and, where signal never returns, by the tapped confirmation at its lower weight.

**And S5's closing sentence** -- *"Scanning lives in Buyer Mode, in the native app, where S23's offline requirement belongs"* -- becomes: **"Scanning lives in Buyer Mode. S23 no longer carries an offline requirement."**

## D2. ADU-CON-01 R11

**Anchor**

Offline capability in this product belongs to the mobile app's scan capture, and nowhere else (API S14).

**Replacement**

> **There is no offline capability in this product.** The console's service worker still caches the application shell and static assets only, still never caches an authenticated API response, and still holds no offline queue -- **and now neither does anything else.** R11's rule is unchanged; what changed is that it is no longer an exception carved out for one surface.

## D3. ADU-VAL-01 S2

**Anchor**

| Offline scan sync horizon | **7 d** | `timing_config` | Real courier connectivity in Phase 0 |

**Replacement**

| Scan submission horizon (`offline_sync_horizon`) | **1 h -- proposed default, reopened** | `timing_config` | **Was 7 d, sized for offline sync that no longer exists.** It now bounds how far a client-stamped timestamp may lag its submission, so it is an anti-backdating control. **It must not be shorter than the in-session retry budget of ADU-MOB-AMD-01 B25.** Settle it with the retry budget, not separately |

---

# SECTION E -- the two mobile documents

## E1. ADU-MOB-01 -> v1.1

| Section | Change |
|---|---|
| **S9** *(Offline -- exactly one thing, and the trap inside it)* | **Deleted in full and replaced** by a short **S9 Connectivity**: the online-only doctrine (S1.1), the scan's foreground behaviour (B25), the disk table of B26, and the sentence that no `/v1/*` response is ever persisted |
| **B11** *(one offline capability)* | Withdrawn. Replaced by B25 |
| **B13** *(reinstall persistence)* | Withdrawn. **The finding it recorded -- that "must not be lost on reinstall" was unachievable on Android -- is retained in the register**, because the reason a requirement was withdrawn is worth more than the requirement |
| **B14** *(no background sync)* | Withdrawn as redundant. There is nothing to sync |
| **B12** *(the device holds no key)* | **Stands, and is now confirmed by D-156.** Reinforced by B2 above |
| **B6** *(persisted order idempotency key)* | **Stands. See B26 -- this is the one an agent will delete by mistake** |
| **S2, S15, S17.5, S18 T6, S20.3, S25** | The offline lines are struck; the absences list loses "no offline write except the scan" and keeps "no persisted API response" |
| Header and version references | Re-verified against DB v1.19, API v1.11, AUTH v2.8 -- and the corrections in the ADU-MOB-00 evaluation v1.1 S9 applied in the same pass |

## E2. ADU-MOB-00 -> v1.1

| Section | Change |
|---|---|
| **S4.4** *("Offline is real, and it is the Companion's half")* | **Deleted.** Replaced by: *"Nothing is offline. The scan is a foreground request; the QR is fetched when the screen opens. See ADU-MOB-AMD-01."* This also disposes of the finding that S4.4 assigned the requirement to the wrong mode |
| **S4.3** | Keeps the scanner-stamps-the-clock rule, which is right and is now confirmed by D-156. **The Ed25519 sentence is struck** -- the primitive appears in no governing document, and B2 above states what is actually minted |
| **S2** | *"or register findings against it"* struck |

---

## F. Application checklist

| # | Applied when | Proven by |
|---|---|---|
| **A1-A3** | ADU-PRD-01 v8.6 carries the connectivity row and the rewritten S11.4 | The S24 test list names late-arrival, not offline sync |
| **B1-B5** | ADU-API-01 v1.12 | `grep -i offline contracts/ docs/ADU-API-01*` returns only the retained `offline_sync_horizon` column name and its explanation |
| **C1-C2** | ADU-DB-01 v1.20 | **No migration is produced by this amendment.** If one is, something was deleted that B24 says stays |
| **D1-D3** | ARCH-01, CON-01, VAL-01 | -- |
| **E1-E2** | ADU-MOB-01 v1.1, ADU-MOB-00 v1.1 | ADU-MOB-01 contains no SQLite queue, and **still contains B6** |
| **All** | -- | **The five in B26 are present after the change.** This is the check that matters: the change is a deletion, and the risk is deleting one thing too many |

---

## G. What this amendment does not settle

| # | Open | Owner |
|---|---|---|
| **G1** | **The in-session retry budget** -- how long the scan screen retries, with what backoff, before it offers the tapped confirmation. It sets the floor for D3's horizon value | ADU-MOB-02, with ADU-VAL-01 |
| **G2** | **The QR payload encoding** -- D-156's ruling is still owed: field names, ordering, and whether the payload is JSON, a URL or compact binary. **Owed before the buyer's scanner is built**, and this amendment does not touch it | Founder ruling |
| **G3** | **What the seller's Companion does when the QR fetch fails** at the doorway. Symmetrical to B25 and belongs to ADU-CMP-01 | ADU-CMP-01 |
| **G4** | **Whether scan completion rate moves** once buyers in poor coverage tap instead of scanning. **It is the number this ruling puts at risk**, it is already a release gate, and it should be watched from the first beta handoff rather than at the gate | ADU-MOB-06, ADU-PROJ-01 S12 |

---

*Amendment set. One ruling, eight documents, no migration and no endpoint change -- because the withdrawal is a client change, and the server behaviour it appears to remove is the tolerance that now matters more rather than less. The half of this document worth re-reading is S1.4: the change is a deletion, the queue is easy to find, and the persisted idempotency key sitting next to it is not part of it. Deleting that one would trade an offline feature nobody asked for against a duplicate order the contract already names by number.*
