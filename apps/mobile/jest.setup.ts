// FlashList measures its viewport natively; its own Jest setup fakes a 400x900 one.
import '@shopify/flash-list/jestSetup';

// expo-network's native module does not exist under Jest. Connectivity only matters on a
// device, so tests are always online and get a listener that never fires.
jest.mock('expo-network', () => ({
  addNetworkStateListener: () => ({ remove: () => undefined }),
  getNetworkStateAsync: async () => ({ isConnected: true }),
}));
