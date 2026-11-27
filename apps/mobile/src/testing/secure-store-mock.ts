// In-memory expo-secure-store for tests, keyed like the real one, so a "restart" sees what an earlier render wrote. Recovered
// from the archived Mobile tree (recovery/legacy-dev-20261125, src/testing/secure-store-mock.ts), unchanged in behaviour.
// Use in a test file:  jest.mock('expo-secure-store', () => jest.requireActual('../testing/secure-store-mock'));
export const memory = new Map<string, string>();

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 'WHEN_UNLOCKED_THIS_DEVICE_ONLY';
export const getItemAsync = jest.fn(async (key: string) => memory.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  memory.set(key, value);
});
export const deleteItemAsync = jest.fn(async (key: string) => {
  memory.delete(key);
});

export function resetSecureStore(entries: Record<string, string> = {}) {
  memory.clear();
  for (const [key, value] of Object.entries(entries)) memory.set(key, value);
  getItemAsync.mockClear();
  setItemAsync.mockClear();
  deleteItemAsync.mockClear();
}
