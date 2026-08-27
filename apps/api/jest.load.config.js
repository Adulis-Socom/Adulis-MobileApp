/**
 * Phase D load tests (ADU-CON-02-A1 section 6). Run separately from the
 * suite (`pnpm --filter @adulis/api test:load`): they seed hundreds of
 * fixtures and measure latency, which has no place inside the CI gate.
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  roots: ['<rootDir>/test-load'],
  testRegex: 'loadtest[.]ts$',
  transform: { '^.+[.]ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
};
