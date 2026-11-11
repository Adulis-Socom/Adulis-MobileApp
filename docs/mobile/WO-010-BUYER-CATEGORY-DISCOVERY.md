# WO-010 -- Buyer Category Discovery (Mobile) and the Collections session correction

Status: COMPLETE. Date: 11 November 2026. Branch `mobile/wo-010-catalogue-categories`, from
`0f909744d38c696eec7f61d659e03f76d84c7494`. Backend record: `WO-010-CATALOGUE-CATEGORIES.md`.

## 1. Shop

```
SHOP  (Newest first)
  [All Products] [Fashion] [Cosmetics] [Electronics]     <- the server's categories, in its order
  Product grid (server-filtered; card Saves as before)
```

- All Products is the default. The categories come from `GET /v1/categories` (only those enabled
  in the requester's Market; nothing hard-coded, no Market id in the app). A Market with none shows
  no category row.
- A tab is a server filter: `GET /v1/shop/products?category=CODE`, its own list and cursor (the
  list key carries the category), in the same order. Nothing is filtered on the device and the
  whole catalogue is never downloaded.
- Switching resets pagination; pull to refresh re-reads the list and the categories; scroll returns
  to the top of the new list.
- If the server no longer offers the chosen category (it answers `VALIDATION_FAILED` path
  `category`, or a successful category read no longer lists it), the Shop returns to All and reads
  the categories again.
- States: loading, selected, empty category ("No Products in this category yet."), no Market and
  offline (the existing blocked states), error and Try again, end of list; a category read that
  fails says so ("Categories could not be loaded. All Products are still shown.") with Try again
  while All keeps working.
- Product Detail, the Seller line and card Saves work on filtered lists (one saved-state batch per
  page, as WO-009A).

## 2. Marketplace Search

- The Products tab shows the same category row once results are shown; a tab sends
  `GET /v1/search?type=PRODUCT_POST&category=CODE` (ranking unchanged, server-side). Top, Scenes and
  Sellers show no category row and never send one (the server would refuse it).
- A refused category returns the tab to All and re-reads the categories.

## 3. Presentation, accessibility, localisation

- A horizontally scrollable tab row (it grows with the text size instead of squeezing): a labelled
  `tablist` container (not one grouped element, so each tab stays reachable), each tab a `tab` with
  selected state, at least 44 dp tall; selection is shown by border, weight and state, never by
  colour alone. Light and Dark from theme tokens.
- Labels: the server sends a locale key; the app renders it from `@adulis/locale/mobile` (English;
  Amharic machine-translated placeholders listed in MT-KEYS, not production-approved). A key this
  catalogue lacks shows the stable code. New keys: `catalogue.category.{fashion,cosmetics,electronics}`,
  `buyer.shop.{categories,all,category_empty,categories_failed}`.
- No banners, counts or promotion; For You is unchanged.

## 4. Files

`api/client.ts` (categories, `category` on Shop and Search), `buyer/categories.tsx` (new:
`useCategories`, `CategoryTabs`, `useCategoryStillOffered`, `categoryRefused`), `app/(buyer)/(tabs)/shop.tsx`,
`app/(buyer)/search.tsx`, `buyer/SearchResults.tsx`, `buyer/public-list.ts` (a pull's placeholder is only
ever the same resource's), `testing/fake-api.ts` (a default empty category list), `.maestro/categories.yaml`
(new), `.maestro/shop.yaml` (the WO-007 "no category" assertion now expects the category row).

## 5. Collections session correction (ON-20261111-112)

WO-009A bound the card Saves, the guest continuation and saved-state reads to the session that
started them; the Saved screen, the Collection screen and the Add to collection picker still used
the session's shared client. Now:

- `usePrivateApi()` (buyer/saved.ts) is the client bound to the session on screen
  (`SessionProvider.boundApi`): a request is refused before it is sent once that session ended or
  another began. Every private Collections read goes through `keepIfCurrent` (its answer is kept
  only while its session is current); every mutation (create, rename, delete, remove, the picker's
  ticks) uses the client captured at the tap, and its follow-up (refresh, invalidation, callbacks,
  error text) runs only if that session is still current.
- Without a session the Collection screen and the picker ask for a sign-in instead of reading
  (independent review R1: they previously waited forever once `usePrivateApi` returned null).
- Sign-out still clears the query cache and the armed guest Save; authorization is unchanged
  (the server scopes every request to the bearer's Account; a foreign ref is a 404).

## 6. Tests

- `buyer/categories.test.tsx` (7, new): the tab row from the server in order; All default; a tap
  filters on the server; back to All; an empty category; the next page carries its cursor and
  category; a refused category falls back to All and re-reads; a failed category read keeps All
  and recovers on Try again; no row for a Market without categories; a Save on a filtered list
  (one batch, SHOP surface); Search: only the Products tab offers categories and sends
  `category` with `type=PRODUCT_POST`; Top sends none. Every test asserts no Cart, Order,
  Checkout, payment or reservation request.
- `buyer/saved.test.tsx` (+5): the picker and the Collection screen send nothing for A or B after a
  switch; the Saved tab never shows Account A's delayed read to Account B; an expired session fails
  safely; without a session both screens ask for a sign-in and read nothing.
- Mobile total: 291 tests in 19 suites (`--maxWorkers=2`; also inside `pnpm test`).

## 7. Native validation (Android emulator API 37; real local API on the disposable database)

Debug APK reused (no native dependency changed); Metro serving the branch; the WO-CAT-001/006/007
fixtures plus controlled category assignments on the disposable database only (Cotton scarf
FASHION; Shop item 31 and 32 COSMETICS; Shop item 30 ELECTRONICS). Every temporary output on the
external SSD; the storage gates were checked before each flow (none blocked; C: stayed 18.99 to
19.30 GB free). **iOS was not tested.**

| Flow | Result |
|---|---|
| `categories` shop (guest): All selected -> Fashion (out-of-stock Cotton scarf listed, others gone) -> Cosmetics -> Electronics -> Fashion -> Product Detail -> Seller Profile -> back (Fashion still selected) -> All | PASS |
| `categories` search (guest): Top has no categories; Products -> Fashion narrows; Electronics shows no scarf | PASS |
| sign-in, then `categories` save: Save and Remove on a filtered card (database: none left) | PASS |
| `categories` dark (Dark, font scale 1.3): the row, Cosmetics | PASS |
| WO-009 regressions: `saved-guest-1/2`, `saved-collections` (Product Detail and Scene Explorer Save, picker, rename, remove, delete) | PASS |
| Regressions: `search`, `seller-profile`, `catalogue-product-1`; `shop` after its WO-007 assertion was updated to the approved category row | PASS |
| Offline recovery: `shop-offline-1` (API stopped) and `shop-offline-2` (API back) | PASS |
| Commerce rows after all flows | carts 0; reservations 5 and orders 8 are seed and fixture rows, unchanged |

Not run natively: `buyer-for-you.yaml` (ON-20261111-084); For You is covered by its Jest suites.
