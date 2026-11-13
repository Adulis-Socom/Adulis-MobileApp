# PHASE-001 -- Mobile foundation comparison

13 November 2026. Work Order B3 and B4, read-only. Nothing was merged, copied or regenerated.
Evidence: `evidence/foundation-compare-1.txt` to `-6.txt`, `evidence/merge-simulation.txt`.

| | Foundation A: MOB-WO-0 | Foundation B: WO-001 to WO-022 |
|---|---|---|
| Ref | `origin/backup/mob-wo-0-preservation-2026-11-13` (`0f9b083`) | `origin/infra/wo-infra-010-014-closure` (`341d579`) |
| Origin | ADU-MOB-WO-01 v1.2, WO-0b, 7-8 September 2026; never committed until PHASE-001 | WO-001 to WO-022 plus WO-INFRA-001 to 014, October-November 2026 |
| Nature | a **toolchain and governance scaffold**: no screen, no domain, a placeholder tree | a **working app**: sign-in, Buyer shell and domains, Seller Companion and Courier shells, messaging |

## 1. Decision (B4)

**`infra/wo-infra-010-014-closure` is the official mobile foundation. MOB-WO-0 is a preserved reference,
not a competing baseline.**

Basis:
1. **Completeness:**
   - B has 205 files under `apps/mobile`, 39 route files, 140 source files and 27 test suites
     (520 tests).
   - A has 63 files: two real route files, one real component (`Text.tsx`), sixteen `.gitkeep`
     placeholders and one placeholder test.
2. **Currency:**
   - B is on Expo SDK 58, React Native 0.88.1 and React 19.3.0.
   - A is pinned to SDK 57, React Native 0.86.3 and React 19.2.3, one SDK behind.
3. **Verification:**
   - B is green in CI: 32 of 32 gates, 520 mobile tests, 1,004 API tests and 88 console
     end-to-end tests. It was natively validated up to WO-018.
   - A's CI fails (an obsolete image), and it was never built on a device.
4. **Architecture:**
   - B already implements the target stack: TanStack Query, FlashList, Zustand, SecureStore
     sessions, SQLite, the generated API client.
   - A has none of these wired.
5. **Infrastructure:** B carries the WO-INFRA fixes (test-database guard, teardown audit, pinned
   images, Node 24 actions). A predates all of them.

**The foundations must not be merged.**
- A simulated merge of A into B conflicts in 7 files: `CLAUDE.md`, `apps/mobile/CLAUDE.md`,
  `metro.config.js`, `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `gates.mjs` and
  `pnpm-lock.yaml`.
- A's dependency set would downgrade the SDK.

**What A offers is worth selective re-implementation, one work order at a time, against B.** Section 4
lists these items.

## 2. Comparison by area

| Area | A: MOB-WO-0 | B: closure line | Assessment |
|---|---|---|---|
| **Expo configuration** | `app.config.ts`: name, slug and scheme `adulis`; `runtimeVersion: { policy: 'fingerprint' }`; plugins for router, camera, notifications, secure store, SQLite and updates; **deliberately no bundle identifier or Android package** and no EAS project id; `typedRoutes: false`; `eas.json` with build profiles | `app.json`: name, slug and scheme `adulis`; package and bundle identifier `com.adulis.app`, guarded by `app-identity.test.ts`; EAS `projectId` and owner set; plugins router, secure store, SQLite, image, font, status bar; no `runtimeVersion`, no `expo-updates`, no `eas.json` | **Conflict of decisions:** A withheld the app identity on purpose; B fixed `com.adulis.app`. B governs (it is built and tested). A's fingerprint runtime policy and `eas.json` are release concerns for a later work order |
| **React Native dependencies** | expo 57.0.20, react-native 0.86.3, react 19.2.3, expo-router 57.0.19, reanimated 4.5.1, expo-camera, expo-notifications, expo-updates, expo-dev-client, expo-splash-screen; 21 dependencies, 12 dev, every version exact | expo ~58.0.24, react-native 0.88.1, react 19.3.0, expo-router ~58.0.31, TanStack Query 5.107.1, FlashList 2.3.2, Zustand 5.1.0, expo-image, expo-network; no reanimated, camera, notifications or updates yet; 22 dependencies, 8 dev | B is current. Camera (scan), notifications and updates arrive with their work orders in B |
| **Routing** | `apps/mobile/app/`: `_layout.tsx`, `index.tsx`, eight empty route folders (`(tabs)`, `auth`, `cart`, `chat`, `claims`, `orders/[id]`, `s/[handle]/p`, `scan`) | `apps/mobile/src/app/`: 39 files: `(buyer)` 24, `seller` 7, `courier` 2, `dev` 2, `_layout`, `index`, `+not-found`, `_sitemap` | B's tree implements the three-mode baseline; A's is a Buyer-only skeleton |
| **Authentication** | none (secure store installed, imported by 0 files) | `src/auth/` (`session.tsx`, `session-storage.ts`, `sign-in-flow.ts`): phone and OTP sign-in, session restore, sign-out; SecureStore used in 21 files | B only |
| **Shared UI** | `components/Text.tsx` | `src/components/`: AppText, AlertText, Button, Checkbox, ChoiceGroup, ErrorState, Loading, Placeholder, Screen, TextField, UpgradeRequired, focus helpers | B only |
| **Design tokens** | `@adulis/tokens/native`: a React Native role set (colour, elevation, motion, radius, space, typography) derived from ADU-MOB-03 S2, with contrast and derivation tests (7 source files, 2 tests); the package's root export unchanged | `@adulis/tokens` unchanged from `main` (web values and `tokens.css`); the app converts the web values to dp in one place, `src/theme/theme.ts`, with a test | **Design difference to rule on** (PHASE-001-DEC-03): a native sub-entry in the package (A) or app-side conversion (B). A change to `packages/tokens` needs its own PR |
| **Fonts** | Inter and Noto Sans Ethiopic (Regular, Medium, Bold), licences and sources recorded | no bundled font files; `expo-font` referenced in 3 files | A's Ethiopic font set serves the Ge'ez rule (Latin first, Ethiopic fallback); a candidate for a work order |
| **API client** | `@adulis/api-client` declared; 6 files mention it; no client wiring | `src/api/` (`client.ts`, `bootstrap.ts`, `config.ts`, `messages.ts`, `query-client.ts`) on the generated client | B only |
| **Application architecture** | the folder plan of ADU-MOB-01 S17.2 as empty folders (`features/*`, `session`, `store`, `notifications`) | `api`, `auth`, `buyer`, `seller`, `modes`, `providers`, `state`, `storage`, `device`, `i18n`, `theme`, `testing` | B is the architecture in use |
| **TypeScript** | extends `@adulis/config/tsconfig.base.json` then `expo/tsconfig.base` | the same order, with an explicit `types` list | equivalent intent; the files conflict textually |
| **Testing** | `jest-expo` 57 preset in `package.json`; 1 render test; node tests for gates (16) and tokens (18) | `jest.config.js` and `jest.setup.ts`, Jest 30 with `jest-expo` 58; 27 suites, 520 tests; 54 Maestro flows in `.maestro/` | B |
| **CI/CD** | `ci.yml` +63/-8 against `main`: commented Maestro and EAS stages; the gate list gains `mobile-gates` (the fourteen ADU-MOB-01/03 grep gates, with a self-test) | `ci.yml` +38/-15: the WO-INFRA hardening; 32 gates, no `mobile-gates` | A's fourteen gates are the most valuable governance item (section 4) |
| **Agent tooling** | moves `apps/mobile/.claude/settings.json` to the repository root (the staged rename), 27 permission rules; hooks (pre-commit gate, sensitive-write guard, format) and a secret scanner; two reviewer agents and two skills | keeps `apps/mobile/.claude/settings.json` (15 rules); no hooks or secret scanner | **Conflict:** where the mobile settings live. The workspace rules assume `apps/mobile/.claude/settings.json` |
| **Specifications** | `docs/adu/`: 16 documents (ADU-MOB-00 to 08, ADU-MOB-AMD-01 and 02, ADU-CMP-01 and others) | none of the 16 by name; the November 8 pack holds `ADU-MOB-02_v4.3` | **Authority question** (PHASE-001-DEC-04): A cites ADU-MOB-01 v1.2 as governing; the November pack outranks the older specifications. The set should be installed, if at all, as historical reference and only after reconciliation |
| **Registers** | `DEFECT-REGISTER.md` adds D-365 to D-391 | ends at D-364 (as `main`) | **Numbering collision risk** (PHASE-001-ISS-06) |
| **Package manifests** | root `package.json` and `packages/config/eslint.config.js` changed; `.dependency-cruiser.cjs` adds a `tokens-import-nothing` rule | root unchanged in those respects | `packageManager` pnpm@10.32.1 and Node `>=22 <23` are identical on `main`, A and B |
| **Lockfile** | blob `cd8a769f68`: +6,170/-191 against `main` | blob `280c686079`: +6,324/-164 against `main` | A against B: +2,612/-2,431. **Never merge by hand; not regenerated here** |

## 3. Files changed by both lines against `main`

`.claude/reference/DOCUMENT_AUTHORITY.md`, `.github/workflows/ci.yml`, `CLAUDE.md`, `apps/mobile/CLAUDE.md`,
`apps/mobile/metro.config.js`, `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `ops/scripts/gates.mjs`,
`ops/scripts/verify-docs-ascii.mjs`, `pnpm-lock.yaml`.

Seven of them conflict textually; the other three merge cleanly.

## 4. MOB-WO-0 items worth selective adoption (each a future work order, none authorised here)

| # | Item | Why it matters | Constraint |
|---|---|---|---|
| 1 | The fourteen mobile gates (`apps/mobile/scripts/gates/run.mjs`, with a self-test) | mechanises ADU-MOB-01/03 invariants that B enforces only by review | re-implement against B's tree and the November pack, not ADU-MOB-01 v1.2 alone |
| 2 | The secret scanner and the pre-commit hook | WO-INFRA-014 recorded "no gate exists for a secret scan" | a CI gate is preferable to an agent-only hook |
| 3 | Noto Sans Ethiopic and Inter, with licences | Ge'ez rendering consistency on Android | asset size; font-loading behaviour on first paint |
| 4 | `@adulis/tokens/native` and its contrast tests | measured contrast for the native roles | a `packages/*` change in its own PR; reconcile with `src/theme/theme.ts` |
| 5 | `PRIVACY-MANIFESTS.md`, `DEFERRED-GATES.md`, `eas.json`, the fingerprint runtime policy | store submission and release readiness | belongs to a release work order |
| 6 | The `docs/adu` specification set | the design history behind WO-0 | founder ruling on its authority first |

**Not to adopt:**
- the Expo 57 dependency set;
- the placeholder route tree;
- A's `jest` configuration and lockfile;
- the repository-root move of the mobile settings (it conflicts with the workspace rules).
