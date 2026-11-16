# WO-INFRA-009 -- Container supply-chain review (MinIO image)

13 November 2026.
- **Image:** `cgr.dev/chainguard/minio@sha256:786cb11d340b1a657de8dc899560e36e1d1fb371d3d6f3eb6c903a0bb0cec714`.
- **Tools, run as containers** (nothing installed on the host):
  - `cgr.dev/chainguard/cosign` v3.1.4, digest `sha256:22aef199...`;
  - `cgr.dev/chainguard/grype` v0.121.3, digest `sha256:3694d1bb...`.
- **Logs:** `G:\AdulisDevelopment\WO-INFRA-FOLLOWUP\logs\supply-chain-*.log`.
- **Attestation payloads:** `...\scratch\att-*.json`.

**Digest pinning and signature verification are different things.**
- **The pin** (since WO-INFRA-003) guarantees that compose and CI always run these exact bytes.
- **The signature** proves who built those bytes.
- Both now hold.

## Findings

| Question | Result | Evidence |
|---|---|---|
| Digest | An OCI image index: `linux/amd64` (`sha256:dc988e27...`) and `linux/arm64` (`sha256:0a3abe71...`) | `docker manifest inspect` |
| Signature | **Verified.** One keyless Sigstore signature: cosign checked the claims, the Rekor transparency-log inclusion (offline bundle), and the Fulcio certificate chain | `cosign verify` exit 0 |
| Signer | `https://github.com/chainguard-images/images/.github/workflows/release.yaml@refs/heads/main`, issuer `https://token.actions.githubusercontent.com`: Chainguard's documented release workflow. The strict verify with exactly this identity and issuer passes | `supply-chain-verify-strict.log` |
| Negative control | The same verify with a wrong identity **fails** (exit 12, "none of the expected identities matched") | the same log |
| Attestations | Three, all signed by the same identity: SPDX SBOM (verified), SLSA provenance v1 (verified; builder `https://github.com/chainguard-dev/terraform-provider-apko`, build type `https://apko.dev/slsa-build-type@v1`), and the apko image configuration. **No vulnerability attestation is published** | `cosign tree`, `verify-attestation` |
| What is inside (amd64 SBOM, 470 entries) | `minio` RELEASE.2026-11-12T01-15-23Z, built from **`github.com/chainguard-forks/minio`** (Chainguard's fork); `mc` RELEASE.2025-08-13 (upstream, the last community release); Wolfi base with glibc 2.44, bash 5.3, coreutils 9.12, OpenSSL 4.0 libcrypto, CA bundle 2026-10-20 | `att-sbom-amd64.json` |
| Vulnerabilities | **0 known** (Grype, database built 2026-11-13T00:21Z, distribution detected as Wolfi, 0 ignored matches). Control: the same scanner on `alpine:3.10` reports 135 (12 critical), so it does find vulnerabilities | `supply-chain-grype.log` |
| Licences | `minio` and `mc`: **AGPL-3.0-or-later**; base packages: GPL, LGPL, MIT, Apache-2.0, MPL-2.0 and BSD; 389 SBOM entries `NOASSERTION` (Go modules) | SBOM |
| Platforms | amd64 (this machine, CI) and arm64 | manifest |
| Availability | The free tier serves only the `latest` and `latest-dev` tags, but **digests stay pullable**. 499 signed historical digests are listed. Samples answer HTTP 200, including digests built on 2026-05-07, 2026-05-08, 2026-06-23 and 2026-08-31 | `supply-chain-retention.log` |

## Licensing implications (not legal advice)
- **AGPL-3.0** obliges whoever modifies MinIO and offers it to users over a network to publish the
  modified source.
- **Adulis does neither.** It runs MinIO unmodified, only on a developer's machine and on CI runners.
  Production object storage is Cloudflare R2, so no MinIO is offered to users.
- **No obligation arises from this use.** It would only if MinIO were ever modified and exposed to
  users, which is a founder decision to take with counsel at that point.

## Vendor strategy (task 2)

| Criterion | Assessment |
|---|---|
| Reliability | Rebuilt daily from source; the pinned digest passed 22 image checks (WO-INFRA-003), every CI run since, and the migration rehearsals |
| Security updates | Daily rebuilds against current Wolfi packages; 0 known CVEs today. Updating means moving the pin (below) |
| Image retention | Digests about six months old still resolve. Not contractually guaranteed on the free tier: risk R-05 stays, now with evidence |
| Compatibility | S3 API, `mc` and the API's `S3ObjectStorage` verified in CI (`console-e2e` media arms) and in the rehearsals; amd64 and arm64 |
| Historical digests | Available (above); a pinned digest keeps working after `latest` moves |
| Maintenance | **Upstream MinIO stopped community releases;** the server is now Chainguard's fork. `mc` is frozen at 2025-08-13. If Chainguard dropped the image, the alternatives are building MinIO from source, or another S3-compatible server (for example Garage or SeaweedFS), each a separate compatibility project |
| Upgrade procedure | Pull `cgr.dev/chainguard/minio:latest`, read its digest, run the cosign verify (identity above), update **both** `docker-compose.yml` (`x-minio-image`) and `ci.yml` (`MINIO_IMAGE`) in one commit, and let CI run `console-e2e` |

**Verdict: acceptable for local development and CI,** with the pin kept and the signature checked on
each pin update. No better-evidenced, compatible alternative was found: the previous official images no
longer exist (Docker Hub 404, quay.io 401), so nothing was replaced.

## Remaining limitations
- **No vulnerability attestation** from Chainguard. Today's scan is a point-in-time result.
- **Signature checks are not automated in CI.** They run by hand when the pin moves; a CI step would
  need network access to Sigstore and a pinned cosign.
- **`mc` gets no upstream fixes** beyond 2025-08-13.
