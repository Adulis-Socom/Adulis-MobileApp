import { Badge } from '../../components/Badge';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { codeText, formatInstant, t } from '../../i18n/t';
import { can } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { NoPermission } from '../unavailable/Gate';

function List() {
  const { state, retry } = useSellerQuery('notifications.list', {});
  const market = useSellerQuery('market.context.get', {});
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;
  return (
    <>
      <PageTitle title={t('notifications.title')}>{t('notifications.title')}</PageTitle>
      <p className="lead">{t('notifications.lead')}</p>
      {state.status === 'loading' ? <Skeleton rows={4} /> : null}
      {state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('notifications.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'ready' && state.data.items.length === 0 ? (
        <StatePanel kind="neutral" title={t('notifications.empty')} />
      ) : null}
      {state.status === 'ready' && state.data.items.length > 0 ? (
        <ul className="ledger" aria-label={t('notifications.list_label')}>
          {state.data.items.map((n) => (
            <li key={n.id} className="ledger-row">
              <div className="ledger-main">
                <span className="ledger-title">{codeText('notif', n.kind) ?? t('notif.unknown')}</span>
                <span className="ledger-meta">
                  <time dateTime={n.created_at}>{formatInstant(n.created_at, timezone)}</time>
                </span>
              </div>
              {n.read ? <Badge tone="neutral" icon="check">{t('notifications.read')}</Badge> : <Badge tone="info" icon="bell">{t('notifications.unread')}</Badge>}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** Notification centre (CONSOLE-02 S119-S121): read-only in this release; it lists what the server says, nothing transactional. */
export function Notifications() {
  const { access } = useSeller();
  return can(access, 'notifications.view') ? <List /> : <NoPermission />;
}
