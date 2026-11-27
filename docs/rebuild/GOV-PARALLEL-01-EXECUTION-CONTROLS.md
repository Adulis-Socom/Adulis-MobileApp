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
  (relative `../` denials do not enforce in the current Claude Code build; Batch 02D report 29). Every
  repository-writing session starts through the approved launcher and verifies its boundaries before its first
  repository write (section 6, which also says what happens when a denial is not enforced). The file-tool
  boundary is not an OS sandbox.
- At most one heavy local job (build, browser suite, emulator, database suite) across all sessions; measure
  free RAM and disk first; GitHub Actions is the verifier of record.

## 2. Shared-resource change request (RB27-D04)
1. The lane SUBMITS a change request, in its report or as an explicit change-request document under its own
   `Deliverables/Lane-N/...` folder, naming the requirement, design section, owner order and the exact change
   requested. A lane never writes `GOV-PARALLEL-01-CONTRACT-REGISTER.csv`: the authoritative register is
   `docs/rebuild/**`, a root-written path (RB27-D04), maintained only by the designated root coordinator under an
   allocated root write scope, one change at a time. The coordinator turns an accepted request into a register
   row inside the root PR of item 2.
2. The root coordinator checks for a concurrent writer (open root PRs touching the same paths), takes the
   change, and opens ONE root PR into `rebuild/2026-11-25` (or, for surface activation, into that surface's
   lane integration branch) containing only that change.
3. Both lanes acknowledge in the PR (a comment from each lane's session or the founder on its behalf). An
   acknowledgement by an agent is recorded as an agent acknowledgement, not as an independent human review.
4. Lockfile: regenerate with `pnpm install` from the reviewed manifests; never hand-merge `pnpm-lock.yaml`.
5. After merge, each lane synchronises the named merge commit (RB27-D06), never a blanket merge.
6. Synchronisation scope (L2-R03). Before a lane branch takes a shared change: (a) list the imported ancestry
   (`git log --oneline <lane>..<source>`) and confirm it holds only reviewed root work; (b) write the allowed-path
   list; (c) preview the resulting tree (`git merge-tree --write-tree <lane> <source>`) and check `git diff --stat`
   touches only allowed paths; (d) if the source holds anything else, use a scoped patch or `git cherry-pick -x`
   of the named commits instead of a merge; (e) regenerate `pnpm-lock.yaml` with `pnpm install`, never by hand.
   A merge commit that imports another surface's unfinished implementation is not permitted.

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

Preservation (L2-R04), checked at step 5 and again after step 8: the resulting tree still contains every surface,
workspace membership (`pnpm-workspace.yaml`), dependency manifest, CI job and required-check name, fixture-release
protection and dependency-boundary rule that the previous accepted `dev` tree had, plus the new surface; the
security and privacy tests of earlier milestones still run. Compare against the previous accepted tree and record
it. Step 6 is pre-merge on the exact head AND the current merge candidate; post-merge CI never replaces it.

## 5. Proposed protection (applied only by the founder or a repository admin)
Ruleset `protect-lane-integration` (proposal):
```
target: branch; enforcement: active; bypass_actors: []
conditions.ref_name.include: ["refs/heads/rebuild/l2-mobile"]   # exact names; add -storefront/-operator at activation
rules: deletion; non_fast_forward;
  pull_request {required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
                required_review_thread_resolution: true};
  required_status_checks {strict: true, checks: ["replacement foundation (rebuild-20261125)",
                          "Seller Console (rebuild-20261125)"]}   # the baseline's two; never fewer (L2-R02)
# PROT-2, a separate later update: add "Mobile (rebuild-20261125)" only after the job exists, has emitted
# green on a real run and has passed a negative control; keep the other two.
```
Mobile activation sequence (L2-R01, L2-R04). Strictly in this order; a step starts only after the previous one
is recorded done with its evidence (SHA, run id or read-back). Merges, branch creation, ruleset changes and
approvals (the merges in 1, 2 and 11; 3, 4, 8, 10) are founder or repository-admin actions; refreshing,
preparing and verifying are the root coordinator's. The activation PR (step 5) is opened only after step 4.
1. Accept and merge governance PR #201 (both lanes acknowledged per section 2 item 3, or the founder
   acknowledges for a lane and records it on the PR).
2. Refresh PR #202 (the trigger-only root PR) by merging the current `rebuild/2026-11-25` into its branch (no
   force), re-verify that its diff against the base is still exactly the added `on.pull_request.branches`
   entry `rebuild/l2-mobile` (plus its comment lines) and nothing else, obtain required checks on the exact head
   AND the current merge candidate, then merge it.
3. Create the dedicated Mobile integration branch `rebuild/l2-mobile` from a `rebuild/2026-11-25` commit that
   contains step 2; record that SHA.
4. Apply PROT-1 (above): the exact-name ruleset requiring `replacement foundation (rebuild-20261125)` and
   `Seller Console (rebuild-20261125)`, zero bypass actors. Read it back and store the JSON.
5. Open the Mobile activation PR (L2-00B) from `rebuild/l2-mobile-activation-<date>` into `rebuild/l2-mobile`.
   It adds the `Mobile (rebuild-20261125)` job, so it is not the only carrier of the foundation or Console
   workflow that verifies it: the trigger of step 2 is already merged.
6. Verify, on the exact head AND the current merge candidate, that foundation, Seller Console and Mobile are
   green. If the base advances during verification, record the new base and obtain fresh candidate evidence.
7. Demonstrate the fixture-release controls in CI: the positive control (a planted fixture marker is found and
   the scan fails) and the negative control (the real release output is clean and the scan passes), against
   the actual bundler output as GOV-06 specifies.
8. Add `Mobile (rebuild-20261125)` to the required status checks of the lane ruleset (PROT-2) in one update
   whose resulting list is a superset of the existing two. Never remove an existing context, and never leave an
   interval with fewer required checks than before.
9. Read the protection back and store the JSON; confirm the three contexts, strict mode and zero bypass.
10. Founder approval of the activation PR, by name.
11. Founder merges the activation PR (merge commit; no squash, no force).
12. Verify post-merge state: the `rebuild/l2-mobile` SHA and tree, the push run, the protection read-back, that
    `main`, `dev` and `rebuild/2026-11-25` are unchanged, and the preservation checks of section 4 for the lane
    tree. Post-merge CI verifies a merge that happened; it never replaces step 6.
The Mobile check is trusted because of step 7, not because it is green; it becomes required only at step 8.
Every merge into a lane branch needs the required checks on the exact head AND on the current merge candidate.
Post-merge CI never substitutes for either.

## 6. Session start and permission verification (NIGHT-R01, NIGHT-R03)
1. Every repository-writing session starts in its assigned worktree through the approved launcher
   (`Start-AdulisClaude.ps1 -Workstream <root|api|console|mobile|storefront> -Path <worktree>`). A session started
   any other way (for example a VS Code panel session) has no absolute-path denial layer and is not a
   repository-writing session.
2. Before its first repository write the session verifies, and records in its checkpoint: the actual worktree,
   repository and branch; the loaded instruction files; and that each applicable denial is enforced. The probe
   must not modify a sensitive file: an Edit call whose `old_string` cannot match, so a rule that fires is
   reported as denied and a rule that does not fire is reported as "string not found". The probes cover the
   generated files (`contracts/openapi.json`, `packages/api-client/src/schema.d.ts`), the replacement migrations
   (`apps/api/db/migrations/**`) and, in a worktree that contains it, the archived historical path
   (`db/migrations/**`). Where a protected path is absent from the worktree it is recorded as "not probed:
   absent", never as passed. The generated settings file is also read back and its rule list recorded.
3. If any expected denial is not enforced, the session stops repository writes immediately. It may continue
   authorised read-only analysis and write permitted reports outside the repository (its `Deliverables/` folder).
   It does not weaken a permission to make the probe pass, and it does not push, commit, create branches or
   touch the worktree until a launcher-started session has verified the denials.
4. A historical deviation, and any retrospective founder acceptance of one, is a record about that session. It is
   not a precedent and does not authorise a repeat: the rule of items 1 to 3 applies to every later session.
5. Launcher coverage (corrected by L2-UNBLOCK-01A, 27 November 2026). The launcher denies Edit and Write on
   `contracts/openapi.json`, `packages/api-client/src/schema.d.ts` and the archived `db/migrations/**` for every
   workstream, and, for every workstream EXCEPT `api`, on the replacement `apps/api/db/migrations/**` and
   `apps/api/db/bootstrap.sql`. The exception exists because the backend owner is the single migration writer; an
   `api` session writes migrations and bootstrap only under an assigned work order and a root-coordinated
   allocation (item 7), which the launcher cannot enforce and process must. Each session reads back its generated
   settings file and records the rules, and probes every protected path present in its worktree. A missing denial
   on a path listed here is a failed probe under item 3, never "expected and recorded".
6. Lane 1 acknowledgement. The acknowledgement of RB27-D04 and RB27-D06 is recorded only from the PR #201 thread
   (agent acknowledgement, not independent human review): issue comment 7209727321, given at head `9754bdd`.
   Its three open points are settled in the text, not by a new allocation: A (backend write scope) by RB27-D04
   "Assigned backend domain implementation"; B (existing shared locale in Lane 1 PRs #203-#206) by RB27-D04
   "Transitional shared changes"; C (strict up-to-date policy) by item 8 below. A material change after an
   acknowledgement needs a fresh acknowledgement through the same thread; none is inferred or written for a lane.
7. Backend write allocation. At most one backend writer is active in `apps/api` at a time. A second concurrent
   backend writer needs an explicit, non-overlapping allocation of paths and domains approved by the founder and
   recorded by the root coordinator. Migrations are numbered and sequenced by the root coordinator: a migration is
   authored only by the one allocated `api`-workstream session, one at a time, each in its own reviewed PR, and a
   second session never adds a migration concurrently (a duplicate number collides cleanly into two migrations).
8. Stale open pull requests. Merging a shared PR moves the integration branch, so under strict up-to-date
   protection every open pull request on that branch needs a reviewed base synchronisation and fresh required
   checks before it can merge. This is expected, not a defect, and is each owner's step; it never justifies
   bypassing a check, and the synchronisation follows section 2 item 6 (no blanket merge of unaccepted work).

## 7. Lockfile generation (NIGHT-R05)
Applies when reviewed manifests change a surface's dependency set (the L2-00B activation first). The manifests are
reviewed and committed first; `pnpm-lock.yaml` is then generated from them, never hand-edited or hand-merged,
and no dependency is installed in a governance or planning session. Versions are the repository's own:
`packageManager` in the root `package.json` and `.nvmrc`.
- Route A (preferred, only when resources permit): locally, `pnpm install --lockfile-only --ignore-scripts`.
  It writes only `pnpm-lock.yaml` (no `node_modules`, no lifecycle scripts). Precondition, recorded in the
  checkpoint: storage audit run, no other heavy local job, free RAM of at least 2 GB (a conservative working
  figure, not measured for the Mobile dependency tree) and enough free disk on the repository drive. If any is
  not met, use Route B.
- Route B (when Route A is not permitted): a bounded, read-only CI generation job.
  1. The root coordinator pushes a throwaway branch `tmp/lockgen-<work-order>-<date>` (outside `rebuild/**`,
     never merged, deleted afterwards) cut from the reviewed topic branch. It carries one extra file, a workflow
     `lockgen.yml` triggered by `push` on `tmp/lockgen-*` (a push-triggered workflow runs from the pushed
     branch's own file, so nothing has to exist on the default branch).
  2. The job has `permissions: contents: read` only, checks out with `persist-credentials: false`, uses actions
     pinned by commit SHA as `rebuild-ci.yml` does, and has no secret and no write token. It runs
     `pnpm install --lockfile-only --ignore-scripts`, prints `sha256sum pnpm-lock.yaml` and a package-level diff
     (packages added, removed and changed against the base lockfile), and uploads the lockfile, the hash and the
     diff as an artifact with short retention. It never commits, pushes or opens a pull request.
  3. The coordinator downloads the artifact and inspects it before use: the importers match the reviewed
     manifests; no existing resolution changes beyond what the declared change requires; no `file:`, `git+` or
     tarball source and no registry other than the default appears; the hash equals the recorded one.
  4. The coordinator commits the inspected lockfile to the activation topic branch through the normal root
     process. The throwaway branch and its workflow file are never part of any pull request.
- Verification in both routes: a fresh frozen install, which is the existing `pnpm install --frozen-lockfile` step
  of the required CI jobs on the exact head AND the current merge candidate. A frozen-install failure means
  regenerate from the manifests; it is never fixed by hand and CI never runs without `--frozen-lockfile`.
- CI never writes to a protected branch in either route.
