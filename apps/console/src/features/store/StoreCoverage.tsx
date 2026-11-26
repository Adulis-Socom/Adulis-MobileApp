import { useState, type FormEvent } from 'react';
import { Group } from '../../components/Form';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { useDirty } from '../shared/dirty';
import { StoreFrame, type StoreProps } from './StoreFrame';

function Body({ view, onChange, onReload, editable }: StoreProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const [selected, setSelected] = useState<readonly string[]>(view.coverage.selected);
  useDirty('coverage', JSON.stringify([...selected].sort()) !== JSON.stringify([...view.coverage.selected].sort()));

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('store.coverage.set', { version: view.version, selected }));
    if (next) onChange(next);
  }

  return (
    <Section id="coverage-section" title={t('store.coverage_title')}>
      <p className="hint">{t('store.coverage_hint')}</p>
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          <Group id="coverage" legend={t('store.coverage_legend')} error={action.fields['coverage']}>
            {view.coverage.options.map((o) => (
              <label key={o.id} className="choice">
                <input type="checkbox" checked={selected.includes(o.id)} onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)))} />
                <span>{o.label}</span>
              </label>
            ))}
          </Group>
        </fieldset>
        {selected.length === 0 ? <p className="hint">{t('store.coverage_none')}</p> : null}
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('store.coverage_save')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}

/**
 * Service coverage (MKT-01 S9, FUL-01 Nov 24 change 2): the Market is the policy boundary and coverage is the area the Seller
 * actually serves inside it. Being in the Market grants no coverage, so it is chosen explicitly and starts empty.
 */
export function StoreCoverage() {
  return <StoreFrame title={t('store.coverage_page')}>{(p) => <Body {...p} />}</StoreFrame>;
}
