# WO-004A - Buyer For You feed integration

Status: complete, pushed, awaiting founder review. Branch `mobile/wo-004a-for-you-feed`, from
`967cd2d97e72c064a975c637f93e685d90cb686c` (the WO-DISC-002 head, so the branch carries the
backend). No pull request, no merge, `main` untouched. Part of the overnight batch of 10 November
2026; the morning register is `docs/overnight/OVERNIGHT-ISSUES-2026-11-10.md` (OVN-048 onward).

## 1. What changed for the Buyer

Buyer Home's **For You** channel no longer shows the WO-002 "coming update" line. It shows the real
Scene feed from `GET /v1/fyp`: one structured card per Scene (Seller, photo, caption, tagged
Products), scrolling into the next page, pull-to-refresh, and an honest state for every other
situation. Following, Nearby, Discounts and Locally Made are unchanged placeholders and never read
the feed. No Stories, no Scene Explore, no engagement control.

## 2. Client architecture

| Piece | File | Role |
|---|---|---|
| API call | `src/api/client.ts` | `fyp(cursor)` on the one HTTP boundary: generated types (`FypPage`, `FypUnit` from `@adulis/api-client`), the existing client/device headers and bearer, the 10 s timeout, the four failure kinds. `call()` gained optional query parameters. No subject, account, target or Market is ever sent |
| Feed hook | `src/buyer/for-you-feed.ts` | `useForYouFeed()`: TanStack `useInfiniteQuery`; `feedUnits` (Scene units only, each once); `feedSessionEnded`; `mediaUrl` |
| Card | `src/buyer/SceneCard.tsx` | One memoised card from the unit alone |
| Screen | `src/buyer/ForYouFeed.tsx` | States, FlashList, footer, pull-to-refresh |
| Route | `src/app/(buyer)/(tabs)/home/for-you.tsx` | Renders `ForYouFeed` |

Server data lives only in TanStack Query, in memory (ADU-MOB-02: "No persistent Query cache. In-memory
only."). Nothing is written to Zustand, SQLite or SecureStore.

### Query and pagination

- Key `['fyp', 'guest' | 'account', generation]`: the subject the server ranks for (never the
  bearer) and a refresh generation. Signing in or out changes the key, so a guest cursor is never
  continued by an Account (the server would refuse it anyway).
- First page without a cursor (the server starts a feed session); every later page only through
  `next_cursor`; no offset is ever computed. `getNextPageParam` returns the server's
  `next_cursor`, so `null` ends the feed.
- No silent refetch: `staleTime: Infinity`, no refetch on mount, focus or reconnect (each would
  restart the session under the Buyer's thumb). Network failures retry twice; a server answer never
  retries.
- `loadMore` asks for one page at a time and never into a standing next-page error (the footer's
  Retry is the only way back), so a failing page is not hammered.
- Duplicates: `feedUnits` keeps each Scene's first position, whatever a retried or overlapping page
  returns; the server also guarantees one Scene per session.

### Refresh and session behaviour

- Pull-to-refresh (and the empty state's and ended-session Refresh) bumps the generation: the new
  key's first request carries **no cursor**, so the server starts a new session. The previous cards
  stay visible until it answers (`placeholderData`, same subject only); **if the refresh fails they
  go and the error state shows**, so an old session is never continued after an explicit refresh.
- When a next page answers `VALIDATION_FAILED` with `slots.reason` `CURSOR_EXPIRED` or
  `CURSOR_INVALID` (expired session, retired version, Market change), that session's cards are
  removed and a full-screen "This feed has ended" offers Refresh (security review, OVN-055).
- `gcTime: 0`: a feed nobody shows is dropped from memory, so a remount starts a new session rather
  than reviving an old one. A guest-keyed request never carries the bearer.
- PRIVATE Scenes: the client never re-serves a unit from cache as new content. A new page or a new
  session is always the server's current answer; cards already on screen are not remotely deleted.

### Impression metadata

`feed_session_id`, `impression_id` and `algorithm_version` stay in the cached pages exactly as
served, for the later telemetry work order. The client mints no impression id and sends no
analytics: a render or a visible card is not a qualified impression (ANL-01 threshold not
implemented, OVN-036).

## 3. The card

Built only from the unit (no per-row request):

- **Seller**: initials and store name. No Trust badge: no public Trust read exists (OVN-034).
- **Photo**: Expo Image, the `card_key` derivative only, `contentFit="cover"` in a fixed 4:5 frame
  (MEDIA-01 names no aspect ratio, OVN-048), `cachePolicy="disk"` (public Scene media only, the one
  kind MOB-02 allows on the normal disk cache), `recyclingKey` per Scene for FlashList. No hotspots
  (R-06), no video, no autoplay. A failed load, a missing media origin or an unsafe URL shows a
  labelled "Photo unavailable" frame; the failure is keyed by image, so a recycled cell never
  inherits another Scene's failure.
- **Caption**: two lines (the server already bounds it to a 300-grapheme excerpt).
- **Tagged Products**: up to three names, then "+N more". An unavailable one reads
  "Name (Currently unavailable)", in words, not colour alone. Tags are labels, not purchase authority;
  no price is in the unit.
- **No controls.** Like, Save, Share, Reviews, Follow, More, Not Interested, Report and Explore the
  Scene have no backend, so none is drawn and the card does not navigate (Scene Explore is a later
  work order). This is a deliberate departure from the prototype card, recorded as OVN-051.

**Image URL safety** (`mediaUrl`): the origin must be http(s) (https only in a release build), with
no query or fragment; the key must be a plain object path (letters, digits, `. _ - /`, no `..`, no
`//`, no scheme). Anything else renders the fallback.

## 4. States

| State | What the Buyer sees |
|---|---|
| Initial loading | Spinner and "Loading Scenes" (polite live region) |
| Empty (including no Market / nothing servable) | "There are no Scenes to show right now. Pull down to check again." and Refresh; pull-to-refresh works |
| Offline / timeout / server error (first page) | The catalogue message for that failure (`failureMessage`), as an alert, and Try again; never content |
| Refreshing | The previous cards with the system refresh spinner |
| Loading next page | Footer spinner and "Loading more Scenes" |
| Next page failed | Cards kept; "More Scenes could not be loaded." plus the failure message, and Try again |
| Session ended | The old cards removed; "This feed has ended. Refresh to start a new one." and Refresh |
| No more results | "You have reached the end of this feed. Pull down to refresh." |

## 5. Accessibility

One screen-reader stop per card, in reading order: "Scene by {store}. {caption}. [Photo
unavailable.] Tagged Products: ..." with availability spelled out. The list is labelled "For You
Scenes". Loading and errors use live regions and alert roles. Text scales (verified at 1.3 on the
device: everything wraps, nothing clips). The avatar keeps the 44 dp size; buttons are the shared
`Button` (44 dp minimum). Colour is never the only carrier of a state.

## 6. Locale

Fourteen new keys in `@adulis/locale` (`buyer.for_you.*`), English and Amharic, in their own commit
(`packages/*` changes are not bundled with app changes). Amharic strings are machine-translation
placeholders listed in `MT-KEYS.md`; Amharic stays development-only.

## 7. Performance

- FlashList virtualises the feed; one memoised card component; `renderItem` stable per media
  origin; the flattened unit list is memoised on the query data.
- No N+1: the card renders from the feed unit; no Scene detail or Product request per row.
- Images load inside their own frame and never block the screen; disk-cached; no prefetch beyond
  FlashList's draw distance.
- Pagination: one request per page, none after the end and none into a standing error (asserted in
  tests and in the server's session counts during the native run).

## 8. Tests

`pnpm --filter @adulis/mobile test`: **135 of 135** (101 existing, 34 new).

| Suite | Count | Covers |
|---|---|---|
| `src/buyer/for-you-feed.test.ts` | 20 | Scene-only, first-position dedupe across pages, unknown unit types skipped; ended-session detection; media URL joining and every refusal (no origin, non-http, query, userinfo, backslash, parent segment, scheme, absolute and protocol-relative keys) |
| `src/buyer/for-you.test.tsx` | 14 | real route tree + fake API on the generated contract: placeholder replaced; guest request carries no cursor, no bearer, the device header; Scene units only, each once; no engagement control; one accessible label per card with availability in words; photo from the bootstrap origin and the labelled fallback on failure; empty state and Refresh as a new session; server error never replaced by content, then retry; offline message; pagination only through `next_cursor`, one request per page, none past the end; next-page failure keeps cards and is never retried unasked; an ended session drops its cards and offers a fresh feed; pull-to-refresh starts a new session and continues only the new one; a failed refresh never falls back to the old session; signed-in Account feed with the bearer, and a new guest session after sign-out; the other four channels stay placeholders and never read the feed |

Existing shell, auth and navigation tests now identify "For You loaded" by the empty-feed sentence
(the fake API serves an empty feed by default), and the shell test's tab census excludes the empty
panel's Refresh button. Test tooling: FlashList's own Jest setup and its ESM in
`transformIgnorePatterns` (OVN-049).

## 9. Native validation (Android emulator, real local API)

Setup: `Adulis_Pixel_8a_API_37` emulator; the WO-002 debug APK (its native dependencies and
`app.json` are identical to this branch, so Metro served this branch's JavaScript: OVN-052); the
API on port 3000 against the **disposable `adulis_gates` database** (the developer database was
never touched); `adb reverse` for 8081, 3000 and 9100 (local MinIO).

Development-only fixtures, created the production way: two Sellers, four Products (one sold out),
stock through `core.stock_event`, twelve Scenes created, imaged (real WebP bytes PUT to the
presigned URLs) and published through the Seller API. Removed afterwards: the twelve image
prefixes deleted from MinIO (verified 404) and the disposable database rebuilt.

| # | Check | Result |
|---|---|---|
| 1 | Launch as guest | pass (`buyer-for-you.yaml`) |
| 2 | For You loads real Scenes | pass; server: `technical-baseline-recent-v1`, DEVICE session |
| 3 | Photo, caption, Seller render | pass (screenshots); tags with "Currently unavailable" |
| 4 | Scroll loads the next page | pass: twelve Scenes, ten per page; the end appears after page 2; server session served 12 |
| 5 | Refresh | pass: pull-to-refresh; the server shows a second DEVICE session (served 10) |
| 6 | Sign in | pass (`buyer-auth-request.yaml` + `buyer-auth-verify.yaml`, fresh phone, development OTP log) |
| 7 | For You while signed in | pass: the restored session lands on the feed; server: two ACCOUNT sessions |
| 8 | Dark mode | pass (screenshot) |
| 9 | Enlarged text (font scale 1.3) | pass (screenshot): wraps, no clipping |
| 10 | Auth and shell regression | pass: `buyer-shell.yaml`, `buyer-auth-verify-link.yaml`, `buyer-auth-request.yaml` + `buyer-auth-leave-verify.yaml` |

Six existing flows used the old placeholder sentence as their startup marker; they now accept the
feed's label or the empty sentence. `foundation-smoke.yaml` (an Expo Go flow from WO-001) got the
same marker change and was not re-run.

`npx expo-doctor`: 20 of 20 checks passed.

## 10. Security review

An independent read-only review (separate agent, given the code and the review checklist of
WO-004A S3.29) found **no Critical or High issue**. Outcomes:

| # | Severity | Finding | Outcome |
|---|---|---|---|
| 1 | MEDIUM | Loaded cards never expire on the device: a Scene that turned PRIVATE stays on screen until a refresh, and an ended server session left its cards up | **Part fixed** (OVN-055): when the server ends the session the cards are removed and a full-screen Refresh shown (tested). How long loaded content may stay after the app returns from the background has no number in MOB-02 ("according to configuration"): **founder decision**; WO-004A S3.16 allows already-rendered content meanwhile |
| 2 | LOW | A remount within the default 5-minute cache life (navigator replacement, error-boundary retry) could revive the pre-refresh session and continue its cursor | **Fixed** (OVN-056): `gcTime: 0` |
| 3 | LOW | The media-origin check accepted userinfo (`https://media.adulis.et@evil.example`) | **Fixed** (OVN-057): no `@` or backslash in the authority; two tests |
| 4 | INFO | A guest-keyed request in flight when sign-in lands could carry the new bearer (the server refuses the cursor; no exposure) | **Fixed** (OVN-058): guest-keyed requests send no bearer |
| 5 | INFO | The cursor travels in the query string by contract; edge or proxy logs would record it | **Infrastructure** (OVN-059): strip query strings from those logs for /v1/fyp |

Found sound by the reviewer: the client sends only `cursor` (no account, Market, target or limit);
the cursor is opaque, never parsed, changed, persisted or logged, and lives only in the in-memory
query cache; the bearer never reaches a query key, URL, error message or image request; the cache is
cleared on sign-out and 401 and placeholder data never crosses subjects; a failed refresh removes the
old cards; nothing internal (impression, session, handle, slug, object key) is displayed; image keys
are refused for schemes, parent segments, `//`, a leading `/`, `%`, `?` and `#`, and release builds
require https; no engagement control exists; errors render only through catalogue keys; the test fake
is not imported by runtime code.

## 11. Validation

From this branch (the last of the batch), on a freshly rebuilt disposable database:

| Check | Result |
|---|---|
| `pnpm --filter @adulis/mobile typecheck` / `test` / `build` / `lint` | pass; **135 of 135** (re-run after the review fixes) |
| `pnpm --filter @adulis/api-client test`, `pnpm --filter @adulis/locale test` | pass |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | pass |
| `pnpm verify:deps`, `verify:contract`, `verify:appendix`, `verify:docs`, `verify:mt-keys`, `verify:error-locale` | pass |
| `pnpm db:check`, `pnpm db:determinism` | 16 of 16; pass |
| API Scene and FYP suites (`disc-001`, `disc-002`, fyp unit) | 100 of 100 |
| `pnpm test` (every package) | pass: API 762 of 762, mobile 135 of 135 |
| `pnpm verify:orphan-sweep` | pass |
| `npx expo-doctor` | 20 of 20 |
| Maestro, Android emulator, real local API | pass (section 9; run before the review fixes, which jest covers) |
| Mobile bundle scan for subscription copy | clean (only library identifiers such as `subscribeToStore`) |

## 12. Known issues and what remains absent

- No engagement actions, no Scene Explore, no Product detail from a tag, no Trust badge, no
  qualified-impression telemetry: each waits for its contract or work order (OVN-033, OVN-034,
  OVN-036, OVN-051).
- Photo frame ratio is a presentation choice until MEDIA-01 names one (OVN-048).
- Production For You serves nothing until the founder approves an algorithm version (OVN-030); the
  client shows the empty state, honestly.
- The developer database `adulis` does not have migration 0055 yet: run `pnpm db:migrate` before
  running this branch's API against it (OVN-053).

## 13. Commits

| Commit | Content |
|---|---|
| `330c39b` feat(locale): For You feed strings, English and Amharic | the fourteen keys, MT-KEYS.md |
| `24c21bb` feat(mobile): Buyer For You feed on the real /v1/fyp | client, hook, card, screen, route, tests, Maestro flows, Jest tooling |
| docs(mobile): record WO-004A and close the overnight register | this record, the register and its morning summary |

**WO-004A COMPLETE -- READY FOR FOUNDER REVIEW**, with the foreground refresh interval (OVN-055) and
the production For You decisions (OVN-030, OVN-032) open for the founder.
