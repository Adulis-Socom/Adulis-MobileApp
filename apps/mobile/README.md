# @adulis/mobile

Buyer Mode. Expo + React Native, TypeScript strict. **Governed by ADU-MOB-01
v1.2**; `CLAUDE.md` beside this file is the workstream's instruction file.

Start every agent session from this directory, not the repository root
(ADU-REPO-01 S8).

## Scripts

| Script                                       | What                                                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                   | Metro for the development client, against the LAN address of the API on :3000 (ADU-MOB-00 S3.1)          |
| `pnpm build`                                 | `expo export` for Android -- proves the bundle compiles; the CI `build` gate                             |
| `pnpm build:dev-client`                      | EAS development build, both platforms. Needs `eas login` (operator, WO-0a)                               |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | The scoped CI gates. `test` is Jest (jest-expo) plus the gate and hook self-tests on Node's runner       |
| `pnpm gates`                                 | The fifteen grep gates of ADU-MOB-01 S18.1 / ADU-MOB-03 S8, self-tested first (`scripts/gates/run.mjs`) |
| `pnpm precommit`                             | What the pre-commit hook runs: typecheck, tests, gates, secret scan                                      |
| `pnpm api:generate`                          | Regenerates `@adulis/api-client` from the committed contract -- one generator, never a second client     |

## EAS profiles (`eas.json`, ADU-MOB-01 S19.1)

`development` is the dev client (internal distribution); `preview` is the
internal track; `production` is the store binary with its update channel.
`appVersionSource: remote` because B22/B7 make the version a reported,
operational value. The EAS project id and the update URL are created by the
operator's own login and are deliberately not in `app.config.ts`.

## The boundary and the hooks (`<repo-root>/.claude/settings.json`)

`claudeMdExcludes` drops the other workstreams' instruction files, which load on
demand the moment a session reads across a boundary; `permissions.deny` stops
those reads, so a habit becomes a guarantee (ADU-REPO-01 S8) and dependency
rule 2 is enforced one layer before dependency-cruiser sees the import. Edit
rules cover Write: Claude Code checks file writes against `Edit(path)` only. The
deny paths are relative to the current directory and assume the session started
here, which is S8's habit.

Three deterministic hooks (`scripts/hooks/`): format and lint the file just
written; before a `git commit` typed through the Bash OR PowerShell tool, run
typecheck, tests, the fifteen gates and a secret scan over everything the
commit could carry, and block on red (exit 2); and ask before any write to an
environment, signing, credential or boundary file. The commands address the
scripts through `$CLAUDE_PROJECT_DIR` because a hook runs in the current
directory, which moves with `cd`; on Windows that requires Git Bash, which
Claude Code uses for shell-form hooks when it is installed.

## What is deferred, and where

`DEFERRED-GATES.md` -- every device-half gate, by name, with what blocks it.
Tier 3 does not start until it is empty (ADU-MOB-WO-01 v1.2 S1.1).
