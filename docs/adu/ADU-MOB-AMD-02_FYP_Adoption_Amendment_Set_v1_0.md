# ADU-MOB-AMD-02 -- FYP Adoption Amendment Set

**Version:** 1.0  -  **Baseline date:** 7 September 2026
**Owner:** Founder / CEO -- sole engineer
**Status:** **Amendment set.** It implements an approved product ruling across the document corpus. **It does not question the ruling**; it records what the ruling costs and what must survive it.
**Ruling implemented:** Adulis builds a personalised For You Page. The followed-sellers recency feed is superseded wherever it conflicts (Adulis Mobile AI-Assisted Engineering Manual S2, 7 September 2026).
**Amends:** ADU-PRD-01 v8.5  -  ADU-PD-01 v1.0  -  ADU-API-01 v1.11  -  ADU-DB-01 v1.19  -  ADU-DPIA-01 v1.0  -  ADU-MOB-01 v1.2  -  ADU-MOB-02 v1.0  -  ADU-MOB-03 v1.0  -  ADU-MOB-04 v1.0  -  ADU-MOB-05 v1.0  -  ADU-MOB-06 v1.0  -  ADU-MOB-PLAN-01 v1.0
**Companion to:** ADU-MOB-AMD-01 (offline withdrawal), whose shape this follows deliberately.
**Encoding:** ASCII.

---

## 0. What this is

### 0.1 The ruling, restated once

**Adulis builds a personalised For You Page as the home surface.** It supports personalised ranking, cross-seller discovery, infinite continuation, candidate generation, exploration and exploitation, watch-time measurement, and commerce-outcome measurement.

**Any sentence in the corpus equivalent to *"the feed is a query, not a recommender"* is superseded**, and no reviewer -- human or agent -- may reject FYP work by citing one.

### 0.2 What this amendment is for

**AMD-01 taught the lesson this document is built on.** That amendment withdrew a feature and warned about deleting one thing too many. **What actually happened was the opposite: it deleted one thing too few**, and residue survived in three documents -- including one of the four premises ADU-QA-01 is built on.

> **AMD-02 has both failure modes at once, and the second is worse.**
>
> **Over-deletion:** an agent told *"the followed feed is superseded"* will remove things that are not the feed -- the follow graph, the install-seam recovery paths, the per-seller search scope. **S G lists eight.**
>
> **Under-deletion:** a sentence forbidding recommenders, left in a governing document, becomes a reviewer's veto over authorised work six months from now. **S A to S F name each one.**

**This document is a client and product amendment. It is not the FYP system design.** That document does not exist and is not owed yet -- see S H.

### 0.3 What each document owes

| Document | Migration | Endpoint change | Client change | Re-assessment |
|---|---|---|---|---|
| **A** ADU-PRD-01, ADU-PD-01 | No | No | No | -- |
| **B** ADU-API-01 | -- | **Yes** | Yes | -- |
| **C** ADU-DB-01 | **Yes -- the first in this workstream** | -- | -- | -- |
| **D** ADU-DPIA-01 | No | No | No | **Yes, and it is not an amendment** |
| **E** ADU-MOB-01 to -04 | No | -- | **Yes** | -- |
| **F** ADU-MOB-05, -06 | No | No | No | Store answers, test cases |

---

## 1. The rulings

### B28 -- the server ranks, and the client selects nothing

> **The client requests the FYP. The server decides eligibility, candidates, ranking, filtering, exploration, diversity and the ranker version.**
>
> **No production client parameter chooses a ranking algorithm, a sort, or an objective.** `?ranking=`, `?sort=`, `?algorithm=` do not exist on any client-reachable path.
>
> **ADU-API-01 S12.8's rule survives; its stated reason does not.** The old reason was *"an endpoint that accepts a ranking parameter is one flag away from being a recommender."* **The new reason is stronger and permanent: ranking must evolve without a store round.** Several app versions are live for months (S3.1), and a client that pinned an algorithm would pin it until every install updated.
>
> **A rule whose reason has been falsified erodes.** Restate the reason in the same edit that keeps the rule.

### B29 -- ranking is not a trust signal, and no FYP score is ever rendered

> **The FYP may order what a buyer sees. It may not tell a buyer what to think about a seller.**
>
> `fn_recompute_seller_level` remains **the only** source of a seller's level. **No FYP score, rank, position, engagement figure or derived popularity renders anywhere in the app** -- not as a badge, not as a star, not as "popular", not as "trending near you", not as ordering that is labelled.
>
> **This is the deepest conflict the ruling creates and it is not a filter problem.** ADU-PROJ-01 doctrine 11: *trust is earned, never purchased. The moment trust is purchasable, it is worthless.* Today a seller becomes visible by completing scanned handoffs. **A ranking system creates a second path to visibility that is not the ladder** -- cheaper to reach, and far cheaper to game.
>
> **The ruling does not resolve that tension; it creates it.** What B29 does is confine it: **ranking may affect order, and may never affect the trust surface.** Whether commerce outcomes should feed the ladder, or the ladder should feed ranking, is S J item 2 and it is a founder ruling.

### B30 -- ranking is never purchasable

> **No promoted placement, no boosted listing, no paid position, no "featured" tier. Ever, on any surface, at any price.**
>
> Two independent reasons, and either alone is sufficient. **Doctrine 11**, above. And **Apple 3.1.1**: a purchase mechanism for a digital benefit inside the app is in-app-purchase territory, and ADU-MOB-05 S5 established that Adulis ships outside the United States storefront where the relaxation does not apply -- while Play merchant registration is unavailable in Ethiopia entirely.
>
> **This ruling is cheap today and expensive later**, which is exactly when someone proposes it as a revenue line.

### B31 -- instrumentation precedes ranking

> **No ranking beyond eligibility-plus-recency ships before the event contract exists, is versioned, and has been proven to produce attributable exposure data.**
>
> The engineering manual S6 is right that a recommender without trustworthy exposure data cannot be evaluated. **This makes it a gate rather than a preference:** every impression carries an impression identifier, a ranker version, a candidate source and a position, or the ranking that produced it cannot be assessed and must not be tuned.
>
> **The corollary is the honest one:** at controlled-beta scale there may not be enough interaction data for learned ranking for a long time. **Build the events anyway** -- they are the product analytics regardless -- **and date the expectation rather than letting "later" become "never".**

### B32 -- the eight that must not be deleted with the old feed

**Section G, in full. It is the reason this document exists.**

### B33 -- MB-01 Life 1 survives unchanged

> **ADU-MOB-02 M3's first-run screen -- the two recovery paths and one sentence -- is not a feed feature and is not superseded.**
>
> ADU-PRD-01 S21.2: short codes were removed, nothing carries the specific product across an install, and *"the app's first screen must offer both."* **`reserve_intent_web` against `first_reservation_created` is a release gate measuring exactly that loss.**
>
> **An FYP on the home screen makes those two controls look redundant. They are not.** A buyer who tapped a bio link for one specific product, installed, and landed on a personalised feed **has still lost the product they came for.** The FYP is the second thing on that screen, not the first thing that replaces it. **It also becomes the cold-start surface the engineering manual S34 asks for -- so it is load-bearing twice.**

### B34 -- until video hosting is ruled, the FYP is built on what Adulis already stores

> **The FYP's media strategy is unresolved and the corpus disagrees with itself about the current state.**
>
> **ADU-CON-03 SC-10** has sellers uploading one video per product to Adulis -- 30 seconds, 480p, `POST .../video`. **ADU-MOB-01 B8** has the product screen rendering a **click-to-load third-party embed** in the only WebView in the app, with the page fully functional when the embed is never tapped.
>
> **An infinite scroll of click-to-load embeds is not a feed.** A TikTok-shaped surface requires Adulis to serve video at scale -- new storage, new egress, new moderation, and a cost model neither ADU-MOB-01 S21 nor ADU-CON-02-A1 contains.
>
> **Until that is ruled: the FYP renders what Adulis already holds** -- product media derivatives and the poster frames it stores itself. **Do not build a video pipeline inside a feed slice.** S J item 1.

---

## A. ADU-PRD-01 and ADU-PD-01 -- the sentences that must be struck

**No migration, no endpoint, no client change. These are the reviewer vetoes.**

| # | Location | Current | Amendment |
|---|---|---|---|
| **A1** | **ADU-PRD-01 S17.2** | *"No personalisation model, no learned ranking, no engagement scoring. The feed is a query, not a recommender."* | **Struck and replaced.** The home surface is a personalised, server-ranked discovery feed. **Retain the sentence in a superseded block with its date** -- it was a deliberate position, and the reason it was held is worth more than the position |
| **A2** | **ADU-PD-01 S2** | *"no feed algorithm, no recommendations, and nowhere to store a ranking score"* | **Struck.** The third clause is a schema statement and it drives amendment C |
| **A3** | **ADU-PRD-01 S17.2, following** | -- | **New: the multi-objective statement.** Watch time is evidence of interest, not the outcome. **Commerce outcomes outweigh engagement as data allows**, and a surface producing long sessions and few reservations has not succeeded |
| **A4** | **ADU-PRD-01 S18** | UGC obligations | **Widens.** Apple 1.2's write-time filtering, already an unowned blocker, now applies to **content a buyer never chose to see**. S F |
| **A5** | **ADU-PRD-01 S11.3** | The trust ladder | **Unchanged, and explicitly so.** B29 |

> **A1's retained block is not sentiment.** ADU-MOB-01 F2 is retained for exactly this reason: *"the reason a requirement was withdrawn outlives the requirement."* Somebody will propose returning to a chronological feed, and they should find the original argument rather than reinvent it.

---

## B. ADU-API-01 -> v1.12

| # | Section | Amendment |
|---|---|---|
| **B1** | **S12.8**, the feed endpoint | **The no-ranking-parameter rule is kept and its reason is replaced** (B28). The endpoint becomes cursor-continued with a bounded page size, and **returns a ranker version and a per-item candidate source and position** |
| **B2** | **S12.8** | **Each item carries an impression identifier minted server-side.** A client-minted one cannot be trusted for evaluation and can be replayed |
| **B3** | **New: the FYP event ingest path** | First-party, batched, bounded, idempotent by `event_id`. **Retries must not double-count** (engineering manual S15) |
| **B4** | **S11 / S12.16** | **The client-event allow-list, already contradictory across two sections (ADU-MOB-01 F3), now has to carry the FYP set.** Reconcile it *before* adding to it, or the reconciliation never happens |
| **B5** | **S7** | The error surface gains nothing. **A failed FYP fetch is a transport error with a retry** -- there is no degraded feed and no stale-content fallback (E, gate 5) |

> [!] **B4 is the sequencing trap in this amendment.** The allow-list has been contradictory since before the mobile workstream started. **Adding fifteen FYP events to a list that already disagrees with itself makes it permanently unresolvable.** Reconcile first.

---

## C. ADU-DB-01 -> v1.20 -- and this one is a migration

> **AMD-01 produced no migration and said so as a check on itself. AMD-02 produces the first schema change this workstream has needed**, and that difference is the honest measure of the two rulings' relative size.

| # | Amendment |
|---|---|
| **C1** | **Somewhere to store a ranking score.** ADU-PD-01 said there was nowhere; A2 strikes that, and the schema now needs it |
| **C2** | **The exposure record** -- impression, position, ranker version, candidate source, session. **High-volume, append-only, and it does not belong in `core`** |
| **C3** | **The event store**, with its schema version. **Retention is a DPIA question before it is a storage question** (D) |
| **C4** | **The two-store discipline from ADU-DB-01 S17.2 applies here by analogy and should be stated.** The chatbot workstream already ruled that `nlu` holds no `conversation_id` and no `buyer_id`; **the ranking store deserves the same boundary and the same absence of foreign keys**, for the same reason -- it is where an agent would quietly join behaviour to identity |
| **C5** | **Eligibility is a read of existing truth, never a copy.** Stock, publication state, seller suspension and trust level are **joined at query time or filtered at serve time -- never denormalised into a feed row.** A stale eligibility copy recommends a product that is gone |

---

## D. ADU-DPIA-01 -- the one that is not an amendment

> [!] **This is a re-assessment, and it is above this workstream.**

**"Recency over the sellers you chose to follow" and "a model that infers what you want from your behaviour" are not the same processing.** The second builds a behavioural profile of an identified person.

**Three things follow, none of which this document can settle:**

1. **ADU-MOB-01 Q3 -- the Article 22 hosting opinion -- is already open and unresolved.** Personalised ranking from behavioural history sits materially closer to automated decision-making about individuals than anything the DPIA has assessed. **Q3 was above this workstream before; it is now also larger.**
2. **Retention, minimisation and purpose limitation for the event corpus** need a lawful basis stated before the first event is collected, not before the corpus is used for training. **ADU-BOT-19 made exactly this point about beta conversations** -- *personal data before it is a dataset* -- and the same sentence applies here.
3. **The engineering manual S6's prohibition is correct and insufficient.** Keeping tokens, OTPs and payment evidence out of events is table stakes. **The harder question is whether a behavioural profile is itself a category requiring a control**, and that is a lawyer's answer.

**Nothing in this amendment authorises collection.** B31 gates ranking on instrumentation; **D gates instrumentation on an assessment.**

---

## E. The mobile documents

### E1. ADU-MOB-01 -> v1.3

| Section | Amendment |
|---|---|
| **S7.9** | The feed row rewritten: server-ranked, cursor-continued, ranker version returned, **no client sort or ranking parameter** (B28) |
| **S15** | *"No cross-seller search, browse or recommendation"* and *"no ranking, sorting or personalisation parameter on any request"* -- **both struck from the never-does list**, with the retained-history note. **Everything else in S15 stands, and S15 is where an over-deletion would do the most damage** |
| **S13** | **The performance budgets are reissued.** 1.5 MB per storefront visit, 200 MB memory on a 60-item grid and a 30 MB download were set for a product grid on a 2 GB Android. **A media feed breaks all three.** New numbers, measured, with the reference device unchanged |
| **S9.2** | **The disk table gains a decision, not an exception.** A cached feed page is a `/v1/*` response body on disk, which grep gate 5 forbids app-wide. **This is CMP-01 F2 arriving a second time and larger** -- rule it once, for both |
| **S3.7** | Media playback modules enter the dependency list **under B2**: each named in the PR, each checked as a processor, **and none of them an analytics SDK** |
| **S22** | F3 gains urgency (B4). **A new finding for the trust-ladder tension** (B29) |

### E2. ADU-MOB-02 -> v1.1

| Screen | Amendment |
|---|---|
| **MB-01** | **Life 1 survives unchanged** (B33). **Life 2 is replaced entirely** by the FYP surface, with its own states -- and `SENDING`/`RETRYING` are not among them; a feed that cannot load is `TRANSPORT_ERROR` |
| **S2.2** | The four-tab argument is rewritten. **It currently rests on *"search is not cross-seller and never will be"***, which A1 supersedes -- **but see G3: cross-seller *search* is not what the ruling authorised** |
| **S4.3** | Copy that must never appear **gains B29 and B30**: no "popular", no "trending", no "recommended for you" as a *claim about quality*, and nothing that reads as a platform endorsement of a seller |
| **New** | **The negative-feedback controls** -- hide, not interested, report -- are screens, and report already exists on every user-content surface. **Hide and not-interested are new and they are ranking inputs, which makes them privacy-relevant** |

### E3. ADU-MOB-03 -> v1.1

**A media-first feed needs components the inventory does not have:** the feed item, the media surface with its lifecycle, the negative-feedback sheet, the continuation sentinel. **`C1 ProductCard` does not stretch to a full-bleed feed item and should not be made to.**

**D8 -- no animation gates a state change -- becomes harder and more important.** A feed is where an agent will reach for gesture-driven animation that blocks interaction on a 2 GB device.

### E4. ADU-MOB-04 -> v1.1

> [!] **Half of S2's must-not table is now wrong, and S2 is the grading sheet.**

**Struck:** recommendations / trending / similar items  -  a global search bar (**qualified, per G3**)  -  infinite discovery as a forbidden pattern.
**Retained and now more important:** no averaged star rating  -  no "Buy now"  -  no price filter or sort control  -  **no promoted or sponsored placement** (B30)  -  no verified tick on a seller  -  no wishlist.

**A wireframe round run against the unamended table would grade correct FYP work as wrong.** E4 is therefore a blocker on drawing, not on building.

---

## F. ADU-MOB-05 and ADU-MOB-06

| # | Amendment |
|---|---|
| **F1** | **Age rating answers change on both stores.** An infinite feed of seller-authored media is a different questionnaire from a catalogue of product listings |
| **F2** | **Apple 1.2's write-time filtering gets heavier and it was already unowned** (ADU-MOB-PLAN-01 D13). **Filtering free text a buyer went looking for is not the same obligation as moderating a feed that pushes content at them** |
| **F3** | **The review kit needs a seeded FYP** with enough content that a reviewer sees a working surface. An empty feed reads as a broken app |
| **F4** | **ADU-MOB-06 S7 gains FYP negative cases**: replayed events must not double-count; a suspended seller's content must not surface; out-of-stock items must not be recommended; **one seller must not monopolise a session**; **hide must actually suppress** |
| **F5** | **ADU-MOB-06 S1's threat model gains the manipulation class** -- self-engagement, coordinated inflation, event flooding. **Threat 2 (a seller coaching the tap) now has a sibling**, and both are S1-T |

---

## G. The eight that must not be deleted with the old feed

**RULING B32.** An agent told *"the followed feed is superseded"* will reach for these. **None of them is the feed.**

> 1. **MB-01 Life 1 and the two recovery paths.** The install seam, a release gate, and now the cold-start surface. B33.
> 2. **The follow graph.** Follows survive as an explicit buyer signal, as a candidate source, and as **the key to `PATCH /v1/follows/{handle}/preferences`** -- deleting them silently breaks notification preferences.
> 3. **Per-seller search scope.** `GET /v1/storefronts/{handle}/search` is scoped to one seller *always*. **The ruling authorised cross-seller discovery. It did not authorise cross-seller search**, and those are different systems with different privacy and different infrastructure. S J item 3.
> 4. **The trust ladder as the only trust surface.** B29.
> 5. **B2 -- no third-party SDK.** *"We need analytics for the FYP"* is the single most likely justification for the first one. **First-party ingest, per the engineering manual S19.**
> 6. **The order card's authority, and every freshness stamp.** A feed row showing stock is making a stock claim, and **every stock claim carries `confirmed_at`** (M5). C5.
> 7. **The In-App Purchase silence.** B30.
> 8. **Gate 5 and the disk rules.** A feed cache is a `/v1/*` response body. **Rule it; do not let it arrive as a convenience in a pull request.** E1.

**And the mirror of AMD-01's own warning:** the persisted order idempotency key is still there, still not part of anything being changed, and **still the thing most likely to be deleted by an agent working near `src/store/`.**

---

## H. Sequencing -- because the build does not start here

**The FYP is ruled. The build starts elsewhere. Both are true and the combination is favourable.**

> **The ruling touches one screen out of forty.** Storefront, product, cart, reserve, payment, handoff, review, claims, chat, account -- thirty-nine screens -- are untouched.

| Do now | Do not do yet |
|---|---|
| **Apply A, B4, E1's S15 and E4.** The struck sentences and the wrong grading table are what would misdirect a reviewer or an agent | **C's migration.** It follows the FYP data design, which does not exist |
| **Build WO-0 through WO-8 as written**, with **MB-01 shipped as Life 1 only** and the feed endpoint unbuilt | **The event catalogue at full fidelity.** B31 gates ranking on it, not the other way round |
| **Start D.** It is external, it has a lead time, and it gates instrumentation | **Any ranking work.** Nothing to rank until there is content and eligibility |
| **Rule B34 and G3** -- video hosting, and whether cross-seller search is in scope | -- |

> **MB-01 as Life 1 only is a stub with a real specification, not a placeholder.** It is already written, already correct, and already the cold-start surface the FYP will need. **That is the cheapest possible position to hold while the rest of the app is built.**

---

## I. Application checklist

| # | Applied when | Proven by |
|---|---|---|
| **A1-A5** | ADU-PRD-01 v8.6, ADU-PD-01 v1.1 | `grep -i "not a recommender\|no ranking\|no personalisation"` across the corpus returns only superseded blocks with dates |
| **B1-B5** | ADU-API-01 v1.12 | **The client-event allow-list has one length in one section** before any FYP event is added |
| **C1-C5** | ADU-DB-01 v1.20 | A migration exists. **If none does, the FYP data design has not been done** |
| **D** | ADU-DPIA-01 v1.1 | An external opinion, or a written decision to proceed without one, with a name against it |
| **E1-E4** | ADU-MOB-01 v1.3, -02 v1.1, -03 v1.1, -04 v1.1 | **ADU-MOB-04 S2's table grades a correct FYP wireframe as correct** |
| **F1-F5** | ADU-MOB-05 v1.2, -06 v1.1 | -- |
| **G** | -- | **All eight present after the change.** This is the check that matters: the change is mostly a deletion, and the old feed is easy to find |

---

## J. What this amendment does not settle

| # | Open | Owner | Needed before |
|---|---|---|---|
| **1** | **Video hosting.** Does Adulis serve video at feed scale, or does the FYP render only what it already stores? **The corpus contradicts itself and the cost models assume neither** (B34) | Founder | The FYP system design |
| **2** | **Does commerce outcome feed the trust ladder, or does the ladder feed ranking?** B29 confines the tension; it does not resolve it. **Getting this wrong makes trust purchasable by proxy** | Founder ruling | Any ranking beyond recency |
| **3** | **Cross-seller search.** Discovery was authorised. **Search was not**, and they are different systems | Founder | ADU-MOB-02 v1.1's S2.2 |
| **4** | **The reversion condition.** The engineering manual S3 allows that an FYP can produce long sessions and few reservations. **There is experiment rollback and no product rollback.** Write the condition while reverting is still cheap | Founder | Before the FYP ships |
| **5** | **New performance budgets** (E1) | Measured, not argued | The first feed slice |
| **6** | **Moderation at feed scale** (F2) | ADU-PRD-01 v8.6 | Submission, and it was already blocking |
| **7** | **Whether image dwell and video watch are one metric or two** | The event catalogue | B31's gate |
| **8** | **Which document owns the event catalogue.** It is not ADU-MOB-02 and not ADU-API-01 alone. **An unowned catalogue is how screens start inventing event names** | Founder | The first event |

---

*Amendment set, twelve documents, one migration and one re-assessment that is not an amendment at all. **The ruling is approved and this document implements it without argument** -- but an amendment set's job is to say what a ruling costs, and this one costs more than the manual that carried it conveys. **Three of the costs are unnamed anywhere else**: the FYP probably requires Adulis to become a video host, and two documents disagree about whether it already is; personalised ranking creates a second path to seller visibility that is not the trust ladder, which is the differentiator the whole product rests on; and behavioural profiling is a different privacy posture from a recency query, on a question that was already open and above this workstream. **The eight in section G are the reason this document has the shape it does.** AMD-01 warned about deleting one thing too many and then deleted one thing too few; **AMD-02 can fail in both directions at once**, and the more expensive failure is the quiet one -- a sentence forbidding recommenders, left in a governing document, becoming a veto over authorised work six months from now. **Thirty-nine of forty screens are untouched. Build those.***
