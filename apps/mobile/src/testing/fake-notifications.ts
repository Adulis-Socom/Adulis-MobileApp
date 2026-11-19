import { problem, type Recorded, type Reply, type installFakeApi } from './fake-api';

/**
 * A stateful Buyer inbox for tests: each bearer has its own rows, a read sets read_at once, and a page is 25
 * rows cut by a timestamp cursor, newest first (the server's shape).
 */
export const notificationId = (n: number) => `0e000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

export function notificationRow(n: number, overrides: Record<string, unknown> = {}) {
  return {
    id: notificationId(n),
    template_key: 'ORDER_AWAITING_PAYMENT_MORNING',
    locale: 'en',
    slots: {},
    order_id: null,
    suppressible: true,
    scheduled_for: hoursAgo(n),
    read_at: null as string | null,
    ...overrides,
  };
}
export type NotificationRow = ReturnType<typeof notificationRow>;

export const notificationPage = (data: unknown[], next_cursor: string | null = null): Reply => ({ status: 200, body: { data, next_cursor } });

export function installInbox(api: ReturnType<typeof installFakeApi>, rows: { [bearer: string]: NotificationRow[] }) {
  api.on('GET /v1/notifications', (call: Recorded) => {
    const mine = rows[call.headers.Authorization ?? ''];
    if (!mine) return problem(401, 'SESSION_EXPIRED', 'auth');
    if (call.query.as !== 'buyer') return problem(400, 'SCOPE_PARAMETER_REQUIRED', 'request');
    const start = call.query.cursor ? mine.findIndex((r) => r.scheduled_for < call.query.cursor!) : 0;
    const slice = start < 0 ? [] : mine.slice(start, start + 25);
    const more = start >= 0 && start + 25 < mine.length;
    return notificationPage(slice, more ? slice[slice.length - 1]!.scheduled_for : null);
  });
  api.onPattern('POST', /^\/v1\/notifications\/[^/]+\/read$/, (call) => {
    const mine = rows[call.headers.Authorization ?? ''] ?? [];
    const target = mine.find((r) => call.path === `/v1/notifications/${r.id}/read`);
    if (!target) return problem(404, 'NOT_FOUND', 'request');
    target.read_at ??= new Date().toISOString();
    return { status: 200, body: { read_at: target.read_at } };
  });
}
