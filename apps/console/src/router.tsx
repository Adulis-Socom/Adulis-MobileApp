import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';
import { CrashPanel } from './components/ErrorBoundary';
import { AuthLayout, RequireSession } from './features/auth/Gate';
import { Declarations } from './features/auth/Declarations';
import { Recovery } from './features/auth/Recovery';
import { SignIn } from './features/auth/SignIn';
import { Verify } from './features/auth/Verify';
import { Chooser } from './features/entry/Chooser';
import { Home } from './features/home/Home';
import { SceneEditor } from './features/content/SceneEditor';
import { Scenes } from './features/content/Scenes';
import { Stories } from './features/content/Stories';
import { Notifications } from './features/notifications/Notifications';
import { ProductEditor } from './features/products/ProductEditor';
import { Products } from './features/products/Products';
import { Admission } from './features/onboarding/Admission';
import { Couriers } from './features/store/Couriers';
import { StoreCompany } from './features/store/StoreCompany';
import { StoreCoverage } from './features/store/StoreCoverage';
import { StoreFulfilment } from './features/store/StoreFulfilment';
import { StoreLayout } from './features/store/StoreFrame';
import { StoreHours } from './features/store/StoreHours';
import { StoreLocation } from './features/store/StoreLocation';
import { StoreProfile } from './features/store/StoreProfile';
import { BecomeSeller } from './features/onboarding/BecomeSeller';
import { Gate, Deferred } from './features/unavailable/Gate';
import { NotFound, NotFoundInSeller } from './features/unavailable/NotFound';
import { More } from './layout/More';
import { SellerRoute } from './seller/SellerScope';
import type { DestinationKey } from './contracts/gap-sc';

/**
 * The route map of SC-FE-00. The Seller lives in the URL (`/s/:sellerId`). Orders has no route at all (Nov 24 layer).
 * Every area whose work order is not built renders an honest "arrives later" page behind its own permission gate.
 */
const deferred = (path: string, dest: DestinationKey): RouteObject => ({ path, element: <Deferred dest={dest} /> });

const children: RouteObject[] = [
  { path: '/', element: <Navigate to="/sellers" replace /> },
  {
    element: <AuthLayout />,
    children: [
      { path: 'sign-in', element: <SignIn /> },
      { path: 'sign-in/verify', element: <Verify /> },
      { path: 'sign-in/recovery', element: <Recovery /> },
      { path: 'sign-in/declarations', element: <Declarations /> },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      { path: 'sellers', element: <Chooser /> },
      { path: 'become-seller', element: <BecomeSeller /> },
      {
        path: 's/:sellerId',
        element: <SellerRoute />,
        children: [
          { index: true, element: <Home /> },
          { path: 'admission', element: <Gate dest="home"><Admission /></Gate> },
          { path: 'notifications', element: <Notifications /> },
          { path: 'more', element: <More /> },
          { path: 'products', element: <Gate dest="products"><Products /></Gate> },
          { path: 'products/:productId', element: <Gate dest="products"><ProductEditor /></Gate> },
          { path: 'content', element: <Gate dest="content"><Scenes /></Gate> },
          { path: 'content/scenes/:postId', element: <Gate dest="content"><SceneEditor /></Gate> },
          { path: 'content/stories', element: <Gate dest="content"><Stories /></Gate> },
          deferred('content/*', 'content'),
          deferred('inbox/*', 'inbox'),
          deferred('insights/*', 'insights'),
          {
            path: 'store',
            element: (
              <Gate dest="store">
                <StoreLayout />
              </Gate>
            ),
            children: [
              { index: true, element: <StoreProfile /> },
              { path: 'company', element: <StoreCompany /> },
              { path: 'location', element: <StoreLocation /> },
              { path: 'coverage', element: <StoreCoverage /> },
              { path: 'hours', element: <StoreHours /> },
              { path: 'fulfilment', element: <StoreFulfilment /> },
              { path: 'couriers', element: <Couriers /> },
            ],
          },
          deferred('trust/*', 'trust'),
          deferred('settings/*', 'settings'),
          { path: '*', element: <NotFoundInSeller /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
];

/** A route that throws while rendering lands on the same crash panel as the app boundary, never React Router's default screen. */
export const rootRoute = (inner: RouteObject[]): RouteObject[] => [{ errorElement: <CrashPanel />, children: inner }];

export const routes: RouteObject[] = rootRoute(children);

/**
 * `simulationRoute` is the internal Order experience demonstration (SC-FE-07). Only a fixture build can supply it, so in a release build the
 * route does not exist, its path is not in the bundle, and the URL falls through to the not-found page. It is outside every Seller and every nav.
 */
export function createRouter(simulationRoute: RouteObject | null = null) {
  return createBrowserRouter(simulationRoute === null ? routes : rootRoute([simulationRoute, ...children]));
}
