# WO-002 - Buyer application shell and core navigation

Status: complete, pushed, awaiting founder review. Branch `mobile/wo-002-buyer-shell`. No pull
request, no merge, `main` untouched. No backend, migration, OpenAPI, payment, Courier or worker
change. The next feature work order is not started.

## 1. Baseline

`mobile/wo-api-001a-auth-security` at `21ccc30634acb0bdca1de6f01e4ddb0da1c9afe1`, verified
against `origin` before branching.

## 2. Branch

`mobile/wo-002-buyer-shell`.

| Commit | Content |
|---|---|
| `c2d7333` feat(locale): add the Buyer shell strings | `packages/locale` only, for its own packages PR, which the mobile change needs first |
| `c5063eb` feat(mobile): build the Buyer application shell and navigation | routes, components, session sign-out, release gates, dependencies, `apps/mobile/CLAUDE.md`, the rewritten navigation test |
| `501f297` test(mobile): validate the Buyer shell navigation, gates and sign-out | the new tests and both Maestro flows |
| `907dedb` docs(mobile): record WO-002 completion | this record (this table added in the next commit) |

## 3. Buyer route structure

The route tree follows ADU-MOB-02 v4.3 S13 (`(buyer)/home/{for-you,...}`, `(buyer)/shop |
search | saved | orders | notifications | account/*`). Route groups add nothing to URLs.

```text
src/app/
  _layout.tsx              root Stack; navigation theme from semantic tokens; ErrorBoundary
  index.tsx                redirect -> /home/for-you
  +not-found.tsx           redirect -> /home/for-you (deep-link input is untrusted, S54)
  _sitemap.tsx             redirect -> /home/for-you (replaces the generated route list)
  (buyer)/
    _layout.tsx            Stack; activates Buyer mode; anchor (tabs): the tabs sit under
                           Search and Notifications even when a link opens one cold
    (tabs)/
      _layout.tsx          Tabs: home | shop | saved | orders | account ("You"); anchor home
      home/
        _layout.tsx        Tabs for the channels, drawn at the top by HomeHeader; anchor for-you
        for-you.tsx  following.tsx  nearby.tsx  discounts.tsx  locally-made.tsx
      shop.tsx  saved.tsx  orders.tsx  account.tsx
    search.tsx             opens over the tabs, with a header and Back
    notifications.tsx      opens over the tabs, with a header and Back
  dev/                     development builds only: foundation diagnostics, Amharic QA
  seller/  courier/        development builds only: the diagnostic mode shells
```

URLs: `/home/for-you` ... `/home/locally-made`, `/shop`, `/saved`, `/orders`, `/account`,
`/search`, `/notifications`. Later Buyer screens (Product, Scene, Seller, Checkout, Order
detail) join `(buyer)/` as Stack screens over the tabs, so the navigation is not rebuilt.

## 4. Bottom navigation

Exactly **Home | Shop | Saved | Orders | You** (S11), Expo Router JS `Tabs`, with Ionicons
icons that are filled when selected and outlined otherwise (state by shape, not only colour).
No Seller Companion or Courier entry. Home is the navigator's anchor and
`backBehavior="initialRoute"` (the combination Expo Router requires for an anchored tab
navigator): Back from any tab returns to Home, then leaves the app, and a screen a link opens
cold (Search, Notifications) has Home under it. Each tab keeps its state while another is open. Each tab's
accessibility label is its catalogue name (the navigator's default appends English "tab, 1 of
5", which a screen reader would speak in every language).

Why JS `Tabs` and not `NativeTabs`: `NativeTabs`' Android icons (`md`) need `expo-symbols`, a
new native module, which would force a native rebuild for an icon. `@expo/vector-icons` and
its `expo-font` peer are SDK-pinned JavaScript packages.

## 5. Home channel structure

For You (default), Following, Nearby, Discounts, Locally Made (S11), as a second `Tabs`
navigator inside the Home tab. Each channel is a route, so it is deep-linkable, keeps its
state while another channel is shown, and mounts on first visit only (`lazy`). For You is
the anchor, so Back from another channel - including one a link opened directly - returns to
For You. `/home` opens For You.

The Home header (`src/buyer/HomeHeader.tsx`) is the channel navigator's tab bar: the Adulis
wordmark, a Search button, a Notifications button, and the channel tablist. The tablist
scrolls sideways so five channels fit any phone width at any text size, keeps the selected
channel in view, and marks it by weight and underline as well as colour. Selection is route
state; nothing is stored in Zustand. "Locally Made" is the default label; MOB-02 makes its
wording Market-configured later.

## 6. Guest behaviour

Home, its channels, Shop and Search work for a guest. Saved, Orders, You and Notifications show
why they need an Account, with the design's wording where it gives one:

| Destination | Guest text |
|---|---|
| Orders | "Sign in to start ordering and track your orders." (MOB-02 S11, verbatim) |
| You | "Sign in to see your profile." (S11, verbatim) |
| Saved | "Sign in to save." (S39; prototype wording) |
| Notifications | "Sign in to see notifications." (prototype wording) |

Each adds "Signing in arrives in a coming update.": there is no sign-in screen yet, so there is
no sign-in button. Opening a tab never starts OTP, never creates an Account and never reads or
writes the credential. Appearance stays available to a guest because it is a device setting.

## 7. Signed-in behaviour

The shell stays in Buyer mode. Saved, Orders and Notifications show their "coming update"
placeholders instead of sign-in prompts. You shows Appearance, one line naming the Account
sections still to come, and **Sign out**. The session is read once at startup and survives
navigation.

**Sign out** clears the device (SecureStore credential, query cache, active mode) and, alongside,
revokes the session on the server with `POST /v1/auth/logout` (WO-API-001A), typed against the
contract (`satisfies keyof paths`). The device never waits on the network: the revoke has a
10-second abort, because React Native's Android HTTP client has no timeout of its own. If the
revoke fails, the device has still forgotten the session, and the server session expires or is
revoked from another session later. If the device cannot delete the credential, You stays signed
in and says so. Screen readers hear the signed-out state announced. A release build refuses a
non-`https://` API origin, so the bearer never travels over plain HTTP.

## 8. Release mode

A release build opens on Buyer Home and offers Buyer only. There is no mode switcher, no
diagnostics entry, no Amharic, and `/dev`, `/seller`, `/courier` and `/_sitemap` all land on
Buyer Home. `account_context` (WO-API-001A) is deliberately not read yet: wiring mode
availability is a later, controlled Mobile work order, and Courier stays fail-closed.

## 9. Foundation diagnostics

Moved, not deleted: the foundation screen is now `/dev` ("Developer diagnostics"), reachable
from a button on You in development builds only. It keeps the network, API origin, SQLite and
session probes, the theme switch, the Seller Companion and Courier shell entries, and the
Amharic QA language switch, which is the only language control in the app. A release build
redirects `/dev` to Buyer Home. The obsolete payment sample string (register MOB-1, Seller
payment confirmation) is replaced with a neutral health string, and no shell copy mentions
bank transfer or payment confirmation.

## 10. Locale

36 new keys in the shared catalogue (`packages/locale/src/en.ts` and `am.ts`), all whole
sentences, served through `@adulis/locale/mobile` only: tab and channel labels, the header's
Search and Notifications, the placeholders, the four guest messages, Appearance, Account,
Sign-in-coming and `common.loading`. EN/AM parity is a compile gate; `MT-KEYS.md` is
regenerated (805 placeholders awaiting the human pass, 2 HUMAN-REQUIRED unchanged). The only
English left in code sits behind `__DEV__` in the diagnostics, by the repository's existing
rule for diagnostic text. This is a `packages/locale` change in its own commit, for its own PR.

## 11. Amharic release gate

`useT` renders English in a release build whatever the store holds (`amharicAvailable()` is
`__DEV__`), so no leftover setting or future control can show unreviewed Amharic to a user. The
selector lives only in `/dev`. Development builds keep Amharic for Ge'ez layout QA. The
machine-translated catalogue still ships in the bundle; it is never rendered there.

## 12. Theme

Light, Dark and System, switched from You (Appearance) and stored as UI state, as before. Every
colour is a semantic token from `@adulis/tokens` through `src/theme/theme.ts`; the navigators'
own chrome (tab bars, stack headers, screen backgrounds) reads the same roles through
`navigationTheme()`. No palette change, no Theme Lab candidate, no colour literal. The touch
target stays the existing token (44).

## 13. Placeholders created

`src/components/Placeholder.tsx` (one text-only placeholder), `src/buyer/SignInRequired.tsx`,
`src/buyer/ChannelScreen.tsx`, `src/components/ErrorState.tsx` (the route error state: the
catalogue's generic error and Try again; no error text or stack shown). Placeholders say a
domain arrives "in a coming update" and never claim the Buyer has nothing. Nothing is fetched
for them.

## 14. Prototype references used

`AdulisCommercePlatformPrototype` `dev @ f448d06`, read only: the bottom navigation's five
labels with icons (`src/sections/ShellHelpers.tsx`, `src/sections/MobileBuyer.tsx` lines
113-125), the sideways-scrolling channel tablist with an underlined, bold selected channel
(lines 1690-1750), and the guest prompts for Saved and Notifications (lines 156-161). Nothing
was copied: no components, demo data, Stories, Theme Lab palettes or interaction rules.

## 15. Tests

| Suite | Tests | What it proves |
|---|---|---|
| `src/buyer/buyer-shell.test.tsx` | 16 | Opens on `/home/for-you` with exactly the five Buyer tabs (every selectable control minus the header buttons and channels, in order) and Buyer mode active; all five channels, For You selected; channel switching by route and Back to For You; a channel deep link with For You under it; `/home`; an unknown path to Buyer Home; tab state kept across tab switches and Back to Home; Search and Notifications over the tabs, also opened cold with Back to Home; guest Saved/Orders/You with no credential read or written; signed-in placeholders; Sign out (device cleared, revoke sent with the bearer and an abort signal; device cleared at once on a stalled network; failure logged without the credential); Light/Dark/System |
| `src/modes/navigation.test.tsx` | 9 | Development: diagnostics from You, every diagnostic mode shell and back to Buyer, session untouched; Amharic QA renders in diagnostics and in the Buyer shell. Release: no diagnostics entry or mode switcher; `/dev`, `/seller`, `/courier`, `/_sitemap` land on Buyer Home; a leftover active mode opens nothing; English even with Amharic left selected |
| `src/api/auth.test.ts` | 4 | Logout accepts 204 and 401, reports anything else by status only, aborts after 10 s, and a release build refuses a plain-HTTP origin |
| `src/i18n/i18n.test.ts` | 3 | Every mobile key resolves in both languages; locale switching; English in a release build |
| existing (`session` 7, `theme` 11, `app-identity` 1) | 19 | Unchanged and passing |

Total: **51/51** across 7 suites, plus the locale-import guard. Behaviour assertions only, no
snapshots. Gates: `@adulis/mobile` typecheck, test, lint and build (export scanned: no
subscription, billing or pricing copy); `@adulis/locale` test; repository `typecheck`, `lint`,
`build`, `verify:deps`, `verify:docs`, `verify:mt-keys`, `verify:error-locale`,
`verify:surface-markers`, `verify:tokens`. Expo Doctor **20/20** (after adding `expo-font`, the
peer `@expo/vector-icons` requires; a first run's config-schema check was a transient fetch
failure and passed on rerun). Backend suites not run: no backend code changed.

## 16. Native and Maestro

Device: the `Adulis_Pixel_8a_API_37` emulator (Android 17, 1080x2400), the accepted target.

**Debug build.** No development build was installed (the emulator had no saved state) and the
WO-001A short-path copy at `G:\wo001a` no longer held an APK, so the WO-001A strategy was
repeated rather than invented: the exact staged tree exported (`git archive`) to `G:\w2`, a
hoisted, copied pnpm install for `@adulis/mobile`, `expo prebuild`, and, in that copy's generated
`android/app/build.gradle` only, `CMAKE_OBJECT_PATH_MAX=128` plus a short CMake staging directory
(`G:\w2x`) - Ninja again failed on the Windows path limit without them. `assembleDebug` for
x86_64 then built in 3 minutes from the warm Gradle cache. Nothing in the repository or the
machine's configuration changed. Metro served the real repository.

**Maestro** (`.maestro/buyer-shell.yaml`, 48 commands): **pass** at the default text size and
again at 1.3x. It covers launch to Home / For You, all five channels (including scrolling the
bar to Locally Made), Back to For You, Search and Notifications over the tabs, Shop, guest Saved,
Orders and You, Appearance, Back from a tab to Home on the channel left, and no Seller Companion
or Courier text. `.maestro/foundation-smoke.yaml` (diagnostics via You, 21 commands): **pass**.
The first run exposed one real issue - a development warning toast covering the tab bar, from
anchored tab navigators using `backBehavior="firstRoute"` - fixed to `"initialRoute"`; the rerun
showed no warning in Metro.

**Clipping review** (screenshots): Home, You, Dark mode and Amharic at 2.0x text. Nothing clips:
the header and placeholders grow and wrap, the channel bar scrolls sideways, the Appearance
choices wrap, and all five English tab labels fit. **One Amharic finding:** at 2.0x the
machine-translated Saved label truncates with an ellipsis, because the stock tab bar keeps
labels to one line at a fixed height. Amharic is development-only, English fits at 2.0x, and the
human translation may choose a shorter label; shrinking the font to hide it is forbidden
(adulis-i18n-geez). It is a condition for enabling Amharic: a reviewed label, or a tab bar with
two-line labels.

Not validated natively: a **release** build (the debug build carries the dev diagnostics; the
release gates are proven in tests), iOS, and a physical Android phone.

## 17. Known deferred features

Not implemented, and nothing makes them look complete: the Scene domain; For You feed data;
algorithmic ranking; Following, Nearby, Discounts and Locally Made data; Seller Stories (no
placeholder either; the Stories contract is open); marketplace search; Products; Collections
and saves; Orders data; Checkout and payment; Reviews; Chat; Seller Companion; Courier; the
sign-in (OTP) screens; the bootstrap version-floor gate; `account_context`-driven mode
switching; notification reads and any push provider.

## 18. Backend gaps encountered

None blocks the shell; none was fixed here (no backend change).

- **Push to signed-out devices.** Founder ruling: a signed-out device must not receive
  account-private notifications. Notification routing (`apps/api/src/jobs/e2-notification.ts`)
  still pushes to every device row bound to the account with a token and GRANTED permission,
  live session or not (WO-API-001A, remaining gaps). It must change before a push provider is
  bound; this shell binds none.
- **Locally Made wording** is Market-configured (MOB-02 S11), but bootstrap carries no field for
  it; the shell shows the catalogue's default label.
- **Discovery, search, Saved and Orders contracts do not exist** for the November model (register
  API-1, DSC-*, PAY-*): no Scene/FYP feed, marketplace search, Collections, Stories or
  provider-model Orders endpoints. Each placeholder waits on one of them.
- Observed, unchanged: sign-in needs `POST /v1/devices` and `GET /v1/bootstrap` before OTP (register
  ID-1); the shell does neither yet, because sign-in is out of scope.

## 19. Next recommended work order

The shell is ready to receive Home and discovery features: every channel, tab and over-tab
screen has its route, state model and placeholder.

1. **Mobile sign-in and bootstrap** (unblocked now): device registration, the bootstrap version
   floor (UPGRADE_REQUIRED blocks everything, MOB-02 S85), OTP request/verify on the typed
   contract, storing the bearer, and turning the guest prompts into real sign-in entries (S72).
   `account_context`-driven mode availability can follow in the same or the next work order.
2. **Discovery backend first**: the Scene domain, FYP and marketplace search contracts (register
   DSC-*), so Buyer Home/discovery can be built against a typed API rather than placeholders.
3. Before Amharic is enabled: the human translation pass, and the Saved-label truncation above.
