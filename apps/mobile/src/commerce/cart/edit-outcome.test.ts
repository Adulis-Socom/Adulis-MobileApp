import { ApiError } from '../../api/client';
import { KEY_SAFE_MS } from '../../api/mutation';
import { apiProblem, gatewayPage, offline, proxyJson, timeout } from '../testing/api-errors';
import { cartSet, line, sellerCart } from '../testing/builders';
import { judgeEdit, reconcileEdit, type ReconcileTarget } from './edit-outcome';
import { asLineId } from './model';
import { ScopeChanged } from './port';

const START = 5_000_000;
const first = { startedAt: START, attempts: 1 };
const replayed = { startedAt: START, attempts: 2 };
const NOW = START + 1_000;

describe('what a failed cart edit proves', () => {
  it.each([
    ['the connection is lost', () => offline()],
    ['the request times out', () => timeout()],
    ['a gateway page answers 502', () => gatewayPage(502)],
    ['a gateway page answers 404', () => gatewayPage(404)],
    ['a gateway page answers 400', () => gatewayPage(400)],
    ['a 200 answer cannot be read', () => new ApiError({ kind: 'unexpected', status: 200 })],
    ['the API answers 500 with its envelope', () => apiProblem(500, 'INTERNAL')],
    ['the API answers 503 with its envelope', () => apiProblem(503, 'UNAVAILABLE')],
    [
      'the API answers 409 with a code no edit is known to answer',
      () => apiProblem(409, 'CART_REVALIDATION_FAILED'),
    ],
    ['the API answers 409 with any other code', () => apiProblem(409, 'SOMETHING_ELSE')],
    ["a proxy's JSON carries a code and a 400 status", () => proxyJson(400, 'VALIDATION_FAILED')],
    ["a proxy's JSON carries a code and a 404 status", () => proxyJson(404, 'NOT_FOUND')],
    ["a proxy's JSON carries a code and a 403 status", () => proxyJson(403, 'PERMISSION_DENIED')],
    ['the port refuses to send for a scope that is still current', () => new ScopeChanged()],
    ['something that is not an API failure is thrown', () => new Error('x')],
  ])('leaves it unknown, and replayable under the same key, when %s', (_name, make) => {
    expect(judgeEdit(make(), first, NOW)).toEqual({
      outcome: 'unknown',
      replay: true,
      holdMs: null,
    });
  });

  it.each([
    ['400', apiProblem(400, 'VALIDATION_FAILED'), 'VALIDATION_FAILED'],
    ['401', apiProblem(401, 'SESSION_EXPIRED'), 'SESSION_EXPIRED'],
    ['403', apiProblem(403, 'PERMISSION_DENIED'), 'PERMISSION_DENIED'],
    ['413', apiProblem(413, 'PAYLOAD_TOO_LARGE'), 'PAYLOAD_TOO_LARGE'],
    [
      'a 404 that is not the missing-line answer',
      apiProblem(404, 'ROUTE_NOT_FOUND'),
      'ROUTE_NOT_FOUND',
    ],
  ])("is a refusal for the API's own %s on a first attempt", (_name, failure, code) => {
    expect(judgeEdit(failure, first, NOW)).toEqual({ outcome: 'refused', code });
  });

  it("is gone for the API's own 404 NOT_FOUND, on a first attempt and on a replay", () => {
    expect(judgeEdit(apiProblem(404, 'NOT_FOUND'), first, NOW)).toEqual({ outcome: 'gone' });
    expect(judgeEdit(apiProblem(404, 'NOT_FOUND'), replayed, NOW)).toEqual({ outcome: 'gone' });
  });

  it('on a replay, only a 400 or a 413 still proves the first request was rejected', () => {
    expect(judgeEdit(apiProblem(400, 'VALIDATION_FAILED'), replayed, NOW)).toMatchObject({
      outcome: 'refused',
    });
    expect(judgeEdit(apiProblem(413, 'PAYLOAD_TOO_LARGE'), replayed, NOW)).toMatchObject({
      outcome: 'refused',
    });
    for (const failure of [
      apiProblem(401, 'SESSION_EXPIRED'),
      apiProblem(403, 'PERMISSION_DENIED'),
      apiProblem(404, 'ROUTE_NOT_FOUND'),
    ]) {
      expect(judgeEdit(failure, replayed, NOW)).toMatchObject({ outcome: 'unknown', replay: true });
    }
  });

  it('a key that was already used is unknown and can NOT be replayed', () => {
    expect(judgeEdit(apiProblem(409, 'IDEMPOTENCY_KEY_REUSED'), first, NOW)).toEqual({
      outcome: 'unknown',
      replay: false,
      holdMs: null,
    });
  });

  it('a 429 or a 503 is unknown with the wait the server asked for, and still replayable afterwards', () => {
    expect(judgeEdit(apiProblem(429, 'RATE_LIMITED', 7), first, NOW)).toEqual({
      outcome: 'unknown',
      replay: true,
      holdMs: 7000,
    });
    expect(judgeEdit(gatewayPage(503, 5), first, NOW)).toEqual({
      outcome: 'unknown',
      replay: true,
      holdMs: 5000,
    });
    expect(judgeEdit(apiProblem(503, 'UNAVAILABLE'), first, NOW)).toMatchObject({
      outcome: 'unknown',
      holdMs: null,
    });
  });

  it("a 5xx is never a refusal, with or without the API's envelope", () => {
    for (const failure of [
      apiProblem(500, 'INTERNAL'),
      apiProblem(502, 'BAD_GATEWAY'),
      gatewayPage(500),
    ]) {
      expect(judgeEdit(failure, first, NOW).outcome).toBe('unknown');
    }
  });

  it('stops replaying a key at its safe age, and when the clock was stepped back', () => {
    const failure = offline();
    expect(judgeEdit(failure, first, START + KEY_SAFE_MS - 1)).toMatchObject({ replay: true });
    expect(judgeEdit(failure, first, START + KEY_SAFE_MS)).toMatchObject({ replay: false });
    expect(judgeEdit(failure, first, START - 1)).toMatchObject({ replay: false });
  });
});

describe('what a verified answer says about an edit that is not settled', () => {
  const L1 = asLineId('line-1');
  const set = (quantity: number): ReconcileTarget => ({
    kind: 'SET_QUANTITY',
    lineId: L1,
    quantity,
    startedAt: START,
  });
  const remove: ReconcileTarget = { kind: 'REMOVE', lineId: L1, startedAt: START };
  const holding = (quantity: number) => cartSet(sellerCart([line('line-1', { quantity })]));
  const empty = cartSet();
  const basis = (
    carts = holding(3),
    over: Partial<{ receivedAt: number; verified: boolean; epoch: number }> = {},
  ) => ({ carts, receivedAt: START + 1, verified: true, epoch: 4, ...over });

  it('a quantity edit is SATISFIED when the line shows that quantity', () => {
    expect(reconcileEdit(set(3), basis(holding(3)), 4)).toBe('SATISFIED');
  });

  it('a quantity edit is NOT_SHOWN when the line shows another quantity: a late commit is still possible', () => {
    expect(reconcileEdit(set(3), basis(holding(2)), 4)).toBe('NOT_SHOWN');
    expect(reconcileEdit(set(3), basis(holding(4)), 4)).toBe('NOT_SHOWN');
  });

  it('a quantity edit is LINE_GONE when the line is not there', () => {
    expect(reconcileEdit(set(3), basis(empty), 4)).toBe('LINE_GONE');
  });

  it('a removal is SATISFIED when the line is not there, and NOT_SHOWN while it is', () => {
    expect(reconcileEdit(remove, basis(empty), 4)).toBe('SATISFIED');
    expect(reconcileEdit(remove, basis(holding(3)), 4)).toBe('NOT_SHOWN');
    expect(reconcileEdit(remove, basis(holding(1)), 4)).toBe('NOT_SHOWN');
  });

  it('finds the line wherever it sits, and answers for that line alone', () => {
    const two = cartSet(
      sellerCart([line('other', { quantity: 3 })], {}, 'seller-a'),
      sellerCart([line('line-1', { quantity: 3 })], {}, 'seller-b'),
    );
    expect(reconcileEdit(set(3), basis(two), 4)).toBe('SATISFIED');
    const onlyOther = cartSet(sellerCart([line('other', { quantity: 3 })]));
    expect(reconcileEdit(remove, basis(onlyOther), 4)).toBe('SATISFIED');
    expect(reconcileEdit(set(3), basis(onlyOther), 4)).toBe('LINE_GONE');
  });

  it('says nothing for an answer that is not verified', () => {
    expect(reconcileEdit(set(3), basis(holding(3), { verified: false }), 4)).toBe('NOT_A_BASIS');
    expect(reconcileEdit(remove, basis(empty, { verified: false }), 4)).toBe('NOT_A_BASIS');
  });

  it('says nothing for an answer from another scope', () => {
    expect(reconcileEdit(set(3), basis(holding(3), { epoch: 5 }), 4)).toBe('NOT_A_BASIS');
    expect(reconcileEdit(remove, basis(empty, { epoch: 3 }), 4)).toBe('NOT_A_BASIS');
  });

  it('says nothing for an answer that arrived before the edit began, and accepts one that arrived at that moment or later', () => {
    expect(reconcileEdit(set(3), basis(holding(3), { receivedAt: START - 1 }), 4)).toBe(
      'NOT_A_BASIS',
    );
    expect(reconcileEdit(remove, basis(empty, { receivedAt: START - 1 }), 4)).toBe('NOT_A_BASIS');
    expect(reconcileEdit(set(3), basis(holding(3), { receivedAt: START }), 4)).toBe('SATISFIED');
  });
});
