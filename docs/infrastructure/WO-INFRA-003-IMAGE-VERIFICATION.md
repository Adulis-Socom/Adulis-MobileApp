# WO-INFRA-003 -- Image verification

13 November 2026. Every check was a registry manifest lookup (`docker buildx imagetools inspect`), a
registry API call, or a run of an image pulled by digest. Raw output: `G:\AdulisDevelopment\WO-INFRA\
logs\image-availability.txt`, `minio-image-validation.log`.

## 1. The images that broke

| Reference | Result (2026-11-12T22:13Z) |
|---|---|
| `docker.io/minio/minio:latest` and `:RELEASE.2025-09-07T16-13-09Z` | pull access denied (repository not found) |
| `docker.io/minio/mc:latest` and `:RELEASE.2025-08-13T08-35-41Z` | pull access denied |
| `quay.io/minio/minio:latest` and `:RELEASE...` | 401 Unauthorized |
| `quay.io/minio/mc:latest` and `:RELEASE...` | 401 Unauthorized |
| `hub.docker.com/v2/repositories/minio/minio/` | HTTP 404 |
| `quay.io/api/v1/repository/minio/minio` | HTTP 401 |
| Controls: `library/alpine:3.20`, `pgvector/pgvector:pg17`, `quay.io/prometheus/prometheus` | resolve |

**Conclusion:** the MinIO community images are not anonymously available from either registry. That is
a vendor change, not a local problem. This machine still has `minio/minio:latest` cached
(`sha256:14cea493...`, RELEASE.2025-09-07T16-13-09Z), which is why local development kept working while
CI failed.

## 2. Candidates

| Image | Available | Maintained | Fit |
|---|---|---|---|
| `cgr.dev/chainguard/minio` | yes, `latest` and `latest-dev` only on the free tier | rebuilt daily (2026-11-12) | **chosen** |
| `cgr.dev/chainguard/minio-client` | yes | daily | not needed: the server image ships `mc` |
| `docker.io/pgsty/minio` | yes, version tags (RELEASE.2026-08-04T00-00-00Z) | a community fork, single maintainer, last build 2026-08-04 | fallback |
| `docker.io/bitnamilegacy/minio` | yes | frozen (2025.5.24), unmaintained, older than the live data | rejected |
| `docker.io/bitnami/minio` | not found | - | rejected |

## 3. The chosen image

| Property | Value | How verified |
|---|---|---|
| Reference | `cgr.dev/chainguard/minio@sha256:786cb11d340b1a657de8dc899560e36e1d1fb371d3d6f3eb6c903a0bb0cec714` | manifest lookup; pulled by digest |
| MinIO version | RELEASE.2026-11-12T01-15-23Z (go1.27.4) | `minio --version` in the image |
| Architectures | linux/amd64, linux/arm64 | manifest list |
| Source / licence | Chainguard build of MinIO, AGPLv3 (as before) | image labels, `--version` |
| User | 65532 (non-root) | `id -u` in a running container |
| Includes | `/usr/bin/minio`, `/usr/bin/mc`, bash, coreutils; **no grep, curl, wget or tar** | `command -v` in the image |
| `/data` | present, mode 777, so a new named volume is writable by the non-root user | `ls -ld /data` |
| Healthcheck | `mc ready local` works unchanged | disposable container reached `healthy` |
| Size | 236 MB (`mc` is 84 MB of it) | `docker image inspect` |

**`mc` in this image** reports `DEVELOPMENT.GOGET`, an unversioned build. It worked for every command the
init and the runbook use: `alias`, `mb`, `anonymous`, `ilm rule add|export`, `mirror`, `diff`, `stat`,
`cat`, `pipe`, `ready`.

## 4. Data compatibility
The new server read the 2025-09-07 server's data unchanged when it was served a copy (WO-INFRA-002
rehearsal), and it wrote and read its own data across restart and recreate.

## 5. Not verified
- **Image signatures.** Chainguard signs its images with Sigstore, but `cosign` is not installed here,
  and adding a tool was out of scope. Recommended before the merge:
  `cosign verify cgr.dev/chainguard/minio@sha256:786c... --certificate-oidc-issuer=https://token.actions.githubusercontent.com --certificate-identity-regexp='https://github.com/chainguard-images/.*'`
- **How long Chainguard keeps old digests pullable on the free tier.** If the pin stops resolving, CI
  fails loudly at its first step (risk R-05).

## 6. Updating the pin
1. `docker buildx imagetools inspect cgr.dev/chainguard/minio:latest` gives the new digest.
2. Replace it in `docker-compose.yml` (`x-minio-image`) and `.github/workflows/ci.yml` (`MINIO_IMAGE`), in
   one commit.
3. Re-run `validate-minio-image.sh`, or let CI's object-storage step and `console-e2e` prove it.
