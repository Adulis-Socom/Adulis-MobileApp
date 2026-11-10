| Work Order | Status | Branch | HEAD | Tests | Blockers |
|---|---|---|---|---|---|
| WO-CAT-001A | COMPLETE | `catalogue/wo-cat-001a-eligibility-consistency` | `ec43f43104d504ce5ff76c56a964aea82c4f81c2` | API 856/856 x2; cat-001a 13/13; final batch battery PASS | None (OVN-086 left to the founder, ON-20261111-010) |
| WO-006 | COMPLETE | `mobile/wo-006-buyer-seller-profile` | `bce772bc435b8093ed449f57b1cbe317c97a2954` | wo-006 API 20/20, mobile 15/15; native 4/4 PASS | None (founder items ON-023, -026, -033, -037) |
| WO-007 | COMPLETE | `mobile/wo-007-buyer-shop-discovery` | the commit adding this file (last code commit `7503e5a`; exact remote HEAD in the batch's final response) | wo-007 API 8/8, mobile 8/8; final battery: API 884/884 x2, mobile 220/220, all gates PASS; native 11/11 PASS | None (founder items ON-049, -050) |

# Morning Handoff -- 11 November 2026

Full report: `docs/overnight/OVERNIGHT-DEVELOPMENT-REPORT-2026-11-11.md`. Issues:
`docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md`. Work-order records:
`docs/catalogue/WO-CAT-001A-ELIGIBILITY-CONSISTENCY.md`, `docs/mobile/WO-006-BUYER-SELLER-PROFILE.md`,
`docs/mobile/WO-007-BUYER-SHOP-DISCOVERY.md`. All six files are on
`mobile/wo-007-buyer-shop-discovery`.

## What works

- Scene and Catalogue agree on availability item by item; prices are held in the Market currency
  and Products in their Seller's Market by the database; Scenes go PRIVATE and back across stock,
  currency, Seller, Market, publication and withdrawal changes.
- Buyer Seller Profile (`/sellers/<handle>`, from a Scene or a Product): real header, Scenes ->
  Products -> Reviews -> About, each paginated; PRIVATE Scenes never shown; same handle in two
  Markets resolves per Market.
- Buyer Shop tab: the Market's published Products, "Newest first", price span and availability,
  paging to an explicit end, Product and Seller navigation keeping the place; works signed in and
  as a guest.
- Validated on the Android emulator against the real local API (WO-006, WO-007), including Dark
  mode at 1.3x text.

## What remains incomplete

- Shop: no categories, Search, Nearby, New Drops, Locally Made or price-led modules (no taxonomy or
  rules exist; ON-20261111-049). Seller Profile About is partial (ON-20261111-028); no reliability
  rates (ON-20261111-027); no Follow/Message/Share (out of scope).
- iOS not tested. Amharic remains machine-translated placeholder text, disabled for users.
- Open lows worth a small follow-up: ON-20261111-048 (Seller-line underline lost on some recycled
  tiles), ON-20261111-012 (stale `apps/api/CLAUDE.md` counts), ON-20261111-052 (dead locale key).

## Critical / High issues

- Critical: none found.
- High: one found (ON-20261111-032, crafted cursors could cause a 500) -- RESOLVED in WO-006 and
  covered by tests. **No Critical or High issue is open.**

## Founder decisions required

| Register | Decision |
|---|---|
| ON-20261111-010 | OVN-086 -- availability and Checkout prerequisites (second alternative recommended) |
| ON-20261111-009 | Market display-currency change policy |
| ON-20261111-023 | Seller route `/sellers/[handle]` vs MOB-02 `seller/[sellerRef]` |
| ON-20261111-026 | Seller Products "available first" |
| ON-20261111-033 | SPEC_CONFLICT: REV-01 verified-only reviews vs stored UNVERIFIED reviews |
| ON-20261111-037 | Cursor carrying a creation instant |
| ON-20261111-049 | Buyer category taxonomy; Locally Made / Discounts / New Drops rules |
| ON-20261111-050 | Shop order ("Newest first" or another) |

## Failed tests and evidence

- **Final battery: no failing test.** API 884/884 in both runs, mobile 220/220, every gate PASS
  (`docs/mobile/WO-007-BUYER-SHOP-DISCOVERY.md` S8).
- Earlier in the batch, all investigated and recorded:
  - WO-CAT-001A battery run 2: 37 hook timeouts in `disc-002-fyp` under parallel workers -> one
    `testTimeout: 30_000` (`5faadf8`), then 856/856 twice (ON-20261111-011, RESOLVED).
  - WO-006 batteries: 4 then 1 OTP 429s in auth suites (c6, t8, wo-api-001a, wo-sec-001, t12)
    in parallel runs; those suites pass alone 86/86; the cause is the known OTP-budget interaction
    (OVN-047). Did not recur in the final battery; not fixed, so still OPEN (ON-20261111-041).
  - WO-007 first native run: 3 Maestro flows failed on a harness fixture that exceeded the NEW-level
    publication cap; fixed in the harness and re-run 11/11 (ON-20261111-047, RESOLVED).

## Branches safe to review

All three, in stack order: `catalogue/wo-cat-001a-eligibility-consistency` ->
`mobile/wo-006-buyer-seller-profile` -> `mobile/wo-007-buyer-shop-discovery` (the last contains
the whole batch; compare it with `4193fc8`). Nothing was merged; no pull request was opened.

## Recommended next task

Take the founder decisions above (ON-033 and ON-049/-050 first: they gate further discovery
work), then a small follow-up for ON-048 and ON-012, then WO-008 as sequenced by the founder.

## Issue totals (computed from the register, 52 entries)

| Severity | Total | RESOLVED | PARTIALLY RESOLVED | OPEN | FOUNDER_REVIEW_REQUIRED |
|---|---|---|---|---|---|
| CRITICAL | 0 | 0 | 0 | 0 | 0 |
| HIGH | 1 | 1 | 0 | 0 | 0 |
| MEDIUM | 10 | 9 | 0 | 0 | 1 |
| LOW | 34 | 13 | 2 | 14 | 5 |
| INFO | 7 | 3 | 0 | 4 | 0 |
| **All** | **52** | **26** | **2** | **18** | **6** |

By work order: WO-CAT-001A 22 (ON-20261111-001 to -022), WO-006 19 (-023 to -041), WO-007 11
(-042 to -052). Entries with "Founder decision required: Yes": 8 (-009, -010, -023, -026, -033,
-037, -049, -050).
