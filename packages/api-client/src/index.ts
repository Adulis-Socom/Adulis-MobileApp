/**
 * `@adulis/api-client` — the seam between the backend and every client.
 * ADU-REPO-01 §5.1.
 *
 * `src/schema.d.ts` is GENERATED from `contracts/openapi.json` (itself generated from the
 * replacement API, ARC-BE-05) by `pnpm --filter @adulis/api-client generate`. The rebuild CI
 * regenerates both and fails on any difference. This module re-exports the generated `paths`,
 * `components` and `operations` types, and nothing else.
 *
 * At foundation the contract holds only /livez and /healthz: every business endpoint arrives with
 * its backend work order (RBL-04 GAP-RB-06). **Never hand-write a DTO here to fill a gap**: it would
 * be the duplicate the seam exists to prevent, with authority, because every client would import it
 * believing it came from the contract. Frontends use their typed fixture port until then (GOV-06).
 *
 * If a type you need is missing, **the contract does not define it yet.** The
 * answer is the contract, never a reach into `apps/api/` (rule 2).
 */
export type { components, operations, paths } from './schema';

/**
 * Resolve the API origin from configuration.
 *
 * **One variable, and it is an origin — never a path prefix.** ADU-API-01 writes
 * every route as `/v1/...`, so the `/v1` belongs in the contract's own path keys
 * and not in this value. Two consequences follow, and both have bitten before:
 * Prism ignores a path prefix carried in `servers[].url`, so a contract that puts
 * `/v1` there would 404 on every mocked route; and a base URL carrying `/v1` stops
 * being a clean origin swap the moment anything non-versioned is added.
 *
 * Dev is deliberately **cross-origin** against the API rather than proxied
 * through Vite. Production is genuinely cross-origin — the console's CSP carries
 * `connect-src 'self' https://api...` and the API applies an exact-`Origin` CSRF
 * check against `CONSOLE_ORIGIN` with `credentials: 'include'`. A dev proxy makes
 * dev same-origin, so CORS preflight, cookie `SameSite`/`Secure` behaviour and the
 * Origin check would all be exercised for the first time in production.
 */
export function resolveApiBaseUrl(configured: string | undefined): string {
  const value = configured?.trim();
  if (!value) {
    throw new Error(
      'API base URL is not configured. Set VITE_API_BASE_URL — for local work ' +
        'point it at the running API (http://localhost:3000).',
    );
  }
  if (/\/v1\/?$/.test(value)) {
    throw new Error(
      `API base URL must be an origin, not a versioned path: received "${value}". ` +
        'ADU-REPO-01 v1.2 S5.1 RULES on this: "/v1 lives in the OpenAPI path keys. ' +
        'The base URL is an origin and nothing more." ' +
        'If you configured it this way you were probably reading v1.1, which said ' +
        'the base URL carries /v1 and contradicted itself doing so — with /v1 also ' +
        'in the path keys, every request would resolve to /v1/v1/bootstrap, the ' +
        'doubling that same sentence warned against. Prism serves what the path ' +
        'keys say and ignores a servers[].url prefix, which is what settled it. ' +
        'Set an origin.',
    );
  }
  return value.replace(/\/+$/, '');
}
