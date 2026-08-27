# `apps/mobile` — the Adulis mobile app

**PLACEHOLDER. This workstream is unassigned (ADU-REPO-01 S1) and nothing is built.**

Loaded together with the root `CLAUDE.md`. Start your session here, not at the
repository root.

**Governing documents:** ADU-ARCH-01 v2.0 S2, S3 - ADU-API-01 v1.6 S4, S12 -
ADU-AUTH-01 v2.4 S5, S8 - ADU-REPO-01 S10.

## What it is

**One application with two modes, not two apps.** ADU-ARCH-01 S2: one account holds
both roles, and the seller Companion is a mode switch inside the buyer app. Two Expo
projects would mean two builds, two store listings and two review queues for one
person's phone.

**Mode switching never re-authenticates.** Buyer to Seller is a UI affordance over
relationships that already exist; the same session reaches both.

Stack: Expo, React Native. `audience = MOBILE`, credential is an opaque bearer token in
native secure storage - never a cookie, never a JWT.

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

## The rest, in brief

- **The Companion reaches only the endpoints marked M** in ADU-API-01 S12 - twelve
  permissions carry `{MOBILE, CONSOLE}`, the other thirty are console-only. It is
  enforced by `core.permission.surfaces` in the database, not by this app.
- **No step-up action is reachable from MOBILE**, on any screen, by any route.
- **Version skew is real and binding.** Ethiopian buyers on low-end Android with metered
  data frequently do not auto-update, so several versions are live for months and the
  oldest cannot be assumed updated. `/v1` changes are **additive only**; the floor is
  enforced once at `/bootstrap`, not per endpoint.
- **A client timestamp is epoch milliseconds read straight from the system clock**,
  never assembled from local date and time components (ADU-API-01 A5).
- Scan capture and queued sync are the **only** offline-capable operations.
- Build against the Prism mock (`pnpm mock:api`). May import `@adulis/api-client`,
  `@adulis/locale`, `@adulis/tokens`, `@adulis/config` - and nothing under `apps/`.

## Before this workstream starts

It needs an owner in `.github/CODEOWNERS`, an Expo project, and its own
`.claude/settings.json`. Until then this file exists so that whoever picks it up
inherits the rule above rather than discovering it in an App Store rejection.
