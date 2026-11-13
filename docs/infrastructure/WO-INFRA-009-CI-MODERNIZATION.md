# WO-INFRA-009 -- GitHub Actions modernization

13 November 2026. Commit `4b38c78` on `infra/wo-infra-007-009-finalization`.

## Why
Every CI log carried:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are being forced to run on
> Node.js 24: actions/checkout@v4, actions/setup-node@v4, pnpm/action-setup@v4.

GitHub already runs them on Node 24 by force, so the v4 actions were working on borrowed time
(ISSUE-INFRA-016).

## What changed (three lines, plus a comment)

| Action | Before | After | Runtime of the new major |
|---|---|---|---|
| `actions/checkout` | v4 | **v7** (latest v7.0.1) | `node24` |
| `actions/setup-node` | v4 | **v7** (latest v7.1.0) | `node24` |
| `pnpm/action-setup` | v4 | **v6** (latest v6.1.1) | `node24` |

Inputs unchanged: `fetch-depth: 0`; `node-version-file: .nvmrc`; `cache: pnpm`; pnpm version from
`package.json` `packageManager` (10.32.1).

## Compatibility, from each major's release notes (`logs/actions-release-notes.log`)

| Release | Change | Effect here |
|---|---|---|
| checkout v5 | Node 24; runner 2.327.1 or later | GitHub-hosted runners are newer |
| checkout v6 | Credentials persisted to a separate file | The workflow never pushes; `git diff origin/main` uses the fetched history (`fetch-depth: 0`) |
| checkout v7 | Refuses to check out fork pull requests for `pull_request_target` and `workflow_run`; ESM | The workflow triggers on `push` and `pull_request` only |
| setup-node v5 | Automatic caching when `packageManager` is set | Superseded by v6 |
| setup-node v6 | Automatic caching limited to npm | `cache: pnpm` is explicit, so pnpm caching continues |
| setup-node v7 | Cache keys as outputs; dummy `NODE_AUTH_TOKEN` export removed | The workflow publishes nothing |
| action-setup v5 | Node 24 | none |
| action-setup v6 | pnpm 11 support | pnpm 10.32.1 still from `packageManager` |

## Verification: run [43388580622](https://github.com/Adulis-Socom/Adulis-MobileApp/actions/runs/43388580622) at `4b38c78`

| Check | Before (run 43386065180, v4 actions) | After (run 43388580622) |
|---|---|---|
| Result | success | **success** |
| Steps | 16, all success | **16, all success**, the same list, with `Run actions/checkout@v7`, `Run pnpm/action-setup@v6`, `Run actions/setup-node@v7`; none skipped |
| Gates | `PASS all 31 gates` | **`PASS all 31 gates`** (31 gate headers) |
| Tests | API 983 of 983, mobile 520 of 520, `console-e2e` 88, `gate-runner` 13, `minio-migrate` 8 | **the same counts** |
| Node 20 deprecation warning | present | **absent** (0 occurrences) |
| Node | 22 from `.nvmrc` | 22 from `.nvmrc`, found in the tool cache |
| pnpm | 10.32.1 | **10.32.1**. action-setup v6 first installs pnpm 11.28.10, then switches to the `packageManager` version, with one warning about the v10 layout under `PNPM_HOME` (the shims were refreshed). Harmless; a pnpm 11 move is a separate decision |
| Dependency cache | restored | **"Cache hit"**, ~259 MB, "Cache restored successfully" (`package-manager-cache: true` and `cache: pnpm`) |
| Artifacts | the workflow uploads none | none |

**Not verified:** a `pull_request` event; no pull request was opened in this batch.

## Not done, deliberately
- **Pinning actions by commit SHA** instead of a major tag. It is a stronger supply-chain control, but it
  changes the repository's convention and needs a process (Dependabot or Renovate) to keep the SHAs
  current. Recommended as a separate change.
