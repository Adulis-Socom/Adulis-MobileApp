# T3 REPORT — autonomous run

> Written as-you-go. Last updated: **27 August 2026, Phase A complete.**
> Mode: Unattended.

## BLOCKERs

**`main`'s CI is red — diagnosed, fix rides this branch.** Every run since
the Tier-0 bootstrap commit fails, on `main` and on this branch alike, at
`verify:deps-fires` probe 2: the probe imports `../../api/dist/main.js` to
prove the `no-import-into-dist` rule fires, but in CI that step runs before
any build, `apps/api/dist` does not exist, the import cannot RESOLVE, and
`not-to-unresolvable` catches it instead — the probe fails asserting the
rule NAME while the boundary itself holds. It passed locally only where a
stale `dist/` happened to exist, which is why nobody saw it before CI did.
Fix (`ops/scripts/verify-deps-fires.sh`): the probe now plants a one-line
target inside `apps/api/dist` alongside the probe import, making it
independent of build order; verified locally in both environments (dist
absent — the CI shape — and dist present). **Not the schema, not this
phase's content: the same failure predates every T3 commit.** Merging this
branch turns `main` green; a cherry-pick of the one commit is available if
the owner wants `main` green sooner.

**A second CI defect sat behind the first.** With the probe fixed, the run
died at Test: CI ran the api suites BEFORE `Migrations apply`, so every
integration suite failed on a bare database (`relation core.market does not
exist`). The order dates from Tier 0, when every test was a unit test; the
probe failure earlier in the job masked it on every run since, and a
developer database is always already migrated so no local gate could see
it. Fixed by moving Test after the migrations in `ci.yml`.

Nothing else met the STOP bar.

## Where the run is

| Phase | State |
|---|---|
| **A — finish the schema (migrations 08–15)** | **COMPLETE. Merged to main (PR #4); main CI green — first since Tier 0.** |
| **B — request pipeline (13 components)** | **COMPLETE. Gate met.** |
| C — 123 endpoints (C1–C8) | **C1–C6 COMPLETE** (C1: 13/14 transfer PARKED D-24; C2: 18/18; C3: 18; C4: full financial boundary; C5: sync batch, QR at R20/R25, courier by RLS; C6: 28 endpoints — OTP ladder, sessions/R17 cookie pair, step-up single-use (D-32 roll-forward, migration 0023), devices, recovery, team/couriers with seat entitlements, billing behind R4, closure, BOTH deletion paths with S16.9 blockers, phone-reuse block read at seller creation; D-32..D-37 registered; C7: 13 endpoints — conversations with R10's defaultless scope (creation endpoint added, D-38), the cascade's layers 1-2 with escalation-as-notification and slot-gated templates (D-39), claims with the trigger-attached bundle, the single-transaction bank record, the identity-free export, the seller's remedy, and reviews with the derived badge). C8 not started |
| D — security review, load tests, proofs, hygiene | not started |

## Phase B — what was built

Branch `tier3/phase-b-request-pipeline` off the merged main. Thirteen
components, in dependency order, each committed green:

1. **The runtime role became real**: `DATABASE_URL` carries `adulis_app`
   everywhere (local + CI, LOGIN provisioned per environment); privileged
   tooling moved to `DATABASE_URL_MIGRATE`. Every boundary test after this
   proves something.
2. **Kysely types generated** from the live schema (108 tables, zero drift,
   `db:codegen`).
3. **The error contract**: closed catalogue, derived keys, RFC 9457 +
   `items[]`, §6.3's pg translation, R29's three-SQLSTATE sharpness
   (42501 logged fatal, served 500, never 403).
4. **The pipeline** (§5 order, one wiring shared with every e2e test):
   request id → 256KB limit → exact CORS + Origin CSRF (cookie-carried
   writes only) → locale → global-guard authenticate (ONE session read
   joining standing + R17 lifetimes; unmarked routes fail closed; the
   carrier must match the surface) → per-request seller context →
   fixed-window rate limit (keyed phone digests) → idempotency (record
   inside the handler transaction; concurrent twin loses the UNIQUE race
   and is served the winner's response) → `HandlerTransaction` (the ONE
   place `set_config` happens) → the error mapper.
5. **`/v1/bootstrap`** (D-20: market resolution + version floor unruled,
   floored open loudly).
6. **The contract producer**: `/v1` in the path keys, `verify:contract`
   live and passing, `schema.d.ts` generated, CI equality tripwire armed.

**The Tier 3 gate, item by item**: role matrix incl. every negative ✓
(252 cells, standing suite) · 8 step-up permissions reject MOBILE ✓ ·
scope failure = 404 **through the API** ✓ (pipeline e2e: stranger probes a
seller route, gets the ordinary not-found envelope, no detail) ·
pooled-connection settings-leak test ✓ (standing suite, now running as
`adulis_app`). 188 api tests; `ci:local` exit 0.

**Owed, recorded**: the additive-only contract differ (CI holds equality
until it lands) · the Zod→OpenAPI bridge decision (C1, first request
body) · Prism mock smoke against the generated contract.

## Phase A — what was built

Document migrations 08–15 as files `0010`–`0017` (numbering offset per the
`0010` header), one commit per migration, each smoke-tested against a fresh
database before commit:

| Doc | File | Contents |
|---|---|---|
| 08 | 0010 | Trust ladder, level events, anti-gaming, public stats (R16 O(1) counters) |
| 09 | 0011 | Cart, orders, reservations, both legal tables (17+6 ratified), both guards, `fn_mark_order_ready` |
| 10 | 0012 | `financial` boundary: evidence, credentials, shared access log, snapshots, `fn_create_order`, the D-16 write path |
| 11 | 0013 | Handoff: custody transfer (Event A), buyer scan (Event B), confirmation tiers, R-1 recovery |
| 12 | 0014 | Reviews, claims, evidence bundles, §12.4a lapse (W7: `SLA_BREACH`), evidence export |
| 13 | 0015 | `chat` + `nlu`, structurally separated; burden view; D-05 dimensionless vector |
| 14 | 0016 | Billing, ledger, analytics (70 seeded event definitions), moderation, follows, notifications — **and D5** |
| 15 | 0017 | Transport tables, `waitlist.application`, churn autovacuum |

## The Phase A gate, item by item

- `pnpm db:check` at `CURRENT_TIER = 2`: **16 PASS / 0 PENDING / 0 FAIL**
- Check 14: manifest 109 + 1 pinned body-over-manifest table (**D-18**) = 110,
  the exception asserted **by name** so any other stray still fails
- Legal tables: **17 + 6 rows, zero unratified**
- `pnpm db:determinism`: two clean databases, identical schema, 8,633 lines
- **CP-7, the test the order names**: with no thresholds in force, no seller
  is ever promoted. Three layers proven, plus a control market that promotes
  on the same evidence shape so a broken recompute cannot pass by accident
  (`apps/api/test/migration-08-15-trust-ladder-fail-closed.spec.ts`)
- `pnpm ci:local` exit 0 · 153 tests, 8 suites · `verify:permission-doc`
  (252 cells), `verify:docs-ascii`, `verify:deps`, `verify:deps-fires`,
  `verify:contract` all green

## Defects found by building (register D-16 – D-19; D-01 – D-15 predate)

- **D-16** — the financial boundary had read paths and no ratified write
  path; built the narrow definer (`write_payment_evidence`), locked the
  retention marker away from the app role.
- **D-17** — no kind-per-trigger mapping for claim evidence; attach
  everything whose referent exists at open.
- **D-18** — Appendix B omits `category_market_availability`, which the §9
  body requires; check 14 pins it by name.
- **D-19** — claim-driven forced demotion was impossible as printed
  (`moderation_change_is_logged` demanded a moderation_event no path
  created); the decision trigger now records the upheld decision as the
  moderation act it is. **Found by the CP-7 test, not by review.**

## The defect class of the run: grants that work until called

Six instances of the same silence — a `SECURITY DEFINER` chain or trigger
executing as a role that lacked one privilege, invisible until the exact
path ran: `INSERT...RETURNING` needs SELECT; the stock-apply trigger ran as
the *inserting* role (fixed by definer-izing via `ALTER`, which is
*narrower*); the transition guard/log as the definer's role; R-1's
reservation read; the lapse function's claim INSERT; `adulis_migrate`'s
missing `USAGE` on `financial`. Every one found by smoke, none by reading.
Phase D's review should sweep for the pattern once more from the other side
(each definer function × each table it touches).

## Pre-merge revisions (allowed: nothing here has merged)

- `0012` — retention marker revoked from `PUBLIC`/app (check 10 enforces);
  grant for the snapshot's RETURNING; stock-apply trigger definer-ized.
- `0014` — D-19 audit chain on the decision trigger.
- `0016` — `blue_tick` → `verified_badge` (check 3's own regex forbids the
  ratified prose spelling as a boolean column, definition grid included).
- Checks 5 (partition-cloned triggers excluded), 10 (D-16 routine
  permitted), 14 (D-18 exception pinned by name).

## Parked (Phase C consumes these)

Function bodies the documents elide, recorded in D-07 and untouched:
`fn_publication_readiness`, `fn_publish_product`, storefront search,
post-link resolution, `fn_effective_limit` (level-unlock inputs unruled),
`fn_evaluate_eligibility` / `fn_enter_ladder` wiring, the deletion pair,
payout change/transfer functions, `fn_send_broadcast`. The tables they need
all exist.

## NOT done (scope honesty)

- Phases B, C, D in their entirety.
- No HNSW index (D-05 — dimension unruled). Layer 3 is seq-scan until then.
- `nlu.harvest_unmatched` ETL body, all §24 job bodies: Phase B/C work.
- Review-removal mechanics for moderation (no printed column or path;
  will be needed at C6 and may become a D-entry there).
- The website's 8 event names are not seeded (they write to the waitlist
  store per C7 and import later; the 70 seeded are PRD §20 + AUTH §23).
