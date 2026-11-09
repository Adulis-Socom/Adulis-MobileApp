import { uuid } from 'expo';
import * as SecureStore from 'expo-secure-store';

import { newIdempotencyKey } from '../api/client';

/**
 * The app's device identity (ADU-MOB-02 v4.3 S68-S69): generated once, persisted in the
 * platform keystore, and kept across launches, sign-out and session expiry, so anonymous
 * state is never orphaned. It identifies the install; it is not a credential (AUTH-02 v3.3
 * S39) and not an idempotency key. The id is a native v4 uuid (expo's SecureRandom-backed
 * generator).
 */
export interface DeviceStorage {
  readId(): Promise<string | null>;
  writeId(id: string): Promise<void>;
  /** The id the server has registered (POST /v1/devices), so registration runs once. */
  readRegistered(): Promise<string | null>;
  writeRegistered(id: string): Promise<void>;
  /** The Idempotency-Key of a registration the server has not answered yet. */
  readRegistrationKey(): Promise<string | null>;
  writeRegistrationKey(key: string): Promise<void>;
  clearRegistrationKey(): Promise<void>;
}

const ID_KEY = 'adulis.device.id';
const REGISTERED_KEY = 'adulis.device.registered';
const REGISTRATION_KEY = 'adulis.device.registration_key';

export const secureDeviceStorage: DeviceStorage = {
  readId: () => SecureStore.getItemAsync(ID_KEY),
  writeId: (id) => SecureStore.setItemAsync(ID_KEY, id),
  readRegistered: () => SecureStore.getItemAsync(REGISTERED_KEY),
  writeRegistered: (id) => SecureStore.setItemAsync(REGISTERED_KEY, id),
  readRegistrationKey: () => SecureStore.getItemAsync(REGISTRATION_KEY),
  writeRegistrationKey: (key) => SecureStore.setItemAsync(REGISTRATION_KEY, key),
  clearRegistrationKey: () => SecureStore.deleteItemAsync(REGISTRATION_KEY),
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
    warn('install id unreadable; using an id for this launch only', error);
    return uuid.v4();
  }
  if (stored) return stored;
  const created = uuid.v4();
  await storage.writeId(created).catch((error: unknown) => warn('install id could not be saved', error));
  return created;
}

/**
 * The Idempotency-Key for registering this install: a UUIDv7 (ADU-API-01 S8), one per
 * registration intent. Saved before the first attempt, so a retry after a lost answer or
 * after a restart replays the same request. Unreadable storage gets a key for this attempt
 * only, without overwriting one that may still be pending.
 */
export async function loadRegistrationKey(storage: DeviceStorage): Promise<string> {
  let stored: string | null;
  try {
    stored = await storage.readRegistrationKey();
  } catch (error) {
    warn('registration key unreadable; using a key for this attempt only', error);
    return newIdempotencyKey();
  }
  if (stored) return stored;
  const created = newIdempotencyKey();
  await storage
    .writeRegistrationKey(created)
    .catch((error: unknown) => warn('registration key could not be saved', error));
  return created;
}

/** The registration intent is over (confirmed, or answered with a refusal): the next one gets a new key. */
export async function endRegistrationIntent(storage: DeviceStorage): Promise<void> {
  await storage
    .clearRegistrationKey()
    .catch((error: unknown) => warn('registration key could not be removed', error));
}

function warn(what: string, error: unknown) {
  console.warn(`[device] ${what}:`, error instanceof Error ? error.message : 'unknown error');
}
