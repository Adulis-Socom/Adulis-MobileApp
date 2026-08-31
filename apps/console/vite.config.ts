import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * ADU-CON-02 v3.0 section 3.9 — Vite over Next.js, security-driven.
 *
 * A Vite SPA emits ZERO inline scripts, which is what lets the console run
 * `script-src 'self'` with no nonce and no 'unsafe-inline' (public/_headers).
 * Next.js injects inline bootstrap scripts and would force the nonce machinery
 * of ADU-SEC-01 section 8.
 *
 * NOT configured here, deliberately: vite-plugin-pwa. It is front-end scope
 * (COO/CTO) and the Tier 0 work order excludes it. When it lands, the service
 * worker precaches the app shell ONLY; /v1/* is NetworkOnly — never a cached
 * authenticated response, no offline queue — and a new worker prompts rather
 * than silently reloading under a seller mid-payout-change (section 3.11).
 */
const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string };

export default defineConfig({
  // X-Adulis-Client carries `web/<version>` on every request (ADU-API-01 S3).
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  /**
   * envDir is deliberately NOT pointed at the workspace root. Doing so makes
   * the console's build read the root `.env`, which carries
   * NODE_ENV=development -- and Vite then selects React's DEVELOPMENT build,
   * doubling the bundle and shipping development warnings to sellers. That
   * is the hazard `.env.example` warns about in as many words, and the
   * `production-react` gate exists to catch it. VITE_API_BASE_URL reaches Vite from the SHELL
   * instead (Vite reads VITE_-prefixed vars out of process.env), which is
   * what `apps/console/CLAUDE.md`'s recipe loads.
   */
  plugins: [react()],
  build: {
    outDir: 'dist',
    // No eval-based sourcemaps: CI greps the build output for 'unsafe-eval'
    // and fails if it appears (section 16).
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
