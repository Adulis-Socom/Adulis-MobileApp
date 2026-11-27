import { useEffect, useState, type FormEvent } from 'react';
import type { ThreadView } from '../../contracts/gap-sc-inbox';
import { Field } from '../../components/Form';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { ActionProblem } from '../shared/ActionProblem';
import { useDirty } from '../shared/dirty';
import { useAction } from '../shared/useAction';

/**
 * The reply composer (CON S75, CHAT S5, S9). A human reply only: there is no "write it for me", no suggested text and no automatic sending.
 * Context is chosen Scene first, then a Product: with no Scene the Product list is the Seller's whole eligible catalogue, with a Scene it is only
 * what is tagged in that Scene, and "show all my Products" visibly clears the Scene before an unrelated Product can be used. The server refuses a
 * Product that is not tagged in the offered Scene revision, and a Scene that is no longer public. A reply is never shown as sent until the server
 * has confirmed it; a lost answer is shown as uncertain and "Send reply" again reuses the same request identity while it is held (CHAT S15, S19).
 * The draft lives in memory only. It is never written to browser storage.
 */
export function Composer({ thread, onSent }: { thread: ThreadView; onSent: (next: ThreadView) => void }) {
  const run = useSellerCommand();
  const action = useAction();
  const [sceneId, setSceneId] = useState('');
  const [productId, setProductId] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  const options = useSellerQuery('inbox.context.get', { scene_id: sceneId === '' ? null : sceneId });
  useDirty('reply', body.trim() !== '');

  const ready = options.state.status === 'ready' ? options.state.data : null;
  // A Product that the new Scene does not tag cannot stay selected: clear it rather than send a context the server would refuse.
  useEffect(() => {
    if (ready && productId !== '' && !ready.products.some((p) => p.id === productId)) setProductId('');
  }, [ready, productId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    setSent(false);
    // The Scene is sent with the revision this composer offered: the server checks the Product against THAT revision (CHAT S4).
    const revision = sceneId === '' ? null : (ready?.scenes.find((s) => s.id === sceneId)?.revision ?? null);
    const next = await action.run(() =>
      run('inbox.reply.send', { conversation_id: thread.id, body, scene_id: sceneId === '' ? null : sceneId, scene_revision: revision, product_id: productId === '' ? null : productId }),
    );
    if (next) {
      setBody('');
      setSceneId('');
      setProductId('');
      setSent(true);
      onSent(next);
    }
  }

  return (
    <form onSubmit={(e) => void send(e)} noValidate className="stack panel" aria-labelledby="composer-title">
      <h2 id="composer-title">{t('inbox.compose')}</h2>
      <ActionProblem action={action} />
      <Field id="scene" label={t('inbox.scene_label')} error={action.fields['scene']}>
        {(control) => (
          <select {...control} className="text-input" value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
            <option value="">{t('inbox.scene_none')}</option>
            {ready?.scenes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      {sceneId !== '' ? <p className="hint">{t('inbox.scene_chosen', { scene: ready?.scenes.find((s) => s.id === sceneId)?.label ?? '' })}</p> : null}
      <Field id="product" label={t('inbox.product_label')} hint={sceneId === '' ? t('inbox.product_hint_all') : t('inbox.product_hint_scene')} error={action.fields['product']}>
        {(control) => (
          <select {...control} className="text-input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">{t('inbox.product_none')}</option>
            {ready?.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </Field>
      {sceneId !== '' ? (
        <div className="actions">
          <button type="button" className="btn btn-quiet" onClick={() => setSceneId('')}>
            {t('inbox.browse_all')}
          </button>
        </div>
      ) : null}
      {options.state.status === 'error' ? <p className="field-error">{t('inbox.context_error')}</p> : null}
      <Field id="body" label={t('inbox.body_label')} hint={t('inbox.body_hint')} error={action.fields['body']}>
        {(control) => <textarea {...control} className="text-input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />}
      </Field>
      <p className="hint">{t('inbox.connected_note')}</p>
      {sent ? <p role="status">{t('inbox.sent')}</p> : null}
      <div className="actions">
        <button type="submit" className="btn btn-highlight" aria-disabled={action.busy}>
          {action.busy ? t('inbox.sending') : t('inbox.send')}
        </button>
      </div>
    </form>
  );
}
