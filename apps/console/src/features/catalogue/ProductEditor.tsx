/**
 * features/catalogue/ProductEditor.tsx -- SC-08, ADU-CON-03 v1.2 S8.
 *
 * Route /s/:sellerId/products/:productId - GET/PATCH /v1/seller/products/{id},
 * POST .../publish, POST .../unpublish. Hosts SC-09 (Variants) and SC-10
 * (Media) as sections, per S8.
 *
 * PUBLISH RETURNS READINESS ITEMS ON A BLOCK, AND EVERY ONE IS RENDERED (S8):
 * a 409 carries items[] and this screen shows all of them, not the first --
 * as MESSAGES resolved from each item's message_key, never raw codes. After a
 * blocked publish the button disables until the next successful reload, which
 * is when a fix could have changed the answer; the block lists every missing
 * item. Where an item names TIER_LIMIT_REACHED or LEVEL_LIMIT_REACHED, the
 * message IS the server saying which limit binds -- the one place it does.
 *
 * The console computes nothing about publishability -- it renders what publish
 * returned. Attributes editing (the two-layer descriptive/variant-defining
 * distinction S8 draws) needs the attribute_definition catalogue the read
 * does not return; the descriptive fields are name and description here, and
 * the structured-attribute editor is registered as owed.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { en, type MessageKey } from '@adulis/locale';
import { ITEM_LABEL } from '../../lib/readiness';
import { api, ApiError } from '../../api/client';
import { ScreenState } from '../../components/ScreenState';
import { ProblemBanner } from '../../components/Feedback';
import type { AdulisProblem, UiState } from '../../lib/states';
import { stateFromProblem } from '../../lib/states';
import { useIdempotencyKey } from '../../lib/idempotency';
import { Variants } from './Variants';
import { Media } from './Media';
import type { ProductDetail } from './types';

/**
 * A blocker renders its MESSAGE, not its code (ADU-API-01 S7.2: an unknown
 * key renders a generic visible form, never a bare code on a seller's
 * screen). The catalogue lookup falls back to the key itself -- visible and
 * greppable -- exactly as components/Feedback.tsx renders titles.
 */
function blockerText(it: {
  code: string;
  message_key?: string;
  slots?: Record<string, unknown>;
}): string {
  // A PUBLICATION_BLOCKED item's message_key is the same generic sentence for
  // every readiness item; the fact that DISTINGUISHES the rows is slots.item,
  // and it is the vocabulary SC-01 already renders. Five identical lines
  // telling a seller five different things are missing is what the first real
  // 409 drew here -- so the readiness label renders when the item carries one.
  const itemCode = typeof it.slots?.['item'] === 'string' ? (it.slots['item'] as string) : null;
  if (itemCode && ITEM_LABEL[itemCode]) return ITEM_LABEL[itemCode];
  const key = it.message_key;
  if (key) {
    const catalogue = en as Record<string, string>;
    return catalogue[key as MessageKey] ?? key;
  }
  return it.code;
}

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
      setBlockers(null);
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
      // No Idempotency-Key: S8 requires one on state-changing POST and on
      // nothing else; PATCH is addressed by its resource.
      await api(`/seller/products/${productId}`, {
        method: 'PATCH',
        sellerId,
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
      // A 409 carries the readiness items[] -- render EVERY one. A failure
      // WITHOUT items (a 403, a 500) has nothing for the blocker list and
      // renders the banner instead: no publish failure is ever silent (B2).
      if (e instanceof ApiError) {
        if (e.problem.items && e.problem.items.length > 0) setBlockers(e.problem.items);
        else setProblem(e.problem);
      }
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

        {problem ? <ProblemBanner problem={problem} /> : null}

        <div className="editor-fields">
          <label htmlFor="product-name">{en['console.catalogue.editor.name']}</label>
          <input id="product-name" value={name} onChange={(e) => setName(e.target.value)} />
          <label htmlFor="product-description">{en['console.catalogue.editor.description']}</label>
          <textarea id="product-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button type="button" className="button" disabled={savingField} onClick={() => void saveFields()}>
            {en['console.catalogue.editor.save']}
          </button>
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
                  <li key={`${it.code}-${i}`}>{blockerText(it)}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {product.visibility === 'PUBLISHED' ? (
            <button type="button" className="button" onClick={() => void unpublish()}>
              {en['console.catalogue.editor.unpublish']}
            </button>
          ) : (
            <button
              type="button"
              className="button primary"
              disabled={Boolean(blockers && blockers.length > 0)}
              onClick={() => void publish()}
            >
              {en['console.catalogue.editor.publish']}
            </button>
          )}
        </section>
      </section>
    </ScreenState>
  );
}
