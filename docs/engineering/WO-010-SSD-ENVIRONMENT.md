# WO-010 -- External SSD Development Environment and Storage Measurements

Date: 11 November 2026. Policy: `DEVELOPMENT-STORAGE-POLICY.md` (S2a added by this work order).
Tool: `ops/scripts/adulis-storage-audit.ps1` (extended) and `ops/scripts/adulis-ssd-env.sh` (new).
Every number below was measured; "GB" is 1024^3 bytes; exact bytes are in the four JSON reports in
`G:\AdulisDevelopment\WO-010\logs` (not committed).

## 1. The SSD, verified

| Property | Value |
|---|---|
| Drive letter | G: (re-verified; not assumed) |
| Volume label / file system | "Extreme SSD", exFAT, allocation unit 1,048,576 bytes (C: is NTFS, 4,096) |
| Device | SanDisk Extreme 55AE, USB bus, SSD media, serial 23039Y400423, health Healthy |
| Capacity / free at the start | 3,726 GB / 3,521,193,705,472 bytes |
| Writable | yes: 16 MB written, read back identical, removed |
| Speed | the first write after idle took 74 s for 16 MB (USB wake); afterwards 26 MB/s (1 MB), 279 MB/s (8 MB), 408 MB/s (32 MB) writes, fast reads |

Untouched: the Android SDK (`G:\Android\SDK`), AVDs (`G:\Android\AVD`), Gradle home
(`G:\Android\Gradle`), Android Studio, the build copies (`G:\w2`, `G:\w2x`, `G:\wo001a`), the
archive `G:\adulis-claude-scratch-archive`, and every non-Adulis folder.

## 2. Configuration (reproducible)

```
G:\AdulisDevelopment\WO-010\
    temp\      TEMP / TMP / TMPDIR of the work order's processes (Jest, Metro, Maestro, emulator)
    scratch\   agent scripts and drafts
    maestro\   Maestro --test-output-dir and --debug-output (emptied after the evidence was kept)
    logs\      gate and native logs, checkpoint reports, kept screenshots
    build\     (unused: no native build was needed)
    cache\     (unused: tools kept their caches under temp\)
```

- `source ops/scripts/adulis-ssd-env.sh WO-010` checks the volume label ("Extreme SSD") and writes
  a probe, then exports TEMP, TMP and TMPDIR (Windows paths) for that shell and its children only,
  plus `ADULIS_SCRATCH`, `ADULIS_MAESTRO`, `ADULIS_LOGS`. A missing, different or unwritable volume
  prints the reason and returns non-zero (tested with a missing drive and a wrong label). Scripts
  call `adulis_ssd_ok` before each disk-intensive step; nothing falls back to C:.
- The emulator was started with the same process-scoped TEMP/TMP (and ANDROID_* for the SDK and
  AVD on G:). Metro was started from a shell that sourced the script. Maestro ran with
  `--test-output-dir` and `--debug-output` under `maestro\`.
- Nothing system-wide changed: no user or machine environment variable, no WSL, Docker, Gradle or
  Android Studio setting, no page-file setting.

## 3. Where outputs actually went (measured)

| Tool | Location observed | Relocated? |
|---|---|---|
| Jest (API and mobile) | `temp\jest` (3,196 files) | yes |
| Metro | `temp\metro-cache` (4,359 files), `temp\metro-file-map-*` | yes |
| Node compile cache | `temp\node-compile-cache` (1,483 files) | yes |
| Maestro driver APKs | `temp\maestro-app*.apk`, `temp\maestro-server*.apk` (32 files, 201,940,416 bytes; none on C:) | yes |
| Maestro test and debug output | `maestro\` | yes |
| Android emulator | `temp\AndroidEmulator` (settings only); boot cost 12,767,232 bytes of C: | yes |
| The API's test SMS adapter | `temp\adulis-sms-*` | yes |
| `%USERPROFILE%\.maestro` | +2.4 MB on C: (Maestro's own sessions folder) | no (the CLI ignores TEMP for it) |
| pnpm store, npm cache, Docker/WSL disks, `.claude` transcripts | C: (unchanged or a few MB) | no (not redirected: shared or protected) |

exFAT allocates 1 MiB per file: the three caches above hold 9,038 files of 83 MB apparent but about
9.05 GB allocated. Capacity is not at risk (3.27 TB free), but apparent sizes understate SSD use;
the audit reports apparent bytes, so SSD use is read from free space.

## 4. Checkpoints

| | Time | C: free (bytes) | G: free (bytes) | Page file | Commit / limit | Free RAM |
|---|---|---|---|---|---|---|
| Before WO-010 (WO-009A emulator running) | 19:07 | 10,355,748,864 | 3,521,193,705,472 | 42,726 MB | 47.1 / 57.4 GB | 0.38 GB |
| Emulator stopped | 19:12 | 20,951,506,944 | | 38,833 MB | 38.9 / 53.6 GB | 1.57 GB |
| **A** before development | 19:16 | 20,928,655,360 | 3,521,187,414,016 | 38,833 MB (5.8 GB in use) | 38.9 / 53.6 GB | |
| **B** after coding | 19:36 | 19,388,227,584 | 3,517,047,635,968 | 38,833 MB (6.2 GB) | 39.4 / 53.6 GB | 2.02 GB |
| **C** after all tests | 21:14 | 19,075,436,544 | 3,510,284,320,768 | 38,833 MB (6.8 GB) | 40.2 / 53.6 GB | 3.92 GB |
| **D** after cleanup | 21:27 | 17,827,049,472 | 3,510,777,151,488 | 38,833 MB (5.9 GB) | 39.8 / 53.6 GB | 1.21 GB |

```
Development storage growth (C - A):  C: 1,853,218,816 bytes (1.73 GB)   G: 10,903,093,248 bytes (10.15 GB)
Storage recovered (D - C):           C: -1,248,387,072 (nothing Adulis on C: was cleaned; C: fell)
                                     G: +492,830,720 bytes
Net A -> D:                          C: 3,101,605,888 bytes less free      G: 10,410,262,528 less free
```

Attribution on C: (A to C): Adulis locations grew about 7 MB in total (repository +0.8 MB, Git
+0.3 MB, `.claude` +5.0 MB, agent temp +0.8 MB); the page file did not change (`pagefile.sys`
40,720,326,656 bytes, last written 19:12, when the emulator stopped). So about 1.85 GB A-to-C, and
1.25 GB during the SSD-only cleanup (with free RAM falling 2.9 GB), were used outside every Adulis
location and outside the page file: other software (a game was running, ON-20261111-120). Not
attributed further; the rest of C: was not scanned (WO-009A S12, WO-010 S11).

Attribution on G:: the work order's folder grew 338 MB apparent (caches, APKs, Maestro output,
logs), about 9.05 GB allocated through the 1 MiB clusters; the AVD +44 MB.

## 5. The page-file investigation (WO-009A's 13.3 GB)

- Before any WO-010 change, with the WO-009A emulator still running (started 10 November, about
  29 hours of use with system TEMP): page file 42,726 MB, commit 47.1 of 57.4 GB, C:
  10,355,748,864 bytes free.
- Stopping only the emulator (graceful `emu kill`): page file 38,833 MB (-3,893 MB) and C:
  20,951,506,944 bytes free (+10,595,758,080). The remaining ~6.7 GB of that release came from
  storage no directory listing showed (the emulator's temp folder held 2 empty files afterwards).
- During WO-010 the page file stayed 38,833 MB at every checkpoint and through the native pass.
- The emulator started with TEMP on the SSD cost 12.8 MB of C: at boot and released 0.5 MB of C:
  and 2 MB of G: when stopped after about an hour and 17 Maestro flows.

Conclusion: the unattributed WO-009A growth was the long-running emulator -- about 3.9 GB measured
as page-file growth from its committed memory, and about 6.7 GB of emulator-held temporary storage
released on exit. This is shown by stop and start measurements, not by a named file; the WO-010
run was shorter than WO-009A's, so "its temp storage now lands on the SSD" is consistent with the
measurements but not proven for a 29-hour run. Nothing was disabled, resized or relocated.

## 6. Native storage gate

Before the native pass: C: 19,362,598,912 bytes free, the page file at 38,833 MB, the emulator's
measured cost with SSD temp 12.8 MB, the measured peak demand of a native pass on C: a few hundred
MB (C: stayed 18.99-19.30 GB through 17 flows). Capacity was sufficient; the runner checked the
SSD and C: before every flow (below 10 GB: no new flow; below 5 GB: stop). No flow was blocked.

## 7. Cleanup (dry run first)

| Removed | Files | Bytes |
|---|---|---|
| Maestro driver APKs of this work order (SSD temp; identified by manifest, unlocked, older than 10 minutes, after all tests) | 32 | 201,940,416 |
| This work order's Maestro test and debug output (SSD), after keeping 30 named screenshots (3,478,513 bytes) and the run logs under `logs\` | 143 | 42,790,445 |
| A failed audit self-test's own probe folder (two small files) on the SSD | 2 | 3,500 |

Kept: the SSD Jest, Metro and node compile caches (rebuildable; reused by later runs of this work
order). Protected and untouched: repositories, databases and Docker volumes (no prune, no
compaction), the SDK, AVDs and emulator data, Gradle, npm and pnpm caches, credentials, the G:
archive, other projects' artifacts, the C: Jest and Metro caches (generic to the machine), the two
truncated Maestro files on C: and every ON-20261111-111 candidate.

## 8. Remaining risks

- C: free moves with other software (3.1 GB A to D, none of it Adulis); it ended at 17.8 GB.
- The system-managed page file can still grow to its 3x-RAM ceiling (about 47 GB) under memory
  pressure; close memory-heavy applications before a native battery.
- The SSD sleeps: the first write can take over a minute; keep the probe step.
- exFAT: small-file caches cost about 1 MiB each; a per-work-order temp folder rebuilds them cold.
  Recommended: a shared `G:\AdulisDevelopment\shared-cache` for Jest and Metro across work orders
  (a later change to `adulis-ssd-env.sh`), or an NTFS partition for development (founder's call).
- If the SSD disconnects, the scripts stop; a process started without sourcing the script still
  writes to C: (the policy requires sourcing it).

## 9. Storage report

```
Storage at start:          C: 20,928,655,360 bytes free (19.49 GB); SSD: 3,521,187,414,016 (3,279.36 GB)  [A]
                           (10,355,748,864 before the idle WO-009A emulator was stopped)
Storage before cleanup:    C: 19,075,436,544 (17.77 GB); SSD: 3,510,284,320,768  [C]
Storage after cleanup:     C: 17,827,049,472 (16.60 GB); SSD: 3,510,777,151,488  [D]
Net storage growth:        C: 1,853,218,816 A to C (about 7 MB Adulis; the rest other software, page file unchanged)
                           SSD: 10,903,093,248 A to C (338 MB apparent; exFAT clusters for 9,038 cache files)
Temporary artifacts generated: 32 Maestro driver APKs (201,940,416), Maestro output 42,790,445,
                           Jest/Metro/node caches 83 MB apparent (about 9 GB allocated), logs 4 MB -- all on the SSD
Temporary artifacts removed: the 32 APKs and the Maestro output (244,730,861 bytes apparent)
Storage recovered:         SSD 492,830,720 bytes; C: none (nothing Adulis was on C: to clean)
Protected files preserved: S7
Remaining storage concerns: S8
```
