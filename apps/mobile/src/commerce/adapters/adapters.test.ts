import { asVariantId } from '../cart/model';
import { AdapterUnavailable, type CartAdapter, type Scope } from '../cart/port';
import { disabledCartAdapter } from './disabled';
import { REAL_ADAPTER_GAPS, createRealCartAdapter } from './real';

const scope: Scope = { kind: 'guest', epoch: 1, isCurrent: () => true };
const request = { variantId: asVariantId('de000000-0000-4000-8000-000000000001'), quantity: 1, idempotencyKey: 'key-1' };

describe.each([
  ['the disabled adapter', disabledCartAdapter, 'ADAPTER_DISABLED'],
  ['the real adapter slot', createRealCartAdapter(), 'CONTRACT_MISSING'],
] as const)('%s', (_name, adapter: CartAdapter, reason) => {
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

  it('says it is unavailable, with its reason, and returns nothing', () => {
    expect(adapter.availability).toEqual({ available: false, reason });
    expect(adapter.provenance).toBeNull();
    expect(adapter.mode).toBe('disabled');
  });

  it('REJECTS every call with AdapterUnavailable, never resolving', async () => {
    const port = adapter.bind(scope);
    await expect(port.getCarts()).rejects.toBeInstanceOf(AdapterUnavailable);
    await expect(port.getCarts()).rejects.toMatchObject({ reason });
    await expect(port.addLine(request)).rejects.toBeInstanceOf(AdapterUnavailable);
  });

  it('makes no network call', async () => {
    const port = adapter.bind(scope);
    await port.getCarts().catch(() => undefined);
    await port.addLine(request).catch(() => undefined);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('the real adapter slot', () => {
  it('lists, for every method of the port, what it is waiting for', () => {
    const port = createRealCartAdapter().bind(scope);
    for (const method of Object.keys(port)) {
      expect(REAL_ADAPTER_GAPS[method as keyof typeof REAL_ADAPTER_GAPS]?.length).toBeGreaterThan(0);
    }
    expect(Object.keys(REAL_ADAPTER_GAPS).sort()).toEqual(Object.keys(port).sort());
  });

  it('describes the gaps in neutral words: what the contract does not carry, never how a route behaves', () => {
    const text = Object.values(REAL_ADAPTER_GAPS).flat().join(' ');
    expect(text).not.toMatch(/collid|collision|unique|without checking|does not check|writes|bypass|vulnerab|exploit/i);
  });
});
