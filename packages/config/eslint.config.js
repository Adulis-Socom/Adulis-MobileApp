// Shared flat ESLint config, consumed by both apps from the workspace root.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      // Generated and never hand-edited.
      // ADU-REPO-01 S2 moves the generated client out of apps/console/src/api/
      // and into packages/api-client/. The old path stays ignored so a stale
      // branch does not start failing lint mid-restructure.
      'apps/console/src/api/**',
      'packages/api-client/src/schema.d.ts',
      'contracts/openapi.json',
      '**/openapi.json',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // ADU-CON-02 v3.0 section 3.1 / CLAUDE.md: strict: true with no escapes.
      // `any` is the escape hatch that quietly reintroduces the class of mistakes
      // strict mode exists to catch, so it is an error, not a warning.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // API and worker run on Node.
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
    rules: {
      /**
       * ADU-RUL-03 S1.1 -- the logger is the only egress from apps/api.
       *
       * Pino's redaction allow-list (logging.ts) governs what reaches a log
       * line: a field appears BECAUSE it is named. `console.*` writes
       * straight to stdout and is governed by nothing, so the guarantee
       * "fields are logged because they were named" held only for code that
       * used the logger -- and the [FAKE SMS] print walked around it with a
       * phone number and a live OTP. An allow-list any module can bypass is
       * a convention with a config file.
       *
       * apps/console is deliberately NOT covered: a browser console is not
       * stdout and holds no server credentials.
       */
      'no-console': 'error',
    },
  },
  {
    /**
     * ONE exemption, in the rule rather than in the code, so that it is
     * visible here instead of as a disable comment someone can copy.
     * Two CLIs, neither of which serves a request or handles a credential:
     * generate-openapi.ts writes one line naming the file it just wrote, and
     * the load-test harness prints the measurements that are its entire
     * output (wave timings, RSS growth). Both belong on a terminal rather
     * than in a JSON log stream.
     */
    files: ['apps/api/src/generate-openapi.ts', 'apps/api/test-load/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // The console runs in a browser.
    files: ['apps/console/**/*.ts', 'apps/console/**/*.tsx'],
    languageOptions: { globals: globals.browser },
  },
  {
    // Operational scripts and tool configs: plain Node, not part of a TS project.
    // The disableTypeChecked spread comes FIRST: it carries its own
    // languageOptions, so spreading it after ours would drop the globals.
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: { ...globals.node },
      sourceType: 'module',
    },
  },
  {
    // CommonJS tool configs specifically.
    files: ['**/jest.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
);
