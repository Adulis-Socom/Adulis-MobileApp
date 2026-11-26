import { useState, type FormEvent } from 'react';
import type { VariantView } from '../../contracts/gap-sc-catalogue';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Form';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { codeText, formatInstant, label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { AvailabilityBadge } from './badges';
import { can, type SectionProps } from './editor';
import { Section } from './Section';

function History({ variantId, timezone }: { variantId: string; timezone: string | undefined }) {
  const { state, retry } = useSellerQuery('inventory.history.get', { variant_id: variantId });
  if (state.status === 'loading') return <Skeleton rows={3} />;
  if (state.status === 'error') {
    return (
      <StatePanel kind="danger" alert title={t('stock.history_error')} actions={<button type="button" className="btn btn-primary" onClick={retry}>{t('state.retry')}</button>}>
        <p>{t('state.transport_error_body')}</p>
      </StatePanel>
    );
  }
  if (state.data.events.length === 0) return <p className="empty">{t('stock.history_empty')}</p>;
  return (
    <ul className="ledger" aria-label={t('stock.history_label')}>
      {state.data.events.map((e) => (
        <li key={e.id} className="ledger-row">
          <span className="ledger-main">
            <span className="ledger-title">{e.delta === 0 ? t('stock.event_no_change') : e.delta > 0 ? t('stock.event_added', { count: e.delta }) : t('stock.event_removed', { count: -e.delta })}</span>
            <span className="ledger-meta">{label('stock_reason', e.reason_code)}</span>
          </span>
          <time className="ledger-meta" dateTime={e.occurred_at}>
            {formatInstant(e.occurred_at, timezone)}
          </time>
        </li>
      ))}
    </ul>
  );
}

function Confidence({ variant, timezone }: { variant: VariantView; timezone: string | undefined }) {
  const c = variant.confidence;
  return (
    <dl className="facts">
      <dt>{t('stock.confidence')}</dt>
      <dd>{label('confidence', c.state)}</dd>
      <dt>{t('stock.confidence_why')}</dt>
      <dd>{label('confidence.reason', c.reason_code)}</dd>
      <dt>{t('stock.confidence_effect')}</dt>
      <dd>{codeText('confidence.effect', c.effect_code) ?? c.effect_code}</dd>
      <dt>{t('stock.last_confirmed')}</dt>
      <dd>{c.last_confirmed_at === null ? t('stock.never_confirmed') : <time dateTime={c.last_confirmed_at}>{formatInstant(c.last_confirmed_at, timezone)}</time>}</dd>
    </dl>
  );
}

function StockCard({ detail, variant, onChange, onReload, timezone }: SectionProps & { variant: VariantView }) {
  const run = useSellerCommand();
  const action = useAction();
  const [open, setOpen] = useState<'set' | 'history' | null>(null);
  const [quantity, setQuantity] = useState(String(variant.quantity));
  const canSet = can(detail, 'ADJUST_STOCK');
  const canConfirm = can(detail, 'CONFIRM_STOCK');
  const titleId = `stock-${variant.id}`;

  function show(next: 'set' | 'history') {
    action.reset();
    setQuantity(String(variant.quantity));
    setOpen(next);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!/^\d+$/.test(quantity.trim())) {
      action.fail({ quantity: 'STOCK_INVALID' });
      return;
    }
    const next = await action.run(() => run('inventory.set', { variant_id: variant.id, stock_version: variant.stock_version, quantity: Number(quantity.trim()) }));
    if (next) {
      onChange(next);
      setOpen(null);
    }
  }
  async function confirm() {
    const next = await action.run(() => run('inventory.confirm', { variant_id: variant.id, stock_version: variant.stock_version }));
    if (next) onChange(next);
  }

  return (
    <li className="ledger-row" aria-labelledby={titleId}>
      <div className="stack">
        <div className="row">
          <h3 id={titleId} className="ledger-title">
            {variant.summary}
          </h3>
          <AvailabilityBadge availability={variant.availability} />
        </div>
        <p>{t('stock.quantity', { count: variant.quantity })}</p>
        <Confidence variant={variant} timezone={timezone} />
        {open === null ? <ActionProblem action={action} onReload={onReload} /> : null}
        <div className="actions">
          {canSet ? (
            <button type="button" className="btn btn-primary" onClick={() => show('set')}>
              {t('stock.update')}
            </button>
          ) : null}
          {canConfirm ? (
            <button type="button" className="btn btn-quiet" aria-disabled={action.busy} onClick={() => void confirm()}>
              {t('stock.confirm')}
            </button>
          ) : null}
          <button type="button" className="btn btn-quiet" onClick={() => show('history')}>
            {t('stock.history')}
          </button>
        </div>
      </div>
      <Dialog open={open === 'set'} onClose={() => setOpen(null)} title={t('stock.update_title', { variant: variant.summary })}>
        <form onSubmit={(e) => void save(e)} noValidate className="stack">
          <ActionProblem action={action} onReload={() => { onReload(); setOpen(null); }} />
          <Field id="quantity" label={t('stock.quantity_label')} hint={t('stock.quantity_hint')} error={action.fields['quantity']}>
            {(control) => <input {...control} className="text-input" type="text" inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />}
          </Field>
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {t('stock.save')}
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setOpen(null)}>
              {t('stock.cancel')}
            </button>
          </div>
        </form>
      </Dialog>
      <Dialog open={open === 'history'} onClose={() => setOpen(null)} title={t('stock.history_title', { variant: variant.summary })}>
        <History variantId={variant.id} timezone={timezone} />
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={() => setOpen(null)}>
            {t('stock.close')}
          </button>
        </div>
      </Dialog>
    </li>
  );
}

/**
 * Inventory (CON S52-S54, CATINV S57-S76): two distinct controls, Update stock and Confirm stock is accurate. Quantity comes
 * from the ledger the server keeps; confidence is shown and never chosen by the Seller.
 */
export function InventorySection(props: SectionProps) {
  const { detail } = props;
  return (
    <Section id="inventory" title={t('stock.title')}>
      {detail.variants.length === 0 ? (
        <p className="empty">{t('stock.no_variants')}</p>
      ) : (
        <ul className="ledger" aria-label={t('stock.list_label')}>
          {detail.variants.map((v) => (
            <StockCard key={v.id} {...props} variant={v} />
          ))}
        </ul>
      )}
    </Section>
  );
}
