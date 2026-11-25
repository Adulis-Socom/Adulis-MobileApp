import { Link } from 'react-router';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { SellerBadges } from '../../components/SellerBadges';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { PlainFrame } from '../../layout/PlainFrame';
import { sellerPath } from '../../seller/access';
import { useSession } from '../../session/SessionProvider';

/** The Seller chooser: every Seller relationship of the account, each one a link to its own address. */
export function Chooser() {
  const { state } = useSession();
  const memberships = state.status === 'READY' ? state.context.memberships : [];
  return (
    <PlainFrame>
      <PageTitle title={t('sellers.title')}>{t('sellers.title')}</PageTitle>
      {memberships.length === 0 ? (
        <StatePanel
          kind="info"
          title={t('sellers.empty_title')}
          actions={
            <Link className="btn btn-highlight" to="/become-seller">
              {t('sellers.become')}
            </Link>
          }
        >
          <p>{t('sellers.empty_body')}</p>
        </StatePanel>
      ) : (
        <>
          <p className="lead">{t('sellers.lead')}</p>
          <ul className="ledger" aria-label={t('sellers.list_label')}>
            {memberships.map((m) => (
              <li key={m.seller.id}>
                <Link className="ledger-link" to={sellerPath(m.seller.id)}>
                  <span className="ledger-main">
                    <span className="ledger-title">{m.seller.display_name}</span>
                    <span className="ledger-meta">{t(`seller.type.${m.seller.seller_type}`)}</span>
                    <SellerBadges seller={m.seller} />
                    <span className="ledger-meta">{t('sellers.roles', { roles: m.roles.map((r) => t(`role.${r}`)).join(', ') })}</span>
                  </span>
                  <Icon name="arrow" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="actions">
            <Link className="btn btn-quiet" to="/become-seller">
              {t('sellers.become')}
            </Link>
          </div>
        </>
      )}
    </PlainFrame>
  );
}
