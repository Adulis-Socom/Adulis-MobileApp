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
import { DirtyProvider, newer, UnsavedNote } from '../shared/dirty';
import { NotFoundInSeller } from '../unavailable/NotFound';
import { Composer } from './Composer';

/** The provenance line of one message: what it is about, and the Scene it came from. The Scene is the revision it was sent against (CHAT S4). */
function contextLine(m: Message): string {
  const { product, scene, kind } = m.context;
  if (kind === 'NONE') return t('inbox.ctx.NONE');
  if (scene && !scene.available) {
    return product ? t('inbox.ctx.PRODUCT_SCENE_UNAVAILABLE', { product: product.label, scene: scene.label }) : t('inbox.ctx.SCENE_UNAVAILABLE', { scene: scene.label });
  }
  if (kind === 'PRODUCT_IN_SCENE' && product && scene) return t('inbox.ctx.PRODUCT_IN_SCENE', { product: product.label, scene: scene.label });
  if (kind === 'PRODUCT' && product) return t('inbox.ctx.PRODUCT', { product: product.label });
  if (kind === 'SCENE' && scene) return t('inbox.ctx.SCENE', { scene: scene.label });
  return t('inbox.ctx.NONE');
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
          <span>
            {message.body} <time dateTime={message.sent_at}>{formatInstant(message.sent_at, timezone)}</time>
          </span>
        </p>
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

function Body({ initial, timezone }: { initial: ThreadView; timezone: string | undefined }) {
  const { sellerId } = useSeller();
  const run = useSellerCommand();
  const [thread, setThread] = useState<ThreadView>(initial);
  const id = initial.id;

  // Opening a thread moves the shared Seller-side read mark forward (CHAT S10). If that call fails the mark simply stays where it was and the
  // list still shows the thread as unread, which is the truth; nothing is hidden by the failure, so there is nothing to report to the Seller.
  useEffect(() => {
    void run('inbox.read.mark', { conversation_id: id }).catch(() => undefined);
    // `run` is stable for the mounted Seller scope; the mark is moved once per opened thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        <Composer thread={thread} onSent={(next) => setThread((prev) => newer(prev, next))} />
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
  return <Body key={query.state.data.id} initial={query.state.data} timezone={timezone} />;
}
