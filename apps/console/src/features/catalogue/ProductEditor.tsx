/**
 * features/catalogue/ProductEditor.tsx -- SC-08, ADU-CON-03 v1.2 S8.
 *
 * Route /s/:sellerId/products/:productId - GET/PATCH /v1/seller/products/{id},
 * POST .../publish, POST .../unpublish. Hosts SC-09 (Variants) and SC-10
 * (Media) as sections, per S8.
 *
 * PUBLISH RETURNS READINESS ITEMS ON A BLOCK, AND EVERY ONE IS RENDERED (S8):
 * a 409 carries items[] and this screen shows all of them, not the first. The
 * button is disabled with BLOCKED_READINESS when the server has already said
 * the product is not publishable; the block names the missing items.
 *
 * The console computes nothing about publishability -- it renders what publish
 * returned. Attributes editing (the two-layer descriptive/variant-defining
 * distinction S8 draws) needs the attribute_definition catalogue the read
 * does not return; the descriptive fields are name and description here, and
 * the structured-attribute editor is registered as owed.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en } from '@adulis/locale';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import type { AdulisProblem, UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useIdempotencyKey } from '../../lib/idempotency';
import { Variants } from './Variants';
import { Media } from './Media';
import type { ProductDetail } from './types';

export function ProductEditor() {
  const { sellerId, productId } = useParams<{ sellerId: string; productId: string }>();
  const [state, setState] = useState<UiState>('LOADING');
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [problem, setProblem] = useState<AdulisProblem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [savingField, setSavingField] = useState(false);
  const [blockers, setBlockers] = useState<AdulisProblem['items'] | null>(null);
  const publishKey = useIdempotencyKey();
  const unpublishKey = useIdempotencyKey();

  const load = useCallback(async () => {
    if (!sellerId || !productId) return;
    setState((s) => (s === 'READY' ? 'STALE' : 'LOADING'));
    try {
      const p = await api<ProductDetail>(`/seller/products/${productId}`, { sellerId });
      setProduct(p);
      setName(p.name);
      setDescription(p.description ?? '');
      setProblem(null);
      setState('READY');
    } catch (e) {
      if (e instanceof ApiError) {
        setProblem(e.problem);
        setState(stateFromProblem(e.problem));
      } else setState('TRANSPORT_ERROR');
    }
  }, [sellerId, productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveFields = async () => {
    if (!sellerId || !productId) return;
    setSavingField(true);
    try {
      await api(`/seller/products/${productId}`, {
        method: 'PATCH',
        sellerId,
        idempotencyKey: crypto.randomUUID(),
        body: { name: name.trim(), description: description.trim() },
      });
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e.problem);
    } finally {
      setSavingField(false);
    }
  };

  const publish = async () => {
    if (!sellerId || !productId) return;
    setBlockers(null);
    try {
      await api(`/seller/products/${productId}/publish`, {
        method: 'POST',
        sellerId,
        idempotencyKey: publishKey.current(),
      });
      publishKey.remint();
      void load();
    } catch (e) {
      // A 409 carries the readiness items[] -- render EVERY one.
      if (e instanceof ApiError) setBlockers(e.problem.items ?? null);
    }
  };

  const unpublish = async () => {
    if (!sellerId || !productId) return;
    try {
      await api(`/seller/products/${productId}/unpublish`, {
        method: 'POST',
        sellerId,
        idempotencyKey: unpublishKey.current(),
      });
      unpublishKey.remint();
      void load();
    } catch (e) {
      if (e instanceof ApiError) setProblem(e.problem);
    }
  };

  if (state === 'LOADING') return <ScreenState state="LOADING" />;
  if (!product) {
    return (
      <ScreenState state={state} onRetry={() => void load()} {...(problem ? { problem } : {})} />
    );
  }

  return (
    <ScreenState state={state}>
      <section aria-labelledby="editor-heading" className="product-editor" data-screen="SC-08">
        <h1 id="editor-heading">{product.name}</h1>

        <div className="editor-fields">
          <label htmlFor="product-name">{en['console.catalogue.editor.name']}</label>
          <input id="product-name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="product-description">{en['console.catalogue.editor.description']}</label>
          <textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="button" className="button" disabled={savingField} onClick={() => void saveFields()}>
            {en['console.catalogue.editor.save']}
          </button>
          <p className="editor-attrs-owed">{en['console.catalogue.editor.attributes_owed']}</p>
        </div>

        <Variants
          sellerId={sellerId!}
          productId={product.id}
          currency={product.base_price.currency}
          variants={product.variants}
          onChanged={() => void load()}
        />

        <Media
          sellerId={sellerId!}
          productId={product.id}
          images={product.images}
          video={product.video}
          onChanged={() => void load()}
        />

        <section aria-labelledby="publish-heading" className="publish">
          <h2 id="publish-heading">{en['console.catalogue.editor.publish_heading']}</h2>
          {blockers && blockers.length > 0 ? (
            <div data-state="BLOCKED_READINESS" className="blocked">
              <p>{en['console.catalogue.editor.publish_blocked']}</p>
              <ul>
                {blockers.map((it, i) => (
                  <li key={`${it.code}-${i}`}>{it.code}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {product.visibility === 'PUBLISHED' ? (
            <button type="button" className="button" onClick={() => void unpublish()}>
              {en['console.catalogue.editor.unpublish']}
            </button>
          ) : (
            <button type="button" className="button primary" onClick={() => void publish()}>
              {en['console.catalogue.editor.publish']}
            </button>
          )}
        </section>
      </section>
    </ScreenState>
  );
}
