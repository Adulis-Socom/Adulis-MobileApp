// Expo's default Metro configuration (https://docs.expo.dev/guides/customizing-metro/), the same
// one Expo uses when no metro.config.js exists.
//
// WO-010A: when ADULIS_METRO_CACHE is set (ops/scripts/adulis-ssd-env.sh, development machines only)
// Metro's transform cache and file-map cache live in that shared directory on the development SSD,
// reused across work orders. Metro keys cache entries by file content and transformer/config
// versions, so a dependency change makes new entries rather than reusing stale ones. Unset (CI,
// other machines), nothing changes.
/* eslint-disable @typescript-eslint/no-require-imports -- Metro loads this file as CommonJS. */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const shared = process.env.ADULIS_METRO_CACHE;
if (shared) {
  // Expo's own FileStore (it honours Expo's skipCache entries), resolved through expo: pnpm does not
  // hoist @expo/metro-config here.
  const { FileStore } = require(require.resolve('@expo/metro-config/file-store', { paths: [require.resolve('expo/package.json')] }));
  config.cacheStores = [new FileStore({ root: path.join(shared, 'transform') })];
  config.fileMapCacheDirectory = path.join(shared, 'file-map');
}

module.exports = config;
