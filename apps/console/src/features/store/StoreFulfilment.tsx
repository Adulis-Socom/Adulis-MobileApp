import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import type { FulfilmentMode } from '../../contracts/gap-sc-store';
import { Field, Group } from '../../components/Form';
import { label, t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { Section } from '../products/Section';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { StoreFrame, type StoreProps } from './StoreFrame';

function Body({ view, onChange, onReload, editable }: StoreProps) {
  const { sellerId } = useSeller();
  const run = useSellerCommand();
  const action = useAction(true);
  const [settings, setSettings] = useState(() => view.fulfilment.map((f) => ({ mode: f.mode, enabled: f.enabled, instructions: f.instructions })));
  const set = (mode: FulfilmentMode, change: Partial<{ enabled: boolean; instructions: string }>) => setSettings((prev) => prev.map((s) => (s.mode === mode ? { ...s, ...change } : s)));

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('store.fulfilment.set', { version: view.version, settings }));
    if (next) onChange(next);
  }

  return (
    <Section id="fulfilment-section" title={t('fulfilment.title')}>
      <p className="hint">{t('fulfilment.hint')}</p>
      <form id="fulfilment" onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          {view.fulfilment.map((f) => {
            const mode = label('fulfilment.mode', f.mode);
            const current = settings.find((s) => s.mode === f.mode);
            return (
              <Group key={f.mode} id={`fulfilment-${f.mode}`} legend={mode} hint={t(`fulfilment.about.${f.mode}`)} error={action.fields[`fulfilment-${f.mode}`]}>
                <label className="choice">
                  <input type="checkbox" checked={current?.enabled ?? false} disabled={!f.available} onChange={(e) => set(f.mode, { enabled: e.target.checked })} />
                  <span>{t('fulfilment.offer', { mode })}</span>
                </label>
                {!f.available ? <p className="hint">{t('fulfilment.unavailable', { mode })}</p> : null}
                <Field id={`instructions-${f.mode}`} label={t('fulfilment.instructions', { mode })}>
                  {(control) => <textarea {...control} className="text-input" rows={2} value={current?.instructions ?? ''} onChange={(e) => set(f.mode, { instructions: e.target.value })} />}
                </Field>
                {f.mode === 'COURIER_DELIVERY' && current?.enabled ? (
                  <p>
                    <Link className="btn btn-link" to={sellerPath(sellerId, 'store/couriers')}>
                      {t('fulfilment.manage_couriers')}
                    </Link>
                  </p>
                ) : null}
              </Group>
            );
          })}
        </fieldset>
        <p className="hint">{t('fulfilment.coverage_note')}</p>
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('fulfilment.save')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}

/**
 * Fulfilment methods (CONSOLE-02 S100, FUL-01 S1): the three governing modes only. Private Courier Pools and the Cross-Seller
 * Courier Network are relationships, managed under Couriers, never extra modes. A mode the Market does not enable is shown with
 * that fact, not hidden. Nothing here sends, assigns or settles anything.
 */
export function StoreFulfilment() {
  return <StoreFrame title={t('fulfilment.page')}>{(p) => <Body {...p} />}</StoreFrame>;
}
