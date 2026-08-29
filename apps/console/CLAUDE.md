# `apps/console` — the seller console PWA

Loaded together with the root `CLAUDE.md`. **Start your session here, not at the
repository root.**

**Governing documents:** ADU-CON-03 v1.1 (thirty screens, five destinations, twelve
states) · ADU-CON-02 **v3.1** (system design, CSP) · ADU-ARCH-01 v2.0 · ADU-AUTH-01
**v2.5** · ADU-API-01 **v1.7** · **ADU-REPO-01 §9** (cited from 30 files and installed
nowhere -- the missing-source fact is on record; this file's §9.2/§9.5 transcriptions
are the working copy). Versions corrected at T7 Phase 4; `docs/amendments/README.md`
is always the authority on what governs.

> **Ownership (T7 §0/§6):** the console is no longer a separate workstream's -- the
> COO/CTO has left, and this workstream is worked by the agent under the one remaining
> owner. **ADU-REPO-01 §4's dependency rules hold in full.** One owner is not a reason
> for `apps/console` to import from `apps/api`: the rules exist so the workstreams stay
> separable, and that matters MORE with one person, not less -- separability is now the
> only thing keeping a console defect from becoming a backend session's problem.

**What this is:** the *full* seller management system. **Nine of the ten
publication-readiness items are reachable from nowhere else**, so this is the only
surface on which a person becomes a seller. It also carries **one screen for a different
user entirely** — the courier (SC-C1): same deployment, same audience value, separate
route tree, **no seller navigation**.

> **This file CITES the specifications; it does not replace them** (ADU-REPO-01 v1.2 S6).
> Where a rule is inlined below for practicality, **the citation beside it governs, and the
> inlined line is the first thing to check when the two disagree.** A rule kept in two
> places grows a stale copy, and the copy an agent reads first is the one it follows.

## The boundary

- **May import:** `@adulis/api-client`, `@adulis/locale`, `@adulis/tokens`, `@adulis/config`.
- **May never import anything under `apps/`.** Not `apps/api/` for a type, not for a Zod
  schema, not for a constant. **This is rule 2, and the console is where it will first be
  tempting**, because the backend defines every shape the console renders.
- **The types you need are generated** into `packages/api-client` from
  `contracts/openapi.json`. If a type is missing there, **the endpoint does not exist
  yet** — and the answer is the Prism mock, not a reach across.
- **Build against the real API on docker compose** (T7 §7): `pnpm dev:api`, then
  `VITE_API_BASE_URL=http://localhost:3000`. The mock (`pnpm mock:api`,
  `VITE_API_BASE_URL=http://127.0.0.1:4010`) remains for contract-only work; its
  purpose was to unblock a workstream that no longer needs unblocking.

## The rules an agent working here needs

- **The seller id lives in the URL** (`/s/:sellerId/*`), **never in a store.** Two stores
  in two tabs are two URLs and cannot be confused (ADU-AUTH-01 §8.3). The failure this
  prevents is a seller confirming a payment on the wrong store.
- **The console computes no business state.** It renders `state`, `allowed_actions` and
  `readiness[]` as the server resolved them. A countdown may *display* a server deadline;
  it may not *decide* anything when it reaches zero — it refetches.
- **The verbatim labels** of ADU-CON-03 §4.1. *"Confirm Payment Received"*, **never**
  *"Accept Payment"*. The verify-in-your-own-bank sentence is adjacent, always visible,
  never behind a disclosure.
- **The forbidden controls** of ADU-CON-03 §16: no accept-reservation, no review reply or
  hide, no level control, no delivery tracking, no countdown on a confirmed order, no
  generative assistance. These are the client-side face of the load-bearing absences —
  building one puts a control on screen for a capability the server will refuse.
- **Every input has a `<label for>`. Every list has an empty state.** Validation renders a
  summary of anchor links **plus** per-field messages.
- **No `localStorage`, no `sessionStorage`, no token in JavaScript.** The session is an
  httpOnly cookie the console cannot read and does not need to. An XSS on this origin must
  not be able to reach the credential, because this is the origin where payout details
  change.
- **The service worker precaches the app shell only.** `/v1/*` is `NetworkOnly`. Never an
  authenticated response, never an offline queue.
- **No fixed heights on anything holding translated text.** Amharic runs 30–50% longer.
- **A missing Amharic key is a compile error**, not a fallback.
- **Idempotency keys are minted on control *mount*, not on click** — a key minted on click
  is a new key per tap, which is exactly the retry the header exists to defeat.
- **Evidence is viewed through a blob URL, revoked on unmount.** Never a predictable URL,
  never in a notification preview.
- **Screens whose endpoints do not exist are not built.** ADU-CON-03 §17 lists the four.

## Structure (§9.2)

`features/` mirrors ADU-CON-03's groups and **folder names carry screen IDs**, so the
mapping from specification to code is mechanical and coverage is checkable by listing a
directory.

```
src/
  router.tsx        /s/:sellerId/*  and  /courier
  api/client.ts     thin wrapper over @adulis/api-client. DO NOT hand-edit types.
  auth/             SC-00 sign-in, SC-31 step-up, remember-device (R17), idle warning
  layout/           Shell (sidebar >=1024px, bottom bar <1024px), SellerSwitcher, nav
  features/
    entry/          SC-01 SC-02          trade/     SC-03 SC-04 SC-05 SC-06
    catalogue/      SC-07 .. SC-11       conversation/ SC-20 SC-21
    trust/          SC-12 .. SC-16       store/     SC-17 SC-18 SC-19 SC-22 SC-23
    admin/          SC-24 .. SC-29       notifications/ SC-30
  courier/          SC-C1. No seller nav. Mobile layout only.
  components/       primitives on @adulis/tokens
  lib/              intl.ts · idempotency.ts · blob-viewer.ts · states.ts
```

`SellerSwitcher` renders **only** when the account holds more than one seller.
`nav.ts` carries **five destinations, no more.**

## Build order (§9.5)

The console cannot be built screen-by-screen in specification order — most screens need
the shell, the states and the client first.

| Stage | Done when |
|---|---|
| **C-1** | A placeholder route renders inside the shell at both breakpoints, with the twelve states demonstrable |
| **C-2** | A seeded seller signs in against the real API and is warned before idle expiry (T7 §7.1; was "the mock" before Tier 3 existed) |
| **C-3** | Nine readiness items render from `readiness[]`, in any order, resumable |
| **C-4** | Three clock treatments visible; handoff gated on `PAYMENT_CONFIRMED`; payment decisions equally weighted |
| **C-5** | Set-count and confirm-stock are visibly **two** actions |
| **C-6** | Payout's five disclosures; cancel present **only** with a pending change |
| **C-7** | Reviews read-only; the empty claims list reads as good news |
| **C-8** | SC-C1 courier: mobile only, no seller nav, QR only after custody |

> **The unblock note that used to sit here is history** (T7 Phase 4): Tier 3 landed,
> the contract is committed with its 110 `/v1` path keys, and the auth endpoints exist
> -- C-2 and everything after it are gated by build order alone. Two of its rules are
> permanent and stay: **do not hand-write `contracts/openapi.json`** (a hand-authored
> contract is the lie with authority §5.1 forbids), and a screen whose endpoint does
> not exist is not built.
>
> C-2's done-clause reads "against the real API" since T7 §7.1 -- the seeded seller
> comes from `pnpm db:seed`, which prints the sign-in loop.

## CSP

`public/_headers` — `script-src 'self'`, **no nonce** (ADU-CON-02 §3.9). A static SPA
needs no inline bootstrap script, which is precisely why this workstream is Vite and not
Next.js. CI asserts `unsafe-eval` is absent from the build and that React's production
build shipped.
