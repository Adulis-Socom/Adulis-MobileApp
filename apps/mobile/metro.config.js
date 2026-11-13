// ADU-MOB-01 S17.1 -- the app is one workspace in a pnpm monorepo and imports
// three workspace packages as TypeScript SOURCE (@adulis/tokens, @adulis/locale,
// @adulis/api-client). Expo's Metro config detects the workspace root and adds
// it to watchFolders; this file exists so that detection is EXPLICIT and a
// reader does not have to know it happens. Nothing else is configured: no
// resolver override, no extra sourceExts, no asset plugin.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..', '..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so an edit to packages/tokens or packages/locale
// reloads, and resolve modules from both the app and the workspace root
// (pnpm hoists nothing, so both node_modules are real).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
