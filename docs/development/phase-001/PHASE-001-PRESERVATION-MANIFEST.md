# PHASE-001 -- Preservation manifest

13 November 2026. Work Order A (preservation of the uncommitted MOB-WO-0 work).
Evidence: `G:\AdulisDevelopment\PHASE-001\evidence\` (file names below).

**Result: PRESERVED AND VERIFIED.**
- The uncommitted work is committed in two commits on `backup/mob-wo-0-preservation-2026-11-13`,
  which is pushed to `origin`.
- Every file is byte-identical to the working tree.
- The original checkout was not changed in any way.

## 1. Source

| | |
|---|---|
| Checkout | `C:\Users\naods\Documents\Work\adulis-platform` |
| Remote | `origin` = `https://github.com/Adulis-Socom/Adulis-MobileApp.git` |
| Branch | `ci/scope-filter-main-push` (in step with its upstream, 0 ahead / 0 behind) |
| HEAD | `810fb27811ede6e170cff5d7029fee42fe45aad6` |
| Origin of the work | MOB-WO-0 (ADU-MOB-WO-01 v1.2, WO-0b), written 7-8 September 2026 and never committed (see its own report, `docs/build-status/MOB-WO-0-REPORT.md`) |
| `git status` before | `evidence/status-before.txt`, sha256 `f8ef5559b911aae446bd9bff39014dbed1d2be34df3846305fa1e5f32bc61744` |

## 2. What was found

**Staged (1 entry):** `R100 apps/mobile/.claude/settings.json -> .claude/settings.json`.

**Modified, not staged (18 files):**
- `.claude/reference/DOCUMENT_AUTHORITY.md`, `.claude/settings.json`;
- `.dependency-cruiser.cjs`, `.github/workflows/ci.yml`, `.gitignore`;
- `CLAUDE.md`, `apps/mobile/CLAUDE.md`, `apps/mobile/package.json`;
- `docs/build-status/DEFECT-REGISTER.md` (adds D-365 to D-391);
- `ops/scripts/gates.mjs`, `ops/scripts/verify-deps-fires.sh`, `ops/scripts/verify-docs-ascii.mjs`;
- `package.json`, `packages/config/eslint.config.js`;
- `packages/tokens/README.md`, `packages/tokens/package.json`, `packages/tokens/tsconfig.json`;
- `pnpm-lock.yaml`.

**Untracked (22 paths, 89 files, 3,184,985 bytes)** (`evidence/untracked-with-sizes.tsv`):

| Path | Files | What it is |
|---|---|---|
| `apps/mobile/.claude/` | 4 | two reviewer agents, two skills (`adulis-routing`, `adulis-unmechanized-invariants`) |
| `apps/mobile/app/` | 10 | Expo Router shell: `_layout.tsx`, `index.tsx`, eight `.gitkeep` route placeholders |
| `apps/mobile/src/` | 17 | `components/Text.tsx` plus sixteen `.gitkeep` folder placeholders |
| `apps/mobile/assets/` | 9 | Inter and Noto Sans Ethiopic fonts (Regular, Medium, Bold), licences, `SOURCES.md` |
| `apps/mobile/scripts/` | 10 | the fourteen mobile gates (`gates/run.mjs`) and the Claude hooks with a secret scanner (`hooks/`) |
| `apps/mobile/__tests__/`, `maestro/` | 2 | a placeholder render test; an empty Maestro folder |
| `apps/mobile/` single files | 10 | `app.config.ts`, `babel.config.js`, `eas.json`, `expo-env.d.ts`, `metro.config.js`, `tsconfig.json`, `README.md`, `DEFERRED-GATES.md`, `PRIVACY-MANIFESTS.md` |
| `docs/adu/` | 16 | ADU-MOB-00 to 08, two ADU-MOB amendments, ADU-CMP-01 and other mobile specifications |
| `docs/build-status/` | 3 | `MOB-WO-0-REPORT.md`, `reviews/MOB-WO-0-review.md`, `permission-probe.txt` (3 bytes) |
| `packages/tokens/src/native/`, `packages/tokens/test/` | 9 | the React Native token set (`@adulis/tokens/native`) and its two tests |

**Ignored by the repository's `.gitignore` (excluded, never committed):**
- `.env`;
- `.dev-sms.log`, `apps/api/.dev-sms.log`;
- `apps/console/e2e/.auth/`, `apps/console/e2e/.walk/`, `apps/console/test-results/`;
- `node_modules/` and build output.

These remain only on that machine. `.env` holds local credentials and must never be committed.

## 3. Secret scan

`evidence/secret-scan.txt` records only the file, the line and the pattern class; no values were
printed.

| Hit | Assessment |
|---|---|
| `apps/mobile/scripts/gates/run.mjs:403` (`token`) | a field name in a gate exemption table; no credential |
| `apps/mobile/scripts/hooks/hooks.test.mjs:141,145,147` (`password`, `api_key`) | fixtures of the secret scanner's own tests (synthetic strings, a placeholder, an environment reference) |
| Added lines of the 18 tracked diffs | no hit |

**Conclusion:** no credential was committed.

## 4. Method (non-invasive)

The founder's checkout was never written to. Every command that read it used
`git --no-optional-locks`, so even the index's stat cache was not refreshed.

1. **Commit 1 (the staged state):**
   - copy `.git/index` to a temporary index file (`evidence/idx-staged`), then `git write-tree`;
   - `git commit-tree -p 810fb27`.
2. **Commit 2 (the working tree):**
   - a second temporary index (`evidence/idx-wt`) from commit 1's tree, then `git add -A` with
     `GIT_INDEX_FILE` set (the `.gitignore` rules apply), then `git write-tree`;
   - `git commit-tree -p <commit 1>`.
3. **Branch:** `git update-ref refs/heads/backup/mob-wo-0-preservation-2026-11-13 <commit 2> <zero>`.
   It creates the ref only if it does not exist.
4. **Push:** `git push origin refs/heads/B:refs/heads/B`. No force; the result was `[new branch]`.

No `git stash`, `reset`, `clean`, `checkout` or `switch` was run.

## 5. The commits

| | SHA | Tree | Parent | Message |
|---|---|---|---|---|
| Commit 1 | `4fd56d33782bde99e5359ebe2536bd8dd82589ef` | `e0988a4564cfa82ab5facb38f34a58199a0cd33b` | `810fb27` | `chore(preservation): MOB-WO-0 staged state, exactly as found` |
| Commit 2 | `0f9b08380d869d7a6c0783595966210f607a404a` | `7150ffd8e2fbe1abf4c5ec123a58e1a06af4aad7` | commit 1 | `chore(preservation): checkpoint MOB-WO-0 local development foundation` |
| Commit 3 | (this documentation) | -- | commit 2 | `docs(phase-001): ...`; adds only `docs/development/phase-001/` |

Full messages: `evidence/msg-c1.txt`, `evidence/msg-c2.txt`.

## 6. Verification

| Check | Result | Evidence |
|---|---|---|
| Changes in commit 2 against HEAD | 108 (90 added, 1 deleted, 17 modified) | `c2-vs-head.txt` |
| Untracked files missing from commit 2 | **0 of 89** | `c2-vs-head.txt` |
| Content equality | **107 of 107** files identical: `git hash-object` of the working file (same filters) equals the committed blob | `c2-vs-head.txt` |
| Ignored files present in the commits | **0** (`.env` absent) | `c2-vs-head.txt` |
| Commit 1 equals the original index | yes, the tree written from the index copy | `c2-vs-head.txt` |
| Push | `[new branch]`; the remote head equals commit 2 | `push-verification.txt` |
| Independent copy | the workspace clone fetched the branch: tree `7150ffd8...` matches, parent chain `0f9b083 4fd56d3 810fb27`, 63 files under `apps/mobile` | `push-verification.txt` |
| Original checkout afterwards | still on `ci/scope-filter-main-push`; the `git status` sha256 is identical (`f8ef5559...`), also re-checked at 18:08 local time | `work-checkout-at-risk.txt` |

## 7. Other at-risk content found in the same checkout

The completeness check also looked beyond the working tree (`evidence/work-checkout-refs.txt`,
`evidence/work-checkout-at-risk.txt`).

| Item | Finding | Action |
|---|---|---|
| **One stash** `stash@{0}` = `22d209f19e9120f56886675defe73f172b00a3f1` (7 September 2026, on `t26-p2-test-ladder` at `fe417c1`) | A 2-line change to `apps/mobile/CLAUDE.md` (below); no untracked part. The exact text exists in no remote branch. Its intent ("build against the real API") is carried by the closure line's `apps/mobile/CLAUDE.md` | **Left in place.** The full patch is recorded below (so it is now in a pushed commit), and an offline bundle was written outside the repository: `evidence/work-checkout-stash-22d209f.bundle` (3,914,876 bytes; `git bundle verify`: okay) |
| **Two local commits on no remote ref:** `cd06141` (T17 fix 2) and `c7947b5` (T17 fix 3), 3 September 2026 | `git cherry` against their upstreams marks both `-`: an equivalent patch is already on `origin/t17/chooser-can-create-a-store` and `origin/t17/payout-first-set-wording` | **None needed:** the content is on the remote |
| **Eight local branches without an upstream** (`t25-p0-instruments`, `tier14/t14-a3-stamped-challenge`, `tier14c/*` (4), `tier15/p1-install`, `tier15/p2-notification-scope`) | Every tip is contained in 50 to 86 current remote branches | **None needed** |
| **A stale worktree record** (`wt-am`, detached at `f65fb14`, marked prunable: its directory no longer exists) | `f65fb14` is contained in 12 remote branches, `main` among them | **Not pruned** (out of scope; harmless) |
| **The checkout's remote-tracking refs** were last fetched on 7 September 2026 | The comparisons above were repeated against the workspace clone's fresh refs | -- |

**The stash's full patch** (no secret; recorded so it survives even if the stash is dropped):

```diff
diff --git a/apps/mobile/CLAUDE.md b/apps/mobile/CLAUDE.md
index 557caa1..a191ba8 100644
--- a/apps/mobile/CLAUDE.md
+++ b/apps/mobile/CLAUDE.md
@@ -57,7 +57,8 @@ native secure storage - never a cookie, never a JWT.
 - **A client timestamp is epoch milliseconds read straight from the system clock**,
   never assembled from local date and time components (ADU-API-01 A5).
 - Scan capture and queued sync are the **only** offline-capable operations.
-- Build against the Prism mock (`pnpm mock:api`). May import `@adulis/api-client`,
+- **Build against the real API** (T7 S7.1; the root `CLAUDE.md` governs). The Prism mock
+  (`pnpm mock:api`) remains for contract-only work. May import `@adulis/api-client`,
   `@adulis/locale`, `@adulis/tokens`, `@adulis/config` - and nothing under `apps/`.
```

## 8. What this branch is and is not

- **It is a backup,** not a release candidate and not a merge source. It is not the official baseline.
- **CI on it fails** (run 43447307780, step "Start object storage and create the two buckets":
  `pull access denied for minio/minio`). Cause: its `ci.yml` is the September version, which pulls an
  image that is no longer available. Recorded as PHASE-001-ISS-04; the branch is not changed to fix it.
- **The original checkout still holds the work uncommitted.** Nothing was discarded. Whether to clean
  that checkout later is the founder's decision (PHASE-001-DEC-05).
