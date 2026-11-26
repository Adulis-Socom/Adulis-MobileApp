import '@adulis/tokens/tokens.css';
import './styles/console.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { t } from './i18n/t';
import { createRouter } from './router';
import { SessionProvider } from './session/SessionProvider';
import { selectTransport } from './transport/select';

/**
 * Entry. The transport is chosen once, at build time (select.ts): the live transport in a release build, the
 * development fixture only where the build allowed it. The fixture Banner, when present, sits above everything
 * and never goes away.
 */
async function start() {
  const selected = await selectTransport();
  const Banner = selected.fixtureUi?.Banner;
  const root = document.getElementById('root');
  if (!root) throw new Error('#root is missing from index.html');
  createRoot(root).render(
    <StrictMode>
      {Banner ? <Banner /> : null}
      <a className="skip-link" href="#main">
        {t('app.skip_to_main')}
      </a>
      <ErrorBoundary>
        <SessionProvider selected={selected}>
          <RouterProvider router={createRouter()} />
        </SessionProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
}

// A failed start (a missing root, a failed chunk) must not leave a blank page.
start().catch(() => {
  const root = document.getElementById('root');
  if (root) root.textContent = t('error.request.internal');
});
