# WO-006 -- Buyer Seller Profile and Seller Discovery

Status: COMPLETE (About partial against R-09 by missing public data, documented; founder decisions recorded)

## 1. Baseline

- Branched from WO-CAT-001A's pushed HEAD `ec43f43104d504ce5ff76c56a964aea82c4f81c2`
  (`catalogue/wo-cat-001a-eligibility-consistency`); branch `mobile/wo-006-buyer-seller-profile`.
- Issues: `docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md` (ON-20261111-023 to -040).

## 2. Documents reviewed

ADU-MOB-02 v4.3 (route S202, R-09 :2373, Seller profile S518-S526, deep links S611), ADU-STOREFRONT-02
v4.2 (S497-S617: header, Trust, verification limits, availability, page structure), ADU-TRUST-01
v3.3 (S9 public levels, S57 INSUFFICIENT_EVIDENCE, S68 public fields), ADU-REV-01 v3.3 (S16, S19,
S23, S30, S32), ADU-SCN-01 v3.2 (public gate), ADULIS-KB v3.3, the prototype's Seller Profile
(`MobileBuyer.tsx` 2538-2700, read only), the WO-005 / WO-CAT-001 records and handoff.

## 3. Journey (implemented)

```text
For You -> Explore the Scene -> (Seller header) -> Seller Profile
Product Detail -> ("Sold by") -> Seller Profile
Seller Profile -> Scene tile -> Explore the Scene
Seller Profile -> Product tile -> Product Detail
```

Route `/sellers/[handle]` (one screen per handle). MOB-02 names `seller/[sellerRef]`, but `/seller`
is the Seller Companion shell and no Seller reference exists beyond the handle: recorded for the
founder with OVN-080 (ON-20261111-023). Deep link `adulis://sellers/<handle>` works cold.

## 4. API (audit and changes)

| Read | Before | After |
|---|---|---|
| `GET /v1/storefronts/{handle}` | untyped; header, stats, availability | typed `StorefrontDto`; additive `member_since`, `review_summary` (count, mean rounded once to 1 decimal, counts by stored badge; null mean without reviews), `fulfilment_methods` (active codes); optional `revalidate=true` (no `storefront_viewed`) |
| `GET /v1/storefronts/{handle}/scenes` | did not exist | NEW: the Seller's Scenes from the canonical public gate `core.v_scene_post_public` only (PRIVATE, draft, archived simply absent), newest first, 140-grapheme caption excerpts, thumb/card keys, keyset cursor `(published_at, public_ref)`, `limit` 1-50 (20), `no-store` |
| `GET /v1/storefronts/{handle}/products` | `LIMIT 100`, no paging | optional `cursor` + `limit` 1-100 (default 100, compatible), stable order `(display_order, created_at, slug)`, `next_cursor` |
| `GET /v1/storefronts/{handle}/reviews` | raw ISO cursor cast in SQL (a malformed value was a 500; millisecond truncation and ties skipped rows) | validated keyset cursor `(published_at at microseconds, id)`, typed `StorefrontReviewListDto`, optional `limit` 1-50 (25) |
| `GET /v1/storefronts/{handle}/products/{slug}`, `GET /v1/scene-posts/{publicRef}` | reused unchanged | -- |

- Cursors (`apps/api/src/common/http/cursor.ts`): opaque base64url JSON tuples, strictly validated
  (shape, real calendar instants that round-trip, int4 bounds); anything else is `400
  VALIDATION_FAILED` reason `CURSOR_INVALID`. Timestamps are rendered by Postgres at microsecond
  precision. No internal Scene or Product UUID travels in a list URL (public_ref / slug
  tiebreakers); the reviews cursor uses the review id, already in every row.
- Market-scoped identity: every read resolves the Seller through `sellerByHandle` (requester
  Market from Account or registered device, ACTIVE Markets, exactly one match). With the same handle
  in two Markets, header, Scenes, Products and Reviews all resolve the same Seller; with no Market
  evidence the ambiguous handle is the neutral 404 on every read (tested).
- Contract regenerated twice (byte-identical).

## 5. Mobile

- `SellerProfile.tsx`: header (store name, @handle, the Trust level the database holds, completed
  handoffs, Seller-service summary with its count or "No reviews yet") and tabs **Scenes ->
  Products -> Reviews -> About**, opening on Scenes (`tablist`/`tab` roles, selected state, 44dp).
- Scenes: 2-column grid of card images and caption excerpts; a tile opens Explore the Scene.
- Products: 2-column grid; the server's price span, availability in words; a tile opens the
  Product. Seller display order (R-09's "available first" is a founder decision, ON-20261111-026).
- Reviews: rating in words ("Rated 5 out of 5") with stars as decoration, the evidence badge, the
  date, the text; a note that Product quality is shown on each Product.
- About: description, Trust level, open/closed now (server-derived), fulfilment methods, member
  since. Missing R-09 fields are documented, not invented (ON-20261111-028).
- Not shown, deliberately: reliability rates (no public denominators; TRUST-01 S57,
  ON-20261111-027); Follow, Message, Share, Cart, review composer (out of scope, ON-20261111-030).
- `public-list.ts` / `PublicListView.tsx`: cursor-paginated lists on the For You rules (key by
  resource, subject, generation; pull keeps items; background return withholds; 404 -> neutral gone;
  one page at a time, never into an error; de-duplication across pages). Reused by WO-007.
- Revalidation: header and the visible list on return to the screen, on a pull (both), and after
  the background interval; re-reads are sent as revalidations.
- Entry points: the Explore the Scene Seller header (a link) and "Sold by" on the Product.
- 43 locale keys (en + am machine-translated placeholders, MT-KEYS 910).

## 6. Tests

- API `test/wo-006-seller-profile.e2e.spec.ts` (20): header fields and no-score-without-reviews;
  Scenes gate-only, PRIVATE excluded and restored, draft excluded, paging with an id-free cursor,
  invalid and impossible cursors (400), limit bounds; Products paging with a real slug tiebreak,
  compatible default page, invalid/int-overflow/impossible cursors; Reviews tie walk (one row per
  page), invalid cursors; storefront view counting (revalidate); same handle in two Markets on every
  read; ambiguous handle 404 + `no-store`.
- Mobile `src/buyer/seller-profile.test.tsx` (15): header and tab order/default; no rates and no
  invented actions; empty states; Scene and Product navigation; Products paging by cursor; Reviews;
  About; header 404 and list 404; malformed handle (no request); failure and retry; signed-in
  session presented; both entry points; return from a Scene re-reads (PRIVATE Scene gone, header as
  revalidation); list pull re-reads the header; background return.

## 7. Native validation (Android emulator, API 37; iOS NOT validated)

Real local API (development) on the disposable database; Seller "Fixture Weaves" readied through
the Seller API (WO-CAT-001 fixture), plus three reviews as rows (no Buyer review API exists).

| Check | Result |
|---|---|
| `seller-profile.yaml`: Explore -> Seller header -> profile (store, @handle, "4.3 out of 5 from 3 reviews", Scenes selected, no Follow/Message) -> Products (server span, no Market B price) -> Reviews -> About -> Scene from profile -> Product from profile -> Sold by | PASS (before and after the review fixes) |
| `seller-profile-private-1/2.yaml`: the tray out of stock through the Seller API -> Scene PRIVATE (read 404) -> pull -> absent from the profile; restored after | PASS |
| `seller-profile.yaml` in system Dark mode at font scale 1.3 | PASS |
| API (curl): ambiguous handle with no device -> 404; impossible reviews cursor -> 400; header summary 4.3/3 | PASS |
| No cart or new reservation rows | PASS (5 reservations are seed rows) |

## 8. Gates

Battery on `5c5b6cf` (freshly rebuilt disposable database):

| Gate | Result |
|---|---|
| `pnpm --filter @adulis/api test` (run 1) | 872/876 -- 4 OTP 429s in c6, t8, wo-api-001a, wo-sec-001 (ON-20261111-041, carried OVN-047) |
| `pnpm test` (run 2) | API 875/876 -- 1 OTP 429 in t12-d89; mobile 212/212; every other package PASS |
| the five failing suites alone (in band) | 86/86 |
| Catalogue / Storefront / Scene / Product / Analytics / FYP suites (incl. wo-006, cat-001a, cat-001) | 278/278 |
| `@adulis/api-client` test / `generate:check` | PASS / PASS (byte-identical twice) |
| `@adulis/mobile` typecheck / test / build | PASS / 212/212 / PASS |
| `pnpm typecheck` / `lint` / `build` | PASS |
| `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS |
| `db:check` / `db:determinism` / orphan sweep / Expo Doctor | 16/16 / PASS / PASS / 20/20 |

The only failures are the known OTP-budget interaction between auth suites in parallel workers; no
WO-006 suite failed in any run.

## 9. Review

Independent code and security review of `ec43f43..HEAD`: one **High** (H1, crafted cursors could
cause a 500 -- FIXED, ON-20261111-032); Mediums: M1 Seller views counted on re-reads (FIXED,
ON-20261111-031), M2 REV-01 vs schema on UNVERIFIED reviews (SPEC_CONFLICT for the founder,
ON-20261111-033), M3 lists not re-read on return (FIXED, ON-20261111-034); Lows fixed (rounding,
UTC date, tab text scaling) or recorded (cursor creation time, tab refetch); test gaps mostly closed
(ON-20261111-040). Checked and fine (review): keyset comparisons match each ORDER BY, no NULL key
columns, unique tiebreakers, microsecond round trip, PRIVATE Scenes never listed, Market-scoped
identity, `no-store` on all four reads including 404s, no new internal UUID in cursors,
compatibility.

Data integrity: read-only feature. Authorization: all reads public; no new write. Market/Seller
isolation: tested. PRIVATE leakage: none (gate-only list; return re-read). Cursors: validated.
Caching: `no-store`. Accessibility: roles, states, labels, 44dp, wrap at 1.3. Performance: one
statement per page, bounded pages, card/thumbnail derivatives, no N+1.

## 10. Outcome

**COMPLETE.** The Seller Profile works on real data with all four tabs honestly implemented
(About shows only the fields public data supports; the gaps are recorded); Market-scoped identity
holds across every read; PRIVATE Scenes never appear; the one High review finding is fixed and no
Critical or High remains. Founder decisions recorded: the Seller route (ON-20261111-023), Products
"available first" (ON-20261111-026), UNVERIFIED reviews vs REV-01 (ON-20261111-033), cursor
creation time (ON-20261111-037). WO-007 may depend on this branch.
