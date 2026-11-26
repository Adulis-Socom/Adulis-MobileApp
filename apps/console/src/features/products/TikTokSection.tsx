import { useState, type FormEvent } from 'react';
import { Badge } from '../../components/Badge';
import { Field } from '../../components/Form';
import { t } from '../../i18n/t';
import { useSellerCommand } from '../../seller/useSellerCommand';
import { ActionProblem } from '../shared/ActionProblem';
import { useAction } from '../shared/useAction';
import { can, type SectionProps } from './editor';
import { Section } from './Section';

/**
 * Optional TikTok embed (CATINV S27-S38, S101, S111; MEDIA-01). External, optional, Product-detail-only. Adulis does not host or upload
 * Seller video, and the video never appears in the Buyer For You feed. Attaching needs a connected, ownership-verified TikTok account;
 * the Console does NOT connect one, claim ownership, or activate any provider: the server answers, and the three canonical Media-domain
 * failures (TIKTOK_NOT_CONNECTED, TIKTOK_OWNERSHIP_NOT_VERIFIED, TIKTOK_EMBED_UNAVAILABLE) are shown beside the field in plain words.
 * A video reference is a link the server verifies, never embed markup typed here.
 */
export function TikTokSection({ detail, onChange, onReload }: SectionProps) {
  const run = useSellerCommand();
  const action = useAction(true);
  const [link, setLink] = useState('');
  const editable = can(detail, 'EDIT_TIKTOK');
  const { connection, embed } = detail.tiktok;

  async function attach(event: FormEvent) {
    event.preventDefault();
    const next = await action.run(() => run('products.tiktok.attach', { product_id: detail.id, version: detail.version, video_url: link }));
    if (next) {
      setLink('');
      onChange(next);
    }
  }
  async function detach() {
    const next = await action.run(() => run('products.tiktok.detach', { product_id: detail.id, version: detail.version }));
    if (next) onChange(next);
  }

  return (
    <Section id="tiktok-section" title={t('tiktok.title')}>
      <p className="hint">{t('tiktok.about')}</p>
      <p>
        <Badge tone={connection === 'CONNECTED' ? 'success' : 'neutral'} icon={connection === 'CONNECTED' ? 'check' : 'circle'}>
          {connection === 'CONNECTED' ? t('tiktok.connected') : t('tiktok.not_connected')}
        </Badge>
      </p>
      <ActionProblem action={action} onReload={onReload} />
      {embed ? (
        <div className="stack">
          <dl className="facts">
            <dt>{t('tiktok.attached')}</dt>
            <dd>{embed.video_url}</dd>
          </dl>
          {editable ? (
            <div className="actions">
              <button type="button" className="btn btn-quiet" aria-disabled={action.busy} onClick={() => void detach()}>
                {t('tiktok.remove')}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="empty">{t('tiktok.none')}</p>
      )}
      {editable && !embed ? (
        <form onSubmit={(e) => void attach(e)} noValidate className="stack">
          <Field id="tiktok" label={t('tiktok.link_label')} hint={t('tiktok.link_hint')} error={action.fields['tiktok']}>
            {(control) => <input {...control} className="text-input" type="url" autoComplete="off" value={link} onChange={(e) => setLink(e.target.value)} />}
          </Field>
          <div className="actions">
            <button type="submit" className="btn btn-primary" aria-disabled={action.busy}>
              {t('tiktok.attach')}
            </button>
          </div>
        </form>
      ) : null}
    </Section>
  );
}
