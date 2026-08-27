# `@adulis/api-client` — the seam

Generated from `contracts/openapi.json`. **Never hand-author a type here.**

## Status: created, not yet generated

`src/schema.d.ts` does not exist, because **nothing publishes the contract yet**:

- `apps/api` carries no `@nestjs/swagger` and no OpenAPI entrypoint;
- `.github/workflows/ci.yml` gates the OpenAPI publish on **Tier 3**;
- `apps/api/src/main.ts` sets **no global `/v1` prefix**, and ADU-API-01 writes every
  route as `/v1/...` — the prefix must reach the contract's own `paths` keys, because
  Prism ignores a prefix carried only in `servers[].url` and would 404 on every route.

The package exists ahead of that on purpose. ADU-REPO-01 §11: *"until
`packages/api-client` exists, a new front-end developer's only route to a type is across
a boundary, and the first thing they do will be the thing rule 2 forbids."*

## When the contract lands

```bash
pnpm --filter @adulis/api generate:openapi     # writes contracts/openapi.json
pnpm --filter @adulis/api-client generate      # writes src/schema.d.ts
pnpm mock:api                                  # serves the contract on :4010
```

`--alphabetize` is not cosmetic: without it the output follows the spec's key order,
which follows NestJS module registration order, so a pure import reordering in
`apps/api` reorders this file and trips the drift check with no semantic change.

## Committed, not ignored

Both `contracts/openapi.json` and `src/schema.d.ts` are **tracked**. Three reasons:

1. **A fresh clone must be able to run the mock.** `pnpm mock:api` reads the committed
   contract; if it were ignored, every front-end workstream would be blocked on running
   the backend — which is precisely what the seam exists to prevent.
2. **CI scoping needs a diff inside a workspace package.** `contracts/` is outside the
   `pnpm-workspace.yaml` globs, so a commit touching only the contract marks no package
   changed. The generated `schema.d.ts` is what pulls `@adulis/console` into a scoped run.
3. **A reviewer can see the wire change.** Both are marked `linguist-generated` so the
   diff collapses by default and is never mistaken for authored work.

**CI is their only author** (ADU-REPO-01 v1.2 S5.1). A human-authored diff to either
fails the build. v1.0's *"never regenerated locally and committed"* read as forbidding
the commit itself, which would leave the mock nothing to serve; v1.1 corrects it to
tracked-but-CI-written. A red drift check is the one signal that should send you to the
generator.
