/**
 * router.tsx -- ADU-REPO-01 S9.2's tree, ADU-CON-03 S2's routes.
 *
 *   /sign-in            SC-00 (unauthenticated)
 *   /                   seller chooser, or redirect when exactly one
 *   /s/:sellerId/*      every seller-scoped route -- the seller id lives in
 *                       the URL and ONLY the URL (two tabs, two stores)
 *   /courier            SC-C1 (stage C-8; placeholder route only)
 */
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { SignIn } from './auth/SignIn';
import { RequireSession } from './auth/RequireSession';
import { Shell } from './layout/Shell';
import { Chooser } from './features/entry/Chooser';
import { StateDemo } from './features/entry/StateDemo';
import { Placeholder } from './features/entry/Placeholder';

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  {
    element: <RequireSession />,
    children: [
      { path: '/', element: <Chooser /> },
      {
        path: '/s/:sellerId',
        element: <Shell />,
        children: [
          // C-1's placeholder route: Home's slot, rendering the twelve
          // states demonstrably until SC-01 lands at C-3.
          { index: true, element: <StateDemo /> },
          { path: 'orders', element: <Placeholder screen="SC-03" /> },
          { path: 'products', element: <Placeholder screen="SC-07" /> },
          { path: 'inbox', element: <Placeholder screen="SC-20" /> },
          { path: 'more', element: <Placeholder screen="More" /> },
          // `to="."` resolves to the CURRENT path inside a splat, so this
          // rendered nothing into the shell's main. The seller home is the
          // honest destination for an unknown child route.
          { path: '*', element: <Navigate to=".." relative="path" replace /> },
        ],
      },
      { path: '/courier', element: <Placeholder screen="SC-C1" /> },
    ],
  },
]);

export function RouterFallback() {
  return <Outlet />;
}
