import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Badge, type Tone } from '../../components/Badge';
import { Field } from '../../components/Form';
import type { IconName } from '../../components/Icon';
import { label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { useDirty } from '../shared/dirty';
import { Section } from '../products/Section';
import { Stage } from './Stage';
import { canDo, imageSrc, type SceneSectionProps } from './sceneEditor';

const LOOK: Record<'PROCESSING' | 'READY' | 'REJECTED', { tone: Tone; icon: IconName }> = {
  PROCESSING: { tone: 'info', icon: 'clock' },
  READY: { tone: 'success', icon: 'check' },
  REJECTED: { tone: 'danger', icon: 'alert' },
};
/** How often the Console asks again while the image is processing. A UI refresh interval, not a business rule. */
const POLL_MS = 1000;

/** The Scene's image (SCN S21): photo only; native video upload does not exist. Processing is asynchronous. */
export function SceneImageSection({ scene, onChange, onReload, onRefresh, localImage, onLocalImage }: SceneSectionProps) {
  const run = useSellerCommand();
  const action = useAction();
  const editable = canDo(scene, 'EDIT');
  const processing = scene.image?.state === 'PROCESSING';

  useEffect(() => {
    if (!processing) return undefined;
    const id = window.setTimeout(onRefresh, POLL_MS);
    return () => window.clearTimeout(id);
  }, [processing, scene, onRefresh]);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const next = await action.run(() => run('scenes.media.set', { scene_id: scene.id, version: scene.version, file_name: file.name, content_type: file.type === '' ? 'application/octet-stream' : file.type }));
    if (next) {
      onLocalImage(file);
      onChange(next);
    }
  }
  const src = imageSrc(scene, localImage);

  return (
    <Section id="image" title={t('scenes.image_title')}>
      <ActionProblem action={action} onReload={onReload} />
      {scene.image ? (
        <>
          <Stage aspect={scene.image.aspect} imageName={scene.image.file_name} imageUrl={src.url} measure={src.measure} markers={[]} />
          <p>
            <Badge tone={LOOK[scene.image.state].tone} icon={LOOK[scene.image.state].icon}>
              {label('media.state', scene.image.state)}
            </Badge>
          </p>
          {scene.image.state === 'REJECTED' ? <p className="hint">{t('media.rejected_hint')}</p> : null}
        </>
      ) : (
        <p className="empty">{t('scenes.image_empty')}</p>
      )}
      {processing ? (
        <p role="status" className="hint">
          {t('media.processing_note')}
        </p>
      ) : null}
      {editable ? (
        <Field id="scene-file" label={scene.image ? t('scenes.image_replace_label') : t('scenes.image_add_label')} hint={t('scenes.image_hint')} error={action.fields['image']}>
          {(control) => <input {...control} className="text-input" type="file" accept="image/*" onChange={(e) => void pick(e)} />}
        </Field>
      ) : null}
    </Section>
  );
}

/** The caption (SCN S20): required to publish, plain text, never a second source of Product facts. */
export function SceneCaptionSection({ scene, onChange, onReload }: SceneSectionProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const editable = canDo(scene, 'EDIT');
  const [caption, setCaption] = useState(scene.caption);
  useDirty('caption', caption !== scene.caption);

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('scenes.update', { scene_id: scene.id, version: scene.version, caption }));
    if (next) onChange(next);
  }

  return (
    <Section id="caption-section" title={t('scenes.caption_title')}>
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          <Field id="caption" label={t('scenes.caption_label')} hint={t('scenes.caption_hint')} error={action.fields['caption']}>
            {(control) => <textarea {...control} className="text-input" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />}
          </Field>
        </fieldset>
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('scenes.caption_save')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}
