# WO-INFRA-001 -- Risk register

13 November 2026. **Likelihood** and **impact** use high / medium / low. **Status** is the status at
the end of the overnight batch. Detail is in `docs/overnight/OVERNIGHT-INFRA-ISSUES-2026-11-13.md`.

| ID | Risk | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|
| R-01 | MinIO and PostgreSQL write the same physical volume (any checkout before `2cb0baf`, or any script naming `adulis-pgdata` for PostgreSQL) | medium | high: interleaved writes, a corrupt database or bucket store | Explicit, distinct volume names (WO-INFRA-002); old volume left untouched | Configuration fixed; live data move pending approval (ISSUE-INFRA-001) |
| R-02 | Someone deletes "the old postgres volume" `adulis-pgdata` and loses every MinIO object | medium | high (local dev data: fixtures and test media) | Compose comment and runbook warn; tonight's tar backup on the SSD | Open until the move (ISSUE-INFRA-005) |
| R-03 | Someone removes the phantom `pg_*` buckets with `mc rb` and destroys the old database files | low | medium | Register entry; decision on the old database | Open (ISSUE-INFRA-005) |
| R-04 | CI cannot pull its object store, so no gate runs on any branch | certain (until fixed) | high: no CI evidence for any change | Pinned Chainguard digest (WO-INFRA-003) | Fixed in CI run 43320430973 (see WO-INFRA-005) |
| R-05 | The pinned digest stops being served (Chainguard's free tier publishes only `latest`) | medium, over months | medium: CI red at its first step, loudly | Update the digest in both files; alternatives listed in WO-INFRA-003 | Accepted, documented |
| R-06 | A green CI run where typecheck, build and test never ran (empty scope) | certain on main, frequent on root-only branches | high: false assurance | Fail-safe scope in gates.mjs and the `gate-runner` gate (WO-INFRA-004) | Fixed |
| R-07 | Gate `migrate` red in CI (seed refused) | certain (until fixed) | high: every later gate unrun | Seed step declares NODE_ENV=test (WO-INFRA-004) | Fixed |
| R-08 | A failed bucket or policy step passes setup silently | low | medium: misleading later failures | `set -eu` init script | Fixed (ISSUE-INFRA-008) |
| R-09 | Production backups do not exist or are unverified | unknown | high | Out of scope tonight: no production access exists | UNKNOWN, founder action |
| R-10 | Local disk or memory exhaustion during heavy gates (C: holds Docker's 47 GB disk; about 1 GB of RAM free) | medium | medium: crashed suites, misattributed failures | SSD for logs and backups; gates run one at a time; nothing pruned | Managed |
| R-11 | Running compose from this checkout without the runbook makes MinIO look empty (objects stay in the old volume) | medium after merge | medium: missing fixture media, not lost data | Compose comment; runbook step order | Open until the move |
| R-12 | `pgvector/pgvector:pg17` drifts (moving tag) | low | low | Pin only if `db:determinism` starts to differ | Accepted (ISSUE-INFRA-011) |
| R-13 | The local media bucket is anonymously listable; R2 is not | low | low (local only) | Optional GetObject-only policy | Deferred (ISSUE-INFRA-013) |
