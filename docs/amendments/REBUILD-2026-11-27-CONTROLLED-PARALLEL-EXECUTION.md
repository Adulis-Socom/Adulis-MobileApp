# Rebuild authority addendum -- controlled parallel execution (27 November 2026)

Supporting gate: GOV-PARALLEL-01 (not a master work-order ID). Identifiers: RB27-D01..RB27-D08.

Status: founder direction recorded from the Lane 2 handoff of 26-27 November 2026 ("two controlled lanes,
each working on one assigned surface at a time"). Working authority, not a signed board, legal or launch
approval. **It takes effect only when the founder approves and merges the pull request that adds it, with
Lane 1's acknowledgement of RB27-D04 and RB27-D06 recorded in that pull request.** Until then D24-16,
RB25-D06, RB26-D01 and the master-plan stage entry gates govern exactly as written. It authorises no code,
database, deployment, branch-protection change or merge by itself.

Scope: EXECUTION SCHEDULING only. It changes when a stage may start and where intermediate work integrates.
It does not change any product rule, any work order's scope, acceptance or evidence, any domain or contract
ownership, the architecture, or any security, privacy, fixture or release rule.

Supersedes, and only to the extent stated below:
- D24-16 (Nov 24 register), the words "one surface at a time" read as one surface in the whole programme. It
  now means one surface at a time PER LANE. "Frontend then backend", "Company Website excluded" and "a shared
  backend is never split" are unchanged.
- RB25-D06 (`REBUILD-2026-11-25-CLEAN-LINEAGE.md`), the sentence "then one surface at a time, frontend then
  backend: Seller Console, Mobile, Storefront, Operator", replaced by RB27-D01/D02. Its other sentences stand.
- The master plan (`Adulis_Clean_Rebuild_Master_Workorders_2026-11-25`) stage ENTRY GATES of Stages E, F, G,
  H, I, J and K, replaced by the table in RB27-D02. Each stage's "work orders run sequentially; previous
  applicable work order accepted unless independent and explicitly recorded" is unchanged.
- RB26-D01 rule 1, for Lane 2 only (RB27-D06). RB26-D01 rules 2-5 and its milestone table are unchanged.

## RB27-D01 -- Two controlled lanes
| Lane | Order of surfaces (each surface: frontend, then its acceptance gate) | Owner of the lane's surface paths |
|---|---|---|
| Lane 1 | Seller Console frontend -> SC-FE-12 -> Seller Console backend (SC-BE-01..08 incl. SC-BE-05S) -> SC-BE-08 | Lane 1 (existing worktree and branches) |
| Lane 2 | Mobile frontend (MOB-FE-01..11, 02S) -> MOB-FE-12 -> Storefront frontend (SF-FE-01..06) -> SF-FE-07 -> Operator frontend (OP-FE-01..08) -> OP-FE-09 | Lane 2 (separate worktree and branches) |

- Each lane works on ONE surface at a time. Lane 2 never starts the three frontends at once.
- Mobile, Storefront and Operator BACKEND orders (MOB-BE-*, SF-BE-*, OP-BE-*) are scheduled only after ALL
  THREE Lane 2 frontend milestones (MOB-FE-12, SF-FE-07, OP-FE-09) are accepted AND each order's real owner
  dependencies (the dependency matrix) are satisfied AND the root coordinator has allocated a backend write
  slot (RB27-D04). Frontend acceptance never removes a real backend dependency.
- Frontend completion means working typed-fixture UX, states, navigation, accessibility and release-fixture
  exclusion (master plan "Definition of done"), not backend proof.
- No new per-surface backend, BFF, microservice, datastore or queue. One API, one worker, one PostgreSQL.

## RB27-D02 -- Replaced stage entry gates
| Stage | Master entry gate (superseded) | Entry gate under this addendum |
|---|---|---|
| E Mobile frontend | SC-BE-08 accepted | RBL-05 accepted (holds) + this addendum effective + L2-00B Mobile workspace activation accepted on the Lane 2 integration branch with its protection and CI in place (RB27-D07) |
| F Mobile backend | MOB-FE-12 accepted | MOB-FE-12, SF-FE-07 and OP-FE-09 accepted + per-order owner dependencies + allocated write slot |
| G Storefront frontend | MOB-BE-09 accepted | MOB-FE-12 accepted + root activation of the Storefront path, permissions and CI. Whether SF-FE-01 may start while the MOB-FE-12 promotion is HELD (RB27-D06) is a founder decision recorded in the L2-00A report |
| H Storefront backend | SF-FE-07 accepted | as Stage F |
| I Operator frontend | SF-BE-05 accepted | SF-FE-07 accepted + root activation of the Operator path, permissions and CI (same held-promotion question as Stage G) |
| J Operator backend | OP-FE-09 accepted | as Stage F |
| K Release acceptance | OP-BE-07 accepted | ALL EIGHT surface milestones accepted: SC-FE-12, SC-BE-08, MOB-FE-12, MOB-BE-09, SF-FE-07, SF-BE-05, OP-FE-09, OP-BE-07 (the master chain implied all eight; this states it) |
Stage C (Console frontend) and Stage D (Console backend, entry SC-FE-12) are unchanged. Stage L (P2) is
unchanged: REL-08 accepted and a separate founder approval for each deferred release.

## RB27-D03 -- What does not change
All 106 master IDs (99 build/release + 7 gated) with their scope, acceptance, evidence and source routing;
RB25-D01..D14, RB26-D01 rules 2-5, B02-D01..D05, B02B-D01..D05, D24-01..D18 except as stated above; RB25-D09
(chatbot: SC-FE-08 / SC-BE-06), RB25-D10 (Mobile messaging: MOB-FE-09 / MOB-BE-08), RB25-D11 (debt-free
initial MVP); GOV-06 fixture and release boundary; RBL-04 ownership and contract register; GOV-07 report
intake rule (real intake only after OP-BE-03, verified in OP-BE-07); no payment, PSP, surcharge, refund,
paid Order, stock hold, Reservation, live handoff/delivery, payout, purchase-derived Review Grant or payment
Claim; Checkout A preview only and C internal simulation only; English-first with Amharic gated; one ordinary
Account with three Mobile modes; separate Operator principal (CEO and COO/CTO only, Staff inactive, CMO
none); main untouched; no deployment; no persistent database mutation; no force-push; no protection bypass.

## RB27-D04 -- Root coordinator and single-writer shared resources
The founder designates the root coordinator session (a session started at the repository root of a
dedicated root worktree, never inside a lane's app worktree). Only the root coordinator writes, one change
at a time, to:
`apps/api/**` schema, migrations, events, auth, capabilities and generated contract; `contracts/openapi.json`
and `packages/api-client` generated files (by the official generators only); `packages/tokens`,
`packages/locale`, `packages/config`; `pnpm-workspace.yaml`, root `package.json`, `pnpm-lock.yaml`
(regenerated from reviewed manifests, never hand-merged); `.github/**`; `.dependency-cruiser.cjs`; root
`CLAUDE.md`, `.claude/**`, `docs/amendments/**` and `docs/rebuild/**` governance records.
- A lane needing a shared change files a request (contract register row, RB27-D05); the root coordinator
  implements it in its own root PR, which both lanes acknowledge before merge. Never bundled into an app PR.
- One backend writer at a time. A second backend writer needs an explicit, non-overlapping allocation, and
  shared schema changes are still serialised through the root coordinator.
- A domain is implemented once, by its owner order. Consumers use the generated API when it exists; a
  consumer never implies ownership.
- Surface activation (registering `apps/mobile`, later `apps/storefront`, `apps/operator`, in the workspace
  with its CI job) is done by the root coordinator ON THAT SURFACE'S LANE INTEGRATION BRANCH, never on the
  common promotion baseline before the surface milestone is accepted.
Procedure: `docs/rebuild/GOV-PARALLEL-01-EXECUTION-CONTROLS.md`.

## RB27-D05 -- Cross-lane contracts and provisional ports
One cross-lane contract register (`docs/rebuild/GOV-PARALLEL-01-CONTRACT-REGISTER.csv`): per operation the
requirement and design section, owner order, consumers, status (PROVISIONAL / APPROVED / GENERATED /
INTEGRATED), revision, request/response fields, audience, capabilities, data classification, error and retry
semantics, freshness, tests and the generated replacement SHA. Until the owner's generated operation exists,
a consumer uses an app-local, typed, versioned port marked with its GAP id under GOV-06 (development build +
explicit opt-in, `fx_` ids, persistent demonstration banner, no network in fixture mode, no live fallback,
live transport refuses fixture ids, release-negative scan with its positive control). A fixture seam is never
the final API, never copied between surfaces, and never imported across apps.

## RB27-D06 -- Lane integration branches and milestone promotion
- Lane 1 keeps integrating its intermediate PRs into `rebuild/2026-11-25` (RB26-D01 rule 1, unchanged).
- Lane 2 integrates its intermediate PRs into its own lane integration branch: `rebuild/l2-mobile`, later
  `rebuild/l2-storefront`, then `rebuild/l2-operator`, each cut from the then-current accepted baseline, with
  topic branches `rebuild/l2-mobile-<work-order>-<date>`. This keeps unfinished Lane 2 work out of the tree
  that the SC-FE-12 promotion merges into `dev`.
- Shared prerequisites reach a lane branch only as reviewed root PRs (RB27-D04). A lane branch synchronises
  from `dev` (accepted) or from a named, reviewed root-PR commit range; never by a blanket merge of a branch
  that contains another lane's unaccepted work.
- The FIRST promotion into `dev` remains SC-FE-12 with its atomic required-check migration
  (`docs/rebuild/DEV-PROMOTION-PROCEDURE.md`), owned by Lane 1. If a Lane 2 milestone is accepted first, its
  candidate is HELD and reported; changing the first cutover needs an explicit founder decision.
- Every later milestone candidate is built from the current `dev` plus only the accepted milestone's commits
  and approved shared prerequisites, with an explicit allowed-path and commit list, a lockfile regenerated from
  the accepted manifests, a merge-tree review against `dev`, CI on the exact head AND on GitHub's current PR
  merge candidate, founder approval, and post-merge verification of the `dev` SHA, tree, checks and
  protection. A candidate whose history contains incomplete work from either lane is rebuilt from reviewed
  surface-only changes, never merged whole.
- Promotion into `dev` is not launch, deployment or database authorisation, and never touches `main`.

## RB27-D07 -- Protection and CI (proposal; nothing is applied by this addendum)
Each change below is a separate founder/repository-admin action, applied only after the new check has
emitted on a real run with a positive and a negative control, and never with an interval in which a branch
has fewer required checks than before:
- A ruleset for the lane integration branches by EXACT name (`refs/heads/rebuild/l2-mobile`, later
  `-storefront`, `-operator`; not a `rebuild/l2-*` wildcard, which would also capture topic branches): no
  deletion, no non-fast-forward, pull request required with review-thread resolution, strict required checks
  `replacement foundation (rebuild-20261125)` plus the surface job (proposed `Mobile (rebuild-20261125)`),
  zero bypass actors.
- `.github/workflows/rebuild-ci.yml` gains the surface job and lists the lane integration branch under
  `pull_request.branches`, so topic PRs get a merge-candidate run (today only `rebuild/2026-11-25` and `dev`).
- At each surface promotion the surface check is added to `dev`'s required checks atomically, as the first
  promotion does for the replacement checks. Ruleset 28104610 and the recovery-tag ruleset are not weakened.

## RB27-D08 -- Identifiers
GOV-PARALLEL-01 and the Lane 2 batch labels (L2-00A, L2-00B, L2-01 ...) are supporting identifiers, not
master work orders. The master ID set stays at 106. Requirement-level reuse of archived code (REUSE VERIFIED,
REUSE CANDIDATE, ADAPT, BUILD, ARCHIVE, BLOCK) is recorded separately from work-order status and never
counts as acceptance.
