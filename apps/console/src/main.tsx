import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@adulis/tokens/tokens.css';
import './console.css';
import { SessionProvider } from './auth/session';
import { MarketProvider } from './lib/market';
import { EnvironmentBanner } from './lib/EnvironmentBanner';
import { UpgradeGate } from './lib/UpgradeGate';
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
    {/*
      MarketProvider OUTSIDE SessionProvider, and the nesting is the contract
      rather than a preference: it makes the one /v1/bootstrap call, which
      mints the __Host- device cookie the server reads on every session
      request. Nothing session-shaped may precede it (D-118), so the session
      probe waits on this provider's `booting`.
    */}
    <MarketProvider>
      {/*
        THE BANNER SITS OUTSIDE THE ROUTER, not inside the Shell, because
        sign-in is outside the Shell -- and typing a real phone number into
        the wrong server is the mistake it exists to prevent (T23 Phase 4).
        It renders nothing on production.
      */}
      <EnvironmentBanner />
      <SessionProvider>
        <UpgradeGate>
          <RouterProvider router={router} />
        </UpgradeGate>
      </SessionProvider>
    </MarketProvider>
  </StrictMode>,
);
