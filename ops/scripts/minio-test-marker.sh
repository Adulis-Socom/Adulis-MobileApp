#!/bin/sh
# Marks a THROWAWAY MinIO as disposable test storage (WO-INFRA-015B). The test tooling writes objects
# only to a store serving this marker (ops/scripts/lib/disposable-storage.mjs). Run ONLY by
# ops/scripts/test-db.sh and CI's object-storage step, after minio-init.sh. Never by compose, never
# against a store you keep: marking one would let the suites write into it.
#
# Env: MINIO_URL, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD (all required).
# The bucket, key and body must stay identical to STORAGE_MARKER in lib/disposable-storage.mjs.
set -eu

mc alias set marker "${MINIO_URL:?}" "${MINIO_ROOT_USER:?}" "${MINIO_ROOT_PASSWORD:?}" >/dev/null
mc mb --ignore-existing marker/adulis-test-marker >/dev/null
printf 'adulis:disposable-test-storage' | mc pipe marker/adulis-test-marker/disposable >/dev/null
# Anonymous GET of the one marker object, nothing else (no listing).
policy=/tmp/adulis-test-marker-read.json
cat > "$policy" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::adulis-test-marker/disposable"]}]}
JSON
mc anonymous set-json "$policy" marker/adulis-test-marker >/dev/null
echo 'minio-test-marker: this store is marked as disposable test storage'
