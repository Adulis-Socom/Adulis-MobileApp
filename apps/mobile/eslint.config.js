// The Mobile app's own ESLint config. The workspace root ignores apps/mobile (packages/config is its own PR), so
// Mobile lints itself: `pnpm lint` runs here with --max-warnings 0. Modelled on apps/console/eslint.config.js.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FIXTURE_IMPORT = { group: ['**/fixtures', '**/fixtures/**'], message: 'Fixtures are reached only through src/transport/select.ts (GOV-06).' };
const APP_IMPORT = { group: ['**/apps/**', '@adulis/api', '@adulis/console', '@adulis/storefront'], message: 'Never import from another app (repository rule 2).' };
// Strings come from @adulis/locale/mobile ONLY (founder decision D2, WO-001A): the root and console parts ship copy that must never be bundled.
const LOCALE_IMPORT = { regex: '^@adulis/locale(?!/mobile$)', message: 'Import the mobile-safe catalogue only: @adulis/locale/mobile.' };
const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({ name, message: 'Fixture data opens no network (GOV-06 S2).' }));

export default tseslint.config(
  { ignores: ['dist/**', 'dist-*/**', 'node_modules/**', '.expo/**', 'android/**', 'ios/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.es2023, __DEV__: 'readonly', process: 'readonly' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error',
      // No web storage: the credential lives in native secure storage only.
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage'],
      'no-restricted-imports': ['error', { patterns: [FIXTURE_IMPORT, APP_IMPORT, LOCALE_IMPORT] }],
      // Colour comes from @adulis/tokens, never a hex literal.
      'no-restricted-syntax': ['error', { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Colour comes from @adulis/tokens, never a hex literal.' }],
    },
  },
  {
    // The one door to the fixtures, and the unit tests that exercise them.
    files: ['src/transport/select.ts', 'src/**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [APP_IMPORT, LOCALE_IMPORT] }] },
  },
  {
    // The fixtures themselves: no network and no live transport (GOV-06 S2).
    files: ['src/fixtures/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage', ...NETWORK_GLOBALS],
      'no-restricted-imports': ['error', { patterns: [APP_IMPORT, LOCALE_IMPORT, { group: ['**/transport/live', '**/transport/live.*'], message: 'A fixture never imports the live transport (no fallback either way).' }] }],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}'],
    languageOptions: { globals: { ...globals.jest } },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js', 'jest.setup.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { 'no-console': 'off', '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
