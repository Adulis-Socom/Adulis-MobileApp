# WO-018 -- Buyer accessibility completion

12 November 2026. Buyer Mobile frontend only: no backend, contract, database, payment or
Account-deletion policy change.

- **Branch:** `mobile/wo-018-buyer-accessibility-completion`
- **Starting point:** `mobile/wo-017-buyer-frontend-stabilization` at
  `ec8e1a11ce1822bc354293d3306145b4f3eed72d` (verified equal to the remote, clean tree).
- **Final SHA:** see the founder handoff (`WO-018-FOUNDER-HANDOFF.md`).
- **Issues:** [`WO-018-ISSUES-AND-BLOCKERS.md`](WO-018-ISSUES-AND-BLOCKERS.md).
  **Native and TalkBack:** [`WO-018-NATIVE-ACCESSIBILITY-VALIDATION.md`](WO-018-NATIVE-ACCESSIBILITY-VALIDATION.md).
  **How to try it:** [`WO-018-MANUAL-REVIEW-GUIDE.md`](WO-018-MANUAL-REVIEW-GUIDE.md).

## 1. Sources read

ADU-MOB-02 v4.3 S173 (accessibility: screen-reader labels, dynamic text, logical focus, accessible
error announcements, testing at 360 px Android) and S176 (dynamic type on every critical flow);
the WO-017 accessibility review (A-006) and handoffs; the WO-015..017 consolidated handoff, issues
file and review guide; `docs/engineering/DEVELOPMENT-STORAGE-POLICY.md`. The changes keep the
existing architecture: TanStack Query cursor paging, the session-bound private API, server-first
Collection state, the shared components.

## 2. Commits

| Commit | Change |
|---|---|
| `44c129d` | `feat(locale)`: Load more, loaded-count and Collection change strings (en + Amharic placeholders, MT-KEYS.md) |
| `2f858a5` | `fix(locale)`: loaded-count wording that holds after the last page (W18-05) |
| `e0a6aa4` | `fix(mobile)`: accessible Collection busy states |
| `1e1b2cb` | `feat(mobile)`: explicit accessible pagination controls |
| `16646f7` | `fix(mobile)`: long Product name accessibility |
| `05391db` | `fix(mobile)`: focus across Seller tab changes |
| `a23d57f` | `fix(mobile)`: Account deletion focus |
| `38780ea` | `test(mobile)`: accessibility regression cases |
| `67ecf4b` | `fix(mobile)`: security review Lows F1-F3 (with tests) |
| `80dbc39` | `fix(mobile)`: large text from Android's 130% (W18-12); tab labels never broken (W18-13), both found natively |
| `e00ff88` | `test(maestro)`: the WO-018 native flow |

The locale commits are separate commits on the branch; `packages/*` changes go in their own PR,
so the two locale commits are split out when this branch becomes PRs.

## 3. Modified components

`components/`: `Checkbox` (disabled, busy), `Button` (busy), `AlertText` (adds `StatusText`),
`AppText` (accepts a ref), new `focus.ts` (`useFocusRequest`).
`buyer/`: `SaveToCollection`, `SavedScreen` (`NewCollection`), `CollectionScreen`,
`SavedItemCard`, new `LoadMoreFooter`, `PublicListView`, `public-list.ts`, `for-you-feed.ts`,
`ForYouFeed`, `SellerProfile` (`ProductTile`, tab bar), `SearchResults` (Search row),
`DeleteAccount`.

## 4. A-006 resolutions

### 4.1 Collection busy states (Workstream A)

- **One change at a time.** Add to collection: while a tick is in flight, every box and New
  collection are disabled, and the box in flight is busy. A Create in flight disables every box
  too (review F2). A Collection screen: a Remove in flight disables the other Removes and
  Rename/Delete, and the reverse. One screen-level ref lock is checked first by Remove, Rename and
  Delete, also inside the Delete dialog (review F3). Refs guard two taps in one frame; Pressable
  `disabled` blocks taps natively.
- **Announced, not only dimmed.** `accessibilityState` carries `disabled` and `busy` (Checkbox,
  Button, the Remove control). The spinner beside a box is hidden from screen readers; the box
  says it is busy.
- **Results spoken.** "Added to {name}." / "Removed from {name}." after the server's answer and the
  re-read. The Collection screen's Remove now names its Collection; it said "Removed from Saved."
  for every Collection (W18-03). Failures stay AlertText (spoken).
- **Server state only.** Ticks still show the re-read membership; nothing optimistic. Session
  binding unchanged: nothing is sent, drawn or announced for a session that ended, including
  during the re-read (review F1). Authorization, quotas and deletion policy unchanged.
- **Focus.** The pressed box stays mounted through the change, so focus stays on it.

### 4.2 Pagination (Workstream B)

- **Load more** at the end of every public list (Shop, Search, Seller Scenes/Products/Reviews,
  Saved, a Collection, the conversation Product picker) and For You ("Load more Scenes").
- **One mechanism.** The button and the scroll trigger call the same `loadMore` of the same
  `useInfiniteQuery`: same opaque cursor, same key (filters, category, subject, Market), same
  de-duplication. No page numbers and no automatic full load. A Collection picker and the Saved
  Collections section keep their existing "load every Collection" behaviour (unchanged).
- **One request.** `fetchNextPage({ cancelRefetch: false })`: a second call while one is in
  flight, even in the same frame (scroll and tap), joins it instead of starting another.
- **Focus kept.** The button stays mounted: busy and disabled while loading, "Try again" after a
  failure (the same control). "Loading more" is spoken (`StatusText`); a failure is an AlertText.
  A page the Buyer asked for with the button is followed by "Loaded {count} more, just above."
  (counted after de-duplication; completion read from the page count, W18-04). Focus is not moved:
  the new items come just before the button. At the end the end sentence replaces the button.
- **For You.** Scenes only, the server's order and cursor, the existing card. No Product cards,
  no PRIVATE Scenes, no algorithm change, no production activation.

### 4.3 Long Product names (Workstream C)

- From Android's 130% font size up, public grids become one column (the list is re-laid out on a
  change) and `ProductTile` and the Search row show the Product name in full. The threshold
  compares rounded percentages: Android reports 130% as 1.2999999523 (W18-12, found natively).
- Tab rows (Seller Profile, Search, Saved, a Collection) keep equal widths at ordinary sizes; from
  130% each tab is at least its label's width and the row wraps, so no label breaks mid-word
  (W18-13, found natively).
- Below 130% the name stays two lines in a half-width tile. The full name is always the tile's
  accessible name and the Product's title (shortcut recorded in the code).
- No font is shrunk. The picker rows already showed full names. Price, availability, the Seller
  line and the Save control keep their own lines and controls.

### 4.4 Focus (Workstream D)

- **Seller Profile tabs.** Each tab is its own list, so a press remounts the header with the tab
  bar. The newly selected tab now takes screen-reader focus (`useFocusRequest`:
  `AccessibilityInfo.sendAccessibilityEvent(ref, 'focus')` after 150 ms), which reads it as
  selected; the Buyer continues into its content. Opening the profile moves no focus. Layout,
  order and visibility unchanged.
- **Delete Account.** Each step replaces the last. The new view's first line takes focus and is
  read: the phone instruction, the code sent, "Checking what deletion does", the consequences
  line, the blockers' heading, the outcome heading. The outcome is no longer also announced (it was
  heard twice). "Deleting your Account" is spoken. A failed check's Try again stays in place, busy,
  and says "Checking" again. No change to tickets, OTP, blockers, the idempotency key or the API.

## 5. Automated tests

See section 9 for the gates. New and changed tests (mobile 403 -> 427, 24 new):

- `components/a11y-states.test.tsx` (4): Checkbox states and ignored taps; Button busy;
  StatusText; `useFocusRequest`.
- `saved.test.tsx` (7): one change at a time in Add to collection (states, ignored tap, spoken
  result, removal); a refused tick; a timed-out tick; the Collection screen in Dark; review F1-F3.
- `shop.test.tsx` (6): Load more busy and spoken, next cursor once, de-duplicated count, the end;
  two requests in one frame send one; a failed page retried by the same button; names at 100%,
  115%, 130%, 160% (live change; 115% and 130% as Android's float values); Amharic in Dark at 160%.
- `for-you.test.tsx` (2): Load more Scenes (order, de-duplication, count, the end); a failed page.
- `seller-profile.test.tsx` (2): focus to the selected tab after each press, none on opening; the
  tab width rule at 100% and 160%.
- `account.test.tsx` (3): Delete Account focus per step and the outcome read once; "Deleting"
  spoken; a failed check's busy Try again and the blockers' heading.

Matrix coverage (work order sections 6 and 11): selection, removal, in flight, duplicate taps,
conflicting operations, success, rejection, timeout and screen-reader state are covered above;
session expiry (`saved.test.tsx` "an expired session fails safely" and F1) and Account switching
("Collections screens are bound to the session ...") by existing tests; Dark and enlarged text by
the Collection-screen and Shop tests. Short and very long names, English and Ge'ez, 1.0 / 1.3 /
1.6, two-column and one-column layouts are in `shop.test.tsx`; image alignment and the small
screen are native checks (validation document).

A Jest spy on `announceForAccessibility` or `sendAccessibilityEvent` shows the app asked for an
announcement or a focus move. It is not a screen-reader test.

## 6. Android native results

See the validation document.

## 7. TalkBack

See the validation document.

## 8. Security review

Independent read-only review of `ec8e1a1..38780ea` (mobile frontend only; backend enforcement not
reviewed): no Critical, High or Medium. Lows F1-F3 fixed in `67ecf4b`; Info F4-F8 recorded and
accepted (W18-10).

## 9. Gates

At `e00ff88` (founder handoff, Gates): all PASS except Expo Doctor 19/20 (upstream patch releases,
W18-14). Mobile Jest 427/427. The full parallel `pnpm test` passed in this run (API 983/983,
mobile 427/427); ON-126 stays OPEN (it failed in WO-017; nothing was changed to fix it).

## 10. Bugs fixed and remaining

Fixed: W18-03 (wrong Collection named on Remove), W18-04 and W18-05 (found and fixed in
development), review F1-F3 (W18-10), W18-12 and W18-13 (found natively; native re-check pending).
Remaining: see the issues file (W18-02, W18-08 environment; W18-09 observation; W18-11 TalkBack;
W18-14 Expo patch drift) and the carried items (B-010, S-001, ON-126, ON-162, ON-163).
