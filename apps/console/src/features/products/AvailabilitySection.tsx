import { useState, type FormEvent } from 'react';
import type { StockVisibility } from '../../contracts/gap-sc-catalogue';
import { Group } from '../../components/Form';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { can, type SectionProps } from './editor';
import { Section } from './Section';

const MODES: readonly StockVisibility[] = ['STATUS_ONLY', 'EXACT'];

/**
 * What Buyers see of stock (CATINV S64-S66): a Seller-controlled toggle between the exact quantity and a status label.
 * It changes only the Buyer-facing projection; it never changes the stock itself, and the Console applies no threshold.
 */
export function AvailabilitySection({ detail, onChange, onReload }: SectionProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const editable = can(detail, 'EDIT');
  const [mode, setMode] = useState<StockVisibility>(detail.stock_visibility_mode);

  async function save(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('products.update', { product_id: detail.id, version: detail.version, stock_visibility_mode: mode }));
    if (next) onChange(next);
  }

  return (
    <Section id="availability" title={t('visibility.title')}>
      <form onSubmit={(e) => void save(e)} noValidate className="stack">
        <ActionProblem action={action} onReload={onReload} />
        <fieldset className="plain-fieldset" disabled={!editable}>
          <Group id="stock-visibility" legend={t('visibility.legend')} hint={t('visibility.hint')}>
            {MODES.map((m) => (
              <label key={m} className="choice">
                <input type="radio" name="stock_visibility_mode" checked={mode === m} onChange={() => setMode(m)} />
                <span>
                  <strong>{t(m === 'EXACT' ? 'visibility.exact' : 'visibility.status_only')}</strong>
                  <span className="hint block">{t(m === 'EXACT' ? 'visibility.exact_hint' : 'visibility.status_only_hint')}</span>
                </span>
              </label>
            ))}
          </Group>
        </fieldset>
        {editable ? (
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {action.busy ? t('editor.saving') : t('visibility.save')}
            </button>
          </div>
        ) : null}
      </form>
    </Section>
  );
}
