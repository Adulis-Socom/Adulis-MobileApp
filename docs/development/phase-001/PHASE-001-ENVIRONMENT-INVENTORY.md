# PHASE-001 -- Environment inventory

13 November 2026, measured between 17:58 and 18:10 local time (UTC+3). Work Order D, read-only.
- **Nothing was started, stopped, deleted, pruned or reconfigured.**
- The one database query ran in a session with `default_transaction_read_only=on`.

Evidence:
- `evidence/docker-inventory.txt`, `evidence/devdb-identity.txt`, `evidence/environment-inventory.txt`;
- `evidence/storage-audit-start.json` and `.log`.

## 1. Machine

| | |
|---|---|
| RAM | 15.71 GB total; **0.56 GB free** at 17:59, **0.33 GB free** at 18:05 (storage audit) |
| Largest processes | `CrimsonDesert` (a game) 2,596 MB; the WSL/Docker VM 697 MB; VS Code about 780 MB across processes; ChatGPT 314 MB; Defender 299 MB; Claude 299 MB; Node 256 MB |
| Page file | `C:\pagefile.sys` 23,449 MB allocated (3,714 MB in use, peak 7,286 MB) |
| `.wslconfig` | absent (WSL2's default memory limit applies) |
| C: | 26,794,549,248 bytes free (24.95 GB), with 450.71 GB used |
| G: (external SSD, exFAT) | 3,352,586,878,976 bytes free |
| Docker data disk | `docker_data.vhdx` 53,882,126,336 bytes (it was 53,520,367,616 at 11:53 the same day) |

## 2. Docker

**Running containers (7):**

| Container | Image | Ports | Memory | Owner |
|---|---|---|---|---|
| `adulis-postgres` | `pgvector/pgvector:pg17` | 5434 -> 5432 | 43 MB | Adulis (live development) |
| `adulis-minio` | `minio/minio:latest` | 9100 -> 9000 | 186 MB | Adulis (live development) |
| `nac-trial-postgres-1` | `postgres:16-alpine` | 5433 | 31 MB | **Nehemiah Autism Center (protected)** |
| `nac-trial-redis-1` | `redis:7-alpine` | 6379 | 6 MB | protected |
| `nac-trial-minio-1` | `minio/minio:latest` | 9000-9001 | 130 MB | protected |
| `nac-trial-mailpit-1` | `axllent/mailpit:latest` | 1025, 8025 | 24 MB | protected |
| `nac-trial-pgadmin-1` | `dpage/pgadmin4:latest` | 5050 | 265 MB | protected |

**Stopped containers (6), untouched:**
- `adulis-final-check` (exited 255, two months ago);
- `adulis-minio-init` (exited 0);
- `nac-trial-minio-init-1`, `nac-trial-frontend-1`, `nac-trial-backend-1`;
- `welcome-to-docker`.

**Volumes:** 26 in all, 9 in use.
- **Named (7):**
  - `adulis-pgdata`: **holds the live MinIO data** despite its name;
  - `adulis-platform_adulis-pgdata`: the live PostgreSQL data;
  - five `nac-trial*` volumes.
- **Anonymous:** 19.

**Usage (`docker system df`):**

| | Size | Reclaimable |
|---|---|---|
| Images | 15.6 GB (23) | 8.38 GB |
| Local volumes | 2.77 GB | 1.49 GB |
| Build cache | 28.18 GB (211) | 21.43 GB |

## 3. Development database identity

| | |
|---|---|
| Server | `adulis-postgres`, PostgreSQL 17.11 |
| Databases | `adulis`, `adulis_gates`, `postgres` |
| `adulis` | 25 MB; **no disposable mark** (`shobj_description` empty), so every test guard refuses to write to it |
| Migration tables | `public.pgmigrations`, `jobs.migrations` |
| Known state | at migration 0053, with foreign-key orphans awaiting the approved repair (WO-INFRA-013, BLOCKED) |

## 4. Repositories and worktrees

| Location | Branch / HEAD | State |
|---|---|---|
| `C:\Users\naods\Documents\Work\adulis-platform` | `ci/scope-filter-main-push` `810fb27` | **uncommitted MOB-WO-0 work** (now preserved), 1 stash, a stale prunable worktree record (`wt-am`); its remote refs date from 7 September |
| Workspace clone `...\Adulis-Mobile-Workspace\Adulis-MobileApp` | `infra/wo-infra-010-014-closure` `341d579` | clean; no extra worktree |
| Prototype `...\Adulis-Mobile-Workspace\AdulisCommercePlatformPrototype` | `dev` `f448d06` | clean; read-only |

## 5. Backups and preserved data (on G:)

| Path | Files | Bytes | Content |
|---|---|---|---|
| `G:\AdulisDevelopment\WO-INFRA\backup` | 6 | 163,416,963 | the first batch's recovery points |
| `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\backup` | 2 | 62,259,811 | including the old MinIO image archive |
| `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\legacy-db` | 20 | 860,115 | the legacy-database snapshot and row counts |
| `G:\AdulisDevelopment\WO-INFRA-CLOSURE\backup` | 3 | 724,518 | the development-database recovery point before the planned repair |
| `G:\AdulisDevelopment\PHASE-001\evidence\work-checkout-stash-22d209f.bundle` | 1 | 3,914,876 | PHASE-001's offline copy of the Work checkout's stash |
| GitHub `backup/mob-wo-0-preservation-2026-11-13` | -- | -- | PHASE-001's preservation branch |
| GitHub `backup/tier2-before-merge` | -- | -- | an older backup |

## 6. Environment configuration (names only; no file was opened)

| Checkout | Files |
|---|---|
| Work checkout | `.env`, `.env.example` |
| Workspace clone | `.env`, `.env.example`, `apps/mobile/.env.example` |

**Rules for both `.env` files:** never committed, never printed, never modified.

## 7. Protected resources (never delete, reset or reconfigure without the founder)

1. `adulis-postgres` and its volume `adulis-platform_adulis-pgdata`, including the `adulis` database.
2. `adulis-minio` and its volume **`adulis-pgdata`** (the MinIO data).
3. The whole `nac-trial-*` stack and its volumes, which belong to the Nehemiah Autism Center.
4. Every backup in section 5, and the GitHub backup branches.
5. The Work checkout and its uncommitted files, stash and `.env`.
6. Both `.env` files.
7. The Android AVD (`Adulis_Pixel_8a_API_37`, 7.37 GB), the Android SDK on `G:\Android\SDK`, and the
   Gradle home on G:.
8. The native build copies `G:\w10a` and `G:\w2` (5.2 GB each), whose debug APKs are reused while the
   native dependencies are unchanged.
9. The anonymous Docker volumes. They may belong to other projects, so no volume prune.

## 8. Android readiness for WO-019

| Requirement | State |
|---|---|
| Android SDK, `adb`, emulator | present (`G:\Android\SDK`; `ANDROID_HOME` set) |
| AVD | `Adulis_Pixel_8a_API_37` exists; no emulator running |
| JDK | Temurin 17.0.20 |
| Maestro, agent-device | installed (`C:\maestro\bin\maestro`, the npm `agent-device`) |
| Native build copy | `G:\w10a` (SDK 58 patches) and `G:\w2` present. The APK inside was not re-located by this read-only pass |
| **Free memory** | **0.33 to 0.56 GB. The emulator needs 2 to 4 GB.** |
| C: headroom | 24.95 GB free. The emulator holds about 10 GB of C: in system TEMP while running, and Maestro leaves driver APKs |

**Verdict: NOT READY.** The tooling is in place; the memory is not.

**Before WO-019 (for the founder, nothing done here):**
1. Close the game (`CrimsonDesert`, 2.6 GB).
2. Stop, not remove, the `nac-trial` stack if it is not needed that day. Stopping deletes nothing.
3. Optionally add a `.wslconfig` memory limit for Docker.
4. Optionally run `docker builder prune` (reclaims about 21 GB of build cache only), then compact the
   Docker disk to return the space to C:.
5. Never run `docker system prune --volumes` or a volume prune.

## 9. Storage audit

- **When:** taken at 18:05, after the preservation and the read-only audits. It should have run at the
  very start (PHASE-001-ISS-17).
- **Free space:** C: 26,794,549,248 bytes; G: 3,352,586,878,976 bytes.
- **Cleanup:** none performed. PHASE-001 created only its evidence folder (about 4.2 MB, most of it
  the stash bundle) and two temporary index files inside it.
