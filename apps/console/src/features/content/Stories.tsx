import { useEffect, useState } from 'react';
import type { StoryView } from '../../contracts/gap-sc-content';
import { Badge } from '../../components/Badge';
import { Dialog } from '../../components/Dialog';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { formatInstant, label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { ContentNav } from './ContentNav';
import { StoryComposer } from './StoryComposer';

/** The longest delay setTimeout accepts. Only used to schedule a re-read; the time itself is never decided here. */
const MAX_TIMER_MS = 2_147_483_647;

function Row({ story, timezone, onDone }: { story: StoryView; timezone: string | undefined; onDone: () => void }) {
  const run = useSellerCommand();
  const action = useAction();
  const [confirm, setConfirm] = useState(false);
  const live = story.state === 'PUBLISHED';

  async function withdraw() {
    const next = await action.run(() => run('stories.withdraw', { story_id: story.id, version: story.version }));
    setConfirm(false);
    if (next) onDone();
  }

  return (
    <li className="ledger-row">
      <div className="stack">
        <div className="row">
          <span className="ledger-title">{story.text ?? t('stories.no_text')}</span>
          <span className="badges">
            <Badge tone={live ? 'success' : 'neutral'} icon={live ? 'check' : 'x'}>
              {label('story.state', story.state)}
            </Badge>
            {story.public ? (
              <Badge tone="success" icon="check">
                {t('stories.public_now')}
              </Badge>
            ) : (
              <Badge tone="warn" icon="lock">
                {t('stories.not_public')}
              </Badge>
            )}
            {story.moderation ? (
              <Badge tone="warn" icon="alert">
                {label('moderation.state', story.moderation.state)}
              </Badge>
            ) : null}
          </span>
        </div>
        {story.not_public_reason !== null && story.state === 'PUBLISHED' ? <p className="hint">{label('story.not_public_reason', story.not_public_reason)}</p> : null}
        <p className="ledger-meta">{t('stories.photo', { name: story.photo_name })}</p>
        <p className="ledger-meta">{story.target ? t(story.target.kind === 'PRODUCT' ? 'stories.linked_product' : 'stories.linked_scene', { label: story.target.label }) : t('stories.no_link')}</p>
        <p className="ledger-meta">
          {live ? t('stories.public_until') : t('stories.ended_at')}{' '}
          <time dateTime={story.expires_at}>{formatInstant(story.expires_at, timezone)}</time>
        </p>
        <ActionProblem action={action} onReload={onDone} />
        {story.allowed_actions.includes('WITHDRAW') ? (
          <div className="actions">
            <button type="button" className="btn btn-quiet" onClick={() => setConfirm(true)}>
              {t('stories.withdraw')}
            </button>
          </div>
        ) : null}
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t('stories.withdraw_title')}>
        <p>{t('stories.withdraw_body')}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" aria-disabled={action.busy} onClick={() => void withdraw()}>
            {t('stories.withdraw_confirm')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>
            {t('stories.withdraw_cancel')}
          </button>
        </div>
      </Dialog>
    </li>
  );
}

/**
 * Seller Stories (STORY contract, SC-FE-05S): one photo, optional short text, zero or one same-Seller link, a public
 * lifetime the SERVER authors. The Console shows the server's timestamps and states and never computes an expiry; at an end
 * time it asks again, and what comes back is the answer. A published Story is withdrawn, never edited.
 */
export function Stories() {
  const { state, retry } = useSellerQuery('stories.list', {});
  const market = useSellerQuery('market.context.get', {});
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;

  // At the next end time, read again. The clock only schedules the question; the displayed state is always the server's.
  useEffect(() => {
    if (state.status !== 'ready' || state.refreshing) return undefined;
    const ends = state.data.items.filter((s) => s.state === 'PUBLISHED').map((s) => Date.parse(s.expires_at)).filter((n) => Number.isFinite(n) && n > Date.now());
    if (ends.length === 0) return undefined;
    const wait = Math.min(Math.min(...ends) - Date.now() + 500, MAX_TIMER_MS);
    const id = window.setTimeout(() => {
      setNote(t('stories.refreshed_note'));
      retry();
    }, wait);
    return () => window.clearTimeout(id);
  }, [state, retry]);

  const canCreate = state.status === 'ready' && state.data.allowed_actions.includes('CREATE');
  return (
    <>
      <PageTitle title={t('stories.title')}>{t('stories.title')}</PageTitle>
      <p className="lead">{t('stories.lead')}</p>
      <ContentNav />
      <p role="status" className="hint">
        {note}
      </p>
      {composing ? (
        <StoryComposer
          onCancel={() => setComposing(false)}
          onPublished={() => {
            setComposing(false);
            setNote(t('stories.published_note'));
            retry();
          }}
        />
      ) : canCreate ? (
        <div className="actions">
          <button type="button" className="btn btn-highlight" onClick={() => setComposing(true)}>
            {t('stories.add')}
          </button>
        </div>
      ) : null}
      {state.status === 'error' ? (
        <StatePanel
          kind="danger"
          alert
          title={t('stories.error_title')}
          actions={
            <button type="button" className="btn btn-primary" onClick={retry}>
              {t('state.retry')}
            </button>
          }
        >
          <p>{t('state.transport_error_body')}</p>
        </StatePanel>
      ) : null}
      {state.status === 'loading' ? <Skeleton rows={3} /> : null}
      {state.status === 'ready' && state.data.items.length === 0 ? <StatePanel kind="neutral" title={t('stories.empty')} /> : null}
      {state.status === 'ready' && state.data.items.length > 0 ? (
        <ul className="ledger" aria-label={t('stories.list_label')} aria-busy={state.refreshing}>
          {state.data.items.map((s) => (
            <Row key={s.id} story={s} timezone={timezone} onDone={retry} />
          ))}
        </ul>
      ) : null}
      {state.status === 'ready' ? <p className="hint">{t('stories.no_edit_note')}</p> : null}
    </>
  );
}
