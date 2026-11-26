import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Builds ONLY the test-only render-failure harness (e2e/harness). Fixtures are off: nothing here is a demonstration world. */
export default defineConfig({
  root: 'e2e/harness',
  plugins: [react()],
  define: { __FIXTURES__: 'false' },
  envDir: import.meta.dirname,
  build: { outDir: '../../dist-harness', emptyOutDir: true, sourcemap: false, target: 'es2023' },
});
