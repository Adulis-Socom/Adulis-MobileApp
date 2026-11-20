import { asLineId } from '../cart/model';
import { AdapterUnavailable, type CartAdapter, type Scope } from '../cart/port';
import { disabledCartAdapter } from './disabled';
import { REAL_ADAPTER_GAPS, createRealCartAdapter } from './real';

const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => true };
const set = { lineId: asLineId('line-1'), quantity: 2, idempotencyKey: 'key-1' };
const remove = { lineId: asLineId('line-1'), idempotencyKey: 'key-2' };

describe.each([
  ['the disabled adapter', disabledCartAdapter, 'ADAPTER_DISABLED'],
  ['the real adapter slot', createRealCartAdapter(), 'CONTRACT_MISSING'],
] as const)('%s and the two edit operations', (_name, adapter: CartAdapter, reason) => {
  let fetchMock: jest.Mock;
  let original: typeof fetch;
  beforeEach(() => {
    original = globalThis.fetch;
    fetchMock = jest.fn(() => Promise.reject(new Error('no network is allowed')));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = original;
  });

  it('REJECTS setQuantity and removeLine with AdapterUnavailable and their reason, never resolving', async () => {
    const port = adapter.bind(scope);
    await expect(port.setQuantity(set)).rejects.toBeInstanceOf(AdapterUnavailable);
    await expect(port.setQuantity(set)).rejects.toMatchObject({ reason });
    await expect(port.removeLine(remove)).rejects.toBeInstanceOf(AdapterUnavailable);
    await expect(port.removeLine(remove)).rejects.toMatchObject({ reason });
  });

  it('makes no network call for either', async () => {
    const port = adapter.bind(scope);
    await port.setQuantity(set).catch(() => undefined);
    await port.removeLine(remove).catch(() => undefined);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('what the real adapter slot is waiting for, for edits', () => {
  it('lists the gaps of both edit operations, in words that say what the contract does not yet carry', () => {
    expect(REAL_ADAPTER_GAPS.setQuantity.length).toBeGreaterThan(0);
    expect(REAL_ADAPTER_GAPS.removeLine.length).toBeGreaterThan(0);
    const text = [...REAL_ADAPTER_GAPS.setQuantity, ...REAL_ADAPTER_GAPS.removeLine].join(' ');
    expect(text).toMatch(/does not yet type/);
    expect(text).toMatch(/key requirement for edits is not yet declared/);
  });

  it('lists that no operation changes the option of a line', () => {
    const text = [...REAL_ADAPTER_GAPS.getCarts, ...REAL_ADAPTER_GAPS.addLine].join(' ');
    expect(text).toMatch(/no operation changes the option of a line/);
  });

  it('lists the send-time session check for each edit operation', () => {
    for (const gaps of [REAL_ADAPTER_GAPS.setQuantity, REAL_ADAPTER_GAPS.removeLine]) {
      expect(
        gaps.some((gap) => /session that asked is still the session on screen/.test(gap)),
      ).toBe(true);
    }
  });
});
