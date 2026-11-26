import { describe, expect, it } from 'vitest';
import { createRetryKeys, isUnknownOutcome, outcomeOfFailure, requestSignature } from './retry';

const counter = () => {
  let n = 0;
  return () => `k${++n}`;
};

describe('retry identity: an unknown outcome keeps its key, a definite one ends the request', () => {
  it('reuses the key of the same request after an unknown outcome, so a lost response cannot become a duplicate', () => {
    const keys = createRetryKeys(25, counter());
    const sig = requestSignature('products.create', {});
    const first = keys.keyFor(sig);
    keys.settle(sig, first, 'UNKNOWN');
    expect(keys.keyFor(sig)).toBe(first);
    keys.settle(sig, first, 'UNKNOWN');
    expect(keys.keyFor(sig)).toBe(first);
  });

  it('a different body is a different command with its own key, and does not disturb the pending one', () => {
    const keys = createRetryKeys(25, counter());
    const a = requestSignature('inventory.set', { variant_id: 'v', quantity: 5 });
    const b = requestSignature('inventory.set', { variant_id: 'v', quantity: 6 });
    const ka = keys.keyFor(a);
    keys.settle(a, ka, 'UNKNOWN');
    const kb = keys.keyFor(b);
    expect(kb).not.toBe(ka);
    keys.settle(b, kb, 'APPLIED');
    expect(keys.keyFor(a)).toBe(ka); // the first request is still waiting to be resolved with its own key
  });

  it('forgets the key once the request is answered, applied or refused: the next identical request is new', () => {
    const keys = createRetryKeys(25, counter());
    const sig = requestSignature('scenes.create', {});
    for (const outcome of ['APPLIED', 'REFUSED'] as const) {
      const k = keys.keyFor(sig);
      keys.settle(sig, k, 'UNKNOWN');
      expect(keys.size).toBe(1);
      keys.settle(sig, k, outcome);
      expect(keys.size).toBe(0);
      expect(keys.keyFor(sig)).not.toBe(k);
    }
  });

  it('is bounded and forgets the oldest unknown outcome first', () => {
    const keys = createRetryKeys(2, counter());
    const sigs = ['a', 'b', 'c'].map((x) => requestSignature('op', { x }));
    const issued = sigs.map((s) => {
      const k = keys.keyFor(s);
      keys.settle(s, k, 'UNKNOWN');
      return k;
    });
    expect(keys.size).toBe(2);
    expect(keys.keyFor(sigs[2] ?? '')).toBe(issued[2]);
    expect(keys.keyFor(sigs[0] ?? '')).not.toBe(issued[0]);
  });

  it('classifies a failure by whether the server may have applied the write', () => {
    for (const code of ['NETWORK', 'UNAVAILABLE', 'INTERNAL']) {
      expect(isUnknownOutcome(code)).toBe(true);
      expect(outcomeOfFailure(code)).toBe('UNKNOWN');
    }
    for (const code of ['VALIDATION_FAILED', 'CONFLICT', 'PERMISSION_DENIED', 'NOT_FOUND', 'AUTHENTICATION_REQUIRED', 'RATE_LIMITED']) {
      expect(outcomeOfFailure(code)).toBe('REFUSED');
    }
  });
});
