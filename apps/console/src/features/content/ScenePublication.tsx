import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { codeText, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { Section } from '../products/Section';
import { ModerationNote, PrivateReason, SceneBadges } from './sceneBadges';
import { canDo, type SceneSectionProps } from './sceneEditorModel';

/**
 * Publication (SCN S27-S33, CON S65): every blocker at once, linking to what resolves it; then publish or archive.
 * The server recomputes eligibility in the command; a BLOCKED answer changes nothing. Private is shown with its reason
 * and the condition that restores it (restock is automatic, never a manual republish). Moderation is shown, never decided here.
 */
export function ScenePublication({ scene, onChange, onReload, timezone }: SceneSectionProps) {
  const run = useSellerCommand();
  const action = useAction();
  const [confirm, setConfirm] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const published = scene.publication_state === 'PUBLISHED';

  async function publish() {
    setStatus(null);
    const outcome = await action.run(() => run('scenes.publish', { scene_id: scene.id, version: scene.version }));
    if (!outcome) return;
    onChange(outcome.scene);
    setStatus(outcome.result === 'PUBLISHED' ? t('scenes.published_status') : t('scenes.blocked_status', { count: outcome.scene.blockers.length }));
  }
  async function archive() {
    const next = await action.run(() => run('scenes.archive', { scene_id: scene.id, version: scene.version }));
    setConfirm(false);
    if (next) {
      onChange(next);
      setStatus(t('scenes.archived_status'));
    }
  }

  return (
    <Section id="publication" title={t('scenes.publication_title')}>
      <div className="row">
        <SceneBadges publication={scene.publication_state} visibility={scene.visibility} moderation={scene.moderation} />
      </div>
      {published && scene.visibility === 'PRIVATE' && scene.private_reason !== null ? (
        <div className="stack">
          <p className="notice">
            <Icon name="lock" />
            <span>
              <PrivateReason reason={scene.private_reason} />
            </span>
          </p>
          <p className="hint">{t('scenes.private_restore')}</p>
        </div>
      ) : null}
      {scene.moderation ? (
        <div className="stack">
          <h3>{t('moderation.title')}</h3>
          <ModerationNote moderation={scene.moderation} timezone={timezone} />
          <p className="hint">{t('moderation.note')}</p>
        </div>
      ) : null}
      <ActionProblem action={action} onReload={onReload} />
      {scene.blockers.length > 0 ? (
        <div className="stack">
          <h3>{t('scenes.blockers_title', { count: scene.blockers.length })}</h3>
          <ul className="plain-list blocker-list">
            {scene.blockers.map((b, i) => {
              const text = codeText('scene.blocker', b.code) ?? t('scene.blocker.unknown', { code: b.code });
              return (
                <li key={`${b.code}-${i}`}>
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
      ) : scene.publication_state === 'DRAFT' ? (
        <p>{t('scenes.ready_note')}</p>
      ) : null}
      <div className="actions">
        {canDo(scene, 'PUBLISH') ? (
          <button type="button" className="btn btn-highlight" aria-disabled={action.busy} onClick={() => void publish()}>
            {t('scenes.publish')}
          </button>
        ) : null}
        {canDo(scene, 'ARCHIVE') ? (
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(true)}>
            {t('scenes.archive')}
          </button>
        ) : null}
      </div>
      <p role="status" className="hint">
        {status}
      </p>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t('scenes.archive_title')}>
        <p>{t('scenes.archive_body')}</p>
        <div className="actions">
          <button type="button" className="btn btn-primary" aria-disabled={action.busy} onClick={() => void archive()}>
            {t('scenes.archive_confirm')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setConfirm(false)}>
            {t('scenes.archive_cancel')}
          </button>
        </div>
      </Dialog>
    </Section>
  );
}
