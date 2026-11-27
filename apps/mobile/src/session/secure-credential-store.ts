// The native credential store: expo-secure-store (Keychain / Keystore), device-bound, never backed up to another device.
// Imported by the provider only, so unit tests of the session logic never load the native module.
import * as SecureStore from 'expo-secure-store';

import type { CredentialStore } from './credential-store';

const TOKEN_KEY = 'adulis.session.token';
const SIGNED_OUT_KEY = 'adulis.session.signed_out';
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureCredentialStore: CredentialStore = {
  read: () => SecureStore.getItemAsync(TOKEN_KEY, OPTIONS),
  write: (credential) => SecureStore.setItemAsync(TOKEN_KEY, credential, OPTIONS),
  delete: () => SecureStore.deleteItemAsync(TOKEN_KEY, OPTIONS),
  readSignedOutFlag: async () => (await SecureStore.getItemAsync(SIGNED_OUT_KEY, OPTIONS)) === '1',
  writeSignedOutFlag: (on) => (on ? SecureStore.setItemAsync(SIGNED_OUT_KEY, '1', OPTIONS) : SecureStore.deleteItemAsync(SIGNED_OUT_KEY, OPTIONS)),
};
