import { endRegistrationIntent, loadRegistrationKey, type DeviceStorage } from './device-storage';

jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));

const UUID7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function keyStorage(stored: string | null = null): jest.Mocked<DeviceStorage> {
  return {
    readId: jest.fn(),
    writeId: jest.fn(),
    readRegistered: jest.fn(),
    writeRegistered: jest.fn(),
    readRegistrationKey: jest.fn(async () => stored),
    writeRegistrationKey: jest.fn(async (_key: string) => undefined),
    clearRegistrationKey: jest.fn(async () => undefined),
  };
}

let warn: jest.SpyInstance;
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => warn.mockRestore());

describe('registration key', () => {
  it('reuses a pending key as it is', async () => {
    const storage = keyStorage('019a6b2e-5f3c-7a1b-8c2d-3e4f5a6b7c8d');
    await expect(loadRegistrationKey(storage)).resolves.toBe('019a6b2e-5f3c-7a1b-8c2d-3e4f5a6b7c8d');
    expect(storage.writeRegistrationKey).not.toHaveBeenCalled();
  });

  it('saves a new UUIDv7 before handing it out when none is pending', async () => {
    const storage = keyStorage();
    const key = await loadRegistrationKey(storage);
    expect(key).toMatch(UUID7);
    expect(storage.writeRegistrationKey).toHaveBeenCalledWith(key);
  });

  it('unreadable storage: a key for this attempt only, never overwriting one that may be pending', async () => {
    const storage = keyStorage();
    storage.readRegistrationKey.mockRejectedValue(new Error('keystore locked'));
    await expect(loadRegistrationKey(storage)).resolves.toMatch(UUID7);
    expect(storage.writeRegistrationKey).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).toContain('keystore locked');
  });

  it('a failed save still gives a usable key, and says so', async () => {
    const storage = keyStorage();
    storage.writeRegistrationKey.mockRejectedValue(new Error('disk full'));
    await expect(loadRegistrationKey(storage)).resolves.toMatch(UUID7);
    expect(JSON.stringify(warn.mock.calls)).toContain('disk full');
  });

  it('ending the intent logs a failed delete instead of throwing', async () => {
    const storage = keyStorage();
    storage.clearRegistrationKey.mockRejectedValue(new Error('delete refused'));
    await expect(endRegistrationIntent(storage)).resolves.toBeUndefined();
    expect(JSON.stringify(warn.mock.calls)).toContain('delete refused');
  });
});
