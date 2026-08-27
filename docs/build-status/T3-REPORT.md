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

Nothing else met the STOP bar.

## Where the run is

| Phase | State |
|---|---|
| **A — finish the schema (migrations 08–15)** | **COMPLETE. Gate met.** |
| B — request pipeline (13 components) | not started |
| C — 123 endpoints (C1–C8) | not started |
| D — security review, load tests, proofs, hygiene | not started |

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
