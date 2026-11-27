import '@adulis/tokens/tokens.css';
import '../../src/styles/console.css';
import { createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';
import { rootRoute } from '../../src/router';

/**
 * TEST-ONLY harness, built separately (vite.harness.config.ts) and never part of the Console, the fixture build or a
 * release: it mounts the REAL error wiring (the app ErrorBoundary and the router's root errorElement) around a
 * component that deliberately throws while rendering. The Console itself has no crash control.
 */
const SECRET = 'SECRET-SELLER-DATA-DO-NOT-SHOW';

function Thrower(): ReactNode {
  throw new Error(`deliberate render failure: ${SECRET}`);
}

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing');
const mode = new URLSearchParams(window.location.search).get('mode');
createRoot(root).render(
  mode === 'boundary'
    ? createElement(ErrorBoundary, null, createElement(Thrower))
    : createElement(RouterProvider, { router: createMemoryRouter(rootRoute([{ path: '/', element: createElement(Thrower) }])) }),
);
