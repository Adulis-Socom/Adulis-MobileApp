#!/bin/sh
# Creates the two buckets and their policies, then exits. ONE SCRIPT, TWO CALLERS:
# docker-compose.yml's `minio-init` service and CI's object-storage step. It used to be two
# inline copies, and both carried the same two defects (WO-INFRA-003):
#   - they ended in `|| true` / `|| mc ilm rule ls`, so a failed alias, bucket or policy step
#     still passed and the failure surfaced later as an unrelated test error (ISSUE-INFRA-008);
#   - `mc ilm rule add` appended one more identical rule on every run (ISSUE-INFRA-007).
#
# TWO BUCKETS, NOT TWO PREFIXES (T19 S3.1 ruling): evidence/raw/ holds a PLAINTEXT bank
# screenshot for the window between upload and the commit that encrypts-and-deletes it, so the
# public-read policy attaches to the media bucket ONLY. The evidence bucket is set private on
# every run, not merely left at the default. The 1-day expiry on evidence/raw/ is the BACKSTOP
# for a commit that died between fetch and delete; S3 lifecycle cannot express hours.
#
# Env: MINIO_URL (default http://minio:9000), MINIO_ROOT_USER, MINIO_ROOT_PASSWORD (required).
set -eu

mc alias set local "${MINIO_URL:-http://minio:9000}" "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}"
mc mb --ignore-existing local/adulis-media
mc mb --ignore-existing local/adulis-evidence
mc anonymous set download local/adulis-media
mc anonymous set none local/adulis-evidence

# A shell pattern, not grep: the MinIO image ships mc and a shell but no grep. `export` fails
# when the bucket has no lifecycle configuration yet, which simply means "add the rule".
rules=$(mc ilm rule export local/adulis-evidence 2>/dev/null || true)
case "$rules" in
  *'"evidence/raw/"'*) echo 'evidence/raw/ expiry rule already present' ;;
  *) mc ilm rule add local/adulis-evidence --prefix 'evidence/raw/' --expire-days 1 ;;
esac
