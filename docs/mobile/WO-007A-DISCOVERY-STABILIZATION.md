# WO-007A -- Buyer Discovery Stabilization and Review Contract Closure

Status: PARTIALLY COMPLETE -- review contract dependencies remain (verified payment, Review moderation); available-first awaits a founder choice

## 1. Starting SHA and branch

- Accepted branch `mobile/wo-007-buyer-shop-discovery` at `fe7ffb2f03782d25a835079a302bfbb12520faab`
  (verified equal to `origin`, clean tree, before any change).
- Work branch `mobile/wo-007a-discovery-stabilization`, cut from that commit.
- Issues: `docs/overnight/OVERNIGHT-ISSUES-2026-11-11.md` (updated entries and ON-20261111-053 onward).

## 2. Documents reviewed

November 8 pack: ADU-REV-01 v3.3 (S1-S2 evidence bases, S7 final Handoff, S14-S16 eligibility and
"no unverified fallback", S23 Seller non-control, S28 APIs, S30 projections, S32 moderation, S37
Trust, S41 authorization, S43 privacy, S47 failure behaviour, S50 critical tests, S53 legacy
migration, S54 invariants), ADU-MOB-02 v4.3 (S32 Shop, R-09 Seller profile), ADU-TRUST-01 v3.3,
ADU-CATINV-01 v3.3, ADU-STOREFRONT-02 v4.2, ADU-AUTH-02 v3.3, ADU-PRV-01 v3.3, ADU-DPIA-01 v1.1.
Repository: ADU-DB-01 v1.23 (then v1.24), ADU-API-01 v1.11, `.claude/reference/DOCUMENT_AUTHORITY.md`
(K-1 payment ruling), the overnight register, report and handoff, and the WO-006, WO-007 and
WO-CAT-001A records.

## 3. Founder approvals

All eight morning-review recommendations are approved: `docs/mobile/WO-007A-FOUNDER-DECISIONS.md`
records each one with what was implemented and what remains. In short: ON-009 implemented
(migration 0059); ON-010, ON-023, ON-037, ON-050 were already the behaviour; ON-033 implemented,
fail closed; ON-049 recorded (taxonomy work order); ON-026 not implementable safely without a
further founder choice (S11).

## 4. Existing Reviews architecture (audit, before any change)

| Object | What it holds | What it proves for REV-01 |
|---|---|---|
| `core.review` (0014) | one row per Order (`order_id UNIQUE`), `seller_rating`, `body`, `badge`, `published_at`, `anonymised_at`; Buyer bound by FK `review_by_order_buyer`; no visibility column (a load-bearing absence) | Nothing by itself: the badge is a legacy tier |
| `fn_review_derive_badge` (trigger) | badge = `CLAIM_UPHELD` if any upheld Claim, else `VERIFIED_HANDOFF` if a scanned confirmation, else `CONFIRMED_BY_BUYER` if a tap, else `UNVERIFIED` | A summary of evidence, not the evidence; `CLAIM_UPHELD` is set for any upheld trigger, including post-receipt quality |
| `core.handoff_scan` (0013) | the Buyer's own QR scan (FK `handoff_scanned_by_buyer`), validity `VALID`/`LATE`/`REJECTED_*` | Accepted final receipt by QR (FINAL_HANDOFF evidence). No OTP or Manual receipt exists; no delegate |
| `core.courier_custody_transfer` | Seller-to-Courier PICKUP | Never a receipt (REV-01 S7) |
| `core.order_confirmation` | `VERIFIED_HANDOFF` (from a scan) or `CONFIRMED_BY_BUYER` (a tap) | A tap is a Buyer assertion: not evidence |
| `core.payment_submission` + `financial.payment_evidence` | a Buyer screenshot and the Seller's confirm/reject; "Adulis NEVER asserts a payment is genuine" (0012) | **Not verified payment.** K-1 (founder ruling): "provider/backend-verified payment; no Seller payment confirmation". No provider-verified payment fact exists anywhere in the schema |
| `core.claim` | trigger, state, `outcome` (UPHELD/NOT_UPHELD), `decided_by/at`; no liable-party column; no correction record | An upheld Claim exists; Seller fault is implied only by the forced demotion it triggers; a reversal is a bare UPDATE |
| `core.moderation_event` / `content_report` / `moderation_queue_item` (0016) | append-only events with free-text `decision`; reports enter the queue | No Review moderation decision vocabulary, no workflow writes a REVIEW target, no Operator Review capability |
| `GET /v1/storefronts/{handle}/reviews` and the header `review_summary` | every `core.review` row of the Seller, mean of all, counts by badge | Listed and counted UNVERIFIED reviews (the conflict, ON-20261111-033) |
| `POST /v1/orders/{id}/review` | any terminal Order (COMPLETED and the cancelled/expired states), legacy badge, item ratings for any Product of the Order | Pre-REV-01: no grant, no basis check, failure-only Product ratings possible (not public anywhere) |
| Trust ladder (`fn_recompute_seller_level`, 0028) | reads handoff scans and claims | Reads no rating today (`established_min_avg_rating` is "READ BY NOTHING at MVP") |

**Conclusion of the audit.** Both REV-01 bases require authoritatively verified payment, and none
exists in the executable system. FINAL_HANDOFF's receipt half exists (QR only); VERIFIED_ORDER_FAILURE's
Claim half exists without fault attribution or correction lineage. So no stored Review can be shown
to meet REV-01 today, whatever its badge.

## 5. Verified-evidence implementation

Migration `0058_public_review_eligibility.sql`:

- `core.fn_order_payment_verified(uuid)` -- the payment owner's evidence interface (REV-01 S56
  phase 1). It answers `false` for every Order: fail closed (REV-01 S47). WO-PAY-001 replaces the
  body with a read of a provider-verified fact. The planner folds the constant, so the view costs
  nothing meanwhile.
- `core.v_review_public` -- the single public Review projection. A Review is public when its Order
  has verified payment AND either a VALID/LATE Buyer scan (`FINAL_HANDOFF`) or an UPHELD Claim with
  trigger `GOODS_NOT_RECEIVED` or `REFUND_NOT_DELIVERED` and no receipt (`VERIFIED_ORDER_FAILURE`);
  the Review's Seller is its Order's Seller; the Order Buyer is not the Seller's owner or a live team
  member. Columns: `id, seller_id, seller_rating, body, published_at, evidence_basis`.
- A receipt wins over a failure basis on the same Order (REV-01 S1: "Delivered Orders retain the
  existing receipt-based container").
- Readings recorded for the founder rather than decided: the trigger-to-failure mapping and the
  absence of a Seller-fault attribute (ON-20261111-056); owner/team exclusion at read time
  (ON-20261111-057).

## 6. Legacy Review handling

Nothing is deleted, rewritten or promoted. Every `core.review` row, body, badge and item rating
stays; the Seller-private read (`GET /v1/seller/reviews`) is unchanged. Public eligibility is
evaluated independently by the view. Migration strategy for legacy rows (REV-01 S53): none is
needed now and none may fabricate evidence. When WO-PAY-001 lands, a legacy Order becomes eligible
only if the payment owner can prove its payment from provider records; Orders paid by
Seller-confirmed screenshot stay non-public permanently, segregated by the same view.

## 7. Public Reviews endpoint changes

`GET /v1/storefronts/{handle}/reviews` selects from `core.v_review_public` only: filtered before
`LIMIT` (no empty or short intermediate pages), Market-scoped Seller resolution unchanged, the
validated tie-safe keyset cursor `(published_at, id)` unchanged, `no-store`. Each item:
`id, seller_rating, body, evidence_basis, published_at` -- `badge` removed (a legacy tier is not a
basis); no Buyer, Order or Claim reference.

## 8. Rating aggregation changes

`review_summary` in `GET /v1/storefronts/{handle}` reads the same view with the same Seller filter:
`count` = the listed population; `average_rating` = their arithmetic mean rounded once to one
decimal, `null` with none; `basis_counts {FINAL_HANDOFF, VERIFIED_ORDER_FAILURE}` replaces
`badge_counts`. No Product-quality rating is combined (item ratings are not public anywhere).

## 9. Moderation integration

No authoritative Review moderation state exists (S4). Nothing was invented: no decision vocabulary,
no Operator permission, no Seller-controlled suppression. ON-20261111-029 is a **release blocker**
for public Reviews: REV-01 S32 needs a governed Review moderation state, an Operator capability
(AUTH-02) and its audit, joined into `core.v_review_public` so list and aggregate follow it together.

## 10. Seller Profile changes

The Reviews tab shows the server's evidence basis in words ("Verified order, received with Adulis
Handoff" / "Verified paid order with an upheld Seller fault"); legacy badge labels are gone. The
header shows "No reviews yet" when the public count is 0. Pagination, pull, background revalidation
and the 404 behaviour are the WO-006 hook's, now with a later-page 404 test. No Review writing or
editing.

## 11. Available-first ordering (ON-20261111-026)

**Not implemented; the Seller's display order is kept**, as the work order directs when the approved
order cannot be implemented safely.

Why. Availability changes between page requests, and keyset pagination is stateless. Take a Product P
whose availability flips after one page and before the next. The next response depends only on the
cursor and the current data, and a bounded cursor cannot record which of many Products were already
sent. So, for the same cursor and data, the server either lists P again (a duplicate in the history
where P was sent) or omits it (a gap in the history where P was not). No stateless keyset over a
mutable sort key avoids both. A naive `ORDER BY available DESC` has the same flaw unannounced.

Options for the founder:

| Option | What happens | Cost |
|---|---|---|
| A. Two-phase cursor (available pages, then unavailable), page size 100 | Exactly right for any catalogue that fits one page (every NEW-level Seller: cap 10). Larger catalogues: a Product that turns unavailable mid-browse may be sent again (the client already de-duplicates by key); one that turns available after its position passed appears on the next pull or return (the tab already re-reads on return from a Product) | No storage; a documented at-least-once rule |
| B. Server-side browse snapshot | Exactly-once for the life of a snapshot | New storage, a retention rule and its privacy note (the work order excludes it unless necessary) |

Recommendation: A. The current order stays until the founder chooses.

## 12. Shop initialization correction (ON-20261111-043)

- API: `GET /v1/shop/products` adds `market_resolved` (additive). `false` means the request carried
  no ACTIVE-Market evidence, so the empty page means "no Market", not "no Products".
- Mobile: the Shop reads only after a **successful** bootstrap (which registers a new install's
  device). Bootstrap or device-registration failure: the failure message with a retry. Offline (a
  paused bootstrap): "You are offline", resuming by itself on reconnect. `market_resolved: false`:
  "The Shop could not find your Market. Try again." with a retry that re-runs bootstrap (which places
  the device) and reads again; a pull does the same. A retry in flight shows loading. Never another
  Market's Products, never "No Products" for a Market that was not established.

## 13. Seller-link accessibility fix (ON-20261111-048)

The Shop tile's Seller line reads "Sold by {store}" (the Product page's key `buyer.product.seller`)
instead of an underlined store name: the words are the cue, so nothing depends on an underline some
recycled FlashList cells dropped, or on colour. The visible words are the accessible name (WCAG 2.5.3
label in name) with "View {store}" as the hint, as on the Product and Scene Explorer; `link` role,
touch-target height, theme tokens and wrapping unchanged.

## 14. Currency-policy enforcement (ON-20261111-009)

Migration `0059_market_currency_fixed.sql`: `trg_market_currency_fixed` refuses a change of
`core.market.display_currency` when any Product (any visibility) is in the Market -- 23514
`market_currency_fixed_with_products`. It first takes `SHARE ROW EXCLUSIVE` on `core.product`: a
concurrent first Product is waited for and then seen, or waits and is then held to the new currency
by 0056's guard; two changes queue instead of deadlocking. A Market with no Product (initial setup)
may change. No conversion, no rewrite, no new administrative API (none writes a Market's currency).
Known limit: the waiting side re-reads only under READ COMMITTED, which every API transaction uses.

## 15. Documentation cleanup

- ON-20261111-012: `apps/api/CLAUDE.md` cites ADU-DB-01 v1.24 and 123 tables (manifest 109 + 14,
  `core` 97), the numbers `pnpm db:check` and `pnpm verify:permission-doc` print.
- ON-20261111-052: `buyer.shop.coming` removed (en + am), with the four legacy
  `buyer.review.badge.*` labels; MT-KEYS regenerated (912 machine-translated + 3 HUMAN-REQUIRED).
- ON-20261111-040: shared-list tests added -- failed next page, pull keeping items, a slow older pull
  never replacing a newer one, a session ending mid-browse re-reading as a guest, a later-page 404
  (de-duplication was already covered).

## 16. Database migrations

| Migration | Objects | Kind |
|---|---|---|
| `0058_public_review_eligibility.sql` | `core.fn_order_payment_verified(uuid)`, `core.v_review_public` | forward; additive |
| `0059_market_currency_fixed.sql` | `core.fn_guard_market_currency_fixed()`, `trg_market_currency_fixed` | forward; refuses a previously allowed write |

No table, column, enum type or grant on an existing table changes. **ADU-DB-01 v1.24** records both
(S0.1, S30g; v1.23 moved to `docs/superseded/`); Appendices unchanged (123 tables, 71 enum types).

## 17. OpenAPI and generated-client changes

`contracts/openapi.json` and `@adulis/api-client` regenerated by the generators, twice,
byte-identical. `StorefrontReviewDto.badge` -> `evidence_basis` (`FINAL_HANDOFF` |
`VERIFIED_ORDER_FAILURE`); `ReviewSummaryDto.badge_counts` -> `basis_counts`; `ShopProductListDto`
gains `market_resolved`. The two replacements are not additive: no released client exists (the Buyer
app is unreleased; the console reads only the Seller-private `seller/reviews`), and keeping the
legacy tiers would have kept the mislabel (ON-20261111-061).

## 18. Tests

New and changed tests:

- API `test/wo-007a-reviews.e2e.spec.ts` (17 tests, real PostgreSQL fixtures through the production
  triggers). "As built": with every kind of stored evidence (receipt scans, upheld Claims, Seller-
  confirmed payment, taps, legacy badges), the list is one empty final page at every page size, the
  summary is `0 / null / 0+0`, and the planner folds the view (`One-Time Filter: false`). "With a
  payment owner" (a stand-in for this file's Orders only, the found definition restored): the work
  order's cases 1-17, 19, 20 -- no verified payment, payment without receipt, PICKUP only, valid
  FINAL_HANDOFF, valid VERIFIED_ORDER_FAILURE, open / rejected / upheld / overturned Claims, upheld
  NOT_AS_DESCRIBED without receipt, receipt plus upheld Claim (receipt wins), Seller mismatch, Buyer
  mismatch (FK refusals), UNVERIFIED and CONFIRMED_BY_BUYER, self-review, live versus revoked team
  member, REJECTED_HORIZON scan, several eligible, mixed, one-per-page walk across excluded rows and a
  timestamp tie, no eligible review, count equals the list, average excludes ineligible ratings
  (3.8, where every stored review would give 2.6), the response's exact keys. Case 18 (moderation) is
  not testable: no moderation state exists (S9). Market currency: refused with Products, allowed
  without, both race orders waiting on a real lock, two changes queue.
- API changed: `wo-006` (the unverified fixture reviews are no longer public: header 0/null, empty
  final page; the tie walk moved to wo-007a), `wo-007` (`market_resolved`), `cat-001a` D5 (the
  currency change is refused).
- Mobile `shop.test.tsx` (18, was 8): the Market tests (no Market, failed bootstrap, failed device
  registration, failed-then-recovered offline, a device that starts offline, a pull while blocked --
  the first four fail against the WO-007 code), the shared-list tests (S15), the worded Seller cue
  and its label. `seller-profile.test.tsx` (16): evidence-basis labels, no legacy tier wording, a
  later-page 404.

Final battery on `d94e365` (freshly rebuilt disposable database):

| Gate | Result |
|---|---|
| `pnpm --filter @adulis/api test` (run 1) | 900/901 -- one failure in `e2-e6.jobs` (stock.confidence_nudge, a global job counting another suite's new variants between its two runs; ON-20261111-070). Alone: 24/24 twice |
| `pnpm test` (run 2) | API **901/901**; mobile 231/231; every other package PASS |
| `pnpm --filter @adulis/api test` (run 3) | **901/901** |
| Reviews / Storefront / Catalogue / Scene / FYP / Analytics suites (incl. wo-007a, wo-007, wo-006, cat-001a, cat-001, disc-001, disc-002, c8, c2) | 303/303 |
| `@adulis/api-client` test / `generate:check` | PASS / PASS |
| `@adulis/mobile` typecheck / test / build | PASS / 231/231 / PASS |
| `pnpm typecheck` / `lint` / `build` | PASS / PASS / PASS |
| `verify:contract` / `appendix` / `docs` / `deps` / `mt-keys` / `error-locale` | PASS (all six) |
| `db:check` / `db:determinism` | 16/16 / PASS |
| API-client generation (twice, byte-identical) / orphan sweep / Expo Doctor | PASS / PASS / 20/20 |
| `verify:permission-doc` (counts for ON-012) | 42 permissions, 139 grants, 252 cells PASS |

## 19. Native validation

Android emulator (API 37), debug build, the real local API on the disposable database
`adulis_gates`. **iOS was not tested.** Fixtures: WO-CAT-001 (Fixture Weaves, four Products, two
Scenes), WO-006 (three UNVERIFIED reviews), WO-007 (Fixture Pottery, 32 Products) and wo007a-fixtures
(27 Fixture Weaves Reviews with REAL evidence: 25 Buyer QR scans through the production triggers,
2 upheld GOODS_NOT_RECEIVED Claims; ratings average 4.0). Where marked, a stand-in for WO-PAY-001
(`core.fn_order_payment_verified` answering true for exactly those 27 Orders) was switched on in that
database and off again; it ended as `SELECT false`.

| Check | Result |
|---|---|
| API (curl), as built: summary `count 0, average null, basis 0/0`; reviews `[]`, no cursor | PASS |
| API (curl), stand-in: summary `27, 4, FINAL_HANDOFF 25 / VERIFIED_ORDER_FAILURE 2`; page 1 = 25 (newest "Order never arrived 27", VERIFIED_ORDER_FAILURE), page 2 = 2, then null; item keys `body, evidence_basis, id, published_at, seller_rating` only | PASS |
| API (curl): Shop with no device `market_resolved false`, empty; device A `true`, 30 items; Market currency change with Products refused, still ETB | PASS |
| `shop.yaml` (Light, 1.0): grid, "Sold by Fixture Weaves", Product and Seller navigation, page 2 with "Sold by Fixture Pottery" on recycled cells, end marker, Back keeps the place | PASS |
| `seller-profile.yaml` (as built): header "No reviews yet", Reviews tab "No reviews yet.", no unverified body or label | PASS |
| `seller-reviews-verified.yaml` (stand-in): "Seller service: 4 out of 5 from 27 reviews", both basis labels, page 2 to the end, no unverified review, pull re-reads | PASS (Light 1.0 and Dark 1.3) |
| `seller-reviews-withdrawn.yaml` (stand-in switched off): a pull empties the list and the summary together | PASS |
| `shop-no-market-1/2`: device Market cleared -> "The Shop could not find your Market. Try again." (no "No Products", no other Market) -> Try again -> bootstrap re-placed the device (Market A) -> Products | PASS |
| `shop-offline-1/2`: clean install with the API unreachable -> "You are offline..." + Try again (no "No Products") -> API back -> Try again -> Products | PASS |
| Sign-in (real OTP) and `shop-signed-in` | PASS |
| `shop.yaml` Dark at font scale 1.3: every Seller line wraps as "Sold by ..." on recycled cells (screenshot) | PASS (second run; first run: harness quirks, ON-20261111-069) |
| Regression: `buyer-scene-explorer.yaml`, `catalogue-product-1.yaml` | PASS |
| No commerce: 0 carts; 5 reservations and 5 orders are seed rows, 3 orders WO-006 fixtures, 27 orders WO-007A fixtures | PASS |

The first attempt of the whole set failed at Home: Metro had been started without
`EXPO_PUBLIC_API_BASE_URL` (ON-20261111-062); restarted with it, everything above was re-run.
Fixture media removed from local MinIO afterwards; the disposable database rebuilt by the gate run.

## 20. Security review

Independent code and security review of `fe7ffb2..2000d1c^` (before its fixes): **no Critical or
High.** Findings and outcomes:

| Finding | Severity | Outcome |
|---|---|---|
| Trust ladder averages all reviews | MEDIUM (as reported) | Not live: 0028 replaced that ladder and reads no rating; recorded for future Trust rules (ON-20261111-058) |
| Test restores a hard-coded payment body (would overwrite WO-PAY-001's) | MEDIUM | FIXED: restores the captured definition; refuses a leftover stand-in (ON-20261111-064) |
| 0059 READ COMMITTED limit; SHARE could deadlock | LOW | Lock mode FIXED (SHARE ROW EXCLUSIVE); limit documented (ON-20261111-060) |
| Failure basis lacks Seller-fault attribution | LOW | Recorded for the founder (ON-20261111-056) |
| Self-review exclusion at read time | LOW | Recorded for the founder (ON-20261111-057) |
| Vacuous or timing-based tests | LOW | FIXED (ON-20261111-065) |
| Shop pull/progress/paused branch | LOW | FIXED (ON-20261111-066) |
| Seller link label not containing visible text | LOW | FIXED (ON-20261111-067) |
| packages/* commits on an app branch | LOW | Recorded; split at integration (ON-20261111-068) |

Checked and fine (review and this record): inner joins on NOT NULL keys; anonymised Reviews judged
through the Order Buyer; a Review naming another Seller is public for neither; the view's owner
bypasses the courier RLS on `core."order"` without exposing any Order field; `adulis_app` and
`adulis_readonly` hold EXECUTE on the invoker function, REVOKE FROM PUBLIC; list and summary read the
same view with the same Seller filter, filtered before LIMIT, tie-safe keyset, `no-store`; indexes
`idx_review_by_seller`, `idx_handoff_scan_by_order`, `idx_claim_by_order` serve the view; the removed
fields had no other consumer; no Seller can suppress a Review (no Seller-writable column, no new
write path); no private Buyer, Order, Claim or payment evidence leaves any public read; the
payment term folds to a constant today (One-Time Filter: false). Product availability and Scene
visibility code is untouched (cat-001a, disc-001, wo-007 suites green).

## 21. Unresolved issues

No Critical or High issue is open. Open and founder items from WO-007A (register entries):

- **Founder decisions:** ON-20261111-026 (available-first: option A or B, S11); ON-20261111-056
  (failure-basis mapping / Seller-fault attribute); ON-20261111-057 (self-review policy and its point
  in time); ON-20261111-029 (Review moderation policy and Operator capability); ON-20261111-053
  (sequence WO-PAY-001).
- **Engineering dependencies before any Review is public:** verified payment (ON-053, MEDIUM, release
  blocker), Review moderation (ON-029, release blocker), REV-01 write path (ON-054), OTP/Manual
  receipt (ON-055), Claim correction lineage (ON-059).
- **Accepted limits:** 0059's READ COMMITTED limit (ON-060); packages/* commits to split at
  integration (ON-068).
- **Pre-existing test isolation:** `e2-e6.jobs` stock.confidence_nudge counts other suites' variants
  (ON-070).
- **Recorded, not WO-007A scope:** the Catalogue taxonomy (ON-049, direction approved); Checkout's own
  validation (ON-010); universal links (ON-023).

## 22. Next recommended work order

1. Founder: choose ON-20261111-026's option, rule ON-056/-057, and sequence WO-PAY-001 (which
   unlocks public Reviews by replacing one function body).
2. A Reviews domain work order (REV-01 phases 2-3: Grant, resolver, received-line guard) together
   with the Review moderation foundation (ON-029), so the first public Review arrives complete.
3. The Catalogue taxonomy work order (ON-049) before any category UI.
4. WO-008 as the founder sequences it (not started).

## Outcome

**PARTIALLY COMPLETE.** Public Reviews and public ratings now follow the founder's rule exactly --
verified evidence only, one projection for list and summary, nothing stored is lost -- and because
the executable system has no authoritatively verified payment, no Review is public. That is the
honest result REV-01 S47 requires, not contract closure: verified payment (WO-PAY-001) and Review
moderation remain release blockers. The independent corrections are complete and natively
validated: the Shop no longer mistakes a missing Market for an empty one, the Seller link carries a
worded cue, a Market currency is fixed once it has Products, and the documentation items are closed.
Available-first is not implemented, by the work order's own safety rule, pending a founder choice.
No Critical or High issue is open. WO-008 not started.
