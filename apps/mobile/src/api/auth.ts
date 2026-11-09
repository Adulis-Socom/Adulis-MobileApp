import type { paths } from '@adulis/api-client';

import { apiOrigin } from './config';

// Checked against the generated contract: a renamed or removed route fails typecheck.
const LOGOUT = '/v1/auth/logout' satisfies keyof paths;
type LogoutResponses = paths[typeof LOGOUT]['post']['responses'];

// React Native's Android HTTP client never times out on its own (OkHttp timeouts are 0).
const REVOKE_TIMEOUT_MS = 10_000;

/**
 * POST /v1/auth/logout (WO-API-001A): revokes the calling session on the server. A 401
 * means the session is already dead, which is the outcome asked for. Gives up after
 * REVOKE_TIMEOUT_MS. The error message carries the status only, never the credential.
 */
export async function revokeCurrentSession(token: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVOKE_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiOrigin()}${LOGOUT}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const done: keyof LogoutResponses = 204;
    if (res.status !== done && res.status !== 401) {
      throw new Error(`sign-out answered ${res.status}`);
    }
  } finally {
    clearTimeout(timer);
  }
}
