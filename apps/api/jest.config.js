/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  // Tests and hooks alike. The e2e setups build the Nest app and their fixtures through the API;
  // under parallel workers several exceeded the 5 s default in their beforeAll, failing whole
  // suites intermittently (ON-20261111-011). Assertions are unaffected.
  testTimeout: 30_000,
};
