import { useState } from 'react';
import type { ReviewAggregate, ReviewDimension, ReviewItem } from '../../contracts/gap-sc-trust';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { can } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { Section } from '../products/Section';

function Failed({ title, retry }: { title: string; retry: () => void }) {
  return (
    <StatePanel kind="danger" alert title={title} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
      <p>{t('state.transport_error_body')}</p>
    </StatePanel>
  );
}

/**
 * The level (TRUST-01 S9, S73; CONSOLE-02 S90). Server-authoritative and read only: it is shown as the server holds it and never estimated, advanced
 * or explained as progress. Nothing derived from Orders or Handoffs is shown, because none is connected in this release (D24-01); the page says so.
 */
function Standing({ timezone }: { timezone: string | undefined }) {
  const { state, retry } = useSellerQuery('standing.get', {});
  return (
    <Section id="standing" title={t('trust.standing_title')}>
      {state.status === 'loading' ? <Skeleton rows={2} /> : null}
      {state.status === 'error' ? <Failed title={t('trust.error_title')} retry={retry} /> : null}
      {state.status === 'ready' ? (
        <div className="stack">
          <dl className="facts">
            <dt>{t('trust.level_label')}</dt>
            <dd>
              <Badge tone="info" icon="shield">
                {label('trust.level', state.data.level)}
              </Badge>
            </dd>
          </dl>
          {state.data.level === 'REBUILDING' ? <p>{t('trust.note.REBUILDING')}</p> : null}
          <p className="hint">{state.data.evaluated_at ? t('trust.evaluated', { time: formatInstant(state.data.evaluated_at, timezone) }) : t('trust.not_evaluated')}</p>
          <p className="notice">
            <Icon name="info" />
            <span>{t('trust.server_note')}</span>
          </p>
          <p className="hint">{t('trust.evidence_note')}</p>
        </div>
      ) : null}
    </Section>
  );
}

function Summary({ aggregate }: { aggregate: ReviewAggregate }) {
  return (
    <dl className="facts">
      <dt>{t('reviews.count_label')}</dt>
      <dd>{aggregate.count}</dd>
      {(['5', '4', '3', '2', '1'] as const).map((n) => (
        <div key={n} className="fact-pair">
          <dt>{t('reviews.stars', { n })}</dt>
          <dd>{aggregate.distribution[n]}</dd>
        </div>
      ))}
    </dl>
  );
}

function Row({ review, timezone }: { review: ReviewItem; timezone: string | undefined }) {
  return (
    <li className="ledger-row">
      <span className="ledger-main">
        <span className="ledger-title">{t('reviews.stars', { n: review.stars })}</span>
        {review.product_label !== null ? <span className="ledger-meta">{t('reviews.for_product', { product: review.product_label })}</span> : null}
        <span className="message-body">{review.text ?? t('reviews.no_text')}</span>
        <time className="ledger-meta" dateTime={review.written_at}>
          {formatInstant(review.written_at, timezone)}
        </time>
      </span>
    </li>
  );
}

/** One dimension's reviews, newest first, cursor-paginated. The server decides the page; there is no sort, filter, reply or action here (REV-01 S23, S41). */
function Reviews({ dimension, aggregate, timezone }: { dimension: ReviewDimension; aggregate: ReviewAggregate; timezone: string | undefined }) {
  const product = dimension === 'PRODUCT';
  const [cursor, setCursor] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<readonly ReviewItem[]>([]);
  const { state, retry } = useSellerQuery('reviews.list', { dimension, cursor });
  const current = state.status === 'ready' && !state.refreshing ? state.data : null;
  const shown = current ? [...earlier, ...current.items] : earlier;
  function more() {
    if (!current?.next_cursor) return;
    setEarlier(shown);
    setCursor(current.next_cursor);
  }
  return (
    <div className="stack subsection">
      <h3 className="subhead">{product ? t('reviews.product_title') : t('reviews.service_title')}</h3>
      <Summary aggregate={aggregate} />
      {state.status === 'error' ? <Failed title={t('reviews.error_title')} retry={retry} /> : null}
      {state.status === 'loading' ? <Skeleton rows={2} /> : null}
      {current && shown.length === 0 ? <p className="empty">{product ? t('reviews.empty_product') : t('reviews.empty_service')}</p> : null}
      {shown.length > 0 ? (
        <ul className="ledger" aria-label={product ? t('reviews.list_product') : t('reviews.list_service')} aria-busy={state.status === 'ready' && state.refreshing}>
          {shown.map((r) => (
            <Row key={r.id} review={r} timezone={timezone} />
          ))}
        </ul>
      ) : null}
      {current?.next_cursor ? (
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={more}>
            {product ? t('reviews.more_product') : t('reviews.more_service')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewsSection({ timezone }: { timezone: string | undefined }) {
  const { state, retry } = useSellerQuery('reviews.summary.get', {});
  return (
    <Section id="reviews" title={t('reviews.title')}>
      <p className="notice">
        <Icon name="info" />
        <span>{t('reviews.note')}</span>
      </p>
      {state.status === 'loading' ? <Skeleton rows={3} /> : null}
      {state.status === 'error' ? <Failed title={t('reviews.error_title')} retry={retry} /> : null}
      {state.status === 'ready' ? (
        <>
          <Reviews dimension="PRODUCT" aggregate={state.data.product} timezone={timezone} />
          <Reviews dimension="SELLER_SERVICE" aggregate={state.data.seller_service} timezone={timezone} />
        </>
      ) : null}
    </Section>
  );
}

/**
 * Trust and Reviews (CONSOLE-02 S90-S93, SC-FE-09): read only. Each part is shown only to a role that holds its permission (AUTH-02: Trust to Owner, Admin,
 * Sales Support and Inventory; Reviews to Owner, Admin and Sales Support). Product reviews and Seller-service reviews stay apart and are never combined into
 * one rating. Reporting a review and asking for a review of the level need the Operator process, so they are an honest, non-interactive "arrives later".
 */
export function Trust() {
  const { access } = useSeller();
  const market = useSellerQuery('market.context.get', {});
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;
  return (
    <>
      <PageTitle title={t('area.trust')}>{t('area.trust')}</PageTitle>
      <p className="lead">{t('trust.lead')}</p>
      {can(access, 'trust.read') ? <Standing timezone={timezone} /> : null}
      {can(access, 'reviews.read') ? <ReviewsSection timezone={timezone} /> : null}
      <Section id="deferred" title={t('trust.deferred_title')}>
        <p>{t('trust.deferred')}</p>
      </Section>
    </>
  );
}
