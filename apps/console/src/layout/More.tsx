import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { PageTitle } from '../components/PageTitle';
import { t } from '../i18n/t';
import { can, navFor, sellerPath } from '../seller/access';
import { useSeller } from '../seller/context';

/** "More" on the narrow layout: everything the bottom bar does not carry, with the reason beside any disabled entry. */
export function More() {
  const { sellerId, access } = useSeller();
  const nav = navFor(access);
  return (
    <>
      <PageTitle title={t('more.title')}>{t('more.title')}</PageTitle>
      <p className="lead">{t('more.lead')}</p>
      <ul className="ledger">
        {nav.more.map((item) =>
          item.access === 'NO_ENTITLEMENT' ? (
            <li key={item.meta.key} className="ledger-row">
              <span className="ledger-main">
                <span className="ledger-title">{t(item.meta.label)}</span>
                <span className="ledger-meta">{t('nav.entitlement_reason')}</span>
              </span>
            </li>
          ) : (
            <li key={item.meta.key}>
              <Link className="ledger-link" to={sellerPath(sellerId, item.meta.path)}>
                <span className="ledger-main">
                  <span className="ledger-title">{t(item.meta.label)}</span>
                </span>
                <Icon name="arrow" />
              </Link>
            </li>
          ),
        )}
        {can(access, 'notifications.view') ? (
          <li>
            <Link className="ledger-link" to={sellerPath(sellerId, 'notifications')}>
              <span className="ledger-main">
                <span className="ledger-title">{t('topbar.notifications')}</span>
              </span>
              <Icon name="arrow" />
            </Link>
          </li>
        ) : null}
      </ul>
    </>
  );
}
