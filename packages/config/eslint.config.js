// Shared flat ESLint config, consumed from the workspace root (`pnpm lint`). Lints the ACTIVE replacement
// workspace only (ARC-BE-01): the archived legacy surfaces and historical tooling are ignored, never built.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Archived legacy surfaces: not workspace members until SC-FE-01 / MOB-FE-01 rebuild them.
      'apps/console/**',
      'apps/mobile/**',
      // Historical, reviewed at their own stage (RBL-01 path map), never part of the replacement build.
      'ops/native/**',
      'ops/load/**',
      'docs/**',
      '_staging/**',
      // Generated and never hand-edited.
      'packages/api-client/src/schema.d.ts',
      'contracts/openapi.json',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // strict: true with no escapes. `any` quietly reintroduces what strict mode exists to catch.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // API and worker run on Node. The logger is the only egress: console.* bypasses the redaction
    // allow-list (OBS-01 S11), so it is an error, not a warning. CLIs write to process.stdout/stderr.
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: { 'no-console': 'error' },
  },
  {
    // Type-level tests declare types only to assert them.
    files: ['**/*.test-d.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  {
    // Operational scripts and tool configs: plain Node. disableTypeChecked comes FIRST: it carries its own
    // languageOptions, so spreading it after ours would drop the globals.
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: { ...globals.node }, sourceType: 'module' },
  },
  {
    files: ['**/jest.config.js', '**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
);
