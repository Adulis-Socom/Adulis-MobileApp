import { useEffect, useRef, type ChangeEvent } from 'react';
import type { MediaState } from '../../contracts/gap-sc-catalogue';
import { Badge, type Tone } from '../../components/Badge';
import type { IconName } from '../../components/Icon';
import { Field } from '../../components/Form';
import { label, t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
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

/**
 * Product images (CON S55-S57). Image processing is asynchronous: the Console shows processing, ready and rejected states
 * and asks again while any image is processing. In fixture mode no bytes leave the browser (only the name and type are sent).
 */
export function MediaSection({ detail, onChange, onReload, onRefresh }: SectionProps) {
  const run = useSellerCommand();
  const action = useAction();
  const input = useRef<HTMLInputElement>(null);
  const editable = can(detail, 'ADD_MEDIA');
  const processing = detail.media.some((m) => m.state === 'PROCESSING');

  useEffect(() => {
    if (!processing) return undefined;
    const id = window.setTimeout(onRefresh, POLL_MS);
    return () => window.clearTimeout(id);
  }, [processing, detail, onRefresh]);

  async function add(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const next = await action.run(() => run('products.media.add', { product_id: detail.id, version: detail.version, file_name: file.name, content_type: file.type === '' ? 'application/octet-stream' : file.type }));
    if (next) onChange(next);
  }
  async function remove(mediaId: string) {
    const next = await action.run(() => run('products.media.remove', { product_id: detail.id, version: detail.version, media_id: mediaId }));
    if (next) onChange(next);
  }

  return (
    <Section id="media" title={t('media.title')}>
      <ActionProblem action={action} onReload={onReload} />
      {detail.media.length === 0 ? (
        <p className="empty">{t('media.empty')}</p>
      ) : (
        <ul className="ledger" aria-label={t('media.list_label')}>
          {detail.media.map((m) => (
            <li key={m.id} className="ledger-row">
              <span className="ledger-main">
                <span className="ledger-title">{m.file_name}</span>
                <Badge tone={LOOK[m.state].tone} icon={LOOK[m.state].icon}>
                  {label('media.state', m.state)}
                </Badge>
                {m.state === 'REJECTED' ? <span className="ledger-meta">{t('media.rejected_hint')}</span> : null}
              </span>
              {editable ? (
                <button type="button" className="btn btn-quiet" aria-disabled={action.busy} onClick={() => void remove(m.id)}>
                  {t('media.remove', { name: m.file_name })}
                </button>
              ) : null}
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
          {(control) => <input {...control} ref={input} className="text-input" type="file" accept="image/*" onChange={(e) => void add(e)} />}
        </Field>
      ) : null}
    </Section>
  );
}
