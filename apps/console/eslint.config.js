// The Console's own ESLint config. The workspace root ignores apps/console (packages/config is its own PR),
// so the Console lints itself: `pnpm lint` runs here, with --max-warnings 0.
import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const FIXTURE_IMPORT = { group: ['**/fixtures', '**/fixtures/**'], message: 'Fixtures are reached only through src/transport/select.ts (GOV-06).' };
const APP_IMPORT = { group: ['**/apps/**', '@adulis/api', '@adulis/mobile', '@adulis/storefront'], message: 'Never import from another app (repository rule 2).' };

export default tseslint.config(
  { ignores: ['dist/**', 'dist-fixture/**', 'dist-release-scan/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'screenshots/**', '.impeccable/**'] },
  { linterOptions: { reportUnusedDisableDirectives: 'off' } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, __FIXTURES__: 'readonly' } },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'error',
      // No web storage and no token in JavaScript (the session is an httpOnly cookie when it exists).
      'no-restricted-globals': ['error', 'localStorage', 'sessionStorage'],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage' },
        { object: 'window', property: 'sessionStorage' },
        { object: 'document', property: 'cookie' },
      ],
      'no-restricted-imports': ['error', { patterns: [FIXTURE_IMPORT, APP_IMPORT] }],
      'no-restricted-syntax': ['error', { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Colour comes from @adulis/tokens custom properties, never a hex literal.' }],
    },
  },
  {
    // The one door to the fixtures, the fixtures themselves and the unit tests that exercise them.
    files: ['src/transport/select.ts', 'src/fixtures/**/*.{ts,tsx}', 'src/**/*.test.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [APP_IMPORT] }] },
  },
  {
    files: ['src/fixtures/**/*.{ts,tsx}'],
    rules: { 'no-restricted-properties': 'off' },
  },
  {
    files: ['e2e/**/*.ts', 'scripts/**/*.mjs', '*.config.ts', '*.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
