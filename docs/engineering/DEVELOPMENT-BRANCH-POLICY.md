# Development branch policy (INF-02)

Adopted 16 November 2026 by founder decision. It applies to every remaining infrastructure and Buyer Mobile
App work order.

## Branches

| Branch | Role | Who changes it |
|---|---|---|
| `main` | **Release only.** Unchanged until the founder authorises the final integration | nobody, until then: no commits, merges, rebases, resets, force-pushes or new PRs into it |
| `dev` | **The development integration baseline.** Every work order starts from it and returns to it | merges of reviewed PRs, with CI green |
| `<track>/<work-order>` | One branch per work order | its work order only |
| Historical branches (`infra/*`, `api/*`, `tier*`, `backup/*`, ...) | Preserved records | nobody: never deleted, never rewritten, never used as a starting point for new work |

The repository's default branch stays `main`, unless the founder decides otherwise.

## The work-order cycle

1. **Fetch and start from the verified tip of `dev`:**
   `git fetch origin && git switch -c <track>/<work-order> origin/dev`.
2. Implement only the assigned scope.
3. Run the tests that apply. API and gate runs need the disposable environment (`bash ops/scripts/test-db.sh up`,
   then `eval "$(bash ops/scripts/test-db.sh env)"`).
4. Push the work-order branch, with a normal push.
5. **Open a pull request into `dev`**, never into `main`. CI runs on the PR's merge result and on every push.
6. Review the change.
7. Merge into `dev` only with CI green.
8. **Verify the CI run on the updated `dev`**, then record its SHA.

**Branch names:**
- infrastructure: `infra/inf-03-disposable-testing`, `infra/inf-04-minio-recovery`,
  `infra/inf-05-database-integrity`, `infra/inf-06-buyer-testing`;
- Buyer Mobile App: `mobile/buy-01-contract-reconciliation`, `mobile/buy-02-buyer-foundation`;
- then the same pattern for every later work order.

## Rules that do not change

- **Never force-push** a shared branch, and never rewrite published history.
- **Automated tests never use a persistent database or object store.**
  - The API suites refuse any database without the disposable mark, and any object store without the
    disposable-storage marker.
  - Do not weaken those guards to make a run possible.
- **Never hand-merge `pnpm-lock.yaml`**, and never edit generated files (`contracts/openapi.json`,
  `packages/api-client/src/schema.d.ts`).
- **The live local stack:**
  - never run `docker compose down -v`;
  - keep `ADULIS_MINIO_VOLUME` unset until the approved MinIO move (`docs/infrastructure/MINIO-STARTUP.md`);
  - never run the live MinIO move or the development-database repair without the founder's approval.
- **Seller Companion, Courier Mode, the Seller Console and the Operator Console are frozen:** their code stays,
  but no new work happens on them without a founder decision.

## Notes

- **CI scope:** CI's package scope is computed against `origin/main` (`ADULIS_SCOPE_FILTER` in
  `.github/workflows/ci.yml`). While `dev` is ahead of `main`, that selects at least every package changed on
  `dev`. It can only test more than a `dev`-based scope would, never less.
- **Branch protection for `dev`:** pull-request reviews, the CI check required, no force-push, no deletion. The
  founder configures it; the proposed settings are in the INF-02 founder handoff.
