import { useState } from 'react';
import { Link } from 'react-router';
import type { ConversationSummary } from '../../contracts/gap-sc-inbox';
import { Badge } from '../../components/Badge';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';

function Row({ conversation, sellerId, timezone }: { conversation: ConversationSummary; sellerId: string; timezone: string | undefined }) {
  return (
    <li>
      <Link className="ledger-link" to={sellerPath(sellerId, `inbox/${conversation.id}`)}>
        <span className="ledger-main">
          <span className="ledger-title">{conversation.buyer_label}</span>
          <span className="ledger-meta">{conversation.preview}</span>
          <span className="ledger-meta">
            {label('inbox.last', conversation.last_sender)} <time dateTime={conversation.last_at}>{formatInstant(conversation.last_at, timezone)}</time>
          </span>
          <span className="badges">
            {conversation.unread_count > 0 ? <Badge tone="info">{t('inbox.unread', { count: conversation.unread_count })}</Badge> : <Badge tone="neutral">{t('inbox.all_read')}</Badge>}
            {conversation.state === 'WAITING_FOR_HUMAN' ? <Badge tone="warn">{t('inbox.waiting')}</Badge> : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Inbox (CONSOLE-02 S71-S72, CHAT-01 S1-S3): one conversation per Buyer, Seller and Market, newest first, cursor-paginated. The list
 * columns, ordering and filters are not specified by the designs; this is the smallest list that tells the Seller who wrote, what, when,
 * whether it is unread and whether a team member is needed. Nothing is searched, filtered or counted beyond what the server returns.
 */
export function Inbox() {
  const { sellerId } = useSeller();
  const [cursor, setCursor] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<readonly ConversationSummary[]>([]);
  const { state, retry } = useSellerQuery('inbox.list', { cursor });
  const market = useSellerQuery('market.context.get', {});
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;

  const current = state.status === 'ready' && !state.refreshing ? state.data : null;
  const shown = current ? [...earlier, ...current.items] : earlier;
  function more() {
    if (!current?.next_cursor) return;
    setEarlier(shown);
    setCursor(current.next_cursor);
  }

  return (
    <>
      <PageTitle title={t('inbox.title')}>{t('inbox.title')}</PageTitle>
      <p className="lead">{t('inbox.lead')}</p>
      {state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('inbox.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'loading' || (state.status === 'ready' && state.refreshing && shown.length === 0) ? <Skeleton rows={4} /> : null}
      {current && shown.length === 0 ? <StatePanel kind="neutral" title={t('inbox.empty')} /> : null}
      {shown.length > 0 ? (
        <ul className="ledger" aria-label={t('inbox.list_label')} aria-busy={state.status === 'ready' && state.refreshing}>
          {shown.map((c) => (
            <Row key={c.id} conversation={c} sellerId={sellerId} timezone={timezone} />
          ))}
        </ul>
      ) : null}
      {current?.next_cursor ? (
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={more}>
            {t('inbox.more')}
          </button>
        </div>
      ) : null}
    </>
  );
}
