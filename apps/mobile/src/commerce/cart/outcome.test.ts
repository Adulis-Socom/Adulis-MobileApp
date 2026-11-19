import { KEY_SAFE_MS } from '../../api/mutation';
import { apiProblem, gatewayPage, offline, proxyJson, timeout } from '../testing/api-errors';
import { KNOWN_CART_CONFLICT_CODES, judgeAdd } from './outcome';

const NOW = 1_000_000_000;
const first = { startedAt: NOW, attempts: 1 };
const replay = { startedAt: NOW, attempts: 2 };

describe('what a failed cart add proves about the first request', () => {
  it('is unknown for a lost connection or a timeout, and the same key may be sent again', () => {
    expect(judgeAdd(offline(), first, NOW + 1)).toEqual({
      outcome: 'unknown',
      replay: true,
      holdMs: null,
    });
    expect(judgeAdd(timeout(), first, NOW + 1)).toEqual({
      outcome: 'unknown',
      replay: true,
      holdMs: null,
    });
  });

  it('is unknown for a 5xx, with the API envelope or with a gateway page: the commit may have happened', () => {
    expect(judgeAdd(apiProblem(503, 'INTERNAL'), first, NOW + 1)).toMatchObject({
      outcome: 'unknown',
      replay: true,
    });
    expect(judgeAdd(apiProblem(500, 'INTERNAL'), first, NOW + 1)).toMatchObject({
      outcome: 'unknown',
      replay: true,
    });
    expect(judgeAdd(gatewayPage(502), first, NOW + 1)).toMatchObject({
      outcome: 'unknown',
      replay: true,
    });
  });

  it("is unknown, not refused, for a JSON body that has a code but is not the API's problem", () => {
    expect(judgeAdd(proxyJson(400, 'VALIDATION_FAILED'), first, NOW + 1)).toMatchObject({
      outcome: 'unknown',
    });
    expect(judgeAdd(proxyJson(404, 'NOT_FOUND'), first, NOW + 1)).toMatchObject({
      outcome: 'unknown',
    });
  });

  it("is unknown when the envelope's status disagrees with the HTTP status", () => {
    const odd = apiProblem(400, 'VALIDATION_FAILED');
    if (odd.failure.kind === 'problem') (odd.failure.problem as { status: number }).status = 200;
    expect(judgeAdd(odd, first, NOW + 1)).toMatchObject({ outcome: 'unknown' });
  });

  it("is refused for the API's own 4xx: nothing was stored and the intent ends", () => {
    for (const status of [400, 401, 403, 404, 413, 422]) {
      expect(judgeAdd(apiProblem(status, 'VALIDATION_FAILED'), first, NOW + 1)).toMatchObject({
        outcome: 'refused',
        reload: false,
      });
    }
  });

  it("carries the server's code on a refusal", () => {
    expect(judgeAdd(apiProblem(404, 'NOT_FOUND'), first, NOW + 1)).toMatchObject({
      outcome: 'refused',
      code: 'NOT_FOUND',
    });
  });

  it('keeps a rate limit unknown and carries the wait the server asked for', () => {
    expect(judgeAdd(apiProblem(429, 'RATE_LIMITED', 12), first, NOW + 1)).toEqual({
      outcome: 'unknown',
      replay: true,
      holdMs: 12_000,
    });
    expect(judgeAdd(gatewayPage(503, 5), first, NOW + 1)).toEqual({
      outcome: 'unknown',
      replay: true,
      holdMs: 5_000,
    });
  });
});

describe('a 409', () => {
  it('is a definite refusal, asking for a re-read, only for a known cart conflict code', () => {
    expect(KNOWN_CART_CONFLICT_CODES).toContain('CART_SELLER_CONFLICT');
    expect(judgeAdd(apiProblem(409, 'CART_SELLER_CONFLICT'), first, NOW + 1)).toEqual({
      outcome: 'refused',
      reload: true,
      code: 'CART_SELLER_CONFLICT',
      holdMs: null,
    });
  });

  it('stays unknown for any other 409, because a server that stored a refusal would make "not added" false', () => {
    expect(judgeAdd(apiProblem(409, 'SOMETHING_ELSE'), first, NOW + 1)).toMatchObject({
      outcome: 'unknown',
      replay: true,
    });
    expect(judgeAdd(apiProblem(409, 'ILLEGAL_TRANSITION'), first, NOW + 1)).toMatchObject({
      outcome: 'unknown',
    });
  });

  it('is unknown and may not be sent again when the key was already used', () => {
    expect(judgeAdd(apiProblem(409, 'IDEMPOTENCY_KEY_REUSED'), first, NOW + 1)).toEqual({
      outcome: 'unknown',
      replay: false,
      holdMs: null,
    });
    expect(judgeAdd(apiProblem(409, 'IDEMPOTENCY_KEY_REUSED'), replay, NOW + 1)).toMatchObject({
      replay: false,
    });
  });
});

describe('a request sent again under the same key', () => {
  it('is refused only for the answers that would have refused the first request too', () => {
    for (const status of [400, 404, 413])
      expect(judgeAdd(apiProblem(status, 'VALIDATION_FAILED'), replay, NOW + 1)).toMatchObject({
        outcome: 'refused',
      });
    // A client too old, a recovery window, the wrong audience or a missing session are raised before the record is read.
    for (const status of [401, 403, 422])
      expect(judgeAdd(apiProblem(status, 'VALIDATION_FAILED'), replay, NOW + 1)).toMatchObject({
        outcome: 'unknown',
      });
  });
});

describe("the key's age", () => {
  it('allows a replay just inside the safe age and not at it', () => {
    expect(judgeAdd(offline(), first, NOW + KEY_SAFE_MS - 1)).toMatchObject({ replay: true });
    expect(judgeAdd(offline(), first, NOW + KEY_SAFE_MS)).toMatchObject({
      outcome: 'unknown',
      replay: false,
    });
  });

  it('does not allow a replay when the clock was stepped back since the first request', () => {
    expect(judgeAdd(offline(), first, NOW - 1)).toMatchObject({
      outcome: 'unknown',
      replay: false,
    });
  });

  it('does not allow a replay when there is no intent to replay', () => {
    expect(judgeAdd(offline(), null, NOW)).toMatchObject({ outcome: 'unknown', replay: false });
  });
});
