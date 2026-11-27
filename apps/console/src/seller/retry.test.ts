import { describe, expect, it } from 'vitest';
import { createRetryKeys, isUnknownOutcome, outcomeOfFailure, requestSignature } from './retry';

const counter = () => {
  let n = 0;
  return () => `k${++n}`;
};

describe('retry identity: an unresolved request keeps its key, a definite answer ends it', () => {
  it('reuses the key of the same request after an unknown outcome, so a lost response cannot become a duplicate', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('products.create', {});
    const first = keys.begin(sig);
    keys.settle(sig, first, 'UNKNOWN');
    expect(keys.begin(sig)).toBe(first);
    keys.settle(sig, first, 'UNKNOWN');
    expect(keys.begin(sig)).toBe(first);
  });

  it('a different body is a different command with its own key, and does not disturb the pending one', () => {
    const keys = createRetryKeys(counter());
    const a = requestSignature('inventory.set', { variant_id: 'v', quantity: 5 });
    const b = requestSignature('inventory.set', { variant_id: 'v', quantity: 6 });
    const ka = keys.begin(a);
    keys.settle(a, ka, 'UNKNOWN');
    const kb = keys.begin(b);
    expect(kb).not.toBe(ka);
    keys.settle(b, kb, 'APPLIED');
    expect(keys.begin(a)).toBe(ka); // the first request is still waiting to be resolved with its own key
  });

  it('forgets the key once the request is answered, applied or refused: the next identical request is new', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('scenes.create', {});
    for (const outcome of ['APPLIED', 'REFUSED'] as const) {
      const k = keys.begin(sig);
      keys.settle(sig, k, 'UNKNOWN');
      expect(keys.size).toBe(1);
      expect(keys.begin(sig)).toBe(k);
      keys.settle(sig, k, outcome);
      expect(keys.size).toBe(0);
      expect(keys.begin(sig)).not.toBe(k);
      keys.settle(sig, keys.begin(sig), 'APPLIED');
    }
  });

  it('gives concurrent attempts of the same request ONE key, whichever answers first', () => {
    for (const order of [['UNKNOWN', 'APPLIED'], ['APPLIED', 'UNKNOWN']] as const) {
      const keys = createRetryKeys(counter());
      const sig = requestSignature('stories.create', { text: 'x' });
      const one = keys.begin(sig);
      const two = keys.begin(sig);
      expect(two).toBe(one);
      keys.settle(sig, one, order[0]);
      keys.settle(sig, two, order[1]);
      // One attempt was definitely applied, so the request is resolved; a late unknown cannot bring the key back.
      expect(keys.size).toBe(0);
      expect(keys.begin(sig)).not.toBe(one);
    }
  });

  it('keeps an unknown key while a concurrent attempt is still in flight, and keeps it after both are unknown', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('couriers.invite', { phone: '1' });
    const k = keys.begin(sig);
    keys.begin(sig);
    keys.settle(sig, k, 'UNKNOWN');
    expect(keys.size).toBe(1);
    keys.settle(sig, k, 'UNKNOWN');
    expect(keys.begin(sig)).toBe(k);
  });

  it('ignores a stale settlement: an old attempt cannot forget the current key or resurrect a resolved one', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('products.create', {});
    const old = keys.begin(sig);
    const concurrent = keys.begin(sig);
    keys.settle(sig, old, 'APPLIED'); // resolved while `concurrent` is still in flight
    const fresh = keys.begin(sig); // a NEW command with the same body
    expect(fresh).not.toBe(old);
    keys.settle(sig, fresh, 'UNKNOWN');
    keys.settle(sig, concurrent, 'APPLIED'); // late answer for the old key: must not end the new command
    expect(keys.begin(sig)).toBe(fresh);
  });

  it('never evicts an unresolved request, however many accumulate (FE12-01)', () => {
    const keys = createRetryKeys(counter());
    const sigs = Array.from({ length: 200 }, (_, i) => requestSignature('op', { i }));
    const issued = sigs.map((s) => keys.begin(s));
    // Half are answered UNKNOWN (idle unresolved), half are still in flight: all keep their key.
    sigs.forEach((s, i) => {
      if (i % 2 === 0) keys.settle(s, issued[i] ?? '', 'UNKNOWN');
    });
    expect(keys.size).toBe(200);
    sigs.forEach((s, i) => expect(keys.begin(s)).toBe(issued[i]));
  });

  it('releases entries only on a definite answer, so the store shrinks back when requests resolve', () => {
    const keys = createRetryKeys(counter());
    const sigs = ['p', 'q', 'r'].map((x) => requestSignature('op', { x }));
    const issued = sigs.map((s) => keys.begin(s));
    sigs.forEach((s, i) => keys.settle(s, issued[i] ?? '', 'UNKNOWN'));
    expect(keys.size).toBe(3);
    sigs.forEach((s, i) => {
      keys.begin(s);
      keys.settle(s, issued[i] ?? '', 'APPLIED');
    });
    expect(keys.size).toBe(0);
  });

  it('separate stores (another Seller scope or another session) never share a key', () => {
    const mint = counter();
    const alem = createRetryKeys(mint);
    const biruk = createRetryKeys(mint);
    const sig = requestSignature('inbox.reply.send', { body: 'hi' });
    const k = alem.begin(sig);
    alem.settle(sig, k, 'UNKNOWN');
    expect(biruk.begin(sig)).not.toBe(k);
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
