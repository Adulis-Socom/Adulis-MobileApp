# WO-INFRA-010 -- Post-merge verification

Run this after PR #105 is merged. Until step 2 shows a green run whose commit is the merge commit, `main`
is not verified, whatever the branch runs said.

## 1. The actual updated `main`

```
git fetch origin
git log --oneline -3 origin/main          # the top commit is the merge of #105
git rev-parse origin/main                 # note it: <MERGE>
```

## 2. The full CI run on `main`, for that commit

```
gh run list --branch main --limit 3 --json databaseId,headSha,event,status,conclusion
```

**The run to read:** the one whose `headSha` equals `<MERGE>`, event `push`, conclusion `success`. Not
the PR's run: that built GitHub's preview merge commit, not `main`.

## 3. The workflow commit
In that run's log, "Run actions/checkout@v7" fetches `<MERGE>`. The step list must show `checkout@v7`,
`pnpm/action-setup@v6`, `setup-node@v7`, and the step "Mark the job's database disposable".

## 4. Object storage
The step "Start object storage and create the two buckets" succeeds. Its output shows the Chainguard
image digest and the init lines:
- the media policy "set from `/tmp/adulis-media-read.json`";
- evidence "set to `private`";
- the `evidence/raw/` rule added.

## 5. Test selection
The gates log begins with `scope: UNSCOPED - ...`:
- on a push to `main`, the diff against `origin/main` is empty, so the fail-safe reads "selects no
  package" (or "root inputs" changed) and runs everything;
- `PASS all N gates`, with N the gate count of that commit (32 once WO-INFRA-012's gate is in);
- the API test line shows every suite, with 0 failed;
- `[db-target] 127.0.0.1:5432/adulis is marked disposable` appears before the suites;
- nowhere: "No projects matched".

## 6. The build
The gate `build` passes; `boot-smoke` passes under the production CSP.

## 7. No unintended Mobile change

```
git diff --stat 01302cf <MERGE> -- apps/mobile apps/console apps/api/src db/migrations contracts packages pnpm-lock.yaml package.json
```

**Expected:** nothing. Only the infrastructure and test files listed in
`WO-INFRA-010-INTEGRATION-AUDIT.md`, and the WO-INFRA-012 files, differ.

## If anything differs
Do not "fix forward" on `main` in a hurry. The merge is one commit: `git revert -m 1 <MERGE>` restores
`main` exactly, and CI on the revert shows `main`'s previous state.
