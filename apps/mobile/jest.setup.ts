// expo-network's native module does not exist under Jest. Connectivity only matters on a
// device, so tests are always online and get a listener that never fires.
jest.mock('expo-network', () => ({
  addNetworkStateListener: () => ({ remove: () => undefined }),
  getNetworkStateAsync: async () => ({ isConnected: true }),
}));
