/**
 * `@adulis/api-client` — the seam between the backend and every client.
 * ADU-REPO-01 §5.1.
 *
 * `src/schema.d.ts` is GENERATED from `contracts/openapi.json` by
 * `pnpm --filter @adulis/api-client generate`. It does not exist yet, because
 * nothing publishes the contract yet: `apps/api` carries no `@nestjs/swagger` and
 * `.github/workflows/ci.yml` gates the OpenAPI publish on Tier 3.
 *
 * **Until it lands, this module deliberately exports no request type.** A DTO
 * hand-written here would be exactly the duplicate the seam exists to prevent —
 * and it would be a duplicate with authority, because every client would import
 * it believing it came from the contract.
 *
 * If a type you need is missing, **the endpoint does not exist yet.** The answer
 * is the contract (the mock serves it), never a reach into `apps/api/` (rule 2).
 */

/** Where `pnpm mock:api` serves the contract. Matches ADU-REPO-01 §9.4. */
export const MOCK_API_BASE_URL = 'http://127.0.0.1:4010';

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
        `point it at the running API (http://localhost:3000), or run \`pnpm mock:api\` at ${MOCK_API_BASE_URL} for contract-only work.`,
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
