# WO-INFRA-014 -- Mobile development readiness

**Mobile development can resume.** This batch changed no file under `apps/mobile` (`git diff --stat
149924c..HEAD -- apps/mobile` is empty), and the mobile suite passes in CI on the closure branch: 27
suites, 520 tests.

## 1. Recommended starting branch

| | |
|---|---|
| **Branch** | `infra/wo-infra-010-014-closure` |
| **Exact starting commit** | the final head of that branch, stated in `docs/overnight/OVERNIGHT-INFRA-CLOSURE-HANDOFF-2026-11-13.md`, section J (it is the documentation commit that follows the last code commit `e573a34`) |
| **Contents** | WO-001 to WO-022 (the complete mobile line), plus every infrastructure fix of WO-INFRA-001 to 014: pullable MinIO, a truthful CI, test-database isolation |
| **Why not `mobile/wo-022-messaging-reliability-hardening` (`3cad2e3`)** | it lacks the infrastructure fixes. CI on it dies at its MinIO step (the old image is gone), so a new branch from it would get no real CI, and its API suites could still run against the persistent database |
| **Why not `main`** | `main` has none of the mobile app (WO-001 to WO-022); its `apps/mobile` is a placeholder |

**How:** `git switch -c mobile/wo-0xx-<name> origin/infra/wo-infra-010-014-closure`.

## 2. Required infrastructure dependencies
- **The API suites need a disposable database:** run `bash ops/scripts/test-db.sh up`, then
  `eval "$(bash ops/scripts/test-db.sh env)"` (`WO-INFRA-012-ISOLATION-IMPLEMENTATION.md`).
  - The mobile Jest suite needs neither.
  - Running the app against a local API still uses the development database and the live MinIO, as
    before.
- **CI:** nothing to do; every push to the branch runs the 32 gates.
- **Local MinIO:** keep running the current stack (the old compose file, MinIO on 9100) until the
  founder approves the move. With the new compose file, `MINIO_HOST_PORT=9100` must be in `.env`.

## 3. Outstanding native validation
Nothing native has run since WO-018. The backlog is `docs/mobile/MOBILE-NATIVE-VALIDATION-BACKLOG.md`
(59 table rows):
- WO-018 (Buyer accessibility): the TalkBack pass T1 to T12, W18-12 at 130 %, and Buyer journeys A to F;
- WO-020 (Seller Companion foundation): the native checks;
- WO-021 and WO-022 (messaging): run under a resource restriction. No emulator, Gradle, Maestro or
  Docker; nothing native run.

The backlog reserves **WO-019** for this, on a machine with free memory (see the environment, section 6).

## 4. Backend and contract blockers (from WO-022's handoff, unchanged by this batch)
- **W21-02:** may a phone use the Seller inbox? A contract question; a formal proposal awaits the
  founder.
- **Four open founder decisions:** conversation references, escalation wording, retries of unpublished
  Products, and permission names.
- **The backend's idempotency answers are unverified;** the read-only Seller Chat probe for W21-02 and
  W21-03 is still to run.
- **W20-07:** the Order line shape, needed by "Seller Companion Order awareness".

## 5. The next Mobile work order
WO-022's handoff recommends, in order:
1. **WO-019, native verification** of the WO-018 to WO-022 backlog, including a local proxy to fake
   gateway failures, and the read-only Seller Chat probe (W21-02, W21-03, backend matrix rows 1 to 16).
2. **The next feature, WO-023:** Seller Companion Order awareness. Store notifications open their
   Order, with an Order line summary once W20-07 publishes the line shape; no open Chat decision blocks
   it.

## 6. Environment for native work (measured 11:53Z)

| | |
|---|---|
| RAM | 15.7 GB total, **1.98 GB free**. The largest users: the WSL/Docker VM 1.26 GB; a game (`CrimsonDesert`) 834 MB; Node 759 MB; VS Code about 1 GB across processes |
| Docker | 9 running containers (adulis 2, nac-trial 5, pgAdmin and Mailpit among them), about 0.8 GB in all |
| C: | 28,248,940,544 bytes free |
| G: | 3,351,387,308,032 bytes free |

**Could this interfere with native Android testing?** Yes.
- The emulator needs 2 to 4 GB.
- WO-018 already recorded failures with a game running (W18-02, W18-08).
- The WSL VM has no `.wslconfig`, so Docker may take up to half the RAM.

**Before WO-019:**
- close the game;
- stop the `nac-trial` stack (`docker compose -p nac-trial stop`: it stops, it deletes nothing);
- consider a `.wslconfig` memory cap (a founder change; not made here).

## 7. Git reconciliation before parallel development
1. **Decide PR #105** (infrastructure into `main`).
2. **Preserve the Work checkout's local MOB-WO-0 work** (`WO-INFRA-010-INTEGRATION-AUDIT.md`,
   section 5), and decide its relation to WO-001 to WO-022. Two parallel mobile foundations cannot
   both continue.
3. **After #105:** merge `main` into the closure branch.
   - **Dry run:** `git merge-tree` shows **one expected conflict**, in `apps/api/jest.config.js`.
     The candidate carries `main`'s shape plus the WO-INFRA-012 lines; the closure branch also has the
     mobile line's `testTimeout`.
   - **Resolution:** keep the closure branch's version, which has all of them.
   - Then bring the mobile line into `main` through it, with the backend review its ten migrations
     need.
