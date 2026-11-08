import * as SecureStore from 'expo-secure-store';

/**
 * Where the MOBILE bearer token lives: native secure storage, never AsyncStorage
 * (ADU-API-01 S5.1, ADU-AUTH-01 S19.2). The token is opaque -- stored and sent as-is,
 * never decoded; authority is the server's per-request session read.
 */
export interface SessionStorage {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
}

const TOKEN_KEY = 'adulis.session.token';

export const secureSessionStorage: SessionStorage = {
  read: () => SecureStore.getItemAsync(TOKEN_KEY),
  write: (token) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
