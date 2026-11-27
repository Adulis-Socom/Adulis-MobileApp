# First promotion into dev -- procedure (RB26-D01), run after SC-FE-12 is accepted

Prepared 26 November 2026, not executed. Authority: `docs/amendments/REBUILD-2026-11-26-DEV-PROMOTION-POLICY.md`.

## Facts recorded when this was written (re-read every one at execution time)
- `dev` = 64d2e8c (the legacy baseline); `rebuild/2026-11-25` was branched from it (merge base 64d2e8c), so while `dev`
  has no newer commits a merge of the rebuild branch deletes the legacy files and adds the replacement tree.
- `dev` uses CLASSIC branch protection (not a ruleset): strict required checks with ONE context,
  `install -> typecheck -> lint -> test -> build -> gates` (app 15368, the legacy pipeline, archived), PR required (0 approvals,
  stale-review dismissal), conversation resolution, `enforce_admins` true, no force-push, no deletion.
- The replacement checks are `replacement foundation (rebuild-20261125)` and `Seller Console (rebuild-20261125)` (app 15368),
  from `.github/workflows/rebuild-ci.yml`, which triggers on push to `dev` and on PRs into `dev` (added with this document).

## Steps
1. **Freeze and inspect.** Fetch. Record `dev` and `rebuild/2026-11-25` SHAs, `gh api repos/.../branches/dev/protection` and
   both rulesets (store the JSON). Stop if `dev` moved: reconcile by merging `dev` INTO the rebuild branch with the rebuild
   tree winning (`git merge -s ours`-style conflict resolution is NOT allowed for files that exist only on `dev`: they are
   legacy and must stay deleted; inspect each).
2. **Verify the exact proposed tree.** `git merge-tree --write-tree origin/dev origin/rebuild/2026-11-25` must equal the
   rebuild branch tree (`git diff --stat <that-tree> origin/rebuild/2026-11-25` is empty): no legacy runtime file survives,
   none is restored. Run `pnpm verify:retired` and `pnpm verify:docs-ascii` on it in CI.
3. **Open a normal PR** `rebuild/2026-11-25` -> `dev` (non-draft only when SC-FE-12 acceptance evidence is attached). Both
   replacement checks must pass on the exact head AND the merge candidate (the PR run). The legacy check cannot run on
   this tree: it is expected to be absent, not green.
4. **Reconcile the required checks in ONE atomic update, only after step 3 is green.** Replace the legacy context with the two
   replacement contexts in `dev`'s required status checks (`gh api -X PATCH .../branches/dev/protection/required_status_checks`
   with `strict: true` and `checks: [{context, app_id: 15368}, ...]`). Keep PR requirement, conversation resolution,
   `enforce_admins`, no force-push, no deletion. Never an interval with no required check and never `enforce_admins` off.
   Needs repository-admin permission: if unavailable, STOP and checkpoint this exact call for the founder.
5. **Merge with a merge commit** (history preserved; no squash, no force). Record the resulting `dev` SHA.
6. **Verify after merge.** `dev` tree equals the verified tree; the push run of `Rebuild CI` on `dev` is green; the protection
   read-back shows the successor contexts; `main` and the recovery tags are unchanged.
7. **Synchronise.** `rebuild/2026-11-25` is now an ancestor of `dev`; later rebuild PRs need no legacy file. If `dev` ever gains a
   commit the rebuild branch lacks, merge `dev` into the rebuild branch through a PR and delete nothing that is meant to stay
   deleted. Archived code is read from tag `recovery/legacy-dev-20261125`, never restored to the tree.

Not authorised by promotion: launch, deployment, any persistent database change, any change to `main`.
