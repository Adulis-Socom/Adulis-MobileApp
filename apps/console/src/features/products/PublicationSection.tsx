import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { codeText, formatInstant, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { StateBadge } from './badges';
import { can, type SectionProps } from './editor';
import { Section } from './Section';

/**
 * Publication (CON S49 steps 8-9, CATINV S48-S49): every blocker at once, each linking to the field that resolves it, then
 * publish or withdraw. Publishing is a command the server decides; a BLOCKED answer changes nothing and lists what is missing.
 * Publication is not availability: a published Product may have no stock (CATINV S22).
 */
export function PublicationSection({ detail, onChange, onReload, timezone }: SectionProps) {
  const run = useSellerCommand();
  const action = useAction();
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const { blockers, state, published_at: publishedAt } = detail.publication;

  async function publish() {
    setStatus(null);
    const outcome = await action.run(() => run('products.publish', { product_id: detail.id, version: detail.version }));
    if (!outcome) return;
    onChange(outcome.product);
    setStatus(outcome.result === 'PUBLISHED' ? t('publish.published_status') : t('publish.blocked_status', { count: outcome.product.publication.blockers.length }));
  }
  async function withdraw() {
    const next = await action.run(() => run('products.withdraw', { product_id: detail.id, version: detail.version }));
    setConfirm(false);
    if (next) {
      onChange(next);
      setStatus(t('publish.withdrawn_status'));
    }
  }

  return (
    <Section id="publication" title={t('publish.title')}>
      <div className="row">
        <StateBadge state={state} />
        {publishedAt ? (
          <span className="hint">
            {t('publish.published_at')} <time dateTime={publishedAt}>{formatInstant(publishedAt, timezone)}</time>
          </span>
        ) : null}
      </div>
      {state === 'RESTRICTED' ? (
        <p className="notice">
          <Icon name="lock" />
          <span>{t('publish.restricted_note')}</span>
        </p>
      ) : null}
      <ActionProblem action={action} onReload={onReload} />
      {blockers.length > 0 ? (
        <div className="stack">
          <h3>{t('publish.blockers_title', { count: blockers.length })}</h3>
          <ul className="plain-list blocker-list">
            {blockers.map((b, i) => {
              const text = codeText('blocker', b.code) ?? t('blocker.unknown', { code: b.code });
              return (
                <li key={`${b.code}-${b.field ?? i}-${i}`}>
                  <Icon name="alert" />
                  {b.field ? (
                    <a className="btn btn-link" href={`#${b.field}`}>
                      {text}
                    </a>
                  ) : (
                    <span>{text}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : state === 'PUBLISHED' ? null : state === 'RESTRICTED' ? null : (
        <p>{t('publish.ready_note')}</p>
      )}
      <div className="actions">
        {can(detail, 'PUBLISH') ? (
          <button type="button" className="btn btn-highlight" aria-disabled={action.busy} onClick={() => void publish()}>
            {state === 'WITHDRAWN' ? t('publish.republish') : t('publish.publish')}
          </button>
        ) : null}
        {can(detail, 'WITHDRAW') ? (
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(true)}>
            {t('publish.withdraw')}
          </button>
        ) : null}
      </div>
      <p role="status" className="hint">
        {status}
      </p>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t('publish.withdraw_title')}>
        <p>{t('publish.withdraw_body')}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" aria-disabled={action.busy} onClick={() => void withdraw()}>
            {t('publish.withdraw_confirm')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>
            {t('publish.withdraw_cancel')}
          </button>
        </div>
      </Dialog>
    </Section>
  );
}
