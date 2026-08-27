# `contracts/` - the seam between the backend and every client

**One file lives here, and it is generated.**

`openapi.json` is produced from the NestJS decorators in `apps/api/` and consumed by
the console, the mobile app and the storefront. ADU-REPO-01 S5.1.

## Why it is not inside `apps/api/`

It is *produced* by the backend and *consumed* by three clients. Putting it under the
producer's directory invites a front-end developer to reach into `apps/api/` to read
it - **which is the first step toward reaching in for something else**, and rule 2 is
the rule that gets broken helpfully.

## The rules

> **Generated in CI. Never hand-edited, and never regenerated locally and committed.**
> A hand-edited spec is a lie with authority: every client would then be typed against
> a contract the server does not implement, and nothing would fail until runtime.

- Regenerate locally to *look* at it: `pnpm generate:openapi`. Do not commit the result.
- CI regenerates it on merge to `main` and commits it from there.
- **CI fails on any removal, rename or retype within `/v1`** - ADU-API-01's
  additive-only doctrine as a build failure rather than a discipline. Two app versions
  are always in the field, and the oldest cannot be assumed updated.
- `packages/api-client/src/schema.d.ts` is generated *from this file*, and is the only
  route by which a client learns a shape.
- **If a type is missing from `@adulis/api-client`, the endpoint does not exist yet.**
  The answer is the Prism mock (`pnpm mock:api`), never a reach into `apps/api/`.

## The mock

```bash
pnpm mock:api          # serves this file at http://127.0.0.1:4010
```

Every client develops against it and flips one base URL when the endpoint lands, so
**no front-end workstream is ever blocked on the backend**.
