import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import '@adulis/tokens/tokens.css';
import './console.css';
import { SessionProvider } from './auth/session';
import { router } from './router';

const el = document.getElementById('root');
if (!el) throw new Error('#root missing from index.html');

createRoot(el).render(
  <StrictMode>
    <SessionProvider>
      <RouterProvider router={router} />
    </SessionProvider>
  </StrictMode>,
);
