# Rulings needed — the register, triaged

**Produced:** T4 Phase G. **Sources:** `DEFECT-REGISTER.md` D-01..D-56 · `SECURITY-REVIEW.md` SR-1..SR-11.
**Audience:** the founder, with a pen. **Everything below is answerable yes/no or with a value.**

---

## How to read this

Four groups. **Only the first needs you.**

| Group | Count | What it means |
|---|---|---|
| **1. Needs a founder ruling** | **11** | A product, legal or commercial decision. Code cannot choose these. |
| **2. Needs a document amendment** | 24 | The build already does the right thing; a document says otherwise and will mislead the next reader. |
| **3. Needs code, already ruled** | 5 | Decided; unbuilt because it was out of scope or blocked on something else. |
| **4. Resolved in passing** | 16 | Fixed, superseded, or answered by a later work order. Listed so nobody re-opens them. |

**Four of group 1 are load-bearing right now** — something already depends on a temporary
decision. Those are marked **[LOAD-BEARING]** and are ordered first, because an open
question nothing depends on can wait and a workaround holding weight cannot.

---

## Group 1 — needs a founder ruling

### The four that are load-bearing

---

**G1.1 — Do we select a KYC vendor now, or close identity verification until we do?** — `D-53`

Today `POST /v1/seller/identity-verification` writes an identity attestation **from
fields the client supplied** — verifier, vendor reference, legal name, ID hash, date —
with no callback to any vendor, because no vendor exists to call. A seller with the
right permission and a step-up code can assert their own ID verification, which is the
IDENTITY eligibility path and, at Pro, the verified badge.

- **Answer with:** *"Vendor is X, build the interface"* — or — *"Restrict the endpoint to
  an operator path until a vendor is chosen."*
- **If answered wrong:** a seller verifies themselves. The badge stops meaning anything,
  which is the one asset the product is built around, and duplicate-identity detection
  (`person.id_hash`) detects only what people choose to tell us.
- **Depends on it now:** every eligibility check on the IDENTITY path; the Phase 2 gate
  where ID verification becomes mandatory.

---

**G1.2 — Do the eleven ladder numbers get set, or does the beta run without a ladder?** — `D-05` (embedding), `Group A/B` in ADU-VAL-01, `D-13`

`core.ladder_config` has sixteen columns and **no values anywhere**. Trust levels are the
product's differentiator; the ladder is what moves a seller between them.

- **Answer with:** the eleven thresholds, or *"beta runs with every seller at NEW."*
- **If answered wrong (too high):** beta sellers stay NEW indefinitely, carry the product
  and transaction caps, and churn. ADU-VAL-01 already names this as the failure that
  kills a beta.
- **If answered wrong (too low):** everyone is Established, the badge signals nothing.
- **Depends on it now:** `fn_recompute_seller_level` runs nightly (built in T4) and
  computes against an empty config — it fails closed, so nobody is promoted, ever.

---

**G1.3 — Is the buyer's money gate on account deletion right?** — `D-35`

We DECIDED, and shipped, that account deletion is **blocked** while the account holds an
order in `PAYMENT_SUBMITTED` or `PAYMENT_CONFIRMED`. The PRD says only "active
reservations released" for buyers and names no blockers.

- **Answer with:** *"Correct"* — or — *"No: here is the settlement path instead."*
- **If answered wrong:** either a buyer who paid cannot delete their account (annoying, and
  an app-store question), or a buyer deletes mid-transaction and the seller is left owing
  goods to a scrubbed account with no one to refund.
- **Depends on it now:** the deletion endpoint refuses these cases today.

---

**G1.4 — Is the scan signature scheme right?** — `D-31`

No document says what key signs a handoff scan or how a client would hold one. We built:
the QR carries an HMAC the **server** minted over (order, nonce, key version); the buyer's
device captures and timestamps it. "Signs once, retries identical bytes" becomes literal.

- **Answer with:** *"Ratified"* — or — the intended scheme.
- **If answered wrong:** every completed handoff since C5 is signed under a scheme that
  has to be migrated, and the scan record is the evidence a claim rests on.
- **Depends on it now:** every QR issued and every scan accepted.

---

### The other seven, in order of what they block

**G1.5 — The eleven deferred values in ADU-VAL-01 §3** (fulfilment window, refund
acknowledgement window, media retention, deleted-number cooling period). *Answer with: a
number each.* **If wrong:** each is a configuration row, tunable later, no rework — which
is why they are here and not above. **Blocks:** the Ethiopian market seed.

**G1.6 — Ownership transfer: who may receive, what notice, what the outgoing owner
keeps.** — `D-24`. *Answer with: three sentences.* **If wrong:** a store changes hands
with the wrong notice and the wrong residual access. **Blocks:** one PARKED endpoint,
built in days once answered.

**G1.7 — The subscription purchase lifecycle.** — `D-36`. Intent expiry, what moves a
subscription to ACTIVE on reconciliation, when the locked rate is written. *Answer with: the
three rules.* **If wrong:** sellers pay and stay on the old tier, or get the new tier
without paying. **Blocks:** nothing today — beta sellers pay nothing — but the endpoints
exist and currently open a collection record that no path closes.

**G1.8 — Do team and courier invites work for a phone with no account?** — `D-37`.
Today: 404, and the invitee signs in once first. *Answer with: yes (needs a pending-invite
table and a notification) or no (keep the current behaviour).* **If wrong:** every seller's
first team invite fails confusingly.

**G1.9 — Does a product get a slug?** — `D-43`. The contract's storefront path says
`{slug}`; no slug column exists, so it is served by id. *Answer with: yes and its
uniqueness scope, or no and the contract says {id}.* **If wrong:** every product URL
changes shape later, and links shared into TikTok break.

**G1.10 — What fills a chatbot template's slots?** — `D-39`. A conversation carries no
product context, so a slotted template cannot be filled and currently escalates. *Answer
with: the resolution model (probably a product-anchored conversation).* **If wrong:** the
chatbot answers a smaller set of questions than it could, silently — containment looks
worse than it is and the S15.3 improvement loop optimises against the wrong signal.

**G1.11 — The device retention period, when a device belongs to no market.** — `D-54`.
Today: the longest `media_retention` in force anywhere. *Answer with: confirm, or give
devices a market.* **If wrong (too short):** anonymous carts vanish under people mid-shop.

---

## Group 2 — needs a document amendment, not a decision

**The build is already correct in every one of these.** Each is a place where a document
now says something the code knowingly does not do, and the risk is that the next person
reads the document and "fixes" the code.

| # | The document says | The build does | Amend |
|---|---|---|---|
| `D-55` | S24: the confirmation-window job cancels and releases stock | S12.4a: no cancellation, stock held, SYSTEM claim (24h); ordinary expiry (12h) | ADU-DB-01 v1.12 S24 row — **founder has undertaken this** |
| `D-15` | `order_clock_consistency` as printed forbids ratified row 17 | The corrected CHECK | ADU-DB-01 v1.11 |
| `D-29` | The courier RLS policy casts a GUC straight to uuid | `nullif(...,'')::uuid` — the printed one raises 22P02 | ADU-DB-01 v1.11 |
| `D-22` | `fn_publication_readiness` is STABLE sql | plpgsql VOLATILE — it must emit an event | ADU-DB-01 v1.11 |
| `D-14` | `fn_mark_order_ready`'s printed body contradicts its idempotency claim | Idempotent by state | ADU-DB-01 v1.11 |
| `D-21` | S9.4 says ten readiness items | Nine, per the wire contract | ADU-DB-01 v1.11 |
| `D-18`, `D-40` | Appendix B's manifest omits two tables the bodies require | Both exist, pinned by name in check 14 | ADU-DB-01 v1.11 (core = 86, total 111) |
| `D-41` | S20's notification table has no read column | `read_at` exists — 12.14 requires read state | ADU-DB-01 v1.11 |
| `D-10` | §20 counts 65 event names; §22 says 68 | 72 seeded, counted by query | Restate as a derivation, like the enum count |
| `D-33` | AUTH 4.2 mandates `OTP_SUPERSEDED` | `OTP_EXPIRED`, whose string says "check for a newer code" | ADU-API-01 v1.7 or AUTH withdraws the code |
| `D-34` | 12.2 lists revoke-others for B S C | CONSOLE only — AUTH 9.1 governs step-up | ADU-API-01 v1.7 |
| `D-30` | 12.5 says a non-buyer gets 403 | 404 — S19 forbids confirming existence | ADU-API-01 v1.7 |
| `D-38` | 12.7 has no way to begin a conversation | An additive `POST /v1/conversations` | ADU-API-01 v1.7 |
| `D-44` | 12.15's subject kinds vs the frozen enum spell two values differently | Mapped at the edge | Either document, whichever reissues first |
| `D-51` | S20.2 "reddens /healthz"; S18 makes a 503 there remove the instance | 200 + `status: degraded` | ADU-CON-02 next reissue |
| `D-27` | The context wrapper sets three settings | Four — a ratified function body reads `adulis.audience` | ADU-CON-02 next reissue |
| `D-47` | S3's grant table never gives adulis_jobs a way to reach core | USAGE + narrow table grants | ADU-DB-01 v1.11 |
| `D-50`, `SR-1` | Nothing states the definer discipline | Own it, revoke PUBLIC, grant by name | ADU-DB-01 v1.11 — **state it as a rule** |
| `D-11` | §14.2 calls a cross-table rule a CHECK | A trigger, because a CHECK cannot | ADU-DB-01 v1.11 wording |
| `D-19` | An upheld claim demotes via MODERATION with no printed moderation_event write | The decision trigger writes one | ADU-DB-01 v1.11 |
| `D-08`, `D-12`, `D-17` | Three tables/mappings described without columns | Built and commented | ADU-DB-01 v1.11 to print or bless |
| `D-02` | The skills pack cites stale filenames | — | Reissue, or point at DOCUMENT_AUTHORITY.md |
| `D-06` | `waitlist.application` is in the manifest but no migration owns it in §28 | Built in 0017 | ADU-DB-01 v1.11 |
| `D-56` | Code cites register D-25 and D-28; neither entry exists | — | Back-fill the register |

---

## Group 3 — needs code, already ruled

| # | What | Why it is not built |
|---|---|---|
| `D-42` | `POST /v1/seller/analytics/export` | Async job writing to R2; needs a job-handle table and the R2 adapter |
| `D-24` | `POST /v1/seller/ownership-transfer` | Blocked on **G1.6** |
| `D-05` | HNSW index on `nlu.intent_phrase.embedding` | Blocked on the embedding dimension (**G1.2**'s sibling) |
| `R19` | `analytics.retire_partitions` | Explicitly tier 8; needs ~10k sellers and a Parquet export |
| — | The operator surface (ADU-OPS-01) | A separate deployment. **Every operator queue currently fills and nothing drains it** — claim review, moderation, identity review are founder work against the database by hand ([runbook](../../ops/runbooks/grant-founder-operator.md)) |

---

## Group 4 — resolved in passing, do not re-open

`D-01` T2-B never arrived; T3 superseded it · `D-03` check 5 harness corrected · `D-04`
release reasons proven by A3.2's own index · `D-07` parked bodies all written by C1-C8 ·
`D-09` cancellation weights folded into ladder_config · `D-16` the financial write path
exists (check 10 permits it by name) · `D-20` bootstrap values shipped as defaults ·
`D-23`, `D-26` the reserved SQLSTATEs are in use and consistent · `D-32` step-up single
use fixed in 0023 · `D-45` the two client events seeded in 0024 · `D-46`/`SR-1` PUBLIC
execute revoked in 0025, guarded by check 10 · `D-48` purge is a boundary function ·
`D-49` analytics ownership aligned · `D-50` superuser definer re-owned · `D-52` worker
schema installed by the DDL role · `SR-2`..`SR-11` verified with evidence.

---

## The one-line version

**Answer G1.1 (KYC) and G1.2 (the ladder) and the product can be trusted by a stranger.**
Everything else on this page is either a document catching up with the code, or a decision
that can wait for evidence.
