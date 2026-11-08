# `apps/mobile` — the Adulis mobile app

**Foundation only (WO-001).** An Expo SDK 58 app with Buyer, Seller Companion and Courier
foundation shells and the client infrastructure under them. No product feature is built.
What exists, why, and what is still open: `docs/mobile/WO-001-MOBILE-FOUNDATION-COMPLETION.md`.

**Governing documents:** ADU-ARCH-01 v2.0 S2, S3 - ADU-API-01 v1.11 S4.1, S5.1, S12 -
ADU-AUTH-01 v2.8 S5.2, S19 (v2.5 for the permission catalogue) - ADU-REPO-01 v1.3 S10.
UX and product behaviour: the prototype (below).

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
17.1-17.2) is about the Account model, not the shell. The founder decision above governs the
shell, and it authorises no client-side creation of a Seller or Courier relationship.

Credential: an opaque bearer token in native secure storage (Expo SecureStore) - never
AsyncStorage, never a cookie, never decoded as a JWT. `audience = MOBILE`.

## The one non-obvious rule, worth writing before anyone starts

> **No price, no tier name and no billing link may appear anywhere in the bundle.**
>
> ADU-PRD-01 S3 and ADU-API-01 S4.1: this is what keeps the apps outside Apple's
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

**This rule currently blocks `@adulis/locale`.** Its catalogue is one object holding the
console's subscription, plan and payment copy, and Metro bundles the whole object. Do not
import it at runtime until the package offers a mobile-safe export (conflict C-1). Scan the
export (`pnpm --filter @adulis/mobile build`, then search `dist/`) after any change that
adds strings to the bundle.

## The rest, in brief

- **The Companion reaches only the endpoints marked M** in ADU-API-01 S12 - twelve
  permissions carry `{MOBILE, CONSOLE}`, the other thirty are console-only. It is
  enforced by `core.permission.surfaces` in the database, not by this app.
- **Courier Mode has no mobile contract yet (conflict C-2).** ADU-API-01 v1.11 S4 puts the
  Courier surface on a cookie session with `audience = CONSOLE` and lists only buyer groups
  plus M endpoints for MOBILE; the C endpoints (S12.17) also publish no response schemas
  (gap CG-2). Until the contract is reissued or the founder rules, the Courier shell calls
  nothing: never send a courier request over a MOBILE session on assumption, and never
  hand-write a type to fill the gap.
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
- May import `@adulis/api-client`, `@adulis/tokens`, `@adulis/config` (and `@adulis/locale`
  once C-1 is resolved) - and nothing under `apps/`.

## Architecture

- `src/app/` - Expo Router routes only: the foundation root and one directory per mode,
  each behind `ModeLayout` (availability guard; sets `activeMode` on entry, clears it on
  exit - `clearSession` is the only other writer).
- Server state lives in TanStack Query (`src/api/query-client.ts`). Zustand
  (`src/state/ui-store.ts`) holds UI state only: active mode, theme preference. Never
  Orders, stock, payment, Trust, permissions or eligibility.
- `src/auth/session.tsx` is the one session boundary: hydration at startup, and
  `clearSession` as the single sign-out path (credential, query cache, active mode).
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

The prototype is the UX authority (screens, journeys, terminology), never the
architecture: never port its React web components or its `src/demo-data`. Where it
disagrees with these documents, record the conflict for the founder.

## Commands

```
pnpm --filter @adulis/mobile dev        # Metro; open in Expo Go or a dev build
pnpm --filter @adulis/mobile test       # jest-expo
pnpm --filter @adulis/mobile typecheck
pnpm --filter @adulis/mobile build      # expo export (android + ios bundles) into dist/
```

On the Android emulator, `adb reverse tcp:8081 tcp:8081` and open `exp://127.0.0.1:8081`;
the host's LAN address may be firewalled. Smoke flow: `.maestro/foundation-smoke.yaml`.
The Android applicationId is OPEN (founder decision), so there is no native build yet.
