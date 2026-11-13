# PHASE-001 -- Issues and blockers

13 November 2026.

**Severity:**
- **High:** blocks safe progress or risks data.
- **Medium:** needs a decision before the related work.
- **Low:** record only.

Issues carried from the infrastructure batches keep their original IDs, cited in brackets.

## 1. Blockers (approval-gated; not executed in PHASE-001)

| ID | Blocker | Needs |
|---|---|---|
| PHASE-001-BLK-01 | Merging PR #105 (and any later merge into `main`) | founder decision PHASE-001-DEC-01 |
| PHASE-001-BLK-02 | The live MinIO move off the volume named `adulis-pgdata` (WO-INFRA-011) | founder approval |
| PHASE-001-BLK-03 | The development-database repair (WO-INFRA-013) | founder approval |
| PHASE-001-BLK-04 | WO-019 native verification | free memory (`PHASE-001-ENVIRONMENT-INVENTORY.md` section 8) |

## 2. Issues

| ID | Severity | Issue | Evidence | Recommended handling |
|---|---|---|---|---|
| PHASE-001-ISS-01 | High | **`main` is not verified.** Its latest CI run (34129602933, 7 September) failed at the Gates step, and nothing has been merged since | `PHASE-001-BRANCH-AUDIT.md` s5 | merge Route 1 step 1, then confirm a green push run on `main` |
| PHASE-001-ISS-02 | High | **The Work checkout still holds the only working copy of uncommitted MOB-WO-0 files,** plus a stash. Its remote-tracking refs are two months old. A `git clean` or a branch switch there could lose the files; they are now preserved, but the checkout itself remains a hazard | manifest s2, s7 | leave it untouched until the founder decides (DEC-05); never clean it without re-verifying against the preservation branch |
| PHASE-001-ISS-03 | Medium | **Stale integration statement.** The closure documents (the handoff, WO-INFRA-010, WO-INFRA-014-MOBILE-READINESS) say the later merge carries one conflict (`apps/api/jest.config.js`). After the final documentation commit `341d579` there are **four**; the extra three are the overnight issue registers, add/add, where the closure copy is a superset | `evidence/merge-simulation.txt` | take the closure version of all four when the merge is authorised |
| PHASE-001-ISS-04 | Low | **CI fails on the preservation branch** (run 43447307780): its September `ci.yml` pulls `minio/minio`, which is no longer available | manifest s8 | expected; a backup is never modified |
| PHASE-001-ISS-05 | Medium | **App identity: the two foundations decided differently.** MOB-WO-0 deliberately withheld the bundle identifier and Android package; the closure line fixed `com.adulis.app`, with an EAS project id and owner, and a test guards it | comparison s2 | the closure line governs (it is built and tested); recorded so the reasoning in MOB-WO-0 is not lost |
| PHASE-001-ISS-06 | Medium | **Defect-register numbering collision.** MOB-WO-0's register adds D-365 to D-391; `main` and the closure line end at D-364. The next defect recorded on the closure line would reuse D-365 with a different meaning | `evidence/foundation-compare-5.txt` | founder decision DEC-06 before the next register entry |
| PHASE-001-ISS-07 | Medium | **Specification authority.** MOB-WO-0's 16 `docs/adu` documents (ADU-MOB-00 to 08 and others) exist on no branch except the backup. MOB-WO-0 treats ADU-MOB-01 v1.2 as governing; the November 8 pack (which holds ADU-MOB-02 v4.3) outranks the older specifications | comparison s2 | founder decision DEC-04; do not install them as authority without reconciliation |
| PHASE-001-ISS-08 | Medium | **Location of the mobile agent settings.** MOB-WO-0's staged rename moves `apps/mobile/.claude/settings.json` to the repository root; the closure line and the workspace rules keep it in `apps/mobile` | manifest s2 | keep the closure layout; resolve in the Mobile Foundation reconciliation |
| PHASE-001-ISS-09 | Medium | **Design tokens: two approaches.** MOB-WO-0 adds `@adulis/tokens/native` (a measured native role set); the closure line converts the web tokens in `src/theme/theme.ts` | comparison s2 | founder decision DEC-03; a `packages/*` change needs its own PR |
| PHASE-001-ISS-10 | High (for native work) | **Memory.** 0.33 to 0.56 GB free; a game uses 2.6 GB; no `.wslconfig` | inventory s1 | see BLK-04 |
| PHASE-001-ISS-11 | Medium | **Disk C:.** 24.95 GB free. The Docker disk is 53.9 GB, and grew about 360 MB since 11:53; 21.43 GB of build cache is reclaimable inside it; the page file is 22.9 GB | inventory s1, s2 | founder-run `docker builder prune` plus disk compaction; never a volume prune |
| PHASE-001-ISS-12 | Medium | **The live MinIO data sits on a volume named `adulis-pgdata`.** Anyone "cleaning up" by name could delete it [WO-INFRA-011] | inventory s2 | protected; resolved by the approved MinIO move |
| PHASE-001-ISS-13 | Low | **PR #75** (`tier13/t13-p1-db-v1-14`) is open and CONFLICTING | audit s2 | founder may close it; not touched |
| PHASE-001-ISS-14 | Low | **Leftover Docker objects.** Stopped containers (`adulis-final-check` exited 255, `adulis-minio-init`) and 19 anonymous volumes | inventory s2 | not touched; review only |
| PHASE-001-ISS-15 | Low | **The GitHub MCP plugin failed to connect** ("Authorization header is badly formatted") [ISSUE-INFRA-010] | session | `gh` was used instead |
| PHASE-001-ISS-16 | Low | **The Work checkout has a stale worktree record** (`wt-am`, its directory gone) | manifest s7 | `git worktree prune` there only with the founder's approval; harmless |
| PHASE-001-ISS-17 | Low | **The storage audit ran late** (18:05, after the preservation), not at the start of the work order as the policy asks | inventory s9 | process note |
| PHASE-001-ISS-18 | Medium | **Production is unknown:** existence, deployment, monitoring, backups [ISSUE-INFRA-017] | WO-INFRA-014 | separate work order |
| PHASE-001-ISS-19 | Medium | **Open contract decisions** W21-02, W20-07 and the four Chat decisions | WO-INFRA-014-MOBILE-READINESS s4 | founder or backend owner |
| PHASE-001-ISS-20 | Medium | **Known test leaks and no object-store guard** [ISSUE-INFRA-CLOSURE-004, -006] | WO-INFRA-014 | future infrastructure work order |

## 3. What PHASE-001 did not do (by rule)

- **No merges:** nothing merged, no pull request created or changed, `main` untouched.
- **No history changes:** no force-push; no branch deleted or reset.
- **The Work checkout:** no file, index or branch in it changed.
- **No destructive commands:** no `git clean`, `git reset --hard` or worktree prune. No stash was
  created, applied or dropped; the existing stash was only read (`stash list`, `stash show`) and copied
  to a bundle.
- **No change to services or data:**
  - no Docker container or volume removed, started, stopped or restarted;
  - no database written, migrated, seeded or repaired;
  - no MinIO migration;
  - no `.env` opened or changed.
- **No installs, tests or new work:**
  - no dependency installed;
  - no test that writes to a database or object store run;
  - WO-019 and WO-023 not started;
  - no future branch or worktree created.
