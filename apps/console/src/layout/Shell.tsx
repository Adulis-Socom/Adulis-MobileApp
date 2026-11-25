import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router';
import { Dialog } from '../components/Dialog';
import { Icon } from '../components/Icon';
import { SellerBadges } from '../components/SellerBadges';
import { StatePanel } from '../components/StatePanel';
import { codeText, t } from '../i18n/t';
import { can, navFor, sellerPath, type NavItem } from '../seller/access';
import { useSeller } from '../seller/context';
import { useSellerQuery } from '../seller/useSellerQuery';
import { useSession } from '../session/SessionProvider';

function EntryContent({ item }: { item: NavItem }) {
  return (
    <>
      <Icon name={item.meta.icon} />
      <span className="nav-label">{t(item.meta.label)}</span>
    </>
  );
}

function SidebarEntry({ item, sellerId }: { item: NavItem; sellerId: string }) {
  const reasonId = `reason-${item.meta.key}`;
  return (
    <li>
      {item.access === 'NO_ENTITLEMENT' ? (
        // Missing entitlement: present, disabled, and the reason is on screen (CONSOLE-02 S19). Focusable so the reason is found.
        <>
          <button type="button" className="nav-link nav-disabled" aria-disabled="true" aria-describedby={reasonId}>
            <EntryContent item={item} />
          </button>
          <p id={reasonId} className="nav-reason">
            {t('nav.entitlement_reason')}
          </p>
        </>
      ) : (
        <NavLink className="nav-link" to={sellerPath(sellerId, item.meta.path)} end={item.meta.path === ''}>
          <EntryContent item={item} />
        </NavLink>
      )}
    </li>
  );
}

function Bell({ sellerId }: { sellerId: string }) {
  const { state } = useSellerQuery('notifications.list', {});
  // A failed read shows no number: "0 unread" would claim an answer the server never gave.
  const unread = state.status === 'ready' ? state.data.unread_count : null;
  const label = unread !== null && unread > 0 ? t('topbar.notifications_unread', { count: unread }) : t('topbar.notifications');
  return (
    <Link className="icon-btn" to={sellerPath(sellerId, 'notifications')} aria-label={label}>
      <Icon name="bell" />
      {unread !== null && unread > 0 ? <span className="count" aria-hidden="true">{unread}</span> : null}
    </Link>
  );
}

function TopBar() {
  const { sellerId, membership, access } = useSeller();
  const session = useSession();
  const [open, setOpen] = useState<'switch' | 'help' | 'account' | null>(null);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const memberships = session.state.status === 'READY' ? session.state.context.memberships : [];
  const accountName = session.state.status === 'READY' ? session.state.context.account.display_name : '';
  const close = () => setOpen(null);
  return (
    <header className="topbar" aria-label={t('topbar.label')}>
      <div className="topbar-seller">
        <p className="seller-name">{membership.seller.display_name}</p>
        <SellerBadges seller={membership.seller} />
      </div>
      <div className="topbar-actions">
        {memberships.length > 1 ? (
          <button type="button" className="icon-btn" onClick={() => setOpen('switch')}>
            <Icon name="swap" />
            <span className="icon-btn-label">{t('topbar.switch')}</span>
          </button>
        ) : null}
        {can(access, 'notifications.view') ? <Bell sellerId={sellerId} /> : null}
        <button type="button" className="icon-btn" onClick={() => setOpen('help')}>
          <Icon name="help" />
          <span className="icon-btn-label">{t('topbar.help')}</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => setOpen('account')}>
          <Icon name="user" />
          <span className="icon-btn-label">{t('topbar.account')}</span>
        </button>
      </div>

      <Dialog open={open === 'switch'} onClose={close} title={t('switcher.title')}>
        <ul className="plain-list" aria-label={t('switcher.all')}>
          {memberships.map((m) => (
            <li key={m.seller.id}>
              <Link className="switch-row" to={sellerPath(m.seller.id)} onClick={close} aria-current={m.seller.id === sellerId ? 'true' : undefined}>
                <span className="switch-name">{m.seller.display_name}</span>
                {m.seller.id === sellerId ? <span className="hint">{t('switcher.current')}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={close}>
            {t('switcher.close')}
          </button>
        </div>
      </Dialog>

      <Dialog open={open === 'help'} onClose={close} title={t('help.title')}>
        <p>{t('help.body', { sellerName: membership.seller.display_name })}</p>
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={close}>
            {t('help.close')}
          </button>
        </div>
      </Dialog>

      <Dialog
        open={open === 'account'}
        onClose={() => {
          setSignOutFailed(false);
          close();
        }}
        title={t('account.title')}
      >
        <p>{t('account.signed_in_as', { name: accountName })}</p>
        <p className="hint">{t('account.sessions_note')}</p>
        {signOutFailed ? (
          <p className="field-error" role="alert">
            <Icon name="alert" />
            <span>{t('error.network')}</span>
          </p>
        ) : null}
        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={signingOut}
            onClick={async () => {
              if (signingOut) return;
              setSigningOut(true);
              const ok = await session.signOut();
              if (!ok) {
                setSignOutFailed(true);
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? t('account.signing_out') : t('account.sign_out')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={close}>
            {t('account.close')}
          </button>
        </div>
      </Dialog>
    </header>
  );
}

function BottomBar({ items, sellerId }: { items: readonly NavItem[]; sellerId: string }) {
  return (
    <nav className="bottombar" aria-label={t('nav.primary')}>
      <ul>
        {items.map((item) => (
          <li key={item.meta.key}>
            <NavLink className="tab" to={sellerPath(sellerId, item.meta.path)} end={item.meta.path === ''}>
              <EntryContent item={item} />
            </NavLink>
          </li>
        ))}
        <li>
          <NavLink className="tab" to={sellerPath(sellerId, 'more')}>
            <Icon name="grid" />
            <span className="nav-label">{t('nav.more')}</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

/** The application shell: sidebar at 1024px and up, bottom bar below (CONSOLE-02 S23), top bar on every Seller route. */
export function Shell({ children }: { children: ReactNode }) {
  const { sellerId, access } = useSeller();
  const nav = navFor(access);
  const restriction = access.restriction;
  return (
    <div className="shell">
      <TopBar />
      <nav className="sidebar" aria-label={t('nav.primary')}>
        <ul>
          {nav.sidebar.map((item) => (
            <SidebarEntry key={item.meta.key} item={item} sellerId={sellerId} />
          ))}
        </ul>
      </nav>
      <main id="main" className="page">
        {restriction ? (
          <StatePanel kind="warn" title={t('state.restricted_title')}>
            <p>{t('state.restricted_body')}</p>
            <p>{codeText('restriction', restriction.reason_code) ?? t('restriction.unknown', { code: restriction.reason_code })}</p>
          </StatePanel>
        ) : null}
        {children}
      </main>
      <BottomBar items={nav.bottom} sellerId={sellerId} />
    </div>
  );
}
