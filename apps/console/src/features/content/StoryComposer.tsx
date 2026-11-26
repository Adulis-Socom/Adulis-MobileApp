import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { StoryView } from '../../contracts/gap-sc-content';
import { Field, Group } from '../../components/Form';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { useDirty } from '../shared/dirty';
import { useAction } from '../shared/useAction';
import { Section } from '../products/Section';
import { Stage } from './Stage';

type LinkKind = 'NONE' | 'PRODUCT' | 'SCENE';
/** The only aspect the Console frames a Story photo in before the file's own is known. The contract names none; a presentation frame, not a rule. */
const PREVIEW_ASPECT = 0.8;

interface Photo {
  readonly name: string;
  readonly type: string;
  /** In browser memory only; revoked when replaced or when the composer closes, unless handed over to the list. */
  readonly url: string;
}

/**
 * Compose a Story (STORY contract): exactly one still photo, optional short text, zero or one link to a Product or Scene that the server
 * says is eligible (same Seller, same Market, publicly eligible). It is previewed with the real photo before it is published and cannot
 * be edited afterwards. No video, no length or size limit is invented here: the server answers what it will not accept.
 * The link is NEVER dropped silently: if the chosen target stops being offered, or the server refuses it at publication, the Seller is
 * returned to the field with the reason and must correct it. A Story with no link shows no Product or Scene button; the preview says so.
 */
export function StoryComposer({ onCancel, onPublished }: { onCancel: () => void; onPublished: (story: StoryView, photoUrl: string) => void }) {
  const run = useSellerCommand();
  const action = useAction();
  const targets = useSellerQuery('stories.targets.get', {});
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<LinkKind>('NONE');
  const [targetId, setTargetId] = useState('');
  const [step, setStep] = useState<'edit' | 'preview'>('edit');
  useDirty('story', photo !== null || text.trim() !== '' || kind !== 'NONE');

  // The photo URL belongs to this composer until it is handed to the list on publication; every other exit revokes it.
  const held = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (held.current) URL.revokeObjectURL(held.current);
    },
    [],
  );

  const options = targets.state.status === 'ready' ? (kind === 'PRODUCT' ? targets.state.data.products : kind === 'SCENE' ? targets.state.data.scenes : []) : [];
  const chosen = options.find((o) => o.id === targetId) ?? null;

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (held.current) URL.revokeObjectURL(held.current);
    held.current = URL.createObjectURL(file);
    setPhoto({ name: file.name, type: file.type === '' ? 'application/octet-stream' : file.type, url: held.current });
  }
  function toPreview(event: FormEvent) {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (photo === null) errors['photo'] = 'MEDIA_FILE_REQUIRED';
    if (kind !== 'NONE') {
      if (targetId === '') errors['target-id'] = 'TARGET_REQUIRED';
      // A selected target that is no longer offered is NOT turned into an unlinked Story: the Seller corrects it on purpose.
      else if (chosen === null) errors['target-id'] = 'TARGET_NOT_ELIGIBLE';
    }
    if (Object.keys(errors).length > 0) {
      action.fail(errors);
      return;
    }
    action.reset();
    setStep('preview');
  }
  async function publish() {
    if (photo === null) return;
    const outcome = await action.run(() =>
      run('stories.create', { photo_name: photo.name, content_type: photo.type, text: text.trim() === '' ? null : text.trim(), target: kind === 'NONE' ? null : { kind, id: targetId } }),
    );
    if (outcome) {
      held.current = null; // handed over: the list owns the URL now
      onPublished(outcome, photo.url);
    } else setStep('edit'); // the fields the server named are on the editing step
  }

  if (targets.state.status === 'loading') return <Skeleton rows={4} />;
  if (targets.state.status === 'error') {
    return (
      <StatePanel kind="danger" alert title={t('stories.targets_error')} actions={<button type="button" className="btn btn-primary" onClick={targets.retry}>{t('state.retry')}</button>}>
        <p>{t('state.transport_error_body')}</p>
      </StatePanel>
    );
  }

  if (step === 'preview' && photo !== null) {
    const label = chosen?.label ?? '';
    return (
      <Section id="story-preview" title={t('stories.preview_title')}>
        <p className="hint">{t('stories.preview_note')}</p>
        <Stage aspect={PREVIEW_ASPECT} imageName={photo.name} imageUrl={photo.url} measure markers={[]} />
        <p>{text.trim() === '' ? t('stories.no_text') : text.trim()}</p>
        <p>{kind === 'NONE' ? t('stories.preview_no_link') : t(kind === 'PRODUCT' ? 'stories.preview_links_product' : 'stories.preview_links_scene', { label })}</p>
        <ActionProblem action={action} />
        <div className="actions">
          <button type="button" className="btn btn-highlight" aria-disabled={action.busy} onClick={() => void publish()}>
            {t('stories.publish')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => setStep('edit')}>
            {t('stories.back_to_edit')}
          </button>
        </div>
      </Section>
    );
  }

  const fields = action.fields;
  return (
    <Section id="story-compose" title={t('stories.compose_title')}>
      <form onSubmit={toPreview} noValidate className="stack">
        <ActionProblem action={action} />
        <Field id="photo" label={t('stories.photo_label')} hint={photo ? t('stories.photo_chosen', { name: photo.name }) : t('stories.photo_hint')} error={fields['photo']}>
          {(control) => <input {...control} className="text-input" type="file" accept="image/*" onChange={pick} />}
        </Field>
        {photo ? <img className="story-photo" src={photo.url} alt={t('stories.photo_alt', { name: photo.name })} draggable={false} /> : null}
        <Field id="text" label={t('stories.text_label')} hint={t('stories.text_hint')} error={fields['text']}>
          {(control) => <textarea {...control} className="text-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <Group id="target" legend={t('stories.link_legend')} hint={t('stories.link_hint')} error={fields['target']}>
          {(['NONE', 'PRODUCT', 'SCENE'] as const).map((k) => (
            <label key={k} className="choice">
              <input
                type="radio"
                name="story_link"
                checked={kind === k}
                onChange={() => {
                  setKind(k);
                  setTargetId('');
                }}
              />
              <span>{t(k === 'NONE' ? 'stories.link_none' : k === 'PRODUCT' ? 'stories.link_product' : 'stories.link_scene')}</span>
            </label>
          ))}
        </Group>
        {kind !== 'NONE' ? (
          <Field id="target-id" label={t(kind === 'PRODUCT' ? 'stories.target_product' : 'stories.target_scene')} error={fields['target-id']}>
            {(control) => (
              <select {...control} className="text-input" value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                <option value="">{t('stories.target_choose')}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : null}
        {kind !== 'NONE' && options.length === 0 ? <p className="hint">{t(kind === 'PRODUCT' ? 'stories.no_products' : 'stories.no_scenes')}</p> : null}
        <div className="actions">
          <button type="submit" className="btn btn-primary">
            {t('stories.preview')}
          </button>
          <button type="button" className="btn btn-quiet" onClick={onCancel}>
            {t('stories.cancel')}
          </button>
        </div>
      </form>
    </Section>
  );
}
