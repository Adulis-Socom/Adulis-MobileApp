/**
 * layout/Shell.tsx -- ADU-CON-03 v1.1 S2. Five primary destinations, NO
 * MORE. Desktop (>=1024px): persistent left sidebar, all five with More's
 * sections expanded. Tablet/mobile (<1024px): bottom bar with the four
 * primary destinations plus More, which opens a FULL-PAGE menu -- not a
 * drawer that traps focus.
 *
 * Top bar, every route: store name + seller switcher (rendered ONLY when
 * the account holds more than one seller -- with no sellers-list endpoint
 * in the contract yet, that is exactly zero renders today; register
 * D-97), notification bell placeholder, account menu placeholder.
 *
 * The seller id lives in the URL and ONLY the URL (S2.1): two stores in
 * two tabs are two URLs; nothing here stores it.
 */
import { NavLink, Outlet, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { IdleWarning } from '../auth/IdleWarning';
import { useSession } from '../auth/session';

const NAV = [
  { key: 'home', to: '', label: en['console.nav.home'], end: true },
  { key: 'orders', to: 'orders', label: en['console.nav.orders'] },
  { key: 'products', to: 'products', label: en['console.nav.products'] },
  { key: 'inbox', to: 'inbox', label: en['console.nav.inbox'] },
  { key: 'more', to: 'more', label: en['console.nav.more'] },
] as const;

export function Shell() {
  const { sellerId } = useParams();
  const { signOut } = useSession();
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {en['console.a11y.skip_to_content']}
      </a>
      <header className="topbar">
        <span className="store-name">{en['console.shell.store']}</span>
        {/* SellerSwitcher: only with >1 seller; the sellers-list contract
            gap (D-97) means it cannot render yet. */}
        {/* SC-26's unread count arrives with its stage; the control exists
            so the top bar's three regions are real from C-1. */}
        <button type="button" className="bell" aria-label={en['console.shell.notifications']}>
          {'\u2022'}
        </button>
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
      <IdleWarning timezone="Africa/Addis_Ababa" />
    </div>
  );
}
