# PHASE-001 -- Founder handoff

13 November 2026. Work order PHASE-001, "Development Preservation, Git Reconciliation, and Baseline
Establishment" (P0).

**Overall result: COMPLETE.**
- **Done and verified:** preservation, the branch audit, the closure verification, the foundation
  comparison, the baseline recommendation and the environment inventory.
- **Not executed, by rule:** every merge, the MinIO move and the database repair. They wait for your
  decisions (section 4).

## 1. The answer first

| Question | Answer |
|---|---|
| Is the uncommitted MOB-WO-0 work safe? | **Yes.** It is on GitHub in `backup/mob-wo-0-preservation-2026-11-13` (commits `4fd56d3`, staged state, and `0f9b083`, full working tree). 107 of 107 files are byte-identical, 0 are missing and no secret was committed. Your Work checkout was not changed |
| Was anything else at risk there? | **One stash** (a 2-line `apps/mobile/CLAUDE.md` edit from 7 September). It is now recorded in the manifest and bundled on G:. The two local-only commits found there already exist upstream in equivalent form |
| What is the official mobile foundation? | **`infra/wo-infra-010-014-closure` at `341d579`** (Expo SDK 58, WO-001 to WO-022, CI green: 32 gates, 520 mobile tests). MOB-WO-0 is a preserved reference, not a rival baseline |
| Should the two foundations be merged? | **No.** A simulated merge conflicts in 7 files and would downgrade the SDK. Six MOB-WO-0 items are worth re-implementing later, one work order each |
| Is `main` healthy? | **Not verified.** Its latest CI run (7 September) failed. It becomes verifiable when PR #105 is merged |
| Is the machine ready for WO-019? | **No.** 0.3 to 0.6 GB of free memory (a game holds 2.6 GB); the emulator needs 2 to 4 GB. The tooling is in place |
| Is the integration path still as documented? | **Mostly.** The closure documents promise one later conflict; there are now four. All four are mechanical: take the closure version |

## 2. What was done

1. **Preservation (A).**
   - Two commits built with temporary index files, so your checkout, index and branch were never
     touched.
   - Pushed without force and verified from an independent clone.
   - Excluded by `.gitignore`: `.env`, the fake-SMS logs, console test output and `node_modules`.
2. **Branch audit (B1, B2).**
   - Eight branches audited: heads, merge bases, ahead/behind counts and latest CI.
   - PR #105 is still a draft, unmerged and MERGEABLE.
   - The closure line's 44 reports, scripts, guards and CI hardening are all present.
3. **Foundation comparison (B3, B4).** Thirteen areas compared, from Expo configuration to the
   lockfile, with a decision and the reasons for it.
4. **Baseline (C).**
   - The canonical commit, a branch-naming convention and a worktree layout.
   - Two integration routes and the infrastructure dependencies.
5. **Environment (D).**
   - RAM, disks, Docker, the database identity, backups, environment-file names and protected
     resources.
   - Android readiness.

## 3. Documents

| Document | What it holds |
|---|---|
| `PHASE-001-PRESERVATION-MANIFEST.md` | every preserved file group, the method, the commits and the verification; the stash patch |
| `PHASE-001-BRANCH-AUDIT.md` | branch table, PRs, closure verification, merge simulation, CI failures |
| `PHASE-001-MOBILE-FOUNDATION-COMPARISON.md` | the comparison and the foundation decision; items worth adopting |
| `PHASE-001-DEVELOPMENT-BASELINE.md` | baseline SHA, naming, worktrees, integration routes, dependencies |
| `PHASE-001-ENVIRONMENT-INVENTORY.md` | machine, Docker, database, backups, protected resources, WO-019 readiness |
| `PHASE-001-ISSUES-AND-BLOCKERS.md` | 4 blockers, 20 issues, what was deliberately not done |

**Where they are:**
- **In the repository:** `docs/development/phase-001/` on `backup/mob-wo-0-preservation-2026-11-13`
  (commit 3), not on the baseline.
- **Outside the repository:** `G:\AdulisDevelopment\PHASE-001\`, with the evidence in `evidence\`.

## 4. Decisions for you

| ID | Decision | Recommendation |
|---|---|---|
| DEC-01 | **Integration route.** Route 1: merge PR #105, then reconcile the closure line with `main` (4 mechanical conflicts) and merge it by pull request. Route 2: close #105 and merge the closure line in one pull request (clean, but one 272-commit review) | Route 1 |
| DEC-02 | **Confirm `infra/wo-infra-010-014-closure` (`341d579`) as the official foundation**, with MOB-WO-0 as reference only | confirm |
| DEC-03 | **Native design tokens.** A `@adulis/tokens/native` sub-entry (MOB-WO-0), or keep the app-side conversion (`src/theme/theme.ts`) | decide when the design-system work order is written |
| DEC-04 | **The 16 `docs/adu` specifications** from MOB-WO-0. Install them as historical reference, after reconciliation with the November 8 pack, or leave them only in the backup | leave in the backup until a reconciliation work order |
| DEC-05 | **The Work checkout** (`C:\Users\naods\Documents\Work\adulis-platform`). Keep it as it is, or later restore it to a clean state now that its content is preserved (that would discard the working copy and the stash there) | keep it untouched for now |
| DEC-06 | **Defect numbers D-365 to D-391** used by MOB-WO-0. Reserve them, or renumber when any MOB-WO-0 item is adopted | reserve them |
| DEC-07 | **Carried from the closure batch:** approve the MinIO move (WO-INFRA-011) and the development-database repair (WO-INFRA-013) | approve when convenient; both are prepared and rehearsed |
| DEC-08 | **Prepare the machine for WO-019:** close the game, stop (not remove) `nac-trial`, optionally a `.wslconfig` limit and `docker builder prune` | before WO-019 |
| DEC-09 | **Which MOB-WO-0 items to adopt, in which order:** the fourteen mobile gates, the secret scanner, the Ethiopic and Inter fonts, the native tokens, the store-compliance notes and `eas.json` | gates and secret scanner first |
| DEC-10 | **Carried:** contract decisions W21-02, W20-07 and the four Chat decisions | as before |

## 5. Next recommended work order (Phase 2; not executed)

**PHASE-002 -- Mainline integration and parallel-development setup.** It requires DEC-01 and DEC-02.

1. Merge PR #105 (Route 1). Confirm a green push run on `main`.
2. From the closure line, create `integration/closure-into-main`. Merge `main` into it, resolving the
   four known conflicts by taking the closure version. Run full CI.
3. Open the pull request into `main`, review the API-adjacent changes, and merge on approval.
4. Create the first worktrees by the convention in `PHASE-001-DEVELOPMENT-BASELINE.md`, one per
   active work order.
5. Record `main` as the new baseline.

**Then WO-019** (native verification), once DEC-08 has freed the memory, and after it **WO-023**.

## 6. Safety confirmation

- **Git:** no merge, no pull request, no force-push, no branch deleted or reset, no change to
  `main`.
- **Your Work checkout:** no change to its files, index, branch or stash.
- **Data and services:** no container or volume touched, no database written, no `.env` opened, no
  dependency installed.
- **Mobile work:** WO-019 and WO-023 not started.
- **The one branch created:** `backup/mob-wo-0-preservation-2026-11-13`, with three commits, all
  additive.
- **Files outside the repository:** the reports, the evidence and one stash bundle on G:.
