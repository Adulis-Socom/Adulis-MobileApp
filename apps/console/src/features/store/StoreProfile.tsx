import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Form';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { StoreFrame, type StoreProps } from './StoreFrame';

function Form({ view, onChange, onReload, editable }: StoreProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const [name, setName] = useState(view.profile.display_name);
  const [bio, setBio] = useState(view.profile.bio);

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('store.profile.update', { version: view.version, display_name: name, bio }));
    if (next) onChange(next);
  }

  return (
    <Section id="profile" title={t('store.profile_title')}>
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          <Field id="display_name" label={t('store.name_label')} hint={t('store.name_hint')} error={action.fields['display_name']}>
            {(control) => <input {...control} className="text-input" type="text" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field id="bio" label={t('store.bio_label')} hint={t('store.bio_hint')} error={action.fields['bio']}>
            {(control) => <textarea {...control} className="text-input" rows={4} value={bio} onChange={(e) => setBio(e.target.value)} />}
          </Field>
        </fieldset>
        <dl className="facts">
          <dt>{t('store.handle_label')}</dt>
          <dd>{view.profile.handle}</dd>
        </dl>
        <p className="hint">{t('store.handle_note')}</p>
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('store.profile_save')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}

/** Store profile (CONSOLE-02 S97-S99): public name and bio. The handle belongs to the Storefront domain and is shown, never edited here. */
export function StoreProfile() {
  return <StoreFrame title={t('store.title')} lead={t('store.lead')}>{(p) => <Form {...p} />}</StoreFrame>;
}
