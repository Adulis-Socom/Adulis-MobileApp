/**
 * features/catalogue/ProductNew.tsx -- SC-08 in create mode.
 *
 * POST /v1/seller/products. Minimal creation: a product exists to be edited,
 * so this takes name and base price (which seeds the first variant, C1) and
 * navigates into the editor, where variants, media and publication live.
 *
 * The base price is labelled as the SEED it is (C1) -- "the starting price for
 * this product's variants" -- never presented as the price of anything sold,
 * because nothing reads it after a variant is created.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import { stateFromProblem } from '../../lib/states';
import { useIdempotencyKey } from '../../lib/idempotency';
import { useMarketContext } from '../../lib/market';

export function ProductNew() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const market = useMarketContext();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<ApiError | null>(null);
  const key = useIdempotencyKey();

  const create = async () => {
    if (!sellerId) return;
    const priceMinor = Math.round(Number(price) * 100);
    if (!market || !name.trim() || !Number.isInteger(priceMinor) || priceMinor < 0) return;
    setBusy(true);
    setProblem(null);
    try {
      const created = await api<{ id: string }>(`/seller/products`, {
        method: 'POST',
        sellerId,
        idempotencyKey: key.current(),
        body: { name: name.trim(), base_price_minor: priceMinor, base_price_currency: market.currency },
      });
      key.remint();
      navigate(`../${created.id}`, { relative: 'path' });
    } catch (e) {
      if (e instanceof ApiError) setProblem(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="new-product-heading" className="product-new">
      <h1 id="new-product-heading">{en['console.catalogue.new.heading']}</h1>
      {problem ? <ScreenState state={stateFromProblem(problem.problem)} problem={problem.problem} /> : null}
      <label htmlFor="np-name">{en['console.catalogue.editor.name']}</label>
      <input id="np-name" value={name} onChange={(e) => setName(e.target.value)} />
      <label htmlFor="np-price">{en['console.catalogue.new.base_price']}</label>
      <input id="np-price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
      <p className="hint">{en['console.catalogue.new.base_price_hint']}</p>
      <button type="button" className="button primary" disabled={busy} onClick={() => void create()}>
        {en['console.catalogue.new.create']}
      </button>
    </section>
  );
}
