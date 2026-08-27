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
 * is the Prism mock, never a reach into `apps/api/` (rule 2).
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
 * Dev is deliberately **cross-origin** against the mock rather than proxied
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
        `run \`pnpm mock:api\` and point it at ${MOCK_API_BASE_URL}.`,
    );
  }
  if (/\/v1\/?$/.test(value)) {
    throw new Error(
      `API base URL must be an origin, not a versioned path: received "${value}". ` +
        'The /v1 prefix belongs in the contract path keys — see the note above ' +
        'resolveApiBaseUrl in @adulis/api-client.',
    );
  }
  return value.replace(/\/+$/, '');
}
