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
# Anonymous READ of single media objects, nothing else (WO-INFRA-009, ISSUE-INFRA-013). Media URLs
# are public by design, but the canned `download` policy also grants ListBucket: anyone who could
# reach the port (Docker publishes on every interface) could enumerate every key, including the
# images of unpublished products. Cloudflare R2 does not list either.
policy=/tmp/adulis-media-read.json
cat > "$policy" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::adulis-media/*"]}]}
JSON
mc anonymous set-json "$policy" local/adulis-media
mc anonymous set none local/adulis-evidence

# Shell patterns, not grep: the MinIO image ships mc and a shell but no grep. "does not exist"
# means no lifecycle configuration yet; any other export failure stops the init instead of being
# read as "no rule" (which would add a duplicate).
if ! rules=$(mc ilm rule export local/adulis-evidence 2>&1); then
  case "$rules" in
    *'lifecycle configuration does not exist'*) rules='' ;;
    *) echo "$rules" >&2; exit 1 ;;
  esac
fi
# shortcut: matches mc's export JSON text (enabled rule on the prefix, a 1-day expiry somewhere);
# a hand-made second rule could satisfy it. Parse the JSON if rules are ever edited by hand.
case "$rules" in
  *'"Days":1}'*'"Prefix":"evidence/raw/"},"Status":"Enabled"'*) echo 'evidence/raw/ 1-day expiry rule already present' ;;
  *) mc ilm rule add local/adulis-evidence --prefix 'evidence/raw/' --expire-days 1 ;;
esac
