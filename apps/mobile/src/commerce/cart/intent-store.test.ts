import { createIntentStore } from './intent-store';
import { asLineId, asVariantId } from './model';
import type { Scope } from './port';

const V1 = asVariantId('de000000-0000-4000-8000-000000000001');
const V2 = asVariantId('de000000-0000-4000-8000-000000000002');

/** A scope that stays current until the test ends it. */
function makeScope(epoch = 1, kind: Scope['kind'] = 'guest') {
  let current = true;
  const scope: Scope = { kind, epoch, isCurrent: () => current };
  return { scope, end: () => void (current = false) };
}

const ctx = (mintKey: () => string, over: Partial<{ now: number; online: boolean }> = {}) => ({
  now: 1000,
  online: true,
  mintKey,
  ...over,
});

describe('the pending adds of this run', () => {
  it('decides in the same tick, with no React: two begins one after the other are one add with ONE key', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    const mint = jest.fn(() => 'key-1');
    // Both calls happen before anything could re-render, as two taps in one frame do.
    const first = store.begin(scope, { variantId: V1, quantity: 2 }, ctx(mint));
    const second = store.begin(scope, { variantId: V1, quantity: 2 }, ctx(mint));
    expect(first?.result).toBe('started');
    expect(second?.result).toBe('same');
    expect(second?.state).toBe(first?.state);
    expect(mint).toHaveBeenCalledTimes(1);
  });

  it('does not make a key for an add that is not new', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 2 },
      ctx(() => 'key-1'),
    );
    const mint = jest.fn(() => 'key-2');
    store.begin(scope, { variantId: V1, quantity: 2 }, ctx(mint));
    expect(mint).not.toHaveBeenCalled();
  });

  it('ignores another quantity while one is pending, and keeps the first intent unchanged', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    const first = store.begin(
      scope,
      { variantId: V1, quantity: 2 },
      ctx(() => 'key-1'),
    );
    const other = store.begin(
      scope,
      { variantId: V1, quantity: 5 },
      ctx(() => 'key-2'),
    );
    expect(other?.result).toBe('ignored');
    expect(store.read(scope, V1)).toBe(first?.state);
  });

  it('keeps one add per option: another option is its own add with its own key', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    const other = store.begin(
      scope,
      { variantId: V2, quantity: 1 },
      ctx(() => 'key-2'),
    );
    expect(other?.result).toBe('started');
    expect(store.read(scope, V1)).toMatchObject({ intent: { key: 'key-1' } });
    expect(store.read(scope, V2)).toMatchObject({ intent: { key: 'key-2' } });
  });

  it('says offline and keeps the intent when the device is known to be offline', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    const begun = store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1', { online: false }),
    );
    expect(begun?.result).toBe('offline');
    expect(store.read(scope, V1).kind).toBe('OFFLINE_NOT_SENT');
  });

  it('does not begin over an add that could not be resolved, makes no key for it, and starts over only after it is dismissed', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    store.apply(scope, V1, {
      type: 'FAILED',
      judgement: { outcome: 'unknown', replay: false, holdMs: null },
      now: 1100,
    });
    const unresolved = store.read(scope, V1);
    expect(unresolved.kind).toBe('UNRESOLVED');
    const mint = jest.fn(() => 'key-2');
    const again = store.begin(scope, { variantId: V1, quantity: 1 }, ctx(mint));
    expect(again?.result).toBe('ignored');
    expect(again?.state).toBe(unresolved);
    expect(mint).not.toHaveBeenCalled();
    expect(store.read(scope, V1)).toBe(unresolved);

    store.dismiss(scope, V1);
    const fresh = store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-3'),
    );
    expect(fresh?.result).toBe('started');
    expect(store.read(scope, V1)).toMatchObject({ kind: 'SENDING', intent: { key: 'key-3' } });
  });

  it('starts a new add after the last one ended, with a new key', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    store.apply(scope, V1, { type: 'ACCEPTED', lineId: asLineId('l1') });
    const again = store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-2'),
    );
    expect(again?.result).toBe('started');
    expect(store.read(scope, V1)).toMatchObject({ kind: 'SENDING', intent: { key: 'key-2' } });
  });
});

describe('a session that has ended', () => {
  it('refuses to begin, apply or read for a scope that is no longer current', () => {
    const store = createIntentStore();
    const { scope, end } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    end();
    const mint = jest.fn(() => 'key-2');
    expect(store.begin(scope, { variantId: V1, quantity: 1 }, ctx(mint))).toBeNull();
    expect(mint).not.toHaveBeenCalled();
    expect(store.apply(scope, V1, { type: 'ACCEPTED', lineId: asLineId('l1') })).toBeNull();
    expect(store.read(scope, V1).kind).toBe('IDLE');
  });

  it('is emptied by clear(), and a later scope finds nothing of an earlier one', () => {
    const store = createIntentStore();
    const a = makeScope(1, 'account');
    store.begin(
      a.scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-a'),
    );
    store.clear();
    expect(store.read(a.scope, V1).kind).toBe('IDLE');
    const b = makeScope(2, 'account');
    expect(store.read(b.scope, V1).kind).toBe('IDLE');
  });

  it('never shows an entry to a scope of another epoch even when it was not cleared', () => {
    const store = createIntentStore();
    const a = makeScope(1, 'account');
    store.begin(
      a.scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-a'),
    );
    const b = makeScope(2, 'account');
    expect(store.read(b.scope, V1).kind).toBe('IDLE');
    const begun = store.begin(
      b.scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-b'),
    );
    expect(begun?.result).toBe('started');
  });
});

describe('dismissing and watching', () => {
  it('dismiss ends an unconfirmed add and marks the option', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    store.apply(scope, V1, {
      type: 'FAILED',
      judgement: { outcome: 'unknown', replay: true, holdMs: null },
      now: 1100,
    });
    expect(store.dismiss(scope, V1)).toEqual({ kind: 'IDLE', earlierUnconfirmed: true });
    expect(store.read(scope, V1)).toEqual({ kind: 'IDLE', earlierUnconfirmed: true });
  });

  it('tells a watcher once per change, and nothing for a change that changed nothing', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    const listener = jest.fn();
    const stop = store.subscribe(listener);
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-2'),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    store.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-3'),
    );
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('can be emptied without telling a watcher, for a caller that is rendering', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    const listener = jest.fn();
    store.subscribe(listener);
    store.clear({ silent: true });
    expect(listener).not.toHaveBeenCalled();
    expect(store.read(scope, V1).kind).toBe('IDLE');
  });

  it('hands out the same state object until something changes, so a view can compare by identity', () => {
    const store = createIntentStore();
    const { scope } = makeScope();
    store.begin(
      scope,
      { variantId: V1, quantity: 1 },
      ctx(() => 'key-1'),
    );
    expect(store.read(scope, V1)).toBe(store.read(scope, V1));
    expect(store.read(scope, V2)).toBe(store.read(scope, V2));
  });
});
