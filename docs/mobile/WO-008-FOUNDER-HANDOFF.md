# WO-007B + WO-008 -- Founder Handoff (11 November 2026)

For the founder. What the Buyer app can now do, what was decided and recorded, what is deliberately not
built, and the decisions waiting for you. Engineering detail is in
`docs/mobile/WO-007B-AVAILABLE-FIRST-CATALOGUE.md` and `docs/mobile/WO-008-MARKETPLACE-SEARCH.md`; every
issue is in `docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md`.

## Branches

| Work order | Branch | Base | Pushed HEAD |
|---|---|---|---|
| WO-007B Available-first Seller catalogue | `mobile/wo-007b-available-first` | `022bbfea6fe6c50cff7a34fc5a073c29afb2bb02` | `3a8c2c681e17b98a0a850159cd3daf7de9898829` |
| WO-008 Marketplace Search | `mobile/wo-008-marketplace-search` | `3a8c2c681e17b98a0a850159cd3daf7de9898829` | the commit adding this file (`git ls-remote origin mobile/wo-008-marketplace-search`; given in the final report) |

Stacked; nothing merged, no pull request, no force-push.

## What a Buyer can now do

- **Seller Profile, Products tab:** in-stock Products first, then out-of-stock ones, each group in the
  Seller's own order (your option A). If stock changes while someone scrolls, a Product may appear twice
  (the app shows it once) or only after a refresh -- the limit you accepted. Product Detail always shows
  current price and stock.
- **Search:** type at least two characters; results for Products, Sellers and Scenes of the Buyer's Market
  under Top / Products / Scenes / Sellers. Exact names and Seller handles come first, then name starts,
  then words inside names, then close misspellings ("baskte" finds "Woven basket"). In-stock Products come
  before relevant out-of-stock ones. Amharic text is searched as typed. A result opens the existing
  Product, Seller or Scene screen, and Back returns to the same search. Nothing found: an honest message
  and links to the Shop and Home.
- **Privacy:** no search history, no query logging, no tracking; another Market's content, PRIVATE Scenes
  and suspended Sellers never appear.

## Decisions recorded (no further action)

- ON-026: option A implemented.
- ON-056: Seller fault must come from an explicit, evidenced, correctable Claims determination; Reviews
  will use it. Recorded for the future Claims and Reviews work.
- ON-057: self-review conflicts judged at Order creation and Review submission, recorded then, not
  rewritten by later team changes; fraud corrections still possible. Recorded for the Reviews work.
- **Payment architecture deferred.** Nothing payment-related was touched; public Reviews stay off (the
  system still answers "not verified" for every Order).

## Decisions waiting for you

| Register | Question |
|---|---|
| ON-20261111-079 | Confirm Search's launch settings: 2-character minimum, fuzzy matching from 3 characters, typo tolerance 0.5, Top showing up to 6 Products / 3 Sellers / 3 Scenes, 20 per page, 60 searches a minute per person or device |
| ON-20261111-080 | Whether to approve Search analytics (session and query identifiers, zero-result counts) and their retention -- needed to measure and tune relevance; nothing is collected until then |
| ON-20261111-053 | The payment architecture itself (research first, by your decision) |
| ON-20261111-029 | Review moderation policy and Operator capability (before any public Review) |
| ON-20261111-049 | The Catalogue category taxonomy work order (Search filters and Shop categories wait on it) |

## Not built, by design

Payment, Checkout, Cart, public Reviews, Search filters and categories, Search suggestions or popular
queries, ranking by Trust, popularity or freshness, Market (country) switching, Search analytics, Seller
Console / Storefront / Operator Console changes, hotspots, production For You.

## Recommended next Mobile work order

Buyer Saved Collections (ADU-SRC-01 S18-S22: private Product and Scene saves for signed-in Buyers; no
purchase semantics), or -- if you prefer to unblock Search and Shop together -- the Catalogue category
taxonomy work order first.
