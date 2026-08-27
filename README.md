# Adulis Platform

Adulis gives sellers on TikTok and Instagram a structured, trust-backed
storefront: buyers reserve stock and pay the seller directly by bank transfer,
and Adulis never touches buyer money.

**One API, four clients, two processes, one PostgreSQL; correctness is enforced
in the database.**

---

## Read this first

**When generated code and a binding ADU document disagree, the document wins.**
The document is amended first, then the code — never the reverse. Never invent an
answer to an open product, database, API, security or legal question; return the
status and stop.

| Read | For |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Loaded every agent session. The eleven load-bearing absences, the non-negotiable mechanics, the specification discipline |
| [`.claude/reference/DOCUMENT_AUTHORITY.md`](.claude/reference/DOCUMENT_AUTHORITY.md) | Which document governs which question, the known version gaps, and the seven required statuses. **Read before any implementation work** |
| [`docs/ADU-CON-02_Seller_Console_System_Design_v3_0.md`](docs/ADU-CON-02_Seller_Console_System_Design_v3_0.md) | **The standing operating manual for both developers.** Part A the system, Part B building it, Part C running it |

`docs/` holds the binding document set with the code, so it is greppable in
every session.

---

## Repository map

```text
adulis-platform/
├── apps/
│   ├── api/                        # NestJS — API and worker, one codebase
│   │   ├── src/main.ts             #   HTTP entrypoint (process 1)
│   │   ├── src/worker.ts           #   graphile-worker entrypoint (process 2)
│   │   ├── src/common/             #   the request pipeline
│   │   │   ├── auth/ errors/ idempotency/ rate-limit/
│   │   │   └── db/                 #   Kysely, two pools, the §6.1 tx-settings helper
│   │   ├── src/modules/            #   one folder per ADU-API-01 §12 endpoint group
│   │   ├── src/jobs/               #   job handlers (§3.7)
│   │   └── test/                   #   integration tests against real Postgres
│   └── console/                    # Vite React SPA on Cloudflare Pages
│       ├── src/{api,auth,layout,features,components,lib}/
│       └── public/_headers         #   the console CSP — reviewable in a diff
├── packages/
│   ├── locale/                     # en.ts defines the key union; am.ts must satisfy it
│   ├── tokens/                     # design tokens (COO/CTO)
│   └── config/                     # shared strict tsconfig, eslint, prettier
├── db/
│   ├── migrations/                 # hand-written SQL, applied by node-pg-migrate
│   ├── checks/                     # ADU-DB-01 Appendix C as executable checks
│   ├── seed/                       # one market, config rows, a test seller
│   └── init/                       # local-only: the four extensions on first boot
├── docs/                           # the binding ADU document set, with the code
│   └── build-status/TIER-STATUS.md # tier status and the reissue debt register
├── ops/
│   ├── provider-verify/            # the §18 capability probe — disposable test DDL
│   ├── runbooks/                   # §20.5
│   └── scripts/                    # db:check, db:verify-extensions, db:seed
├── .claude/                        # 16 skills + 4 reference files
└── .github/workflows/              # CI — §16
```

Generated files are committed but **never hand-edited**; CI regenerates and fails
on the diff. `.env.example` names every variable with a fake value; the real
`.env` never enters git.

---

## Day-one setup

ADU-CON-02 §13, adjusted to what exists at Tier 0.

```bash
fnm install 22 && fnm use 22          # matches .nvmrc
corepack enable && corepack prepare pnpm@latest --activate
git clone <this repo> && cd adulis-platform
pnpm install
docker compose up -d                   # Postgres 17 + the four extensions
cp .env.example .env                   # fill local values
pnpm db:verify-extensions              # must print 4 PASSes  <- the Tier 0 gate
pnpm db:migrate                        # "No migrations to run!" — there are none yet
pnpm db:check                          # prints "0 checks present (pre-v1.7)"
pnpm db:seed                           # prints "no seed until Tier 1"
pnpm test
pnpm dev                               # api :3000 · worker · console :5173
```

**Three ways Tier 0 differs from §13's script, all expected:**

- **`db:check` is empty and prints `0 checks present (pre-v1.7)`.** §13 wants
  fifteen passes. ADU-DB-01 v1.6 Appendix C defines fourteen checks and its check
  14 expects 105 tables where ADU-CON-02 v3.0 requires 107; check 15 arrives with
  the **v1.7** reissue. Writing checks now would mean inventing v1.7.
- **`db:seed` is a stub and the console cannot sign in a seeded seller.** Both
  need migrations that are Tier 1 work.
- **If you already run PostgreSQL locally on 5432**, both it and the container
  will listen and *yours answers first* — which shows up as
  `password authentication failed`, not as a port clash. Set
  `POSTGRES_HOST_PORT=5433` and match the port in `DATABASE_URL`.

`pnpm ci:local` runs typecheck → lint → test → build, the same order as CI.

---

## How we work

- **Trunk-based.** Short-lived branches, small PRs: one endpoint group, one
  screen, one migration.
- **Squash-merge into protected `main`.** CI must pass, one approval, no direct
  pushes. **The other founder approves** — CI does the deep checking, the human
  checks conformance to the documents.
- **Document → agent → verify.** The work order names the ADU sections, the
  scope and the gate that verifies it; the agent builds within the slice and
  stops at its boundary; verification is a command, not an opinion; disagreement
  between output and document amends the **document first**.
- **Ownership.** CEO owns back-end, database, migrations, auth, infrastructure.
  COO/CTO owns console, mobile, design system, generated-client consumption.
  `ADU-API-01` is the contract between them.
- **Definition of done, per PR (§14.5):** *code + tests + both locale entries +
  spec regenerated + gate green + reviewed. Not five of six.*

---

## Build status

**[`docs/build-status/TIER-STATUS.md`](docs/build-status/TIER-STATUS.md)** — the
per-tier status table, the reissue debt register and the open questions.

**Tier 0 complete; Tiers 1+ gated on the DB-01 v1.7 / AUTH-01 v2.1 / API-01 v1.4
/ SEC-01 v1.1 reissues.**

---

## What must never be built

Eleven absences are invariants. **Completing the schema by adding one is the
defined failure.** Never add:

`original_key` on media · a generated chatbot reply-text column · `has_chatbot`
or any stored entitlement boolean · a score column on the feed · an
Accept-Reservation action or state · a bulk reissue path · operator
impersonation · an image column on identity verification · a free-text column on
`seller_public_stats` · an FK from `nlu` into `core`/`chat` · a seller-writable
column on `review`.

Alongside them, three mechanics that are equally non-negotiable:
`set_config(..., true)` — the third argument is transaction-local and is the
entire RLS control · `CREATE MATERIALIZED VIEW` is a forbidden phrase (R16) ·
no string-built SQL outside the `sql` template tag.

---

## Licence and ownership

Proprietary. © Adulis. Private repository pending IP and trademark filings;
nothing is published.
