/**
 * features/catalogue/StockScreen.tsx -- SC-11's own route,
 * /s/:sellerId/products/:productId/stock (ADU-CON-03 v1.2 S8: "Route
 * /s/:id/products/:productId/stock and inline on SC-09").
 *
 * The C-5 pass found the router claiming this route existed while a deep link
 * fell through the `*` catch-all and silently landed on Home -- the exact
 * D-146 class the router's own comments warn about (M4). It exists now: the
 * product's variants, each with the SC-11 stock section open.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { Stock } from './Stock';
import type { ProductDetail } from './types';

export function StockScreen() {
  const { sellerId, productId } = useParams<{ sellerId: string; productId: string }>();
  const [state, setState] = useState<UiState>('LOADING');
  const [product, setProduct] = useState<ProductDetail | null>(null);

  const load = useCallback(async () => {
    if (!sellerId || !productId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const p = await api<ProductDetail>(`/seller/products/${productId}`, { sellerId });
      setProduct(p);
      setState('READY');
    } catch (e) {
      setState(e instanceof ApiError ? stateFromProblem(e.problem) : 'TRANSPORT_ERROR');
    }
  }, [sellerId, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state === 'NO_PERMISSION') return null;
  if (!product) return <ScreenState state={state} onRetry={() => void load()} />;

  return (
    <ScreenState state={state}>
      <section aria-labelledby="stock-screen-heading" data-screen="SC-11">
        <h1 id="stock-screen-heading">
          {en['console.catalogue.stock.screen_heading']} {product.name}
        </h1>
        <Link to=".." relative="path">
          {en['console.catalogue.stock.back_to_product']}
        </Link>
        {product.variants.length === 0 ? (
          <p className="empty" data-state="EMPTY">
            {en['console.catalogue.variants.empty']}
          </p>
        ) : (
          product.variants.map((v) => (
            <section key={v.id} aria-label={v.variant_key} className="variant-stock-block">
              <h2>{v.variant_key}</h2>
              <Stock
                sellerId={sellerId as string}
                variantId={v.id}
                stockCount={v.stock_count}
                stockConfirmedAt={v.stock_confirmed_at}
                onChanged={() => void load()}
              />
            </section>
          ))
        )}
      </section>
    </ScreenState>
  );
}
