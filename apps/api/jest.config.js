/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  // WO-INFRA-012: refuses any database not marked disposable (test/db-target.ts) before a suite runs.
  globalSetup: '<rootDir>/test/global-setup.ts',
  // ...and after the last suite, fails the run on any orphan beyond the known test leaks.
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  // Tests and hooks alike. The e2e setups build the Nest app and their fixtures through the API;
  // under parallel workers several exceeded the 5 s default in their beforeAll, failing whole
  // suites intermittently (ON-20261111-011). Assertions are unaffected.
  testTimeout: 30_000,
};
