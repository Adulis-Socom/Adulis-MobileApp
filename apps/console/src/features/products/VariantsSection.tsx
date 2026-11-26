import { useState, type FormEvent } from 'react';
import type { VariantView } from '../../contracts/gap-sc-catalogue';
import { Badge } from '../../components/Badge';
import { Field, Group } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { formatMoney, inputToMinor, minorToInput } from '../../i18n/money';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { useDirty } from '../shared/dirty';
import { can, type AttributeSectionProps, type SectionProps } from './editor';
import { Section } from './Section';

/** Entered text to minor units. Empty is "no price yet" (null); text that is not an amount is undefined, which the caller reports. */
function parsePrice(text: string, currency: string): number | null | undefined {
  if (text.trim() === '') return null;
  return inputToMinor(text, currency) ?? undefined;
}

function VariantRow({ detail, variant, onChange, onReload }: SectionProps & { variant: VariantView }) {
  const run = useSellerCommand();
  const action = useAction();
  const editable = can(detail, 'EDIT_VARIANT');
  const [price, setPrice] = useState(variant.price_minor === null ? '' : minorToInput(variant.price_minor, detail.currency));
  const fieldId = `variant-${variant.id}-price`;
  useDirty(fieldId, price !== (variant.price_minor === null ? '' : minorToInput(variant.price_minor, detail.currency)));

  async function update(change: { price_minor: number | null } | { active: boolean }) {
    const next = await action.run(() => run('variants.update', { product_id: detail.id, version: detail.version, variant_id: variant.id, ...change }));
    if (next) onChange(next);
  }
  function savePrice(event: FormEvent) {
    event.preventDefault();
    const minor = parsePrice(price, detail.currency);
    if (minor === undefined) {
      action.fail({ [fieldId]: 'PRICE_INVALID' });
      return;
    }
    void update({ price_minor: minor });
  }

  return (
    <li className="ledger-row">
      <div className="stack">
        <div className="row-start">
          <h3 className="ledger-title">{variant.summary}</h3>
          {variant.active ? null : (
            <Badge tone="neutral" icon="x">
              {t('variants.inactive')}
            </Badge>
          )}
        </div>
        {editable ? (
          <form onSubmit={savePrice} noValidate className="stack">
            <ActionProblem action={action} onReload={onReload} />
            <Field id={fieldId} label={t('variants.price_label', { currency: detail.currency })} error={action.fields[fieldId]}>
              {(control) => <input {...control} className="text-input" type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}
            </Field>
            <div className="actions">
              <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
                {t('variants.save_price')}
              </button>
              <button type="button" className="btn btn-quiet" aria-disabled={action.busy} onClick={() => void update({ active: !variant.active })}>
                {variant.active ? t('variants.deactivate') : t('variants.reactivate')}
              </button>
            </div>
          </form>
        ) : (
          <p>{variant.price_minor === null ? t('variants.no_price') : formatMoney(variant.price_minor, detail.currency)}</p>
        )}
      </div>
    </li>
  );
}

function AddVariant({ detail, attributes, onChange, onReload }: AttributeSectionProps) {
  const run = useSellerCommand();
  const action = useAction();
  const defs = (attributes?.attributes ?? []).filter((d) => d.scope === 'VARIANT');
  const [options, setOptions] = useState<Record<string, string>>({});
  const [price, setPrice] = useState('');
  useDirty('variant-add', price.trim() !== '' || Object.values(options).some((v) => v !== ''));

  async function add(event: FormEvent) {
    event.preventDefault();
    const minor = parsePrice(price, detail.currency);
    if (minor === undefined) {
      action.fail({ price: 'PRICE_INVALID' });
      return;
    }
    const chosen = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== ''));
    const next = await action.run(() => run('variants.create', { product_id: detail.id, version: detail.version, options: chosen, price_minor: minor }));
    if (next) {
      setOptions({});
      setPrice('');
      onChange(next);
    }
  }

  return (
    <form onSubmit={(e) => void add(e)} noValidate className="stack">
      <h3>{t('variants.add_title')}</h3>
      <ActionProblem action={action} onReload={onReload} />
      {attributes !== null && attributes.definition_status !== 'DEFINED' ? (
        <p className="notice">
          <Icon name="info" />
          <span>{t('editor.gap_variant_attributes')}</span>
        </p>
      ) : null}
      {defs.length === 0 ? (
        <p className="hint" id="options">
          {t('variants.default_hint')}
        </p>
      ) : (
        <Group id="options" legend={t('variants.options_legend')} error={action.fields['options']}>
          {defs.map((d) => (
            <Field key={d.id} id={`option-${d.id}`} label={d.label} error={action.fields[`option-${d.id}`]}>
              {(control) => (
                <select {...control} className="text-input" value={options[d.id] ?? ''} onChange={(e) => setOptions((prev) => ({ ...prev, [d.id]: e.target.value }))}>
                  <option value="">{t('variants.option_choose')}</option>
                  {d.values.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ))}
        </Group>
      )}
      <Field id="price" label={t('variants.price_label', { currency: detail.currency })} error={action.fields['price']}>
        {(control) => <input {...control} className="text-input" type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}
      </Field>
      <div className="actions">
        <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
          {defs.length === 0 ? t('variants.add_default') : t('variants.add')}
        </button>
      </div>
    </form>
  );
}

/** Variants and their prices (CON S49 steps 3-4, S51): price belongs to the sellable combination; uniqueness is the server's to enforce. */
export function VariantsSection(props: AttributeSectionProps) {
  const { detail } = props;
  return (
    <Section id="variants" title={t('variants.title')}>
      {detail.variants.length === 0 ? (
        <p className="empty">{t('variants.empty')}</p>
      ) : (
        <ul className="ledger" aria-label={t('variants.list_label')}>
          {detail.variants.map((v) => (
            <VariantRow key={v.id} {...props} variant={v} />
          ))}
        </ul>
      )}
      {can(detail, 'ADD_VARIANT') ? <AddVariant {...props} /> : null}
    </Section>
  );
}
