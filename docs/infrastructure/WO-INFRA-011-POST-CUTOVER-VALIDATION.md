# WO-INFRA-011 -- Post-cutover validation

**NOT PERFORMED.** No live cutover took place (BLOCKED pending founder approval). This page is the
checklist for the run after approval. It is not evidence of one.

| # | Check | How | The script does it |
|---|---|---|---|
| 1 | The correct MinIO volume is mounted | `docker inspect adulis-minio --format '{{range .Mounts}}{{.Name}}{{end}}'` gives `adulis-platform_adulis-miniodata` | yes, and refuses otherwise |
| 2 | Existing media accessible | anonymous read of a media object through port 9100 returns the same bytes | yes (probe `read-media`, SHA-256 compared) |
| 3 | Evidence bucket private | `curl -s -o /dev/null -w '%{http_code}' http://localhost:9100/adulis-evidence/` gives 403 | yes (list, read and write denied) |
| 4 | Anonymous media listing denied | `curl -s -o /dev/null -w '%{http_code}' http://localhost:9100/adulis-media/` gives 403 | yes (probe `list-media` DENIED; policy `GetObject` only) |
| 5 | Upload works | start the API, upload a product image in the console; it lands in `adulis-media` | **no: by hand** |
| 6 | Object retrieval | open that product in the console or the app | **no: by hand** |
| 7 | Lifecycle policy | `evidence/raw/` 1-day expiry present, same rule set as the source | yes |
| 8 | Stable container health | `docker inspect adulis-minio --format '{{.State.Health.Status}}'` gives `healthy` after 5 min | the init waits for healthy |
| 9 | Application integration | API boots against `R2_ACCOUNT_ID=http://localhost:9100`; the console's media pages load | **no: by hand** |
| 10 | Original volume preserved | `docker volume inspect adulis-pgdata` exists; the script's last check compares its tar stream with the backup | yes |

**Record:** before counts (the preflight's 1,568 / 7); after counts (the `MIGRATED:` line and
`manifest.json`); and the backup folder.
