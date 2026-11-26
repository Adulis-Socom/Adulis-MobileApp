import { useState, type FormEvent } from 'react';
import type { AttributeDef } from '../../contracts/gap-sc-catalogue';
import { Field, Group } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { can, type AttributeSectionProps } from './editor';
import { Section } from './Section';

function Control({ def, value, onChange, error }: { def: AttributeDef; value: readonly string[]; onChange: (next: readonly string[]) => void; error: string | undefined }) {
  const id = `attr-${def.id}`;
  const hint = def.required ? t('editor.attribute_required') : undefined;
  if (def.value_type === 'MULTI') {
    return (
      <Group id={id} legend={def.label} error={error} {...(hint ? { hint } : {})}>
        {def.values.map((v) => (
          <label key={v.id} className="choice">
            <input type="checkbox" checked={value.includes(v.id)} onChange={(e) => onChange(e.target.checked ? [...value, v.id] : value.filter((x) => x !== v.id))} />
            <span>{v.label}</span>
          </label>
        ))}
      </Group>
    );
  }
  return (
    <Field id={id} label={def.label} error={error} {...(hint ? { hint } : {})}>
      {(control) =>
        def.value_type === 'TEXT' ? (
          <input {...control} className="text-input" type="text" value={value[0] ?? ''} onChange={(e) => onChange(e.target.value === '' ? [] : [e.target.value])} />
        ) : (
          <select {...control} className="text-input" value={value[0] ?? ''} onChange={(e) => onChange(e.target.value === '' ? [] : [e.target.value])}>
            <option value="">{t('editor.attribute_not_set')}</option>
            {def.values.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )
      }
    </Field>
  );
}

/**
 * Product-level attributes (CON S50), rendered from the definitions the server returned for the SAVED category. The Console
 * hard-codes no attribute, value or required rule. When the category's attributes are not defined, that gap is said out loud.
 */
export function AttributesSection({ detail, attributes, onChange, onReload }: AttributeSectionProps) {
  const run = useSellerCommand();
  const action = useAction();
  const editable = can(detail, 'EDIT');
  const [values, setValues] = useState<Record<string, readonly string[]>>({ ...detail.attributes });
  const defs = (attributes?.attributes ?? []).filter((d) => d.scope === 'PRODUCT');

  async function save(event: FormEvent) {
    event.preventDefault();
    const entries = Object.entries(values).filter(([id, v]) => v.length > 0 && defs.some((d) => d.id === id));
    const next = await action.run(() => run('products.update', { product_id: detail.id, version: detail.version, attributes: Object.fromEntries(entries) }));
    if (next) onChange(next);
  }

  return (
    <Section id="attributes" title={t('editor.attributes_title')}>
      {attributes === null ? <p className="empty">{t('editor.attributes_need_category')}</p> : null}
      {attributes !== null && attributes.definition_status !== 'DEFINED' ? (
        <p className="notice">
          <Icon name="info" />
          <span>{t(attributes.definition_status === 'NOT_DEFINED' ? 'editor.gap_category_not_defined' : 'editor.gap_category_attributes')}</span>
        </p>
      ) : null}
      {attributes !== null && attributes.definition_status === 'DEFINED' && defs.length === 0 ? <p className="empty">{t('editor.attributes_none')}</p> : null}
      {defs.length > 0 ? (
        <form onSubmit={(e) => void save(e)} noValidate className="stack">
          <ActionProblem action={action} onReload={onReload} />
          <fieldset className="plain-fieldset" disabled={!editable}>
            {defs.map((d) => (
              <Control key={d.id} def={d} value={values[d.id] ?? []} onChange={(next) => setValues((prev) => ({ ...prev, [d.id]: next }))} error={action.fields[`attr-${d.id}`]} />
            ))}
          </fieldset>
          {editable ? (
            <div className="actions">
              <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
                {action.busy ? t('editor.saving') : t('editor.save_attributes')}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}
    </Section>
  );
}
