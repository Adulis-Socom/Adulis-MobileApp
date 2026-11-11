# Development Storage Policy

Status: in force from WO-009A (11 November 2026). Engineering practice for the development
machine and for AI coding agents working on it. It governs no product behaviour and changes no
specification. The measured baseline it is based on is `docs/engineering/WO-009A-STORAGE-AUDIT.md`;
WO-010 added the external SSD (section 2a) and WO-010A the shared caches (section 2b,
`docs/engineering/WO-010A-SHARED-SSD-CACHE.md`).

## 1. Why

During WO-009 drive C: reached 0 MB free mid-run and Maestro and Metro died
(ON-20261111-100). The space went to artifacts nobody was tracking: Maestro driver APKs left
in %TEMP% on every run (27 `tmp*.apk` of about 120 MB were moved off C: in WO-009; WO-009A then
found 431 more under the names `maestro-app*.apk` and `maestro-server*.apk`, 2.53 GB), agent
scratch outputs, caches, and Docker's virtual disk, which grows and never shrinks by itself. This policy makes storage visible
before and after every work order and says what may be cleaned, by whom, and how.

## 2. The tool

`ops/scripts/adulis-storage-audit.ps1` (Windows PowerShell 5.1, no dependencies).

```
powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -Label "A before"
powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -JsonPath <file.json>
powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -ScratchDir <agent scratch dir>
powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -Clean            # dry run
powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -Clean -Execute   # remove
powershell -NoProfile -ExecutionPolicy Bypass -File ops/scripts/adulis-storage-audit.ps1 -SelfTest
```

- It measures only the paths in its configuration block: the two repositories, build outputs,
  the Android SDK, AVDs, Gradle home and the native build copies on G:, the Expo, Metro and
  Jest caches, Maestro, the agent scratch folders, the npm and pnpm caches, Docker's virtual
  disks, %TEMP% as a whole (for attribution) and pip's leftover unpack folders. It never walks
  a whole drive or a personal folder, and it skips junctions and symbolic links.
- Sizes are apparent bytes, printed in binary units (1 GB = 1024^3 bytes); exact byte counts
  are in the JSON report. Files hard-linked into the pnpm store are counted in both places.
- It deletes nothing by default. `-Clean -Execute` removes only Maestro driver APKs in %TEMP%
  (`tmp*.apk`, `maestro-app*.apk`, `maestro-server*.apk`) that are positively identified (a zip
  whose entries name Maestro), older than `-MinAgeMinutes` (60 by default) and not open by any
  process, checked again right before each delete. Everything else is a reported candidate for
  a person.
- Docker's own usage (`docker system df`) is reported because it lives inside a virtual disk:
  freeing space inside Docker does not return it to C: until the virtual disk is compacted.

To add a location, add one line to the configuration block with its class and a note. Never
point it at a folder that holds anything but development artifacts.

## 2a. The external SSD (WO-010)

The founder authorised the connected external SSD for Adulis development storage. WO-010 verified
it as drive G: (volume label "Extreme SSD", SanDisk Extreme 55AE over USB, exFAT, 1 MiB allocation
unit); `docs/engineering/WO-010-SSD-ENVIRONMENT.md` has the measurements.

- Before disk-intensive work, in the shell that runs it: `source ops/scripts/adulis-ssd-env.sh WO-xxx`.
  It checks the volume label and writes a probe, then exports TEMP, TMP and TMPDIR (this shell and
  its children only) to `G:\AdulisDevelopment\WO-xxx\temp`, so test temporary files, Maestro's
  driver APKs and the emulator's temp land there, and points the shared caches at
  `G:\AdulisDevelopment\shared-cache` (section 2b). If the SSD is missing, not that volume, or
  not writable, it says so and returns non-zero; never fall back to C:. Re-check with
  `adulis_ssd_ok` before each disk-intensive step.
- Start the Android emulator with the same process-scoped TEMP and TMP. WO-010 measured a running
  emulator holding about 10.6 GB of C: through the system TEMP (released when it stopped); started
  this way, its boot cost 12.8 MB of C:.
- Pass Maestro `--test-output-dir` and `--debug-output` under `G:\AdulisDevelopment\WO-xxx\maestro`.
- Keep scratch, logs and screenshots under the work order's `scratch`, `logs` and `maestro` folders.
- exFAT allocates 1 MiB per file: a cache of many small files takes far more space than its
  apparent size (the audit reports apparent bytes; read SSD use from its free space).
- Never move the Android SDK, AVDs, Gradle home, Android Studio, Docker or WSL data, and never
  change system-wide environment variables for this.

## 2b. Shared caches (WO-010A)

Before WO-010A every work order built its own Jest and Metro caches under its own TEMP. On exFAT
(1 MiB per file) WO-010's Jest cache alone cost about 3.2 GB of SSD for 26 MB of cache, and every
work order started cold. Caches are now shared; disposable outputs stay per work order.

| Cache | Location | How the tool is pointed there |
|---|---|---|
| Jest transform cache | `G:\AdulisDevelopment\shared-cache\jest` | `ADULIS_JEST_CACHE`, read by `apps/mobile/jest.config.js` as `cacheDirectory` (Jest has no environment variable of its own) |
| Metro transform and file-map caches | `G:\AdulisDevelopment\shared-cache\metro\transform`, `...\metro\file-map` | `ADULIS_METRO_CACHE`, read by `apps/mobile/metro.config.js` (`cacheStores`, `fileMapCacheDirectory`) |
| Node compile cache | `G:\AdulisDevelopment\shared-cache\node` | `NODE_COMPILE_CACHE`, Node's own variable |

- **Process-scoped.** All three variables come from `source ops/scripts/adulis-ssd-env.sh WO-xxx`
  and exist only in that shell and its children. Unset (CI, another machine, a shell that did not
  source the script), every tool uses its default and nothing changes.
- **Compatibility and invalidation.** Each tool keys its entries itself: Jest by file content,
  path, Jest version, transformer and configuration; Metro by file content, transformer, Babel
  configuration and Metro version; Node by source content and Node version. A dependency upgrade
  therefore writes new entries and never reuses stale ones. Two work orders on different branches
  can share the cache because entries are content-keyed. If a cache ever looks wrong, clear it for
  that tool (`jest --clearCache` with the variable set, or Metro's `--clear`), not the whole folder.
- **Isolation.** The caches hold derived build data only: no credentials, no test results, no API
  responses. Metro's entries from `expo export` contain the inlined `EXPO_PUBLIC_*` values, which
  are public by definition (a secret must never be named `EXPO_PUBLIC_*`). Test output, logs,
  screenshots, Maestro APKs and TEMP stay in the work order's own folder.
- **Trusted device.** exFAT has no access control, and Node and V8 trust the compile-cache entries
  they find, so anything that can write the SSD could plant code that later runs in a Node process
  started from a sourced shell. Keep the SSD attached to this machine only; never mount it on
  another computer or share the folder. If it has been, clear `shared-cache\node` (rebuildable)
  before the next run.
- **Disk checks.** The script's probe runs before anything is created; a full or missing SSD stops
  the shell with a message rather than writing to C:.
- **Disconnection.** If the SSD is unplugged mid-run, the running tool fails with an I/O error; it
  never falls back to C:. Reconnect, re-source the script (the probe re-checks the label) and
  rerun; a partly written cache entry is ignored or rewritten by the tool.
- **Cleanup.** The shared caches are class B (rebuildable): never deleted by a work order's
  cleanup. Clear one only when space is critical, with no Jest, Metro or Node process running.
  The audit classes everything under `shared-cache` as Rebuildable. One known leak: Node leaves an
  orphaned temporary file (`<8 hex>.<6 characters>`) in `shared-cache\node` whenever parallel Jest
  workers write the same entry, about 100 per full mobile suite (about 100 MB of G: on exFAT);
  clear `shared-cache\node` whenever it grows large (ON-20261111-124).
- **Cost and speed (measured, `docs/engineering/WO-010A-SHARED-SSD-CACHE.md`).** A cold build of
  the three caches took 8.9 GB of G: (58 MB apparent: 1 MiB per file) and made the mobile suite and
  `expo export` 4.1 and 3.3 times faster afterwards. The first full suite on a cold cache can time
  out two boot tests (ON-20261111-123); rerun it.
- **Native build copies** (`docs/mobile/WO-010A-EXPO-DEPENDENCY-STABILIZATION.md`): a native
  Android build needs a short, real (not subst) path on G:. React Native codegen rejects a subst
  drive (autolinking resolves it to the G: path, "different roots"), and CMake object paths reach
  about 285 characters even from `G:\w2`. Name the copy after the work order (`G:\w10a`, staging
  `G:\w10ax`); it needs about 6 GB apparent and far more on exFAT (1 MiB per file). An agent cannot
  delete a top-level G: folder, so the final report lists it for the founder.

## 3. Classes

### A. Safe disposable artifacts

Positively identified, recreated by the tool that made them, and not needed as evidence:

- Maestro driver APKs in %TEMP% (`tmp*.apk`, `maestro-app*.apk`, `maestro-server*.apk`) once
  their run has finished: each is a copy of Maestro's own driver, written on every run (WO-009A
  measured 11.7 MB plus 0.9 MB per run, every copy byte-identical), so they hold no evidence;
- screenshots, recordings and logs of completed test runs whose results are recorded in the
  work order's document (the final report keeps the evidence that matters);
- duplicated or intermediate outputs in the agent's scratch folder from the current work order;
- temporary files a tool regenerates on its next run.

Clean them only after the required evidence is preserved. Verified Maestro driver APKs may be
cleaned by any work order, whoever's run left them; every other class A output only by the work
order that created it, unless a person says otherwise.

### B. Rebuildable caches

The shared Jest, Metro and Node caches (`G:\AdulisDevelopment\shared-cache`, section 2b), Expo and
Metro caches in a TEMP that did not source the SSD script (`%TEMP%\metro-cache`, `%TEMP%\jest`),
Gradle's (`G:\Android\Gradle`), the npm and pnpm caches, build outputs (`apps/*/dist`).

Reuse them: deleting them costs download time (Gradle and SDK downloads are slow here) and
usually frees less than expected. Clean one only when space is critical, no process is using it
(no Metro, Gradle, Jest or pnpm running), and the next step can afford the rebuild.

### C. Protected data

Never deleted by tooling or by an agent on its own judgement:

- source code, Git repositories and worktrees, `.git` folders;
- active databases, PostgreSQL and MinIO data, Docker volumes and Docker's virtual disks;
- Android emulators and AVD data, Android SDKs, installed dependencies needed for development;
- credentials, `.env` files and other environment configuration;
- user files, and anything outside the configured development paths;
- evidence needed for an unresolved bug, and files belonging to another active work order;
- `G:\adulis-claude-scratch-archive` (deleting it needs the founder's explicit authorisation).

Never run unrestricted cleanup commands such as `docker system prune -a --volumes`,
`docker volume prune`, or a recursive delete of %TEMP%, a cache root or a drive.

### Review (uncertain)

Anything whose owner or necessity cannot be proven: old agent session scratch folders, pip's
leftover `pip-unpack-*` folders, Docker's build cache (other projects share this Docker), the
older native build copies on G:. Report them with their size; a person decides.

## 4. Cleanup procedure

1. Preserve the evidence first: the work order's document holds the results; keep the logs and
   screenshots an open issue refers to. Never clean while a test run is in progress.
2. Dry run: `-Clean` (or, for a manual clean, list the exact paths and sizes).
3. Confirm every item is class A, finished and not in use.
4. Execute: `-Clean -Execute`, or a delete of the exact listed paths only.
5. Record every path cleaned and the bytes recovered, and run the audit again.

If ownership or necessity is uncertain, report the candidate and do not delete it.

## 5. Preventing exhaustion

1. Reuse the existing Android native build when native dependencies have not changed (diff
   `apps/mobile/package.json` dependencies and `app.json` against the build copy; install its
   APK and let Metro serve the branch's JavaScript).
2. Do not generate duplicate APKs or a second build copy.
3. Reuse package caches (`pnpm install --frozen-lockfile`, one npm cache per purpose).
4. No full native rebuild for a JavaScript-only change.
5. Keep one authoritative final test report per work order; do not keep every intermediate run.
6. Keep only the debugging artifacts an open issue needs.
7. Clean the work order's class A outputs before handing over.
8. Check free space before storage-intensive work (native builds, Maestro batteries, database
   rebuilds, full test runs).

Free space on C: (engineering defaults from the WO-009A measurements; adjust them by editing this
section):

- below 10 GB: run no native build or Maestro battery; clean class A, then report;
- below 5 GB: pause every disk-intensive operation and report the constraint to the founder.

Do not risk damaging the environment to finish a test: a test that needs space it does not have
is reported as blocked by the environment, not forced.

## 6. What every work order reports

Every AI coding agent's final report includes:

```
Storage at start:
Storage before cleanup:
Storage after cleanup:
Net storage growth:
Temporary artifacts generated:
Temporary artifacts removed:
Storage recovered:
Protected files preserved:
Remaining storage concerns:
```

Report C: and G: separately, in bytes and GB, and name any growth inside Docker or WSL virtual
disks that host free space cannot show. Host free space also moves with other software (an
editor update, Windows): say what the audit could and could not attribute.
