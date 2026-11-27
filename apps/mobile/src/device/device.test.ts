// Device context (MOB-FE-01 s6): created once, kept across sign-out, one registration in flight, honest about failure.
import { asDeviceId } from '../contracts/gap-mob-session';
import { createFixtureTransport, PERSONAS } from '../fixtures';
import { makeRuntime, settle, signIn } from '../testing/harness';
import { TransportError } from '../transport/port';
import { createMemoryDeviceStorage, DeviceController, loadDeviceId, newDeviceId } from './device';

describe('device id', () => {
  it('is created once and read back, never re-created', async () => {
    const storage = createMemoryDeviceStorage();
    const first = await loadDeviceId(storage, () => 'dv-one');
    const second = await loadDeviceId(storage, () => 'dv-two');
    expect([first, second]).toEqual(['dv-one', 'dv-one']);
  });

  it('an unreadable store gives a process-lifetime id and writes nothing by guesswork', async () => {
    const writes: string[] = [];
    const storage = { ...createMemoryDeviceStorage(), readId: () => Promise.reject(new Error('unreadable')), writeId: (id: string) => Promise.resolve(void writes.push(id)) };
    expect(await loadDeviceId(storage, () => 'dv-temp')).toBe('dv-temp');
    expect(writes).toEqual([]);
  });

  it('a real identifier never begins with the reserved fixture prefix', () => {
    expect(newDeviceId().startsWith('fx_')).toBe(false);
  });

  it('survives sign-out and expiry (it is not a credential)', async () => {
    const world = createFixtureTransport();
    const { runtime } = await makeRuntime(world.transport);
    await runtime.start();
    const id = runtime.device.context().deviceId;
    await signIn(runtime, PERSONAS[0]?.phone as string);
    await settle();
    await runtime.session.signOut();
    expect(runtime.device.context().deviceId).toBe(id);
  });
});

describe('registration', () => {
  const controller = () => new DeviceController(asDeviceId('dv-1'), 'android', createMemoryDeviceStorage());

  it('shares one attempt between concurrent callers', async () => {
    const device = controller();
    let calls = 0;
    const register = () =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          calls += 1;
          resolve();
        }, 0),
      );
    const [a, b] = await Promise.all([device.ensureRegistered(register), device.ensureRegistered(register)]);
    expect(calls).toBe(1);
    expect([a.kind, b.kind]).toEqual(['REGISTERED', 'REGISTERED']);
  });

  it('is not repeated after a restart that remembers it', async () => {
    const storage = createMemoryDeviceStorage({ registered: 'dv-1' });
    const device = new DeviceController(asDeviceId('dv-1'), 'ios', storage);
    const register = jest.fn().mockResolvedValue(undefined);
    expect((await device.ensureRegistered(register)).kind).toBe('REGISTERED');
    expect(register).not.toHaveBeenCalled();
  });

  it('offline or unavailable stays UNREGISTERED so a later attempt can succeed; a refusal is REFUSED', async () => {
    const device = controller();
    expect((await device.ensureRegistered(() => Promise.reject(new TransportError('NETWORK')))).kind).toBe('UNREGISTERED');
    expect((await device.ensureRegistered(() => Promise.reject(new TransportError('UNAVAILABLE')))).kind).toBe('UNREGISTERED');
    expect((await device.ensureRegistered(() => Promise.reject(new TransportError('PERMISSION_DENIED')))).kind).toBe('REFUSED');
    expect((await device.ensureRegistered(() => Promise.resolve())).kind).toBe('REGISTERED');
  });

  it('observes network state without persisting it', () => {
    const device = controller();
    const seen: string[] = [];
    device.subscribe((context) => seen.push(context.network));
    device.setNetwork('OFFLINE');
    device.setNetwork('OFFLINE');
    device.setNetwork('ONLINE');
    expect(seen).toEqual(['OFFLINE', 'ONLINE']);
  });
});
