import { ApiError } from '../api/client';
import { problem } from '../testing/fake-api';
import { judgeWrite, outcomeUnknown } from './saved-write';

const answered = (status: number, code: Parameters<typeof problem>[1] = 'INTERNAL') => {
  const { body } = problem(status, code, 'request');
  return new ApiError({ kind: 'problem', status, problem: body });
};

describe('judgeWrite: what a failed keyed write says about the first attempt', () => {
  it.each([
    ['the API refuses a bad name', 'refused', answered(400, 'VALIDATION_FAILED')],
    ['the session ended', 'refused', answered(401, 'SESSION_EXPIRED')],
    ['the API refuses the request', 'refused', answered(403, 'PERMISSION_DENIED')],
    ['the target is gone', 'refused', answered(404, 'NOT_FOUND')],
    ['the key cannot be replayed', 'conflict', answered(409, 'IDEMPOTENCY_KEY_REUSED')],
    ['too many requests (the edge may answer before the API did)', 'unknown', answered(429, 'RATE_LIMITED')],
    ['a 500 with the API body', 'unknown', answered(500)],
    ['a 503 with the API body', 'unknown', answered(503)],
    ['a 502 gateway page that is not the API body', 'unknown', new ApiError({ kind: 'unexpected', status: 502 })],
    ['no connection', 'unknown', new ApiError({ kind: 'offline' })],
    ['a timeout', 'unknown', new ApiError({ kind: 'timeout' })],
    ['something that is not an API failure', 'unknown', new TypeError('boom')],
  ])('%s is judged %s', (_name, expected, error) => {
    expect(judgeWrite(error)).toBe(expected);
  });
});

describe('outcomeUnknown: only a refusal by the API itself may say a change was not made', () => {
  it.each([
    ['a bad name', false, answered(400, 'VALIDATION_FAILED')],
    ['the session ended', false, answered(401, 'SESSION_EXPIRED')],
    ['the target is gone', false, answered(404, 'NOT_FOUND')],
    ['a key conflict', true, answered(409, 'IDEMPOTENCY_KEY_REUSED')],
    ['a rate limit', true, answered(429, 'RATE_LIMITED')],
    ['a 500 with the API body', true, answered(500)],
    ['a gateway page', true, new ApiError({ kind: 'unexpected', status: 502 })],
    ['no connection', true, new ApiError({ kind: 'offline' })],
    ['a timeout', true, new ApiError({ kind: 'timeout' })],
    ['something that is not an API failure', true, new TypeError('boom')],
  ])('%s: unknown is %s', (_name, expected, error) => {
    expect(outcomeUnknown(error)).toBe(expected);
  });
});
