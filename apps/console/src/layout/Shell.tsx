/**
 * layout/Shell.tsx -- ADU-CON-03 v1.1 S2. Five primary destinations, NO
 * MORE. Desktop (>=1024px): persistent left sidebar, all five with More's
 * sections expanded. Tablet/mobile (<1024px): bottom bar with the four
 * primary destinations plus More, which opens a FULL-PAGE menu -- not a
 * drawer that traps focus.
 *
 * Top bar, every route: the seller switcher (store name, other stores, and
 * "Create a store"), notification bell placeholder, account menu placeholder.
 *
 * THE SWITCHER IS BUILT (T19 Phase 1) and it renders below two stores, which
 * is a deliberate reading of ADU-REPO-01 S9.2's "only when the account holds
 * more than one seller" rather than a contradiction of it -- see
 * SellerSwitcher.tsx's header and the register entry. S9.2 protects against a
 * menu that lies about having a choice; drawing nothing at one store would
 * satisfy the letter and leave "Create a store" reachable only by typing a
 * URL, which is the regression this phase exists to end.
 *
 * The seller id lives in the URL and ONLY the URL (S2.1): two stores in
 * two tabs are two URLs; nothing here stores it.
 */
import { SellerSwitcher } from './SellerSwitcher';
import { NavLink, Outlet, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { IdleWarning } from '../auth/IdleWarning';
import { useMarketContext } from '../lib/market';
import { useSession } from '../auth/session';
import { MORE_GROUPS } from './More';

const NAV = [
  { key: 'home', to: '', label: en['console.nav.home'], end: true },
  { key: 'orders', to: 'orders', label: en['console.nav.orders'] },
  { key: 'products', to: 'products', label: en['console.nav.products'] },
  { key: 'inbox', to: 'inbox', label: en['console.nav.inbox'] },
  { key: 'more', to: 'more', label: en['console.nav.more'] },
] as const;

export function Shell() {
  const market = useMarketContext();
  const { sellerId } = useParams();
  const { signOut } = useSession();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {en['console.a11y.skip_to_content']}
      </a>
      <header className="topbar">
        {/* SellerSwitcher (T19 Phase 1). It carries the store's own name, the
            other stores when there are any, and "Create a store" ALWAYS --
            which is the control #80's redirect took away when it stopped a
            single-store seller ever seeing the chooser. */}
        <SellerSwitcher />
        {/* SC-30 exists now (C-7): the bell is a LINK, not a dead control.
            Its unread COUNT stays owed -- drawing one would need a
            shell-level poll on every route, and the list itself carries the
            markers (D-226). */}
        <NavLink
          to={`/s/${sellerId}/notifications`}
          className="bell"
          aria-label={en['console.shell.notifications']}
        >
          {'\u2022'}
        </NavLink>
        {/* Sign-out was reachable from nowhere: this control had no handler,
            `common.signOut` had no render site, and a 401 left the shell up.
            A console holding a seller's money cannot lack an exit. */}
        <button type="button" onClick={() => void signOut()}>
          {en['common.signOut']}
        </button>
      </header>
      <nav className="sidenav" aria-label={en['console.a11y.primary_nav']}>
        <ul>
          {NAV.map((n) => (
            <li key={n.key}>
              <NavLink to={`/s/${sellerId}/${n.to}`} end={'end' in n && n.end}>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
        {/* Desktop shows More's four sections EXPANDED (v1.2 S2.1): the
            console is used at a desk, and hiding settings behind a click
            costs more than it saves. The bottom bar keeps plain More. */}
        <div className="sidenav-more">
          {MORE_GROUPS.map((g) => (
            <div key={g.heading} className="sidenav-group">
              <h3>{g.heading}</h3>
              <ul>
                {g.entries.map((e) => (
                  <li key={e.to}>
                    <NavLink to={`/s/${sellerId}/${e.to}`}>{e.label}</NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <main id="main">
        <Outlet />
      </main>
      <nav className="bottombar" aria-label={en['console.a11y.primary_nav']}>
        <ul>
          {NAV.map((n) => (
            <li key={n.key}>
              <NavLink to={`/s/${sellerId}/${n.to}`} end={'end' in n && n.end}>
                {n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <IdleWarning market={market} />
    </div>
  );
}
