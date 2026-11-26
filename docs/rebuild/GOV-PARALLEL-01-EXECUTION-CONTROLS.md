# GOV-PARALLEL-01 -- Execution controls for two controlled lanes

Authority: `docs/amendments/REBUILD-2026-11-27-CONTROLLED-PARALLEL-EXECUTION.md` (RB27-D01..D08). This file is
the procedure; the addendum governs where they differ. Effective with the addendum (on its merge).

## 1. Sessions and worktrees
| Role | Worktree (verify the actual path at start) | Branches it writes | Starts in |
|---|---|---|---|
| Root coordinator | `Worktrees/Root-Coordination` | `rebuild/shared-*` root topic branches; lane integration branches only for surface activation | repository root, via the root launcher |
| Lane 1 | its existing Console worktree | `rebuild/sc-*` topics into `rebuild/2026-11-25` | `apps/console` (later `apps/api` for SC-BE) |
| Lane 2 | `Worktrees/Lane-2-Mobile` (created after L2-00A acceptance and protection setup) | `rebuild/l2-mobile-*` topics into `rebuild/l2-mobile` | `apps/mobile` |
- A session never edits another session's worktree. File-tool denials use the launcher's absolute-path form
  (relative `../` denials do not enforce in the current Claude Code build; Batch 02D report 29), verified at
  start with harmless create/read/delete probes. The file-tool boundary is not an OS sandbox.
- At most one heavy local job (build, browser suite, emulator, database suite) across all sessions; measure
  free RAM and disk first; GitHub Actions is the verifier of record.

## 2. Shared-resource change request (RB27-D04)
1. The lane adds or updates a row in `GOV-PARALLEL-01-CONTRACT-REGISTER.csv` on its own branch (or in its
   report) naming the requirement, design section, owner order and the exact change requested.
2. The root coordinator checks for a concurrent writer (open root PRs touching the same paths), takes the
   change, and opens ONE root PR into `rebuild/2026-11-25` (or, for surface activation, into that surface's
   lane integration branch) containing only that change.
3. Both lanes acknowledge in the PR (a comment from each lane's session or the founder on its behalf). An
   acknowledgement by an agent is recorded as an agent acknowledgement, not as an independent human review.
4. Lockfile: regenerate with `pnpm install` from the reviewed manifests; never hand-merge `pnpm-lock.yaml`.
5. After merge, each lane synchronises the named merge commit (RB27-D06), never a blanket merge.

## 3. Lane status publication (at every acceptance gate or shared change)
Each lane reports: integration base and head SHA, open PRs with head SHAs, shared changes requested, contract
gaps, blockers, next step. Reports live under `Deliverables/Lane-1/...` and `Deliverables/Lane-2/<batch>`;
neither lane overwrites the other's.

## 4. Milestone candidate procedure (RB27-D06; first promotion stays DEV-PROMOTION-PROCEDURE.md)
1. Freeze: fetch; record `dev`, the lane integration branch and the milestone head SHAs; store the protection
   JSON of `dev` and of every ruleset.
2. Candidate branch `rebuild/promote-<milestone>-<date>` from current `dev`.
3. Bring in only the accepted milestone's changes: a reviewed merge of the lane branch if its history contains
   nothing unaccepted from either lane; otherwise scoped cherry-picks with `-x` (provenance kept) of the listed
   commits. Write the allowed-path list and the commit list into the PR body.
4. Regenerate `pnpm-lock.yaml` from the resulting manifests; the workspace lists only surfaces whose milestone
   is accepted.
5. Review: `git merge-tree --write-tree origin/dev <candidate>` equals the candidate tree; `git diff --stat
   origin/dev <candidate>` touches only allowed paths; no retired or legacy runtime file restored
   (`pnpm verify:retired`); docs ASCII gate green.
6. Open a normal PR into `dev`. Required checks pass on the exact head AND on the PR merge candidate, plus the
   surface job and its release-fixture positive and negative controls.
7. If the surface check becomes required on `dev`, add it in one atomic protection update after step 6 is
   green, keeping every existing rule (no interval with fewer required checks; `enforce_admins` stays on).
8. Founder approval, merge commit (no squash, no force). Record the `dev` SHA; verify tree, the push run on
   `dev`, the protection read-back, `main` and recovery tags unchanged.
9. Feed back: each active lane branch synchronises from the new `dev` through a reviewed PR.

## 5. Proposed protection (applied only by the founder or a repository admin)
Ruleset `protect-lane-integration` (proposal):
```
target: branch; enforcement: active; bypass_actors: []
conditions.ref_name.include: ["refs/heads/rebuild/l2-mobile"]   # exact names; add -storefront/-operator at activation
rules: deletion; non_fast_forward;
  pull_request {required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
                required_review_thread_resolution: true};
  required_status_checks {strict: true, checks: ["replacement foundation (rebuild-20261125)",
                          "Mobile (rebuild-20261125)"]}   # second context only after it has emitted green + a negative control
```
Workflow change (root PR in L2-00B): add the `Mobile (rebuild-20261125)` job and add `rebuild/l2-mobile` to
`on.pull_request.branches` in `.github/workflows/rebuild-ci.yml`.
