# For You -- founder decision package (10 November 2026)

Prepared by WO-DISC-002A. Every decision below is **PENDING**. Nothing here is approved by being
written down, and approval of an algorithm is not approval of the personal-data processing it
needs: ADU-DPIA-01 v1.1 says the current draft "does not authorize pilot processing or public
launch" (DPIA:34) and that "a controlled pilot is also personal-data processing and must satisfy
applicable legal authorization" (DPIA:1403). Citations are to
`docs/system-designs/2026-11-08/Sources/Markdown/` (the governing pack) as `DOC:line`.

What is true today: For You serves Scene units only, ranked by `technical-baseline-recent-v1`
(RECENT source only, newest first, no Seller cap). In production it serves nothing, because no
version has `production_approved = true`. Development builds serve it.

The canonical Scene action model (OVN-033 / OVN-051) is already governed and is recorded at the
end of this document, not presented as a decision.

---

## OVN-030 -- May the RECENT-only technical baseline serve the pilot?

### Issue
Production For You needs an approved algorithm version. The only version is a technical baseline.

### Current implementation
`technical-baseline-recent-v1`: config `{"sources":{"RECENT":{"budget":60}},"page":{"default_limit":10,"max_limit":24},"session":{"ttl_seconds":3600,"max_items":500},"tie_break":"SEEDED_HASH","diversity":{"seller_adjacency_max":null}}`,
`production_approved = false`. Versions are immutable except their status and approval flag
(0055 `fn_guard_fyp_algorithm_version`): approving this exact version is a governed flag change;
any configuration change (a Seller cap, see OVN-031) is a new version row.

### What the authoritative designs say
- RECENT is "Fresh eligible Scene Posts" (REC:199). Buyer cold start: "Without history, use
  Market-eligible recent/trending/new-seller/exploration pools plus optional onboarding interests"
  (REC:502). "V1 remains deterministic and config-driven" (REC:395).
- Versions are "immutable algorithm-version configuration validated before activation" (REC:410);
  rollout, owner, stop thresholds and kill switch are versioned configuration (REC:562).
- Who approves an algorithm version: SILENT in REC-01 and ANL-01.
- Real-data launch "requires applicable Privacy/legal/processor/region/retention/security
  sign-offs" (REC:847).

### Why a decision is required
`production_approved` is a deliberate founder gate (WO-DISC-002). Without it, production serves
nothing.

### Option A -- approve RECENT-only for a cold-start pilot
Benefits:
- Non-personalised: no profile, no affinity, the same ranking for every Buyer in a Market
  (deterministic per session seed). Nothing to explain beyond "newest first".
- Honest at cold start, when there is no history to personalise from (REC:502).
- Gives the pilot the data personalisation would need first (below).

Risks:
- Newest-first is not discovery: a Seller who posts often dominates; a good older Scene sinks
  within days; established Sellers with a few strong Scenes lose exposure to frequent posters.
- No guaranteed exposure for new Sellers beyond their first posts being "new" (OVN-029).
- Concentration without a Seller cap (OVN-031).

### Option B -- approve a pilot version: RECENT plus the Seller cap
A new version (for example `pilot-recent-v1`) with `diversity.seller_adjacency_max: 2` and
everything else as the baseline. Same benefits as A, without one Seller filling a screen.

Risks: as A, except Seller runs; one more version to approve.

### Option C -- wait for personalised sources
Benefits: a stronger first impression if the sources work.
Risks: blocked on DPIA R-04/R-05 (OVN-027) and on data the pilot would produce; no production
For You until then.

### Recommended option
**B** (RECENT plus a two-Scene Seller cap) for the pilot, presented as "newest Scenes", never as
personalised recommendations.

Data to collect during the pilot, before any personalisation: Seller exposure concentration and
new-Seller exposure (OBS:356); empty-feed rate and eligible count (OBS:356); session length and
pages per session (served units per session); and, once telemetry exists (OVN-036), qualified
impressions and Explore opens per served unit.

### What changes if approved
A governed change creates and activates the approved version (or flips this version's flag for A).
No code change: the production gate already reads the flag.

### What remains blocked without approval
Production For You (it serves nothing). Development is unaffected.

### Founder decision
PENDING

---

## OVN-031 -- Seller concentration limit

### Issue
`technical-baseline-recent-v1` has no Seller cap: one Seller who posts often can fill a page.

### Current implementation
The mechanism exists and is tested (`capSellerRuns`, `apps/api/src/modules/fyp/fyp.logic.ts`):
no run longer than the cap from one Seller **while another eligible candidate can break it**;
deterministic; the run is carried across pages (`sellerTail`), so a page boundary does not reset
it; when only the capped Seller remains its Scenes still serve in rank order (it reorders, it
never withholds); it never invents another Seller. Unit tests: breaks a run, carries the run from
the previous page, never withholds. e2e: "the Seller-run cap reorders when a version configures
it". Disabled in the baseline (`seller_adjacency_max: null`).

### What the authoritative designs say
- "Apply configured seller/small-group concentration caps, adjacency limits and recent-serving
  suppression over appropriate windows" (REC:428; REC-INV-19, REC:905). No number.
- KB section 14: diversification should prevent "Ten consecutive Scenes from one Seller"
  (KB:379) -- an example of the harm, not a cap value.

### Why a decision is required
The value shapes every Buyer's feed and every Seller's exposure; no document sets it.

### Option A -- at most 2 consecutive Scenes from one Seller
Benefits: a phone screen never shows one Seller only; small Sellers interleave with frequent
posters; well inside KB's "ten consecutive" harm.
Risks: a Buyer who loves one Seller sees that Seller's newest Scenes slightly further apart.

### Option B -- at most 3
Benefits: gentler reordering. Risks: a full screen can still be one Seller.

### Option C -- no cap (today)
Benefits: pure recency. Risks: the concentration KB section 14 names.

### Recommended option
**A**: `"diversity": {"seller_adjacency_max": 2}` in a new immutable version, approved through
OVN-030.

### What changes if approved
A new algorithm version row with the cap; no code change.

### What remains blocked without approval
Nothing in development. The production feed keeps no cap if OVN-030 approves the baseline as is.

### Founder decision
PENDING

---

## OVN-029 -- New-Seller exploration policy

### Issue
New Sellers need "bounded exposure opportunities" (KB section 14), and R-05 (unfair Seller
outcomes) is unaccepted.

### Current implementation
NEW_SELLER, NEW_CONTENT and EXPLORATION sources are declared in the contract and not
implemented (OVN-025/026/028). RECENT surfaces a new Seller's first Scenes by recency only.

### What the authoritative designs say
- "Every fully eligible new Seller/Scene receives a bounded exploration opportunity under
  configured budgets and concentration policy; this is not permanent placement" (REC:581).
- NEW_SELLER "Measured exposure support for new eligible sellers"; EXPLORATION "Controlled
  discovery outside strongest affinities" (REC:201-203).
- DPIA R-05 "FYP discriminatory / unfair Seller outcomes": "Audit cohorts/proxies and exposure
  concentration, test new-Seller fairness and stop harmful experiments; competent human
  challenge"; NOT ACCEPTED, launch-blocking (DPIA:907-918).

### Why a decision is required
The budget (how much exposure, for how long, how "new" is defined) is product policy.

### Option A -- RECENT plus the Seller cap for the pilot; decide the budget from pilot data
Benefits: no invented numbers; new Sellers' fresh Scenes already rank high under RECENT; the
pilot measures exposure concentration before a budget is set.
Risks: a new Seller who posts rarely gets little exposure; R-05 evidence still has to be
produced.

### Option B -- define a NEW_SELLER budget now
For example a share of each page reserved for Sellers within a set period of their first publish.
Benefits: guaranteed exposure from day one.
Risks: numbers chosen without data; a new source to build, test and assess under R-05.

### Recommended option
**A** for the pilot, with Seller exposure concentration measured (OBS:356), then a budget as a new
algorithm version.

### What changes if approved
Nothing now; a later Recommendation work order builds NEW_SELLER under the approved budget.

### What remains blocked without approval
The NEW_SELLER source.

### Founder decision
PENDING

---

## OVN-027 -- DPIA acceptance before any personalisation

### Issue
Affinity sources (ONBOARDING_INTEREST, CATEGORY_AFFINITY, SELLER_AFFINITY) are profiling.

### Current implementation
None of them exists. No behavioural profile, affinity table or interest inference exists in the
codebase. For You is RECENT-only.

### What the authoritative designs say
- DPIA R-04 "FYP profiling becomes intrusive": L4 x I4 = 16 High; mitigation "Review every
  feature/purpose, offer meaningful negative feedback/reset and lawful objection path; test
  reduced-signal alternative and profile purge"; NOT ACCEPTED, launch-blocking YES (DPIA:894-905).
- PA-06 Recommendation: "Personalization basis requires review; not approved" (DPIA:227).
- Controls the DPIA expects: explanation, reset, negative feedback, objection or withdrawal
  (DPIA:614, DPIA:676).
- "FINAL DPIA DECISION: LEGAL REVIEW REQUIRED" (DPIA:1411); "Engineering with synthetic
  data/sandbox can proceed" (DPIA:1405).

### Why a decision is required
Personalisation is the next capability; it cannot start without the R-04 and R-05 evidence and a
lawful basis.

### Option A -- no personalisation until R-04 and R-05 are accepted through review
Benefits: no unlawful profiling; the controls (reset, negative feedback, explanation, objection)
get designed first.
Risks: a non-personalised feed for longer.

### Option B -- start a limited personalised source now
Risks: processing without a lawful basis or accepted risk; launch-blocking under the DPIA.

### Recommended option
**A**. Commission the R-04 and R-05 evidence: a feature-by-feature purpose review, the reset and
negative-feedback design, and a fairness test plan.

### What changes if approved
A Recommendation work order may design affinity sources against the accepted controls, on
synthetic data first.

### What remains blocked without approval
Every personalised candidate source, guest affinity (MOB-02:726 "privacy-bounded affinity" is
not built), and behavioural ranking signals.

### Founder decision
PENDING (and LEGAL REVIEW REQUIRED, DPIA:1411)

---

## OVN-032 -- Retention of feed sessions and served units

### Issue
`core.fyp_session` and `core.fyp_impression` (served units) have no retention period and no
purge job.

### Current implementation
| Store | Field | Purpose | Personal or linkable? |
|---|---|---|---|
| fyp_session | subject_kind, account_id / device_id | who the session ranks for; continuation authority | **linkable** (device id is a persistent identifier; account id is personal) |
| fyp_session | market_id | Market isolation | linkable through the subject |
| fyp_session | algorithm_version, seed | reproducible ranking (REC:442) | no |
| fyp_session | cursor_secret_hash | continuation integrity | no (a hash of a random secret) |
| fyp_session | served_count, created_at, expires_at, last_served_at | session bounds, rate limits | linkable through the subject |
| fyp_impression (served unit) | id (serve_id), session_id | delivery identity, attribution join | linkable through the session |
| fyp_impression | scene_post_id, revision_id, position, candidate_source, algorithm_version, created_at | what was served, where, by which source and version | linkable through the session: a browsing history |

Deletion that exists and is tested (`test/disc-002-fyp.e2e.spec.ts`): Account deletion deletes
the Account's sessions (`fn_delete_account`, 0055) and their served units (ON DELETE CASCADE);
the guest device purge (`device.purge_unbound`, run as `adulis_jobs`) takes the device's
sessions and served units (FK ON DELETE CASCADE). No orphan is possible (both FKs cascade).
Expired sessions are never served again (the cursor is refused) but stay stored.

### What the authoritative designs say
- "Policy stems below are proposed identifiers, not approved durations or legal bases. All
  exact unapproved values are LEGAL REVIEW REQUIRED" (PRV:155). "Durations remain configuration.
  Production values require legal/business approval" (PRV:341). "A missing production
  duration/authority is a launch/configuration blocker, never a fallback to indefinite
  retention" (PRV:343).
- FYP row: "recommendation-personal ... ACCOUNT_DELETION_COMPLETED -> Purge person profile/link";
  duration "LEGAL REVIEW REQUIRED"; "Hold: no default hold" (PRV:190, DPIA:1452).
- PA-06 "exact duration LEGAL REVIEW REQUIRED" (DPIA:227). R-21 "Retention lasts too long"
  NOT ACCEPTED.
- Backups: restoring deleted data into live service without reapplying deletions "is a
  launch-blocking defect" (PRV:822); actual backup retention OPEN (DPIA:818).
- REC: "Persist only what is needed for continuation, reproducibility, abuse control and bounded
  attribution" (REC:546); bounded feed_session_id / impression context into Product/Checkout
  analytics (REC:596).

### Why a decision is required
Production cannot launch without an approved duration (PRV:343); legal must set it.

### Option A -- operational only (candidate for review: 7 days after session expiry)
Delete each session and its served units a short period after `expires_at`: enough for
continuation, replay, abuse investigation and debugging.
Benefits: minimal linkable history. Risks: no served-unit attribution beyond a week; future
qualified impressions could not join to served units older than that.

### Option B -- bounded attribution (candidate for review: 30 days after session expiry)
Keeps the served-unit join for Product/Checkout attribution (REC:596) for a month, then deletes.
Benefits: attribution and fairness analysis (R-05) over a pilot cycle. Risks: a month of
linkable browsing history per subject.

### Option C -- aggregate then delete
Keep per-Scene / per-Seller aggregate exposure counts without subject linkage; delete
subject-linked rows on Option A's schedule.
Benefits: fairness metrics survive; personal history does not. Risks: an aggregation job to build.

### Recommended option
**A combined with C**, if legal agrees: delete subject-linked sessions and served units shortly
after expiry; keep anonymous aggregates for exposure-fairness monitoring. The numbers above are
CANDIDATES for legal review, not decisions.

### What changes if approved
A scheduled purge job (a new registered job, migration and tests) under the approved period, and
the policy row in PRV's schedule.

### What remains blocked without approval
Production For You (PRV:343). Qualified-impression retention (a separate analytics-raw class,
PRV:192) also waits.

### Founder decision
PENDING (LEGAL REVIEW REQUIRED)

---

## OVN-035 -- The guest recommendation identity

### Issue
A guest's For You subject is the registered device id. A separate anonymous identity is described
for analytics, but nowhere fully defined.

### Current implementation
`fyp_session.device_id` for guests. A known device id lets anyone start feed sessions as that
guest. What that exposes today: a feed that is the same for everyone in the Market (no
personalisation), and that guest's session-start budget (120 per hour), which a stranger could
spend. It does not expose any personal data, and the cursor secret binds continuation to whoever
started the session.

### What the authoritative designs say
- "Device ID is not authentication. A copied device identifier cannot authorize Seller, Courier
  or Operator actions" (AUTH:269). "anonymous IDs remain purpose-bound/privacy-safe" (AUTH:80).
- ANL: "Anonymous browsing uses a random first-party anonymous_id generated by Adulis. It is not
  derived from hardware characteristics, advertising IDs or fingerprinting. Rotation/deletion
  policy is governed by Privacy" (ANL:277), with "later Account linkage without rewriting
  historical rows" (ANL:37).
- REC: "If guest FYP is supported, use a safe server-resolved Market/context session key and do
  not create durable Buyer history outside approved identity/privacy policy" (REC:122).
- PRV: "unlink anonymous/account identity as policy requires" (PRV:616) -- no such policy exists.
- MOB-02: the device id must not be regenerated on launch, logout or token expiry (MOB-02:752).

**Conflict**: REC:122 (a session key, no durable history) and ANL:37 / ANL:277 (a persistent
anonymous id with later Account linkage). Who issues it, reset, retention and sign-in linkage are
SILENT everywhere.

### Why a decision is required
Any guest personalisation or guest analytics needs a subject that is not the device id, and the
linkage-on-sign-in question is a privacy decision.

### Option A -- keep the device-based guest subject for the non-personalised pilot
Benefits: nothing new to build; safe while the feed is identical for every guest in a Market.
Risks: not acceptable once anything per-guest is stored (affinity, analytics); the device id is
long-lived by design (MOB-02:752).

### Option B -- a server-issued anonymous recommendation identity (the target)
The WO-DISC-002A architecture (record section 11): the server issues a random opaque id together
with a secret proof the app keeps in SecureStore, bound to the registered device; the id is
purpose-limited to recommendation and analytics; it can be reset (new id, old rows unlinked);
it is never linked to an Account unless an approved policy says so; deleting the device or the
Account deletes or unlinks it; no cross-device linkage.
Benefits: knowing an id grants nothing without its proof; resettable; meets ANL:277 and AUTH:269.
Risks: a new identity lifecycle to build and assess; the linkage decision still has to be made.

### Option C -- a client-generated anonymous id
Benefits: simple. Risks: a client UUID is not authority -- anyone who learns it can act as that
guest; no server-side reset or revocation.

### Recommended option
**A for the non-personalised pilot; B before any guest-specific processing.** Decide separately
(privacy): whether a guest's anonymous history may be linked to an Account on sign-in (ANL:37
permits it as a goal; REC:122 says no durable history; no policy exists).

### What changes if approved
B: an Auth/Analytics work order builds issuance, proof, reset and deletion; For You takes the new
subject; the device subject is retired.

### What remains blocked without approval
Guest personalisation, guest analytics linkage, and any guest history beyond the session.

### Founder decision
PENDING (FOUNDER_REVIEW_REQUIRED; privacy review)

---

## OVN-036 -- Qualified impressions and re-exposure identity

### Issue
WO-DISC-002A separated `serve_id` (delivery) from `impression_id` (a qualified observation). Who
mints the impression id, and the metric definition, are open.

### Current implementation
`serve_id` is server-issued per served unit and stable on replay. No qualified impression exists;
nothing measures visibility.

### What the authoritative designs say
- "A returned feed unit is not automatically an impression. Client measurement records an
  impression only after the defined visibility condition is met. Re-exposure that independently
  meets the threshold receives a new impression_id" (ANL:331).
- "The current metric definition should be versioned. A practical launch baseline is at least 50%
  of the Scene Post card visible for at least 500 ms while the app is foregrounded and the card is
  not occluded. Exact values belong to the metric definition, not scattered UI code" (ANL:337).
- Event envelope: "Each client observation receives a random client_event_id when created"
  (ANL:187); retries reuse it, a repeated real action gets a new one (ANL:187-189).
- "Signed/validated served context and current Content gates prevent a stale PRIVATE Scene from
  generating legitimate new impressions" (ANL:324).
- REC-01 (REC:454) and the KB (KB:297) name the served record `impression_id` -- the naming this
  work order corrected; they need an authorised revision.

### Why a decision is required
The telemetry work order needs the identity rule and an approved metric version.

### Option A -- the client mints impression_id per qualified observation; the server validates
The app creates a random `impression_id` when an observation qualifies (a new one per
re-exposure) and sends it with the unit's `serve_id`. The server accepts it only when the
`serve_id` belongs to the caller's subject and session, the Scene revision is the served one and
still public, and the event time is within the session's bounds; it caps qualified impressions
per serve_id per app session. The client id is an idempotency key, never proof of delivery.
Benefits: no extra round trips; matches ANL:187 and ANL:331. Risks: inflation attempts, bounded
by the server checks and caps.

### Option B -- the server mints impression ids
Benefits: the server controls every id. Risks: a round trip per visible card; fails offline;
latency on scroll.

### Recommended option
**A**, with metric definition version 1 = the ANL:337 baseline (50% visible, 500 ms, app
foregrounded, not occluded), approved as a versioned metric.

### What changes if approved
A telemetry work order: the metric definition (one module), visibility measurement in the feed,
the ingestion endpoint with the validation above.

### What remains blocked without approval
Qualified impressions, dwell, and every metric built on them (and the analytics-raw retention,
PRV:192).

### Founder decision
PENDING

---

## OVN-048 -- The For You photo ratio

### Issue
The feed card uses a fixed 4:5 frame; no document sets the ratio.

### Current implementation
`SceneCard.tsx` `PHOTO_ASPECT = 4 / 5`, cover fit, the `card_key` derivative.

### What the authoritative designs say
- The FYP derivative has "known aspect ratio" (MEDIA:388); the client needs "Known
  width/height/aspect ratio before fetch to avoid layout shift" (MEDIA:411); sizes "based on real
  roles rather than arbitrary device widths" (MEDIA:658). No ratio or pixel size anywhere.
- No full-resolution images in feed cards (MEDIA:415). No video or embeds on FYP cards
  (MOB-02:269-271).
- The prototype sets no explicit ratio for the feed card (searched `MobileBuyer.tsx`).

### Why a decision is required
The Media derivative spec needs a ratio for the FYP role, and Seller upload guidance follows it.

### Option A -- 4:5 portrait (today)
Benefits: more photo per card on a phone; familiar from social feeds; no UI change.
Risks: landscape photos are cropped more.

### Option B -- 1:1
Benefits: neutral crop. Risks: less photo per card; a UI change.

### Recommended option
**A**. Proposed Media derivative spec (for the Media owner, not built here): an FYP derivative at
4:5, with its width and height known before fetch (MEDIA:411); a small thumbnail role; no
originals in feed cards. No reprocessing of existing media.

### What changes if approved
The Media derivative spec records the ratio; the app constant stays.

### What remains blocked without approval
Nothing functional.

### Founder decision
PENDING

---

## OVN-055 -- How long loaded For You cards stay trusted after the app returns from the background

### Issue
ADU-MOB-02 S185: "After a meaningful background interval, create/refetch the FYP session
according to configuration rather than assuming old Scene Post eligibility remains current.
Preserve user context where safe, but current moderation/availability always wins" (MOB-02:1919).
No document sets the interval.

### Current implementation (WO-DISC-002A)
`FOREGROUND_REVALIDATE_AFTER_MS` in `apps/mobile/src/buyer/for-you-feed.ts`, one value:
**5 minutes in development builds (provisional) and 0 in release builds** -- every return from
the background starts a new session and withholds the old cards until it answers. That is the
fail-closed policy until this decision. This interval is separate from the server's feed-session
lifetime (1 hour, `ttl_seconds`), which ends a session; an expired cursor already ends it on the
next page.

### What the authoritative designs say
MOB-02:1919 (above); "Do not show restricted content merely because it remains in in-memory FYP
state indefinitely" (MOB-02:1915).

### Why a decision is required
0 is safe but discards the Buyer's place after any app switch; the designs ask to preserve
context where safe.

### Option A -- 5 minutes
Benefits: a quick app switch keeps the place; a longer absence re-reads eligibility. Risks: after
a background shorter than 5 minutes, cards loaded before it stay on screen, so a Scene that went
PRIVATE meanwhile can remain visible until the next refresh (the server never serves it again).

### Option B -- 0 (today's release policy)
Benefits: nothing stale is ever shown after a return. Risks (raised by the WO-DISC-002A reviews):
- every app switch restarts the feed and loses the Buyer's place;
- Android reports `background` for a share sheet, a permission dialog, a Custom Tab or the camera
  picker, so even those restart it;
- every return starts a server session and stores its served units, counting against the 120
  session starts per hour per subject;
- more linkable rows per frequent app-switcher, with no retention period yet (OVN-032);
- someone who knows a guest's device id can spend that budget, after which the guest's returns
  show an error instead of cards (denial of service only).

### Option C -- the server session lifetime (60 minutes)
Benefits: fewest refreshes. Risks: up to an hour of possibly non-public cards after a return.

### Recommended option
**A, 5 minutes.** Separately, cards are re-checked only on a return from the background or a
new page; a Buyer who keeps the app in the foreground for hours keeps the cards they loaded
(MOB-02:1915 "indefinitely" -- OVN-066).

### What changes if approved
One constant (`freshnessIntervalMs`) for release builds; its tests.

### What remains blocked without approval
Nothing; release builds keep revalidating on every return.

### Founder decision
PENDING

---

## Already governed: the canonical Scene action model (OVN-033 / OVN-051)

Not a decision. ADU-MOB-02 section 232 (R-05), ADU-SCN-01 section 79, ADULIS-KB section 63 and
ADU-REC-01 R-05 carry the same rule, and each says its reconciliation section wins over older
passages (MOB-02:2369, SCN-01:1135, KB:1437, REC:969):

> "Scene actions are Like, Save, Share, Reviews, Follow, More and Explore the Scene. Like belongs
> to the Scene only and no public Like count is shown. Save saves the Scene only. Follow is
> Seller-level. More may include Not Interested where applicable, Hide this Scene and Report.
> Public comments and reposts are not part of the current MVP. Explore the Scene is the primary
> commerce-exploration action."

Superseded: MOB-02 section 50 (MOB-02:573) and REC-01 section 13 (REC:147) -- "Save, Share,
Follow Seller, Not Interested, Report, product-tag interaction". R-06 (MOB-02:2370) also removes
Product hotspots from feed media (tapping the media or Explore the Scene opens the Explore
surface), superseding MOB-02:279 and MOB-02:290 ("reveal tags" / "product-tag affordances").

Open details, for the work orders that build each action (not founder decisions unless they turn
into product policy): whether Like and Follow need sign-in (SILENT); what "Hide this Scene" does
and how it differs from Not Interested (SILENT); the Not Interested scopes are "explicitly defined
by backend policy" (MOB-02:587). The dependency matrix is in the WO-DISC-002A record, section 14.
