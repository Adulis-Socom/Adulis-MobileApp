/**
 * api/fixtures/transport.ts -- the fixture transport (SC-FE-01, boundary design
 * 06_SAFE_FIXTURE_AND_COMMERCE_BOUNDARY).
 *
 * WHAT IT IS NOT: it never calls `fetch`. It answers from typed, versioned data
 * and refuses everything else with FIXTURE_BLOCKED; there is no fallback to the
 * live API, and the live transport has no fallback to this.
 *
 * READ-ONLY. The only write it serves is POST /auth/logout (it clears nothing
 * server-side because there is no server). Every other write is refused.
 *
 * THE DENY-LIST IS A BACKSTOP, NOT THE CONTROL. The control is that only the
 * routes in `serve` exist. The deny-list stops a later edit from adding a
 * financial, evidence, handoff, moderation or report path to the table:
 * the check runs BEFORE the route table, so it wins.
 */
import { ApiError } from '../api-error';
import type { AdulisProblem } from '../../lib/states';
import { FIXTURE_MARKER, FIXTURE_SELLERS, FIXTURE_VERSION, fixtureOrders } from './data';

export const DENIED_PATH =
  /payment|billing|payout|refund|settle|confirm-receipt|custody|moderation|operator|report|evidence|qr|handoff/i;

interface Call {
  readonly method?: string | undefined;
  readonly sellerId?: string | undefined;
}

function problem(status: number, code: string): ApiError {
  const p: AdulisProblem = {
    type: 'about:blank',
    title_key: 'error.request.internal',
    status,
    code,
    request_id: `fx_req_${FIXTURE_VERSION}`,
    retryable: false,
  };
  return new ApiError(p);
}

async function delayFor(sellerId: string | undefined): Promise<void> {
  const table = (globalThis as { __ADULIS_FIXTURE_DELAY_MS?: Record<string, number> }).__ADULIS_FIXTURE_DELAY_MS;
  const ms = sellerId ? table?.[sellerId] : undefined;
  if (ms && ms > 0) await new Promise((r) => setTimeout(r, ms));
}

async function serve(path: string, call: Call): Promise<unknown> {
  const method = (call.method ?? 'GET').toUpperCase();
  const clean = path.split('?')[0] ?? path;

  if (method === 'POST' && clean === '/auth/logout') return undefined;
  if (method !== 'GET') throw problem(501, 'FIXTURE_BLOCKED');

  if (clean === '/bootstrap') {
    return {
      server_time: new Date().toISOString(),
      min_supported_client: '0.0.0',
      client_status: 'OK',
      market: { code: 'FX', display_currency: 'ETB', timezone: 'Africa/Addis_Ababa' },
      locales: ['en'],
      feature_flags: {},
      media_public_origin: 'http://fixture.invalid',
      environment: 'development',
    };
  }
  if (clean === '/auth/sessions') {
    return {
      data: [
        {
          id: 'fx_session',
          audience: 'CONSOLE',
          expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          remembered: false,
          current: true,
        },
      ],
    };
  }
  if (clean === '/seller/list') return { data: FIXTURE_SELLERS };
  if (clean === '/seller/orders') {
    await delayFor(call.sellerId);
    const rows = call.sellerId ? fixtureOrders(call.sellerId) : null;
    if (rows === null) throw problem(403, 'FORBIDDEN');
    return { data: rows, has_more: false, next_cursor: null };
  }
  throw problem(501, 'FIXTURE_BLOCKED');
}

export const transport = {
  marker: FIXTURE_MARKER,
  version: FIXTURE_VERSION,
  async json<T>(path: string, call: Call): Promise<T> {
    if (DENIED_PATH.test(path)) throw problem(501, 'FIXTURE_BLOCKED');
    return (await serve(path, call)) as T;
  },
  async blob(_path: string, _call: Call): Promise<Blob> {
    // Bytes are evidence-shaped by definition in this console; none are served.
    throw problem(501, 'FIXTURE_BLOCKED');
  },
};
