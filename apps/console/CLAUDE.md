# `apps/console` — the seller console PWA

Loaded together with the root `CLAUDE.md`. **Start your session here, not at the
repository root.**

**Governing documents:** ADU-CON-03 v1.3 (thirty screens, five destinations, twelve
states) · ADU-CON-02 **v3.1** (system design, CSP) · ADU-ARCH-01 v2.0 · ADU-AUTH-01
**v2.5** · ADU-API-01 **v1.9** · ADU-DB-01 **v1.16** · **ADU-REPO-01 §9** (cited across this repository and installed
nowhere: it is absent from `docs/` and from DOCUMENT_AUTHORITY's supplied baseline,
and no register entry recorded that until D-94; this file's §9.2/§9.5 transcriptions
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
  yet** — and the answer is the contract -- the mock, for contract-only work -- never a reach across.
- **Build against the real API** (T7 §7): the full recipe, because two
  commands are not enough. `docker compose up -d` (Postgres ONLY -- the API is not a
  compose service), `cp .env.example .env`, `pnpm db:migrate`, `pnpm db:seed`, then
  start the API **with that environment loaded into the shell**: `apps/api` reads no
  `.env` of its own (register D-99), so `pnpm dev:api` from a clean shell gets an
  empty `DATABASE_URL` and an empty `CONSOLE_ORIGIN` -- which makes CORS a wildcard
  the browser refuses on a credentialed request, and 403s every cookie-carried write.
  Then `VITE_API_BASE_URL=http://localhost:3000` **in the shell** -- Vite reads
  `VITE_`-prefixed variables from `process.env`, and this app's `envDir` is
  deliberately its own directory, never the workspace root: pointing it at the
  root would pull in `NODE_ENV=development` and ship React's development build
  (the `production-react` gate fails on exactly that). The mock (`pnpm mock:api`,
  `http://127.0.0.1:4010`) remains for contract-only work; its purpose was to unblock
  a workstream that no longer needs unblocking.

## The stack, and what of it has actually landed

**Landed at C-1/C-2 (T7 Phase 5):** React 19 + Vite, `react-router` 7.18.3
(pinned), and hand-written CSS over `@adulis/tokens`' custom properties.
**Still the destination, deliberately deferred to C-3+:** TanStack Query (it
earns its keep at catalogue scale, not on two screens), Tailwind 4 (it arrives
with the first catalogue-scale screens), and React Hook Form + Zod. This is a
STAGING decision, not a deviation from the ruled stack -- recorded here, in
`src/console.css`'s header and in the T7 report, so the next agent adds the
library when its screen arrives instead of re-deciding the stack.

**The harness landed at T10 Phase 4, one stage late.** `pnpm verify:console-e2e`
(gate `console-e2e`) builds the console, resets the database, starts the real API
and drives the built artifact with Playwright. `pnpm --filter @adulis/console test`
is still an echo -- there are no unit tests here and none are owed; the console
computes no business state, so what is worth asserting is what a browser does.

**Sign-in lives in exactly one file: `e2e/helpers/session.ts`.** No test names a
phone number and no test knows what an OTP is. ADU-AUTH-01 v2.6 is under
evaluation and NOT installed -- when the mechanism is ruled, `signInAs` changes
and no test does. Keep it that way.

**One sign-in per run.** `globalSetup` signs in and saves `storageState`; the OTP
budget is 3/hour per phone and a per-test sign-in spent it by the fourth test
(D-124's class -- a 429 about nothing). The sign-in path is still exercised for
real on every run.

**Assert where the browser ENDED UP, not what the page contains** (D-152). The
first regression test written here PASSED against the regression it was written
for: `page.goto(href)` resolves before the router's catch-all `<Navigate>` has
run, so a check that Home's list was absent was true for an instant and false
after. A redirect happens slightly later. Use `toHaveURL`.

C-1 through C-3 are also held up by typecheck (which covers `e2e/` via
`tsconfig.e2e.json` -- a harness with no type gate is one whose own typo surfaces
as a red test about the product), lint, and the `no-unsafe-eval`,
`production-react` and `boot-smoke` gates. What the harness does NOT yet cover is
most of C-1 and C-2: T10 S4 scoped it to the twelve states, SC-01's readiness,
the chooser's labelled gap and a planted `UPGRADE_REQUIRED`, and said not to
backfill. It earns its place on C-4.

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

### C-4's four rules, and where each one lives

Every one of these is transcribed from ADU-CON-03 v1.1 S7 (carried unchanged through v1.3 S7), not designed. They
are the rules most likely to be "improved" by someone who has not read why.

- **The three clock treatments are ONE module** -- `lib/clock.tsx`. SC-03's row
  and SC-04's clock region ask it the same question, so they cannot drift.
  `CREATED`/`NOTIFIED` shows the reservation window; `PAYMENT_SUBMITTED` shows
  the CONFIRMATION window and **not** the reservation one ("irrelevant", S7);
  `PAYMENT_CONFIRMED` and after show **no countdown at all** -- not a stopped
  one, not "0:00". `<Deadline>` renders null, so a paid order has no clock
  region to mistake for a stopped one.
  **`if (Date.now() > order.expiresAt)` is the defining violation of "the
  console computes no business state."** At zero the countdown REFETCHES and
  the server says what the order is. It also measures against `serverTime`
  from `/v1/bootstrap`, not the device clock.
- **The payment decisions are equally weighted, and `.decision` has no
  variant.** No `.primary`, no `.danger`. The only difference between the two
  buttons is the words. **"Confirm Payment Received", verbatim, never "Accept
  Payment."** The verify-in-your-own-bank sentence renders before both, always,
  never inside a disclosure. Confirming WITHOUT opening the evidence is a
  normal path (ADU-ARCH-01 S3.3) -- nothing nags, blocks, or badges the
  evidence as unread. Rejection is two steps and step two states the
  consequence in full.
- **R20: the handoff region is DISABLED, not hidden**, and that is all four
  controls. `disabled` is the only thing state changes; the region and its
  explaining line stay in the document. "A region that disappears makes a
  seller wonder what they broke."
- **Evidence renders from a blob URL revoked on unmount**, with no download,
  print, share, save or "looks valid" affordance of any kind. The revoke is
  asserted by FETCHING the URL after close and requiring it to fail --
  checking the `<img>` is gone would pass with the blob still alive.

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
| **C-3** | Nine readiness items render from `readiness[]`, in any order, resumable -- **landed T9 Phase 4**: SC-01 Life 1 and SC-02, with the market-context provider (D-103). Life 2, the daily brief, waits for C-4's clock rules (D-148) |
| **C-4** | Three clock treatments visible; handoff gated on `PAYMENT_CONFIRMED`; payment decisions equally weighted -- **landed T10 Phase 5**: SC-03, SC-04, SC-05, SC-06, each rule asserted by `console-e2e` and proved by planting its violation. Six gaps found and stated rather than filled (D-153 buyer name, D-154 no filter parameter, D-155 no `allowed_actions`, D-156 QR serialisation, D-157 courier ids, D-158 evidence bytes) |
| **C-5** | Set-count and confirm-stock are visibly **two** actions |
| **C-6** | Payout's five disclosures; cancel present **only** with a pending change |
| **C-7** | Reviews read-only; the empty claims list reads as good news |
| **C-8** | SC-C1 courier: mobile only, no seller nav, QR only after custody |

> **The unblock note that used to sit here is history** (T7 Phase 4): Tier 3 landed,
> the contract is committed with its 110 `/v1` path keys (four governing-document
> sites still print 124 -- register D-100; the contract in the tree is the authority), and the auth endpoints exist
> -- C-2 and everything after it are gated by build order alone. Two of its rules are
> permanent and stay: **do not hand-write `contracts/openapi.json`** (a hand-authored
> contract is the lie with authority §5.1 forbids), and a screen whose endpoint does
> not exist is not built.
>
> C-2's done-clause reads "against the real API" since T7 §7.1 . The seeded seller it needs comes
> from `pnpm db:seed`, which is still the Tier-0 stub at THIS commit -- the real seed
> lands with C-2 in Phase 5, and this line becomes present tense there.

## CSP

`public/_headers` — `script-src 'self'`, **no nonce** (ADU-CON-02 §3.9). A static SPA
needs no inline bootstrap script, which is precisely why this workstream is Vite and not
Next.js. CI asserts `unsafe-eval` is absent from the build and that React's production
build shipped.
