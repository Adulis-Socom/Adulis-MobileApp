# WO-DISC-001 - Scene and discovery domain foundation

> **Addendum, 10 November 2026 (WO-DISC-001A).** This work order ended BLOCKED on G-1 (ADU-DB-01
> Appendix B behind migration 0054). WO-DISC-001A installed ADU-DB-01 v1.20, `verify:appendix` is
> green with the gate unchanged, and WO-DISC-001 is formally closed: **COMPLETE -- READY FOR
> FOR-YOU / DISCOVERY API.** See `docs/discovery/WO-DISC-001A-DB-GOVERNANCE-SYNC.md`. The record
> below is the original and is not rewritten.

Status: complete on its branch, pushed, awaiting founder review. Branch
`discovery/wo-disc-001-scene-foundation`. No pull request, no merge, `main` untouched. No
For You ranking, feed session, Following, Nearby, Discounts, Locally Made, search, Story,
Like, Save, Hide, Review, payment, Seller Companion, Courier or Mobile UI work. The next
work order is not started.

Buyer-facing copy says "Scene"; the schema, routes and events keep the canonical
"scene post" (POST_OCT13 R-01). The old term "Shoppable Post" appears nowhere new.

## 1. Starting point

`mobile/wo-003a-auth-hardening` at `40a4dce59af5e6eb7db15b4563a0d99fc171e959`, verified
equal to `origin` with a clean tree.

## 2. Branch

`discovery/wo-disc-001-scene-foundation`, created from that commit. Commits are in section 24.

## 3. Authority read

| Source | Used for |
|---|---|
| ADU-SCN-01 v3.2 (read in full) | the model, states, rules, blockers, permissions, routes, events, concurrency |
| ADU-CATINV-01 v3.3 | what "available" means (S198), no Scene-local stock, withdraw rather than delete |
| ADU-MOD-01 v3.3 | moderation is a separate enforcement dimension (NONE/RESTRICTED/REMOVED, S343) |
| ADU-NOTIF-01 v3.3 | SCENE_BECAME_PRIVATE / SCENE_BECAME_PUBLIC, in-app yes, push by policy (S861, S917) |
| ADU-EVT-01 v3.2 + Contract_Registry | `scene_post.published` / `scene_post.visibility_changed` names and payload fields |
| ADU-AUTH-02 v3.3 + seller_permissions.json | the `seller.scene_posts:*` family and its holders (OWNER, ADMIN, CAMPAIGN_MANAGER) |
| ADU-MEDIA-01 v3.1 | image-only Scene media, purposes SCENE_PRIMARY / SCENE_CAROUSEL, no video |
| ADU-ANL-01, ADU-REC-01, ADU-SRC-01, ADU-MOB-02, ADU-STOREFRONT-02, ADULIS-KB, ADU-ARCH-PLATFORM-01 | read-model needs, routes, hotspot placement (R-06) |
| POST_OCT13 reconciliation, OPEN_DECISIONS | R-01, R-02, R-04 (Stories open), R-05, R-06 |
| `docs/mobile/WO-001C-CONTRACT-READINESS.md`, `WO-001C-CONTRACT-GAPS.json` | DSC-1 (this work order), DSC-5, DSC-6, K-2, K-3, K-8, WRK-3 |
| Existing code | catalogue, stock events, seller status, permissions, media keys, notifications, idempotency, migrations and gates |

The prototype was not used.

Where the designs disagree, the owning design and the machine registry were followed and the
drift is recorded (section 22): publication states are SCN-01's `DRAFT | PUBLISHED |
ARCHIVED` (MOD-01 S343 places `REMOVED` in moderation enforcement, not the Scene lifecycle);
the zero-tag blocker is `PRODUCT_TAG_REQUIRED`; event field names are the registry's
(`previous_visibility`, `current_visibility`, `reason`, `published_revision`); both SCN-01
private reasons are implemented.

## 4. Data model (migration 0054)

| Table | Purpose |
|---|---|
| `core.scene_post` | the stable root: `public_ref`, Seller, Market, `publication_state`, `visibility`, `visibility_reason`, current published and working revision pointers, `edit_version`, `lifecycle_version`, timestamps |
| `core.scene_post_revision` | one revision: `version`, `status` (WORKING / PUBLISHED), caption, the three image object keys, author, publisher, timestamps |
| `core.scene_post_product` | revision -> Product tags with `position` |
| `core.scene_post_transition` | one row per publication or visibility transition: from/to state and visibility, reason, revision, actor (NULL = system), `lifecycle_version` |

Views: `core.v_scene_product_availability` (the one availability derivation, section 7) and
`core.v_scene_post_public` (the one public read gate, section 12).

Key constraints:

- `public_ref`: 22 characters of base64url from 128 random bits, unique; never the id.
- `(seller_id, market_id)` references `core.seller (id, market_id)`: the Market is the
  Seller's own and cannot be anything else (S30).
- Root pointers reference `(revision id, scene id)`, so a pointer can only name this Scene's
  revision; one WORKING revision per Scene (partial unique index).
- State CHECKs: PUBLIC only when PUBLISHED with no reason; a reason only on PUBLISHED +
  PRIVATE; a DRAFT has never been published and always has a working revision.
- Caption at most 5000 characters. The design bounds it without a number (S20); 5000 is the
  repository's existing Product-description bound.
- `slug_history` and `hotspot` tables are not created (sections 17 and 22).

Write paths are guarded by triggers:

- identity, Seller and Market are write-once;
- lifecycle columns (state, visibility, reason, published pointer, versions, timestamps) move
  only inside the Content functions, which run as `adulis_migrate` (SECURITY DEFINER); the
  application role can create a DRAFT and edit drafts and nothing else;
- a PUBLISHED revision and its tags are immutable;
- `core.scene_post_transition` is writable only by those functions (`adulis_app` holds
  SELECT alone), which is stricter than append-only.

The four state vocabularies are `text` with CHECK constraints rather than new enum types, so
Appendix A does not change ahead of the ADU-DB-01 revision that must add these tables.

## 5. State model

Two dimensions, never one boolean (S14):

```text
publication_state  DRAFT -> PUBLISHED          (ARCHIVED: vocabulary only, no command yet)
visibility         PRIVATE | PUBLIC
visibility_reason  ALL_TAGGED_PRODUCTS_OUT_OF_STOCK | ALL_TAGGED_PRODUCTS_UNAVAILABLE | NULL
```

| From | Event | To |
|---|---|---|
| DRAFT, PRIVATE | publish, every gate passes | PUBLISHED, PUBLIC |
| DRAFT, PRIVATE | publish, a gate fails | unchanged; 409 with every blocker |
| PUBLISHED, PUBLIC | last available tagged Product lost | PUBLISHED, PRIVATE, reason |
| PUBLISHED, PRIVATE (availability reason) | a tagged Product available again, Seller and Market `ACTIVE` | PUBLISHED, PUBLIC |
| PUBLISHED, PRIVATE (availability reason) | the Seller or Market gate clears while a tag is available | PUBLISHED, PUBLIC |
| PUBLISHED (any visibility) | publish a working revision, every gate passes | PUBLISHED, PUBLIC, new revision |

Moderation, Seller suspension and Market state are independent gates evaluated at read time,
never stored in `visibility` (SCN-01 S41; MOD-01 S347): suspending a Seller mutates no Scene
row. They do block automatic restoration (S41, SCN-INV-08), and the Seller or Market change
that clears them is itself a re-evaluation. A stored reason is always an availability reason,
so restoration can never undo an unrelated private state, and nothing re-opens an ARCHIVED
Scene.

Revisions (S17): the root points at its current published revision and at most one WORKING
revision. The first edit of a published Scene clones the published revision (caption, image,
tags) into a new WORKING revision with the next version number; the published revision is
never touched. Publishing freezes the working revision and moves the pointer.

## 6. Product tags

- Rows, never caption parsing; `position` gives presentation order; unique per revision and
  Product (no duplicate tag) and per revision and position.
- **Same Seller is structural:** `(product_id, seller_id)` references `core.product (id,
  seller_id)`, so a cross-Seller row cannot exist even if the service check were skipped. The
  service also requires the Seller's own Market, and a missing Product and another Seller's
  Product are the same bare 404, so a tag request cannot probe another catalogue.
- Seller ids are never read from the client: the Seller is the authenticated Seller context.
- Draft revisions may carry incomplete or ineligible tags; publish checks them all (section 8).
- The tag list is bounded at 40 per request. That is a payload limit, not a business cap: the
  design sets none.

## 7. What "available" means

`core.v_scene_product_availability` derives, from canonical Catalogue/Inventory columns only:

```text
published  = product.visibility = 'PUBLISHED'
in_stock   = some product_variant has status 'ACTIVE' and stock_count > 0
available  = published AND in_stock
```

This is the per-line purchasability `fn_create_order` (0028) applies, without the quantity,
and SCN-01 S1/S26's "a currently purchasable in-stock Variant and not withdrawn/restricted".
Withdrawn, tier/level-downgraded and moderation-unpublished Products are `UNPUBLISHED`, so they
are not available. A tagged Product must also be in the Scene's Market to count. Stock
changes only through `core.stock_event` (the existing sole writer); there is no Scene-local
stock or flag.

The Catalogue has no central availability function: the rule is copied in `fn_create_order`,
`getCart` and the storefront, and the storefront filters on `published_at` rather than
`visibility` (section 22, G-11). Scenes use `visibility`, the commerce truth.

## 8. Publication rules

`POST /v1/seller/scene-posts/{id}/publish`, with `If-Match` naming the `edit_version` the
Seller reviewed. `core.fn_scene_post_publish` runs in the same transaction, under the Scene row
lock, and recomputes every gate (S27, S32, S33). Blockers are raised together as one
`409 PUBLICATION_BLOCKED` whose `items[]` carry the design's blocker name in `slots.item`:

| Blocker | When |
|---|---|
| `CAPTION_REQUIRED` | empty or whitespace caption |
| `MEDIA_MISSING` | no image |
| `PRODUCT_TAG_REQUIRED` | zero tags |
| `PRODUCT_NOT_ELIGIBLE` (with `product_id`) | a tagged Product is not public commerce |
| `PRODUCT_MARKET_MISMATCH` (with `product_id`) | a tagged Product is outside the Scene's Market |
| `NO_AVAILABLE_TAGGED_PRODUCT` | tags exist and none is available |
| `SELLER_NOT_PUBLIC_ELIGIBLE` | the Seller is not `ACTIVE` |
| `MARKET_NOT_ACTIVE` | the Market's `activation_state` is not `ACTIVE` |

Zero tags and all-unavailable tags are rejected; nothing is published silently as private
(WO S5). Out-of-stock tags are allowed while another tag is available (the mixture of S15). A
Scene never makes a Seller public: only an `ACTIVE` Seller may publish one, and Seller
readiness is not duplicated (WO S24). Publishing reserves no stock.

A stale `If-Match` is `409 VALIDATION_FAILED` with `slots.reason = STALE_REVISION` and
`current_version`; a missing one is `400 VALIDATION_FAILED`. Publishing with no working
revision is `409 VALIDATION_FAILED` with `slots.reason = NO_WORKING_REVISION`.

## 9. Automatic PRIVATE and PUBLIC

There is no transactional outbox (register WRK-3) and the worker engine is an open founder
decision (K-3), so the design's `inventory.changed -> consumer -> Content` path (S29) is
realised inside the database, in the transaction that changes availability:

1. AFTER triggers note, in a transaction-local setting, every Product whose availability
   inputs the transaction really changes: `core.product_variant` insert, delete, and a change of
   `stock_count`, `status` or `product_id`; `core.product` delete and a change of `visibility`
   or `market_id` (`WHEN` clauses skip writes that rewrite a value with itself). A change of
   `core.seller.status` or `core.market.activation_state` notes that Seller's or Market's
   published Scenes. Every changed Product is noted, tagged or not, because another
   transaction may tag it before this one commits.
2. A DEFERRED constraint trigger runs at COMMIT. Its first firing takes a per-Product advisory
   lock, exclusive and in id order, on every noted Product. In a fresh statement after those
   locks, it re-evaluates once every Scene that any revision tags with a noted Product, plus
   the noted Scenes. Those Scenes are locked in id order, and the match uses only the Scene id
   and tag rows, never the moving revision pointers. Then it clears the note. Tag writers (create
   and draft edits) take the same advisory lock shared before they tag. So a tag committed first
   is seen by the re-evaluation, and a tag written later waits for the commit; its publish then
   sees the committed stock.
3. `core.fn_scene_post_reevaluate` reads the current published revision's tags against
   current availability and writes only on a real change:
   - available >= 1, PRIVATE for an availability reason, Seller and Market `ACTIVE` -> PUBLIC;
   - available = 0 and PUBLIC -> PRIVATE with `ALL_TAGGED_PRODUCTS_OUT_OF_STOCK` when every
     tag is otherwise eligible and only stock is missing, else
     `ALL_TAGGED_PRODUCTS_UNAVAILABLE`;
   - available = 0, still PRIVATE, and the cause changed -> the reason is updated (no
     transition, no notice);
   - otherwise nothing.

Each transition bumps `lifecycle_version`, writes one `core.scene_post_transition` row and one
Seller notice (section 16). It is deterministic and idempotent: re-running it, duplicate events
and delta-0 stock events write nothing. Catalogue and Inventory code is unchanged and never
writes Scene state; the functions are Content's. **After any transaction completes, no
PUBLISHED + PUBLIC Scene has zero available tagged Products** (WO S18), and the public view
re-derives availability at read time as well (S21).

The re-evaluation path is the only one (WO S17): the triggers, publish-time checks and the
public view all read `core.v_scene_product_availability`.

## 10. Visibility reasons

Stored (management only): `ALL_TAGGED_PRODUCTS_OUT_OF_STOCK`, `ALL_TAGGED_PRODUCTS_UNAVAILABLE`
(both SCN-01 S1/S29). No free-text reason exists. Seller suspension, Market state and (future)
moderation are read-time gates, so `restores_automatically` in the management response is true
exactly when the stored reason is an availability reason. Public responses carry no reason,
state or management field.

## 11. Authorization

| Design (ADU-SCN-01 S13) | Executable now |
|---|---|
| `seller.scene_posts:read/write/publish/tag_products`, `seller.content_media:manage`; OWNER, ADMIN, CAMPAIGN_MANAGER; Console only | **both** `seller.media:write` AND `seller.broadcasts:send` on every Scene management route |

The `seller.scene_posts:*` codes are not in the executable catalogue (42 codes, pinned by four
gates; WO-API-001C is pending). `seller.media:write` is held by OWNER, ADMIN, INVENTORY,
CAMPAIGN_MANAGER; `seller.broadcasts:send` by OWNER, ADMIN, CAMPAIGN_MANAGER. Both are
CONSOLE-only, and the intersection is exactly the design's role set: nothing is broadened.
INVENTORY, SALES_SUPPORT and ANALYST are refused (403); an Account with no relationship gets
404; a Seller Companion (MOBILE) session is refused by the database's surface check (403), so
Companion authoring is impossible (S12). This mapping is temporary and is replaced when the
canonical family lands.

## 12. Public API

`GET /v1/scene-posts/{publicRef}` (anonymous).

- Reads only `core.v_scene_post_public`: PUBLISHED + PUBLIC, Seller `ACTIVE`, Market `ACTIVE`,
  caption and image present, and at least one tagged Product available now, in the Scene's
  Market. Every later Buyer surface (feed, search, storefront, collections) must read this view
  and nothing else; it is where a moderation gate joins.
- A PRIVATE, draft, unknown or malformed reference is the same bare `404 NOT_FOUND`, with no
  caption, image, tag or reason (S35).
- Returns `public_ref`, `published_at`, `revision_version`, caption, image keys, Seller handle
  and store name, and the public tags in order: slug, name, base price, card image key and
  `available` (false: "Currently unavailable", no purchase action, R-06). A tagged Product that
  is not public commerce is omitted rather than exposed.
- No internal id appears: Scene image keys live under `scenes/{public_ref}/img/` for this
  reason.
- `Cache-Control: no-store`: eligibility is decided per delivery (S48).

## 13. Seller API

All under `/v1/seller/scene-posts`, Console session, `X-Adulis-Seller`, the section 11 mapping.

| Route | Does |
|---|---|
| `POST /` (Idempotency-Key) | create a private DRAFT: optional caption and ordered `product_ids`; Seller and Market server-derived |
| `GET /` | the Seller's Scenes in any state, cursor page (1-50) |
| `GET /{id}` | management view: states, reason, `restores_automatically`, `effective_public`, both revisions with per-tag `published` / `in_stock` / `available`; `ETag` = `edit_version` |
| `PATCH /{id}/draft` (If-Match) | replace caption, image and/or tags of the working revision; clones a published one first |
| `POST /{id}/image-uploads` (Idempotency-Key) | presigned PUTs for the three image derivatives |
| `POST /{id}/publish` (Idempotency-Key, If-Match) | section 8 |

Another Seller's Scene and a missing one are the same 404. There is no archive, restore or
delete command (WO S20 asks for create, edit, tag, publish and read).

## 14. OpenAPI

Six operations, each with its path, query and header parameters (`X-Adulis-Seller`,
`Idempotency-Key`, `If-Match`), request body, typed success response, the default problem
response (`application/problem+json`, `ProblemDto`) and cookie security; the public read
declares no security. Fourteen named schemas, among them `SellerScenePostDto`,
`ScenePostRevisionDto`, `ScenePostTagDto`, `SellerScenePostPageDto`, `PublicScenePostDto`,
`PublicSceneProductDto`, `CreateScenePostBodyDto`, `PatchScenePostDraftBodyDto`. Management and
public shapes are separate classes, so no management field can reach a public response by
sharing a type. The change to `contracts/openapi.json` is additive only (no path or schema
removed or altered). `@adulis/api-client` was regenerated; generating twice gives identical
bytes for both files.

## 15. Events

No outbox exists (WRK-3) and none was invented. The durable fact of every publication and
visibility change is its `core.scene_post_transition` row, written in the same transaction as
the state change, unique per `(scene_post_id, lifecycle_version)`. It carries what the
registry's `scene_post.published` / `scene_post.visibility_changed` v1 payloads need
(`scene_post_id`, `seller_id`, the published revision, previous and current visibility,
reason) plus the envelope's aggregate revision and decision time, so a future relay can emit
them without re-deriving anything. No analytics event was added: ANL-01 defines
`scene_visibility_changed`, but the analytics event registry is governed separately and the
transition row is its source when that lands.

## 16. Seller notices

On every automatic transition, `core.fn_scene_post_reevaluate` writes one `core.notification`:
template `SCENE_BECAME_PRIVATE` or `SCENE_BECAME_PUBLIC` (NOTIF-01 S861), channel `IN_APP`
only, recipient the Seller's owner, the Market's default locale, suppressible, slots
`scene_post_id`, `public_ref`, `seller_id`, `reason`, `transition_id`, `lifecycle_version`.

- Exactly one per transition: it is written only on a real change, inside the locked
  re-evaluation, and the transition is unique per lifecycle step.
- A notice failure never rolls back the transition (S29): the insert runs in its own
  exception block and logs a warning.
- The seller notification feed now routes `SCENE_BECAME_%` to the seller feed
  (`notifications.controller.ts`, `sellerClassTemplate`).
- No push provider is involved; the existing in-app sender marks the row sent.
- Restoration is notified because SCN-01 requires it: S1 and S29, "Notify the Seller on
  automatic PRIVATE/PUBLIC transitions" (WO S33).
- A publish, a Seller-driven hide or a moderation decision sends no notice.

## 17. Media

The existing product-image flow, extended for Scenes, with no new upload system:

- `POST .../image-uploads` mints three server-chosen keys,
  `scenes/{public_ref}/img/{uuid}/{thumb,card,full}.webp`, through the existing media storage
  adapter, with the product image byte caps (now exported from the catalogue service).
- `PATCH .../draft` with `image` accepts exactly the minted shape. Each key must sit under this
  Scene's prefix, all three must share one upload id, and each file must be in its own slot.
  Traversal segments, swapped slots, mixed uploads and other Scenes' keys are all 400, before
  any storage call. Each object must then have landed within its cap (a HEAD through the
  adapter); a key that did not land is 409 `OBJECT_NOT_UPLOADED`. Both checks run before the
  Scene row lock, and upload signing takes no row lock at all, so storage latency never holds
  a lock a checkout COMMIT may wait for.
- Only object keys are stored, never URLs or bytes; the public origin comes from
  `/v1/bootstrap`.
- One primary image per revision. The carousel is not built because no bound is defined
  (section 22).
- Published revisions keep their keys; nothing is purged by stock privacy (MEDIA S223).

## 18. Migrations

`db/migrations/0054_scene_posts.sql`, append-only, with an irreversible down section like its
predecessors. Applied to a fresh database alongside 0001-0053 (`adulis_gates`, disposable).
`db:check` passes 16 of 16 with the four tables pinned by name in check 14 (the
body-over-manifest mechanism used for D-18, D-40, D-59, D-68, D-70 and D-176). `db:determinism`
results are in section 20. No demo or production Scene is seeded: the seed is unchanged.

The committed Kysely types (`database.types.generated.ts`) were regenerated from that database.
The previous file predated migrations 0040, 0043 and 0046, so the diff also carries that older
drift (the `WEB` device platform, Market activation and OTP delivery columns, the withdrawn
`is_live`); the API typechecks against it.

## 19. Concurrency

- **Lock order.** Every path takes its Product-side locks first and Scene locks last:
  - a commerce transaction holds its Variant and Product row locks, then at COMMIT takes the
    Product advisory locks in id order, then the Scene locks in id order;
  - draft edits take the advisory locks (shared) before their one Scene lock;
  - publish takes one Scene lock.

  No Scene path takes a Product or Variant lock that a commerce write conflicts with: a tag
  INSERT's FK takes KEY SHARE on `core.product`, which stock and visibility updates do not
  conflict with. A Scene therefore cannot deadlock a checkout.
- **Publish vs stock loss.** Re-evaluation also locks Scenes whose WORKING revision tags the
  Product, so it serialises with a concurrent first publish or republish. Whichever commits
  second re-reads the other's committed state in a fresh statement after the lock. The match
  ignores revision pointers, because a pointer moved by a publish could otherwise drop the
  Scene on READ COMMITTED's post-wait recheck.
- **A tag added while a stock change is open.** The advisory lock and noting every changed
  Product close this (section 9).
- **Two availability changes at once.** Both commits lock the Scene in turn; the second
  re-evaluates against the first's committed stock. Exactly one transition and one notice.
- **Tag edits vs publish.** Both take the Scene row lock; `If-Match` makes a publish of
  anything but the reviewed revision a 409. The tag guard locks the revision it checks, so a
  tag cannot slip into a revision as it is frozen.
- **Product removed while tags are edited.** A tagged Product cannot be deleted (the FK has no
  ON DELETE), and unpublishing goes through the noted-Product path.
- **Gates clearing.** A Seller or Market status change re-evaluates its published Scenes in the
  same COMMIT sweep, so suspension lifting restores what restock could not.

## 20. Tests

`apps/api/test/disc-001-scenes.e2e.spec.ts`, 36 tests against the real API and database.
Availability always moves through `core.stock_event` and Product visibility, the production
paths.

| WO matrix | Tests |
|---|---|
| Creation | owner creates; CAMPAIGN_MANAGER creates; INVENTORY 403, ANALYST 403, no relationship 404, owner on MOBILE 403, nothing created in each |
| Tags | cross-Seller 404, missing 404, duplicate 400, the composite FK refuses a cross-Seller row directly |
| Initial publication | zero tags `PRODUCT_TAG_REQUIRED`; all unavailable `NO_AVAILABLE_TAGGED_PRODUCT`; every missing gate at once; Seller not ACTIVE; one available tag publishes PUBLIC with its transition; If-Match required and stale |
| Availability | partial loss stays PUBLIC; last loss PRIVATE + PUBLISHED with reason, Seller still reads it, Buyer 404, one notice; idempotent re-runs; restock restores with one notice; a suspended Seller stays PRIVATE through restock and is restored, with its notice, when the suspension lifts; the private reason follows its cause; ARCHIVED is never reopened |
| Retirement | unpublishing the last available Product privatises, republishing restores, an unpublished tag is omitted publicly; a tagged Product cannot be hard-deleted |
| Concurrency | first publish holding the lock while the last unit is lost; republish of a revised Scene holding the lock while the last unit is lost; a tag added and published while a stock change is still open; stock loss before publish; two simultaneous last-unit losses and two simultaneous restocks. The two-connection tests assert from `pg_stat_activity` that the COMMIT really blocked, and roll back on failure |
| Privacy | draft/unknown/malformed are the same 404; the public shape has no management field, reason or internal id; another Seller cannot read, edit, publish or upload into a Scene in either Seller context; the owner on a MOBILE session reads nothing |
| Revisions, media | clone-on-edit, public sees v1 until v2 is published; the app role cannot move lifecycle columns, rewrite a published revision or its tags, or write a transition; image keys must be this Scene's minted shape (traversal, swapped slots, mixed uploads, another Scene's prefix all refused) and must have landed |

Before anything is reset after each test, the suite asserts the S18 invariant over every Scene
it created.

Mutation checks, each reverted afterwards:

| Mutation | Result |
|---|---|
| the COMMIT-time trigger disabled | 6 tests fail |
| no working-revision clause in the lock query | the first-publish race test fails |
| the collector notes only already-tagged Products | the open-stock-change tag test fails |
| restoration ignores the Seller and Market gates | the suspended-Seller test fails |
| the lock query matches by the moving revision pointers | **does not fail** on this database: Postgres matched through the working revision's tag, which survives the pointer move. The interleaving the reviewer described depends on the plan; the immutable match removes that dependency rather than this test proving it |

The suite found one real defect while being written: image keys under the internal Scene id
reached the public response. They are now keyed by `public_ref`.

Full validation ran on a disposable database (`adulis_gates`), rebuilt from nothing with every
migration after the last change.

| Check | Result |
|---|---|
| `pnpm db:migrate` (0001-0054 on an empty database), seed, worker schema | pass |
| `pnpm db:check` | 16 of 16 |
| `db:determinism`, `typecheck`, `lint`, `build`, `deps`, `deps-fires`, `contract-prefix` (`verify:contract`), `error-locale`, `extensions`, `worker-schema`, `permission-doc` and `docs-ascii` (`verify:docs`), `appendix-c`, `deferred-values`, `trust-before-open-signup`, `no-unsafe-eval`, `production-react`, `mt-keys`, `orphan-sweep` (after the full suite), `transcription`, `surface-markers`, `tokens`, `render-yaml`, `console-e2e`, `contract-current` | pass |
| `appendix` | **red, as expected (G-1)**: Appendix B says `core` holds 90 and 116 tables in all; the database holds 94 and 120 |
| `pnpm --filter @adulis/api test` | 697 of 698. The one failure is `c1-onboarding` "GET lists ascending from today", which hard-codes 2026-09-11. Reproduced at the starting commit `40a4dce` on a fresh 0001-0053 database: the same single failure |
| console, mobile, api-client, config, locale, tokens tests | pass |
| Mobile regression: `@adulis/mobile` typecheck, test (101 of 101), build | pass |
| `@adulis/api-client` test | pass |
| OpenAPI and client generated twice | identical bytes |

## 21. Security review

Two independent read-only reviews of the diff: a security review against the work order's
S44 list, and a correctness review. Neither found anything critical. Every finding rated high
or medium was fixed with a test, and none remains open.

| Finding | Severity | Done |
|---|---|---|
| A tag added while a stock change is still open escaped re-evaluation, because only already-tagged Products were noted, so a Scene could end PUBLIC with nothing available | medium (security) | every changed Product is noted; tag writers and COMMIT-time re-evaluation meet on a per-Product advisory lock; test (mutation-checked) |
| The lock query matched by revision pointers, which a concurrent republish moves; READ COMMITTED's post-wait recheck could then drop the Scene | high (correctness, plan-dependent) | match by Scene id and tag rows only; republish race test |
| Restoration ignored the Seller and Market gates (SCN-01 S41, SCN-INV-08) | important | restoration requires both; a Seller or Market status change re-evaluates; test (mutation-checked) |
| A draft edit held the Scene lock across storage HEAD calls, which a checkout COMMIT may wait behind; upload signing took a row lock | medium (security, important in correctness) | storage I/O before any lock; signing takes no row lock |
| Image keys were checked by prefix only (traversal, swapped slots, mixed uploads) | low | exact minted shape, all shapes checked before any storage call; tests |
| The note string grew quadratically, and no-op writes (a price edit rewriting `status`) noted Products | low | de-duplicated notes; `WHEN` clauses on every UPDATE trigger |
| The private reason went stale while the Scene stayed PRIVATE | moderate | refreshed when its cause changes; test |
| The tag guard checked only the new revision on UPDATE, and read the revision without a lock | info / comment | checks both, `FOR SHARE` |
| Notes that are not UUIDs would fail the COMMIT | info | filtered |
| `JSON.parse` of the publish DETAIL unguarded | info | guarded |
| The `afterEach` invariant ran after the resets, so it could not fail; race tests did not prove the race; `finally` released open transactions | test quality | invariant first; `pg_stat_activity` blocking check; `ROLLBACK` before release |
| Comments overstated "no Product or Variant lock" and the untagged-Product cost | comment | corrected |

Recorded, not changed:

- `fn_scene_post_publish` trusts its Seller and actor arguments, like `fn_publish_product`. Only
  attribution could be forged, by SQL the API never sends; every gate is still recomputed.
- Upload signing is not capped or throttled, and replaced or unattached uploads are not
  purged. The same is true of Product images today, and the repository has no rate limiter
  (G-9, G-19).
- Seller-scope notifications are not filtered by Seller (an owner of two Sellers sees both),
  an existing pattern of the notification feed.
- No `lock_timeout` is configured anywhere in the API. With storage I/O out of the lock, a Scene
  lock is held only for a few statements.

Each reviewer also confirmed:

- the composite-FK chain makes cross-Seller tags unrepresentable;
- every management query is Seller-scoped behind authorisation (foreign and missing Scenes are
  the same 404);
- the permission intersection is exactly OWNER, ADMIN and CAMPAIGN_MANAGER, CONSOLE only;
- all SQL is parameterised;
- the lifecycle guard's `current_user` test cannot be met by the application role;
- the public route reads only the gate view, with no internal ids;
- nothing in the grants would fail with a non-superuser `adulis_migrate` in production.

## 22. Unresolved gaps

| Id | Class | Gap |
|---|---|---|
| G-1 | FOUNDER_DECISION_REQUIRED | ADU-DB-01 Appendix B must add the four tables. Until the founder installs that revision, `pnpm verify:appendix` is red on the `core` row; neither the installed document nor the gate was edited. |
| G-2 | CONTRACT_GAP | The `seller.scene_posts:*` family (and `seller.content_media:manage`) is not executable; section 11's mapping is temporary (WO-API-001C). |
| G-3 | CONTRACT_GAP | No Scene error code: blocked publish reuses `PUBLICATION_BLOCKED`, whose English text says "This product cannot be published yet". A Scene-specific code or neutral copy needs ADU-API-01 and `packages/locale` changes. A stale `If-Match` uses `VALIDATION_FAILED` 409 + `slots.reason` (the `handleImage` precedent) because the taxonomy has no version-conflict code. |
| G-4 | FOUNDER_DECISION_REQUIRED (K-3, WRK-3) | No outbox or event relay: transition rows are the durable facts; consumers (Search, Recommendation, Storefront, Collections, Analytics) do not exist yet. Re-evaluation is synchronous in the database rather than an outbox consumer (section 9). |
| G-5 | OPEN_DESIGN_DECISION | Carousel image bound undefined (MEDIA "bounded frames", no number): primary image only. |
| G-6 | IMPLEMENTATION_GAP | Hotspots need a versioned MediaPresentation (crop/orientation geometry), which does not exist. The hotspot table is additive later, no breaking change; the feed shows no hotspots anyway (R-06). |
| G-7 | OPEN_DESIGN_DECISION | Archive, restore and lifecycle deletion are not built. The registry has `scene_post.deleted` but the permission family has no delete code (contradiction H). |
| G-8 | IMPLEMENTATION_GAP | No Scene moderation enforcement or SCENE report target exists (DSC-6), so `CONTENT_MODERATION_RESTRICTED` cannot be evaluated; the public view is where its gate joins. |
| G-9 | IMPLEMENTATION_GAP | Media readiness is a landed-object check at attach time; there is no MediaAsset readiness or authorization state (`MEDIA_NOT_READY` / `MEDIA_NOT_AUTHORIZED`). Requested-but-unattached and replaced uploads are not tracked or purged, as for Product images today. |
| G-10 | CONTRACT_DRIFT (designs) | `REMOVED` as a publication state (CATINV, CONSOLE) vs SCN/MOD; two private-reason names; `SCENE_PRODUCT_TAG_REQUIRED` (CATINV) vs `PRODUCT_TAG_REQUIRED`; EVT prose vs registry payload fields; two restoration notice texts; two PublicScenePost shapes. Choices in section 3. |
| G-11 | IMPLEMENTATION_GAP (Catalogue) | No central availability function; the storefront filters on `published_at`, and `fn_unpublish_product` never clears it, so an unpublished Product still lists on the storefront. Scenes use `visibility`. Reported, not changed. |
| G-12 | IMPLEMENTATION_GAP (Catalogue, reported by research, not reproduced) | `fn_delete_seller_effects` sets `unpublished_reason` without changing `visibility`, which the `unpublished_reason_only_when_unpublished` CHECK refuses. |
| G-13 | CONTRACT_GAP | Deleting a Scene-tagged Product answers `409 PRODUCT_HAS_ACTIVE_ORDERS` ("This product has live orders"): the right refusal with the wrong words. |
| G-14 | IMPLEMENTATION_GAP | `SCENE_BECAME_*` templates have no client copy yet (the Console maps template keys; not edited from a backend work order). Only the owner is notified; the design's "authorized Seller content recipients" may include CAMPAIGN_MANAGERs. |
| G-15 | Deferred by scope | Storefront Scene list, Scene search, For You feed, slug history and a separate `/products` route (tag projections are inside the detail response). |
| G-16 | CONTRACT_GAP | Buyer Market resolution for anonymous reads does not exist, so an out-of-Market link is not yet answered "market unavailable" (S30); `MARKET_NOT_ACTIVE` uses `market.activation_state`, the AUTH v2.6 column (D-183 notes overlapping Market truths). |
| G-17 | IMPLEMENTATION_GAP | No analytics event for Scene transitions yet (section 15). |
| G-18 | Technical bounds | Caption 5000 and 40 tags per request are payload bounds, not design rules. |
| G-19 | IMPLEMENTATION_GAP | No rate limiting on create, publish or upload signing (S51/S52 name `@nestjs/throttler`; the repository has none yet), and no cap on outstanding presigned uploads. |
| G-20 | IMPLEMENTATION_GAP | No reconciliation sweep (EVT-01 `recompute_scene_visibility`): with the COMMIT-time path it is a safety net rather than a requirement, and it needs the worker-engine decision (K-3). |

## 23. What WO-DISC-002 can rely on

- `core.v_scene_post_public` is the one candidate source: every row is publicly eligible right
  now. Select from it and nothing else; never re-implement the gate. Moderation joins there.
- `core.scene_post (market_id, publication_state, visibility, published_at DESC)` is indexed
  for Market-scoped candidate scans, and stored visibility is current after every commit.
- `public_ref` is the stable public identity; `revision_version` / `current_published_revision_id`
  identify the exact served revision for impression lineage (REC S153, SRC S283).
- `core.scene_post_transition` is an ordered, per-Scene change log (`lifecycle_version`) that
  can drive projections idempotently.
- `PublicScenePostDto` is the public card/detail shape in the generated client.
- Content stores no rank, score or popularity: ranking belongs to Recommendation.

## 24. Commits

| Commit | Content |
|---|---|
| `fcc56f3` feat(scene): add canonical scene persistence, tags and availability visibility | migration 0054, the check 14 pin, regenerated Kysely types, `apps/api/CLAUDE.md` counts |
| `41e40fa` feat(api): publish seller and public scene contracts | the Scene module, its registration, the seller-feed template route, the exported image caps, the regenerated contract and client |
| `9b53893` test(scene): cover lifecycle, authorization, concurrency and privacy | `apps/api/test/disc-001-scenes.e2e.spec.ts` |
| docs(discovery): record WO-DISC-001 foundation | this record and the register addendum (`docs/mobile/WO-001C-CONTRACT-GAPS.json`, resolution log) |

The three code commits were verified together, on the final tree.

## 25. Next recommended work order

WO-DISC-002: For You and discovery API (feed sessions, candidate selection from
`core.v_scene_post_public`, ranking, pagination, impressions), with the G-1 ADU-DB-01 revision
and the G-2/G-3 contract additions decided first or alongside.
