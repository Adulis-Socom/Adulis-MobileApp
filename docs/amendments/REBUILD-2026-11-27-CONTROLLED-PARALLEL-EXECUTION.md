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
| G Storefront frontend | MOB-BE-09 accepted | MOB-FE-12 accepted + root activation of the Storefront path, permissions and CI. SF-FE-01 may start while the MOB-FE-12 promotion into `dev` is HELD (RB27-D06): founder decision of the L2-AUTO-02 assignment, 27 November 2026 |
| H Storefront backend | SF-FE-07 accepted | as Stage F |
| I Operator frontend | SF-BE-05 accepted | SF-FE-07 accepted + root activation of the Operator path, permissions and CI. The same held-promotion decision applies: the preceding frontend's acceptance gate must pass; its promotion may still be held |
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
- A lane needing a shared change submits a change request in its report or an explicit request document; it never
  writes the cross-lane contract register (RB27-D05), which lives in `docs/rebuild/**` and is maintained only by
  the root coordinator under an allocated root write scope. The root coordinator implements the accepted request
  in its own root PR, which both lanes acknowledge before merge. Never bundled into an app PR.
- Every repository-writing session starts in its assigned worktree through the approved launcher and verifies
  its permission denials before its first write. If an expected denial is not enforced, repository writes stop
  immediately and only authorised read-only analysis and reports outside the repository continue. A historical
  deviation, or its retrospective acceptance, never authorises a repeat. Procedure: GOV-PARALLEL-01 section 6.
- One backend writer at a time. A second backend writer needs an explicit, non-overlapping allocation, and
  shared schema changes are still serialised through the root coordinator. Migrations are single-writer: only an
  allocated `api`-workstream session under an assigned work order authors them, one at a time, sequenced by the
  root coordinator; every other workstream is denied by the launcher (GOV-PARALLEL-01 sections 6 and 7).
- Assigned backend domain implementation. The paths above are the SHARED backend resources. Within them, the
  work order that the master plan names as a domain's owner implements that domain's own modules in `apps/api`
  (for Lane 1, SC-BE-01..08 including SC-BE-05S), under the one-active-backend-writer rule, and routes the
  shared pieces (migrations, events, auth and capability definitions, the generated contract) through root PRs.
  This confirms authority for domains the master plan already assigns. It allocates NO unassigned domain: the
  Mobile, Storefront and Operator backend orders stay governed by RB27-D01, and any domain without a named owner
  order stays unassigned until a founder decision names one.
- Transitional shared changes. Reviewed Console localisation changes already open in Lane 1 PRs #203 to #206
  (`packages/locale`, additive) were made before this addendum took effect and are grandfathered: they proceed
  through ordinary review and integration and are not retroactive violations. The grandfathering is limited to
  those PRs. From the merge of this addendum, every new shared-resource change follows this section and
  GOV-PARALLEL-01 section 2 (a request, then a root PR); a historical deviation never authorises a later one.
- A domain is implemented once, by its owner order. Consumers use the generated API when it exists; a
  consumer never implies ownership.
- Surface activation (registering `apps/mobile`, later `apps/storefront`, `apps/operator`, in the workspace
  with its CI job) is done by the root coordinator ON THAT SURFACE'S LANE INTEGRATION BRANCH, never on the
  common promotion baseline before the surface milestone is accepted.
Procedure: `docs/rebuild/GOV-PARALLEL-01-EXECUTION-CONTROLS.md`.

## RB27-D05 -- Cross-lane contracts and provisional ports
One cross-lane contract register (`docs/rebuild/GOV-PARALLEL-01-CONTRACT-REGISTER.csv`), written only by the
root coordinator (RB27-D04); lanes submit proposed changes, they do not edit it: per operation the
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
  that contains another lane's unaccepted work. Every synchronisation is controlled: inspect the imported
  ancestry (`git log <lane>..<source>`, `git merge-base`) and the resulting tree (`git merge-tree
  --write-tree`); write an explicit allowed-path list first; take reviewed shared changes only, by scoped patch
  or `git cherry-pick -x` (provenance kept) where a merge would import more; regenerate `pnpm-lock.yaml` with
  `pnpm install` and never resolve a lockfile conflict by hand. A merge commit that carries another surface's
  unfinished implementation into a lane branch is not permitted.
- The FIRST promotion into `dev` remains SC-FE-12 with its atomic required-check migration
  (`docs/rebuild/DEV-PROMOTION-PROCEDURE.md`), owned by Lane 1. If a Lane 2 milestone is accepted first, its
  candidate is HELD and reported; changing the first cutover needs an explicit founder decision.
- Every later milestone candidate is built from the current `dev` plus only the accepted milestone's commits
  and approved shared prerequisites, with an explicit allowed-path and commit list, a lockfile regenerated from
  the accepted manifests, a merge-tree review against `dev`, CI on the exact head AND on GitHub's current PR
  merge candidate, founder approval, and post-merge verification of the `dev` SHA, tree, checks and
  protection. A candidate whose history contains incomplete work from either lane is rebuilt from reviewed
  surface-only changes, never merged whole.
- Every promotion retains what earlier milestones accepted: application surfaces, workspace memberships,
  dependency manifests, CI gates, fixture-release protections, architecture boundaries and security and privacy
  behaviour. The review compares the resulting tree with the previous accepted `dev` tree and records that
  nothing was dropped. Post-merge CI on `dev` verifies a merge that happened; it never substitutes for the
  mandatory pre-merge checks on the exact head and on the current merge candidate.
- Promotion into `dev` is not launch, deployment or database authorisation, and never touches `main`.

## RB27-D07 -- Protection and CI (proposal; nothing is applied by this addendum)
Each change below is a separate founder/repository-admin action, applied only after the new check has
emitted on a real run with a positive and a negative control, and never with an interval in which a branch
has fewer required checks than before:
- Order matters (CI bootstrap). The exact trigger `rebuild/l2-mobile` under `on.pull_request.branches` in
  `.github/workflows/rebuild-ci.yml` must exist on the baseline BEFORE the lane branch is created and before any
  Mobile activation pull request needs merge-candidate CI. It is its own root PR into `rebuild/2026-11-25`
  (trigger only: no job, no dependency, no workspace change). A pull request must not be the only carrier of the
  workflow that verifies it. Push runs on `rebuild/**` already give exact-head CI; the trigger adds the
  merge-candidate run for pull requests (today only `rebuild/2026-11-25` and `dev`).
- The complete twelve-step Mobile activation sequence, from the merge of this addendum to the post-merge
  verification, is GOV-PARALLEL-01 section 5. It is kept in that one place; this addendum does not restate it.
- A ruleset for the lane integration branches by EXACT name (`refs/heads/rebuild/l2-mobile`, later
  `-storefront`, `-operator`; not a `rebuild/l2-*` wildcard, which would also capture topic branches): no
  deletion, no non-fast-forward, pull request required with review-thread resolution, zero bypass actors.
  Required checks start as the two the baseline ruleset already requires, `replacement foundation
  (rebuild-20261125)` and `Seller Console (rebuild-20261125)`, so a lane branch never has fewer than its
  baseline. `Mobile (rebuild-20261125)` is ADDED to that list only after the Mobile job is implemented, has
  emitted green on a real run and has passed a negative control. Checks accepted earlier are never removed.
- Mandatory before every merge into a lane branch or into `dev`: required checks green on the exact head AND on
  the current merge candidate. Post-merge CI is never a substitute.
- The Mobile job itself is added in the L2-00B activation work, on the lane branch.
- At each surface promotion the surface check is added to `dev`'s required checks atomically, as the first
  promotion does for the replacement checks. Ruleset 28104610 and the recovery-tag ruleset are not weakened.

## RB27-D08 -- Identifiers
GOV-PARALLEL-01 and the Lane 2 batch labels (L2-00A, L2-00B, L2-01 ...) are supporting identifiers, not
master work orders. The master ID set stays at 106. Requirement-level reuse of archived code (REUSE VERIFIED,
REUSE CANDIDATE, ADAPT, BUILD, ARCHIVE, BLOCK) is recorded separately from work-order status and never
counts as acceptance.
