# WO-INFRA-005 -- Failure register

Every failure observed while verifying, in order. The issue IDs refer to
`docs/overnight/OVERNIGHT-INFRA-ISSUES-2026-11-13.md`.

| # | Where | What failed | Root cause | Infrastructure? | Fix | Re-run |
|---|---|---|---|---|---|---|
| F-1 | CI history, 40 runs from 2026-11-08 | "Start object storage": `minio/minio:latest` pull access denied | Images withdrawn from Docker Hub and quay.io (ISSUE-INFRA-002) | yes | `3b9bbc6`, pinned Chainguard digest | PASS in 43320430973 |
| F-2 | CI main, 34129602933 (2026-09-07) | gate `migrate`: `refusing to seed with NODE_ENV=unset` | Steps could not carry an environment (ISSUE-INFRA-003) | yes (gate runner) | `bbbadac` | PASS in 43320430973 |
| F-3 | CI 34129602933, 34147378670 | `typecheck` and `build`: "No projects matched", reported as passing | Empty scope selection exits 0 (ISSUE-INFRA-004) | yes (gate runner) | `bbbadac` | UNSCOPED with a stated reason, then full PASS in 43321921280 |
| F-4 | Local validation script, first draft of the init | duplicate lifecycle rules (2, then 3) | The image has no `grep`, so the existence check failed open (ISSUE-INFRA-014) | yes | `case` match, before the commit | 1 rule after 3 inits |
| F-5 | CI 43320430973 (`bbbadac`) | gate `test`: 4 API tests `read ECONNRESET` (`wo-sec-001` x3, `wo-009` #18) | Supertest's per-request `listen(0)`/`close()` races concurrent bursts; reproduced 94/420 vs 0/420 (ISSUE-INFRA-015) | CI timing exposes a test-harness race | `1a8c6f7`, five suites listen first | 126/126 locally; 983/983 in 43321921280 |
| F-6 | Local compose validation, first run | 4 checks | My own test-script bugs (an env prefix before a pipe; a wrong extension name), not the configuration | no | script fixed | 18/18 |

**No failure was hidden or skipped.**
- No test was disabled.
- No assertion was changed.
- No security control was weakened.
- `c1-onboarding`, noted as failing in an earlier local-environment memory, passed in both the local and
  the CI run.
