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
export default defineConfig({
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
