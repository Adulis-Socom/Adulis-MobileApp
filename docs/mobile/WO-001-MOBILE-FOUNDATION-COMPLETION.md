# WO-001 - Mobile Foundation and Architecture Reconciliation: completion record

Status: complete on branch `mobile/wo-001-foundation`, pending founder review. Not merged.
Foundation only: **no business feature was implemented** (see "Explicit non-work").

## Baseline

| | |
|---|---|
| Starting branch | `main` (equal to `origin/main` after `git fetch`; nothing to fast-forward) |
| Starting SHA | `01302cfb7616cb38de111de9a7694312c58c8913` (the setup baseline) |
| Work branch | `mobile/wo-001-foundation`, created from that SHA |
| Prototype reference | `AdulisCommercePlatformPrototype` `dev` at `f448d06b90f6cdafac0dcd48f9e70cfd2ce81d0e`, clean before and after; read only |

**Dirty-tree stop, resolved by founder decision.** The repository root held an untracked
`app.json` containing only the EAS `projectId` `f1b64f7b-...` (the output of `eas init --id`
run at the monorepo root). Per WO S1 work stopped and the founder was asked. Decision: use
that project, move its value into `apps/mobile`, delete the stray root file. Done; the root
file never entered git.

## Authority reconciliation

### Stale instructions corrected

| Ref | Where | Correction |
|---|---|---|
| S1 | `apps/mobile/CLAUDE.md` | "one application with two modes" replaced by one app with Buyer, Seller Companion and Courier modes; file rewritten for the real foundation, keeping the binding billing rule verbatim. Citations moved to the governing versions (ADU-API-01 v1.11, ADU-AUTH-01 v2.8). |
| S2 | root `CLAUDE.md` | Only the mobile row of the workstream table ("buyer plus seller lite, one app, two modes") and the mobile line of the start-session block. Nothing else touched. |
| S3 | `.claude/skills/adulis-seller-companion/SKILL.md` | The two-mode source line and the "Buyer <-> Seller mode switcher" scope item now describe sibling Buyer / Seller Companion / Courier modes. The Companion's scope, invariants and permissions are unchanged. |
| S4 | `apps/mobile/package.json` | Description: "one application with Buyer, Seller Companion and Courier modes." |
| S5 | `apps/mobile/CLAUDE.md`, root `CLAUDE.md` | Sessions start in `Adulis-Mobile-Workspace`; this repo stays the only write target; the CWD-relative `apps/mobile/.claude/settings.json` denials are restated as rules a workspace session follows by hand. Settings not weakened. |
| S6 | `apps/mobile/CLAUDE.md` | "Build against the Prism mock" replaced: contract and real API are authoritative; Prism serves the same contract for contract tests, deterministic development, isolated tests and unlanded endpoints, never as a competing spec. |
| S7 | `apps/mobile/CLAUDE.md` | Courier Mode acknowledged, with its contract conflict (C-2) and schema gap (CG-2) recorded. No courier endpoint or permission invented. |
| S8 | `apps/mobile/CLAUDE.md` | Kept "scan capture and queued sync are the only offline-capable operations" (it is doctrine) and added that SQLite is infrastructure only: no tables, caches or queues. |
| S9 | `apps/mobile/CLAUDE.md` | Mobile stack recorded against the approved target. `.claude/reference/STACK_BASELINE.md` left as is: its mobile line ("React Native + Expo") is terse, not wrong, and it is shared. |
| S10 | - | No storefront work. |
| S11 | `apps/mobile/CLAUDE.md` | Records that the prototype's "Account model unresolved" (its Canonical Rules 17.1-17.2) does not block the shell, and that the founder decision authorises no client-side creation of Seller or Courier relationships. Prototype not edited. |

### Conflicts deliberately left open (founder decisions)

| Ref | Conflict | Effect now |
|---|---|---|
| **C-1** | **`@adulis/locale` cannot be bundled in mobile without breaching the no-billing rule.** The catalogue is one object: 667 of 771 keys are `console.*`, including subscription, plan, tier ("Business includes team access."), "Compare plans", "How to pay", "Billing period". Metro bundles whole objects. An `expo export` scan confirmed these strings in the mobile bundle when the adapter imported the catalogue. Rule: apps/mobile/CLAUDE.md, ADU-PRD-01 S3, ADU-API-01 S4.1. | WO S21 "integrate @adulis/locale" is **not done**: the adapter was removed and the dependency dropped; a rescan shows no billing copy. Needs a `packages/locale` PR giving mobile a catalogue without console copy (its own PR, per the collision rules). `error.seller.tier_limit_reached` ("Your current plan does not include this.") should be checked in that split too. |
| **C-2** | **Courier Mode has no mobile contract.** ADU-API-01 v1.11 S4: MOBILE may call "buyer groups, plus the seller endpoints marked M"; the Courier surface is "Cookie, `audience = CONSOLE`". The founder decision puts Courier Mode in the mobile app. | The Courier shell calls nothing. Needs a contract/auth reissue or a founder ruling before any Courier feature. |
| C-3 | Prototype theme is light-only (Appearance shows System and Dark as "Not available yet"); WO S19 requires Light/Dark/System. | WO governs (newer founder decision). Implemented semantically; palette still provisional. |
| C-4 | The prototype has no in-app mode switcher; its role launcher is labelled prototype-only, and its spec says each surface shows only its own context. Where the production switcher lives and what it preserves is undefined. | Foundation buttons are diagnostic only. A later work order must define the switcher. |
| C-5 | Prototype terminology: Courier tab "Active" vs spec "Active Delivery"; Courier header "Courier Home"; "Seller" / "Seller Companion" / "your store"; Companion tab "Orders" vs header "Paid Orders". | Recorded for the feature work orders. |
| C-6 | Prototype Courier model ("Assignments", one active accepted delivery) vs API (seller assigns a courier; courier `custody-accept`). | Recorded for the Courier work order. |

## Expo

| | |
|---|---|
| Expo SDK | 58 (`expo` 58.0.23), scaffold from `create-expo-app` default template, generated outside git and migrated selectively |
| React Native / React | 0.88.1 / 19.3.0 (New Architecture / Fabric, Hermes) |
| Expo Router | 58.0.30, routes in `src/app` (the SDK 58 template convention) |
| Project owner | `naod61s-team` (the account that owns the founder-created project; the login `naod61` owns `naod61` and `naod61s-team`, neither named Adulis) |
| EAS project | `@naod61s-team/adulis`, ID `f1b64f7b-6725-4415-9466-d7fa7756fdbd`, linked with `eas init --id` (eas-cli 27.5.0); owner and ID live in `app.json`, no token stored |
| Expo Doctor | 20/20 checks pass (TypeScript deliberately excluded, see Dependencies) |
| Android applicationId | **OPEN - MOBILE APPLICATION IDENTIFIER REQUIRES FOUNDER DECISION.** None exists in the repo or the ADU documents; founder confirmed it stays open. iOS bundle identifier: same. |
| EAS build/update policy | None created (WO S29). |

## Dependencies

All installed with pnpm into the one root lockfile; Expo packages via `expo install` (SDK 58
ranges), others pinned exactly per repo convention.

| Package | Why |
|---|---|
| `expo`, `expo-router`, `react`, `react-native` | The app and its router |
| `react-native-safe-area-context`, `react-native-screens`, `expo-linking`, `expo-constants` | Required peers of Expo Router |
| `expo-status-bar` | Status bar follows the resolved theme |
| `expo-system-ui` | Required by `userInterfaceStyle: automatic` on Android (System theme) |
| `@tanstack/react-query` 5.107.1 | Server state |
| `zustand` 5.1.0 | UI state only |
| `expo-secure-store` | Opaque session credential |
| `expo-sqlite` | Local storage infrastructure (probe only, no tables) |
| `expo-network` | Connectivity for TanStack `onlineManager` |
| `@shopify/flash-list` 2.3.2, `expo-image` | Required by WO S24 as feed/catalogue foundations; not yet imported |
| `@adulis/api-client`, `@adulis/tokens` (workspace) | Contract seam (origin resolver), design tokens |
| dev: `jest-expo`, `jest`, `@testing-library/react-native` 14.1.0, `test-renderer` 1.3.0, `@types/jest`, `@types/react`, `typescript` 5.9.3, `@adulis/config` | Tests, types, shared strict tsconfig |

Not installed, on purpose: `@adulis/locale` (C-1); Expo Camera, Notifications and Updates
(no foundation use; no permissions requested; Updates needs release policy, WO S29); the
template's demo packages (`@expo/ui`, gesture-handler, reanimated, web, fonts, symbols,
splash-screen) and React Compiler.

**TypeScript stays 5.9.3**, the repo-wide pin. Expo wants `~6.0.3`; TypeScript only
type-checks (Babel bundles), strict typecheck passes, and a second major for one app would
split the monorepo. Recorded in `package.json` as `expo.install.exclude: ["typescript"]`.

## Architecture

**Provider hierarchy** (`src/app/_layout.tsx` -> `src/providers/AppProviders.tsx`):
Expo Router root (supplies `SafeAreaProvider`) -> `QueryClientProvider` -> `SessionProvider`
-> root `Stack`, with `Loading` while the session restores and the route `ErrorBoundary`
re-exported from Expo Router. Theme and locale need no provider: hooks over the UI store.
Both dependencies are injectable so tests boot the real tree.

**Modes** (`src/modes/`): `Mode = 'buyer' | 'seller' | 'courier'`.
`resolveAvailableModes()` is the backend-truth boundary: Buyer (every account's base mode)
in release builds; all three only when `__DEV__`, for diagnostics, shown on screen as such.
`activeMode` is UI state in Zustand, set by `ModeLayout` on entry and cleared on exit.
`ModeLayout` guards every route of a mode: an unavailable mode redirects to `/`, whatever
`activeMode` says. Routes: `/`, `/buyer`, `/seller`, `/courier`.

**Session** (`src/auth/`): `SessionStorage` interface; SecureStore implementation under one
key; `SessionState` = restoring | signedOut | signedIn(token). Startup hydration never
crashes and never deletes on a read error (transient keychain failures must not sign the
user out). `clearSession` is the single removal path: credential first (errors propagate,
so a failed delete is never reported as a sign-out), then query cache, then active mode.
Mode switching never touches the session. No endpoint types invented; no OTP flow.

**Server vs client state**: server state only in TanStack Query (`staleTime` 30 s,
`retry` 2, mutations never auto-retried, offline-aware via `expo-network` including the
starting state, foreground refetch via `AppState`). Zustand holds `activeMode` and
`themePreference` only.

**Theme** (`src/theme/theme.ts`): the one authority. Semantic roles straight from
`@adulis/tokens` `colorModes` (no copied values), Light / Dark / System, and the only place
CSS lengths (`rem`, `px`) become dp. Status colours stay the tokens' semantic triples; the
foundation's selected state is shown with a check mark and border, never colour alone.

**API boundary** (`src/api/config.ts`): the origin comes from `EXPO_PUBLIC_API_BASE_URL`
(public origin only) through `@adulis/api-client`'s `resolveApiBaseUrl`; real API or Prism
by changing one value (`.env.example`). No client or DTO exists yet (gap CG-3).

**Primitives** (`src/components/`): `Screen` (safe area, scroll, theme), `AppText`
(token type scale, no fixed heights), `Button` and `ChoiceGroup` (44 dp targets, roles,
labels, checked state), `Loading`.

## Files changed

Modified: `CLAUDE.md` (two mobile lines), `.claude/skills/adulis-seller-companion/SKILL.md`
(two lines), `apps/mobile/CLAUDE.md` (rewritten), `apps/mobile/package.json`, `pnpm-lock.yaml`.

Added under `apps/mobile/`: `.env.example`, `.gitignore`, `app.json`, `tsconfig.json`,
`jest.setup.ts`, `.maestro/foundation-smoke.yaml`; `src/app/_layout.tsx`, `src/app/index.tsx`,
`src/app/{buyer,seller,courier}/{_layout,index}.tsx`; `src/api/{config,query-client}.ts`;
`src/auth/{session-storage.ts,session.tsx,session.test.tsx}`;
`src/components/{AppText,Button,ChoiceGroup,Loading,Screen}.tsx`;
`src/modes/{modes.ts,ModeLayout.tsx,ModeShell.tsx,navigation.test.tsx}`;
`src/providers/AppProviders.tsx`; `src/state/ui-store.ts`; `src/storage/sqlite.ts`;
`src/theme/{theme.ts,theme.test.ts}`. Added: this file.

Outside the WO S53 list: none. Not changed: `ci.yml` (Mobile already joins every gate -
see Validation), root `package.json`, any `packages/*`, the prototype, migrations, contract.

## Validation

| Command | Result |
|---|---|
| `pnpm --filter @adulis/mobile typecheck` (tsc 5.9.3, full strict) | PASS |
| `pnpm --filter @adulis/mobile test` (3 suites, 22 tests) | PASS |
| `pnpm --filter @adulis/mobile build` (`expo export`, Android + iOS Hermes bundles) | PASS |
| `npx expo-doctor` | PASS 20/20 |
| Billing/tier scan of exported bundles | PASS after C-1 removal (only framework identifiers match) |
| `pnpm typecheck` (all packages) | PASS |
| `pnpm lint` (`eslint .`, whole repo) | PASS |
| `pnpm build` (api, console, mobile, packages) | PASS |
| `pnpm verify:deps` (318 modules) / `pnpm verify:deps-fires` (6 probes) | PASS / PASS |
| `pnpm verify:contract`, `verify:error-locale`, extensions gate | PASS (inside `ci:local`) |
| `pnpm ci:local` against disposable Postgres/MinIO | FAIL at gate `migrate` - **pre-existing**: `db:seed` refuses `NODE_ENV` unset; CI on `main` at `01302cf` fails at the same gate |
| Remaining gates run individually past `migrate` (seed with `NODE_ENV=test`) | 15 of 17 PASS: seed, worker-schema, determinism, permission-doc, docs-ascii, appendix-c, deferred-values, trust-before-open-signup, mt-keys, appendix, orphan-sweep, **console-e2e**, transcription, surface-markers, tokens, render-yaml. Two FAIL, neither from WO-001 (below) |
| `test` gate - `apps/api` (635 tests) | 618 PASS, 17 FAIL in 2 suites. `c7-chat-claims`: hook timeouts under concurrent load; **16/16 PASS when re-run alone**. `c1-onboarding`: 36 PASS, 1 FAIL - a test titled "lists ascending from today" asserts the hard-coded date `2026-09-11`, which is past today (2026-11-08): a calendar time-bomb in API test code, independent of this change |
| `boot-smoke` gate | FAIL - the headless browser in this shell loaded nothing (the gate itself attributes an empty DOM dump to a restricted shell); `console-e2e`, a real browser against the real API, PASSES |
| `pnpm --filter @adulis/console test` / packages tests | PASS (console has no unit tests by design; its e2e gate passed) |

The disposable containers (`wo001-pg` :55432, `wo001-minio` :59000) mirrored `ci.yml`'s
service setup so the local `adulis-postgres` and `adulis-minio` were never touched.

**Lockfile effect on other workspaces, checked.** No package was removed and no direct
dependency of `apps/api` or `apps/console` changed version. Two optional-peer contexts
moved: API's ts-jest 29.4.12 now sees jest-family peers at 30.5.x (API's own jest stays
30.4.2 and its runner chain resolves wholly within 30.4), and Console's Vite now sees
`lightningcss` (unused by its config). API compiled and ran 42 suites through ts-jest.

**CI.** No workflow change needed: `ci.yml` runs `ops/scripts/gates.mjs`, whose typecheck,
lint, deps, build (`expo export`), and test gates now include `@adulis/mobile`; no emulator
or native build runs in CI. Caveat: CI scopes builds and tests to `...[origin/main]` with
the root package excluded, so a lockfile-only change re-runs nobody - which is why API was
re-tested locally here (its ts-jest now resolves optional jest peers at 30.5.x).

## Reviews (WO S48-S50)

- **Security review** (credential storage, `EXPO_PUBLIC_*`, session handling, deep-link
  scheme, secrets, debug tooling, network origin): no high-confidence vulnerability.
  Follow-up applied: `credentials.json` (EAS local credentials) added to
  `apps/mobile/.gitignore`.
- **PR Review Toolkit** (code reviewer, silent-failure hunter, test analyzer). Applied:
  startup hydration no longer deletes the credential on a read error (a transient keychain
  failure would have signed users out for good); `apiOrigin()` names the mobile variable
  instead of the shared resolver's `VITE_` one; the online manager reads the starting
  network state (a cold start in airplane mode counted as online); `activeMode` is cleared
  when a shell unmounts (it outlived the shell); tests added or tightened for signed-in mode
  switching, a leftover `activeMode` against the guard, and `useTheme` wiring. Recorded, not
  changed: the root `Loading`-before-navigator window (latent), 4xx-aware retry (needs the
  fetch client's error shape). Declined: removing FlashList / Expo Image (WO S24 requires them).
- **Simplicity pass**: no path aliases, no context providers beyond query and session, no
  i18n layer while C-1 stands, five primitives each used, SQLite reduced to a probe, every
  dependency traced to a use or a WO requirement; template demo code, assets and React
  Compiler not carried over.

## Device validation (Adulis_Pixel_8a_API_37, Android API 37, Expo Go SDK 58)

- Metro: clean start, Android bundle 1388 modules, no warnings or errors in Metro or in the
  app's logcat (`ReactNativeJS` warn/error and fatal: none). New Architecture (Fabric) on.
- agent-device: root renders with heading, three mode buttons, the dev-unlock notice,
  Theme radio group (System checked), and diagnostics `Session: signed out`,
  `Network: online`, `API origin: unavailable (EXPO_PUBLIC_API_BASE_URL is not configured
  ...)`, `SQLite: 3.53.3` (native module linked).
  Accessibility tree: buttons "Open Buyer / Open Seller Companion / Open Courier", radios
  "System / Light / Dark" with checked state. Buyer, Seller Companion and Courier shells
  each render "<Mode> foundation ready", the right active mode, the unchanged session line,
  and switch/back buttons. Dark theme applies to page, text, accent and status bar. Hardware
  back returns to the root. No clipped content at 1080x2400; long lines wrap.
- Maestro (`apps/mobile/.maestro/foundation-smoke.yaml`, 22 steps): PASS three times,
  including back-to-back runs and a final run on the final code after a Metro restart:
  root, Buyer, switch to Seller Companion, switch to Courier, back; session line unchanged
  throughout and no sign-in surface. It runs inside Expo Go (`host.exp.exponent`) because
  the app identifier is open; it never invents one.
- Native development build: **not run** - blocked by the open applicationId (WO S27/S38).

Environment notes for the next session: this Claude session started with a stale copy of
the Windows environment (no `ANDROID_HOME`, no `adb` on PATH) although the persisted user
variables are correct; values were passed per command and nothing was reconfigured.
Restarting VS Code fixes it. The host LAN address is unreachable from the emulator on port
8081 (firewall), so use `adb reverse tcp:8081 tcp:8081` and `exp://127.0.0.1:8081`.
agent-device and Maestro cannot hold the device's UI automation at the same time.

## Known gaps

- **CG-1 - no source for Seller/Courier eligibility.** `/v1/bootstrap` carries no account
  relationships; ADU-API-01 S5.1 says verify returns `{ token, expires_at, roles[] }`
  (`roles[]` a rendering hint), but `contracts/openapi.json` publishes no response schema
  for `/v1/auth/otp/verify`, the `roles[]` vocabulary is unspecified (only `COURIER` is
  named), and nothing re-reads it after a cold start. Hence Buyer-only release builds.
- **CG-2 - missing response schemas.** `/v1/courier/orders`, `/{id}`, `/{id}/custody-accept`
  (and verify, sessions, seller list) declare `"description": ""` with no schema, so the
  generated types cannot describe them.
- **CG-3 - `@adulis/api-client`.** Its index exports no generated `paths` types (a typed
  client needs a `packages/api-client` PR); its header comments still say `schema.d.ts`
  does not exist; `resolveApiBaseUrl`'s unset message names `VITE_API_BASE_URL`.
- Application identifier: OPEN (above). Blocks the native build and a dev-client Maestro run.
- C-1 (locale) and C-2 (Courier contract): above. Amharic rendering on device is unverified
  until C-1 is resolved; layouts fix no text height.
- **CI is red on `main` before WO-001** (gate `migrate`, seed vs `NODE_ENV`), so this
  branch's CI will be red at the same gate for the same reason.
- TypeScript LSP: **operational** against the repo-local TypeScript (hover and
  go-to-definition into `packages/tokens` work).
- Latent: the root layout renders `Loading` before the navigator while the session
  restores; navigation fired during that window would be dropped. Revisit with the
  notifications/auth work order.
- Retry policy does not yet skip 4xx: needs the error shape the fetch-client work defines.
- Future permission/configuration work: Camera, Notifications, Updates, deep-link App
  Links (https; needs a domain), store identifiers, EAS build/submit profiles.
- Not reconciled here: the Seller Companion skill still cites ADU-API-01 v1_3 and
  ADU-AUTH-01 v2_0 as governing sources (superseded); the workspace `CLAUDE.md` and
  `SETUP_REPORT.md` still list S1-S9 as stale (outside this repository; update after merge).
- Recommended: a gate that scans the mobile export for billing language, once a word list
  is agreed.

## Explicit non-work

No business feature was implemented: no Home, FYP, Scenes, Products, Search, Collections,
Cart, Checkout, Payment, Orders, Chat, Reviews, Stories, Seller or Courier operations,
QR handoff, notifications UX or account settings UX. No prototype component or demo data
was copied. No fake business data exists outside test fixtures. No prototype file, database
migration, contract, generated client or `packages/*` file was modified.
