import type { components, operations, paths } from '../src/index';
import { resolveApiBaseUrl } from '../src/index';

/**
 * TYPE-LEVEL TEST for the package entry. The assertion is `tsc --noEmit`: the generated contract types are
 * reachable from `@adulis/api-client` itself, so no client deep-imports `schema.d.ts` or hand-writes a duplicate.
 */
type Assert<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** 1. An implemented route resolves through `paths` to its generated response shape. */
type Livez = paths['/livez']['get']['responses'][200]['content']['application/json'];
type _Livez = Assert<Equal<Livez['status'], 'ok'>>;
type Healthz = paths['/healthz']['get']['responses'][503]['content']['application/json'];
type _Healthz = Assert<Equal<Healthz['status'], 'unavailable'>>;

/** 2. `components` and `operations` are exported (the generated names, whatever they hold). */
type _Exports = [components, operations];

/** 3. A path the contract does not define is a compile error, not `any`: no legacy route survives. */
// @ts-expect-error -- no such path in contracts/openapi.json
type _Reservations = paths['/v1/reservations'];

/** 4. The base URL is an origin, never a versioned path. */
export const origin: string = resolveApiBaseUrl('http://localhost:3000/');

export type { _Livez, _Healthz, _Exports, _Reservations };
