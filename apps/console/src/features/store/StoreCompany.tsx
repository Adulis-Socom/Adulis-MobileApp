import { useState, type FormEvent } from 'react';
import { Field } from '../../components/Form';
import { Icon } from '../../components/Icon';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useDirty } from '../shared/dirty';
import { useAction } from '../shared/useAction';
import { StoreFrame, type StoreProps } from './StoreFrame';

function Body({ view, onChange, onReload, editable }: StoreProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const company = view.company;
  const [name, setName] = useState(company?.company_name ?? '');
  const [description, setDescription] = useState(company?.description ?? '');
  const [representative, setRepresentative] = useState(company?.representative_name ?? '');
  const [phone, setPhone] = useState(company?.contact_phone ?? '');
  useDirty('company', company !== null && (name !== company.company_name || description !== company.description || representative !== company.representative_name || phone !== company.contact_phone));
  // Representative or control changes stay with the Owner (ONB-01 S178); the server says whether this account may make them.
  const mayChangeRepresentative = view.allowed_actions.includes('EDIT_REPRESENTATIVE') || (company?.representative_name ?? '') === '';

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('store.company.update', { version: view.version, details: { company_name: name, description, representative_name: representative, contact_phone: phone } }));
    if (next) onChange(next);
  }

  if (company === null) {
    return (
      <Section id="company-section" title={t('company.title')}>
        <p className="empty">{t('company.not_a_company')}</p>
      </Section>
    );
  }
  return (
    <Section id="company-section" title={t('company.title')}>
      <p className="notice">
        <Icon name="info" />
        <span>{t('company.not_verification')}</span>
      </p>
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          <Field id="company_name" label={t('company.name_label')} error={action.fields['company_name']}>
            {(control) => <input {...control} className="text-input" type="text" autoComplete="organization" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field id="company_description" label={t('company.description_label')} hint={t('company.description_hint')}>
            {(control) => <textarea {...control} className="text-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
          <Field id="representative_name" label={t('company.representative_label')} hint={mayChangeRepresentative ? t('company.representative_hint') : t('company.representative_owner_only')} error={action.fields['representative_name']}>
            {(control) => <input {...control} className="text-input" type="text" disabled={!mayChangeRepresentative} value={representative} onChange={(e) => setRepresentative(e.target.value)} />}
          </Field>
          <Field id="contact_phone" label={t('company.contact_label')} hint={t('company.contact_hint')} error={action.fields['contact_phone']}>
            {(control) => <input {...control} className="text-input" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
        </fieldset>
        <p className="hint">{t('company.no_id_note')}</p>
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('company.save')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}

/**
 * Company details (ONB-01 S71, S73, S178): conditional business metadata for a Company Seller. It is NOT verification and the page
 * says so: having filled it in does not mean Adulis checked the company or its representative. No Government ID, no payout, nothing
 * financial. Owner or Admin edit the ordinary details; the representative is Owner-only, as the server resolves it.
 */
export function StoreCompany() {
  return <StoreFrame title={t('company.page')}>{(p) => <Body {...p} />}</StoreFrame>;
}
