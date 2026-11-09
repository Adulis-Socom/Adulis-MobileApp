# `@adulis/api-client` — the seam

Generated from `contracts/openapi.json`. **Never hand-author a type here.**

## Status: generated, exported, mostly schema-less

`src/schema.d.ts` is generated from the committed contract, and the `contract-current`
gate (`ops/scripts/gates.mjs`) regenerates both files and fails on any difference. The
package entry re-exports the generated **`paths`, `components` and `operations`**
types, so a client imports them from `@adulis/api-client` and never from the `.d.ts`:

```ts
import type { components, paths } from '@adulis/api-client';
type Bootstrap = paths['/v1/bootstrap']['get']['responses'][200]['content']['application/json'];
```

`pnpm --filter @adulis/api-client test` type-checks that the export resolves.

**Most operations still carry no request or response schema**: the API's Swagger
decorators carry no bodies (register D-98). The generated types give their paths and
parameters, and their bodies are empty. Closing that gap is backend contract work in
`apps/api`. It is never a hand-written type here.

## Regenerating

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
