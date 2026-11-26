import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { can, categoryPath, type CategorySectionProps } from './editor';
import { Section } from './Section';

/** Core identity and category (CON S49 step 1). A draft may stay uncategorised; the server asks for a category before first publication. */
export function IdentitySection({ detail, categories, onChange, onReload }: CategorySectionProps) {
  const run = useSellerCommand();
  const action = useAction();
  const editable = can(detail, 'EDIT');
  const [title, setTitle] = useState(detail.title);
  const [description, setDescription] = useState(detail.description);
  const [category, setCategory] = useState(detail.category_id ?? '');
  const chosen = categories.find((c) => c.id === category);

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('products.update', { product_id: detail.id, version: detail.version, title, description, category_id: category === '' ? null : category }));
    if (next) onChange(next);
  }

  return (
    <Section id="identity" title={t('editor.identity_title')}>
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          <Field id="title" label={t('editor.title_label')} error={action.fields['title']}>
            {(control) => <input {...control} className="text-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field id="description" label={t('editor.description_label')} hint={t('editor.description_hint')} error={action.fields['description']}>
            {(control) => <textarea {...control} className="text-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field id="category" label={t('editor.category_label')} hint={t('editor.category_hint')} error={action.fields['category']}>
            {(control) => (
              <select {...control} className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{t('editor.category_none')}</option>
                {categories
                  .filter((c) => c.selectable || c.id === category)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryPath(c, categories)}
                    </option>
                  ))}
              </select>
            )}
          </Field>
        </fieldset>
        {chosen && chosen.definition_status !== 'DEFINED' ? (
          <p className="notice">
            <Icon name="info" />
            <span>{t(chosen.definition_status === 'NOT_DEFINED' ? 'editor.gap_category_not_defined' : 'editor.gap_category_attributes')}</span>
          </p>
        ) : null}
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('editor.save_identity')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}
