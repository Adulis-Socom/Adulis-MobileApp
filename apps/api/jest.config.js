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
  // ESM-only dependencies that Node 22 loads natively (require(esm)) but Jest's module runtime cannot.
  '^.+\\.js$': ['@swc/jest', { jsc: { parser: { syntax: 'ecmascript' }, target: 'es2023' }, module: { type: 'commonjs' } }],
};
// ESM-only: path-to-regexp@9 (via @fastify/middie) and cookie@2 (via light-my-request). Every other dependency
// stays untransformed; add a package here only when Jest reports it.
const ESM_ONLY = '(?:path-to-regexp|cookie)';
const transformIgnorePatterns = [`/node_modules/(?!\\.pnpm/${ESM_ONLY}@|${ESM_ONLY}/)`];

module.exports = {
  projects: [
    { displayName: 'unit', rootDir: __dirname, testEnvironment: 'node', transform, transformIgnorePatterns, setupFiles: ['reflect-metadata'], testMatch: ['<rootDir>/src/**/*.spec.ts'] },
    {
      displayName: 'integration',
      rootDir: __dirname,
      testEnvironment: 'node',
      transform,
      transformIgnorePatterns,
      setupFiles: ['reflect-metadata'],
      testMatch: ['<rootDir>/test/**/*.int.ts'],
      testTimeout: 60000,
    },
  ],
};
