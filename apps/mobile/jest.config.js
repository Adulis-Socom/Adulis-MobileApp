// The mobile Jest configuration (moved from package.json in WO-010A, unchanged, so that the cache
// directory can follow ADULIS_JEST_CACHE).
//
// ADULIS_JEST_CACHE is set by ops/scripts/adulis-ssd-env.sh on development machines: the transform
// cache then lives in a shared directory on the development SSD and is reused across work orders.
// Jest keys entries by file content, transformer and configuration, and writes them atomically, so
// concurrent runs and dependency changes are safe. Unset (CI, other machines), Jest's default applies.
module.exports = {
  preset: "jest-expo",
  setupFiles: [
    "<rootDir>/jest.setup.ts"
  ],
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@shopify/flash-list))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/"
  ],
  ...(process.env.ADULIS_JEST_CACHE ? { cacheDirectory: process.env.ADULIS_JEST_CACHE } : {}),
};
