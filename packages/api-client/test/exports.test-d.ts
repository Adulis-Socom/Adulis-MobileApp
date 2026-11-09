import type { components, operations, paths } from '../src/index';

/**
 * TYPE-LEVEL TEST for the package entry (WO-001C). The assertion is `tsc --noEmit`:
 * the generated contract types must be reachable from `@adulis/api-client` itself,
 * so no client deep-imports `schema.d.ts` or hand-writes a duplicate.
 */
type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** 1. A schema-bearing operation resolves through `paths` to its generated component. */
type BootstrapOk = paths['/v1/bootstrap']['get']['responses'][200]['content']['application/json'];
type _Bootstrap = Assert<Equal<BootstrapOk, components['schemas']['BootstrapResponseDto']>>;

/** 2. `operations` is the same object `paths` points at. */
type _SameOperation = Assert<
  Equal<paths['/v1/bootstrap']['get'], operations['BootstrapController_bootstrap']>
>;

/** 3. A path the contract does not define is a compile error, not `any`. */
// @ts-expect-error -- no such path in contracts/openapi.json
type _Unknown = paths['/v1/not-in-the-contract'];
