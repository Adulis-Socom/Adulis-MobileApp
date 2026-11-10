# WO-005 - Explore the Scene and Product tag navigation

Status: **complete -- Scene exploration ready**, with hotspots honestly blocked (no geometry) and four
founder decisions recorded (section 25). Branch `mobile/wo-005-scene-explorer`, pushed; no pull
request, no merge, `main` untouched. The register is
`docs/overnight/OVERNIGHT-ISSUES-2026-11-10.md` (OVN-011 resolved; OVN-072 onward new).

The Buyer journey this delivers, on real backend resources only (no runtime mock, no Checkout,
no Order):

```text
For You -> the Scene photo, or "Explore the Scene" -> /scenes/{scenePostRef}
        -> choose a tagged Product -> View Product -> /product/{handle}/{slug}
        <- Back (Explorer revalidated, selection kept) <- Back (For You as it was)
```

## 1. Starting SHA

`4d54624` (the WO-DISC-002A head: `docs(discovery): close the For You contracts and prepare
founder decisions`), clean tree, equal to its origin branch.

## 2. Branch

`mobile/wo-005-scene-explorer`, created from `4d54624`. Only this branch is pushed.

## 3. Design documents reviewed

| Source | What it governs here |
|---|---|
| ADU-MOB-02 v4.3 (S11 R-03/R-05/R-06, :198 route tree, :296 Explore regions, :298 PRIVATE handling, :524 Product detail fields, S78 query keys, :1901/:1915/:1919 visibility, :2370 "Currently unavailable") | Buyer UX authority for the Explorer and Product detail |
| ADU-SCN-01 v3.2 (S22/S24 hotspots via MediaPresentation, :325 accessible tagged list, :658 availability in text) | Scene domain, tags, public read |
| ADU-CATINV-01 v3.3 (:140 Scenes reference commerce truth, :364 price at Variant level, :496 per-Variant availability) | Price and availability authority |
| ADU-DB-01 v1.21 (C1 / :1665 `base_price_minor` is a seed, not a price) | Why no screen shows the base price |
| ADU-STOREFRONT-02 v4.2, ADU-MEDIA-01 v3.1, ADU-API-01 v1.11, ADU-AUTH-02 v3.3 | Product route, media derivatives, envelopes, public reads |
| Prototype `src/sections/MobileBuyer.tsx` (`SceneExplorer`, `ScenePreview`, `ShoppablePostUnit`), `docs/ADULIS_CANONICAL_RULES.md` R-06 | Composition, selection semantics, copy |

## 4. Existing API audit

| Endpoint | Before WO-005 | Sufficient? | Action |
|---|---|---|---|
| `GET /v1/scene-posts/{publicRef}` (DISC-001) | Public, `no-store`, one indistinguishable 404 for unknown/PRIVATE/unpublished/malformed; reads `core.v_scene_post_public`; tags in position order with `available`; `image_key` per tag; **price = `base_price_minor`** | Yes, except the price | Additive Variant price span (section 7, OVN-072) |
| `GET /v1/storefronts/{handle}/products/{slug}` | Public; **no response schema** (the generated client had no type); filtered on `published_at IS NOT NULL` (OVN-011); no `available`, no Seller | No | Typed DTO, `available`, `seller`, `no-store`, visibility filter (section 8) |
| Storefront list, search, post-link resolve | Same `published_at` filter | No (OVN-011) | Visibility filter |
| Hotspot geometry, image dimensions | None in any table or response | - | Hotspots blocked (section 10, OVN-006) |
| Related Scenes | No endpoint | - | Deferred (OVN-079) |
| Buyer Market on the Product read | None | Gap (OVN-016) | Recorded, unchanged |

## 5. Navigation architecture

- Routes, inside the Buyer stack (`src/app/(buyer)/_layout.tsx`, anchored on `(tabs)` so a cold
  link has Home under it):
  - `scenes/[scenePostRef].tsx` -> `/scenes/{public_ref}` (ADU-MOB-02 :198). The public
    reference only; no internal id is ever a segment.
  - `product/[handle]/[slug].tsx` -> `/product/{handle}/{slug}`. TECHNICAL ROUTING DECISION:
    MOB-02 names `product/[productRef]`, but no product reference exists in any contract; the
    public read addresses a Product by Seller handle and slug, so the route mirrors it (MOB-02 S78
    already keys the query `["product", sellerHandle, slug]`). Conflict recorded (OVN-080).
- Both screens use `dangerouslySingular` keyed by their parameters: a double tap cannot stack the
  same Scene or Product twice.
- Entry points on the For You card (`SceneCard.tsx`): the labelled **Explore the Scene** button
  (its own screen-reader stop) and the photo (a touch shortcut to the same action, no extra stop).
  The card stays a summary; it is never the Explorer's authority.
- Back from the Explorer returns to For You as it was: the feed stays mounted under the stack, so
  no new feed session starts (tested: one `/v1/fyp` call).

## 6. Scene Explorer implementation

`src/buyer/SceneExplorer.tsx`, from top to bottom (prototype `SceneExplorer`, reimplemented for a
vertical phone layout and large text):

1. Header "Explore the Scene" (native stack header, Back).
2. Seller: store name and `@handle`. No trust badge, rating or level is shown: the Scene read
   carries none, and none is invented.
3. The Scene photo (`card_key`) at its own proportions: Expo Image `contentFit="contain"`, the
   frame's aspect ratio taken from the decoded image (`onLoad`), clamped to 0.5-2 so a strip still
   gets a usable frame; the feed's 4:5 until it loads. Never cropped, never stretched. A failure
   shows "Photo unavailable" and is retried when a new answer arrives.
4. The whole caption.
5. "Products in this Scene": every tagged Product in the server's order, numbered 1..n, each
   with its name, its current price (section 11) and, when unavailable, "Currently unavailable" in
   words. A radio group: one Product selected at a time, announced as checked. Until one is
   chosen: "Choose a Product to preview it."
6. The selected Product previews in place: its photo beside **View Product**, which opens the
   Product and orders nothing. An unavailable Product stays listed and viewable.

No Like, Save, Share, Reviews, Follow, More, Report, Cart or purchase control is drawn (R-05
actions other than Explore have no backend; OVN-033/051).

## 7. Scene read contract

`GET /v1/scene-posts/{publicRef}` is the Explorer's only authority. Additive change (commit
`61310ae`), no other change to the Scene domain or its publication rules:

| Field (per tagged Product) | Meaning |
|---|---|
| `price_min_minor`, `price_max_minor` | Lowest and highest current price among the Product's ACTIVE Variants, integer minor units, read in the same query (`CROSS JOIN LATERAL`), so still one request per Explorer and no per-Product read. Null: no ACTIVE Variant |
| `price_currency` | The Variants' currency |
| `base_price_minor` (unchanged) | Kept for compatibility; now described as the creation seed it is (DB-01 C1). No screen reads it |

The mobile type is `PublicScene = Json<paths['/v1/scene-posts/{publicRef}']['get']['responses'][200]>`.

## 8. Product read contract

`GET /v1/storefronts/{handle}/products/{slug}` (commits `4684dd2`, `c2f119e`, `61310ae`):

- Typed: `StorefrontProductDto` (and Seller, Variant, Attribute, Image DTOs), so the generated
  client finally has a type. Money is integer minor units (`Number(...)` of the bigint columns).
- `available`: Product PUBLISHED, an ACTIVE Variant in stock (`core.v_scene_product_availability`)
  AND the Seller ACTIVE -- the gates `fn_create_order` applies. A CLOSING or BILLING_SUSPENDED
  storefront stays visible but its Products read unavailable (security review L2 / code review).
- `seller {handle, store_name}`; `Cache-Control: no-store` (set before any query, so the 404 has
  it too).
- Public reads (detail, list, search, post-link resolve) filter on `visibility = 'PUBLISHED'`
  instead of `published_at IS NOT NULL` (OVN-011: `fn_unpublish_product` keeps `published_at`).
- Internal ids (`id`, `category_id`, Variant `id`) remain in the body for future Cart lines; none is
  ever a URL segment (security review point 3).

## 9. Product selection behavior

- Selection is by slug and lives in the Explorer screen, above its content: it survives a
  revalidation that reorders, a withheld (background) revalidation, a failed one followed by a
  retry, and the round trip to the Product; it goes if its Product leaves the Scene.
- The radio's label is a whole-sentence template: "1. Woven basket, ETB 900.00 – ETB 1,200.00",
  "2. Cotton scarf, ETB 450.50, currently unavailable", "2. Old lamp, currently unavailable" (no
  ACTIVE Variant, so no price).
- With no hotspots, the list is the whole selection surface (R-06: "a complete tagged list with
  synchronized selection"). The selection model is the one a hotspot layer would share.

## 10. Hotspot availability and implementation status

**NOT IMPLEMENTED -- BLOCKED.** No authoritative geometry exists: `core.scene_post_product` holds
`revision_id, seller_id, product_id, position, created_at` only; there is no MediaPresentation
(SCN-01 S22/S24, MEDIA-01 S429) and no image dimensions in any response. No coordinate is drawn,
guessed or placed illustratively (the prototype's own placement is illustrative). Tested: no
hotspot element renders; the numbered list is complete, selectable and navigable. OVN-006 stays
DEFERRED.

## 11. Current price/availability handling

- Price lives on the Variant (CATINV-01 :364). The Explorer shows the Scene read's span: one amount
  when every ACTIVE Variant costs the same, otherwise "min – max" (`buyer.price.range`). Product
  detail derives the same from its Variants and lists each option with its own price. No screen
  shows `base_price_minor` (DB-01 C1); with the fixture's 1,000.00 seed and 900.00/1,200.00 Variants
  the screens show "ETB 900.00 – ETB 1,200.00" (tested and native).
- PRESENTATION DECISION FOR THE FOUNDER (OVN-072): the "min – max" span is a technical choice where
  the documents give price per Variant but no list presentation.
- Availability is the server's: the Scene read's `available`, the Product read's `available`. Per
  option, the client shows available only when the option is in stock AND the Product is available
  (never more than the Product); a per-Variant server flag does not exist (OVN-074).
- Unavailable: "Currently unavailable" in words (not colour alone), no purchase action anywhere.
- Money: `Intl.NumberFormat(locale, {style: 'currency'})` over minor units divided by the
  currency's own fraction digits (ETB 2); never formatted by the server.

## 12. Public visibility enforcement

- The server decides: a PRIVATE, unpublished, removed, unknown or malformed Scene is one bare 404;
  an unpublished/DRAFT Product is a 404 on every public read (OVN-011 fixed and tested).
- The client shows content only while the latest answer is a success. A 404 at any point (opening,
  pull, return from a Product, background return) shows only "This Scene is no longer available."
  (or "This Product is no longer available.") with **Go back** (Home when nothing is under it). No
  reason is disclosed and nothing from the earlier answer stays on screen (tested, and native).
- Both reads are public: the bearer is never sent, signed in or not (tested).
- Route parameters are validated before they become request paths (`isPublicRef`: the server's
  22-character base64url `PUBLIC_REF_RE`; `isPathName`: the handle/slug alphabet), and the API
  client itself refuses an empty, `.` or `..` path value and URL-encodes the rest.

## 13. Background/foreground revalidation

One policy, reused: the WO-DISC-002A listener became `useForegroundRevalidation` (commit
`1e2bc39`, no behaviour change for the feed) and serves the feed, the Explorer and the Product.

| Moment | Explorer | Product |
|---|---|---|
| First open | Reads (new query, `gcTime 0`) | Reads |
| Return from the background after the interval (development 5 min, release 0 = every return; OVN-055 pending) | New generation: content WITHHELD until the server answers | Same |
| Return from Product detail | Revalidates keeping content; joins a request already in flight | - |
| Pull | Revalidates keeping content; the spinner shows for pulls only | Same |
| Late answer | Lands in its own resource and generation key, never another Scene or generation (tested both) | Same |
| Offline | Nothing to show yet: "You are offline..." and it loads on reconnect; a revalidation waiting for the network keeps the last success on screen (OVN-066 context) | Same |

## 14. Deep-link behavior

`adulis://scenes/{public_ref}` cold-launches into the Explorer with Home under it (Back returns to
For You). A malformed reference (`adulis://scenes/not-a-scene-reference`, `/scenes/..%2Fadmin`)
sends no request and shows the neutral message. `/product/{handle}/{slug}` likewise; a malformed
handle or slug sends nothing.

## 15. Product-detail implementation

`src/buyer/ProductDetail.tsx`, bounded: photos (paged, square frame, `contain`, "Photo i of n of
{name}"), name (header), current price (section 11), availability in words, "Sold by {store}",
description, Options (each Variant: key, price, availability). Loading, offline, error-with-retry
and gone states (`ReadStates.tsx`).

Deferred and not drawn: Cart, Checkout, Save, Ask Seller, reviews and composer, share, related
Scenes, the Seller profile. **Attributes are not shown**: the read carries attribute and option
codes, not catalogue labels, the mobile catalogue has no labels for them, and no attribute
definition is seeded -- a code is not Buyer copy (OVN-075).

## 16. Performance measurements

| Measure | Result |
|---|---|
| Requests to open the Explorer | 1 (`GET /v1/scene-posts/{ref}`); 0 per-Product reads (tested) |
| Requests to open a Product | 1 |
| Scene read, local stack (3 tags) | 1,597 B; 11-18 ms over five calls |
| Product read, local stack (2 Variants, 1 image) | 1,035 B; 17-41 ms over five calls |
| Media | `card_key` derivatives from the public bucket, Expo Image disk cache (public media only) |
| Lists | The tagged list is bounded and rendered directly; no virtualised list needed |

## 17. Accessibility results

- Every control has a role and a label; the Product list is a radio group with checked state; the
  selected preview's action is a labelled button; availability is spoken and written in words.
- The card keeps one summary stop plus the Explore button; the photo shortcut adds no stop.
- Large text (font scale 1.3, native): wraps, nothing clipped (section 23). Dark mode: every role
  follows the theme (native). Touch targets >= the token minimum.
- Content ends above the system navigation bar (bottom inset).

## 18. Localization

New keys in `@adulis/locale/mobile`, English and Amharic (machine-translated placeholders,
`MT-KEYS.md` regenerated, 865 + 3 HUMAN-REQUIRED): `buyer.scene.*` (explore, loading, gone,
go_back, seller, photo, photo_unavailable, products, no_products, choose, product,
product_unavailable, product_no_price), `buyer.product.*` (title, view, loading, gone, available,
unavailable, seller, photo, description, options, option), `buyer.price.range`. Whole-sentence
templates with named slots; no fragment concatenation. Parity enforced by the package's compile
gate and tests.

## 19. API-client changes

Regenerated twice from the API (`2acceac`, `7b3f7f4`); byte-deterministic (`generate:check`).
`schema.d.ts` gains the Product read DTOs and the three Scene price fields. Mobile adds
`api.scene(publicRef)` and `api.product(handle, slug)` (no bearer) and path-parameter support in
`call()`.

## 20. Backend changes

Additive and regression-tested; no migration, no change to Scene publication, no second Scene
domain, no Seller Console change:

| Commit | Change | Tests |
|---|---|---|
| `4684dd2` | Public Product reads follow `visibility` (OVN-011) | c8: unpublish through `fn_unpublish_product`, `published_at` survives, detail 404 (no-store), list/search/resolve empty |
| `c2f119e` | Typed Product read; `available`; `seller`; `no-store` | c8 typed-read test |
| `61310ae` | Scene read Variant price span; Product `available` needs an ACTIVE Seller | disc-001 price span (re-priced and second Variant); c8 CLOSING Seller |

## 21. Security review

Independent review of `4d54624..HEAD` against the 14 required points. **No Critical or High.**

| # | Point | Verdict |
|---|---|---|
| 1 | Private Scene disclosure | OK: one bare 404; no content, reason or timing difference; the app shows one neutral sentence |
| 2 | Unpublished Product exposure | OK after OVN-011: every public read filters on visibility |
| 3 | Internal UUID leakage | OK for routes; ids remain in bodies (deliberate); INFO: Product media keys embed the Product UUID (pre-existing, OVN-076) |
| 4 | Unsafe dynamic route parameters | OK; LOW L3 (client did not itself refuse dot segments) FIXED |
| 5 | Malicious media origins | OK: `mediaUrl` origin/key validation reused; https only in release |
| 6/7 | Stale content after navigation / background return | OK: success-only display, generation keys, withhold on stale return, 404 clears |
| 8 | Unauthorized Product reads | Public by design; Market not checked (OVN-016, not worsened); handle not Market-scoped (OVN-077) |
| 9 | Guest/account separation | OK: public reads never carry the bearer |
| 10 | Broken deep links | OK: validated, neutral, Home underneath |
| 11 | Cached sensitive data | OK: `gcTime 0`, in memory only; public media only on disk |
| 12 | Session-token logging | OK: nothing logged |
| 13 | Purchase safety | OK: no path to Cart/Order; LOW L2 (`available` ignored Seller status) FIXED |
| 14 | Tests | Prove the core claims; gaps (generation late answer, bare `..`) closed |

Also LOW L1: `product_viewed` is emitted on every Product read, so pulls and background
revalidations add views (OVN-073, founder decision). The independent code review found one High
(the base price shown as the price) -- FIXED by section 7/11 -- and Medium/Low items, all fixed
or registered: per-option availability, selection lost on withhold, bottom inset, programmatic
spinner, failed photos never retried, two weak tests (fixed); handle Market scoping (OVN-077).

## 22. Test results

Mobile: 193 tests in 13 suites (WO-DISC-002A: 156). New: `scene-explorer.test.tsx` (32, the S43-S48
matrices on the real route tree against the fake API), `public-read.test.ts` (route validation,
gone), client and i18n additions. API: c8 and disc-001 additions (57/57 for the two suites on the
disposable database).

S50 automated validation, on a freshly rebuilt disposable database (`adulis_gates`):

| Gate | Result |
|---|---|
| `pnpm --filter @adulis/api test` | 810/810 (806 at WO-DISC-002A) |
| Scene + For You + Product suites (disc-001, disc-002, c8, fyp unit) | 125/125 |
| `@adulis/api-client` test / `generate:check` | PASS / PASS (byte-identical, so OpenAPI generation is deterministic) |
| `@adulis/mobile` typecheck / test / build (`expo export`) | PASS / 193/193 / PASS |
| `pnpm typecheck` / `lint` / `build` | PASS |
| `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS |
| `db:check` / `db:determinism` | 16/16 / PASS |
| `pnpm test` (all packages) | PASS (API 810/810, mobile 193/193) |
| `verify:orphan-sweep` | PASS |
| Expo Doctor | 20/20 |
| Existing Maestro flows | PASS: buyer-for-you (twelve-Scene WO-004A fixtures), buyer-auth-verify-link (no SMS sent), buyer-auth-request + leave-verify, buyer-auth-request + verify, buyer-shell |
| New Maestro flows | PASS (section 23) |

| Matrix | Covered by |
|---|---|
| S43 navigation | button, photo, double tap (hidden screens counted), public-ref route, guest and signed-in, Back preserves For You, another Scene with its own data, cold link, malformed refs |
| S44 detail | load, caption, Seller, image source and failure fallback with retry, order, mixed availability, unknown/PRIVATE 404, no stale content after 404, late answers (cross-Scene and cross-generation) |
| S45 exploration | single selection, correct tag, public facts, unavailable label, no purchase, handle+slug, real read, price and availability after refetch, unpublished not exposed (API), no Order |
| S46 hotspots | none fabricated; list usable; selection; View Product |
| S47 lifecycle | background interval, PRIVATE while away (withhold then 404), Product revalidated too, return from Product, offline, sign-in and sign-out do not disturb navigation |
| S48 regression | the For You, shell, auth and i18n suites unchanged and green |

## 23. Native validation

Android emulator `Adulis_Pixel_8a_API_37` (API 37, x86_64), the debug build (native dependencies
unchanged since the 9 November build, so that APK was reinstalled and Metro served this branch's
JS), the real local API (`NODE_ENV=development`) on the DISPOSABLE `adulis_gates` database, local
MinIO for media. **iOS was not validated** (no macOS hardware; not claimed).

Fixtures (`wo005-fixtures.mjs`, development-only, removed afterwards): Seller "Fixture Weaves"
(`fixture-weaves`, the Seller and its console session as rows); through the Seller API: four
Products (Woven basket: Small 900.00 x3, Large 1,200.00 x0, base seed 1,000.00; Cotton scarf
450.50 x0; Clay cup 350.00 x4; Coffee tray 1,500.00 x2), each with a WebP image (presigned PUT +
COMMIT), Variants and stock (StockEvents), and two Scenes (image upload, draft, publish): "Morning
light on the new baskets..." tagging basket, scarf, cup; "Coffee tray and scarf..." tagging tray,
scarf. Product publication through the API was refused for Seller readiness (eligibility, store
profile, payout, fulfilment: outside WO-005), so the fixture applied exactly `fn_publish_product`'s
two writes on the disposable database (OVN-083). Stock changes during the run went through
`POST /v1/seller/variants/{id}/stock`; the Scene visibility changes were the server's own.

| S49 step | How | Result |
|---|---|---|
| 1 Open as guest | `buyer-scene-explorer` (clear state, no sign-in) | PASS |
| 2 For You | same | PASS: real Scenes, the card's Explore the Scene below the tags |
| 3 Open a real Scene | same: the button, then the photo shortcut | PASS (both) |
| 4 Image and caption | same | PASS: the 800x600 photo at 4:3, never cropped; the whole caption the card truncates |
| 5 Select a tagged Product | same | PASS: radio checked, the other unchecked; preview photo beside View Product |
| 6 Product detail | same | PASS: "ETB 900.00 – ETB 1,200.00" (not the 1,000.00 seed), Available, Sold by, description, options with their own prices and availability; no purchase action |
| 7 Back to the Scene | same | PASS: revalidated, the selection kept |
| 8 Back to For You | same | PASS |
| 9 Navigation context | same | PASS: the same card, the feed not restarted |
| 10 One tagged Product unavailable | Clay cup stock 0 via the Seller API (Scene stays PUBLIC: basket available) | PASS |
| 11 Its unavailable state | pull in the open Explorer | PASS: "3. Clay cup, ETB 350.00, currently unavailable" |
| 12 Every tagged Product unavailable | Coffee tray stock 0 (scarf already 0) | PASS: the server made the Scene PRIVATE; public read 404 |
| 13 Scene PRIVATE | database visibility read by the script; For You no longer lists it | PASS |
| 14 The old Scene link | cold `adulis://scenes/{ref}` | PASS |
| 15 Safe unavailable handling | same; also `private-1/2` (PRIVATE while its Product was open: Back shows the message) and `background-1/2` (PRIVATE while the app was away 5 min 31 s: withheld, then the message) | PASS (all three): only "This Scene is no longer available." and Go back, nothing of the Scene |
| 16 Restore stock | tray stock 2 via the Seller API | PASS: the server made the Scene PUBLIC; public read 200 |
| 17 Visibility restored | the same link, cold | PASS: the Scene and its Products again |
| 18 Dark mode | `buyer-scene-explorer-dark` at font scale 1.0 | PASS |
| 19 Enlarged text | the same at font scale 1.3 | PASS on the second run: the first stopped because the You tab did not open right after the font-scale change (a flow timing issue, not a render defect); the flow now retries that tap. Text wraps, nothing clips |
| 20 Authentication regression | `buyer-auth-request` + `buyer-auth-verify` (sign-in, restore, sign-out); `buyer-shell` | PASS |
| Links | `buyer-scene-explorer-link`: cold link with Home under it; malformed reference | PASS |

Flows committed in `apps/mobile/.maestro/`: `buyer-scene-explorer.yaml`,
`buyer-scene-explorer-private-1/2.yaml`, `buyer-scene-explorer-background-1/2.yaml`,
`buyer-scene-explorer-link.yaml`, `buyer-scene-explorer-dark.yaml`; `buyer-for-you.yaml` updated
(it asserted the card had no action). Steps 10-17 used run-specific inline flows (state changes
between them). Screenshots and logs: scratchpad `maestro-005*`.

Observed on the device and not only in tests: the Variant span "ETB 900.00 – ETB 1,200.00" in
the Explorer and on the Product (never the 1,000.00 seed); "Large, ETB 1,200.00, Currently
unavailable" beside "Small, ETB 900.00, Available"; the selected preview's photo beside View
Product; the landscape Scene photo at its own 4:3 proportions; the neutral gone screen with Go
back.

Cleanup: fixture media prefixes removed from MinIO (`wo005-cleanup.sh`), then `adulis_gates`
rebuilt from nothing by the gate run. The developer database `adulis` was never touched.

## 24. Deferred features

Hotspots (blocked, OVN-006); related Scenes (no contract, OVN-079); attributes display (OVN-075);
Seller profile from the Explorer; every other R-05 action (Like, Save, Share, Reviews, Follow,
More/Report -- OVN-033/051/068); Cart, Checkout, Orders; a SCENE/DETAIL media derivative (OVN-078);
iOS validation (not performed).

## 25. Remaining blockers

None for this work order's scope. Founder decisions it leaves open: OVN-072 (price-span
presentation), OVN-073 (view counting on revalidation), OVN-055 (interval, already pending), and
the route-naming conflict OVN-080. The nine WO-DISC-002A founder decisions remain PENDING; this
work order approves none of them.

## 26. Recommended next work order

A Catalogue public-read closure: storefront list/search prices from Variants (DSC-10), per-Variant
availability in the contract, attribute labels, Market scoping of handles and the Product read
(OVN-016/077), and de-duplicated `product_viewed`. Then the Scene media/hotspot foundation
(MediaPresentation + a DETAIL derivative) before hotspots are built.
