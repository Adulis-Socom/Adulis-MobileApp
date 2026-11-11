# WO-010A -- Shared development caches on the external SSD (ON-20261111-118)

Work order WO-010A, Workstream B. Engineering record for the development machine; it governs no
product behaviour. The rules are in `docs/engineering/DEVELOPMENT-STORAGE-POLICY.md` section 2b.

## 1. What changed

| Cache | Shared location | Mechanism (tool-supported) |
|---|---|---|
| Jest transform cache | `G:\AdulisDevelopment\shared-cache\jest` | `cacheDirectory` in `apps/mobile/jest.config.js`, from `ADULIS_JEST_CACHE`; Jest has no environment variable of its own, its default is `os.tmpdir()/jest` |
| Metro transform cache, file map | `G:\AdulisDevelopment\shared-cache\metro\{transform,file-map}` | `cacheStores` (Expo's `FileStore`) and `fileMapCacheDirectory` in `apps/mobile/metro.config.js`, from `ADULIS_METRO_CACHE` |
| Node compile cache | `G:\AdulisDevelopment\shared-cache\node` | `NODE_COMPILE_CACHE`, Node's own variable |

- `ops/scripts/adulis-ssd-env.sh` exports the three variables with TEMP, TMP and TMPDIR (per work
  order) for the sourcing shell only. It checks the volume label and writes a probe first, refuses
  a work-order argument that is not `WO-...`, and never falls back to C:.
- `apps/mobile/jest.config.js` is the former `package.json` "jest" key, unchanged.
  `apps/mobile/metro.config.js` is Expo's default configuration. With the variables unset (CI,
  another machine) both behave exactly as before.
- Per work order, unchanged: `temp` (test temp files, Maestro driver APKs, the emulator's temp),
  `scratch`, `logs`, `maestro`, `build`. The per-work-order `cache` folder is no longer created.
- `ops/scripts/adulis-storage-audit.ps1` classes everything under `shared-cache` as Rebuildable.
  Its `-Clean -Execute` still removes only verified Maestro driver APKs.

## 2. Measurements

Workload per test: the mobile suite (`pnpm test`: locale-import guard, then Jest, 291 tests) and
`pnpm build` (`expo export`, Metro, Android and iOS bundles), run back to back in a shell that
sourced the script. Nothing else wrote to the SSD (no Gradle, no emulator). Script:
`G:\AdulisDevelopment\WO-010A\scratch\cache-test.sh`; logs in `G:\AdulisDevelopment\WO-010A\logs\cache-test`.

| | Test A, cold (WO-010A) | Test B, warm (WO-010A) | Test C, new context (WO-010A-CTX) |
|---|---|---|---|
| Jest suite | 177.9 s, 289/291 (see 3.1) | 43.4 s, 291/291 | 43.5 s, 291/291 |
| expo export | 99.8 s | 30.0 s | 30.3 s |
| Jest cache after | 2,774 files, 27,344,470 B | 2,774 files, 27,345,149 B | 2,774 files, unchanged |
| Metro cache after | 2,776 files, 22,402,390 B | 2,776 files, unchanged | 2,776 files, unchanged |
| Node cache after | 2,375 files, 8,486,892 B | 2,480 files, 8,682,540 B | 2,578 files, 8,863,172 B |
| G: free, change | -8,859,418,624 B | -112,197,632 B | -109,051,904 B |
| C: free, change | -148,791,296 B | -1,740,800 B | -647,168 B |
| Files in the context's own TEMP | (shared with the native build) | +2 | 2 |

- **Speed.** Warm against cold: Jest 4.1 times faster, the export 3.3 times faster.
- **Reuse across work orders (Test C).** A fresh work-order context (its own TEMP, logs and Maestro
  folders) ran at warm speed. It added no Jest or Metro entry, and its TEMP received two files.
- **SSD cost.** The cold run's 58 MB of apparent cache took 8.86 GB of G:, because exFAT allocates
  1 MiB per file (7,925 files). Before WO-010A every work order paid this again in its own TEMP:
  WO-010's Jest cache alone was 3,201 files, about 3.2 GB. It is now paid once, and again only for
  entries a dependency change invalidates.
- **C: in Test A** fell by 148.8 MB. About 7 MB is the export's own output (`apps/mobile/dist` is on
  C:). The rest came from processes outside the measured workload and is not attributed. Tests B
  and C moved C: by under 2 MB.

**Invalidation (Test C).** A throwaway, untracked test, `src/wo010a-cache-probe.test.ts`, asserted
`expect(1).toBe(1)` (pass) and was then rewritten to `expect(1).toBe(2)`. A stale transform cache
would have reused version 1 and passed again. The second run failed (exit 1), and the Jest cache
grew 2,774 -> 2,776 -> 2,778: a content change writes a new entry and is never served stale. The
probe file was deleted. Jest also keys entries by its version, transformer and configuration, and
Metro by its transformer, Babel configuration and version, so a dependency upgrade writes new
entries.

## 3. Defects found

### 3.1 Cold-cache timeouts in two boot tests (ON-20261111-123)

In Test A two tests in `src/auth/session.test.tsx` ("root providers") exceeded Jest's 5 s test
timeout: the file took 62 s. React Native and Expo load many internals lazily on first access, so
on a cold cache those modules are transformed during the first tests. In Test A that happened in
four parallel workers at once on the USB exFAT drive. Run alone against an empty cache, the same
file passed 8/8 in 24 s, and every warm run passed 291/291. No test was changed. Expect it on the
first full run after a dependency change; a rerun, or `--maxWorkers=2`, passes.

### 3.2 Orphaned Node compile-cache temp files (ON-20261111-124)

After the tests, 701 of the 3,225 files in `shared-cache\node` were orphaned temporary files named
`<8 hex>.<6 characters>`. After the native battery (Metro's development server and its workers) the
folder held 7,541 files, 6,789 entries and 752 orphans, for 31 MB apparent and about 7.5 GB of G:. Node writes each entry through a temporary file and a rename. When
several Jest workers flush the same entry at once, the Windows rename fails and the temporary file
stays. That is about 100 files per full suite run, about 100 MB of G: on exFAT, and it is
unbounded. A direct single-process Jest run and `expo export` added none. The cache is
rebuildable: clear `shared-cache\node` when no Node process is running. Whether to keep
`NODE_COMPILE_CACHE` (requested by the work order, benefit not separately measured) is a founder
decision; dropping it is one line in the script.

### 3.3 Only the mobile Jest cache is shared (ON-20261111-128)

`apps/api` and `packages/*` Jest runs still use Jest's default cache in the work order's TEMP: the
gates left 3,124 files (38.9 MB apparent, about 3 GB of G:) in `WO-010A\temp\jest`, removed at
cleanup. Their configuration is outside this work order's write boundary: `apps/api` belongs to
the backend workstream, and a `packages/*` change needs its own PR. The same `cacheDirectory` line
there would share it.

## 4. Security (independent review)

No Critical, High or Medium finding.

- **LOW, fixed.** The Metro override used Metro's plain store. It now uses Expo's `FileStore`,
  which honours Expo's skip-cache entries; Expo's CLI still wraps it so `EXPO_PUBLIC_*` values stay
  part of the key.
- **LOW, documented.** exFAT has no access control, and V8 trusts compile-cache entries, so
  whoever can write the SSD could plant code that runs in a Node process started from a sourced
  shell. The policy now treats the SSD as a trusted device that never leaves this machine.
- **INFO, fixed.** The work-order argument is validated.
- **INFO, corrected.** The policy no longer claims the caches hold no environment values: Metro's
  export entries contain the public `EXPO_PUBLIC_*` values.
