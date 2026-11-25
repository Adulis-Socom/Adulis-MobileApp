# `apps/console` -- the Seller Console (clean replacement, rebuild-20261125)

Loaded together with the root `CLAUDE.md`. **Start your session here, not at the repository root**: the 15 permission
denials in `.claude/settings.json` load only from the directory a session starts in. `/context` and `/permissions` show
what loaded. This file describes the REPLACEMENT Console only; the archived Console (106 files, Reservation, payment,
payout and Orders screens) lives at tag `recovery/legacy-dev-20261125` and is evidence, never imported or restored.

**Governing documents** (effective 24 Nov 2026 editions, `docs/rebuild/SC-FE-00-CONSOLE-SOURCE-TO-SCREEN.md` is the
route map and authorization matrix): ADU-CONSOLE-02 v4.3, ADU-ONB-01 v3.2, ADU-AUTH-02 v3.3, ADU-PRV-01 v3.3,
ADU-MKT-01 v3.3; founder decisions D24-01..D24-18, RB25-D01..D14, B02-D03, B02B-D01..D03. `docs/rebuild/GOV-06-FIXTURE-AND-RELEASE-BOUNDARY.md`
governs fixtures. Where this file and a citation disagree, the citation governs.

## Scope of the workstream (Batch 02A: SC-FE-01 to SC-FE-03)

Built: shell, routing, Seller context, session boundary, sign-in/OTP/recovery/declarations, Seller chooser and switcher,
Seller admission (`/become-seller`), Publication Readiness Hub, Home (role-aware, readiness or operating brief),
Notification centre (read). **Not built, and the routes show an honest "arrives later" state:** Products and Inventory
(SC-FE-04), Scenes and Seller Stories (SC-FE-05/05S), Store and Couriers (SC-FE-06), Inbox and chatbot (SC-FE-08),
Insights, Trust, team/settings screens. **Never build here:** payment, payout, Order, Reservation, revenue, GMV, paid-Order
counts, delivery tracking, trust advancement, Government-ID capture, any backend feature, Mobile, Storefront, Operator.

## Toolchain (exact versions are in package.json; no ranges)

React 19 + Vite 7 SPA, `react-router` 7 (`createBrowserRouter`), TypeScript strict (shared `@adulis/config` base, DOM
lib), hand-written CSS over `@adulis/tokens` custom properties (no Tailwind, no UI kit, no state library, no data
library: staged, add one when a screen earns it). Messages come only from `@adulis/locale` (console catalogue
`en.console.ts`; a missing Amharic entry is a compile error). Unit tests: vitest (node environment, pure modules).
Browser tests: Playwright + `@axe-core/playwright`, run in CI.

## Commands (run from `apps/console`; heavy ones run in CI under the RAM policy)

| Command | What |
|---|---|
| `pnpm typecheck` | `tsc --noEmit` over `src`, `e2e`, configs |
| `pnpm lint` | ESLint (typescript-eslint, react-hooks, jsx-a11y), `--max-warnings 0` |
| `pnpm test` | vitest unit tests |
| `pnpm build` | release build (fixtures impossible) |
| `pnpm build:fixture-control` | fixture-enabled build, for CI journeys and as the positive control |
| `pnpm verify:release` | RN-1/RN-6 scan: release build with the fixture flag set has no fixture marker; the control build has all |
| `pnpm test:e2e` | Playwright journeys, isolation, responsive, axe, screenshots (`pnpm exec playwright install chromium` first) |
| `pnpm dev:fixtures` | Vite dev server with fixtures on (`ADULIS_FIXTURES=on`) |

CI job: `Seller Console (rebuild-20261125)` in `.github/workflows/rebuild-ci.yml`. Repository-level checks the Console job
also runs from the root: `pnpm verify:tokens`, `depcruise apps/console packages --config .dependency-cruiser.cjs`, and
`bash apps/console/scripts/verify-deps-fires.sh`.

## Architecture (what each directory is for)

```
src/
  main.tsx, router.tsx     entry, route table (URL carries the Seller: /s/:sellerId/*)
  transport/               THE choke point. port.ts (types), live.ts (generated client; no Seller operation exists, so
                           every call is an honest UNAVAILABLE), select.ts (build-time choice)
  contracts/gap-sc.ts      PROVISIONAL, versioned fixture contracts GAP-SC-01..07. Never the API contract.
  fixtures/                DEVELOPMENT ONLY. Reached only through the dynamic import in transport/select.ts behind
                           the build-time constant __FIXTURES__. Nothing else may import it (lint + depcruise enforce).
  session/                 session boundary, account context, sign-out cleanup
  seller/                  Seller-context boundary keyed by sellerId, capabilities, destinations, scoped data hook
  features/                auth/ entry/ onboarding/ readiness/ home/ notifications/ unavailable/
  components/              primitives, state panels, dialog, status mark, icons
  styles/                  tokens-driven CSS
e2e/                       Playwright (never imports src/ fixtures; it drives the built artifact)
scripts/                   release scan, dependency-rule fire test
```

## Rules that bite

1. **Seller context is the URL.** No mutable "selected Seller" store. The Seller subtree is keyed by `sellerId`; every
   Seller call carries the id; a response is committed only if its sellerId is still the current one (scoped data hook).
2. **The Console computes no business state.** It renders what the server resolved: capabilities, destinations,
   readiness items, eligibility outcome, countdown deadlines. Role names explain; capabilities authorize. At a deadline it
   refetches, it does not decide.
3. **Denial vocabulary:** missing permission HIDES; missing entitlement shows DISABLED with a reason; deferred feature =
   "arrives later" (non-interactive); unauthenticated = sign-in; restricted Seller = banner plus limited surface; unknown
   authorization outcome = fail closed ("could not confirm your access").
4. **Fixtures:** `FIXTURES_ON` is build-time. A release build cannot contain the fixture module, an `fx_` id, the banner
   sentence or the refusal code (RN-1). Fixture mode makes no network request (RN-2), fails closed on unsupported
   operations (RN-3), and shows the persistent Demonstration-data strip. The live transport refuses an `fx_` id (RN-5).
   Never hand-write `contracts/openapi.json` or `packages/api-client` to make a fixture type-check.
5. **No web storage, no token in JavaScript** (`localStorage`, `sessionStorage`, `document.cookie` are lint errors). The
   fixture session is in memory and is lost on reload by design.
6. **Every input has a `<label>`; validation renders a summary of anchor links plus per-field messages; every list has an
   empty state; a failed request is never rendered as an empty result.** One lime (`highlight`) action per screen, dark text.
7. **No fixed heights on anything holding text.** Amharic runs 30-50% longer. Layout in `rem`; tested at 150% and 200%.
8. **Palette is the tokens, nothing else.** No hex literal in `src/` (all colour is `var(--adu-...)`).
   No dark theme, no blue, no terracotta. Status is icon plus word, never colour alone.
9. **Generated files are never edited**, and the Console never imports from `apps/*` (rule 2 of the repository).
10. **Provisional decisions made without a governing requirement** are listed in `docs/rebuild/SC-FE-01-03-PROPOSALS.md` as
    proposals, not product rules.

## Lessons that each cost a CI cycle (do not relearn them)

- `Intl.DateTimeFormat` throws if `timeStyle` is combined with `timeZoneName`: use `timeStyle: 'long'` (src/i18n/t.ts has unit tests for both branches).
- The fixture session lives in memory, so a full `page.goto` resets the world. Tests navigate inside the app with `goInApp`, and use `signInHere` after sign-out, never `signIn`.
- A draft Seller Home has BOTH the readiness and Alerts headings: never assert exactly one of them with `.or()` without `.first()`.
- Text scaling is tested by setting the root font size; `scaleText` attaches on `readystatechange` and every scaled test calls `expectTextScale`, because an earlier version silently did nothing. The overflow assertion names the offending elements.
- Every one-column grid uses `grid-template-columns: minmax(0, 1fr)`, and flex children that hold text carry `min-width: 0`; an `input` is about 368px wide at doubled text.
- axe `target-size` is evaluated at the END of the page, where the sticky bottom bar covers nothing; everything else is evaluated at the top.
- `pnpm lint` has `--max-warnings 0` and `jsx-a11y/label-has-associated-control` depth 3; a type-only import counts as an edge for dependency-cruiser (keep shared types in `transport/port.ts`).

## Design

`PRODUCT.md` (product truth), `DESIGN.md` and `.impeccable/` (Impeccable direction contract, surface brief, design sidecar) describe the visual system: a ruled-row ledger, one lime action per screen, status as icon plus word. Change them with the CSS, not instead of it.

## Boundary

May import `@adulis/api-client`, `@adulis/locale`, `@adulis/tokens`, `@adulis/config`. Never anything under `apps/`.
The 15 `permissions.deny` entries must not be weakened, and a denied sibling path is not to be read through any other
tool. Shared edits (`pnpm-workspace.yaml`, `.github/workflows/`, `pnpm-lock.yaml`, `packages/locale`) are made only as
labelled, separate commits recorded in the delivery report; the lockfile is generated by CI and never hand-merged.
