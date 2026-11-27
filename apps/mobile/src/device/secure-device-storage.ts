// The native device storage (secure store). Imported by the provider only. Not a credential store: the device id is an
// identifier, kept in the same place so it survives sign-out and expiry.
import * as SecureStore from 'expo-secure-store';

import type { DeviceStorage } from './device';

export const secureDeviceStorage: DeviceStorage = {
  readId: () => SecureStore.getItemAsync('adulis.device.id'),
  writeId: (id) => SecureStore.setItemAsync('adulis.device.id', id),
  readRegistered: () => SecureStore.getItemAsync('adulis.device.registered'),
  writeRegistered: (id) => SecureStore.setItemAsync('adulis.device.registered', id),
};
