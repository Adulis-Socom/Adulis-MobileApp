import { ApiError, type ApiFailure } from '../api/client';
import { KEY_SAFE_MS, keyConflict, keyUsable, waitBeforeRetryMs } from '../api/mutation';
import { SessionChanged } from '../auth/session';
import { problem } from '../testing/fake-api';
import { judgeFailure } from './send-intent';

/**
 * The pure rules behind an uncertain send: what a failed attempt proves, when the same key may be
 * sent again, and when the server's answer asked for a wait. Failures are built exactly as the API
 * client builds them.
 */
const NOW = Date.parse('2026-11-18T10:00:00.000Z');
const fresh = { startedAt: NOW - 1000 };
const envelope = (status: number, code: Parameters<typeof problem>[1], slots?: Record<string, unknown>, retryAfterSeconds?: number) =>
  new ApiError({ kind: 'problem', status, problem: problem(status, code, 'request', slots).body, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
const gateway = (status: number, retryAfterSeconds?: number) =>
  new ApiError({ kind: 'unexpected', status, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
/** A gateway's JSON that only looks like the API's problem: a code, none of the envelope. */
const codeOnly = (status: number, retryAfterSeconds?: number) =>
  new ApiError({ kind: 'problem', status, problem: { code: 'BAD_GATEWAY' } as never, ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) } as ApiFailure);

describe('judging a failed send', () => {
  it.each([
    ['a lost connection', new ApiError({ kind: 'offline' })],
    ['a timeout', new ApiError({ kind: 'timeout' })],
    ['a gateway page (502)', gateway(502)],
    ['a gateway page (504)', gateway(504)],
    ['a gateway page that is not JSON on a 201', gateway(201)],
    ['JSON that carries only a code (502)', codeOnly(502)],
    ['an error that is not the API client\'s', new Error('boom')],
    ['a session that changed', new SessionChanged()],
  ])('%s proves nothing: unknown, replayable with the same key', (_name, failure) => {
    expect(judgeFailure(failure, fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: null });
  });

  it.each([
    ['a validation refusal', envelope(400, 'VALIDATION_FAILED')],
    ['a missing conversation', envelope(404, 'NOT_FOUND')],
    ['a permission refusal', envelope(403, 'PERMISSION_DENIED')],
  ])('%s is the API\'s own 4xx rejection: failed, nothing stored, nothing to replay', (_name, failure) => {
    expect(judgeFailure(failure, fresh, NOW)).toEqual({ outcome: 'failed', replay: false, holdMs: null });
  });

  // Changed: these were judged "failed" (not sent, a new key) before. A 5xx with the API's own body
  // proves nothing, because a connection lost at the commit answers 503 after the message was stored.
  it.each([
    ['a 500 with the API problem body', envelope(500, 'INTERNAL')],
    ['a 502 with the API problem body', envelope(502, 'INTERNAL')],
    ['a 503 with the API problem body (database unavailable)', envelope(503, 'INTERNAL', { retry_after_seconds: 5 })],
    ['a 504 with the API problem body', envelope(504, 'INTERNAL')],
    ['a conflict that is not about the key', envelope(409, 'PUBLICATION_BLOCKED')],
  ])('%s is unknown, not "not sent": the same key is kept and replayable', (_name, failure) => {
    expect(judgeFailure(failure, fresh, NOW)).toMatchObject({ outcome: 'unknown', replay: true });
  });

  it('a key conflict is never "not sent": unknown, and the same key is not sent again', () => {
    expect(judgeFailure(envelope(409, 'IDEMPOTENCY_KEY_REUSED'), fresh, NOW)).toEqual({ outcome: 'unknown', replay: false, holdMs: null });
    // Even a gateway's JSON naming that code, which cannot be told from the API's.
    expect(judgeFailure(new ApiError({ kind: 'problem', status: 409, problem: { code: 'IDEMPOTENCY_KEY_REUSED' } as never }), fresh, NOW).replay).toBe(false);
  });

  it('a key at or beyond its safe age is not replayed; one a millisecond younger is', () => {
    const lost = new ApiError({ kind: 'timeout' });
    expect(judgeFailure(lost, { startedAt: NOW - (KEY_SAFE_MS - 1) }, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: null });
    expect(judgeFailure(lost, { startedAt: NOW - KEY_SAFE_MS }, NOW)).toEqual({ outcome: 'unknown', replay: false, holdMs: null });
    expect(judgeFailure(lost, { startedAt: NOW - 25 * 3600_000 }, NOW).replay).toBe(false);
    expect(KEY_SAFE_MS).toBeLessThan(24 * 3600_000);
  });

  it('an old key does not turn the API\'s own 4xx rejection into an unknown outcome', () => {
    expect(judgeFailure(envelope(400, 'VALIDATION_FAILED'), { startedAt: NOW - 30 * 3600_000 }, NOW)).toEqual({ outcome: 'failed', replay: false, holdMs: null });
  });

  it('an intent that began in the future (the clock was stepped back) is not replayed', () => {
    expect(judgeFailure(new ApiError({ kind: 'timeout' }), { startedAt: NOW + 60_000 }, NOW)).toEqual({ outcome: 'unknown', replay: false, holdMs: null });
  });

  it('with no intent there is nothing to replay', () => {
    expect(judgeFailure(new ApiError({ kind: 'offline' }), null, NOW)).toEqual({ outcome: 'unknown', replay: false, holdMs: null });
  });

  it('the API\'s own 429 or 503 holds the next attempt for the wait it gave and keeps the key (changed: it was "failed" with a new key)', () => {
    expect(judgeFailure(envelope(429, 'RATE_LIMITED', { retry_after_seconds: 30 }, 30), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: 30_000 });
    expect(judgeFailure(envelope(503, 'INTERNAL', undefined, 5), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: 5_000 });
  });

  it('a 429 or 503 that only an intermediary answered (a header, no API body) is unknown and holds; the replay stays safe', () => {
    expect(judgeFailure(gateway(429, 20), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: 20_000 });
    expect(judgeFailure(gateway(503, 7), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: 7_000 });
    expect(judgeFailure(codeOnly(503, 9), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: 9_000 });
  });

  it('a wait of zero seconds is no wait', () => {
    expect(judgeFailure(gateway(429, 0), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: null });
    expect(judgeFailure(envelope(503, 'INTERNAL', undefined, 0), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: null });
    expect(waitBeforeRetryMs(gateway(429, 0))).toBeNull();
    expect(waitBeforeRetryMs(gateway(429, 1))).toBe(1000);
  });

  it('a 429 without any wait given holds nothing, and a wait on any other status is not a hold', () => {
    expect(judgeFailure(gateway(429), fresh, NOW).holdMs).toBeNull();
    expect(judgeFailure(envelope(429, 'RATE_LIMITED'), fresh, NOW).holdMs).toBeNull();
    expect(judgeFailure(gateway(502, 30), fresh, NOW).holdMs).toBeNull();
    expect(judgeFailure(envelope(500, 'INTERNAL', undefined, 30), fresh, NOW)).toEqual({ outcome: 'unknown', replay: true, holdMs: null });
  });
});

describe('the shared rules', () => {
  it('keyUsable counts from the first attempt and is false exactly at the safe age', () => {
    expect(keyUsable({ startedAt: NOW }, NOW)).toBe(true);
    expect(keyUsable({ startedAt: NOW - KEY_SAFE_MS + 1 }, NOW)).toBe(true);
    expect(keyUsable({ startedAt: NOW - KEY_SAFE_MS }, NOW)).toBe(false);
    // A clock stepped back since the first attempt leaves the key's real age unknown: not replayed.
    expect(keyUsable({ startedAt: NOW + 1 }, NOW)).toBe(false);
    expect(keyUsable({ startedAt: NOW + 5000 }, NOW)).toBe(false);
    expect(keyUsable({ startedAt: NOW }, NOW)).toBe(true);
  });

  it('keyConflict is the key-reuse code and nothing else', () => {
    expect(keyConflict(envelope(409, 'IDEMPOTENCY_KEY_REUSED'))).toBe(true);
    expect(keyConflict(envelope(409, 'PUBLICATION_BLOCKED'))).toBe(false);
    expect(keyConflict(envelope(400, 'IDEMPOTENCY_KEY_MISSING'))).toBe(false);
    expect(keyConflict(gateway(409))).toBe(false);
    expect(keyConflict(new Error('x'))).toBe(false);
  });

  it('waitBeforeRetryMs reads a wait only for 429 and 503', () => {
    expect(waitBeforeRetryMs(gateway(429, 3))).toBe(3000);
    expect(waitBeforeRetryMs(gateway(503, 3))).toBe(3000);
    expect(waitBeforeRetryMs(gateway(500, 3))).toBeNull();
    expect(waitBeforeRetryMs(new ApiError({ kind: 'offline' }))).toBeNull();
    expect(waitBeforeRetryMs('429')).toBeNull();
  });
});
