import { describe, expect, it } from 'vitest';
import { createRetryKeys, isUnknownOutcome, outcomeOfFailure, PROVISIONAL_RETRY_CAPACITY, requestSignature, type RetryKeys } from './retry';

/** begin() that must admit: a null would be an unexpected refusal. */
const admit = (keys: RetryKeys, sig: string): string => {
  const key = keys.begin(sig);
  if (key === null) throw new Error('unexpected refusal');
  return key;
};

const counter = () => {
  let n = 0;
  return () => `k${++n}`;
};

describe('retry identity: an unresolved request keeps its key, a definite answer ends it', () => {
  it('reuses the key of the same request after an unknown outcome, so a lost response cannot become a duplicate', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('products.create', {});
    const first = admit(keys, sig);
    keys.settle(sig, first, 'UNKNOWN');
    expect(admit(keys, sig)).toBe(first);
    keys.settle(sig, first, 'UNKNOWN');
    expect(admit(keys, sig)).toBe(first);
  });

  it('a different body is a different command with its own key, and does not disturb the pending one', () => {
    const keys = createRetryKeys(counter());
    const a = requestSignature('inventory.set', { variant_id: 'v', quantity: 5 });
    const b = requestSignature('inventory.set', { variant_id: 'v', quantity: 6 });
    const ka = admit(keys, a);
    keys.settle(a, ka, 'UNKNOWN');
    const kb = admit(keys, b);
    expect(kb).not.toBe(ka);
    keys.settle(b, kb, 'APPLIED');
    expect(admit(keys, a)).toBe(ka); // the first request is still waiting to be resolved with its own key
  });

  it('forgets the key once the request is answered, applied or refused: the next identical request is new', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('scenes.create', {});
    for (const outcome of ['APPLIED', 'REFUSED'] as const) {
      const k = admit(keys, sig);
      keys.settle(sig, k, 'UNKNOWN');
      expect(keys.size).toBe(1);
      expect(admit(keys, sig)).toBe(k);
      keys.settle(sig, k, outcome);
      expect(keys.size).toBe(0);
      expect(admit(keys, sig)).not.toBe(k);
      keys.settle(sig, admit(keys, sig), 'APPLIED');
    }
  });

  it('gives concurrent attempts of the same request ONE key, whichever answers first', () => {
    for (const order of [['UNKNOWN', 'APPLIED'], ['APPLIED', 'UNKNOWN']] as const) {
      const keys = createRetryKeys(counter());
      const sig = requestSignature('stories.create', { text: 'x' });
      const one = admit(keys, sig);
      const two = admit(keys, sig);
      expect(two).toBe(one);
      keys.settle(sig, one, order[0]);
      keys.settle(sig, two, order[1]);
      // One attempt was definitely applied, so the request is resolved; a late unknown cannot bring the key back.
      expect(keys.size).toBe(0);
      expect(admit(keys, sig)).not.toBe(one);
    }
  });

  it('keeps an unknown key while a concurrent attempt is still in flight, and keeps it after both are unknown', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('couriers.invite', { phone: '1' });
    const k = admit(keys, sig);
    admit(keys, sig);
    keys.settle(sig, k, 'UNKNOWN');
    expect(keys.size).toBe(1);
    keys.settle(sig, k, 'UNKNOWN');
    expect(admit(keys, sig)).toBe(k);
  });

  it('ignores a stale settlement: an old attempt cannot forget the current key or resurrect a resolved one', () => {
    const keys = createRetryKeys(counter());
    const sig = requestSignature('products.create', {});
    const old = admit(keys, sig);
    const concurrent = admit(keys, sig);
    keys.settle(sig, old, 'APPLIED'); // resolved while `concurrent` is still in flight
    const fresh = admit(keys, sig); // a NEW command with the same body
    expect(fresh).not.toBe(old);
    keys.settle(sig, fresh, 'UNKNOWN');
    keys.settle(sig, concurrent, 'APPLIED'); // late answer for the old key: must not end the new command
    expect(admit(keys, sig)).toBe(fresh);
  });

  describe('bounded capacity (FE12-01): full means refuse a NEW request, never evict an unresolved one', () => {
    const fill = (capacity: number) => {
      const keys = createRetryKeys(counter(), capacity);
      const sigs = Array.from({ length: capacity }, (_, i) => requestSignature('op', { i }));
      const issued = sigs.map((s) => admit(keys, s));
      // Half answered UNKNOWN (idle unresolved), half still in flight: all unresolved.
      sigs.forEach((s, i) => {
        if (i % 2 === 0) keys.settle(s, issued[i] ?? '', 'UNKNOWN');
      });
      return { keys, sigs, issued };
    };

    it('the provisional capacity is 16 and is only a fixture-era placeholder', () => {
      expect(PROVISIONAL_RETRY_CAPACITY).toBe(16);
    });

    it('refuses a genuinely new request when full, mints nothing, and keeps every unresolved identity', () => {
      let minted = 0;
      const keys = createRetryKeys(() => `k${++minted}`, 3);
      const sigs = ['a', 'b', 'c'].map((x) => requestSignature('op', { x }));
      const issued = sigs.map((s) => admit(keys, s));
      expect(minted).toBe(3);
      expect(keys.begin(requestSignature('op', { x: 'new' }))).toBeNull();
      expect(minted).toBe(3); // nothing was minted for the refused request
      expect(keys.size).toBe(3);
      sigs.forEach((s, i) => expect(admit(keys, s)).toBe(issued[i]));
    });

    it('an existing unresolved request stays retryable at full capacity, concurrent attempts included', () => {
      const { keys, sigs, issued } = fill(4);
      sigs.forEach((s, i) => expect(admit(keys, s)).toBe(issued[i])); // retry or concurrent join, full or not
      expect(keys.begin(requestSignature('op', { other: true }))).toBeNull();
    });

    it('a definite outcome releases capacity, so a new request is admitted afterwards', () => {
      const { keys, sigs, issued } = fill(4);
      const first = sigs[0] ?? '';
      expect(keys.begin(requestSignature('op', { next: 1 }))).toBeNull();
      admit(keys, first); // joins; the entry now has an unknown attempt plus one in flight
      keys.settle(first, issued[0] ?? '', 'APPLIED'); // definite
      keys.settle(first, issued[0] ?? '', 'APPLIED'); // entry already gone: ignored
      expect(keys.size).toBe(3);
      expect(keys.begin(requestSignature('op', { next: 1 }))).not.toBeNull();
    });

    it('an unknown outcome releases nothing', () => {
      const { keys, sigs, issued } = fill(2);
      sigs.forEach((s, i) => keys.settle(s, issued[i] ?? '', 'UNKNOWN'));
      expect(keys.size).toBe(2);
      expect(keys.begin(requestSignature('op', { next: 1 }))).toBeNull();
    });

    it('a repeat of the same request after a definite answer takes the SAME slot, so it is admitted even when the store is otherwise full', () => {
      const keys = createRetryKeys(counter(), 2);
      const a = requestSignature('op', { a: 1 });
      const b = requestSignature('op', { b: 1 });
      const ka = admit(keys, a);
      admit(keys, b);
      admit(keys, a); // second attempt in flight
      keys.settle(a, ka, 'REFUSED'); // definitive for the request while one attempt is still outstanding
      const again = keys.begin(a); // a NEW command with the same body: replaces the resolved entry, adds no slot
      expect(again).not.toBeNull();
      expect(again).not.toBe(ka);
      expect(keys.size).toBe(2);
      expect(keys.begin(requestSignature('op', { c: 1 }))).toBeNull();
    });

    it('a stale settlement cannot release or resolve a newer identity at full capacity', () => {
      const keys = createRetryKeys(counter(), 1);
      const sig = requestSignature('op', {});
      const old = admit(keys, sig);
      admit(keys, sig);
      keys.settle(sig, old, 'APPLIED');
      const fresh = admit(keys, sig);
      keys.settle(sig, old, 'APPLIED'); // late answer of the old attempt
      expect(keys.size).toBe(1);
      expect(admit(keys, sig)).toBe(fresh);
      expect(keys.begin(requestSignature('op', { x: 1 }))).toBeNull();
    });
  });

  it('releases entries only on a definite answer, so the store shrinks back when requests resolve', () => {
    const keys = createRetryKeys(counter());
    const sigs = ['p', 'q', 'r'].map((x) => requestSignature('op', { x }));
    const issued = sigs.map((s) => admit(keys, s));
    sigs.forEach((s, i) => keys.settle(s, issued[i] ?? '', 'UNKNOWN'));
    expect(keys.size).toBe(3);
    sigs.forEach((s, i) => {
      admit(keys, s);
      keys.settle(s, issued[i] ?? '', 'APPLIED');
    });
    expect(keys.size).toBe(0);
  });

  it('separate stores (another Seller scope or another session) never share a key', () => {
    const mint = counter();
    const alem = createRetryKeys(mint);
    const biruk = createRetryKeys(mint);
    const sig = requestSignature('inbox.reply.send', { body: 'hi' });
    const k = admit(alem, sig);
    alem.settle(sig, k, 'UNKNOWN');
    expect(admit(biruk, sig)).not.toBe(k);
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
