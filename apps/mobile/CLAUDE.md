# `apps/mobile` — the Adulis mobile app

**Buyer shell (WO-002) on the WO-001/WO-001A foundation.** An Expo SDK 58 app,
`com.adulis.app`: the Buyer application shell (five tabs, Home channels, guest and signed-in
states, all structure and no domain data), with the Seller Companion and Courier shells kept
as development-only diagnostics. No product domain is built. What exists, why, and what is
still open: `docs/mobile/WO-002-BUYER-SHELL.md`, `docs/mobile/WO-001-MOBILE-FOUNDATION-COMPLETION.md`
and `docs/mobile/WO-001A-FOUNDATION-CLOSURE.md`.

**System design (current authority, founder decision WO-001B):** ADU-MOB-02 v4.3 (its
S232 is the post-October-13 reconciliation and wins inside the document) - ADU-AUTH-02
v3.3 - ADU-ARCH-PLATFORM-01 v3.3 - ADULIS-KB v3.3, all in `docs/system-designs/2026-11-08/`
(index: `docs/system-designs/README.md`). They outrank the documents in the next line for
design intent. Precedence and conflicts: `.claude/reference/DOCUMENT_AUTHORITY.md`.

**Implementation contract (what is built and gate-checked):** ADU-ARCH-01 v2.0 S2, S3 -
ADU-API-01 v1.11 S4.1, S5.1, S12 - ADU-AUTH-01 v2.8 S5.2, S19 (v2.5 for the permission
catalogue) - ADU-REPO-01 v1.3 S10. Where these disagree with the system design, the status
is `SPEC_CONFLICT`: report it, and do not build either side.

UX and presentation only: the prototype (below).

> **This file CITES the specifications; it does not replace them** (ADU-REPO-01 v1.2 S6).
> Where a rule is inlined below for practicality, **the citation beside it governs, and the
> inlined line is the first thing to check when the two disagree.** A rule kept in two
> places grows a stale copy, and the copy an agent reads first is the one it follows.

## What it is

**One application with three modes — Buyer, Seller Companion and Courier — not three
apps** (founder decision, WO-001). ADU-PRD-01: *"Roles are relationships, not accounts."*
Separate projects would mean separate builds, store listings and review queues for one
person's phone.

**Mode switching never re-authenticates** (founder decision). ADU-API-01 S4 already holds
this for Buyer and Seller Companion ("one account, two modes", one MOBILE session). For
Courier it does not yet: see the Courier line below (conflict C-2).

**The client never manufactures eligibility.** `availableModes` is backend truth and
`activeMode` is UI state. The contract has no source yet for an account's Seller or Courier
relationships (completion report, gap CG-1), so a release build offers Buyer only and a
development build unlocks all three shells for diagnostics (`src/modes/modes.ts`).

The prototype's "the production Account model remains unresolved" (its Canonical Rules
17.1-17.2) is stale. November reconciliation R-23 resolves it: one ordinary Account that can
be a Buyer, own Sellers, hold Seller team roles and hold one Courier profile, with Operator
a separate identity that is never a mobile mode. Nothing here authorises client-side
creation of a Seller or Courier relationship.

Credential: an opaque bearer token in native secure storage (Expo SecureStore) - never
AsyncStorage, never a cookie, never decoded as a JWT. `audience = MOBILE`.

## The one non-obvious rule, worth writing before anyone starts

> **No price, no tier name and no billing link may appear anywhere in the bundle.**
>
> ADU-PRD-01 S3 and ADU-API-01 S4.1, reaffirmed by the November pack (R-19: Mobile has no
> software-subscription purchase or billing surface): this is what keeps the apps outside Apple's
> In-App Purchase and Google Play Billing requirements, both of which would take
> 15-30% in card rails incompatible with manual ETB bank transfer.
>
> **A mobile session receives 403, never a redirect** - a redirect is itself a link to
> an external purchase mechanism.
>
> Where a response must convey a tier limit it names the **capability** and **where it
> is configured**: `slots: { capability: "custom_flows", configured_in: "console" }`,
> rendered as *"Custom flows are configured in the Seller Console."* Never a tier, never
> a route to change one. This is why the error contract returns `message_key` and
> `slots` rather than server-composed prose - the error contract is where a price leaks
> if it leaks.

**Strings come from `@adulis/locale/mobile` ONLY** (founder decision D2, WO-001A). The
package root and its console parts carry the console's subscription, plan and billing copy;
the mobile export is built from the shared parts alone. `scripts/check-locale-imports.mjs`
(inside `pnpm test`) fails on any other `@adulis/locale` specifier, deep paths included.
A string the app needs that is not in the shared catalogue is a `packages/locale` change in
its own PR, with both languages. **Amharic stays disabled for users until a human
translation review** (November R-19): the current Amharic strings are machine-translated,
and the foundation screen's language choice is a development diagnostic that must not reach
a user release. After adding strings, scan the export
(`pnpm --filter @adulis/mobile build`, then search `dist/`) for subscription copy.

## The rest, in brief

- **The Companion reaches only the endpoints marked M** in ADU-API-01 S12 - twelve
  permissions carry `{MOBILE, CONSOLE}`, the other thirty are console-only. It is
  enforced by `core.permission.surfaces` in the database, not by this app.
- **Courier is a MOBILE-authenticated mode (founder decision D3), but the contract does
  not say so yet.** Target: one account, one MOBILE session, Courier as a relationship -
  never the console cookie, a second account or a second login. ADU-API-01 v1.11 S4 still
  puts the Courier surface on `audience = CONSOLE`, and the C endpoints (S12.17) publish no
  response schemas (gap CG-2). That is an approved future contract correction, and
  November R-20 fixes its direction: the contract is corrected to the design, never the
  reverse (conflict K-4). Until it lands, the Courier shell calls nothing and no type is
  hand-written to fill the gap.
- **No step-up action is reachable from MOBILE**, on any screen, by any route.
- **Version skew is real and binding.** Ethiopian buyers on low-end Android with metered
  data frequently do not auto-update, so several versions are live for months and the
  oldest cannot be assumed updated. `/v1` changes are **additive only**; the floor is
  enforced once at `/bootstrap`, not per endpoint.
- **A client timestamp is epoch milliseconds read straight from the system clock**,
  never assembled from local date and time components (ADU-API-01 A5).
- Scan capture and queued sync are the **only** offline-capable operations, and neither
  exists yet. Expo SQLite is installed as infrastructure only: no tables, caches or queues
  until the domain design that needs one says what they hold.
- **The contract and the real API are authoritative; build against the real API.** The
  Prism mock (`pnpm mock:api`) serves the same contract for contract tests, deterministic
  development, isolated client tests and endpoints that have not landed. It is never a
  competing specification, and no DTO is written to match prototype behaviour. The origin
  is one public variable, `EXPO_PUBLIC_API_BASE_URL` (`.env.example`); nothing secret is
  ever `EXPO_PUBLIC_*`.
- May import `@adulis/api-client`, `@adulis/tokens`, `@adulis/config` and
  `@adulis/locale/mobile` (never the locale root) - and nothing under `apps/`.

## Architecture

- `src/app/` - Expo Router routes only (ADU-MOB-02 v4.3 S13). `index` redirects to Buyer
  Home. `(buyer)/` is a Stack (Buyer mode activation) holding `(tabs)/` - JS `Tabs`, exactly
  `home | shop | saved | orders | account` (label "You") - plus screens that open over the
  tabs (`search`, `notifications`; later Product, Scene, Seller, Checkout). `(tabs)/home/` is
  a second `Tabs` navigator for the five channels, drawn at the top by `src/buyer/HomeHeader`;
  each channel is a route (`/home/nearby`). `dev/` (foundation diagnostics, Amharic QA) and
  `seller/`, `courier/` (diagnostic shells behind `ModeLayout`) exist in development builds
  only; a release build redirects them, and `+not-found`, to Buyer Home. `activeMode` is set
  on entering a mode and cleared on leaving; `clearSession` is the only other writer.
- `src/buyer/` holds the Buyer shell's own components (Home header, channel list, channel
  panel, sign-in-required state); `src/components/` the shared ones (`Screen`, `Placeholder`,
  `ErrorState`, `Loading`, ...). Placeholders never claim the Buyer has nothing before a
  domain can be read, and never offer an action that does not work.
- Icons: `@expo/vector-icons` (Ionicons) over `expo-font`, both SDK-pinned JS packages - no
  native rebuild. `NativeTabs`' Android icons would need `expo-symbols`, a native module.
- Server state lives in TanStack Query (`src/api/query-client.ts`). Zustand
  (`src/state/ui-store.ts`) holds UI state only: active mode, theme preference. Never
  Orders, stock, payment, Trust, permissions or eligibility.
- `src/auth/session.tsx` is the one session boundary: hydration at startup, `clearSession`
  as the single local sign-out path (credential, query cache, active mode), and `signOut`,
  which clears the device at once and revokes the session server-side alongside
  (`POST /v1/auth/logout`, typed against the contract in `src/api/auth.ts`, 10 s abort):
  the device never waits on the network to forget a credential.
- Amharic: `useT` renders English in a release build whatever the store holds
  (`amharicAvailable()` is `__DEV__`); the only language control is the dev diagnostics one.
- `src/theme/theme.ts` is the one theme authority: semantic roles from `@adulis/tokens`,
  Light / Dark / System, and the only place token lengths become dp. Never a colour literal
  in a screen; the brand palette is not final and must change in one place.
- Relative imports only - no path aliases, so TypeScript, Metro, Jest and
  dependency-cruiser resolve identically.

Stack: Expo SDK 58 - React Native 0.88 - Expo Router - TypeScript strict (the repo's 5.9.3;
excluded from `expo install` checks on purpose) - TanStack Query - Zustand - SecureStore -
SQLite - FlashList - Expo Image - jest-expo. Camera, Notifications and Updates arrive with
the work orders that use them. `android/` and `ios/` are generated (CNG) and never committed.

## Where sessions start, and what still binds

The working model is a Claude Code session started in the **`Adulis-Mobile-Workspace`**
parent folder (not a repository). It supplies the Expo plugin, the React Native skills,
agent-device, Maestro and read-only access to the prototype
(`AdulisCommercePlatformPrototype`, branch `dev`). **This repository stays the only write
target**, and the prototype is never edited.

`.claude/settings.json` in this directory is CWD-relative, so its read and edit denials
load only for a session started here. **A workspace session follows them by hand:** never
read into or edit another `apps/*`; never edit `contracts/openapi.json`,
`packages/api-client/src/schema.d.ts` or `db/migrations/**`; `packages/*` changes go in
their own PR. Starting here is still valid for work that needs no workspace tooling.

The prototype is the UX and presentation reference (screens, journeys), below the November
system designs and never the architecture. Never port its React web components or its
`src/demo-data`, and never restore a prototype rule the pack has replaced. Buyer-facing
terms are Product and Scene (R-01). Where the prototype disagrees with the designs or with
these documents, record the conflict for the founder.

## Commands

```
pnpm --filter @adulis/mobile android    # expo run:android: prebuild (CNG), Gradle, install com.adulis.app, Metro
pnpm --filter @adulis/mobile dev        # Metro only, for the already-installed app (JS changes)
pnpm --filter @adulis/mobile test       # locale-import guard, then jest-expo
pnpm --filter @adulis/mobile typecheck
pnpm --filter @adulis/mobile build      # expo export (android + ios bundles) into dist/
```

App identity (founder decision D1): Android `com.adulis.app`, iOS `com.adulis.app`, Expo
project `@naod61s-team/adulis`. The development build is a plain debug build -
`expo-dev-client` is not needed for the emulator workflow. `android/` and `ios/` are
regenerated by `expo run:*` / `expo prebuild` and never committed; rebuild natively only
after a native dependency or config-plugin change.

On Android 17 the debug build asks for "nearby devices" (`ACCESS_LOCAL_NETWORK`) at launch:
allow it - Android blocks a debug build's Metro traffic without it; release builds never ask.
Smoke flow: `.maestro/foundation-smoke.yaml` (launches `com.adulis.app`, grants only that).

On Windows, a native build needs the checkout at a SHORT path on an NTFS drive: React Native
codegen and CMake/Ninja fail on Windows path limits from a deep path (see
`docs/mobile/WO-001A-FOUNDATION-CLOSURE.md`, Native build).
