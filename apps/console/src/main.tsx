import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@adulis/tokens/tokens.css';
import './console.css';
import { SessionProvider } from './auth/session';
import { router } from './router';

/**
 * THE ONE DELIBERATE WAY TO BREAK THIS APP, and it exists so a gate can be
 * proven rather than trusted. `boot-smoke` (ops/scripts/verify-boot-smoke.mjs)
 * asserts the console MOUNTS; the only honest way to show an assertion fires
 * is to plant the failure it claims to catch. T7 Phase 5 shipped a bundle
 * that threw at module scope before React mounted, and every text-reading
 * gate stayed green, so this reproduces exactly that shape.
 *
 * It cannot ship. Vite substitutes `import.meta.env.VITE_SMOKE_BREAK` at
 * build time, so a build without the variable drops this branch, and
 * `boot-smoke` fails if the string `VITE_SMOKE_BREAK` appears in any shipped
 * bundle -- a planted throw that could reach production would be a worse
 * defect than the one it proves.
 */
if (import.meta.env.VITE_SMOKE_BREAK) {
  throw new Error('VITE_SMOKE_BREAK: deliberate module-scope throw, boot-smoke proof only');
}

const el = document.getElementById('root');
if (!el) throw new Error('#root missing from index.html');

createRoot(el).render(
  <StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </StrictMode>,
);
