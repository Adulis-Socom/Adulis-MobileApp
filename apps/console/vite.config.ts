import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * FIXTURES ARE A BUILD-TIME DECISION (GOV-06 S2). `__FIXTURES__` is a compile-time constant, so a build that
 * is not allowed to carry fixtures folds the dynamic import in src/transport/select.ts away and the fixture
 * chunk is never emitted.
 *
 * Allowed only for the dev server (`serve`) and for the explicit `fixture-control` mode, which CI uses to run
 * the journeys and as the release scan's positive control. A release build is `vite build` in the default
 * `production` mode: ADULIS_FIXTURES=on has no effect there, and scripts/verify-release.mjs proves it.
 */
export default defineConfig(({ command, mode }) => {
  const requested = process.env['ADULIS_FIXTURES'] === 'on';
  const allowed = command === 'serve' || mode === 'fixture-control';
  return {
    plugins: [react()],
    define: { __FIXTURES__: JSON.stringify(requested && allowed) },
    // Never the workspace root: the root carries NODE_ENV=development settings and would ship React's dev build.
    envDir: import.meta.dirname,
    build: { sourcemap: false, target: 'es2023' },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
  };
});
