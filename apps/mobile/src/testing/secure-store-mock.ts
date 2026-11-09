/**
 * In-memory expo-secure-store for tests, keyed like the real one, so the app's separate
 * entries (session credential, device id, registration) behave as on a device and a
 * "restart" sees what an earlier render wrote. Use in a test file:
 *
 *   jest.mock('expo-secure-store', () => require('../testing/secure-store-mock'));
 */
export const memory = new Map<string, string>();

export const getItemAsync = jest.fn(async (key: string) => memory.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  memory.set(key, value);
});
export const deleteItemAsync = jest.fn(async (key: string) => {
  memory.delete(key);
});

export const TOKEN_KEY = 'adulis.session.token';

export function resetSecureStore(entries: Record<string, string> = {}) {
  memory.clear();
  for (const [key, value] of Object.entries(entries)) memory.set(key, value);
  getItemAsync.mockClear();
  setItemAsync.mockClear();
  deleteItemAsync.mockClear();
}
