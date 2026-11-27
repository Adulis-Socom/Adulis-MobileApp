import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Message, ThreadView } from '../../contracts/gap-sc-inbox';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { fresher, tick, type Held } from '../../seller/freshness';
import { DirtyProvider, UnsavedNote } from '../shared/dirty';
import { NotFoundInSeller } from '../unavailable/NotFound';
import { Composer } from './Composer';

/**
 * The provenance line of one message: its one subject, and for a Product chosen from a Scene the Scene it came from (CHAT S4). Labels are the
 * snapshots taken when the message was sent; only "can no longer be shown" is current, so newer private content is never revealed.
 */
function contextLine(m: Message): string {
  const { subject, source } = m;
  if (subject.kind === 'NONE') return t('inbox.ctx.NONE');
  if (subject.kind === 'SCENE') return subject.available ? t('inbox.ctx.SCENE', { scene: subject.label }) : t('inbox.ctx.SCENE_UNAVAILABLE', { scene: subject.label });
  if (!source) return t('inbox.ctx.PRODUCT', { product: subject.label });
  return source.available
    ? t('inbox.ctx.PRODUCT_IN_SCENE', { product: subject.label, scene: source.label })
    : t('inbox.ctx.PRODUCT_SCENE_UNAVAILABLE', { product: subject.label, scene: source.label });
}

function senderLabel(m: Message): string {
  return m.sender === 'SELLER_TEAM' && m.actor_label ? t('inbox.sender_team', { name: m.actor_label }) : label('inbox.sender', m.sender);
}

function MessageRow({ message, timezone }: { message: Message; timezone: string | undefined }) {
  if (message.sender === 'SYSTEM') {
    return (
      <li className="message message-system">
        <p className="notice">
          <Icon name="info" />
          <span>{message.body}</span>
        </p>
        <time className="ledger-meta" dateTime={message.sent_at}>
          {formatInstant(message.sent_at, timezone)}
        </time>
      </li>
    );
  }
  return (
    <li className="message" data-sender={message.sender}>
      <div className="stack">
        <div className="row-start">
          <strong>{senderLabel(message)}</strong>
          {message.automation ? <Badge tone="neutral" icon="clock">{t('inbox.automated')}</Badge> : null}
          <time className="ledger-meta" dateTime={message.sent_at}>
            {formatInstant(message.sent_at, timezone)}
          </time>
        </div>
        <p className="message-body">{message.body}</p>
        <p className="ledger-meta">{contextLine(message)}</p>
        {message.automation ? <p className="hint">{t('inbox.automated_note', { template: message.automation.template_label })}</p> : null}
      </div>
    </li>
  );
}

function Body({ initial, issued, timezone }: { initial: ThreadView; issued: number; timezone: string | undefined }) {
  const { sellerId } = useSeller();
  const run = useSellerCommand();
  const [held, setHeld] = useState<Held<ThreadView>>({ value: initial, stamp: issued });
  const thread = held.value;
  const id = initial.id;
  const lastShown = thread.messages[thread.messages.length - 1]?.id ?? null;

  // The shared Seller-side read mark moves to the highest message this screen has SHOWN (CHAT S10 high-water), never to whatever the server
  // holds now: a Buyer message that arrived after this view was loaded stays unread. If the call fails the mark stays where it was and the
  // list still shows the thread as unread, which is the truth; nothing is hidden by the failure, so there is nothing to report to the Seller.
  useEffect(() => {
    if (lastShown === null) return;
    void run('inbox.read.mark', { conversation_id: id, last_read_message_id: lastShown }).catch(() => undefined);
    // `run` is stable for the mounted Seller scope; the mark moves once per newly shown last message.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lastShown]);

  return (
    <DirtyProvider>
      <Link className="back-link" to={sellerPath(sellerId, 'inbox')}>
        {t('inbox.back')}
      </Link>
      <PageTitle title={thread.buyer_label}>{thread.buyer_label}</PageTitle>
      <UnsavedNote />
      {thread.state === 'WAITING_FOR_HUMAN' ? (
        <p className="notice">
          <Icon name="alert" />
          <span>{t('inbox.waiting_note')}</span>
        </p>
      ) : null}
      <ol className="messages" aria-label={t('inbox.thread_label')}>
        {thread.messages.map((m) => (
          <MessageRow key={m.id} message={m} timezone={timezone} />
        ))}
      </ol>
      {thread.allowed_actions.includes('REPLY') ? (
        <Composer
          thread={thread}
          onSent={(next) => {
            const acknowledged = { value: next, stamp: tick() };
            setHeld((prev) => fresher(prev, acknowledged));
          }}
        />
      ) : (
        <p className="hint">{t('inbox.read_only')}</p>
      )}
    </DirtyProvider>
  );
}

/** One conversation (CONSOLE-02 S73): the messages with their context, automated replies marked as automated, and the reply composer if the role may reply. */
export function Thread() {
  const { conversationId = '' } = useParams();
  const query = useSellerQuery('inbox.thread.get', { conversation_id: conversationId });
  const market = useSellerQuery('market.context.get', {});
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;

  if (query.state.status === 'error') {
    // A conversation of another Seller and one that does not exist are the same answer: existence is never disclosed.
    const notFound = query.state.error.code === 'NOT_FOUND' || query.state.error.code === 'PERMISSION_DENIED';
    return notFound ? (
      <NotFoundInSeller />
    ) : (
      <StatePanel kind="danger" alert title={t('inbox.thread_error')} actions={<button type="button" className="btn btn-primary" onClick={query.retry}>{t('state.retry')}</button>}>
        <p>{t('state.transport_error_body')}</p>
      </StatePanel>
    );
  }
  if (query.state.status !== 'ready') return <Skeleton rows={5} />;
  return <Body key={query.state.data.id} initial={query.state.data} issued={query.state.issued} timezone={timezone} />;
}
