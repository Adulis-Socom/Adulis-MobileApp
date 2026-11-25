import { Link } from 'react-router';
import type { BriefAlert, BriefArea, BriefObligation, DestinationKey, HomeBrief } from '../../contracts/gap-sc';
import { Badge } from '../../components/Badge';
import { Gate } from '../unavailable/Gate';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { codeText, formatInstant, t } from '../../i18n/t';
import { destinationAccess, sellerPath, type Access } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ReadinessHub } from '../readiness/ReadinessHub';

/** Where each brief area leads. A destination the account cannot see is not offered, and an unknown area has none. */
const AREA_TARGET: Record<string, { dest: DestinationKey | null; path: string }> = {
  PRODUCTS: { dest: 'products', path: 'products' },
  INVENTORY: { dest: 'products', path: 'products' },
  SCENES: { dest: 'content', path: 'content' },
  STORIES: { dest: 'content', path: 'content/stories' },
  INBOX: { dest: 'inbox', path: 'inbox' },
  INSIGHTS: { dest: 'insights', path: 'insights' },
  SETTINGS: { dest: 'settings', path: 'settings' },
  NOTIFICATIONS: { dest: null, path: 'notifications' },
};

function Alerts({ alerts, timezone }: { alerts: readonly BriefAlert[]; timezone: string | undefined }) {
  return (
    <section className="panel" aria-labelledby="alerts-h">
      <h2 id="alerts-h">{t('home.alerts_title')}</h2>
      {alerts.length === 0 ? (
        <p>{t('home.alerts_empty')}</p>
      ) : (
        <ul className="plain-list">
          {alerts.map((a) => (
            <li key={`${a.code}-${a.occurred_at}`} className="row">
              <Badge tone={a.severity === 'WARN' ? 'warn' : 'info'}>{t(`alert.severity.${a.severity}`)}</Badge>
              <span>{codeText('alert', a.code) ?? t('alert.unknown', { code: a.code })}</span>
              <time className="hint" dateTime={a.occurred_at}>
                {formatInstant(a.occurred_at, timezone)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Obligations({ items, timezone }: { items: readonly BriefObligation[]; timezone: string | undefined }) {
  return (
    <section className="panel" aria-labelledby="obligations-h">
      <h2 id="obligations-h">{t('home.obligations_title')}</h2>
      {items.length === 0 ? (
        <p>{t('home.obligations_empty')}</p>
      ) : (
        <ul className="plain-list">
          {items.map((o) => (
            <li key={`${o.code}-${o.due_at ?? ''}`} className="row">
              <span>{codeText('obligation', o.code) ?? t('obligation.unknown', { code: o.code })}</span>
              {o.due_at ? (
                <time className="hint" dateTime={o.due_at}>
                  {t('home.due', { time: formatInstant(o.due_at, timezone) })}
                </time>
              ) : (
                <span className="hint">{t('home.no_due')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AreaRow({ area }: { area: BriefArea }) {
  const { sellerId, access } = useSeller();
  const label = codeText('home.area', area.key) ?? t('home.area.unknown', { code: area.key });
  const target = AREA_TARGET[area.key];
  const reach: Access = target ? (target.dest === null ? 'GRANTED' : destinationAccess(access, target.dest)) : 'HIDDEN';
  const stateText = t(`home.area_state.${area.state}`);
  const body = (
    <>
      <span className="ledger-main">
        <span className="ledger-title">{label}</span>
        <Badge tone={area.state === 'AVAILABLE' ? 'success' : 'neutral'} icon={area.state === 'AVAILABLE' ? 'check' : 'clock'}>
          {stateText}
        </Badge>
        {area.state === 'NO_ENTITLEMENT' ? <span className="ledger-meta">{t('nav.entitlement_reason')}</span> : null}
      </span>
      {area.state !== 'NO_ENTITLEMENT' && target && reach !== 'HIDDEN' ? <Icon name="arrow" /> : null}
    </>
  );
  // No entitlement, or no destination to open: shown, not a link.
  if (area.state === 'NO_ENTITLEMENT' || !target || reach === 'HIDDEN') return <li className="ledger-row">{body}</li>;
  return (
    <li>
      <Link className="ledger-link" to={sellerPath(sellerId, target.path)}>
        {body}
      </Link>
    </li>
  );
}

function Areas({ areas }: { areas: readonly BriefArea[] }) {
  return (
    <section className="panel" aria-labelledby="areas-h">
      <h2 id="areas-h">{t('home.areas_title')}</h2>
      {areas.length === 0 ? (
        <p>{t('home.areas_empty')}</p>
      ) : (
        <ul className="ledger">
          {areas.map((a) => (
            <AreaRow key={a.key} area={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Brief({ brief, timezone }: { brief: HomeBrief; timezone: string | undefined }) {
  return (
    <>
      {brief.mode === 'READINESS_HUB' ? <ReadinessHub /> : null}
      <Alerts alerts={brief.alerts} timezone={timezone} />
      <Obligations items={brief.obligations} timezone={timezone} />
      <Areas areas={brief.areas} />
    </>
  );
}

/**
 * Home (CONSOLE-02 S29, SC-FE-03). The server decides the mode (readiness hub before publication, operating brief
 * after) and the role-specific content; this screen renders both and fabricates neither. No sales, order, payment or
 * delivery figure exists in this release, and the page says so instead of showing zeros.
 */
function HomeContent() {
  const { membership } = useSeller();
  const brief = useSellerQuery('seller.home.get', {});
  const market = useSellerQuery('market.context.get', {});
  const seller = membership.seller;
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;
  return (
    <>
      <PageTitle title={seller.display_name}>{seller.display_name}</PageTitle>
      <div className="stack">
        <p className="lead">{t('home.roles', { roles: membership.roles.map((r) => t(`role.${r}`)).join(', ') })}</p>
        {market.state.status === 'ready' ? <p className="hint">{t('home.market', { country: market.state.data.country, timezone: market.state.data.timezone })}</p> : null}
        {seller.status === 'DRAFT' ? <p className="hint">{t('home.draft_note')}</p> : null}
        {seller.publication === 'UNPUBLISHED' ? <p className="hint">{t('home.unpublished_note')}</p> : null}
      </div>
      <StatePanel kind="info" title={t('home.honest_title')}>
        <p>{t('home.honest_body')}</p>
      </StatePanel>
      {brief.state.status === 'loading' ? <Skeleton rows={6} /> : null}
      {brief.state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('home.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={brief.retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {brief.state.status === 'ready' ? (
        <>
          {brief.state.data.role_view !== 'OWNER_ADMIN' ? <p className="hint">{t('home.limited_note')}</p> : null}
          <Brief brief={brief.state.data} timezone={timezone} />
        </>
      ) : null}
    </>
  );
}

export function Home() {
  return (
    <Gate dest="home">
      <HomeContent />
    </Gate>
  );
}
