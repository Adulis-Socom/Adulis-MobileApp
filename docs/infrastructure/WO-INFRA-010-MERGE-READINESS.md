# WO-INFRA-010 -- Merge readiness

**Merge status: NOT MERGED. BLOCKED pending the founder's explicit approval.**

| Check | Result | Evidence |
|---|---|---|
| Conflicts with current `main` | none | PR #105 `MERGEABLE`; the CI merge commit `f47b5ab` built |
| CI on the merge result | green: 31 of 31 gates; API 635 of 635; `console-e2e` 88 | run 43415907830 |
| Only intended files | yes: nine code files plus docs; no forbidden area | `WO-INFRA-010-INTEGRATION-AUDIT.md` section 3 |
| Includes `810b598` (date fix) | yes | the same 6 lines |
| Security controls | none weakened. The evidence bucket stays private; media listing is closed; the security gates are unchanged | gate list |
| Data | no data touched; nothing runs on merge except CI | -- |
| Reversibility | merging is one commit on `main`, revertible with `git revert -m 1 <merge>` | -- |

## Before pressing merge
1. **Approval:** the founder's explicit approval.
2. **Review as backend owner:** the two API test-file changes (`t8` listen-first, `810b598`) and the
   WO-INFRA-012 test guard (`apps/api/test/db-target.ts`, `global-setup.ts`, the CI step "Mark the job's
   database disposable").
3. **`810fb27`:** decide whether to also merge `ci/scope-filter-main-push`. It merges clean either way.
4. **Merge method:** use a **merge commit**, not squash, so the provenance of the cherry-picked commits
   (`-x` lines) stays readable.
5. **Mark ready:** take the PR out of draft first.

## After merging
Follow `WO-INFRA-010-POST-MERGE-VERIFICATION.md`. Until that run is green, `main` is not verified.

## What stays blocked until then
- The MinIO move is best run from a checkout of the merged `main` (ISSUE-INFRA-001).
- The Work checkout's reconciliation (integration audit, section 5).
- The mobile line's integration (through the finalization branch's successor, not WO-022 alone).
