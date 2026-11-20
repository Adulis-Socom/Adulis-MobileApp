import { createEditStore, type EditStore } from './edit-store';
import type { EditTarget } from './edit';
import { asLineId } from './model';
import type { Scope } from './port';

const L1 = asLineId('line-1');
const L2 = asLineId('line-2');
const SET3: EditTarget = { kind: 'SET_QUANTITY', lineId: L1, quantity: 3 };
const SET5: EditTarget = { kind: 'SET_QUANTITY', lineId: L1, quantity: 5 };
const REMOVE: EditTarget = { kind: 'REMOVE', lineId: L1 };

let live: boolean;
let keys: number;
let store: EditStore;
const scope = (epoch = 1): Scope => ({ kind: 'account', epoch, isCurrent: () => live });
const context = (over: Partial<{ now: number; online: boolean }> = {}) => ({
  now: 1_000,
  online: true,
  mintKey: () => `key-${++keys}`,
  ...over,
});

beforeEach(() => {
  live = true;
  keys = 0;
  store = createEditStore();
});

describe('beginning an edit', () => {
  it('two begin calls in the same tick, with no React and no await between them, are one edit with one key', () => {
    const first = store.begin(scope(), SET3, context());
    const second = store.begin(scope(), SET3, context());
    expect(first?.result).toBe('started');
    expect(second?.result).toBe('same');
    expect(keys).toBe(1);
    expect(second?.state).toBe(first?.state);
  });

  it('a different quantity or a different kind while one is pending is ignored, and mints no key', () => {
    store.begin(scope(), SET3, context());
    expect(store.begin(scope(), SET5, context())?.result).toBe('ignored');
    expect(store.begin(scope(), REMOVE, context())?.result).toBe('ignored');
    expect(keys).toBe(1);
  });

  it('two lines are independent: each has its own edit and its own key', () => {
    store.begin(scope(), SET3, context());
    const other = store.begin(scope(), { kind: 'REMOVE', lineId: L2 }, context());
    expect(other?.result).toBe('started');
    expect(keys).toBe(2);
    expect(store.read(scope(), L1).kind).toBe('SENDING');
    expect(store.read(scope(), L2).kind).toBe('SENDING');
  });

  it('records an edit begun offline as not sent, and a second begin for it is the same edit', () => {
    const first = store.begin(scope(), SET3, context({ online: false }));
    expect(first).toMatchObject({ result: 'offline', state: { kind: 'OFFLINE_NOT_SENT' } });
    expect(store.begin(scope(), SET3, context({ online: false }))?.result).toBe('same');
    expect(keys).toBe(1);
  });

  it('does not begin another edit over one that could not be resolved, and mints no key', () => {
    store.begin(scope(), SET3, context());
    store.apply(scope(), L1, {
      type: 'FAILED',
      judgement: { outcome: 'unknown', replay: false, holdMs: null },
      now: 1_010,
    });
    expect(store.read(scope(), L1).kind).toBe('UNRESOLVED');
    expect(store.begin(scope(), SET3, context())?.result).toBe('ignored');
    expect(store.begin(scope(), SET5, context())?.result).toBe('ignored');
    expect(keys).toBe(1);
    store.dismiss(scope(), L1);
    expect(store.begin(scope(), SET3, context())?.result).toBe('started');
    expect(keys).toBe(2);
  });

  it('refuses to begin for a scope that is not the current one', () => {
    live = false;
    expect(store.begin(scope(), SET3, context())).toBeNull();
    expect(keys).toBe(0);
  });

  it('a finished edit does not stop the next one', () => {
    store.begin(scope(), SET3, context());
    store.apply(scope(), L1, {
      type: 'FAILED',
      judgement: { outcome: 'refused', code: null },
      now: 1_010,
    });
    expect(store.begin(scope(), REMOVE, context())?.result).toBe('started');
    expect(keys).toBe(2);
  });
});

describe('reading and applying', () => {
  it('reads IDLE for a line with no edit and for a scope that is not current', () => {
    expect(store.read(scope(), L1).kind).toBe('IDLE');
    store.begin(scope(), SET3, context());
    live = false;
    expect(store.read(scope(), L1).kind).toBe('IDLE');
    expect(store.apply(scope(), L1, { type: 'ACCEPTED' })).toBeNull();
  });

  it('shows no edit to another epoch', () => {
    store.begin(scope(1), SET3, context());
    expect(store.read(scope(2), L1).kind).toBe('IDLE');
  });

  it('returns the same state object when an event changes nothing', () => {
    store.begin(scope(), SET3, context());
    const before = store.read(scope(), L1);
    expect(store.apply(scope(), L1, { type: 'READ', verdict: 'NOT_A_BASIS' })).toBe(before);
    expect(store.read(scope(), L1)).toBe(before);
  });
});

describe('an edit that ended without proof and was dismissed', () => {
  const unknown = () => {
    store.begin(scope(), SET3, context());
    store.apply(scope(), L1, {
      type: 'FAILED',
      judgement: { outcome: 'unknown', replay: true, holdMs: null },
      now: 1_010,
    });
  };

  it('marks the line, and the mark holds no quantity and no key', () => {
    unknown();
    expect(store.unconfirmed(scope(), L1)).toBe(false);
    store.dismiss(scope(), L1);
    expect(store.unconfirmed(scope(), L1)).toBe(true);
    expect(store.read(scope(), L1).kind).toBe('IDLE');
    expect(store.unconfirmed(scope(), L2)).toBe(false);
  });

  it('is not set by dismissing an edit that was refused', () => {
    store.begin(scope(), SET3, context());
    store.apply(scope(), L1, {
      type: 'FAILED',
      judgement: { outcome: 'refused', code: null },
      now: 1_010,
    });
    store.dismiss(scope(), L1);
    expect(store.unconfirmed(scope(), L1)).toBe(false);
  });

  it('is cleared when a later edit of the line is CONFIRMED', () => {
    unknown();
    store.dismiss(scope(), L1);
    store.begin(scope(), SET3, context());
    expect(store.unconfirmed(scope(), L1)).toBe(true);
    store.apply(scope(), L1, { type: 'ACCEPTED' });
    store.apply(scope(), L1, { type: 'READ', verdict: 'SATISFIED' });
    expect(store.unconfirmed(scope(), L1)).toBe(false);
  });

  it('is cleared when the line is gone', () => {
    unknown();
    store.dismiss(scope(), L1);
    store.begin(scope(), REMOVE, context());
    store.apply(scope(), L1, { type: 'FAILED', judgement: { outcome: 'gone' }, now: 1_010 });
    expect(store.unconfirmed(scope(), L1)).toBe(false);
  });

  it('is not shown to another scope, and is emptied by clear', () => {
    unknown();
    store.dismiss(scope(), L1);
    expect(store.unconfirmed(scope(2), L1)).toBe(false);
    store.clear();
    expect(store.unconfirmed(scope(), L1)).toBe(false);
  });
});

describe('an epoch change', () => {
  it('empties the store: nothing of the old session is read by the new one', () => {
    store.begin(scope(1), SET3, context());
    store.clear({ silent: true });
    expect(store.read(scope(1), L1).kind).toBe('IDLE');
    expect(store.read(scope(2), L1).kind).toBe('IDLE');
    expect(store.begin(scope(2), SET3, context())?.result).toBe('started');
  });
});

describe('watching the store', () => {
  it('tells watchers once per change, and not for a silent clear or an unchanged apply', () => {
    const told = jest.fn();
    const stop = store.subscribe(told);
    store.begin(scope(), SET3, context());
    expect(told).toHaveBeenCalledTimes(1);
    store.begin(scope(), SET3, context());
    expect(told).toHaveBeenCalledTimes(1);
    store.apply(scope(), L1, { type: 'READ', verdict: 'NOT_A_BASIS' });
    expect(told).toHaveBeenCalledTimes(1);
    store.apply(scope(), L1, { type: 'ACCEPTED' });
    expect(told).toHaveBeenCalledTimes(2);
    store.clear({ silent: true });
    expect(told).toHaveBeenCalledTimes(2);
    stop();
    store.begin(scope(), SET3, context());
    expect(told).toHaveBeenCalledTimes(2);
  });

  it('a clear that is not silent tells watchers', () => {
    const told = jest.fn();
    store.begin(scope(), SET3, context());
    store.subscribe(told);
    store.clear();
    expect(told).toHaveBeenCalledTimes(1);
  });
});
