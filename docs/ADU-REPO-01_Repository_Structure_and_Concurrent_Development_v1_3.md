# ADU-REPO-01 -- Repository Structure and Concurrent Development

**Version:** 1.3 - **Baseline date:** 29 August 2026
**Owner:** Founder / CEO
**Supersedes:** ADU-REPO-01 v1.2
**Status:** Binding structure for the platform repository. Supersedes ADU-CON-02 v3.0 S12's tree, which described two apps and one repository for the website.
**Encoding:** ASCII, per ADU-DB-01 S16.6 / A3.5.

---

## 0. What this is, and what it is not

The repository now holds **five workstreams**: the seller console PWA, the mobile app (buyer plus seller lite), the storefront website, the shared backend, and the database. ADU-CON-02 S12 described a tree for two of them and put the website elsewhere. This replaces it.

**This document does two jobs, and they have different scopes.**

1. **S1-S8 govern the whole repository** -- boundaries, ownership, dependency rules and the seams between workstreams. They exist so that four people can work at once without colliding.
2. **S9 specifies the seller console PWA in full.** It is the only workstream this document builds out. The other four get their boundary, their owner and a placeholder, and nothing more.

> **The restructure is additive. Nothing that Tier 2 is currently touching moves.** `apps/api/`, `db/`, `docs/` and `ops/` stay exactly where they are; `apps/console/` stays where it is. Everything below is either a new directory or a governance file. **This can land while migrations 08-15 are in flight**, and it should, because retrofitting boundaries onto four workstreams already in motion is the expensive version.

---

## 0.1 What changed in v1.3

**One engineer, and a review layer that was decorative from the day it was written.**

| # | Change | S |
|---|---|---|
| **1** | **`CODEOWNERS` names one owner.** The COO/CTO has left; the two-owner model in S3 and the console's workstream assignment in S9 are void | S3, S9 |
| **2** | **D-94: neither original handle was ever a collaborator.** `@naod` and `@abenezer` are real GitHub accounts belonging to other people. **GitHub silently ignores a `CODEOWNERS` entry for a user without repository access**, so the file requested review from nobody from the day it was written | S3.1 |
| **3** | **The dependency rules are unchanged, and S4 says why one owner is not a reason to relax them** | S4 |
| **4** | **This file was cited across the repository and installed nowhere.** It is a governed document under the ASCII gate now | S0.4 |

### The finding worth carrying out of this revision

**D-94 is not "a file went stale when someone left."** The file was **wrong on the day it was committed**, and every work order since assumed it was the outermost review layer.

> **A `CODEOWNERS` entry for a non-collaborator is silently ignored.** No warning, no failed check, no annotation on a pull request -- **the file parses, the rule is real, and the reviewer it names is never asked.**

Combined with ADU-CON-02 S21's standing fact that branch protection **does not apply** to a private repository on the current plan, **the review model was CI and nothing else, for the whole build.** That is not a discovery about a departure; it is a discovery about what was always true.

**Everything not listed above is carried forward from v1.2 unaltered.**

---

## 0.2 What changed in v1.2 -- retained for history

**One sentence, which could not be followed literally, and one note it exposed.**

v1.1 S5.1 said: *"the mock's base URL carries `/v1` and the generated client must not add it a second time."* **The two halves contradict each other**, and the section's own demonstration settles it.

| | |
|---|---|
| **The demonstration** | Prism ignores a `servers[].url` prefix. `/v1/bootstrap` serves 200; the unprefixed path 404s |
| **What that means** | `/v1` is in the **path keys**, not in `servers[].url` -- that is the only reason the prefixed path resolves |
| **So** | A base URL that also carries `/v1` produces `/v1/v1/bootstrap` -- **the doubling the same sentence warns against** |
| **v1.2** | **`/v1` lives in the path keys. The base URL is an origin and nothing more.** S5.1 |

**And a Tier 3 configuration note falls straight out of it**, recorded now because it is cheap now and a day's confusion later. S5.1.

**Everything else is carried forward from v1.1 unaltered.**

---

## 0.2 What changed in v1.1 -- retained for history

**Four corrections, all found by building it.** No boundary, rule or seam changes.

| # | v1.0 | v1.1 | S |
|---|---|---|---|
| **1** | S11 step 1 creates `apps/storefront/CLAUDE.md`; step 4 imports by `git subtree add` | **Reordered.** `git subtree add` refuses an existing prefix -- reproduced: `fatal: prefix 'apps/storefront' already exists`. Step 1 would have broken step 4 | S11 |
| **2** | *"no sibling package's instructions in context"* | **Softened, and enforced instead.** Sibling files load **on demand** when Claude reads into that directory. Isolation is a consequence of not reaching across, not a loader guarantee -- so `claudeMdExcludes` and Read deny rules make it one | S8 |
| **3** | *"never regenerated locally and committed"* | **Corrected.** The contract **is** tracked. CI is its only author. v1.0's wording read as forbidding the commit, which would leave the Prism mock nothing to serve and break S5.1's own guarantee | S5.1 |
| **4** | -- | **New: Prism's operational facts.** It ignores a `servers[].url` prefix, and >=5.15.7 requires Node 24 | S5.1 |

**And one sequencing claim in v1.0 was wrong.** S11 said steps 1 to 3 are prerequisites for anyone joining. **Steps 2 and 3 cannot happen yet** -- there is no producer for `openapi.json` until the API has endpoints, which is Tier 3. S11.1 states what is actually unblocked today.

---

## 0.4 This file is installed

**v1.2 was cited across the repository and installed nowhere** -- absent from `docs/`, absent from `DOCUMENT_AUTHORITY.md`'s supplied baseline, and its absence recorded for the first time only at T7 (D-94).

**A structure document that governs a tree it does not live in is a document an agent cannot read.** It is in `docs/` now and under the ASCII gate with the rest.

---

## 1. The five workstreams

| # | Workstream | Path | Stack | Owner |
|---|---|---|---|---|
| 1 | **Shared backend** | `apps/api/` | NestJS 11, Node 22 | CEO |
| 2 | **Database** | `db/` | PostgreSQL 17, hand-written SQL | CEO |
| 3 | **Seller console PWA** | `apps/console/` | Vite 7, React 19 | COO/CTO |
| 4 | **Mobile app** | `apps/mobile/` | Expo, React Native | *unassigned* |
| 5 | **Storefront website** | `apps/storefront/` | Next.js 15 | *unassigned* |

**One backend serves all three clients.** There is no per-surface API (ADU-CON-02 S1). A surface is a value in `core.session_audience` checked inside `fn_has_permission`, not a deployment and not a directory.

**The mobile app is one application with two modes**, not two apps. ADU-ARCH-01 S2: one account holds both roles, and the seller Companion is a mode switch inside the buyer app. Two Expo projects would mean two builds, two store listings and two review queues for one person's phone.

---

## 2. The tree

```
adulis-platform/
|--- apps/
|   |--- api/                    (1) NestJS + worker. Unchanged.
|   |   |--- CLAUDE.md               backend rules only
|   |   `--- .claude/settings.json
|   |--- console/                (3) Seller console PWA -- S9
|   |   |--- CLAUDE.md
|   |   `--- .claude/settings.json
|   |--- mobile/                 (4) Expo. Placeholder until assigned.
|   |   `--- CLAUDE.md
|   `--- storefront/             (5) Next.js. Imported from its own repo -- S10.
|       `--- CLAUDE.md
|--- packages/
|   |--- api-client/             THE SEAM. Generated from openapi.json.
|   |--- locale/                 en.ts / am.ts -- typed catalogue
|   |--- tokens/                 design tokens
|   `--- config/                 shared tsconfig, eslint, prettier
|--- db/                         (2) migrations, checks, seed. Unchanged.
|--- docs/                       the ADU set. Unchanged.
|   |--- registers/              ADU-VAL-01 -- governs nothing
|   |--- amendments/
|   `--- build-status/
|--- ops/                        render.yaml, runbooks, provider-verify
|--- contracts/
|   `--- openapi.json            generated in CI. NEVER hand-edited.
|--- .github/
|   |--- CODEOWNERS
|   `--- workflows/              one job per workstream -- S7
|--- CLAUDE.md                   root: shared rules only, kept short
|--- pnpm-workspace.yaml
`--- package.json                thin. Scripts delegate to workspaces.
```

**`contracts/` is new and deliberately not inside `apps/api/`.** The OpenAPI document is produced by the backend and consumed by three clients; putting it under the producer's directory invites a front-end developer to reach into `apps/api/` to read it, which is the first step toward reaching in for something else.

---

## 3. Ownership

`.github/CODEOWNERS`:

```
*                   @NaodSolomon
```

**One owner, every path.** The COO/CTO has left, and the unstaffed-workstream doctrine is superseded while there is one human.

### 3.1 D-94 -- the file requested review from nobody, from the day it was written

v1.2 assigned paths to `@naod` and `@abenezer`. **Both handles exist on GitHub -- as accounts belonging to unrelated people, neither ever a collaborator on this repository.** The only collaborator is `@NaodSolomon`, the handle every commit in history carries.

> **GitHub silently ignores a `CODEOWNERS` entry naming a user without repository access.** The file parses. The rule is real. **The reviewer it names is never asked, and nothing anywhere says so.**

**So this was never a file that went stale when someone left.** It was wrong when it was committed, and **every work order since has assumed it was the outermost review layer.** Combined with ADU-CON-02 S21 -- branch protection does not apply to a private repository on this plan -- **the review model has been CI and nothing else for the entire build.**

**Verify a `CODEOWNERS` entry against the collaborator list, not against a name you recognise.** One API call, and it is the only way this failure is visible.

### 3.2 What replaces a second reviewer

**The adversarial pass**, run by the agent against its own work before merge, and recorded per the review convention (`docs/build-status/reviews/`). It has found more real defects in this project than any human review: SR-1's ten `PUBLIC`-executable boundary functions, D-50's superuser definer, D-121's self-defining class, the `X-Adulis-Device` blocker that made console sign-in impossible.

**Its weakness is the one to name.** A pass on your own work is a pass by the person who made the assumptions, and **twice it has been the skeptic pass on the fixes -- not the review -- that caught the defect.** Where a change touches money, identity or a boundary, the second pass is not optional.

---

## 4. The dependency rules, and why they are enforced rather than agreed

Four rules. **Three of them are what stop a monorepo becoming a single tangled application.**

| # | Rule |
|---|---|
| 1 | `apps/*` **may** import from `packages/*` |
| 2 | `apps/*` **may never** import from another `apps/*` |
| 3 | `packages/*` **may never** import from any `apps/*` |
| 4 | `packages/*` may import from other `packages/*`, acyclically |

> **Rule 2 is the one that will be broken, and it will be broken helpfully.** A console developer needing a type the API already defines will import it from `apps/api/` because it is right there and it works. The build stays green. Six weeks later the console cannot be built without the backend, the CI scoping in S7 is meaningless because everything depends on everything, and the two workstreams that were supposed to proceed independently are one workstream.
>
> **The correct move when rule 2 gets in your way is to move the shared thing into `packages/`**, which is a deliberate act reviewed by both owners -- not to reach across.

**Enforced by `dependency-cruiser` in CI**, not by review. A rule that depends on someone noticing is a rule that holds until the week someone is busy.

> **v1.3 -- one owner is not a reason to relax any of the four.** The rules exist so the workstreams stay **separable**, not so two people stay out of each other's way. With one engineer the temptation is stronger, not weaker: nobody is inconvenienced by a shortcut across a boundary, so nothing but the tooling objects.
>
> **The day a second engineer arrives, a workstream that has quietly welded itself to another is not a workstream they can be given.** That is the cost, and it is paid later by someone who was not there when it was incurred.

---

## 5. The three seams

Everything crossing a workstream boundary crosses at one of these. **There is no fourth.**

### 5.1 `contracts/openapi.json` -- backend to every client

```
NestJS decorators + Zod  --(CI, on merge to main)-->  contracts/openapi.json
                         --(openapi-typescript)------>  packages/api-client/schema.d.ts
                         --(Prism)------------------->  a mock server, for every client
```

- **The file is tracked in git, and CI is its only author.** A human-authored diff to it fails the build. v1.0 said *"never regenerated locally and committed"*, which read as forbidding the commit -- and an untracked contract leaves the mock nothing to serve, which breaks this section's own guarantee. **Tracked, so every client has it offline; CI-written, so nobody edits it.** A hand-edited spec is a lie with authority.
- **CI fails on any removal, rename or retype within `/v1`** -- ADU-API-01's additive-only doctrine as a build failure rather than a discipline.
- **Every client develops against the Prism mock** and flips a base URL when the endpoint lands.

**Two operational facts about Prism, both demonstrated rather than assumed:**

1. **Prism ignores a `servers[].url` path prefix.** `/v1/bootstrap` serves 200; the unprefixed path 404s -- which is only true because **`/v1` is in the path keys.**

   > **RULE -- `/v1` lives in the OpenAPI path keys. The base URL is an origin and nothing more.** `http://localhost:4010`, not `http://localhost:4010/v1`.
   >
   > **v1.1 said the opposite and contradicted itself doing so.** If the base URL carried `/v1` as well, every request would resolve to `/v1/v1/bootstrap` -- the doubling that same sentence warned against. The two halves could not both be followed, and the demonstration above is what decides between them: Prism serves what the path keys say, so the path keys are where the prefix has to be.

   **The Tier 3 consequence, recorded before it costs a day.** The generated document must emit `/v1` **in its path keys**. NestJS `setGlobalPrefix('v1')` alone does not do this -- it prefixes the routes and the Swagger document keeps the unprefixed paths, which produces a spec that serves correctly from the real API and 404s against every mocked path. Configure the document so the prefix appears in `paths`, and **assert it in the CI job that generates the contract**: if `Object.keys(paths).every(p => p.startsWith('/v1'))` is false, fail.

   **A guard that rejects a `/v1`-suffixed base URL should say why**, and name the sentence that misled whoever configured it. Blocking teaches nothing; blocking with the reason means the next person does not re-derive it.
2. **Prism >=5.15.7 requires Node 24.** The repository is Node 22 LTS. **Pin 5.14.2** until the runtime moves, and pin it in a `package.json` that actually depends on it -- a comment claiming a pin, with no dependency behind it, dies on command-not-found the moment the contract lands.

### 5.2 `packages/tokens` -- design to three clients

Colour, spacing, type scale, radii as platform-neutral values. Console and storefront consume them through Tailwind; mobile consumes them directly. **No component lives here** -- a React web button and a React Native button share values, not code, and a package pretending otherwise becomes a lowest-common-denominator UI kit that suits none of the three.

### 5.3 `packages/locale` -- content to everyone

`en.ts` defines the key union; `am.ts` is `Record<MessageKey, string>`, so **a missing Amharic string is a compile error** in whichever app first uses the key. One catalogue, four consumers, one gate.

---

## 6. Collision surfaces

The places two people editing different things still conflict. **Each gets a rule, because the default outcome of a merge conflict in these files is a silent wrong answer rather than a loud one.**

| Surface | Rule |
|---|---|
| **`pnpm-lock.yaml`** | **Never hand-merge.** On conflict: take either side, run `pnpm install`, commit the result. A hand-merged lockfile installs a set of versions nobody tested |
| **`db/migrations/NNNN_*.sql`** | **Single writer -- the backend owner.** Two people adding `0016` is a collision that *merges cleanly* and produces two migrations with one number |
| **`contracts/openapi.json`** | **Written by CI only.** Front-end workstreams read it and never touch it |
| **`packages/*`** | **Its own PR, both owners.** Never bundled into an app change |
| **Root `package.json`, `tsconfig.base.json`** | **Thin and rarely touched.** App-specific config lives in the app. The root file exists to delegate |
| **Root `CLAUDE.md`** | Shared rules only. Anything true of one workstream belongs in that workstream's file -- S8 |

> **A rule restated in two places has one stale copy, and this document set has now produced four.** ADU-DB-01's step-up enumeration against ADU-AUTH-01's catalogue; S6.9a's Companion permission list against the same catalogue; Appendix A's withdrawn block against its own change table; and now S5.1's base-URL sentence, which the root `CLAUDE.md` was still carrying after `packages/api-client/README.md` had already reasoned its way to the correct reading.
>
> **The instruction files reference the specification; they do not restate it.** A rule that appears in `CLAUDE.md` and in a document will drift, and the copy an agent reads first is the one it follows. Where a workstream's instruction file needs a rule, it cites the section -- and where it must inline something for practicality, that line is the one to check first when the two disagree.
>
> **The fourth instance was caught by a README that reasoned rather than transcribed**, which is the argument for writing the reason down and not only the rule.

---

## 7. CI, scoped to what changed

One workflow, one job per workstream, each filtered:

```yaml
- run: pnpm --filter "...[origin/main]" typecheck
- run: pnpm --filter "...[origin/main]" test
- run: pnpm --filter "...[origin/main]" build
```

`...[origin/main]` selects packages changed since `main` **and everything that depends on them**. A console-only PR runs the console. A `packages/locale` PR runs all four, which is correct and is the cost of a shared package.

**Repository-wide gates run on every PR regardless**, because they guard invariants no single workstream owns:

- Appendix C, all sixteen checks
- `verify-permission-doc` -- 252 cells, both directions
- `verify-docs-ascii` -- no byte above 126, no control byte, in any governed document
- The OpenAPI additive diff
- `dependency-cruiser` -- rules 1 to 4
- Secret scan

---

## 8. Agent instruction files

**Verified against Anthropic's documentation:** starting Claude Code from a package directory loads that package's `CLAUDE.md` **and** the root file. `/context` lists what loaded.

[!] **v1.0 stated this as isolation and it is not.** Sibling instruction files are **pulled in on demand** when Claude reads into that directory. At session start there are no sibling instructions; **after an agent reads across a boundary, there are.** So the isolation is a *consequence of not reaching across*, which is a habit -- and this document's whole argument is that habits are the wrong place to keep a boundary.

> **Enforce it in `.claude/settings.json`, per app.** `claudeMdExcludes` takes glob patterns matched against absolute paths and drops other workstreams' instruction files; `permissions.deny` takes `Read(...)` rules and stops the reads that would pull them in. Together they turn a loader behaviour into a guarantee -- and they enforce dependency rule 2 at the agent's read boundary, one layer earlier than `dependency-cruiser` catches it at the import.

| File | Contains |
|---|---|
| `CLAUDE.md` (root) | The prime rule (documents beat code) - the eleven load-bearing absences - `set_config(..., true)` - no `MATERIALIZED VIEW` - ASCII rule - dependency rules 1-4 - reading order. **Kept under ~200 lines** |
| `apps/api/CLAUDE.md` | Migration discipline, the named-function rule, no string-built SQL, the SQLSTATE table |
| `apps/console/CLAUDE.md` | S9.4 |
| `apps/mobile/CLAUDE.md` | No price, tier name or billing link anywhere in the bundle -- ADU-API-01 S4.1 |
| `apps/storefront/CLAUDE.md` | Anonymous only; the nonce CSP; no authenticated surface |

> **Start each session from the workstream directory, not the repository root.** From the root, an agent loads only the root file -- so a console session started at the root has none of S9.4's rules and every one of the backend's. **This is the single most consequential operational habit in this document**, and it costs nothing to adopt and is invisible when it is skipped.

**One caveat that bites:** project settings (`.claude/settings.json`) load **only** from the directory you start in -- a root settings file does not apply to a session started in a subdirectory. So per-app settings files are not optional if per-app permissions matter.

---

## 9. The seller console PWA -- the workstream this document builds

### 9.1 What it is

[!] **v1.3 -- the console has no separate owner.** v1.2 assigned it to the COO/CTO. **It is the CEO's, like everything else**, and `apps/console/CLAUDE.md` records that.

**What does not change: S4's rules, and the per-workstream instruction files.** The console still may not import from `apps/api/`, and a console session still starts from `apps/console/`. **One owner makes the boundary cheaper to cross and no less important to keep.**

The **full seller management system** (ADU-ARCH-01 S1). Thirty screens, five primary destinations, twelve states, specified in ADU-CON-03 v1.1. **Nine of the ten publication-readiness items are reachable from nowhere else**, so it is the only surface on which a person becomes a seller.

It also carries **one screen for a different user entirely** -- the courier (SC-C1). Same deployment, same audience value, separate route tree, no seller navigation.

### 9.2 The tree

**`features/` mirrors ADU-CON-03's groups, and folder names carry screen IDs**, so the mapping from specification to code is mechanical and a reviewer can check coverage by listing a directory.

```
apps/console/
|--- public/
|   |--- _headers                CSP. script-src 'self', no nonce -- ADU-CON-02 S3.9
|   `--- fonts/                  Inter + Noto Sans Ethiopic, self-hosted, per-family unicode-range
|--- src/
|   |--- main.tsx
|   |--- router.tsx              /s/:sellerId/* and /courier
|   |--- api/
|   |   `--- client.ts           thin wrapper over @adulis/api-client. DO NOT hand-edit types.
|   |--- auth/
|   |   |--- SignIn.tsx              SC-00
|   |   |--- remember-device.ts      R17
|   |   |--- idle-warning.ts         27-minute / 7h55 warning
|   |   `--- step-up.tsx             SC-31
|   |--- layout/
|   |   |--- Shell.tsx               sidebar >=1024px, bottom bar <1024px
|   |   |--- SellerSwitcher.tsx      renders ONLY when the account holds >1 seller
|   |   `--- nav.ts                  five destinations, no more
|   |--- features/
|   |   |--- entry/                  SC-01 Home (both lives), SC-02
|   |   |--- trade/                  SC-03 SC-04 SC-05 SC-06
|   |   |--- catalogue/              SC-07 SC-08 SC-09 SC-10 SC-11
|   |   |--- conversation/           SC-20 SC-21
|   |   |--- trust/                  SC-12 SC-13 SC-14 SC-15 SC-16
|   |   |--- store/                  SC-17 SC-18 SC-19 SC-22 SC-23
|   |   |--- admin/                  SC-24 SC-25 SC-26 SC-27 SC-28 SC-29
|   |   `--- notifications/          SC-30
|   |--- courier/
|   |   `--- CourierOrders.tsx       SC-C1. No seller nav. Mobile layout only.
|   |--- components/                 primitives on @adulis/tokens
|   `--- lib/
|       |--- intl.ts                 money and dates, client-side, market timezone
|       |--- idempotency.ts          key minted on control MOUNT, not on click
|       |--- blob-viewer.ts          evidence: blob URL, revoked on unmount
|       `--- states.ts               the twelve states of ADU-CON-03 S3
|--- test/
|--- index.html
|--- vite.config.ts                  vite-plugin-pwa: app shell only, /v1/* NetworkOnly
|--- CLAUDE.md
`--- .claude/settings.json
```

### 9.3 What the console may and may not reach

- **May:** `@adulis/api-client`, `@adulis/locale`, `@adulis/tokens`, `@adulis/config`.
- **May not:** anything under `apps/`. Not `apps/api/` for a type, not for a Zod schema, not for a constant. **Rule 2, and the console is where it will first be tempting**, because the backend defines every shape the console renders.
- **The types it uses are generated** into `packages/api-client` from `contracts/openapi.json`. If a type is missing there, the endpoint does not exist yet, and the answer is the Prism mock, not a reach across.

### 9.4 `apps/console/CLAUDE.md`

The rules an agent working here needs and no others:

- **Build against the Prism mock** at `contracts/openapi.json`. Never import from `apps/api/`.
- **The seller id lives in the URL**, never in a store. Two stores in two tabs are two URLs -- ADU-AUTH-01 S8.3.
- **The console computes no business state.** It renders `state`, `allowed_actions` and `readiness[]` as the server resolved them. A countdown may display a server deadline; it may not decide anything when the countdown reaches zero -- it refetches.
- **The verbatim labels** of ADU-CON-03 S4.1. *"Confirm Payment Received"*, never *"Accept Payment"*. The verify-in-your-own-bank sentence is adjacent, always visible, never behind a disclosure.
- **The forbidden controls** of ADU-CON-03 S16: no accept-reservation, no review reply or hide, no level control, no delivery tracking, no countdown on a confirmed order, no generative assistance.
- **Every input has a `<label for>`. Every list has an empty state.** Validation renders a summary of anchor links plus per-field messages.
- **No `localStorage`, no `sessionStorage`, no token in JavaScript.** The session is an httpOnly cookie the console cannot read and does not need to.
- **The service worker precaches the app shell only.** `/v1/*` is `NetworkOnly`. Never an authenticated response, never an offline queue.
- **No fixed heights on anything holding translated text.** Amharic runs 30-50% longer.
- **A missing Amharic key is a compile error**, not a fallback.
- Screens whose endpoints do not exist are **not built**. ADU-CON-03 S17 lists the four.

### 9.5 Build order

The console cannot be built screen-by-screen in specification order, because most screens need the shell, the states and the client first.

| Stage | Contents | Done when |
|---|---|---|
| **C-1** | Generated client, Prism mock, `states.ts`, shell, nav, router, `intl.ts` | A placeholder route renders inside the shell at both breakpoints, with the twelve states demonstrable |
| **C-2** | SC-00 sign-in, SC-31 step-up, remember-device, idle warning | A seeded seller signs in against the mock and is warned before idle expiry |
| **C-3** | SC-01 Home, both lives, and SC-02 | Nine readiness items render from `readiness[]`, in any order, resumable |
| **C-4** | Trade -- SC-03, 04, 05, 06 | The three clock treatments visible; the handoff region gated on `PAYMENT_CONFIRMED`; the payment decisions equally weighted |
| **C-5** | Catalogue -- SC-07 to SC-11 | Set-count and confirm-stock are visibly two actions |
| **C-6** | Store and admin -- SC-17 to SC-19, SC-22 to SC-29 | Payout's five disclosures; cancel present only with a pending change |
| **C-7** | Trust, conversation, notifications -- SC-12 to SC-16, SC-20, SC-21, SC-30 | Reviews read-only; the empty claims list reads as good news |
| **C-8** | SC-C1 courier | Mobile only, no seller nav, QR only after custody |

**C-1 to C-3 can start today against the mock.** They do not wait for Tier 3.

---

## 10. Bringing the other four in

**Nothing here is my scope; it is the boundary each workstream lands inside.**

- **`apps/storefront/`** -- the Next.js site exists in its own repository. Import it with `git subtree add --prefix apps/storefront <url> main`, which preserves its history; a copy-paste loses it. Its Tier 2 stubs, route-prefixed i18n and `AM_ENABLED` flag come with it. **Its CSP keeps the nonce** -- Next.js injects inline bootstrap scripts, which is the whole reason the console does not use Next.js.
- **`apps/mobile/`** -- a placeholder `CLAUDE.md` and nothing else until assigned. Its one non-obvious rule is worth writing before anyone starts: **no price, no tier name and no billing link may appear anywhere in the bundle**, and a mobile session receives 403 rather than a redirect, because a redirect is itself a link to an external purchase mechanism (ADU-API-01 S4.1).
- **`apps/api/` and `db/`** -- unchanged, mid-Tier-2, and deliberately untouched by this restructure.

**One thing outside this document that a restructure is the moment to fix.** The repository is named `Adulis-MobileApp` and now holds five workstreams, one of which is the mobile app. A GitHub rename to `adulis-platform` preserves history, issues, pull requests and redirects, and costs one `git remote set-url`.

---

## 11. Landing this

Ordered so that nothing in flight breaks **and so that no step forecloses a later one**.

| # | Step | Note |
|---|---|---|
| 1 | **Governance, no code moves** -- `CODEOWNERS`, root `CLAUDE.md` trimmed, `apps/api/` and `apps/console/` instruction files, `dependency-cruiser`, per-app `settings.json` with `claudeMdExcludes` | **Safe to merge mid-tier.** Branch from `main`, not from the Tier 2 branch, or it is not independently mergeable |
| 2 | **`apps/storefront/` by `git subtree add --prefix apps/storefront <url> main`** | **Before any file exists at that path** -- see below |
| 3 | `apps/storefront/CLAUDE.md`, applied **after** the import | Keep it staged in a runbook until then |
| 4 | `apps/mobile/` placeholder and its instruction file | No ordering constraint |
| 5 | **`contracts/openapi.json`** and its CI job | Requires a producer -- S11.1 |
| 6 | **`packages/api-client`**, generated | Follows step 5 |
| 7 | **Console C-1** | Needs none of the above |

> **Step 2 before step 3, and v1.0 had it backwards.** `git subtree add` **refuses an existing prefix** -- reproduced exactly: `fatal: prefix 'apps/storefront' already exists`. v1.0's step 1 created `apps/storefront/CLAUDE.md`, which creates the directory, which would have made the import impossible without deleting the file first and losing the reason it was there.
>
> **The instruction file is not the cost.** Anything written at that path before the import blocks it -- a `.gitkeep`, a README, an empty directory that git happens to track. **`apps/storefront/` stays absent until its history arrives.**

### 11.1 What is actually unblocked today, and what is not

**v1.0 said steps 1 to 3 are prerequisites for anyone joining. That was wrong, and the reason is worth stating.**

`contracts/openapi.json` is **generated from the API's decorators**. Until the API has endpoints there is nothing to generate from -- no `@nestjs/swagger`, no `/v1` prefix, no routes. **The producer arrives in Tier 3.** So the seam that lets a front-end workstream develop against a mock cannot exist before the backend has something to describe.

| Can start now | Waits for |
|---|---|
| **Console C-1** -- generated-client *wrapper*, states, shell, nav, router, `intl.ts`. **It needs no endpoint at all** | -- |
| Storefront import and its own build | -- |
| Console C-2 onward | The auth endpoints, which are the first thing Tier 3 builds |
| `packages/api-client` with real types | `contracts/openapi.json`, Tier 3 |

**The honest position: one stage of one front-end workstream is unblocked today, and the rest waits on Tier 3.** That is a smaller claim than v1.0's and it is the true one. **Do not hand-write a placeholder `openapi.json` to close the gap** -- a hand-authored contract is exactly the lie with authority S5.1 forbids, and it would diverge from the generated one silently the day the producer lands.

### 11.2 The CI filter has a foot-gun

`pnpm --filter "...[origin/main]"` needs two things v1.0 did not mention:

- **`fetch-depth: 0` on the checkout**, or `origin/main` does not exist in the runner and the filter selects nothing.
- **The workspace root is itself selectable.** If a root script runs `pnpm -r <script>`, a filtered CI invocation re-enters it unfiltered and runs everything -- the scoping silently does nothing. **Root scripts must not be recursive**, or the root must be excluded from the filter.


---

*Binding repository structure, v1.3. One engineer now, so `CODEOWNERS` names one owner -- and the finding that reissue produced is worth more than the change: neither original handle was ever a collaborator, GitHub silently ignores an entry for a user without access, and the file therefore requested review from nobody from the day it was written. Not a document that went stale when someone left; a document that was wrong when it was committed, while every work order since assumed it was the outermost review layer. With branch protection inapplicable on this plan, the review model has been CI and nothing else for the whole build. The four dependency rules are unchanged, and S4 says why one owner is a reason to hold them harder rather than loosen them. From v1.2: Five workstreams, four dependency rules, three seams, one backend. v1.1 corrects four things that only appeared when someone built it: an ordering that would have made the storefront import impossible, an isolation claim that was a loader behaviour rather than a guarantee, a contract this document forbade committing and then depended on being committed, and a sequencing claim that assumed a producer three tiers away. v1.2 corrects one more: a sentence whose two halves could not both be followed, settled by the demonstration printed two lines above it -- and the fourth case in this document set of one rule kept in two places with one copy stale. The rule that matters most is the one that will be broken helpfully -- an app importing from another app compiles, passes, and quietly welds two workstreams into one, which is why it is enforced by tooling and not by agreement. The seller console is specified in full in S9; the other four get a boundary, an owner and a placeholder, which is what concurrent work requires and all it requires.*
