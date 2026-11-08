# WO-001A - Mobile Foundation Closure: completion record

Status: complete on two stacked branches, pending founder review. Neither is merged; no PR.
Foundation only: **no product feature was implemented** (see "Explicit non-work").

| | |
|---|---|
| Accepted baseline | `mobile/wo-001-foundation` at `062aa740874cd3105dc0079200d976884bfd6502` (unchanged) |
| Branch A | `mobile/wo-001a-locale` - shared locale package |
| Branch B | `mobile/wo-001a-native-closure` - mobile closure, stacked on Branch A |
| Prototype | `AdulisCommercePlatformPrototype` `dev` at `f448d06b90f6cdafac0dcd48f9e70cfd2ce81d0e`, clean, read only |

## Founder decisions

- **D1 - identifiers.** Android `applicationId` and iOS `bundleIdentifier` are both
  `com.adulis.app`, permanently, unless the founder changes them.
- **D2 - mobile-safe localisation.** Shared + mobile-safe + console-only catalogue
  structure inside `@adulis/locale`; the mobile app imports only what is safe to ship.
- **D3 - Courier authentication direction.** Courier is a mode of the one app: one account,
  one MOBILE session, Courier as a relationship - never the console cookie, a second account
  or a second login. The API contract is NOT changed here (see Known gaps).

## Branch A - `mobile/wo-001a-locale`

Commits: `56b659fb40f72ae53857622f7b0499a889a8fb30` (the split), then
`1adacb0c824a659e3484a9fc0a75968d425f513e` (keep shared strings in `en.ts` / `am.ts`).

**Audit.** 771 keys. 667 are `console.*`. The other 104 were read value by value: 100 are
safe for every client - errors, health, common actions, obligations, deletion effects and
blockers, ownership transfer, chat escalation, SMS bodies - including marketplace commerce
copy (product price changed, buyer payment evidence, store level, app update). Four are
console-only by content: `app.title` ("Adulis Seller Console"),
`error.seller.tier_limit_reached` ("Your current plan does not include this."),
`sms.otp.step_up.subscription_change` and `deletion.blocker.subscription_past_due`.

**Architecture** (`packages/locale/src`):

| File | Holds |
|---|---|
| `en.ts`, `am.ts` | the SHARED strings (100 keys) - the whole mobile catalogue |
| `en.console.ts`, `am.console.ts` | the console's own strings (671 keys), including all software-subscription and billing copy |
| `catalogue.ts` | composes both into the full catalogue (`en`, `am`, `MessageKey`, `Catalogue`) |
| `index.ts` | root export - serves `catalogue.ts`; unchanged for `apps/console` |
| `mobile.ts` | `@adulis/locale/mobile` - re-exports `en.ts` / `am.ts` only, as `en`, `am`, `MobileMessageKey` |

Isolation is the import graph, not tree-shaking: `mobile.ts` never reaches `catalogue.ts` or
a console part. Strings moved verbatim: every key and value is byte-identical to `062aa74`.
Why the second commit: `apps/api`'s `t6-parked-decisions` reads `error.auth.otp_expired` from
`en.ts` / `am.ts` as text (deliberately, so the API never depends on the package). The first
cut moved those strings out and the test failed; with the backend out of scope, the package
kept the shared strings in `en.ts` / `am.ts` instead.

**Tests and gates.** `test/mobile.test-d.ts` (type-level: en/am parity, no `console.*` key,
the four exclusions, disjoint parts, the parts make the whole catalogue, a negative case);
`test/mobile-boundary.mjs` (TypeScript's own import scanner from `mobile.ts` - static,
side-effect, re-export, dynamic `import()` and `require()` - plus a software-subscription
vocabulary check on shared strings that deliberately allows marketplace words). Both run in
the package's `test`. The text readers moved to one function, `mt-keys-lib.readCatalogue`,
which reads the parts from `catalogue.ts`'s imports, so `verify:mt-keys` and
`verify:error-locale` check exactly what they checked before; `MT-KEYS.md` regenerated
(the four moved keys change position only; same 769 + 2).

**Files:** `packages/locale/{src/en.ts, src/am.ts, src/en.console.ts, src/am.console.ts,
src/catalogue.ts, src/index.ts, src/mobile.ts, package.json, mt-keys-lib.mjs,
generate-mt-keys.mjs, MT-KEYS.md, test/mobile.test-d.ts, test/mobile-boundary.mjs,
test/am-completeness.test-d.ts}`, plus `ops/scripts/verify-error-locale.mjs` and
`ops/scripts/verify-mt-keys.mjs` (they are the locale package's gates: two lines each to read
the catalogue through `readCatalogue`). No `apps/*`, contract, backend or migration change;
no lockfile change.

## Branch B - `mobile/wo-001a-native-closure`

Commit: the one that adds this file (`git log -1` on the branch); stacked on `1adacb0`.

- `@adulis/locale/mobile` wired in through `src/i18n/i18n.ts`: typed `MobileMessageKey`,
  English and Amharic, no runtime fallback (a missing string is a compile error in the
  package). `locale` joins the UI store as the single selection point; device-locale
  detection, when it comes, calls `setLocale`.
- Foundation screen: a diagnostic language selector ("foundation diagnostic, not Settings"),
  two real catalogue sentences (one long, for wrapping), and the catalogue's "Try again"
  as a real button that re-runs the diagnostic probes (Amharic button-height check).
- `app.json`: `android.package` and `ios.bundleIdentifier` = `com.adulis.app`.
- `scripts/check-locale-imports.mjs`, run first in `pnpm test`: fails on any
  `@adulis/locale` specifier other than `/mobile` anywhere in the app outside generated
  folders (quotes, backticks, deep paths Metro would resolve despite the exports map, paths
  into `packages/locale`); it self-checks its patterns on every run.
- Tests: locale selection and catalogue integration, the identity/EAS link, and Amharic
  rendering on the Foundation screen. 26 tests.
- Maestro flow targets `com.adulis.app` (see Device validation).
- `package.json`: `android` is now `expo run:android` (written by Expo prebuild).
- `apps/mobile/CLAUDE.md`: C-1 resolved, D1 identity, D3 Courier direction, native workflow.

## App identity

| | |
|---|---|
| Android package | `com.adulis.app` |
| iOS bundle identifier | `com.adulis.app` |
| Expo owner | `naod61s-team` (unchanged) |
| EAS project | `@naod61s-team/adulis`, ID `f1b64f7b-6725-4415-9466-d7fa7756fdbd` (unchanged; `eas project:info` confirms; no new project) |

`npx expo config` resolves both identifiers; a unit test pins them and the EAS link.

## Native build

**Result: the first native Android build of `com.adulis.app` succeeded and runs on the
emulator as its own app** (Expo Go is not installed on the device).

| | |
|---|---|
| Method | Expo CNG: `expo prebuild` generates `android/`, then Gradle `app:assembleDebug -PreactNativeArchitectures=x86_64` (debug variant; `expo run:android` does the same for one device). Installed with `agent-device install` |
| `expo-dev-client` | **Not installed** - a plain debug build loads JS from Metro; the dev client only adds a launcher UI the emulator workflow does not need |
| Result | `BUILD SUCCESSFUL` (326 tasks; 4 min incremental, ~35 min first run including dependency downloads) |
| APK | package `com.adulis.app`, label "Adulis", versionName 0.0.0 / versionCode 1, compileSdk 37, targetSdk 36, native code `x86_64` |
| Installed package | `com.adulis.app` (primaryCpuAbi x86_64), launched by agent-device and Maestro |
| Toolchain, all on G: | Gradle 9.4.1 in `G:\Android\Gradle` (nothing created under `C:\Users\naods\.gradle`), JDK 17.0.20, NDK 27.1.12297006 and CMake 3.22.1 in `G:\Android\SDK` |

Verified on device: Gradle, Android SDK, native dependency compatibility (expo-modules-core,
expo-sqlite, screens, safe-area, gesture-handler; reanimated and worklets arrive through Expo
Router's and expo-modules-core's own peer graph, as in the SDK 58 template), Metro, Expo
Router, SecureStore (session hydrates to "signed out"), SQLite (`3.53.3` from the native
module), theme, localisation, all three shells; no crash, no JS warning or error in logcat.

**Downloads.** services.gradle.org / GitHub release assets ran at ~30-50 KB/s and Google's
CDN at ~60-440 KB/s, with silent stalls in both the Gradle wrapper and `sdkmanager`. The
Gradle distribution and the NDK came from a public mirror (mirrors.cloud.tencent.com) and
were accepted only because they match the official checksums: Gradle's published SHA-256
(`2ab2958f...6cb`) and the SHA-1 Google lists in `repository2-3.xml` for the NDK
(`3bb7efc8...703`) and CMake (`292778f3...c1b`).

**Environment blocker, and the workaround used.** A native build from the workspace path
fails on Windows' path limits, twice: React Native's codegen task starts `cmd` in a
266-character directory (`CreateProcess error=267`; the limit is 258), and CMake/Ninja embed
absolute source paths in object directories well past the 248-character directory limit.
`C:` (NTFS) also has only ~2 GB free, and `G:` is exFAT (no junctions for pnpm, no ownership
for git). The build therefore ran from a **temporary short-path copy of the exact branch
state** - a git worktree at `G:\wo001a` on `1adacb0` with Branch B's diff applied, a
link-free pnpm install (hoisted, copied), and, in that copy's generated `android/` only,
`CMAKE_OBJECT_PATH_MAX=128` plus a short CMake staging directory. Nothing in the repository,
its configuration, or the machine's configuration changed. The worktree is deregistered;
**`G:\wo001a` itself is left for the founder to delete** (a safety check blocks automated
removal of a top-level folder).

**Founder action for repeatable native builds:** keep a checkout at a short path on an NTFS
drive with free space (for example `D:\a\adulis`, or free space on `C:`), or build with EAS.
Turning on Windows long paths alone does not lift `cmd`'s working-directory limit.

**Android 17 dev-build permission.** On launch the debug build asks to "find, connect to, and
determine the relative position of nearby devices" (`ACCESS_LOCAL_NETWORK`). Only React
Native's debug manifests declare it, and only debug code requests it (Expo's
`LocalNetworkPermission` checks `ReactBuildConfig.DEBUG`), because Android 17 blocks a debug
build's traffic to Metro without it - denying it produced "Unable to load script", allowing
it loaded the bundle at once. Release builds never prompt. This also corrects WO-001: the
failed Expo Go connection to `10.0.2.2:8081` was most likely this block, not the firewall.

**Debug APK permissions** (for the record): INTERNET, ACCESS_NETWORK_STATE, ACCESS_WIFI_STATE
(expo-network), ACCESS_LOCAL_NETWORK and SYSTEM_ALERT_WINDOW (debug only), USE_BIOMETRIC /
USE_FINGERPRINT (expo-secure-store), and Expo's defaults VIBRATE and READ/WRITE_EXTERNAL_STORAGE
(max SDK 32). No camera, location or notification permission. Trimming the defaults with
`android.blockedPermissions` is a release-hardening candidate, not done here.

## Localization

- Safe exports: `@adulis/locale/mobile` (`en`, `am`, `MobileMessageKey`); the app imports
  nothing else from the package.
- Parity: 100 / 100 keys in both languages, enforced at compile time both ways.
- **The Amharic is not yet human-translated.** 99 of the 100 mobile Amharic values are
  machine-translation placeholders awaiting the human pass that `MT-KEYS.md` tracks for the
  whole catalogue; one (`error.auth.age_declaration_required`) is deliberately English. The
  console keeps Amharic switched off until that pass; the mobile app must do the same for
  users. Nothing was machine-invented in this order.
- Device rendering (native app, light and dark): Ethiopic glyphs render (Android's system
  Noto Sans Ethiopic), the long obligation sentence wraps to three lines with no clipped
  glyphs, line heights hold, and the Amharic "Try again" button keeps the 44 dp height and
  left alignment of the English buttons. No typography defect found. Note for the brand
  typography work: the system Ethiopic face reads slightly lighter than the Latin text set
  beside it.

## Bundle policy

`expo export` (Android and iOS Hermes bundles), searched in both byte encodings Hermes uses
(UTF-8 and UTF-16LE): **0 of 12** console software-subscription probes present ("Compare
plans", "How to pay", "Billing period", "Business includes team access.", "Available on a
higher tier.", "Your current plan does not include this.", the subscription step-up and
past-due strings, `console.admin.subscription`, "Adulis Seller Console"...); **7 of 7**
marketplace and Amharic probes present (price changed, payment screenshot, order not
awaiting payment, store owner, app update, Amharic "Try again" and health sentence).

## Device validation

**agent-device, against `com.adulis.app`** (not Expo Go): foundation root; accessibility tree
with the three mode buttons and five radio buttons (System / Light / Dark, English / Amharic)
carrying labels and checked state; Buyer, Seller Companion and Courier shells, each showing
its active mode and the unchanged `Session: signed out`; mode switching; hardware back to the
root; System, Light and Dark; English and Amharic. Touch targets measured from element bounds
at 420 dpi: every button and radio is 43.8-44.2 dp tall - the `@adulis/tokens` 44 dp minimum
(Android's own guidance is 48 dp: a design-system decision, not changed here). Long English
and Amharic text wraps; nothing clipped. Metro and logcat: no warnings, errors or crashes.

**Maestro** (`.maestro/foundation-smoke.yaml`, 22 commands): **3 of 3 passes, including two
back to back**, launching `com.adulis.app` with `clearState` and only the dev-build
`ACCESS_LOCAL_NETWORK` grant: launch, root, Buyer, switch to Seller Companion, switch to
Courier (session line unchanged at each step, no sign-in surface), back to the root, then
Amharic selected and its real catalogue sentence asserted, and English restored.

## Validation and reviews

| Check | Result |
|---|---|
| `@adulis/locale` test (type-level + boundary), mutation-tested: root import, `export *`, side-effect import, dynamic `import()`, `require()`, subscription wording - each fails the test | PASS |
| `pnpm verify:error-locale` (62 codes) / `pnpm verify:mt-keys` (manifest current, 2 HUMAN-REQUIRED) | PASS / PASS |
| Mobile: locale-import guard (mutation-tested) + 26 jest tests / strict typecheck (TypeScript 5.9.3) | PASS / PASS |
| `expo export` + subscription-copy scan (above) / Expo Doctor | PASS / 20 of 20 |
| `pnpm typecheck`, `pnpm lint`, `pnpm build`, `verify:deps` (331 modules), `verify:deps-fires` (6 probes), `verify:contract`, `verify:tokens` | PASS |
| `pnpm test` across the repo, against disposable Postgres/MinIO containers (the local ones untouched) | packages, console and mobile PASS; API 632 / 635 |
| The 3 API failures | `t6-parked-decisions` was **caused by Branch A's first cut** and fixed in `1adacb0` (7 / 7 since). `c1-onboarding` is the known calendar assertion. `c6-accounts` hit a 429 rate limit under load and passes 24 / 24 alone; the API does not depend on `@adulis/locale` |
| TypeScript LSP | operational against the repo-local TypeScript (resolves `MobileMessageKey` through the new export) |
| Prototype | `dev` at `f448d06`, clean |

**Security Guidance.** Branch A: no vulnerability; its one finding - the boundary test only
followed `from '...'` imports - fixed with TypeScript's import scanner. Branch B: no
vulnerability; its one finding - the guard missed template-literal specifiers, files outside
`src/` and relative paths into the package - fixed. Credentials stay in SecureStore; the only
`EXPO_PUBLIC_*` value is the public API origin; the identifiers and EAS ids are public; no
secret, keystore or `credentials.json` is tracked; `android/` and `ios/` stay ignored.

**PR Review Toolkit.** Branch A: `CATALOGUE_PARTS` duplicated the composition - now derived
from `catalogue.ts`'s imports; stale wording fixed. Branch B: the guard now runs before jest
(extra jest arguments reach jest); `apps/mobile/CLAUDE.md`'s commands now describe the native
workflow; this report exists for the link it carries. Declined: none of substance.

## Known remaining architecture gaps

- **Courier contract (D3, approved, not done).** Future contract work must define Courier
  relationship eligibility, its exposure at bootstrap / session, MOBILE authorisation, the
  Courier endpoint permission surface, request and response schemas, generated types, and
  the matching session/auth design updates (ADU-API-01 S4 still places Courier on
  `audience = CONSOLE`). Until then the Courier shell is diagnostic and calls nothing.
- **Mode eligibility endpoint (CG-1).** Nothing in the contract tells the app which modes an
  account has; release builds stay Buyer-only.
- **`@adulis/api-client` generated types (CG-3).** Its index still exports no generated
  `paths` types; that is its own work order. No DTO was hand-written.
- **TypeScript version debt.** The repo stays on TypeScript 5.9.3; Expo SDK 58 expects
  ~6.0.3. `expo.install.exclude: ["typescript"]` is temporary debt until the monorepo moves.
- **Amharic human translation** (above).
- **A mobile copy for the tier-limit error.** `error.seller.tier_limit_reached` is now
  console-only; if the Companion ever receives that code it needs a capability-based mobile
  string ("... configured in the Seller Console", ADU-API-01 S4.1), authored in the shared
  catalogue with both languages.
- **Native builds need a short NTFS path** on this machine (see Native build). Until a
  checkout lives at one, a native rebuild repeats the build-copy workaround.
- **Touch-target size.** The tokens' 44 dp minimum is met; Android recommends 48 dp. A
  design-system decision for `@adulis/tokens`.
- **Release hardening (later):** trim Expo's default storage / vibrate permissions with
  `android.blockedPermissions`; signing, versioning and EAS profiles belong to the deployment
  work order.
- **Existing CI failures, unchanged.** CI on `main` is red at gate `migrate` (seed vs
  `NODE_ENV`); `c1-onboarding` asserts a calendar date now in the past; `c7` / `c6` are
  load-sensitive (each passes alone); `boot-smoke` cannot load a browser in this shell while
  `console-e2e` passes. None is touched by this order.
- **Prettier debt.** `en.ts`, `am.ts`, `generate-mt-keys.mjs` and
  `am-completeness.test-d.ts` were already not Prettier-formatted at `062aa74`; moved strings
  keep their formatting so the move stays reviewable.

## Explicit non-work

No product feature was implemented: no Home, FYP, Scenes, Products, Search, Orders, Chat,
Reviews, Stories, Seller operations, Courier operations, QR handoff, notifications UX or
Settings UX. No Courier API call exists. No prototype file, API contract, backend code,
database migration or generated client was modified.
