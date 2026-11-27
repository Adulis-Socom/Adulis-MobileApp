import { Link } from 'react-router';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { label, t } from '../../i18n/t';
import { DESTINATIONS, sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { Section } from '../products/Section';

/** One row per Seller setting page that exists. Pages a later work order adds append here. */
export function SettingsIndex() {
  const { sellerId } = useSeller();
  const pages = [
    { path: 'settings/team', title: t('team.title'), lead: t('team.index_lead') },
    { path: 'settings/plan', title: t('plan.title'), lead: t('plan.index_lead') },
    { path: 'settings/closure', title: t('closure.title'), lead: t('closure.index_lead') },
  ];
  return (
    <>
      <PageTitle title={t('area.settings')}>{t('area.settings')}</PageTitle>
      <ul className="ledger" aria-label={t('settings.list_label')}>
        {pages.map((p) => (
          <li key={p.path}>
            <Link className="ledger-link" to={sellerPath(sellerId, p.path)}>
              <span className="ledger-main">
                <span className="ledger-title">{p.title}</span>
                <span className="ledger-meta">{p.lead}</span>
              </span>
              <Icon name="arrow" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Plan and features (SC-FE-10, Subscription Option B, RB25-D11). Read only: whether a plan is assigned (none is defined yet) and, per destination,
 * whether it is included for this Seller, both as the server says. There is no price, trial, renewal, upgrade, purchase or billing control,
 * because none is approved (CONSOLE-02 S22, S130), and paying can never improve Trust (CONSOLE-02 S91).
 */
export function Plan() {
  const { sellerId } = useSeller();
  const { state, retry } = useSellerQuery('subscription.get', {});
  return (
    <>
      <PageTitle title={t('plan.title')}>{t('plan.title')}</PageTitle>
      <p>
        <Link to={sellerPath(sellerId, 'settings')}>{t('settings.back')}</Link>
      </p>
      {state.status === 'loading' ? <Skeleton rows={4} /> : null}
      {state.status === 'error' ? (
        <StatePanel kind="danger" alert title={t('plan.error_title')} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'ready' ? (
        <>
          <Section id="plan" title={t('plan.status_title')}>
            <p>{state.data.plan_state === 'ASSIGNED' && state.data.plan_label ? t('plan.assigned', { plan: state.data.plan_label }) : t('plan.none_defined')}</p>
            <p className="notice">
              <Icon name="info" />
              <span>{t('plan.nothing_to_buy')}</span>
            </p>
            <p className="hint">{t('plan.trust_note')}</p>
          </Section>
          <Section id="features" title={t('plan.features_title')}>
            <ul className="ledger">
              {state.data.features.map((f) => {
                const meta = DESTINATIONS.find((d) => d.key === f.key);
                return (
                  <li key={f.key} className="ledger-row">
                    <span className="ledger-main">
                      <span className="ledger-title">{meta ? t(meta.label) : f.key}</span>
                    </span>
                    <Badge tone={f.included ? 'success' : 'neutral'}>{label('plan.feature', f.included ? 'INCLUDED' : 'NOT_INCLUDED')}</Badge>
                  </li>
                );
              })}
            </ul>
          </Section>
        </>
      ) : null}
    </>
  );
}
