# WO-INFRA-008 -- Merge recommendation

**Nothing was merged.** This is a recommendation for the founder, based on the evidence in
`WO-INFRA-008-GIT-RECONCILIATION.md` and `WO-INFRA-008-INTEGRATION-TESTS.md`.

## Option A -- infrastructure-only merge (recommended)

Merge `infra/main-integration-candidate` into `main`, then bring the mobile line in through its own
reviewed pull request.

| | |
|---|---|
| What lands | 6 code files: compose, MinIO init, `ci.yml`, `gates.mjs`, `gates.test.mjs`, one API suite. Plus this batch's migration script, its test and the gate list, `810b598` (test only) and the infrastructure reports. No migration, contract, lockfile, `package.json`, `packages/*` or app code |
| Evidence | CI green on the candidate: run 43385069084 at `b3b4e79`, 30 of 30 gates, API 635 of 635, `console-e2e` 88, `gate-runner` 13 of 13 (and the final run after this batch's commits; see the integration report) |
| Advantages | `main`'s CI becomes truthful at once: it runs and gates everything, with a pullable MinIO and a seed that works. It is small enough to review in one sitting. It does not wait on the mobile review, the ten migrations or the API changes |
| Disadvantages | Two merges instead of one. When the mobile line is merged later, its four API suites need the listen-first fix, which is in the infrastructure branches (`1a8c6f7`), not on WO-022 itself |
| Regression risk | Low. The changed code is CI and test infrastructure, verified on `main`'s own code. The API change is one test line. Runtime behaviour: none |
| Dependencies | None. `810fb27` merges clean with it but is not needed |

**How the mobile line follows Option A:**
- **Merge vehicle:** merge `infra/wo-infra-007-009-finalization` (WO-022 plus all infrastructure fixes)
  rather than WO-022 itself, so the four suites keep their fix.
- **Dry run:** the merge of the candidate with that branch runs clean once this batch's commits are on
  both (integration report).
- **Before it lands:** that pull request still needs the backend review its migrations, API and
  `packages/*` changes require.

## Option B -- full development integration

Merge `infra/wo-infra-007-009-finalization` (or the first infrastructure branch) into `main` directly.

| | |
|---|---|
| What lands | Everything in Option A, plus all 253 WO-001 to WO-022 commits: the Expo app (204 files), 91 API files, 10 migrations (0053 to 0062), contract and API-client changes, `packages/locale`, the lockfile |
| Evidence | CI green on that line: the first branch at `bfa24bf` (run 43326234395: 30 of 30, API 983, mobile 520, `console-e2e` 88), and this branch (integration report) |
| Advantages | One merge; `main` gets the mobile app and its tests at once |
| Disadvantages | It bundles four changes in one: infrastructure, a mobile app, backend features with ten migrations, and shared `packages/*` changes. The repository's own rules want `packages/*` in its own pull request, and migrations reviewed by the backend owner. The Work checkout holds an uncommitted, different mobile foundation that this would collide with |
| Regression risk | Medium to high, by size: ten migrations and API changes reach the console and the database. CI covers them, but a review of that size is where defects get through |
| Dependencies | The founder's decision on the two mobile foundations (Work checkout against WO-022) and a backend review of 0053 to 0062 |

## Recommendation

**Option A.**
1. **Smaller and already proven on `main`'s code.** It makes `main`'s CI trustworthy, which every
   later merge, Option B's included, depends on.
2. **Independent of the mobile decision,** which has open questions that are not infrastructure.
3. **No duplication.** `810b598` and the `t8` line exist on both sides with identical content, so Git
   merges them without conflict when the mobile line follows.

**Before merging A:**
- review the five-line API test change and `810b598` as backend owner;
- decide whether to also merge `810fb27` (harmless, redundant);
- keep the Work checkout's `gates.mjs` edit in mind: it will need the one-line append resolution.

**Not blocked by** the MinIO move (ISSUE-INFRA-001): the compose file works either way, and the move can
follow the merge.
