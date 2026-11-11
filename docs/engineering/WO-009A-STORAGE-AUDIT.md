# WO-009A Storage Audit

Development machine, 11 November 2026 (Windows 11, 15.7 GB RAM). Every number below was measured
by `ops/scripts/adulis-storage-audit.ps1` or by the read-only commands named beside it; nothing is
estimated unless it says so. Policy: `docs/engineering/DEVELOPMENT-STORAGE-POLICY.md`.

## 1. Method

| Checkpoint | Local time (EAT) | Meaning |
|---|---|---|
| (session start) | 16:03 | quick reading before the branch was created: C: 21,265,227,776 bytes free |
| A | 16:14:41 | before development |
| B | 16:36:32 | after coding (code, tests, Maestro flows written), before the full gates |
| C | 18:02:21 | after every test: full gate battery, three native passes, post-review gates |
| D | 18:19:47 | after the safe cleanup |

- Sizes are apparent bytes; "GB" is 1024^3 bytes. Exact values are in the four JSON reports
  (agent scratch `s009a/checkpoint-{A,B,C,D}.json`, not committed).
- Host free space also moves with other software. Between the session-start reading and A, C:
  lost 183 MB with no Adulis activity, and a VS Code update was downloaded at 16:18 (273 MB in
  %TEMP% plus its installer).
- Rows added to the script during the work order: %TEMP% total and pip's leftovers (after B), the
  Windows page file (after C), and Maestro's `maestro-app*.apk` / `maestro-server*.apk` driver
  names (found after the first native pass: until then the script knew only WO-009's `tmp*.apk`,
  so A and B under-report that row; see section 7).

## 2. Disk capacity

| | C: free (bytes) | C: free | G: free (bytes) | G: free |
|---|---|---|---|---|
| A before development | 21,081,735,168 | 19.63 GB | 3,521,250,328,576 | 3,279.42 GB |
| B after development | 19,957,080,064 | 18.59 GB | 3,521,249,280,000 | 3,279.42 GB |
| C after testing | 7,271,710,720 | 6.77 GB | 3,521,194,754,048 | 3,279.37 GB |
| D after cleanup | 10,359,230,464 | 9.65 GB | 3,521,193,705,472 | 3,279.37 GB |

## 3. Growth and recovery

```
Development storage growth = usage at C - usage at A
  C:  21,081,735,168 - 7,271,710,720 = 13,810,024,448 bytes (12.86 GB)
  G:  3,521,250,328,576 - 3,521,194,754,048 = 55,574,528 bytes (53 MB)

Storage recovered = usage at C - usage at D
  C:  10,359,230,464 - 7,271,710,720 = 3,087,519,744 bytes (2.88 GB)
  G:  -1,048,576 bytes (nothing cleaned on G:)

Net change A -> D
  C:  10,722,504,704 bytes (9.99 GB) less free
  G:  56,623,104 bytes (54 MB) less free
```

By phase on C:: coding (A to B) used 1,124,655,104 bytes; testing (B to C) used 12,685,369,344.

## 4. Where the growth went (A to C)

Attributed to the configured Adulis locations (bytes):

| Location | A to C |
|---|---|
| Maestro driver APKs left by this work order's 33 Maestro runs (66 files: 33 x 11,736,545 + 33 x 884,731) | +416,502,108 |
| Agent scratch, this session (`%TEMP%\claude\...\scratchpad`): logs, Maestro output | +68,993,699 |
| Agent transcripts and memory (`%USERPROFILE%\.claude`) | +3,105,401 |
| `%USERPROFILE%\.maestro` (Maestro's own test output) | +2,412,923 |
| Jest cache | +2,252,477 |
| Repository (Git objects, `apps/mobile/dist`, console build) | +209,781 |
| Metro cache | +137,313 |
| npm, pnpm, Gradle, SDK, node_modules, the prototype | 0 |
| Docker data disk (`docker_data.vhdx`, not sparse: length = space on disk) | 0 |
| **Total attributed on C:** | **about 493.6 MB** |
| Android AVD on G: (emulator data) | +55,377,920 |

Not attributable to any configured Adulis location: about 13.3 GB of C: (about 1.1 GB in the coding
phase, where the VS Code update accounts for part, and about 12.2 GB in the test phase).

- The leading candidate is the Windows page file. It is system managed, and was 44,801,458,176
  bytes (41.72 GB) allocated at C and D (`Win32_PageFileUsage`: peak use 10,543 MB). Free RAM
  during the native runs was 0.9 to 1.2 GB of 15.7 GB (emulator, Metro, Maestro, Docker, Jest,
  the editor).
- This is not proven: A and B did not record the page file, no low-memory event was logged, and
  shadow-copy storage cannot be read without elevation, which was not used. The script now records
  the page file, so the next work order's checkpoints can attribute it.
- The rest of C: was not scanned (WO-009A S12).

Docker and WSL: `docker_data.vhdx` stayed 50,836,013,056 bytes from A to D, and `ext4.vhdx`
100,663,296. Inside Docker (`docker system df`), Local Volumes went from 2.777 GB to 2.773 GB;
Images (15.37 GB) and Build Cache (28.18 GB, 21.43 GB reclaimable) were unchanged. The three
rebuilds of the disposable database reused space already inside the virtual disk.

## 5. Main storage consumers (at D)

C:

| | Size | Class |
|---|---|---|
| Docker data disk | 47.34 GB | Protected (PostgreSQL and MinIO volumes, and other projects' containers) |
| Windows page file | 41.72 GB | system |
| pnpm store | 4.25 GB | Rebuildable (hard-linked into node_modules) |
| npm cache | 3.89 GB | Rebuildable |
| %TEMP% total | 3.88 GB | of which pip leftovers 2.08 GB, Jest 0.34 GB, agent scratch 0.29 GB |
| `%USERPROFILE%\.claude` | 0.89 GB | Protected |
| Adulis-MobileApp (incl. 0.78 GB node_modules) | 0.82 GB | Protected |
| `%USERPROFILE%\.expo` | 0.43 GB | Review |
| `C:\maestro`, `%USERPROFILE%\.android` | 0.34 GB, 0.23 GB | Protected |

G:

| | Size | Class |
|---|---|---|
| `G:\wo001a` (WO-001A build copy, superseded) | 11.31 GB | Review |
| Android SDK | 9.15 GB | Protected |
| Android AVDs | 6.80 GB | Protected |
| `G:\w2` (9 Nov build copy whose debug APK is reused) | 5.22 GB | Review (keep while reused) |
| `G:\adulis-claude-scratch-archive` | 3.62 GB | Protected (founder authorisation) |
| Gradle home | 3.23 GB | Rebuildable |

## 6. Cleanup performed

Dry run first, twice: the first identified 243 app APKs; identification was then widened to the
binary manifest (the companion APK declares `dev.mobile.maestro.test` in UTF-16), and the second
dry run identified 485. Then it was executed, after every test had finished and with no Maestro run
in progress; every file was re-checked as unlocked right before its delete.

| Removed | Files | Bytes |
|---|---|---|
| `%TEMP%\maestro-app*.apk` (Maestro app driver, all byte-identical, SHA-256 5EF8A8D0...) | 243 | 2,851,980,435 |
| `%TEMP%\maestro-server*.apk` (Maestro companion driver) | 242 | 214,104,902 |
| - of which left by this work order's runs | 66 | 416,502,108 |
| - of which left by earlier work orders (8 to 11 November) | 419 | 2,649,583,229 |
| This work order's Maestro test output (three native passes; scratch `s009a/maestro`) | | 68,528,230 |
| This work order's Metro logs (scratch) | 2 | 61,979 |
| **Total** | | **3,134,675,546** |

Kept as evidence: the 25 final screenshots (3,180,098 bytes), the checkpoint reports, the gate and
native summaries and the request-count log, all in the session scratch.

## 7. Protected files preserved

Untouched: both repositories (source, `.git`, node_modules), Docker and its volumes and virtual
disks (no `docker system prune`, no volume or builder prune), the PostgreSQL and MinIO data, the
Android SDK, AVDs and emulator, the Gradle home, the npm and pnpm caches, `G:\w2`, `G:\w2x`,
`G:\wo001a`, `G:\adulis-claude-scratch-archive`, `%USERPROFILE%\.claude`, `.expo`, `.android`,
`.maestro`, `C:\maestro`, every credential and `.env`, every personal folder, and every earlier
work order's scratch.

## 8. Left for a person (not deleted)

| Candidate | Size | Why not deleted |
|---|---|---|
| `%TEMP%\pip-unpack-*` (2,393 folders, created 7 and 8 November) | 2.08 GB (2,236,926,757 bytes) | pip leftovers; the owner is not provable |
| Docker build cache | 28.18 GB (21.43 GB reclaimable, inside the virtual disk) | other projects share this Docker; host space returns only after compacting the virtual disk |
| `G:\wo001a` | 11.31 GB | superseded build copy; G: is not short of space |
| An older agent session's scratch (`%TEMP%\claude\a462f086...`, 6 November) | 233 MB | another session's |
| Two truncated Maestro files (`maestro-app6173884435440529671.apk`, 0 bytes; `maestro-server12819324023461887881.apk`, 327,680 bytes) | 320 KB | not identifiable (likely written while C: was full in WO-009) |
| `%TEMP%\DockerDesktopUpdates`, VS Code update download | 313 MB, 273 MB | other software's |

## 9. Findings

1. Maestro writes a fresh copy of its driver to %TEMP% on every run, and never removes it. In
   WO-009A that was 12.6 MB per run (`maestro-app*.apk` + `maestro-server*.apk`); WO-009 moved
   27 `tmp*.apk` of about 120 MB off C:. 485 copies (2.86 GB) had built up since 8 November,
   unseen by the WO-009 cleanup because of the new names.
2. The artifacts a work order like this one creates are small: about 0.5 GB on C:, 85 percent of
   it Maestro driver copies, now cleaned.
3. The large movement on C: during testing is outside the Adulis paths, and the page file is the
   likely cause. That makes free RAM, not only disk, a storage risk on this machine.
4. C: ends at 9.65 GB free, below the policy's 10 GB floor for native batteries.

## 10. Recommended improvements

- End every work order with `-Clean -Execute` after its tests; it removes the driver copies.
- Run the audit at the start of each native session (its page-file row is the missing evidence).
- Founder decisions:
  - fix the page-file size or keep fewer memory-heavy applications open during test batteries
    (ON-20261111-110);
  - whether to delete the pip leftovers, `G:\wo001a` and the G: archive;
  - whether to prune this project's Docker builder cache and compact the virtual disk
    (ON-20261111-111). Never prune volumes.
- Free C: to at least 10 GB before the next native battery.

## 11. Storage report

```
Storage at start:          C: 21,081,735,168 bytes free (19.63 GB); G: 3,521,250,328,576 (3,279.42 GB)  [A]
Storage before cleanup:    C: 7,271,710,720 (6.77 GB); G: 3,521,194,754,048 (3,279.37 GB)  [C]
Storage after cleanup:     C: 10,359,230,464 (9.65 GB); G: 3,521,193,705,472 (3,279.37 GB)  [D]
Net storage growth:        C: 13,810,024,448 bytes used A to C (about 0.49 GB attributable to Adulis
                           artifacts; the rest unattributed, page file the likely cause);
                           10,722,504,704 net A to D. G: 55,574,528 A to C (emulator data).
Temporary artifacts generated: 66 Maestro driver APKs (416,502,108 bytes); Maestro test output
                           68,528,230; Jest +2,252,477; .maestro +2,412,923; Metro +137,313;
                           scratch logs and reports (kept, about 4.5 MB).
Temporary artifacts removed: 485 Maestro driver APKs (3,066,085,337 bytes, 419 of them from earlier
                           work orders); this work order's Maestro output and Metro logs (68,590,209).
Storage recovered:         C: 3,087,519,744 bytes (2.88 GB); G: none.
Protected files preserved: section 7 (no Docker prune, no volume, database, SDK, AVD, cache,
                           archive or repository deletion).
Remaining storage concerns: C: at 9.65 GB (below the 10 GB floor); about 13.3 GB of test-phase
                           growth unattributed (page file 41.72 GB allocated); Docker build cache
                           21.43 GB reclaimable; pip leftovers 2.08 GB; G:\wo001a 11.31 GB.
```
