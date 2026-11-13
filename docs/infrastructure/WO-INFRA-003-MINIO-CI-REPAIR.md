# WO-INFRA-003 -- MinIO and CI provisioning repair

**Status: COMPLETE.** 13 November 2026.

## 1. Work order
WO-INFRA-003, MinIO and CI provisioning repair.

## 2. Objective
Restore reliable object storage in local development and CI, with a reproducible image.

## 3. Investigations performed
- Registry availability of the old images and the candidates (`WO-INFRA-003-IMAGE-VERIFICATION.md`).
- The old init commands, in compose and in CI.
- Policy and lifecycle state on the live MinIO.
- A disposable run of the chosen image.

## 4. Confirmed findings
- The community MinIO images are gone from Docker Hub (404) and quay.io (401) (ISSUE-INFRA-002).
- Both init copies ended in `|| true` or `|| mc ilm rule ls`, so setup could "pass" without buckets or
  policies (ISSUE-INFRA-008).
- `mc ilm rule add` is not idempotent: three identical rules exist live (ISSUE-INFRA-007).
- The chosen image has no `grep`. The first draft of the init used `grep` and failed open. Found by the
  validation run and fixed with a shell `case` (ISSUE-INFRA-014).
- The `download` policy also allows anonymous LIST. That is pre-existing, local only, and left unchanged
  (ISSUE-INFRA-013).

## 5. Root causes
- **ISSUE-INFRA-002:** MinIO stopped publishing community images, and the tags were never pinned.
- **ISSUE-INFRA-007 and 008:** shell precedence (`a && b || c`), and an unconditional add.

## 6. Files inspected
`docker-compose.yml`, `.github/workflows/ci.yml`, `ops/scripts/verify-console-e2e.mjs` (it refuses to
run without real storage).

## 7. Files modified
- **`docker-compose.yml`:**
  - one pinned image (`x-minio-image`) for both `minio` and `minio-init`;
  - `minio-init` runs the shared script with environment variables.
- **`.github/workflows/ci.yml`:** `MINIO_IMAGE` pinned to the same digest; the init runs the shared script.
- **`ops/scripts/minio-init.sh` (new), with `set -eu`:**
  - media bucket `download`;
  - evidence bucket set `private` on every run;
  - the `evidence/raw/` rule added only when missing.

## 8. Verification commands
- `validate-minio-image.sh` (disposable);
- the compose validation and the migration rehearsal (WO-INFRA-002);
- CI runs 43320430973 and 43321921280.

## 9. Actual results
- **Disposable image validation:** 22 of 22 checks pass.
  - Version and non-root user.
  - Init twice, leaving exactly one lifecycle rule.
  - Media `download`, evidence `private`.
  - Authenticated evidence read.
  - Anonymous GET: media 200, evidence 403. Anonymous LIST evidence 403. Anonymous PUT 403.
  - CORS preflight: the console origin is allowed; a foreign origin gets no header.
  - Data survives restart and recreate.
  - The init exits non-zero when MinIO is unreachable.
- **CI run 43320430973 (`bbbadac`):** "Start object storage and create the two buckets" **succeeded**, the
  first success since 2026-11-08, and the gates ran: 01 to 10 green.
- **Local `console-e2e`** (real browser, presigned PUTs to the new image): PASS.

## 10. Security assessment
- **Evidence bucket:** private, now enforced on every init rather than only by default.
- **Image:** runs non-root; it was root before.
- **Credentials:** none added; the same documented local fakes as before.
- **Supply chain:** the pin is a digest, so a moving tag cannot change what runs. The signature was not
  verified (no `cosign`; recommended).

## 11. Regression assessment
- **Bucket behaviour:** unchanged. The same two buckets, the same policies, the same CORS variable.
- **Server version:** goes from 2025-09-07 to 2026-11-12. The rehearsal showed it reads the old data.
- **Init:** now fails loudly where it used to pass silently. That is intended.

## 12. Issues encountered
ISSUE-INFRA-002, 007, 008, 013, 014.

## 13. Issues resolved
ISSUE-INFRA-002, 007, 008, 014.

## 14. Issues remaining
- **ISSUE-INFRA-013:** DEFERRED, optional.
- **Risk R-05:** the digest's lifetime on Chainguard's free tier.

## 15. Founder decisions required
Review the image vendor choice: Chainguard, or the `pgsty/minio` fork as the fallback. Not blocking.

## 16. Commit SHA
`3b9bbc6`

## 17. Final status
**COMPLETE.** The image is identified, pinned and verified; the configuration is updated; provisioning is
verified in CI.
