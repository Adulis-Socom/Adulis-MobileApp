import { useEffect, useState, type ChangeEvent } from 'react';
import type { MediaItem, MediaState } from '../../contracts/gap-sc-catalogue';
import { Badge, type Tone } from '../../components/Badge';
import { Field } from '../../components/Form';
import type { IconName } from '../../components/Icon';
import { label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useObjectUrls } from '../shared/objectUrls';
import { useAction } from '../shared/useAction';
import { can, type SectionProps } from './editor';
import { Section } from './Section';

const LOOK: Record<MediaState, { tone: Tone; icon: IconName }> = {
  PROCESSING: { tone: 'info', icon: 'clock' },
  READY: { tone: 'success', icon: 'check' },
  REJECTED: { tone: 'danger', icon: 'alert' },
};

/** How often the Console asks again while an image is processing. A UI refresh interval, not a business rule. */
const POLL_MS = 1000;

function Thumb({ item, local }: { item: MediaItem; local: string | undefined }) {
  const src = local ?? item.preview_url;
  return (
    <div className="media-thumb">
      {src ? <img src={src} alt={t('media.image_alt', { name: item.file_name })} draggable={false} /> : <span className="media-thumb-empty">{label('media.state', item.state)}</span>}
    </div>
  );
}

/**
 * Product images (CON S55-S57). Image processing is asynchronous: the Console shows processing, ready and rejected states and asks
 * again while any image is processing. The Seller sees THEIR OWN picture back: the server's derivative when it has one, otherwise the
 * file they selected, held in browser memory only and revoked when the image is removed or the editor closes. Nothing is uploaded in
 * fixture mode (only the name and type are sent). The first image is the primary image; the order is changed with Move earlier and later.
 * A failed upload keeps the file so the same request can be sent again (its idempotency key is kept: it cannot apply twice).
 */
export function MediaSection({ detail, onChange, onReload, onRefresh }: SectionProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const urls = useObjectUrls();
  const [failed, setFailed] = useState<File | null>(null);
  const editable = can(detail, 'ADD_MEDIA');
  const processing = detail.media.some((m) => m.state === 'PROCESSING');

  useEffect(() => {
    if (!processing) return undefined;
    const id = window.setTimeout(onRefresh, POLL_MS);
    return () => window.clearTimeout(id);
  }, [processing, detail, onRefresh]);

  async function upload(file: File) {
    const known = new Set(detail.media.map((m) => m.id));
    const next = await action.run(() => run('products.media.add', { product_id: detail.id, version: detail.version, file_name: file.name, content_type: file.type === '' ? 'application/octet-stream' : file.type }));
    if (!next) {
      setFailed(file);
      return;
    }
    setFailed(null);
    const added = next.media.find((m) => !known.has(m.id));
    if (added) urls.set(added.id, file);
    onChange(next);
  }
  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void upload(file);
  }
  async function remove(mediaId: string) {
    const next = await action.run(() => run('products.media.remove', { product_id: detail.id, version: detail.version, media_id: mediaId }));
    if (next) {
      urls.drop(mediaId);
      onChange(next);
    }
  }
  async function move(index: number, by: -1 | 1) {
    const order = detail.media.map((m) => m.id);
    const other = index + by;
    const a = order[index];
    const b = order[other];
    if (a === undefined || b === undefined) return;
    order[index] = b;
    order[other] = a;
    const next = await action.run(() => run('products.media.reorder', { product_id: detail.id, version: detail.version, order }));
    if (next) onChange(next);
  }

  return (
    <Section id="media" title={t('media.title')}>
      <ActionProblem action={action} onReload={onReload} />
      {failed ? (
        <div className="notice" role="group" aria-label={t('media.failed_label')}>
          <span>{t('media.failed', { name: failed.name })}</span>
          <button type="button" className="btn btn-quiet" aria-disabled={action.busy} onClick={() => void upload(failed)}>
            {t('media.retry', { name: failed.name })}
          </button>
        </div>
      ) : null}
      {detail.media.length === 0 ? (
        <p className="empty">{t('media.empty')}</p>
      ) : (
        <ul className="ledger" aria-label={t('media.list_label')}>
          {detail.media.map((m, i) => (
            <li key={m.id} className="ledger-row">
              <div className="media-row">
                <Thumb item={m} local={urls.get(m.id)} />
                <div className="stack">
                  <div className="row-start">
                    <span className="ledger-title">{m.file_name}</span>
                    {i === 0 ? <span className="ledger-meta">{t('media.primary')}</span> : null}
                  </div>
                  <Badge tone={LOOK[m.state].tone} icon={LOOK[m.state].icon}>
                    {label('media.state', m.state)}
                  </Badge>
                  {m.state === 'REJECTED' ? <p className="hint">{t('media.rejected_hint')}</p> : null}
                  {editable ? (
                    <div className="actions">
                      <button type="button" className="btn btn-quiet" aria-disabled={i === 0 || action.busy} onClick={() => void move(i, -1)}>
                        {t('media.move_earlier', { name: m.file_name })}
                      </button>
                      <button type="button" className="btn btn-quiet" aria-disabled={i === detail.media.length - 1 || action.busy} onClick={() => void move(i, 1)}>
                        {t('media.move_later', { name: m.file_name })}
                      </button>
                      <button type="button" className="btn btn-quiet" aria-disabled={action.busy} onClick={() => void remove(m.id)}>
                        {t('media.remove', { name: m.file_name })}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {processing ? (
        <p role="status" className="hint">
          {t('media.processing_note')}
        </p>
      ) : null}
      {editable ? (
        <Field id="media-file" label={t('media.add_label')} hint={t('media.add_hint')} error={action.fields['media']}>
          {(control) => <input {...control} className="text-input" type="file" accept="image/*" onChange={pick} />}
        </Field>
      ) : null}
    </Section>
  );
}
