# WO-007B -- Available-First Seller Catalogue

Status: COMPLETE

## 1. Starting and final SHAs

- Started from `mobile/wo-007a-discovery-stabilization` at `022bbfea6fe6c50cff7a34fc5a073c29afb2bb02`
  (verified equal to `origin`, clean tree).
- Branch `mobile/wo-007b-available-first`. The final pushed HEAD is the commit that adds this record;
  `git ls-remote origin mobile/wo-007b-available-first` prints it, and the WO-008 record names it as
  its base.

## 2. Founder decisions (11 November 2026, second set)

| Register | Decision | What this work order did |
|---|---|---|
| ON-20261111-026 | APPROVED option A: two-phase pagination (available, then unavailable), no snapshot storage; controlled duplication under concurrent stock changes, de-duplicated by stable Product identity on mobile; a Product changing group mid-browse may appear only after refresh | Implemented (this record) |
| ON-20261111-056 | APPROVED FOR FUTURE IMPLEMENTATION: an upheld Claim trigger alone is not Seller fault; the future Claims system records an explicit, authoritative Seller-fault determination with evidence and correction history, and Reviews use it | Recorded only (no Claims or Reviews work) |
| ON-20261111-057 | APPROVED FOR FUTURE IMPLEMENTATION: Review eligibility evaluates Seller ownership/team conflicts at Order creation and at Review submission, recording the relationship then; later membership or ownership changes do not rewrite the original determination; authorised fraud/moderation corrections remain possible | Recorded only |
| Payment architecture | DEFERRED: no decision on a payment gateway. No provider, gateway, WO-PAY-001, payment verification or workflow change, no Checkout, no public Reviews, no weakening of payment or Review gates, nothing new on the Seller-confirmed screenshot model | Nothing payment-related touched; `core.fn_order_payment_verified` still answers `false`, so no Review is public (the WO-007A fail-closed state) |

## 3. Architecture

`GET /v1/storefronts/{handle}/products` orders by

```
phase (0 = available, 1 = unavailable)  ->  display_order  ->  created_at  ->  slug
```

- **Availability authority:** the public projection (`apps/api/src/modules/catalogue/public-projection.ts`,
  `productAvailable` over `publicPrice`), the same expression the item already carries as
  `available`. The phase is that value, so a tile's label and its group never disagree within a page.
- **One statement per page:** the Seller's PUBLISHED Products with their price span and phase in a
  subquery, then the keyset `(phase, display_order, created_at, slug) > cursor`, `ORDER BY` the same
  tuple, `LIMIT n + 1`. The phase boundary is crossed inside one snapshot, at any page size.
- **Images:** the first image's card key for the page's rows only, one bounded statement (`DISTINCT ON`).
  No N+1.
- **No storage:** no snapshot, session or retention rule.

## 4. API change

- Ordering changed as above (MOB-02 R-09: "Products show the catalogue with available first").
  Response shape unchanged (`id, slug, name`, prices, `available`, `display_order`, `image_key`).
- **Cursor:** `[phase, display_order, created_at, slug]`, validated by `common/http/cursor.ts` with a new
  strict `bit` part (exactly 0 or 1). Anything else, including the WO-006 three-part cursor, is 400
  `VALIDATION_FAILED` reason `CURSOR_INVALID`. A cursor only positions within the Seller the handle
  resolves to in the requester's Market, so it cannot reach another Seller's or Market's Products.
- `limit` 1-100 (default 100), `no-store`, end marker `next_cursor: null` -- unchanged.
- Contract regenerated (description only), byte-identical twice.
- `GET /v1/shop/products` is untouched: Newest first (ON-20261111-050).

## 5. The accepted eventual-consistency limit (ON-20261111-026, option A)

Availability is read per page and nothing is stored, so while a Buyer pages:

| Change mid-browse | What the Buyer sees | Why it is safe |
|---|---|---|
| Available -> unavailable, after it was shown | It is sent again in the unavailable group; the app shows it once (keyed by Product id), keeping the tile already on screen | Never a purchase decision: Product Detail re-reads availability and price on every opening |
| Unavailable -> available, behind the cursor | Not shown again in this browse; present in its available place after a pull or a return to the tab (the tab already re-reads on return from a Product) | The list stays navigable; nothing is lost on refresh |
| Unavailable -> available, ahead of the cursor | Shown in the available group when reached | -- |
| Unpublished mid-browse | Absent from later pages and from a refresh | -- |

## 6. Database changes

None. No migration, index or grant. Measured on the disposable database with a 1,000-Product Seller
(rolled back): 2.7 ms execution, 0.7 ms planning; the Seller's Products by index, one indexed
Variant lookup each, a top-N heapsort for the page (31 kB). The cost per page is linear in the
Seller's catalogue, not in the Market; a NEW-level Seller has at most 10 Products.

## 7. Mobile changes

- The Seller Profile Products tab keys and de-duplicates by Product **id** (it used the slug): a
  Product sent again in the other group is one tile. Everything else is the WO-006 list (cards, price
  spans, availability words, navigation, pull, background revalidation, Market isolation).
- The fake API gives each test Product its own id (`productIdFor`).

## 8. Tests

- API `test/wo-007b-available-first.e2e.spec.ts` (11 tests, the work order's cases): all available;
  all unavailable; mixed at page sizes 1, 3, 5, 7 and 100; 130 Products with repeated display orders
  and one created_at (slug tiebreak), pages of 100 + 30, then the end marker, limits 0 and 101 refused;
  available -> unavailable after it was sent (sent twice, once per group; de-duplicated, every Product
  once); unavailable -> available behind the cursor (absent from this browse, present after refresh in
  the right place); malformed cursors (the WO-006 shape, phase 2, a boolean, an impossible date, int
  overflow, a bad slug); the same handle in another Market and a cursor replayed across Markets;
  unpublishing mid-browse; the unchanged response shape; the Shop still newest first.
- Mobile `seller-profile.test.tsx` (17): server order kept, a repeat across groups shown once, a pull
  reconciles. Seller Profile navigation is covered by the existing tests.
- Related suites: wo-007b, wo-007a, wo-007, wo-006, cat-001a, cat-001, disc-001, c2, t6-product-slug,
  c8 -- 179/179. Mobile 232/232. API and mobile typecheck PASS.

## 9. Native validation (Android emulator; iOS NOT validated)

Real local API on the disposable database, WO-CAT-001/006/007 fixtures. API (curl): Fixture Weaves
lists `Woven basket | Clay cup | Coffee tray | Cotton scarf (unavailable)`, no next page (it was
basket, scarf, cup, tray).

| Flow | Result |
|---|---|
| `seller-profile.yaml`, now asserting the out-of-stock scarf sits below the Clay cup (available first, two columns) | PASS |
| `shop.yaml` (Shop regression, newest first) | PASS |
| `catalogue-product-1.yaml` (Product Detail regression) | PASS |

## 10. Security review

Self-review (the WO-008 independent review covers this branch too): one parameterised statement, no
string-built SQL; cursor shape strictly validated before SQL (`bit`, int4 bound, real instant, slug
pattern); the Seller is resolved Market-scoped before the cursor applies; public fields only;
`no-store`; no new write path, storage or tracking. No Critical or High.

## 11. Remaining issues and deferred functionality

- The accepted limit of S5 (documented, by founder decision).
- ON-20261111-056 and -057: recorded for the future Claims and Reviews work orders.
- Payment architecture and public Reviews: deferred by the founder; unchanged.

## 12. Next

WO-008 Marketplace Search, from this branch's pushed HEAD.
