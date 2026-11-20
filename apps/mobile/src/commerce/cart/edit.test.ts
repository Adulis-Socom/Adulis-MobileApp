import { KEY_SAFE_MS } from '../../api/mutation';
import { cartSet, line, listed, sellerCart, UNVERIFIED, VERIFIED } from '../testing/builders';
import {
  IDLE_EDIT,
  parseQuantity,
  reduceEdit,
  toEditInput,
  type EditIntent,
  type EditState,
  type EditTarget,
} from './edit';
import type { EditJudgement } from './edit-outcome';
import { asLineId } from './model';
import type { Freshness } from './view-state';

const L1 = asLineId('line-1');
const NOW = 5_000_000;
const SET3: EditTarget = { kind: 'SET_QUANTITY', lineId: L1, quantity: 3 };
const REMOVE: EditTarget = { kind: 'REMOVE', lineId: L1 };

const begin = (
  state: EditState = IDLE_EDIT,
  target: EditTarget = SET3,
  over: Partial<{ key: string; now: number; online: boolean }> = {},
) => reduceEdit(state, { type: 'BEGIN', target, key: 'key-1', now: NOW, online: true, ...over });
const intentOf = (state: EditState): EditIntent => {
  if (!('intent' in state)) throw new Error(`no intent in ${state.kind}`);
  return state.intent;
};
const failed = (state: EditState, judgement: EditJudgement, now = NOW + 10) =>
  reduceEdit(state, { type: 'FAILED', judgement, now });
const UNKNOWN_J: EditJudgement = { outcome: 'unknown', replay: true, holdMs: null };
const UNRESOLVED_J: EditJudgement = { outcome: 'unknown', replay: false, holdMs: null };
const read = (state: EditState, verdict: 'SATISFIED' | 'LINE_GONE' | 'NOT_SHOWN' | 'NOT_A_BASIS') =>
  reduceEdit(state, { type: 'READ', verdict });

describe('a quantity the Buyer typed', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['007', 7],
    ['99', 99],
    ['100000', 100_000],
    ['9007199254740991', Number.MAX_SAFE_INTEGER],
  ])('%s is the quantity %d', (text, expected) => {
    expect(parseQuantity(text)).toBe(expected);
  });

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['zero', '0'],
    ['zeros', '000'],
    ['a minus sign', '-1'],
    ['a plus sign', '+1'],
    ['a fraction', '1.5'],
    ['a comma', '1,5'],
    ['letters', 'abc'],
    ['a digit with a letter', '1a'],
    ['padding', ' 3'],
    ['trailing padding', '3 '],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
    ['an exponent', '1e3'],
    ['a number too large to be exact', '9007199254740993'],
    ['an Ethiopic digit', '\u1369'],
    ['an Arabic-Indic digit', '\u0663'],
    ['a full-width digit', '\uFF13'],
  ])('refuses %s', (_name, text) => {
    expect(parseQuantity(text)).toBeNull();
  });
});

describe('what an edit may name from the cart view on screen', () => {
  const view = (freshness: Freshness = VERIFIED) =>
    listed(cartSet(sellerCart([line('line-1', { quantity: 2 })])), freshness);

  it('names a removal of a line of a verified view', () => {
    expect(toEditInput(view(), L1, 'REMOVE')).toEqual({ ok: true, target: REMOVE });
  });

  it("names a quantity that differs from the server's, a very large one, and 1", () => {
    expect(toEditInput(view(), L1, 'SET_QUANTITY', 3)).toEqual({ ok: true, target: SET3 });
    expect(toEditInput(view(), L1, 'SET_QUANTITY', 100_000)).toMatchObject({ ok: true });
    expect(toEditInput(view(), L1, 'SET_QUANTITY', 1)).toMatchObject({ ok: true });
  });

  it('names nothing for a quantity that is not a positive safe whole number', () => {
    for (const quantity of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      2 ** 53,
      1e21,
      undefined,
    ]) {
      expect(toEditInput(view(), L1, 'SET_QUANTITY', quantity)).toEqual({
        ok: false,
        reason: 'INVALID_QUANTITY',
      });
    }
  });

  it('names nothing for the quantity the server already shows', () => {
    expect(toEditInput(view(), L1, 'SET_QUANTITY', 2)).toEqual({ ok: false, reason: 'UNCHANGED' });
  });

  it('names nothing for a line the answer does not hold', () => {
    expect(toEditInput(view(), asLineId('absent'), 'REMOVE')).toEqual({
      ok: false,
      reason: 'LINE_ABSENT',
    });
    expect(toEditInput(view(), asLineId('absent'), 'SET_QUANTITY', 3)).toEqual({
      ok: false,
      reason: 'LINE_ABSENT',
    });
  });

  it('names nothing from a view that is not verified, or that is not a list', () => {
    expect(toEditInput(view(UNVERIFIED), L1, 'REMOVE')).toEqual({
      ok: false,
      reason: 'NOT_VERIFIED',
    });
    expect(toEditInput({ kind: 'LOADING', waitingForConnection: false }, L1, 'REMOVE')).toEqual({
      ok: false,
      reason: 'NOT_VERIFIED',
    });
    expect(toEditInput({ kind: 'ERROR', error: null }, L1, 'REMOVE')).toEqual({
      ok: false,
      reason: 'NOT_VERIFIED',
    });
    expect(toEditInput({ kind: 'DISABLED', reason: 'ADAPTER_DISABLED' }, L1, 'REMOVE')).toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
  });

  it("names an edit from a view that is being read again (the last answer is still the server's word)", () => {
    expect(toEditInput(view({ kind: 'REVALIDATING' }), L1, 'REMOVE')).toMatchObject({ ok: true });
  });
});

describe('beginning an edit', () => {
  it('sends when the device is online: one intent with its key, target and start time fixed', () => {
    expect(begin()).toEqual({
      kind: 'SENDING',
      intent: { ...SET3, key: 'key-1', startedAt: NOW, attempts: 1 },
    });
    expect(begin(IDLE_EDIT, REMOVE)).toEqual({
      kind: 'SENDING',
      intent: { ...REMOVE, key: 'key-1', startedAt: NOW, attempts: 1 },
    });
  });

  it('sends nothing when the device is known to be offline, and queues nothing', () => {
    expect(begin(IDLE_EDIT, SET3, { online: false })).toEqual({
      kind: 'OFFLINE_NOT_SENT',
      intent: { ...SET3, key: 'key-1', startedAt: NOW, attempts: 0 },
    });
  });

  it('a second begin over an edit that is pending, or accepted and waiting for a read, changes nothing', () => {
    for (const state of [
      begin(),
      begin(IDLE_EDIT, SET3, { online: false }),
      failed(begin(), UNKNOWN_J),
      reduceEdit(begin(), { type: 'ACCEPTED' }),
    ]) {
      expect(begin(state, { ...SET3, quantity: 9 }, { key: 'key-2' })).toBe(state);
    }
  });

  it('a second begin over an edit that could not be resolved changes nothing: only dismissing it starts over', () => {
    const unresolved = failed(begin(), UNRESOLVED_J);
    expect(unresolved.kind).toBe('UNRESOLVED');
    expect(begin(unresolved, SET3, { key: 'key-2' })).toBe(unresolved);
    const dismissed = reduceEdit(unresolved, { type: 'DISMISS' });
    expect(dismissed).toBe(IDLE_EDIT);
    expect(intentOf(begin(dismissed, SET3, { key: 'key-2' })).key).toBe('key-2');
  });

  it('a finished edit does not stop the next one, which has its own key', () => {
    for (const state of [
      failed(begin(), { outcome: 'refused', code: null }),
      failed(begin(), { outcome: 'gone' }),
      read(reduceEdit(begin(), { type: 'ACCEPTED' }), 'SATISFIED'),
    ]) {
      expect(intentOf(begin(state, REMOVE, { key: 'key-2' })).key).toBe('key-2');
    }
  });
});

describe('what an attempt leaves behind', () => {
  it('a 2xx is APPLIED, which claims nothing', () => {
    expect(reduceEdit(begin(), { type: 'ACCEPTED' }).kind).toBe('APPLIED');
  });

  it('a 2xx is only taken from an edit that is in flight', () => {
    expect(reduceEdit(IDLE_EDIT, { type: 'ACCEPTED' })).toBe(IDLE_EDIT);
    const unknown = failed(begin(), UNKNOWN_J);
    expect(reduceEdit(unknown, { type: 'ACCEPTED' })).toBe(unknown);
  });

  it("the API's own refusal is REFUSED with its code", () => {
    expect(failed(begin(), { outcome: 'refused', code: 'VALIDATION_FAILED' })).toMatchObject({
      kind: 'REFUSED',
      code: 'VALIDATION_FAILED',
    });
  });

  it('a 404 ends as LINE_GONE for both kinds of edit', () => {
    expect(failed(begin(), { outcome: 'gone' }).kind).toBe('LINE_GONE');
    expect(failed(begin(IDLE_EDIT, REMOVE), { outcome: 'gone' }).kind).toBe('LINE_GONE');
  });

  it('no proof either way is UNKNOWN, with the wait the server asked for; a key that cannot be replayed is UNRESOLVED', () => {
    expect(failed(begin(), UNKNOWN_J)).toMatchObject({ kind: 'UNKNOWN', holdUntil: null });
    expect(
      failed(begin(), { outcome: 'unknown', replay: true, holdMs: 7000 }, NOW + 10),
    ).toMatchObject({
      kind: 'UNKNOWN',
      holdUntil: NOW + 10 + 7000,
    });
    expect(failed(begin(), UNRESOLVED_J).kind).toBe('UNRESOLVED');
  });

  it('an unknown outcome is never shown as REFUSED, and a failure outside SENDING changes nothing', () => {
    expect(failed(begin(), UNKNOWN_J).kind).not.toBe('REFUSED');
    expect(failed(begin(), UNRESOLVED_J).kind).not.toBe('REFUSED');
    const applied = reduceEdit(begin(), { type: 'ACCEPTED' });
    expect(failed(applied, UNKNOWN_J)).toBe(applied);
    expect(failed(IDLE_EDIT, UNKNOWN_J)).toBe(IDLE_EDIT);
  });
});

describe('trying again', () => {
  const unknown = () => failed(begin(), UNKNOWN_J);
  const retry = (state: EditState, over: Partial<{ now: number; online: boolean }> = {}) =>
    reduceEdit(state, { type: 'RETRY', now: NOW + 100, online: true, ...over });

  it('sends the SAME key and body again, counting the attempt', () => {
    const after = retry(unknown());
    expect(after.kind).toBe('SENDING');
    expect(intentOf(after)).toEqual({ ...SET3, key: 'key-1', startedAt: NOW, attempts: 2 });
  });

  it('while known offline, sends nothing and says so once', () => {
    const after = retry(unknown(), { online: false });
    expect(after).toMatchObject({ kind: 'UNKNOWN', offlineNotice: true });
    expect(retry(after, { online: false })).toBe(after);
  });

  it('waits out a hold the server asked for', () => {
    const held = failed(begin(), { outcome: 'unknown', replay: true, holdMs: 5000 });
    expect(retry(held, { now: NOW + 10 + 4999 })).toBe(held);
    expect(retry(held, { now: NOW + 10 + 5000 }).kind).toBe('SENDING');
  });

  it('turns a key that is past its safe age, or from a clock stepped back, into UNRESOLVED', () => {
    expect(retry(unknown(), { now: NOW + KEY_SAFE_MS }).kind).toBe('UNRESOLVED');
    expect(retry(unknown(), { now: NOW - 1 }).kind).toBe('UNRESOLVED');
    expect(retry(unknown(), { now: NOW + KEY_SAFE_MS - 1 }).kind).toBe('SENDING');
  });

  it("sends an edit that was never sent only when the device is online, and starts the key's age then", () => {
    const offline = begin(IDLE_EDIT, SET3, { online: false });
    expect(retry(offline, { online: false })).toBe(offline);
    const sent = retry(offline, { now: NOW + 500 });
    expect(sent.kind).toBe('SENDING');
    expect(intentOf(sent)).toMatchObject({ key: 'key-1', startedAt: NOW + 500, attempts: 1 });
  });

  it('is not offered to an unresolved or a refused edit', () => {
    const unresolved = failed(begin(), UNRESOLVED_J);
    const refused = failed(begin(), { outcome: 'refused', code: null });
    expect(retry(unresolved)).toBe(unresolved);
    expect(retry(refused)).toBe(refused);
  });
});

describe('what a read does to an edit', () => {
  const applied = () => reduceEdit(begin(), { type: 'ACCEPTED' });
  const unknown = () => failed(begin(), UNKNOWN_J);
  const unresolved = () => failed(begin(), UNRESOLVED_J);

  it.each([
    ['an accepted edit', applied, 'SATISFIED', 'CONFIRMED'],
    ['an unknown edit', unknown, 'SATISFIED', 'CONFIRMED'],
    ['an unresolved edit', unresolved, 'SATISFIED', 'CONFIRMED'],
    ['an accepted edit', applied, 'LINE_GONE', 'LINE_GONE'],
    ['an unknown edit', unknown, 'LINE_GONE', 'LINE_GONE'],
    ['an unresolved edit', unresolved, 'LINE_GONE', 'LINE_GONE'],
    ['an accepted edit', applied, 'NOT_SHOWN', 'IDLE'],
    ['an accepted edit', applied, 'NOT_A_BASIS', 'IDLE'],
    ['an unknown edit', unknown, 'NOT_SHOWN', 'UNKNOWN'],
    ['an unknown edit', unknown, 'NOT_A_BASIS', 'UNKNOWN'],
    ['an unresolved edit', unresolved, 'NOT_SHOWN', 'UNRESOLVED'],
    ['an unresolved edit', unresolved, 'NOT_A_BASIS', 'UNRESOLVED'],
  ] as const)('for %s a read that says %s leaves %s', (_name, make, verdict, expected) => {
    expect(read(make(), verdict).kind).toBe(expected);
  });

  it('an unknown edit that no read confirms is never REFUSED, and stays replayable', () => {
    const state = unknown();
    expect(read(state, 'NOT_SHOWN')).toBe(state);
    expect(read(state, 'NOT_SHOWN').kind).not.toBe('REFUSED');
  });

  it('never touches an edit that is sending, finished or absent', () => {
    for (const state of [begin(), IDLE_EDIT, failed(begin(), { outcome: 'refused', code: null })]) {
      expect(read(state, 'SATISFIED')).toBe(state);
      expect(read(state, 'LINE_GONE')).toBe(state);
    }
    const confirmed = read(applied(), 'SATISFIED');
    expect(read(confirmed, 'LINE_GONE')).toBe(confirmed);
  });
});

describe('dismissing', () => {
  it('ends an edit that is waiting on the Buyer, and leaves one that is in flight alone', () => {
    for (const state of [
      failed(begin(), UNKNOWN_J),
      failed(begin(), UNRESOLVED_J),
      failed(begin(), { outcome: 'refused', code: null }),
      failed(begin(), { outcome: 'gone' }),
      begin(IDLE_EDIT, SET3, { online: false }),
    ]) {
      expect(reduceEdit(state, { type: 'DISMISS' })).toBe(IDLE_EDIT);
    }
    for (const state of [begin(), reduceEdit(begin(), { type: 'ACCEPTED' }), IDLE_EDIT]) {
      expect(reduceEdit(state, { type: 'DISMISS' })).toBe(state);
    }
  });
});
