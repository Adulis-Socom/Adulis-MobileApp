# WO-009 -- Buyer Saved Products, Scenes and Collections

Status: COMPLETE (four founder policy items recorded: ON-20261111-087, -088, -090, -091; card-level Save deferred)

Engineering record of WO-009. Founder and partner-facing contract notes are in
`docs/mobile/WO-009-CROSS-SURFACE-HANDOFF.md`; every issue is in
`docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md` (ON-20261111-086 to -102).

## 1. Starting SHA and branch

- Branch `mobile/wo-009-buyer-saved-collections`, created from `mobile/wo-008-marketplace-search` at
  `473e02ee44039dc5426d1094cc2139bfcbc1f7ae` (verified equal to its remote, clean tree).
- Not started from `main`; nothing merged; no force-push; no other branch touched.

## 2. Governing documents

| Source | Used for |
|---|---|
| ADU-SRC-01 v3.2 S18-S22, S24-S27 | Collections model, provenance, current-state rendering, UX, batching and APIs, privacy, abuse controls |
| ADU-MOB-02 v4.3 S39-S42 | Saved destination, Collections, originating Scene, Save versus Cart |
| ADU-PRV-01 v3.3 S36, PRV-INV-020; ADU-DPIA-01 v1.1 PA-08, S29 | Collections are private preference data; delete on Account deletion; owner-only |
| ADU-SCN-01 v3.2 (via `core.v_scene_post_public`) | The one Buyer-facing Scene gate |
| ADU-CATINV-01 v3.3 (via the Shop/Search Product gate) | Product publication and availability |
| ADU-AUTH-02 v3.3, ADU-API-01 v1.11 | Session ownership, idempotency, closed error taxonomy, no-store |
| ADU-DB-01 v1.25 -> **v1.26** (this work order) | Schema record; Appendix B regenerated |
| Prototype `MobileBuyer.tsx` (Saved, Collection, toggleSave) | UX: one tap toggles membership in the default Saved; Add to collection is secondary; "Private to you"; Products / Scenes tabs |

The November 8 pack is unchanged; conflicts are recorded (section 20), not resolved.

## 3. Initial repository audit

- No Collection table, endpoint or client existed. `saved.tsx` was a signed-in placeholder and a guest
  `SignInRequired` returning to `/saved`.
- Product Detail and Explore the Scene drew no Save. The public Product payloads carry the Product `id`
  (uuid, "never a URL segment"); Scenes are addressed by `public_ref`. No global Product slug exists
  (slugs are unique per Seller), so Save targets use the `id` in request bodies only.
- `core.scene_post_product` has no surrogate tag id (PK `(revision_id, product_id)`), and
  `core.scene_post_revision` already carries a unique `(id, scene_post_id)`.
- Account deletion: `core.fn_delete_account`, last redefined in `0055` (SECURITY DEFINER, owner
  `adulis_migrate`).
- Buyer endpoints scope by `req.ctx.accountId` and answer `NOT_FOUND` for foreign rows (orders pattern);
  state-changing POSTs use `HandlerTransaction.runIdempotent`.
- The sign-in return path is an allowlist (`src/auth/sign-in-flow.ts`); `clearSession` already clears the
  whole query cache and the active mode.
- The error taxonomy is closed (ADU-API-01 S7.1): no new codes from a work order.

## 4. Database architecture

Migration `0061_buyer_collections.sql` (forward-only; down migration refuses):

- `core.collection` (id, owner_account_id FK account, kind DEFAULT | USER_CREATED as text + CHECK,
  name, created_at, updated_at). CHECK: DEFAULT has no name; a user-created name is trimmed, 1-60
  characters, without control characters. `uq_collection_default` (partial unique on owner WHERE kind
  = 'DEFAULT'); `idx_collection_owner (owner_account_id, created_at, id)`.
- `core.collection_item` (id, collection_id FK ON DELETE CASCADE, product_post_id FK product ON DELETE
  CASCADE, scene_post_id FK scene_post ON DELETE CASCADE, originating_scene_post_id FK ON DELETE SET
  NULL, originating_scene_revision_id, scene_revision_seen_at_save_id, source_surface text + CHECK,
  created_at). CHECK `num_nonnulls(product_post_id, scene_post_id) = 1`; partial uniques per Collection
  and target; `idx_collection_item_recent (collection_id, created_at DESC, id DESC)`; indexes for every
  referential action's lookup.
- Composite FKs: `collection_item_origin_revision` and `collection_item_seen_revision` bind a revision to
  its own Scene; `collection_item_origin_tag (originating_scene_revision_id, product_post_id) ->
  scene_post_product (revision_id, product_id)` is the tag (SRC-01's `product_tag_id`, ON-086). Each nulls
  only its revision column on delete (PostgreSQL 15+ column list).
- Grants: `adulis_app` SELECT, INSERT, DELETE on both, UPDATE (name, updated_at) on `collection`;
  `adulis_migrate` SELECT, DELETE (the definer); nothing to `adulis_readonly`.
- `deleted_at` (optional in SRC-01 S19) is not created: delete is a hard delete (ON-087).
- Counts: 125 tables (`core` 99), 71 enum types, 22 append-only; check 14 pins both tables by name;
  Kysely types regenerated; ADU-DB-01 **v1.26** (S0.1, S30i, Appendix B), v1.25 to `superseded/`.

## 5. API contracts

All authenticated (no `@Public`), owner = the session's Account, `Cache-Control: no-store`:

| Method and path | Answer |
|---|---|
| `GET /v1/collections?cursor&limit` | `{ default_collection_ref, data: CollectionDto[], next_cursor }`, DEFAULT first then oldest first; counts per Collection |
| `POST /v1/collections` (Idempotency-Key) | 201 `{ ref }` |
| `GET /v1/collections/saves?type=ALL\|PRODUCT_POST\|SCENE_POST&cursor&limit` | Recent Saves across every Collection, each target once at its most recent membership |
| `POST /v1/collections/saved-state:batch` | 200 `{ default_collection_ref, items: [{ type, ref, saved, default_item_ref, memberships[] }] }` for 1-60 typed targets |
| `GET /v1/collections/{collectionRef}?type&cursor&limit` | `{ collection, data: CollectionItemDto[], next_cursor }`, newest first |
| `PATCH /v1/collections/{collectionRef}` | 200 CollectionDto (named only) |
| `DELETE /v1/collections/{collectionRef}` | 204 (named only) |
| `POST /v1/collections/{collectionRef}/items` (Idempotency-Key) | 201 `{ ref, collection_ref, target_type, saved_at }` |
| `DELETE /v1/collections/{collectionRef}/items/{itemRef}` | 204, idempotent |

- Targets: `{ type: 'PRODUCT_POST', ref: <Product id> }` or `{ type: 'SCENE_POST', ref: <public_ref> }`;
  `source_surface` from a closed list; optional `context.scene_ref`. Unknown keys refused (zod strict).
- `CollectionItemDto`: `state` VISIBLE | UNAVAILABLE; `product` (the Shop tile shape) or `scene` (the
  Search tile shape) only when VISIBLE; nothing else when UNAVAILABLE.
- Errors: foreign, forged or malformed refs and hidden targets -> 404 `NOT_FOUND`; bad bodies -> 400
  `VALIDATION_FAILED`; DEFAULT rename/delete -> 400 `VALIDATION_FAILED` (path `collectionRef`, ON-089);
  guests -> 401.
- `saved-state:batch` is a read (no Idempotency-Key). Express 5 needs the literal colon escaped in the
  route; the OpenAPI path is `/v1/collections/saved-state:batch` (checked in the generated contract).
- Contract and `@adulis/api-client` regenerated (CI remains the author of record); mobile types derive
  from `paths`.

## 6. Default Collection

- Created on first need (`GET /v1/collections`, `saved-state:batch`) with `INSERT ... ON CONFLICT
  (owner_account_id) WHERE kind = 'DEFAULT' DO NOTHING`, then read (READ COMMITTED sees a concurrent
  twin's row). The partial unique index is the guarantee.
- Never identified by name: it stores none; the app shows the localised "Saved".
- Cannot be renamed or deleted (server refusal; the app offers neither).
- Same Collection on every device and in every mode (owner is the Account).

## 7. Typed membership model

Exactly one target per row (CHECK), typed FKs (no polymorphic id), one row per Collection and target
(partial uniques). A repeated Save returns the existing membership (`ON CONFLICT DO NOTHING`, then read);
a repeated Remove succeeds. A whole Scene and its tagged Product coexist as independent memberships, in
the same or different Collections. No order or position column (newest first, id tie-break).

## 8. Product and Scene saving

- A Product is savable only when it passes the Shop/Search gate now in the caller's Market (PUBLISHED,
  published, Seller in VISIBLE_STATES, Market ACTIVE). Out of stock is still public and savable.
- A Scene is savable only through `core.v_scene_post_public` in the caller's Market; the revision current
  at save is recorded.
- Saving never touches stock, price, Cart, reservation or Order (tested: no rows change).

## 9. Provenance

- Product from a Scene: the app passes the Scene it was opened from (`from` route parameter, untrusted);
  the server records `originating_scene_post_id` and `originating_scene_revision_id` only when that
  Scene's CURRENT public revision tags the Product; otherwise nothing (never fabricated; the composite FK
  refuses a fabricated tag at the database).
- Whole Scene: `scene_revision_seen_at_save_id` = the current public revision at save.
- `source_surface` records where the Save happened. Provenance is written, never selected into any
  response, never an access path, and never an analytics event or ranking signal.

## 10. Privacy and authorization

- Owner always from the session; no owner field accepted (zod strict refuses it).
- Every statement scoped by owner; foreign Collections answer exactly as nonexistent ones (404), with no
  name, count or existence leaked. `X-Adulis-Seller` and mode decide nothing.
- No public, shared or collaborative Collections; no Collection URL outside the signed-in app.
- POST answers carry refs only, so the idempotency store keeps no private name or content (review D1/D2).
- No logging of names; mobile logs only error class names. No analytics or recommendation use.
- Mobile: private answers live only in the TanStack cache, which `clearSession` clears; a late answer from
  an earlier session is dropped (mutations compare the session token; queries are removed with the cache).

## 11. Saved-state batching

`POST /v1/collections/saved-state:batch` answers up to 60 typed targets with two statements (Products by
id, Scenes by public_ref), reporting the caller's own memberships only. Product Detail and Explore the
Scene ask with a batch of one. No list surface sends any per-card request (card-level Save is deferred,
ON-092; the endpoint is ready for one request per visible page).

## 12. Mobile navigation

- `(tabs)/saved.tsx`: guest -> sign-in prompt (returns to `/saved`); signed in -> `SavedScreen`: title,
  "Private to you.", Collections (Saved first, then the Buyer's own, with counts; all pages loaded),
  New collection, and Recent / Products / Scenes over `GET /v1/collections/saves` on the shared list
  (loading, empty, offline, error and retry, end of list). Refreshes on return.
- `collections/[collectionRef]`: items newest first with All / Products / Scenes, Remove on every item,
  Rename and Delete (platform confirmation dialog, Cancel default) for named Collections; 404 -> "This
  collection is no longer available."
- `save-to` (modal): Add to collection -- every Collection with a tick where the target is, toggled on
  the server first; New collection creates and fills in one step; Done returns.
- `SaveButton` on Product Detail (after availability) and Explore the Scene (after the caption): Save /
  Saved for the DEFAULT, Add to collection. Disabled while a request is in flight; drawn only from the
  server's answer; announces the change.
- Strings: 43 new keys in `@adulis/locale/mobile` (en + machine-translated am placeholders, MT-KEYS
  regenerated); `buyer.saved.coming` removed.

## 13. Guest sign-in continuation

1. A guest taps Save: the app explains ("Sign in to save Products and Scenes to your private
   collections.") and offers Sign in. Nothing is stored.
2. Sign in arms the Save in memory (`ui-store.pendingSave`) under a random nonce and opens sign-in with
   `returnTo` (the Product or Scene path) and `save=<nonce>`.
3. `parseReturnTo` accepts the fixed tabs plus `/product/<handle>/<slug>` and `/scenes/<public_ref>`
   rebuilt from parts matching the public read's patterns -- never a scheme, host or query.
4. Verify, after a successful sign-in, completes the Save only if its nonce equals the armed one: it
   re-reads saved state in the NEW session and adds to that Account's Saved; the server re-checks the
   target. Then it returns to the Product or Scene, which shows the server's state.
5. A cancelled sign-in saves nothing (the nonce dies with the screens); a later sign-in elsewhere carries
   no nonce; a link cannot know the nonce; `clearSession` drops the pending Save.

## 14. Visibility and tombstone handling

| Target now | Collection shows |
|---|---|
| Product public and in stock | Current tile, price span, "Available" |
| Product public, out of stock | Current tile, "Currently unavailable"; still saved |
| Product unpublished / moderation-restricted / Seller suspended / another Market | "This Product is no longer available." -- no name, image, price or reason; Remove |
| Product hard-deleted by its Seller | Membership removed with it (ON-090) |
| Scene current PUBLIC revision | Current image, caption excerpt, Seller |
| Scene PRIVATE / ARCHIVED / Seller suspended / another Market | "This Scene is no longer available." -- no caption, image, tags, revision or reason; Remove |
| Scene restored PUBLIC | Current revision again; membership unchanged |

A hidden target cannot be newly saved (404); its existing membership stays.

## 15. Account deletion

`core.fn_delete_account` is re-created from its live 0055 body (extracted with `pg_get_functiondef`,
compared byte for byte) with exactly one added statement after the For You purge:
`DELETE FROM core.collection WHERE owner_account_id = p_account_id;` -- memberships cascade; Products and
Scenes are untouched. Owner and grants restated. Tested through the API role.

## 16. Tests

New and changed tests:

- API `test/wo-009-collections.e2e.spec.ts` (29, real PostgreSQL; Scenes published through the Seller API):
  collections -- DEFAULT once, concurrent creation (10 parallel first requests, one row; a second DEFAULT
  refused 23505), create with normalised names and a replayed Idempotency-Key, bad names, no client owner,
  rename, delete with memberships (saved objects kept), DEFAULT rename/delete refused, duplicate Product and
  Scene Saves, idempotent Remove, mixed and coexisting memberships, invalid target types and refs, forged
  and foreign refs (read, write, delete, delete through one's own Collection ref, X-Adulis-Seller), guests
  refused on all nine operations, pagination (4 pages of 10, newest first; Recent Saves each target once),
  8 concurrent duplicate Saves -> one row (cases 1-20); visibility -- available, out of stock, unpublished
  and moderation-restricted (neutral, no name; cannot be newly saved), a Seller's hard delete, PUBLIC ->
  PRIVATE -> PUBLIC, ARCHIVED, the referential actions for a Scene purge, provenance validated / never
  fabricated (a forged tag refused by the FK) / never rendering an old revision, Market change, Seller
  suspension (cases 21-32); privacy and contract -- the account-deletion purge through the API role,
  stored POST answers carry no name or content, exact grants (none to adulis_readonly), no-store, no Cart /
  reservation / Order / stock change.
- API `src/modules/collections/collections.logic.spec.ts` (3): name normalisation, malformed refs as 404,
  typed targets and strict bodies.
- Mobile `src/buyer/saved.test.tsx` (17, the real route tree on an in-memory server with the API's rules):
  signed-in Saved (33, 43), Scenes tab and open a Scene (44), guest Saved requests nothing (34), unavailable
  item with Remove and no DEFAULT management, offline and retry (49), create with validation and keyed
  request (40), rename and delete only after confirmation (41, 42), Save drawn only after the server answers
  with Scene provenance, then Remove (35, 36), a refused Save stays unsaved, whole-Scene Save and Remove (37,
  38), another device's Save shown on opening, the picker's independent memberships (39), guest
  continuation (45), cancelled sign-in and a later sign-in elsewhere save nothing (46), an unknown nonce and
  an unsafe returnTo do nothing, sign-out clears at once and a late answer shows nothing (47, 48); every test
  asserts no cart / order / checkout / payment request (51). Case 50 (Dark, large text) natively; 52 by the
  existing suites and native regression flows.
- Updated: `auth-flow.test.tsx`, `buyer-shell.test.tsx` (the real Saved screen replaced the placeholder),
  `scene-explorer.test.tsx` (Save is in scope; every purchase action is still asserted absent).

Final battery (freshly rebuilt disposable database; `pnpm test` on a second rebuild):

| Gate | Result |
|---|---|
| `@adulis/api` jest, `--maxWorkers=2` (ON-20261111-085) | **969/969** |
| `pnpm test` (default parallelism, second rebuild) | PASS: api 969/969, mobile 259/259 (the ON-085 crash did not recur) |
| WO-009 suites alone (e2e + logic) | 29/29 + 3/3 (after the review fixes) |
| `@adulis/api-client` test / `generate:check` | PASS / PASS |
| `@adulis/mobile` typecheck / test / build | PASS / 259/259 / PASS |
| `pnpm typecheck` / `lint` / `build` | PASS / PASS / PASS |
| `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS (all six) |
| `db:check` / `db:determinism` | 16/16 (125 tables, 71 enum types) / PASS |
| Orphan sweep | PASS |
| Expo Doctor | 20/20 with expo-doctor 1.21.6; 1.21.7 (published 11 November 09:48 UTC) cannot start (`Cannot find module '@expo/env'`, also with a fresh cache) -- ON-20261111-102 |
| Mobile bundle scan for subscription copy | none: the two Hermes bundles match only framework identifiers (event/keyboard `Subscription` APIs) |

## 17. Native validation

Android emulator (API 37), debug build (no native dependency changed, so the installed APK was reused
with Metro), real local API on the disposable database with the WO-CAT-001/006/007 fixtures. **iOS was not
tested.**

| Flow | Result |
|---|---|
| `saved-guest-1` (guest: Search "basket" -> Product -> Save -> the reason -> Sign in -> code requested); database: 0 memberships | PASS |
| `saved-guest-2` (code -> back on the same Product, Saved; database: one DEFAULT membership, source PRODUCT_DETAIL) | PASS |
| `saved-collections`: Saved tab -> open the Product; Add to collection -> Saved ticked -> New collection "Gift ideas" made and ticked; Home -> For You -> Explore the Scene -> Save the Scene (database: scene_revision_seen_at_save_id recorded); Saved counts; Scenes tab -> open the Scene; rename to "Gifts", Remove (Saved keeps its own), Delete after the confirmation dialog | PASS |
| `saved-states unavailable` (Woven basket unpublished in the database first): "This Product is no longer available.", no name, Remove offered; restored afterwards | PASS |
| `saved-states signed-out`: Sign out -> Saved shows the sign-in prompt, no Collection | PASS |
| `buyer-auth-request` + sign-in on a cleared install (a new device), then `saved-states back`: "Saved, Products: 1, Scenes: 1" from the server | PASS |
| `saved-states dark` (Dark, font scale 1.3): Saved tab and a Collection | PASS |
| Regression: `search`, `shop`, `seller-profile`, `buyer-scene-explorer`, `catalogue-product-1` | PASS (all five) |
| Commerce rows after all flows | carts 0; reservations 5 and orders 8 are seed/WO-006 fixture rows, unchanged |

Not run natively: `buyer-for-you.yaml` (needs the WO-004A fixtures on their own database; ON-20261111-084).
The For You -> Explore the Scene -> Save journey used the catalogue fixtures' public Scenes in For You.
Two findings during the runs: the first tab tap after a launch can be swallowed (the flows tap until it
lands, ON-101), and drive C: filled to 0 MB mid-run (ON-100; outputs moved, flows re-run).

## 18. Security review

Independent code and security review of `473e02e..3319049` (all 17 points of WO-009 S26): **no Critical or
High.** Findings and outcomes:

| Finding | Severity | Outcome |
|---|---|---|
| D1 POST /v1/collections answer (with the private name) kept 24 h by the idempotency store, beyond deletion | MEDIUM | FIXED: answers `{ ref }` (ON-093) |
| D2 POST .../items answer held the Scene's content; a key replay could serve it after PRIVATE | LOW | FIXED: membership only (ON-094) |
| D3 mobile kept a Save key across a lost answer (stale replay after a removal) | LOW | FIXED: fresh key per tap (ON-095) |
| D4 originating_scene_post_id NO ACTION would block a future Scene purge | LOW | FIXED: ON DELETE SET NULL (ON-096) |
| D5 races in addItem answered 500 | LOW | FIXED: 404 (ON-097) |
| D6 no per-Account cap or rate limit; reads that create DEFAULT | LOW | Founder decision (ON-088) |

Point by point (reviewer's verdicts, after the fixes): IDOR, cross-account access, forged targets, guest
persistence, PRIVATE Scene leakage, historical revisions, Seller suspension, deleted Products, account
deletion (function diff = exactly one DELETE), session-switch cache, return-to and deep links, unauthorized
access, SQL injection (every value bound; `sql.ref` on constants only), cursor tampering, logging,
ownership and FK constraints -- all fine. Keyset tuples match their ORDER BY; DISTINCT ON + outer keyset
never duplicates; the D-69 idempotency invariant holds (every refusal is the same 404, rolled back alike).

## 19. Performance

Measured with EXPLAIN ANALYZE on the disposable database: one synthetic Account, DEFAULT + 19 named
Collections, every fixture Product in each (740 memberships), rolled back afterwards.

| Query | Execution |
|---|---|
| `GET /v1/collections` (50 per page with both counts) | 1.5 ms (counts via `uq_collection_item_product` / `idx_collection_item_scene`) |
| `GET /v1/collections/{ref}` page of 30 | 0.05 ms (`idx_collection_item_recent`) |
| `GET /v1/collections/saves` (DISTINCT ON over all 740) | 0.6 ms |
| `saved-state:batch` for 60 Products | 0.7 ms (`idx_collection_item_product`) |

- One statement per target type per page for item resolution (Products with their first card image in a
  correlated subquery, Scenes through the view); no per-item query; no per-card request on any list.
- Recent Saves grows with an Account's total memberships (DISTINCT ON before the page); uncapped storage
  is ON-088. saved-state starts from the Product index across Accounts: watch it if a Product is saved by
  very many Buyers.
- Mobile: virtualised FlashList, card image derivatives, gcTime 0 lists, refresh on focus, one Save
  request at a time.
- Not measured: p95/p99 under load; production-scale data.

## 20. Remaining issues

- **Founder decisions:** retention for a Buyer-deleted Collection (ON-20261111-087); name and batch bounds,
  any cap or rate limit (ON-088); tombstone after a Seller's hard delete (ON-090); Market-specific
  unavailable text (ON-091).
- **Contract:** no dedicated code for DEFAULT rename/delete (ON-089).
- **Deferred by design:** card-level Save on Shop / Search / Seller Profile / For You (ON-092); public,
  shared, collaborative or ordered Collections; restock alerts; Collection analytics and recommendation
  signals (SRC-01 S24 needs privacy approval).
- **Environment:** drive C: capacity (ON-100); bounded Jest workers on this machine (ON-085).
- **Unchanged and still pending:** ON-079 (Search launch settings) and ON-080 (Search analytics) -- not
  approved by this work order; payment architecture deferred; public Reviews fail closed; production For
  You disabled. Amharic strings are machine-translated placeholders (MT-KEYS).

## 21. Recommended next work order

Card-level Save on the Shop, Search and Seller Profile grids (one `saved-state:batch` per visible page;
ON-092) is a small, contained follow-up. The larger next Mobile work order remains the Catalogue category
taxonomy (ON-20261111-049) once the founder approves it, or Buyer account controls (ADU-PRV-01 R-11: Edit
Profile, Appearance, Delete Account on the existing deletion function). Not started.
