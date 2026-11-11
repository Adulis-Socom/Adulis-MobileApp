# Development Storage Policy

Status: in force from WO-009A (11 November 2026). Engineering practice for the development
machine and for AI coding agents working on it. It governs no product behaviour and changes no
specification. The measured baseline it is based on is `docs/engineering/WO-009A-STORAGE-AUDIT.md`.

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

Expo and Metro caches (`%TEMP%\metro-cache`), Jest's (`%TEMP%\jest`), Gradle's
(`G:\Android\Gradle`), the npm and pnpm caches, build outputs (`apps/*/dist`).

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
