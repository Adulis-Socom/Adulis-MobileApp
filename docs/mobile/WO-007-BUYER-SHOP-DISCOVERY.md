# WO-007 -- Buyer Shop Discovery

Status: COMPLETE (category and module scope and the Shop order recorded for the founder)

## 1. Baseline

- Branched from WO-006's pushed HEAD `bce772bc435b8093ed449f57b1cbe317c97a2954`
  (`mobile/wo-006-buyer-seller-profile`); branch `mobile/wo-007-buyer-shop-discovery`.
- Issues: `docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md` (ON-20261111-042 to -052).

## 2. Documents reviewed

ADU-MOB-02 v4.3 (S42 Home vs Shop, S170-S174 bottom navigation, S198 routes, S32 Shop, S33
Search, S383 approved modules only, S1901 unavailable labels, S2032 E2E, S2264), ADU-DB-01 v1.22
(Products, publication, `fn_publish_product`), the WO-CAT-001 public projection, the WO-006
record (lists, cursors, Market-scoped identity), the prototype's Buyer Shop (read only).

## 3. What MOB-02 S32 asks for, and what was built

MOB-02 S32: the Shop "serves buyers who arrive with explicit intent rather than wanting
algorithmic discovery" and contains Search, Categories (Fashion, Cosmetics, Electronics), Nearby,
New Drops, Market-configured Locally Made and price-led modules, "according to enabled
configuration".

| S32 item | Built | Why |
|---|---|---|
| Market-wide Product browsing | YES: one list of the Buyer's Market's PUBLISHED Products | the core of S32 that real data supports |
| Search | NO (no entry in the Shop) | Marketplace Search is its own work order (batch boundary); nothing Seller-scoped is labelled as Search |
| Categories | NO | `core.category` holds only `id, parent_id, code` -- no Buyer labels, no locale strings, one seed row; categories are never fabricated (ON-20261111-049, founder) |
| Nearby | NO | no Nearby tracking (batch boundary) |
| New Drops / price-led / Locally Made modules | NO | no rule defines their membership (ON-20261111-049, founder) |

The one list has one deterministic order, **newest first publication** (`published_at DESC, id
DESC`), labelled "Newest first" on screen: no ranking, personalisation, promotion or paid
placement, and production For You stays disabled. Republishing keeps the first `published_at`
(`fn_publish_product`: `coalesce(published_at, now())`), so unpublish/republish cannot bump a
Product to the top. The order is provisional (ON-20261111-050, founder).

## 4. API

`GET /v1/shop/products` (public, `no-store`, `storefront.controller.ts`):

- Market: `requesterMarket()` (the Account's Market when signed in, else the registered device's;
  ACTIVE Markets only). With no Market evidence the answer is an empty page -- never another
  Market's Products.
- Rows: `p.market_id = <market> AND visibility = 'PUBLISHED' AND published_at IS NOT NULL`, the
  Seller in the publicly visible states (ACTIVE, CLOSING, BILLING_SUSPENDED -- the same constant as
  Storefront and Product Detail), the Market ACTIVE. Unavailable Products stay, `available=false`.
- Each item: the shared public summary (`id, slug, name`, base price, the projection's price span
  and currency, `available`) plus `seller {handle, store_name}` and `image_key` (first image's card
  derivative, as on the Seller Profile).
- Keyset cursor `(published_at at microseconds, id)`, validated by `common/http/cursor.ts` (400
  `VALIDATION_FAILED` reason `CURSOR_INVALID`); `limit` 1-50, default 30. The id tiebreak is
  already in every row (ON-20261111-051).
- Index: migration `0057_shop_browsing_index.sql`, `idx_product_shop ON core.product (market_id,
  published_at DESC, id DESC) WHERE visibility = 'PUBLISHED'`; recorded by **ADU-DB-01 v1.23**
  (S0.1, S30f; v1.22 moved to `docs/superseded/`). No table, enum or grant change.
- Contract regenerated (byte-identical twice); `@adulis/api-client` regenerated.

Not used: any Seller-private management API; any analytics or impression event.

## 5. Mobile

- `src/app/(buyer)/(tabs)/shop.tsx` replaces the placeholder: a heading "Shop", the order label
  "Newest first", and a two-column grid (`PublicListView` + `usePublicList` from WO-006): pull to
  refresh, next page on reaching the end, de-duplication across pages, "That is everything for
  now." at the end, loading/empty/error states with retry, background-return revalidation. The
  list is keyed by subject (sign-in/out reads again). The first read waits for the first bootstrap
  attempt, which registers a new install's device (its Market) (ON-20261111-043).
- `ProductTile` (shared with the Seller Profile): card image, name, the server's price span,
  availability in words; one button opens the Product. Where Sellers mix, the Seller's name is its
  own link (`link` role, "View <store>", touch-target height) to the Seller Profile -- never nested
  inside the Product button.
- The tab stays mounted, so Back from a Product or a Seller returns to the same place.
- Locale keys `buyer.shop.order`, `.products`, `.empty`, `.loading` (en + am machine-translated
  placeholders; MT-KEYS 914).
- No category, sort, filter, Search, cart, Follow or Save control.

## 6. Tests

- API `test/wo-007-shop.e2e.spec.ts` (8): Market isolation, ordering, price span and availability
  from the projection, `image_key`; unpublished Products, a DRAFT and a SAFETY_SUSPENDED Seller,
  other and SUSPENDED Markets excluded; no Market evidence (no device, device without Market,
  device in a SUSPENDED Market) is an empty page; the Account's Market wins over the device's;
  paging to the end without repeat or gap; three Products at one published instant walked one per
  page in id order; invalid/impossible cursors and limits 0/51 are 400; unpublish leaves and a stock
  change shows on the next read; the real statement shape uses `idx_product_shop`.
- Mobile `src/buyer/shop.test.tsx` (8): grid with label, span, availability, Seller link, end
  marker, card image URI, no invented controls, only `limit=30` sent; cursor paging and
  de-duplication; Product and Seller navigation and Back keeping the tab (no re-read); empty and
  failure-with-retry; signed-in read presents the session; reached from the tab bar with no cart,
  order, payment or reservation request; a new install reads only after the first bootstrap;
  background return (short stay keeps, long stay re-reads and an unpublished Product is gone).
  `buyer-shell.test.tsx` updated for the real Shop.

## 7. Native validation (Android emulator, API 37; iOS NOT validated)

Real local API (development) on the disposable database `adulis_gates`; WO-CAT-001 fixtures
(Seller "Fixture Weaves" readied through the Seller API, four Products published through the
API), WO-006 reviews, and a second Seller "Fixture Pottery" with 32 older Products (rows) so the
Shop spans two pages and mixes Sellers. Market B holds another `fixture-weaves`.

| Check | Result |
|---|---|
| API (curl): Market A page 1 = 30 (Coffee tray first, 1,500.00, available), page 2 = 7 ending at the oldest, `next_cursor` null; Market B = only its own Product (5,000.00); no device = empty; bad cursor 400; limit 51 400; `Cache-Control: no-store` | PASS |
| `shop.yaml` (guest, clean install): label, spans, "Currently unavailable", no Market B price, no category/cart/filter; Product -> Back; Seller link -> profile -> Back; scroll through page 2 to the end marker; Product of the other Seller -> Back keeps the place | PASS |
| `shop-refresh-1/2/3`: Clay cup unpublished through the Seller API -> a pull removes it; republished + Woven basket Small repriced to 950.00 -> a pull shows both | PASS |
| `shop-signed-in` after a real OTP sign-in: Account's Market, Product, sign out | PASS |
| `shop.yaml` in Dark mode at font scale 1.3 | PASS (one cosmetic defect recorded: some Seller-line underlines not drawn, ON-20261111-048) |
| Regression: `seller-profile.yaml`, `buyer-scene-explorer.yaml`, `catalogue-product-1.yaml` | PASS |
| No commerce: 0 carts; 5 reservations and 5 orders are seed rows, 3 orders are the WO-006 review fixtures | PASS |

The first native run failed three flows because the harness put 32 extra Products on a NEW-level
Seller and the republish was correctly refused (`LEVEL_LIMIT_REACHED`, cap 10): a harness defect,
recorded (ON-20261111-047), fixed by the second Seller, and the whole set re-run. Fixture media
removed from local MinIO afterwards; the disposable database rebuilt by the gate run.

## 8. Gates

Final battery of the whole overnight batch, on `7503e5a` (freshly rebuilt disposable database):

| Gate | Result |
|---|---|
| `pnpm --filter @adulis/api test` (run 1) | **884/884** |
| `pnpm test` (run 2) | API **884/884**; mobile 220/220; every other package PASS |
| Catalogue / Storefront / Scene / Product / Analytics / FYP suites (incl. wo-007, wo-006, cat-001a, cat-001) | 286/286 |
| `@adulis/api-client` test / `generate:check` | PASS / PASS |
| `@adulis/mobile` typecheck / test / build | PASS / 220/220 / PASS |
| `pnpm typecheck` / `lint` / `build` | PASS / PASS / PASS |
| `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS (all six) |
| `db:check` / `db:determinism` | 16/16 / PASS |
| API-client generation (regenerated twice, byte-identical) / orphan sweep / Expo Doctor | PASS / PASS / 20/20 |
| Android Maestro (WO-007 set + regression, second run) | 11/11 PASS |

No test failed in this battery. The OTP 429 interaction recorded in WO-006 (ON-20261111-041)
did not recur; it is not fixed and stays open.

## 9. Review

Independent code and security review of `bce772b..574bddc`: no Critical or High. Mediums: M1 the
grid used the 160 px thumbnail (FIXED, ON-20261111-042), M2 a fresh install could read before its
Market existed and show "No Products" (FIXED, ON-20261111-043). Lows: test gaps (FIXED,
ON-20261111-044), a literal touch target and an unproven test comment (FIXED, ON-20261111-045), a
governed document citing this record before it existed (FIXED by this file, ON-20261111-046).
Checked and fine (review): Market and Seller isolation including the composite Product/Seller
Market FK; keyset comparison matching the ORDER BY with microsecond round trip; forged cursors
confined to the requester's Market; `no-store` set before validation can throw; an explicit
response (no `published_at`, `market_id`, `seller_id`); DTO matching SQL nullability; the shared
price and availability fragments; index predicate and order usable; bounded pages, no N+1; mobile
keys, navigation params, roles, tokens and locale-only strings.

Data integrity: read-only feature plus one additive index. Authorization: public read; no
Seller-private API; no new write. Market/Seller isolation: tested in API and natively (Market B
price never shown). PRIVATE Scene leakage: not applicable (Products only; Scenes untouched).
Cursors: validated. Caching: `no-store`. Accessibility: header role, button and link roles,
labels with price and availability in words, touch-target height, text wraps at 1.3 (underline
defect recorded). Performance: one statement per page on a partial index, card derivatives,
30 per page.

## 10. Outcome

**COMPLETE.** The Shop tab browses the Buyer's Market's real published Products in one honest,
labelled, deterministic order, with the shared public price and availability, cursor pagination,
Product and Seller navigation, and Market isolation proven in API tests and on the device. The two
Medium review findings are fixed; no Critical or High was found or remains. Not built, by design:
categories, Search, Nearby and the S32 modules, for which no taxonomy or rule exists. Founder
decisions recorded: the category taxonomy and module rules (ON-20261111-049) and the Shop order
(ON-20261111-050). WO-008 not started.
