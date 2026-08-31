/**
 * router.tsx -- ADU-REPO-01 S9.2's tree, ADU-CON-03 S2's routes.
 *
 *   /sign-in            SC-00 (unauthenticated)
 *   /                   seller chooser, or redirect when exactly one
 *   /s/new              SC-02 become a seller (no id yet -- it makes one)
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
import { Home } from './features/entry/Home';
import { BecomeSeller } from './features/entry/BecomeSeller';

export const router = createBrowserRouter([
  { path: '/sign-in', element: <SignIn /> },
  {
    element: <RequireSession />,
    children: [
      { path: '/', element: <Chooser /> },
      // SC-02. Outside /s/:sellerId because there is no seller yet -- this is
      // the screen that creates one, and a route keyed on an id the caller
      // does not have is a route they cannot reach.
      { path: '/s/new', element: <BecomeSeller /> },
      {
        path: '/s/:sellerId',
        element: <Shell />,
        children: [
          // SC-01, C-3. This slot held StateDemo through C-1 and C-2; the
          // twelve states are still demonstrable at /s/:sellerId/states, so
          // the C-1 done-clause keeps its evidence rather than losing it to
          // the screen that replaced it.
          { index: true, element: <Home /> },
          { path: 'states', element: <StateDemo /> },
          { path: 'orders', element: <Placeholder screen="SC-03" /> },
          { path: 'products', element: <Placeholder screen="SC-07" /> },
          /*
            THE SCREENS SC-01's RESOLVING LINKS POINT AT (ADU-CON-03 S6's
            table: item 3/4 -> SC-22, 5/6 -> SC-17, 7 -> SC-24, 8 -> SC-18,
            9 -> SC-08 via the catalogue). They are placeholders, and that is
            the point: without these routes every "Complete this" link fell
            through to the `*` catch-all and navigated the seller straight
            back to Home. A link that appears to do something and silently
            returns you is worse than no link -- it teaches that the readiness
            list is decorative. Found by the C-3 adversarial pass (D-146).
          */
          { path: 'eligibility', element: <Placeholder screen="SC-22" /> },
          { path: 'profile', element: <Placeholder screen="SC-17" /> },
          { path: 'payouts', element: <Placeholder screen="SC-24" /> },
          { path: 'fulfilment', element: <Placeholder screen="SC-18" /> },
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
