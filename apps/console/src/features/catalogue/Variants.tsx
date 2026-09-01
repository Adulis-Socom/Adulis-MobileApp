/**
 * features/catalogue/Variants.tsx -- SC-09, a section of SC-08.
 *
 * POST /v1/seller/products/{id}/variants - PATCH/DELETE /v1/seller/variants/{id}.
 *
 * VARIANT STATUS COMES FROM THE SERVER (S8). A withdrawn variant is `status:
 * WITHDRAWN`, which the buyer's cart surfaces as VARIANT_WITHDRAWN; this
 * screen renders the status it was given and never derives "out of stock"
 * from a count -- stock is a separate fact (SC-11) and a zero count is not a
 * withdrawal.
 *
 * PRICE LIVES ON THE VARIANT (S8, C1). The product's base price is a seed
 * copied at creation and read by nothing afterwards, so this section never
 * presents the product price as though editing it changes a variant.
 *
 * WHAT THE READ DOES NOT SUPPLY: getProduct returns each variant's
 * `variant_key` -- the canonical serialisation the trigger writes -- not its
 * defining attributes as labelled values. So a variant is shown by its key
 * rather than "Size: L, Colour: red". The human labels need the
 * variant_attribute_value rows the read does not join. Registered rather than
 * reconstructed, because splitting a key back into attributes on the client
 * is guessing at a format the server owns.
 */
import { useState } from 'react';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ProblemBanner } from '../../components/Feedback';
import { useIdempotencyKey } from '../../lib/idempotency';
import { useMarketContext } from '../../lib/market';
import { formatMinor, fillTemplate } from '../../lib/intl';
import { Stock } from './Stock';
import type { Variant } from './types';

interface Props {
  readonly sellerId: string;
  readonly productId: string;
  readonly currency: string;
  readonly variants: readonly Variant[];
  readonly onChanged: () => void;
}

export function Variants({ sellerId, productId, currency, variants, onChanged }: Props) {
  const market = useMarketContext();
  const [problem, setProblem] = useState<ApiError | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const addKey = useIdempotencyKey();
  const [newKey, setNewKey] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});

  const add = async () => {
    setFieldError(null);
    if (!newKey.trim()) {
      setFieldError(en['console.catalogue.variants.key_required']);
      return;
    }
    if (newPrice.trim() === '' || Number.isNaN(Number(newPrice))) {
      // Number('') is 0, and a silent 0.00 variant is the pass's B4. Refuse.
      setFieldError(en['console.catalogue.variants.price_required']);
      return;
    }
    const priceMinor = Math.round(Number(newPrice) * 100);
    if (!Number.isInteger(priceMinor) || priceMinor < 0) {
      setFieldError(en['console.catalogue.variants.price_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/products/${productId}/variants`, {
        method: 'POST',
        sellerId,
        idempotencyKey: addKey.current(),
        body: { variant_key: newKey.trim(), price_minor: priceMinor, price_currency: currency },
      });
      addKey.remint();
      setNewKey('');
      setNewPrice('');
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const savePrice = async (variantId: string) => {
    setFieldError(null);
    const raw = editingPrice[variantId] ?? '';
    if (raw.trim() === '' || Number.isNaN(Number(raw))) {
      setFieldError(en['console.catalogue.variants.price_required']);
      return;
    }
    const priceMinor = Math.round(Number(raw) * 100);
    if (!Number.isInteger(priceMinor) || priceMinor < 0) {
      setFieldError(en['console.catalogue.variants.price_required']);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await api(`/seller/variants/${variantId}`, {
        method: 'PATCH',
        sellerId,
        body: { price_minor: priceMinor },
      });
      setEditingPrice((m) => ({ ...m, [variantId]: '' }));
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async (variantId: string) => {
    setBusy(true);
    setProblem(null);
    try {
      // DELETE withdraws; the server refuses if orders are live.
      await api(`/seller/variants/${variantId}`, { method: 'DELETE', sellerId });
      onChanged();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="variants-heading" className="variants">
      <h2 id="variants-heading">{en['console.catalogue.variants.heading']}</h2>
      {problem ? <ProblemBanner problem={problem.problem} /> : null}
      {fieldError ? (
        <p className="field-error" role="alert">
          {fieldError}
        </p>
      ) : null}
      <p className="hint">{en['console.catalogue.variants.labels_owed']}</p>

      {variants.length === 0 ? (
        <p className="empty" data-state="EMPTY">
          {en['console.catalogue.variants.empty']}
        </p>
      ) : (
        <ul className="variant-list">
          {variants.map((v) => (
            <li key={v.id} className="variant-row">
              <div className="variant-summary">
                <span className="variant-key">{v.variant_key}</span>
                <span className="variant-price">{market ? formatMinor(market, Number(v.price_minor)) : ''}</span>
                <span className={`badge badge-${v.status.toLowerCase()}`}>
                  {v.status === 'ACTIVE'
                    ? en['console.catalogue.variants.active']
                    : en['console.catalogue.variants.withdrawn']}
                </span>
                <span className="variant-stock">
                  {fillTemplate(en['console.catalogue.variants.in_stock'], { n: String(v.stock_count) })}
                </span>
                <button
                  type="button"
                  className="button"
                  aria-expanded={expanded === v.id}
                  onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                >
                  {en['console.catalogue.variants.manage_stock']}
                </button>
                {v.status === 'ACTIVE' ? (
                  <button type="button" className="button" disabled={busy} onClick={() => void withdraw(v.id)}>
                    {en['console.catalogue.variants.withdraw']}
                  </button>
                ) : null}
                <label htmlFor={`price-${v.id}`} className="visually-hidden">
                  {en['console.catalogue.variants.edit_price']}
                </label>
                <input
                  id={`price-${v.id}`}
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder={en['console.catalogue.variants.edit_price']}
                  value={editingPrice[v.id] ?? ''}
                  onChange={(e) => setEditingPrice((m) => ({ ...m, [v.id]: e.target.value }))}
                />
                <button type="button" className="button" disabled={busy} onClick={() => void savePrice(v.id)}>
                  {en['console.catalogue.variants.save_price']}
                </button>
              </div>
              {expanded === v.id ? (
                <Stock
                  sellerId={sellerId}
                  variantId={v.id}
                  stockCount={v.stock_count}
                  stockConfirmedAt={v.stock_confirmed_at}
                  onChanged={onChanged}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="variant-add">
        <label htmlFor="new-variant-key">{en['console.catalogue.variants.new_key']}</label>
        <input id="new-variant-key" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
        <label htmlFor="new-variant-price">{en['console.catalogue.variants.new_price']}</label>
        <input id="new-variant-price" type="number" min={0} step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
        <button type="button" className="button primary" disabled={busy} onClick={() => void add()}>
          {en['console.catalogue.variants.add']}
        </button>
      </div>
    </section>
  );
}
