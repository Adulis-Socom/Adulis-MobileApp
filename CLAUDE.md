# Adulis Platform — shared rules

**This file carries only what is true of every workstream.** Anything true of one
lives in that workstream's own `CLAUDE.md` (ADU-REPO-01 §8). It is maintained like
code: it changes in the same PR as any decision that changes it.

> ## ⚠ Start your session from the workstream directory, not here
>
> Claude Code loads every `CLAUDE.md` from the filesystem root **down to** the
> directory you start in — so starting in `apps/console/` gets this file *and* the
> console's. **Started at the repository root you get this file and nothing else**, so
> a backend session begun here has none of the migration discipline, none of the
> SQLSTATE table and none of the counts.
>
> ```
> cd apps/api        && claude   # backend + database + migrations
> cd apps/console    && claude   # seller console PWA
> cd apps/mobile     && claude
> cd apps/storefront && claude   # after the subtree import — ops/runbooks/
> ```
>
> `/context` lists what actually loaded. **This is the single most consequential
> operational habit in the repository, it costs nothing, and it is invisible when it
> is skipped.**
>
> **Two mechanics worth knowing, one of which corrects ADU-REPO-01 §8.** Project
> settings (`.claude/settings.json`) really do load *only* from the directory you start
> in — a root file does not reach a subdirectory session, which is why each app has its
> own. But a **sibling's `CLAUDE.md` is not permanently out of context**: subdirectory
> instruction files load *on demand* when files in those directories are read. Isolation
> is therefore a consequence of not reaching across, not a guarantee of the loader —
> which is the same reason rule 2 is enforced by `dependency-cruiser` and by each app's
> `permissions.deny`, rather than by where you happened to start.

> **This file CITES the specifications; it does not replace them** (ADU-REPO-01 v1.2 S6).
> Where a rule is inlined below for practicality, **the citation beside it governs, and
> the inlined line is the first thing to check when the two disagree.**
>
> **A rule kept in two places grows a stale copy.** This document set has produced four:
> ADU-DB-01's step-up enumeration against ADU-AUTH-01's catalogue; S6.9a's Companion
> permission list against the same catalogue; Appendix A's withdrawn block against its own
> change table; and S5.1's base-URL sentence, which *this file* was still carrying after
> `packages/api-client/README.md` had already reasoned its way to the right reading. The
> copy an agent reads first is the one it follows.

## The prime rule

**The documents govern; the code discharges them.** Before implementing anything,
identify the governing ADU document and read `.claude/reference/DOCUMENT_AUTHORITY.md`.

- **Reading order:** ADU-00 → ADU-PROJ-01 → ADU-PRD-01 → **ADU-DB-01** → ADU-API-01.
  Repository structure is **ADU-REPO-01**.
- **Read `docs/amendments/README.md` before `docs/`.** It states which version of each
  document governs and which amendments are live.
- **Never invent an answer to an open product, database, API, legal, security or
  infrastructure question.** Report the gap; do not fill it.
- Where a later binding architecture record depends on an unreissued lower-level spec,
  return `SPEC_VERSION_GAP` and stop that part of the work.
- Product behaviour belongs to the PRD; database-enforceable invariants belong in
  PostgreSQL; the API exposes resolved state; clients display state and send intents.
- Adulis uses **one API, one PostgreSQL, two backend processes (API/worker), and no
  per-surface backend.** Every state-changing endpoint calls a named database function
  where one exists.
- Company name is **Adulis**. `Omnivo` is retired except in historical filenames.
- **Stop at the boundary of the assigned slice or tier, and end every session by
  listing what was NOT done.**

## The five workstreams, and the four rules between them

ADU-REPO-01 §1 and §4. **One backend serves all three clients** — a surface is a value
in `core.session_audience`, never a deployment and never a directory.

| Path | Workstream | Owner |
|---|---|---|
| `apps/api/` · `db/` | Backend and database | CEO |
| `apps/console/` | Seller console PWA | COO/CTO |
| `apps/mobile/` | Mobile app — buyer plus seller lite, **one app, two modes** | unassigned |
| `apps/storefront/` | Storefront website | unassigned |

1. `apps/*` **may** import from `packages/*`
2. `apps/*` **may never** import from another `apps/*`
3. `packages/*` **may never** import from any `apps/*`
4. `packages/*` may import other `packages/*`, acyclically

> **Rule 2 is the one that gets broken, and it gets broken helpfully.** Needing a type
> the API already defines, you import it from `apps/api/` because it is right there and
> the build stays green. Six weeks later the console cannot be built without the
> backend, CI scoping means nothing because everything depends on everything, and the
> two workstreams that were supposed to proceed independently are one.
>
> **When rule 2 is in your way, move the shared thing into `packages/`** — a deliberate
> act reviewed by both owners. Never reach across.
>
> Enforced by `dependency-cruiser` in CI (`pnpm verify:deps`), not by review. A rule
> that depends on someone noticing is a rule that holds until the week someone is busy.

## The three seams — everything crossing a boundary crosses at one of these

There is no fourth.

| Seam | Carries | Rule |
|---|---|---|
| `contracts/openapi.json` | backend → every client | **Tracked in git, and CI is its only author.** A human-authored diff to it fails the build. Tracked so every client has it offline; CI-written so nobody edits it. A hand-edited spec is a lie with authority |
| `packages/tokens` | design → three clients | Values only. **No component** — a web button and a React Native button share values, not code |
| `packages/locale` | content → everyone | `en.ts` defines the key union; a missing Amharic string is a **compile error**, not a fallback |

**Every client develops against the Prism mock** (`pnpm mock:api`) and flips a base URL
when the endpoint lands. **No front-end workstream is ever blocked on the backend.**
Front-end types are generated into `packages/api-client`; never hand-author a duplicate DTO.

## Load-bearing absences — completing the schema is the defined failure

**Eleven absences are invariants.** Never add: `original_key` on media · a generated
chatbot reply-text column · `has_chatbot` or any stored entitlement boolean · a score
column on the feed · an Accept-Reservation action or state · a bulk reissue path ·
operator impersonation · an image column on identity verification · a free-text column
on `seller_public_stats` · an FK from `nlu` into `core`/`chat` · a seller-writable column
on `review`.

An agent "completing" the schema by adding one silently removes the guarantee. Appendix C
is how that gets caught.

## Non-negotiable mechanics

- Every database access runs inside a transaction whose first statement sets
  `adulis.account_id`, `adulis.actor_role`, `adulis.seller_id` via
  **`set_config(..., true)`** — the third argument is transaction-local and is the entire
  RLS control. Never `SET`, never `set_config(..., false)`.
- **`CREATE MATERIALIZED VIEW` is a forbidden phrase** (R16). `seller_public_stats` is a
  trigger-maintained table; a materialized view is O(entire history) per refresh.
- **ADU specification documents are ASCII** (A3.5). No byte above U+007F, in prose or in
  data — three sessions in a row lost documents to transit damage, and a document that
  will not install governs nothing.
  `pnpm verify:docs-ascii` enforces it on the governed set, reports the pre-A3.5
  documents as visible debt, and also fails on a control byte anywhere in source.
- **`docs/registers/ADU-VAL-01` is a register, not a specification. It governs nothing
  and is never a build source.** A value listed there as OPEN or DEFAULT is *deliberately*
  absent: do not report it as a spec gap and do not invent one. A value missing from a
  document that does **not** appear in ADU-VAL-01 **is** a gap — report it. A **column**
  is a schema decision (ADU-DB-01); a **value** is a business decision that arrives later
  as a configuration row.
- **No secrets in code.** `.env.example` carries fake values only, never a real one.
- **No edits to generated files** — `contracts/openapi.json`,
  `packages/api-client/src/schema.d.ts`, any generated client.
- **Do not introduce** Redis, brokers, Elasticsearch, microservices, BFFs, Kubernetes,
  JWT sessions, or an ORM write path without a reissued binding architecture decision.

## Collision surfaces (§6)

The places two people editing different things still conflict. Each has a rule because
the default outcome of a merge conflict in these files is a **silent** wrong answer.

| Surface | Rule |
|---|---|
| `pnpm-lock.yaml` | **Never hand-merge.** Take either side, run `pnpm install`, commit the result. A hand-merged lockfile installs a set of versions nobody tested |
| `db/migrations/NNNN_*.sql` | **Single writer — the backend owner.** Two people adding `0016` collides *cleanly* and yields two migrations with one number |
| `contracts/openapi.json` | **Written by CI only.** Front-end workstreams read it and never touch it |
| `packages/*` | **Its own PR, both owners.** Never bundled into an app change |
| Root `package.json`, `tsconfig.base.json` | Thin and rarely touched. The root exists to delegate |
| This file | Shared rules only. Anything true of one workstream belongs in that workstream's file |
