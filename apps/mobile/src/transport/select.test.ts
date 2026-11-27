// GOV-06 S1/S2 on the selector: the fixture is reachable only when BOTH build-time operands allow it, live never
// reaches a fixture, and the live transport fails closed without sending anything. These tests do not prove that the
// fixtures are absent from a release bundle: scripts/verify-release.mjs scans the real export for that.
import { FIXTURE_BANNER } from '../fixtures';
import { TransportError } from './port';

const devGlobal = globalThis as unknown as { __DEV__: boolean };
const original = { dev: devGlobal.__DEV__, flag: process.env.EXPO_PUBLIC_ADULIS_FIXTURES, fetch: globalThis.fetch };

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
  const { selectTransport } = await import('./select');
  return selectTransport();
}

describe('selectTransport', () => {
  it('selects the fixture only in a development build with the explicit opt-in', async () => {
    const selection = await select(true, 'on');
    expect(selection.transport.kind).toBe('fixture');
    expect(selection.fixtureUi?.bannerText).toBe(FIXTURE_BANNER);
  });

  it.each([
    ['a release build (__DEV__ false) even with the flag on', false, 'on'],
    ['a development build without the flag', true, undefined],
    ['a development build with any other flag value', true, 'true'],
  ] as const)('selects live, with no fixture UI, for %s', async (_name, dev, flag) => {
    const selection = await select(dev, flag);
    expect(selection.transport.kind).toBe('live');
    expect(selection.fixtureUi).toBeNull();
  });
});

describe('live transport', () => {
  it('fails closed with UNAVAILABLE and sends nothing', async () => {
    const fetchSpy = jest.fn().mockRejectedValue(new Error('network must not be used'));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { liveTransport } = await import('./live');
    await expect(liveTransport.request('bootstrap')).rejects.toMatchObject({ code: 'UNAVAILABLE', messageKey: 'error.request.internal' });
    await expect(liveTransport.request('bootstrap')).rejects.toBeInstanceOf(TransportError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('fixture transport', () => {
  it('opens no network and refuses everything', async () => {
    const fetchSpy = jest.fn().mockRejectedValue(new Error('network must not be used'));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const { fixtureTransport } = await import('../fixtures');
    await expect(fixtureTransport.request('bootstrap')).rejects.toMatchObject({ code: 'REFUSED' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
