import { resolveApiBaseUrl } from '@adulis/api-client';

/**
 * The API origin for this build. EXPO_PUBLIC_* values are inlined into the bundle, so this
 * variable carries the PUBLIC origin and nothing else -- never a key or credential.
 * Point it at the real API, or at `pnpm mock:api` for contract-only work; request code is
 * identical either way, and request/response shapes come only from @adulis/api-client.
 */
export function apiOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;
  // Checked here because the shared resolver's own message names the console's VITE_ variable.
  if (!configured?.trim()) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured (see apps/mobile/.env.example)');
  }
  const origin = resolveApiBaseUrl(configured);
  // The bearer travels to this origin: a release build never sends it over plain HTTP.
  if (!__DEV__ && !origin.startsWith('https://')) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be https:// in a release build');
  }
  return origin;
}
