// GOV-06 S1/S2 on the selector: the fixture is reachable only when BOTH build-time operands allow it, live never
// reaches a fixture, and the live transport fails closed without sending anything. These tests do not prove that the
// fixtures are absent from a release bundle: scripts/verify-release.mjs scans the real export for that.
import { asDeviceId, asEpoch } from '../contracts/gap-mob-session';
import { FIXTURE_BANNER, FIXTURE_IDS, fixtureTransport } from '../fixtures';
import { liveTransport } from './live';
import { TransportError } from './port';
import { selectTransport } from './select';

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const original = { dev: devGlobal.__DEV__, flag: process.env.EXPO_PUBLIC_ADULIS_FIXTURES, fetch: globalThis.fetch };
const stamp = { epoch: asEpoch(1), accountRef: null, deviceId: asDeviceId('dv-real') };

afterEach(() => {
  globalThis.fetch = original.fetch;
  devGlobal.__DEV__ = original.dev;
  if (original.flag === undefined) delete process.env.EXPO_PUBLIC_ADULIS_FIXTURES;
  else process.env.EXPO_PUBLIC_ADULIS_FIXTURES = original.flag;
});

async function select(dev: boolean, flag: string | undefined) {
  devGlobal.__DEV__ = dev;
  if (flag === undefined) delete process.env.EXPO_PUBLIC_ADULIS_FIXTURES;
  else process.env.EXPO_PUBLIC_ADULIS_FIXTURES = flag;
  return selectTransport();
}

describe('selectTransport', () => {
  it('selects the fixture only in a development build with the explicit opt-in', async () => {
    const selection = await select(true, 'on');
    expect(selection.transport.kind).toBe('fixture');
    expect(selection.fixtureUi?.bannerText).toBe(FIXTURE_BANNER);
    expect(selection.fixtureEnv).toEqual({ deviceId: FIXTURE_IDS.device });
  });

  it.each([
    ['a release build (__DEV__ false) even with the flag on', false, 'on'],
    ['a development build without the flag', true, undefined],
    ['a development build with any other flag value', true, 'true'],
  ] as const)('selects live, with no fixture UI or environment, for %s', async (_name, dev, flag) => {
    const selection = await select(dev, flag);
    expect(selection.transport.kind).toBe('live');
    expect(selection.fixtureUi).toBeNull();
    expect(selection.fixtureEnv).toBeNull();
  });
});

describe('live transport', () => {
  it('fails closed with UNAVAILABLE for every operation and sends nothing', async () => {
    const fetchSpy = jest.fn().mockRejectedValue(new Error('network must not be used'));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(liveTransport.json('bootstrap.get', {}, { stamp, bearer: null })).rejects.toMatchObject({ code: 'UNAVAILABLE', messageKey: 'error.request.internal' });
    await expect(liveTransport.json('session.requestCode', { destination: 'x' }, { stamp, bearer: null })).rejects.toBeInstanceOf(TransportError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a reserved identifier or a fixture credential as REFUSED, still sending nothing', async () => {
    const fetchSpy = jest.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(liveTransport.json('device.register', { deviceId: asDeviceId('fx_device_x'), platform: 'ios' }, { stamp, bearer: null })).rejects.toMatchObject({ code: 'REFUSED' });
    await expect(liveTransport.json('bootstrap.get', {}, { stamp, bearer: 'fx_cred_x' })).rejects.toMatchObject({ code: 'REFUSED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not refuse an identifier-shaped word typed as free text: only identifier fields are checked', async () => {
    await expect(liveTransport.json('session.requestCode', { destination: 'fx_rate' }, { stamp, bearer: null })).rejects.toMatchObject({ code: 'UNAVAILABLE' });
  });
});

describe('fixture transport', () => {
  it('opens no network and refuses an operation it does not serve', async () => {
    const fetchSpy = jest.fn().mockRejectedValue(new Error('network must not be used'));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    await expect(fixtureTransport.json('payment.confirm' as never, {} as never, { stamp, bearer: null })).rejects.toMatchObject({ code: 'REFUSED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
