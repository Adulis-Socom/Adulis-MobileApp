import { afterEach, describe, expect, it, vi } from 'vitest';
import { containsReservedId, liveTransport } from './live';
import { TransportError } from './port';

afterEach(() => vi.unstubAllGlobals());

async function failure(promise: Promise<unknown>): Promise<TransportError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TransportError) return error;
    throw error;
  }
  throw new Error('expected the call to fail');
}

describe('live transport (release behaviour)', () => {
  it('is an honest UNAVAILABLE for every operation and sends nothing (no Seller contract exists yet)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect((await failure(liveTransport.send('auth.otp.start', { phone: '+251911000000' }))).code).toBe('UNAVAILABLE');
    expect((await failure(liveTransport.send('account.context.get', {}))).code).toBe('UNAVAILABLE');
    expect((await failure(liveTransport.send('seller.home.get', {}, { sellerId: 'seller_real_1' }))).code).toBe('UNAVAILABLE');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('RN-5: refuses a reserved fixture id before anything is sent, wherever it hides', async () => {
    expect((await failure(liveTransport.send('seller.home.get', {}, { sellerId: 'fx_seller_alem' }))).code).toBe('REFUSED');
    expect((await failure(liveTransport.send('auth.otp.verify', { challenge_id: 'fx_otp_1', code: '1' }))).code).toBe('REFUSED');
    expect(containsReservedId({ a: [{ b: 'fx_x' }] })).toBe(true);
    expect(containsReservedId({ a: ['seller_real'] })).toBe(false);
  });

  it('a Seller-scoped operation without a Seller is a client bug, not an unavailable service', async () => {
    expect((await failure(liveTransport.send('seller.readiness.get', {}))).code).toBe('REFUSED');
  });
});
