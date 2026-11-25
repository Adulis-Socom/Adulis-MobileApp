// Jest (DEPLOY-01 S100) through SWC, which, unlike esbuild, emits the decorator metadata Nest's DI reads.
// unit: src/**/*.spec.ts, no services. integration: test/**/*.int.ts, real PostgreSQL and Valkey (CI services
// or the disposable target); they FAIL, never skip, when the services are absent.
const transform = {
  '^.+\\.ts$': [
    '@swc/jest',
    {
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2023',
      },
      module: { type: 'commonjs' },
    },
  ],
};

module.exports = {
  projects: [
    { displayName: 'unit', rootDir: __dirname, testEnvironment: 'node', transform, setupFiles: ['reflect-metadata'], testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      displayName: 'integration',
      rootDir: __dirname,
      testEnvironment: 'node',
      transform,
      setupFiles: ['reflect-metadata'],
      testMatch: ['<rootDir>/test/**/*.int.ts'],
      testTimeout: 60000,
    },
  ],
};
