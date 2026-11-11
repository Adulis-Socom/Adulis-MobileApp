# WO-010A -- Founder Handoff

Expo SDK stabilization, shared SSD caches and the category API amendment. 11-12 November 2026.

## Result

COMPLETE for the approved scope:
- **ON-117 resolved.** The nine Expo SDK 58 patch releases were installed with Expo's own workflow.
  Expo Doctor 1.21.6 passes 20/20 with no check suppressed. Modules with native code changed
  version, so the Android debug APK was rebuilt and all 31 native flows passed on it.
- **ON-118 resolved.** Jest, Metro and Node's compile cache are shared on the SSD. Warm runs are 4.1
  times (Jest) and 3.3 times (Metro export) faster, and a new work order reuses them.
- **ON-114 prepared.** Amendment A4 to ADU-API-01 for the category list and filters, as a
  **proposal**. It governs nothing until you approve it.
- **Gates.** Every automated gate is green, with one known parallel flake that passed when rerun
  alone (ON-126).

**iOS was not tested.** No Expo SDK 59 or other major upgrade, no runtime API change, no production
activation.

## Branch and commits

`mobile/wo-010a-dependency-environment-stabilization`, from
`9970feac9516ee7fed084d1aadc57d578b784be9` (the WO-010 HEAD, equal to origin). The pushed HEAD is in
the final report.

| Commit | Change |
|---|---|
| `b7e2b6a` | mobile: Expo SDK 58 patches, regenerated lockfile, two config plugins in `app.json` |
| `5a7f790` | dev: shared caches (`jest.config.js`, `metro.config.js`, SSD script, storage audit) |
| `28686e1` | docs(api): proposed amendment A4 (categories) |
| next | test: `buyer-shell.yaml` updated to the current Search and Shop (ON-125) |
| next | docs: storage policy, the three WO-010A records, the register |

## What to read

- `WO-010A-EXPO-DEPENDENCY-STABILIZATION.md`: the package table, the native rebuild, the 22-point
  regression, the gates.
- `../engineering/WO-010A-SHARED-SSD-CACHE.md`: the caches, cold/warm/new-context measurements,
  invalidation, defects found, the security review.
- `../amendments/ADU-API-01_A4_categories_PROPOSED.md`: the amendment to approve or change.

## Decisions and actions for the founder

1. **Approve, change or reject amendment A4** (ON-20261111-114). It records what WO-010 built:
   - the Market-scoped category list;
   - the Shop and Search `category` filters with category-bound cursors;
   - the Seller Product category check.

   On approval it is folded into the next ADU-API-01 revision. Sign the approval line in the file,
   or say what to change.
2. **Enable the launch categories in the Addis Ababa Market** (ON-115, unchanged). Run
   `ops/runbooks/activate-market.md` Step 6 with that Market's real code. The code was not guessed,
   and nothing was activated anywhere.
3. **Keep or drop Node's compile cache** (ON-124). On the exFAT SSD it holds 31 MB in 7,541 files,
   which take about 7.5 GB, and it leaks about 100 orphaned files per test run. Dropping it is one
   line in `ops/scripts/adulis-ssd-env.sh`, and it also removes the security review's LOW-1 (planted
   code-cache entries on an access-control-free drive). Either way, the SSD must stay attached to
   this machine only.
4. **Delete superseded native build copies when convenient** (ON-122). An agent cannot delete
   top-level G: folders. `G:\w10a` (with `G:\w10ax`) now holds the current APK: keep it while native
   dependencies are unchanged. These are superseded:
   - `G:\wo001a`: 11.3 GB apparent.
   - `G:\w2` and `G:\w2x`: the 9 November build, now stale (older native code).

   On exFAT each takes far more than its apparent size (1 MiB per file). `G:\w10a` alone takes at
   least 98 GB.
5. **Unchanged and still pending:**
   - ON-087, ON-088, ON-090, ON-091 (Collections policies);
   - ON-111 (storage candidates);
   - ON-116 (Seller store category);
   - ON-049 (category scope);
   - ON-079 and ON-080 (Search settings, analytics);
   - the payment architecture.

## Storage (checkpoints; C: and G: free space)

| Checkpoint | C: free | G: free |
|---|---|---|
| A, start | 17,078,161,408 B (15.91 GB) | 3,510,759,325,696 B (3,269.65 GB) |
| B, before cleanup | 16,508,252,160 B (15.37 GB) | 3,356,697,296,896 B (3,126.17 GB) |
| C, after cleanup | 16,577,970,176 B (15.44 GB) | 3,362,542,059,520 B (3,131.61 GB) |
| D, final | 16,575,483,904 B (15.44 GB) | 3,362,538,913,792 B (3,131.61 GB) |

GB here means 2^30 bytes, as the audit prints it.

- **C:** 0.47 GB less from A to D. The pnpm store grew by 87 MB for the new packages; the rest came
  from other software and is not attributed. The page file stayed at 38,826 MB, and Docker's disk
  was unchanged.
- **G:** 138.0 GB less. At least 98 GB of it is the native build copy `G:\w10a` (100,664 files at
  1 MiB or more each). About 15 GB is the shared caches, which other work orders reuse. The rest is
  Maestro evidence and logs.
- **Cleanup:**
  - 70 verified Maestro driver APKs (441,744,660 B) via the audit's `-Clean -Execute`.
  - From this work order's own TEMP: a byte-identical APK copy and the default-location
    Jest, Node, V8 and Playwright caches (131,568,087 B apparent).
  - Together they returned 5,844,762,624 B of G:.
  - The throwaway Test C context folder was removed after its logs were kept.
- **Kept as evidence:** `G:\AdulisDevelopment\WO-010A\logs` and `\maestro` (77 MB of screenshots
  and Maestro logs).
- **Protected and untouched:** `G:\Android\`, `G:\w2`, `G:\w2x`, `G:\wo001a`,
  `G:\adulis-claude-scratch-archive`, Docker volumes and virtual disks, the Android SDK and Android
  Studio. No system-wide variable was changed.

## Key findings

- **The old APK could not be trusted.** The patches moved expo-modules-core from 58.0.30 to 58.1.0
  and changed the version of eight other modules that carry native code, so the APK was rebuilt.
- **Native builds need a short real path on G:** (ON-122). A `subst` drive breaks React Native
  codegen, and a path under `G:\AdulisDevelopment` is too long for CMake.
- **Stale Maestro flow** (ON-125). `buyer-shell.yaml` still expected the pre-WO-007/008
  placeholders. It is fixed and passing.
- **Cold-cache timeouts** (ON-123). The first full mobile run on an empty cache can time out two
  boot tests on the USB drive. A rerun passes.
