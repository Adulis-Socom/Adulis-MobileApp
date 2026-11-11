# WO-010A -- Expo SDK 58 dependency stabilization (ON-20261111-117)

Work order WO-010A, Workstream A. Branch `mobile/wo-010a-dependency-environment-stabilization`.
Engineering record; it changes no product behaviour and no specification.

## 1. Audit before the change

`expo install --check` (Expo CLI from `expo@58.0.23`), 11 November 2026:

```
expo@58.0.23 - expected version: ~58.0.24
expo-constants@58.0.15 - expected version: ~58.0.16
expo-font@58.0.11 - expected version: ~58.0.12
expo-linking@58.0.16 - expected version: ~58.0.17
expo-network@58.0.4 - expected version: ~58.0.5
expo-router@58.0.30 - expected version: ~58.0.31
expo-secure-store@58.0.2 - expected version: ~58.0.3
expo-sqlite@58.0.15 - expected version: ~58.0.16
expo-status-bar@58.0.4 - expected version: ~58.0.5
```

Expo Doctor 1.21.6 reported 19/20 for the same nine packages (WO-010 log). `typescript` is excluded
from the check on purpose (`expo.install.exclude`; the repository's 5.9.3). Nothing outside SDK 58
was proposed, and SDK 59 was not considered (out of scope).

## 2. The change

`npx expo install --fix` (Expo's own workflow), then `pnpm install` to regenerate the lockfile. Commit
`b7e2b6a`.

| Package | Previous | New | Reason |
|---|---|---|---|
| expo | 58.0.23 | 58.0.24 | SDK 58 recommended patch (`expo install --check`) |
| expo-constants | 58.0.15 | 58.0.16 | same |
| expo-font | 58.0.11 | 58.0.12 | same |
| expo-linking | 58.0.16 | 58.0.17 | same |
| expo-network | 58.0.4 | 58.0.5 | same |
| expo-router | 58.0.30 | 58.0.31 | same |
| expo-secure-store | 58.0.2 | 58.0.3 | same |
| expo-sqlite | 58.0.15 | 58.0.16 | same |
| expo-status-bar | 58.0.4 | 58.0.5 | same |

Transitive changes pulled by those patches (lockfile only, all from the npm registry with sha512
integrity): expo-modules-core 58.0.30 -> 58.1.0, expo-modules-autolinking 58.0.17 -> 58.1.0,
expo-modules-jsi 58.0.22 -> 58.0.23, expo-server 58.0.6 -> 58.1.0, expo-modules-macros and the
`@expo/modules-macros-*` binaries 0.29.0 -> 0.33.0, expo-asset 58.0.20 -> 58.0.21, expo-keep-awake
58.0.3 -> 58.0.4, `@expo/cli` 58.1.19 -> 58.1.20, `@expo/metro-config` 58.0.21 -> 58.0.22,
babel-preset-expo 58.0.24 -> 58.0.25 and smaller `@expo/*` tooling patches. `getenv` 2.0.0 is no
longer needed and was dropped. No other package changed, no install script was added, and
`pnpm install --frozen-lockfile` reproduces the tree (gate `install-frozen`).

`expo install --fix` also added two config plugins to `app.json`: `expo-font` and `expo-status-bar`.
Both return the configuration unchanged when given no options (verified in their `app.plugin.js`),
so the generated Android project gains no permission and no manifest entry.

After the change: `expo install --check`: "Dependencies are up to date". Expo Doctor **1.21.6**
(pinned: 1.21.7 is broken, ON-20261111-117 history): **20/20 checks passed**, no check suppressed.
Mobile suite 291/291 at the dependency commit.

## 3. Is a native rebuild required?

**Yes.** The 9 November debug APK (`G:\w2`) was built against expo-modules-core 58.0.30 and the
previous native code of expo-sqlite, expo-secure-store, expo-network, expo-font, expo-constants,
expo-linking, expo-asset and expo-keep-awake. Those modules carry Kotlin/C++ code that is compiled
into the APK, and all of them changed version, so the new JavaScript served by Metro could run
against mismatched native modules. The old APK was therefore not trusted for this branch and was
not used.

## 4. The native build

**Result: BUILD SUCCESSFUL in 13 min 47 s (326 tasks, all executed), against the updated lockfile.**

| | |
|---|---|
| Source | `git archive` of `b7e2b6a` (the dependency commit) into a copy on the external SSD |
| Install | `pnpm install --frozen-lockfile --filter "@adulis/mobile..." --config.node-linker=hoisted --config.package-import-method=copy`: 1,718 packages from the existing pnpm store, 0 downloaded |
| Generate | `expo prebuild --platform android --no-install` (CNG; `android/` is never committed) |
| Copy-only settings | in the copy's generated `android/app/build.gradle`: CMake `buildStagingDirectory = G:/w10ax` and `-DCMAKE_OBJECT_PATH_MAX=128` (the 9 November recipe) |
| Build | Gradle 9.4.1 `app:assembleDebug -PreactNativeArchitectures=x86_64`, JDK 17.0.20, NDK 27.1.12297006 |
| Caches | Gradle home `G:\Android\Gradle` and SDK `G:\Android\SDK` reused unchanged: 0 downloads in the build log; nothing moved or reinstalled |
| APK | `com.adulis.app`, versionName 0.0.0 / versionCode 1, compileSdk 37, targetSdk 36, native code x86_64, 79,695,370 bytes, SHA-256 `ed6f0d63c705cd63...`; contains `libexpo-modules-core.so` and `libexpo-sqlite.so` built from the new sources |
| Location | `G:\w10a\apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk` |

Free space was checked before the build: C: 15.1 GB, G: 3,165.9 GB. The build wrote nothing to C:
(TEMP, `java.io.tmpdir` and the Gradle home were on the SSD).

Two environment problems on the way, neither in the repository:

1. **pnpm's workspace links cannot exist on exFAT.** The install adds every external package, then
   fails while linking the `@adulis/*` workspace packages (`EISDIR ... symlink`): pnpm links them
   with junctions, and exFAT has none. The 9 November copy (`G:\w2`) has the same empty
   `node_modules/@adulis` folder. A debug APK bundles no JavaScript (Metro serves it), so Gradle
   needs only the external native packages, which were complete.
2. **A `subst` drive breaks React Native codegen** (ON-20261111-122). The first attempt mapped `W:`
   to the work order's build folder for a short path. Autolinking resolves real paths, which turn
   `W:\` back into `G:\AdulisDevelopment\...`, while the codegen CLI path stayed on `W:`.
   `generateCodegenSchemaFromJavaScript` then failed for safe-area-context, gesture-handler and
   screens ("this and base files have different roots"). A direct path under
   `G:\AdulisDevelopment` is too long for CMake: the 9 November objects already reached 285
   characters from `G:\w2`. The copy was therefore moved (a same-volume rename, nothing
   reinstalled) to the short real path `G:\w10a`, with staging in `G:\w10ax`. An agent cannot
   delete top-level G: folders, so both are listed for the founder (handoff).

## 5. Android regression

The rebuilt APK was installed on a fresh emulator: Android 17 (API 37) Pixel 8a AVD, booted with its
temp on the SSD. Metro served the branch's JavaScript and used the shared Metro cache. The real
local API ran on the disposable `adulis_gates` database with the WO-CAT-001/006/007 fixtures and the
WO-010 category assignments. 31 Maestro flows were run
(`G:\AdulisDevelopment\WO-010A\scratch\wo010a-native.sh`). C: was checked before each flow; none
were blocked, and C: stayed above 15.6 GB. Logcat showed no crash, no `UnsatisfiedLinkError` or
`NoSuchMethodError`, and no JavaScript error.

| # | Area | Evidence | Result |
|---|---|---|---|
| 1 | Startup | `foundation-smoke.yaml` on the rebuilt APK; logcat clean | PASS |
| 2 | Router navigation | `buyer-shell.yaml`: five Home channels, five tabs, Back, Search and Notifications over the tabs | PASS (after the flow fix below) |
| 3 | Guest browsing | `buyer-shell`, `shop`, `search`, `seller-profile`, `buyer-scene-explorer`, `catalogue-product-1` as a guest | PASS |
| 4 | Authentication | `buyer-auth-request` + `buyer-auth-verify` (a wrong code refused, the right one signs in); two more sign-ins | PASS |
| 5 | Session restore | `buyer-auth-verify`: a cold relaunch restores the session | PASS |
| 6 | Sign-out | `buyer-auth-verify` (Sign out returns to guest); `saved-states` signed-out (private Collections gone at once) | PASS |
| 7 | Account switch | `card-saves` account-b: a second Account on the same device sees nothing of the first; its rows: the default Collection only | PASS |
| 8 | For You | `buyer-scene-explorer` starts in For You and opens a Scene from the feed; the For You Jest suites. `buyer-for-you.yaml` not run (ON-20261111-084: it needs its own 12-Scene fixtures and outruns its scroll budget) | PASS (partial) |
| 9 | Scene Explorer | `buyer-scene-explorer`; `buyer-scene-explorer-dark` | PASS |
| 10 | Product Detail | `catalogue-product-1` | PASS |
| 11 | Seller Profile | `seller-profile`; `card-saves` seller | PASS |
| 12 | Shop | `shop`; `card-saves` shop | PASS |
| 13 | Search | `search`; `card-saves` search | PASS |
| 14 | Category filters | `categories` shop, search, save (saved then removed: 0 rows left), dark | PASS |
| 15 | Saved Products | `card-saves-guest` 1/2 (the guest's save completes after sign-in: one SHOP row), `saved-guest` 1/2 | PASS |
| 16 | Saved Scenes | `card-saves` search and seller, `saved-collections` (rows from SEARCH, SELLER_PROFILE and SCENE_EXPLORER) | PASS |
| 17 | Collections | `saved-collections`: create, add, rename, remove from, delete | PASS |
| 18 | Offline handling | `shop-offline-1` (API stopped: "connection failed" and a retry, never "No Products"); `shop-offline-2` (API back: the retry registers and loads) | PASS |
| 19 | Dark mode | `card-saves` dark and `categories` dark (Dark at font scale 1.3); `buyer-scene-explorer-dark` (Dark at 1.0) | PASS |
| 20 | Enlarged text | the two dark flows at font scale 1.3 | PASS |
| 21 | API-client compatibility | `@adulis/api-client` tests and `generate:check` (generated client equals the contract); `verify:contract` and `contract-current`; every flow against the real API | PASS |
| 22 | No Checkout side effects | carts 0, reservations 5, orders 8 before and after every flow (seed and fixture rows only) | PASS |

**Flow fix (test maintenance, ON-20261111-125).** `buyer-shell.yaml` (last changed in WO-004A)
still asserted the placeholder sentences Search and the Shop had before WO-007 and WO-008 replaced
them; no work order since had run it. It now waits for the real Search start text, dismisses the
focused keyboard before Back, and accepts any resolved Shop state. No app code changed.

## 6. Automated gates (HEAD `28686e1`, disposable `adulis_gates`, rebuilt twice)

All green: `pnpm install --frozen-lockfile`; API 983/983; `@adulis/api-client` tests and
`generate:check`; mobile typecheck, lint, 291/291 and build; root typecheck, lint, build; `verify:`
contract, appendix, docs, deps, mt-keys, error-locale; `db:check` (16 PASS); `db:determinism`;
`verify:orphan-sweep`; the `gates.mjs` gates deps-fires, contract-prefix, extensions, worker-schema,
appendix-c, deferred-values, trust-before-open-signup, no-unsafe-eval, production-react,
contract-current, transcription, surface-markers, tokens, render-yaml, console-e2e, and boot-smoke
(from PowerShell); Expo Doctor 1.21.6 20/20. The mobile bundle scan matched only React Native's
internal keyboard `_subscription` identifiers in the two Hermes bundles, as in WO-010.

One flake: in the second database's parallel `pnpm test`, one API test,
`wo-sec-001-pool-starvation` (deletion OTP request), got 429 instead of 202. That is the shared OTP
ceiling between parallel suites (OVN-047 class; ON-20261111-126). The suite passed 19/19 on its own,
and the whole API suite passed 983/983 on the first database.

**iOS was not tested** (no macOS hardware; no EAS build was run).
