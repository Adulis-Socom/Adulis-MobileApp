import { uuid } from 'expo';
import * as SecureStore from 'expo-secure-store';

/**
 * The app's device identity (ADU-MOB-02 v4.3 S68-S69): generated once, persisted in the
 * platform keystore, and kept across launches, sign-out and session expiry, so anonymous
 * state is never orphaned. It identifies the install; it is not a credential (AUTH-02 v3.3
 * S39). The id is a native v4 uuid (expo's SecureRandom-backed generator).
 */
export interface DeviceStorage {
  readId(): Promise<string | null>;
  writeId(id: string): Promise<void>;
  /** The id the server has registered (POST /v1/devices), so registration runs once. */
  readRegistered(): Promise<string | null>;
  writeRegistered(id: string): Promise<void>;
}

const ID_KEY = 'adulis.device.id';
const REGISTERED_KEY = 'adulis.device.registered';

export const secureDeviceStorage: DeviceStorage = {
  readId: () => SecureStore.getItemAsync(ID_KEY),
  writeId: (id) => SecureStore.setItemAsync(ID_KEY, id),
  readRegistered: () => SecureStore.getItemAsync(REGISTERED_KEY),
  writeRegistered: (id) => SecureStore.setItemAsync(REGISTERED_KEY, id),
};

/**
 * The stored id, or a new one written for next time. A keystore that cannot be READ gets
 * an id for this launch only and is not overwritten: the failure may be transient, and
 * replacing a good id would orphan this install's anonymous state.
 */
export async function loadDeviceId(storage: DeviceStorage): Promise<string> {
  let stored: string | null;
  try {
    stored = await storage.readId();
  } catch (error) {
    warn('unreadable; using an id for this launch only', error);
    return uuid.v4();
  }
  if (stored) return stored;
  const created = uuid.v4();
  await storage.writeId(created).catch((error: unknown) => warn('could not be saved', error));
  return created;
}

function warn(what: string, error: unknown) {
  console.warn(`[device] install id ${what}:`, error instanceof Error ? error.message : 'unknown error');
}
