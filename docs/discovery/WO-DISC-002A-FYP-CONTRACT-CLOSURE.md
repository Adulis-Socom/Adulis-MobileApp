# WO-DISC-002A -- For You contract closure, privacy boundaries and mobile feed readiness

Closes the contract, identity, lifecycle and measurement inconsistencies left in the For You
foundation (WO-DISC-001, WO-DISC-001A, WO-DISC-002, WO-004A, WO-SEC-001). It does **not**
activate production For You, enable personalisation, build telemetry or engagement, or set any
retention period. Pending decisions are in
[`FYP_FOUNDER_DECISIONS_2026-11-10.md`](FYP_FOUNDER_DECISIONS_2026-11-10.md).

## 1. Starting SHA

`f80e64ec07f560a703765a7dd916cbefa868597e` (`security/wo-sec-001-rate-limit-pool-hardening`,
verified equal to `origin`, clean tree).

## 2. Branch

`discovery/wo-disc-002a-fyp-contract-closure`, from the starting SHA. Not merged; no PR.

## 3. Authoritative documents reviewed

The governing pack `docs/system-designs/2026-11-08/Sources/Markdown/` (cited `DOC:line`):
ADU-REC-01 v3.2, ADU-ANL-01 v3.3, ADU-MOB-02 v4.3, ADU-SCN-01 v3.2, ADU-PRV-01 v3.3,
ADU-DPIA-01 v1.1, ADU-AUTH-02 v3.3, ADU-MEDIA-01 v3.1, ADU-OBS-01 v3.2, ADULIS-KB v3.3. Plus
`docs/discovery/WO-DISC-002-FOR-YOU-API.md`, `docs/mobile/WO-004A-BUYER-FOR-YOU-FEED.md`,
`docs/security/WO-SEC-001-RATE-LIMIT-POOL-HARDENING.md` and the overnight register. No governed
document was edited.

**Conflicts found** (recorded, not silently resolved):

| # | Conflict | Sides | Resolution |
|---|---|---|---|
| C1 | What `impression_id` names | REC:132/436/454 and KB:297: the server assigns it to every SERVED unit. ANL:331: "A returned feed unit is not automatically an impression ... Re-exposure ... receives a new impression_id" | The founder's work order: `serve_id` for delivery, `impression_id` for a qualified observation. REC-01 and the KB need an authorised revision to match. |
| C2 | Guest identity | REC:122: "a safe server-resolved Market/context session key ... do not create durable Buyer history". ANL:37/277: a persistent first-party `anonymous_id` with "later Account linkage" | Not resolved; OVN-035 FOUNDER_REVIEW_REQUIRED (section 10-11). |
| C3 | Scene action list | MOB-02 S50 (:573) and REC-01 S13 (:147) vs R-05 (MOB-02:2369, SCN-01:1135, KB:1437, REC:969) | R-05 wins: each document's reconciliation section says it overrides older passages (section 14). |
| C4 | Product hotspots on feed media | MOB-02:279/290 ("reveal tags", "product-tag affordances") vs R-06 (MOB-02:2370: no hotspots on For You media) | R-06 wins (later). The current card shows tag names only, no hotspots. |
| C5 | Event names / endpoint | REC:462 `feed_unit_visible, qualified_impression`, REC:693 `/v1/analytics/events/batch` vs ANL:141 `fyp_qualified_impression`, ANL:236 `/v1/analytics/events` | For the telemetry work order; REC defers to "owning contracts" (REC:458). |
| C6 | FYP derivative naming | MOB-02:535 "feed card" vs MEDIA:386-391 (FYP role; CARD is Shop/Search) | MEDIA owns derivatives; today's feed uses the `card_key` derivative (OVN-048 package). |

## 4. Current implementation audit

What actually exists (verified in code and tests):

```text
GET /v1/fyp (FypController, @Public, Cache-Control: no-store)
  -> subject: signed-in Account (status ACTIVE) or the registered device (X-Adulis-Device);
     Market from the Account or the device -- never from the client
  -> rate limits (session starts, newly served pages) in the request transaction
  -> active algorithm version (production requires production_approved)
  -> candidate retrieval: RECENT only (core.v_scene_post_public, newest first, budget 60)
  -> public Scene eligibility re-read at response time (the public gate)
  -> deterministic ranking (seeded tie-break), Seller-run cap when configured (off today)
  -> feed session (core.fyp_session): subject, Market, version, seed, cursor-secret hash, TTL 1 h
  -> served-unit record (core.fyp_impression): id = serve_id, session, Scene, revision, version,
     position, source; replayed pages return the stored units re-checked against the gate
  -> response: feed_session_id, algorithm_version, items[] (SCENE_POST units), next_cursor
  -> mobile: TanStack infinite query, key ['fyp', guest|account, generation], gcTime 0,
     no refetch on focus/mount/reconnect, pages chained only through next_cursor
  -> FlashList (virtualised) -> SceneCard (Expo Image, card derivative, 4:5, no engagement controls)
```

Does NOT exist: qualified impressions, dwell, any analytics event from For You, any affinity or
profile, NEW_SELLER / EXPLORATION / TRENDING sources, a retention purge for sessions or served
units, a guest anonymous id, any engagement action on the card.

## 5. Served-unit identity decision

`serve_id`: the server-issued identity of one delivery -- this Scene revision, at this position,
in this feed session, ranked by this algorithm version, for this subject and Market. It is the
primary key of the served record. A retried or replayed page returns the same `serve_id`; a new
session issues new ones for the same Scenes. The client never creates or sends one: `/v1/fyp`
reads only `cursor` and `limit`, and a supplied `serve_id` or `impression_id` query parameter is
ignored (tested).

## 6. Qualified-impression identity design

Not built. The design for the telemetry work order (decision OVN-036):

```text
served unit (serve_id, server)            -- exists
   -> card rendered (client)               -- not an impression
   -> visibility threshold met             -- metric definition version 1 (candidate):
        >= 50% of the card visible, >= 500 ms, app foregrounded, not occluded (ANL:337)
   -> qualified impression (impression_id, client-minted random id per observation)
   -> optional bounded dwell (one observation, ANL:343)
```

- `impression_id` is minted by the client when an observation qualifies; it is an idempotency
  key (with ANL's `client_event_id` semantics, ANL:187), never proof of delivery.
- The metric definition lives in ONE versioned module (the numbers above appear nowhere in code
  today), with `metric_version` incrementing on any semantic change (ANL:532).

**Re-exposure semantics:**

| Case | serve_id | impression_id |
|---|---|---|
| network retry of the same event | same | same (the client retries the same event id) |
| replay of the same served page (same cursor) | same | a new observation only if it qualifies again |
| the card leaves the viewport and qualifies again | same | **new** (ANL:331) |
| pull-to-refresh / a new feed session | **new** | new observations |

**Backend validation for the future ingestion** (no endpoint exists; none was faked). An
impression is accepted only if the server finds the `serve_id` and checks, from its own record,
never from the payload:
- the serve belongs to the caller's subject (Account or the guest subject) and its session;
- the Scene revision is the served one;
- the algorithm version, Market, candidate source and position come from the record;
- the event time falls within the session's lifetime plus a bounded delay (ANL:214,
  "client clocks are untrusted");
- the Scene is not newly ineligible (ANL:324);
- qualified impressions per `serve_id` per app session are capped (inflation).

A client-generated `impression_id` attached to an unknown or foreign `serve_id` is rejected.

## 7. Public contract changes

| Before | After |
|---|---|
| `ScenePostFeedUnitDto.impression_id` "The served-impression identity (S55)" | `ScenePostFeedUnitDto.serve_id` "Server-issued identity of this delivery ... It is NOT an impression" |

Nothing else changed. **Compatibility:** consumers were audited -- the API, its e2e test, the
mobile app (unreleased), the mobile test fixture and the generated client. The Console, Storefront
and Operator surfaces do not read `/v1/fyp`. Production For You serves nothing (no approved
version), so no released client receives units. The rename is therefore clean, with no alias and
no deprecation window. No second ambiguous field remains.

## 8. Database implications

None, no migration. The served record keeps its 0055 table name, `core.fyp_impression`: **naming
debt** -- the table records delivery, never a qualified impression; its `id` is the `serve_id`.
Renaming it would be a migration plus an ADU-DB-01 revision for a cosmetic gain, so it is
deferred to a work order that touches the table anyway (for example the retention purge). No
second served-fact table was created.

## 9. API-client changes

`contracts/openapi.json` and `packages/api-client/src/schema.d.ts` were regenerated
(`pnpm generate:openapi`, `pnpm generate:api-client`); the diff is the one field and its
description; a second generation is byte-identical. The mobile app's types derive from the
generated `paths` (`apps/mobile/src/api/client.ts`); no handwritten DTO was added.

## 10. Guest identity assessment

Today a guest's For You subject is the registered device id (`X-Adulis-Device`). What knowing
another person's device id grants on `/v1/fyp`:
- the ability to start and continue feed sessions as that guest. The feed is the same for every
  guest in a Market, since nothing is personalised;
- that guest's rate-limit budget (120 session starts and 600 new pages an hour), which can be
  spent;
- a few rows of served history attributed to that device.

It grants no personal data and no Account access (AUTH:269), and continuation still needs the
cursor's secret. Acceptable for the non-personalised feed, **not** for anything per-guest:
affinity, analytics linkage or guest history. OVN-035 stays FOUNDER_REVIEW_REQUIRED.

## 11. Proposed anonymous identity architecture

```text
installation / device identity (device_id: notifications, risk, session context -- AUTH:269)
        !=
anonymous recommendation identity (anon_rec_id: For You + analytics only)
        !=
authenticated Account identity (account_id)
```

- **Issuance**: the server, never the client. On the first For You or analytics need, the app
  asks; the server returns a random opaque `anon_rec_id` and a random secret proof. The app keeps
  the proof in SecureStore with the device id; the server stores only the proof's hash, bound to
  the registered device.
- **Presentation**: the id and the proof on requests that need the guest subject. Knowing the id
  alone grants nothing.
- **Purpose limit**: recommendation and analytics; never authentication or authorization; never
  a log label (OBS:256).
- **Reset**: the app or a privacy control asks for a new id. The old id is revoked and its rows
  unlinked or deleted, as the retention policy (OVN-032) says.
- **Sign-in**: no linkage unless an approved policy allows it. ANL:37 allows it as a goal and
  REC:122 says "no durable history", so this is a founder/privacy decision. Signing in never
  adopts a client-chosen identity (AUTH:281).
- **Deletion**: deleting the device (purge) or the Account deletes or unlinks the id and its rows
  (PRV:616).
- **Retention**: bounded by the approved policy; never indefinite (PRV:343).
- **No cross-device linkage**, no fingerprinting (ANL:277, DPIA:672).
- **Migration**: For You takes the new subject behind a flag; existing device-subject sessions
  expire in an hour; the device subject is retired once the new one serves.

**Gate**: not implemented. The lifecycle has no governing design (PRV:616 "as policy requires",
no policy exists), and the linkage, reset and retention decisions are open. The device subject
stays, limited to the non-personalised feed.

## 12. Mobile foreground lifecycle

ADU-MOB-02 S185 (MOB-02:1919): "After a meaningful background interval, create/refetch the FYP
session according to configuration rather than assuming old Scene Post eligibility remains
current. Preserve user context where safe, but current moderation/availability always wins."

`apps/mobile/src/buyer/for-you-feed.ts`:
- One React Native `AppState` subscription in the feed hook; no second lifecycle manager. It
  records the first `background` event of a stay. An iOS `inactive` blip, such as a
  control-centre pull, is not a background interval.
- On `active`, `needsForegroundRevalidation` decides. The cards on screen -- a
  pull-to-refresh's placeholders included, since they are the old session's -- must have spent
  at least `FOREGROUND_REVALIDATE_AFTER_MS` unchecked in the background. That time is counted
  from the later of going to the background and the oldest page's arrival (each page carries
  `receivedAt`), so a page that lands just after the app is backgrounded ages from then. A zero
  threshold revalidates every return with cards on screen, and a clock that went backwards
  counts as stale (fail closed).
- Revalidation starts a new feed session (a new query-key generation, no cursor) and
  **withholds** the old cards: no placeholder, so the loading state shows. Pull-to-refresh, by
  contrast, keeps them visible while it loads -- but only the immediately previous generation's.
  TanStack offers the last query that had data, which after a failed revalidation would be the
  withheld cards. A Refresh of a session the server ended withholds too.
- If the new session fails, the error state shows (never the old cards). If the app returns
  offline, the paused first page says "You are offline" (`common.offline`), and TanStack resumes
  it by itself on reconnect (no Retry button: refetching a paused query asks nothing while
  offline). A refresh or a Retry never brings back cards that had already gone: placeholders
  come only from the immediately previous generation, and only while real cards are on screen.
- One revalidation at a time: while the new session has no data there are no cards to
  revalidate, so a further return does nothing. A late page of the old session lands in the old
  key (dropped, `gcTime: 0`), never the new one.

**Configuration**: one value, `freshnessIntervalMs(developmentBuild)` -- **5 minutes in
development builds (provisional technical value)** and **0 in release builds**, so every return
from the background revalidates. That is the fail-closed policy until the founder approves an
interval (OVN-055). It is separate from the server's feed-session lifetime (1 hour, `ttl_seconds`),
which ends a session.

## 13. Feed-session handling

| Situation | Behaviour |
|---|---|
| first load | new session, no cursor |
| background shorter than the interval, then return | cards kept, nothing requested |
| background longer than the interval (release: any background) | new session; old cards withheld until it answers |
| cards that arrived while backgrounded | aged from their arrival: kept under the interval, revalidated past it |
| a pull-to-refresh still loading when the app left | revalidated on return (its placeholders are the old session's) |
| a revalidation fails, then pull-to-refresh | loading, then the new session; the withheld cards never return |
| session expired / version retired / Market changed | the next page answers CURSOR_EXPIRED or CURSOR_INVALID; the cards go and a full-screen "This feed has ended" offers Refresh (WO-004A) |
| sign-in | the key changes to the Account subject: a new Account session with the bearer; guest cards never shown as the Account's (tested through the real OTP screens) |
| sign-out | a new guest session without the bearer (tested) |
| offline return | "You are offline", no old cards; resumes on reconnect |
| network recovery | TanStack's online manager resumes the paused request |
| repeated or rapid returns | one new session (tested) |
| an old response after a newer session | lands in the old key, never shown (tested) |

The bearer never appears in a query key, URL or log: the key holds `guest` or `account`, and the
client puts the cursor only in the query string.

## 14. Scene engagement reconciliation

Canonical model (R-05; MOB-02:2369, SCN-01:1135, KB:1437, REC:969): **Like** (the Scene, no
public count), **Save** (the Scene), **Share**, **Reviews**, **Follow** (the Seller), **More**
(Not Interested where applicable, Hide this Scene, Report) and **Explore the Scene** (the primary
commerce action). No public comments, no reposts. It supersedes MOB-02 S50 and REC-01 S13
(conflict C3). No control was built; the card still draws none.

Dependency matrix, from the repository as it stands:

| Action | Canonical owner | Backend exists? | Permission / eligibility | Required API | Mobile dependency |
|---|---|---|---|---|---|
| Like | Scene engagement | **No** (no table, no route) | sign-in requirement SILENT; Seller sees counts (SCN-01:1137) | Like/unlike a Scene, by revision context | engagement domain, optimistic state, sign-in prompt |
| Save | Collections | **No** (no Collections table or route) | durable saves need sign-in; an anonymous Save leads to sign-in (MOB-02:483) | Collection membership add/remove (a server fact, ANL:143) | Saved tab, sign-in continuation |
| Share | Public URLs | Partial: `GET /v1/scene-posts/{publicRef}` exists; no canonical web Scene page or universal link verified | public Scenes only | canonical Scene URL that opens the app or the web (MOB-02:593-607) | native share sheet, universal links config |
| Reviews | Reviews | Partial: `POST /v1/orders/{id}/review` (order-based, i.e. verified purchase), `GET /v1/storefronts/{handle}/reviews`; no per-Scene, per-tagged-Product read | read: anyone; write: server-proven purchase eligibility only (MOB-02:567, R-08) | Scene Reviews read (one tab per tagged Product + Seller) and an eligibility read | Reviews sheet; composer only when eligible |
| Follow | Seller follow | Partial: `core.follow` table (buyer, Seller, state, notification preference) exists; **no API route** | sign-in requirement SILENT | follow / unfollow a Seller, follow state | Following channel, sign-in prompt |
| More: Not Interested | Recommendation feedback | **No** | scopes "explicitly defined by backend policy" (MOB-02:587) | negative feedback per scope | menu; feeds R-04's reset/negative-feedback control |
| More: Hide this Scene | Recommendation feedback | **No** | meaning SILENT beyond R-05 | hide per subject | menu |
| More: Report | Moderation | Partial: `POST /v1/reports` exists, but its target kinds are PRODUCT, REVIEW, MESSAGE, SELLER, STOREFRONT -- **no SCENE**, and a Scene report must bind the exact revision (SCN-01:231) | signed in (reports are per account) | a SCENE target kind with revision binding (an enum change = DB governance) | report sheet |
| Explore the Scene | Scenes / Explore | Partial: `GET /v1/scene-posts/{publicRef}` (public Scene read); no Explore surface on mobile | public Scenes; PRIVATE shows "content unavailable" (MOB-02:298) | the existing read, plus tag/hotspot detail as the Explore design needs | the Explore screen (R-06) |

## 15. RECENT-only pilot configuration

`technical-baseline-recent-v1` is the only version; RECENT is the only real source (REC:199).
The pilot-approval package is OVN-030 in the decision document. It covers why RECENT-only fits a
cold-start pilot (REC:502); its limits (newest-first is not discovery, frequent posters dominate,
older strong Scenes sink); concentration; new-Seller exposure; the available controls (the
Seller-run cap, session `max_items`, source budget, retire-to-kill, the production flag); and the
data to collect before personalisation. It is **not** a personalised recommendation system and is
not described as one.

## 16. Seller concentration proposal

The mechanism is in place, deterministic and tested. It carries the run across pages, never
withholds eligible content and never invents Sellers. The proposal (OVN-031) is
`"diversity": {"seller_adjacency_max": 2}` in a **new** immutable version, since configuration
cannot change in place (0055 guard), approved through OVN-030. KB:379's "ten consecutive Scenes
from one Seller" is the harm example the proposal stays well inside. Not activated.

## 17. Production activation status

Unchanged: `technical-baseline-recent-v1.production_approved = false`; production For You serves
nothing. No flag was flipped, no check bypassed, no fake content seeded, no affinity source
activated.

## 18. Retention gap

No retention period exists for `core.fyp_session` or the served units, and no purge job was
built (OVN-032, LEGAL REVIEW REQUIRED, PRV:155/341/343, DPIA:227). Existing deletion, verified by
the e2e suite:
- **Account deletion**: `fn_delete_account` deletes the Account's sessions, and the served units
  go with them (ON DELETE CASCADE). Test: "deleting an Account purges its For You sessions and
  served units".
- **Guest device purge**: `device.purge_unbound`, run as `adulis_jobs`, takes the device's
  sessions and their served units (FK cascade). Test: "device.purge_unbound ... takes a stale
  guest device with its sessions and served units".
- **No orphans**: both foreign keys cascade.
- **Expired sessions**: never served again (the cursor is refused), but stored until the subject
  is deleted -- the gap the retention decision closes.

No gap needed a new regression test. The candidate periods for legal review are in the decision
package.

## 19. DPIA status

Unchanged and not claimed resolved. R-04 (intrusive profiling) and R-05 (unfair Seller outcomes)
are NOT ACCEPTED and launch-blocking (DPIA:894-918). PA-06's basis is "not approved" (DPIA:227).
The final DPIA decision is LEGAL REVIEW REQUIRED (DPIA:1411); the draft authorises no pilot
processing (DPIA:34). Today's processing (feed sessions and served units linked to a device or
Account) is technical and non-personalised. It is still personal-data processing that a pilot
must have authorised (DPIA:1403).

## 20. Media presentation

Unchanged: a fixed 4:5 frame, cover fit, the `card_key` derivative, no originals, no video, no
autoplay, no carousel, no reprocessing. No document sets the ratio (MEDIA:388 asks only for a
"known aspect ratio"). The proposed Media derivative spec and the decision are OVN-048. Already
downloaded images cannot be recalled (MEDIA:525). The revalidation removes stale cards from the
screen and claims no more than that.

## 21. Tests

**API (+4 e2e, `test/disc-002-fyp.e2e.spec.ts`, "the served-unit contract"):**
1. the server issues `serve_id`; a client-supplied `serve_id` / `impression_id` is ignored, never
   echoed, and no unit carries an `impression_id`;
2. each `serve_id` is bound to its session, Market, exact served revision, position and version;
3. a retried page keeps its `serve_id`s, and a new session issues new ones for the same Scenes;
4. serving writes no analytics event.

The existing tests, renamed to `serve_id`, still cover the rest of S35:
- private Scenes are never newly served or replayed;
- Market isolation in both directions;
- one subject never continues another's session;
- Account deletion and the device purge take the For You rows.

**Mobile (135 -> 156, +21):**
- `buyer/for-you.test.tsx`, "returning from the background", 11 tests, on the real route tree
  with AppState driven by hand:
  - a short background is kept;
  - after the interval the old cards are withheld while a new session starts;
  - a failed revalidation shows the failure, never the cards;
  - an offline return says offline and recovers on reconnect;
  - a pull-to-refresh after a failed revalidation, and a Retry after a failed refresh, never bring
    old cards back (both proven to fail without their fixes);
  - rapid returns start one session;
  - a late old-session page never lands in the new one;
  - cards that arrived in the background age from their arrival (two tests);
  - a pull-to-refresh still loading when the app left is revalidated.
- "signing in", 1 test: guest to Account through the real OTP screens, a new Account session, the
  bearer never in a URL.
- `buyer/for-you-feed.test.ts`, 9: the revalidation rule (including the clock moving backwards
  and the release policy) and the dev/release interval.
- The existing ended-session test also asserts that the ended cards do not stand in.
- Unchanged and green: Scene-only units, the empty feed, the image-unavailable fallback, 4:5,
  large text and the sign-out direction.

**Validation** (fresh disposable database, migrations 0001-0055):

| Check | Result |
|---|---|
| `pnpm --filter @adulis/api test` | **806/806** twice (in `pnpm test`, and a re-run in 65 s). One earlier run, the first after the rebuild, took 102 s and hit 5-second hook timeouts in three suites (disc-002, e2-e6 jobs, t14) plus one 35 ms clock comparison in t14: 767/806. All 39 passed in both later runs. Recorded, not hidden |
| Scene + For You suites (disc-001, disc-002, fyp unit) | 104/104 |
| `@adulis/api-client` test; `generate:check` (deterministic) | PASS; PASS (byte-identical) |
| mobile typecheck / test / build / lint | PASS; 156/156 |
| `pnpm typecheck` / `lint` / `build` | PASS |
| `verify:contract` / `verify:appendix` / `verify:docs` / `verify:deps` / `verify:mt-keys` / `verify:error-locale` | PASS |
| `db:check` / `db:determinism` | 16/16 / PASS |
| `pnpm test` (every package) | PASS: API 806/806, mobile 156/156 |
| `verify:orphan-sweep` | PASS |
| `npx expo-doctor` | 20/20 |
| Maestro, Android emulator, real local API | PASS (section 22) |

No migration, so no ADU-DB-01 revision; `verify:appendix` is unchanged and green.

## 22. Native validation

Android emulator (Pixel 8a, API 37) against the real local API (development mode) on the
disposable `adulis_gates` database. The fixtures were made the production way through the Seller
API: two Sellers, four Products, twelve published Scenes with WebP photos in local MinIO. The
debug APK was reused because native dependencies are unchanged; Metro served this branch's final
JavaScript (`cf9ee82`). The developer database was never touched. Fixtures were removed afterwards
(database rebuilt, MinIO prefixes verified against the fixture list, then deleted). iOS was not
tested.

| # | Step (WO S37) | Result |
|---|---|---|
| 1-2 | Guest opens For You; real Scenes load | PASS (`buyer-for-you.yaml`: newest "(12)" first) |
| 3 | App goes to the background | PASS (`buyer-for-you-background-1.yaml`, Home key) |
| 4 | Availability changes on the backend | Woven basket sold out (SELLER_SET stock event): Scene "(12)" and seven other Seller A Scenes became PRIVATE through the real triggers |
| 5-7 | Return after 5 min 30 s (above the 5-minute development interval), without a restart | PASS (`buyer-for-you-background-2.yaml`): "(11)" first, "(12)" absent; pull-to-refresh afterwards keeps it out. Screenshots: Fixture Weaves "(12)" before, Fixture Ceramics "(11)" after |
| 8-9 | Sign-in and sign-out | PASS (`buyer-auth-request.yaml`, `buyer-auth-verify.yaml`: wrong code refused, sign-in, restore after cold relaunch, sign-out) |
| 10-11 | Pull-to-refresh, pagination | PASS (`buyer-for-you.yaml`: scroll to "end of this feed" through the second page, refresh brings "(12)" back on top) |
| 12 | Dark mode | PASS (`buyer-for-you.yaml`) |
| 13 | Enlarged text (font scale 1.3) | PASS: the card reflows (screenshot), restored to 1.0 |

Measured on this setup (`GET /v1/fyp`, 12 eligible Scenes): new session, first page of 10 units
25-35 ms warm (63 ms first call), 7.7 KB; next page of 2 units 16-35 ms, 1.6 KB. One request per
page, no per-card request, no refresh loop (jest counts every request in each lifecycle test). The
list is still a FlashList, and Expo Image loads the `card_key` derivative only.

Notes:
- A development-only "multiple navigation containers / linking configured in multiple places"
  LogBox message appeared after Metro was restarted under a running app. A cold launch adds none
  (counted before and after), and this branch changes no navigation code.
- The first final run was invalid because of a script error (its helpers never ran). It was
  re-run in full on the final JavaScript.

## 23. Security review

Two independent read-only reviews -- code, and security/privacy -- each given the code and the
work order's checklist, not this record. The code reviewer re-reviewed both rounds of fixes.

| # | Severity | Found by | Finding | Outcome |
|---|---|---|---|---|
| R1 | **HIGH** | code | After a withheld revalidation failed, a pull-to-refresh brought the withheld cards back: TanStack offers the last query that HAD data as the placeholder | **Fixed** (`78aae08`): placeholders only from the immediately previous generation. The test fails without the fix. **Re-review: closed** |
| R2 | MEDIUM | security | Cards that arrived just after the app was backgrounded were never revalidated, even in release builds | **Fixed**: they age from the later of going to the background and their arrival; a zero threshold revalidates any return with cards on screen |
| R3 | MEDIUM / LOW | code, security | A pull-to-refresh still loading (or paused offline) when the app left was not revalidated on return | **Fixed**: placeholder cards count as cards on screen; test |
| R4 | LOW | both | A clock moved backwards skipped revalidation | **Fixed**: negative elapsed time counts as stale |
| R5 | LOW | code (re-review) | Retry after a failed refresh, or a refresh after a failed sign-in round trip, could still offer older cards (a key cannot tell two Queries apart) | **Fixed** (`cf9ee82`): withhold whenever no cards are on screen; Retry withholds. The test fails without the fix |
| R6 | LOW | code | The offline message asked for an action not offered; the added Retry then did nothing (refetching a paused query asks nothing) | **Fixed**: no button; the request resumes by itself on reconnect |
| R7 | LOW | code | The AppState spy was not restored | **Fixed**: the preset mock's own implementation is put back (`mockRestore` would have broken the next test) |
| R8 | LOW | code | The "latest" ref was written during render | **Fixed**: layout effect |
| R9 | INFO | code | A Refresh of a server-ended session showed that session's cards as placeholders (pre-existing) | **Fixed**: withheld |
| R10 | INFO | both | A stale `impression_id` mention in the DTO comment | **Fixed** |
| R11 | LOW | both | Costs of the release threshold 0: Android backgrounds the app for share sheets, dialogs, Custom Tabs and the camera; every return is a session start (120 per hour per subject) and stored rows; someone with a guest's device id can spend that budget | **Founder**: recorded in OVN-055 (recommended 5 minutes) |
| R12 | INFO | security | Cards are not re-checked while the app stays in the foreground | **Recorded**: OVN-066 |
| R13 | INFO | security | Future telemetry must resolve `serve_id` against the caller's own subject and session | **Designed**: section 6 |

Confirmed sound by the reviewers:
- `serve_id` is server-random, never read from the client, and bound by composite FKs to session,
  version, revision and Scene;
- replays need the same subject and the cursor secret (constant-time compare) and re-read the
  Market-scoped public gate;
- no cross-Market path; no bearer in a query key, URL or log, and the guest/account caches are
  separate;
- nothing creates an impression or an analytics event;
- no consumer outside this branch reads `impression_id`;
- Account deletion and device purge still remove For You rows;
- no listener leak, refetch loop or per-card work.

Pre-existing context (not findings of this work order): the device id as guest subject
(OVN-035), no retention period (OVN-032), guest sessions surviving an Account deletion until the
device purge (OVN-070), the cursor in the query string (OVN-059).

**No Critical or High finding introduced by this work order remains open.** DPIA R-04 and R-05 are
not claimed resolved.

## 24. Remaining decisions

All PENDING in the decision package: OVN-027 (DPIA before personalisation), OVN-029 (new-Seller
exploration), OVN-030 (pilot algorithm approval), OVN-031 (Seller cap), OVN-032 (retention, legal),
OVN-035 (guest anonymous identity, and linkage on sign-in), OVN-036 (impression identity and the
metric version), OVN-048 (feed photo ratio), OVN-055 (foreground interval). REC-01 S454 / S132 and
KB:297 need an authorised revision to the `serve_id` / `impression_id` split (C1, OVN-067).

New register items: OVN-066 (no foreground age check), OVN-067 (REC-01/KB naming), OVN-068 (no
SCENE report target), OVN-069 (`core.fyp_impression` naming debt), OVN-070 (guest sessions
outlive an Account deletion until the device purge), OVN-071 (a replayed last page carries a
cursor). The older records `docs/discovery/WO-DISC-002-FOR-YOU-API.md` and
`docs/mobile/WO-004A-BUYER-FOR-YOU-FEED.md` still say `impression_id`; they record their own time
and were not rewritten.

## 25. Next work order prerequisites

- **Any next Buyer feature** (Following, Explore the Scene, Search...) can build on this
  contract. A screen that shows Scenes should follow the same rule as For You: re-read
  eligibility after a background interval, and render nothing the server did not just confirm.
- **Telemetry** (qualified impressions) needs OVN-036 and an analytics retention class.
- **Engagement actions** each need their backend domain first (section 14). Report also needs a
  SCENE target kind, which is a database-governance change.
- **Production For You** needs OVN-030, OVN-032 and the legal authorisation of pilot processing
  (DPIA:1403).
- **Guest personalisation** needs OVN-027 and OVN-035.
