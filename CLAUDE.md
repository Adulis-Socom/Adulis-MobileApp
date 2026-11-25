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
> cd apps/mobile     && claude   # or the Adulis-Mobile-Workspace parent - apps/mobile/CLAUDE.md
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
- **The November 8 2026 reconciled system-design pack is the current system-design
  authority** (founder decision, WO-001B): `docs/system-designs/2026-11-08/`, 34 complete
  designs, indexed with versions in `docs/system-designs/README.md`. It outranks the older
  repository specifications for design intent. The precedence and the recorded conflicts
  (payment model, discovery scope, background engine, Courier audience and others) are in
  `.claude/reference/DOCUMENT_AUTHORITY.md`. Where the pack disagrees with what is built,
  the status is `SPEC_CONFLICT`: report it, and never change the implementation to match
  either side without a work order. A disagreement already classified in
  `docs/mobile/WO-001C-CONTRACT-GAPS.json` carries its register status, and a founder-ruled
  item (K-1 payment, K-2 discovery, K-7 encoding) is not reopened.
- **The 24 November 2026 layer outranks the November 8 pack where they differ** (founder
  decisions D24-01..D24-18, working authority and not a signed board or legal approval):
  `Governance/DECISION_REGISTER_2026-11-24.md` of the Nov 24 pack, then each design's
  Nov 24 amendment, then the Nov 8 body. In short: payment authority is undecided and no
  PSP, Seller payment confirmation, real paid Order, refund or surcharge is to be built;
  checkout is Option A (real Cart, review only, never submits) plus Option C (isolated,
  development-only simulation); Seller Stories are in the MVP; the whole of Ethiopia is the
  first active Market; the build order is one surface at a time, frontend then backend,
  Seller Console first. The legacy payment code that still exists is **not** approved
  behaviour: do not extend it, and do not delete it without a work order.
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
| `apps/console/` | Seller console PWA | CEO |
| `apps/mobile/` | Mobile app — Buyer, Seller Companion and Courier modes, **one app** | unstaffed |
| `apps/storefront/` | Storefront website | unstaffed |

> **One owner, since T7 S0 (register D-94).** The COO/CTO has left; `.github/CODEOWNERS`
> routes every path to the one remaining owner, and the unstaffed-workstream doctrine
> (no owner line at all) is superseded -- review-by-nobody and review-by-the-only-
> engineer are the same thing, and the records say so rather than implying a second
> reviewer who does not exist. **The four boundary rules below do not relax.** They
> exist so the workstreams stay separable, and that matters MORE with one person.

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
> act, made in its own PR and recorded there. Never reach across.
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

**Clients build against the real API since T7 S7.1** -- the endpoints exist, and a
done-clause verified against a mock is not verified. The Prism mock (`pnpm mock:api`)
remains for contract-only work and for a client whose endpoint genuinely has not
landed; the base URL is one variable either way.
Front-end types are generated into `packages/api-client`; never hand-author a duplicate DTO.

## Load-bearing absences — completing the schema is the defined failure

**Eleven absences are invariants.** Never add: `original_key` on media · a generated
chatbot reply-text column · `has_chatbot` or any stored entitlement boolean · a score
column on the feed · a restored legacy Reservation (below) · a bulk reissue path ·
operator impersonation · an image column on identity verification · a free-text column
on `seller_public_stats` · an FK from `nlu` into `core`/`chat` · a seller-writable column
on `review`.

An agent "completing" the schema by adding one silently removes the guarantee. Appendix C
is how that gets caught.

**The legacy Reservation model is retired** (founder pre-launch authorization, 25 November 2026;
`docs/amendments/BATCH-02B-FOUNDER-DECISIONS-2026-11-25.md` B02B-D01). No active Reservation
entity, creation, acceptance, cancellation, stock hold, expiry, associated API or product behavior
may be introduced or restored. Historical migration references are not active architectural
authority. Adulis has not launched, so obsolete unreleased compatibility contracts may be removed
rather than kept as placeholders.

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
  **Scope (founder decision, WO-001C):** A3.5 binds the repository's legacy executable
  specifications, meaning the documents gates parse or `verify:docs-ascii` governs. The
  November system-design pack (`docs/system-designs/2026-11-08/`) is UTF-8 design
  authority by decision. It is never transliterated and no ASCII duplicate is made.
  Its integrity check is its own `SHA256SUMS.txt`, and the gate's debt list shows its
  files only because the walk is recursive.
- **`docs/registers/ADU-VAL-01` is a register, not a specification. It governs nothing
  and is never a build source.** A value listed there as OPEN or DEFAULT is *deliberately*
  absent: do not report it as a spec gap and do not invent one. A value missing from a
  document that does **not** appear in ADU-VAL-01 **is** a gap — report it. A **column**
  is a schema decision (ADU-DB-01); a **value** is a business decision that arrives later
  as a configuration row.
- **No secrets in code.** `.env.example` carries fake values only, never a real one.
- **No edits to generated files** — `contracts/openapi.json`,
  `packages/api-client/src/schema.d.ts`, any generated client.
- **Do not introduce** Elasticsearch, microservices, BFFs, Kubernetes or JWT sessions
  without a reissued binding architecture decision.
- **Approved target stack versus current stack (D24-08..D24-10).** The founder has decided
  the target: NestJS on **Fastify**, PostgreSQL with **Drizzle**, and **BullMQ on Valkey**.
  The stack that is built, and that every executable specification and gate describes today,
  is NestJS on **Express**, **Kysely** and **Graphile Worker**. The migration is a separate,
  controlled, later phase (`ADU-MIG-2026-11-24`, hold points HP-A to HP-E). **Neither the
  migration nor any new Redis/Valkey, BullMQ, Drizzle or Fastify dependency is authorised
  until a migration-scoped work order names its target, backup, rollback and owner
  approval.** Until then: do not extend the legacy stack as if it were the target (no new
  Graphile job families or Kysely-only abstractions beyond what a work order needs), do not
  remove it, and keep every SQL migration, function and RLS policy as written. The old K-3
  and K-8 "awaiting a founder ruling" wording is superseded by those decisions; the
  migration itself stays unauthorised.
- **Clean rebuild lineage (25 November 2026, RB25-D01..D08,
  `docs/amendments/REBUILD-2026-11-25-CLEAN-LINEAGE.md`).** The founder directs a clean replacement, not
  an in-place migration. On the rebuild integration branch `rebuild/2026-11-25` the paragraph
  above describes the ARCHIVED legacy lineage only (dev 64d2e8c, migrations 0001-0062, draft #191's
  0063). The replacement lineage builds the target stack clean in Stage B (ARC-BE-01..06) only after
  Batch 01A is accepted, with its own migrations and gates; it never points at `adulis-postgres`,
  copies no real data, and contains no Express, Kysely, Graphile Worker or node-pg-migrate runtime,
  no Reservation, legacy Order, payment, handoff or payout model, and no paid-commerce placeholder
  table. The mechanics in this section (transaction-local `set_config`, the generated-file rule, the
  load-bearing absences, no secrets) carry into the replacement unchanged.

## Collision surfaces (§6)

The places two people editing different things still conflict. Each has a rule because
the default outcome of a merge conflict in these files is a **silent** wrong answer.

| Surface | Rule |
|---|---|
| `pnpm-lock.yaml` | **Never hand-merge.** Take either side, run `pnpm install`, commit the result. A hand-merged lockfile installs a set of versions nobody tested |
| `db/migrations/NNNN_*.sql` | **Single writer — the backend owner.** Two people adding `0016` collides *cleanly* and yields two migrations with one number |
| `contracts/openapi.json` | **Written by CI only.** Front-end workstreams read it and never touch it |
| `packages/*` | **Its own PR.** Never bundled into an app change |
| Root `package.json`, `tsconfig.base.json` | Thin and rarely touched. The root exists to delegate |
| This file | Shared rules only. Anything true of one workstream belongs in that workstream's file |

## Branches (INF-02, founder decision of 2026-11-16)

`main` is **release-only**: no commits, merges, rebases, resets, force-pushes or new PRs into it until the
founder authorises the final integration. **`dev` is the development integration baseline.** Every work order
starts from the current verified `origin/dev` on its own `<track>/<work-order>` branch, opens its PR into
`dev`, and is merged only with CI green. Historical branches are preserved, never deleted or rewritten, and
never used as a starting point. Automated tests never use a persistent database or object store. Full policy:
`docs/engineering/DEVELOPMENT-BRANCH-POLICY.md`.

## Development storage (every work order)

Drive C: on the development machine has run out mid-session (ON-20261111-100). Follow
`docs/engineering/DEVELOPMENT-STORAGE-POLICY.md`: run `ops/scripts/adulis-storage-audit.ps1`
at the start, before cleanup and after cleanup; clean only positively identified disposable
artifacts of your own work order (dry run first); put temporary output on the external SSD
(`source ops/scripts/adulis-ssd-env.sh WO-xxx`, never falling back to C:); never delete protected data or run
`docker system prune -a --volumes`; and end the final report with the policy's nine storage
lines (start, before cleanup, after cleanup, net growth, generated, removed, recovered,
protected, concerns).
