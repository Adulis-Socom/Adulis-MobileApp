# RBL-02 -- Replacement database target and data policy

Status: governance record (RB25-D02). The replacement target is prepared EMPTY; its schema is created in
ARC-BE-03. The legacy database is preserved and never pointed at replacement migrations.

## 1. The replacement target (prepared 25 November 2026)
`ops/rebuild/disposable-db.sh` (up / fingerprint / env / stop / start / down).

| Property | Value |
|---|---|
| container | `adulis-rebuild-pg-20261125`, labels `com.adulis.lineage=rebuild-20261125`, `com.adulis.disposable=true`, memory capped at 256 MB |
| volume | `adulis-rebuild-pgdata-20261125` (same labels) |
| binding | `127.0.0.1:55440` only (not the legacy 5434, not the unrelated project's 5433/6379/9000) |
| database | `adulis_rebuild`, identity stamped as a database COMMENT (no table is created for it) |
| image | `pgvector/pgvector:pg17` (PostgreSQL 17.11, already present locally; no download) |
| credentials | local-only and fake (`.env.example` rule): not a secret, bound to loopback |
| state | created, verified, then STOPPED (data kept); `start` before ARC-BE-03 |

Fingerprint at creation: 0 user tables, no `pgmigrations`, no `core` schema, identity comment present.
Guard proof: the script refuses the legacy port 5434 (exit 2), refuses a same-named container without the
rebuild labels, and `down` refuses unless both container and volume carry the disposable label.
Isolation proof: the legacy database's read-only fingerprint (62 migrations, 5 Orders, 5 Reservations,
8 accounts) is identical before and after the target was created.

## 2. The legacy database (preserved)
`adulis-postgres` (host 5434; volumes `adulis-pgdata`, `adulis-platform_adulis-pgdata`): 62 migrations
(0063 NOT applied), 8 accounts of which 5 are non-seed, 5 Orders, 5 Reservations with 4 ACTIVE stock holds;
no disposable mark. It is NOT disposable. No reset, no migration, no row deletion, no copy into seeds.

## 3. Export and restore options (documented, NOT executed; each needs the owner's named approval)
| Option | Steps | Notes |
|---|---|---|
| A. Keep as is (default) | nothing | the replacement never needs it |
| B. Full logical backup | `pg_dump -Fc` of `adulis` to an encrypted location the owner chooses, SHA256 recorded; restore test into a NEW disposable container; row counts compared | a backup copies personal data; it is not written to the shared SSD evidence folder without approval |
| C. Retire after backup | B, then a TESTED restore, then owner disposition of the five non-seed accounts and their media, then removal | only on explicit approval; never inferred from this plan |
Whatever is chosen, no legacy row is imported into the replacement lineage's seeds; seeds are synthetic.

## 4. Object-store mapping
| Store | Holds | Replacement |
|---|---|---|
| legacy `adulis-minio` (host 9100), buckets `adulis-media`, `adulis-evidence` | legacy product media and payment evidence | untouched; payment evidence is a retired subject (RB25-D03) and is never migrated |
| replacement | a separate disposable object store and bucket namespace, created with the media domain (ARC-BE-01 / SC-BE-04) | no legacy object keys copied; media re-uploaded by the owner if ever needed |

## 5. Data ownership inventory
Legacy data: owned by the founder (development environment). Replacement data: per-domain owner modules in
the single API (GOV-07 section 2); synthetic seeds only. Anything personal follows PRV-01 and the DPIA.
