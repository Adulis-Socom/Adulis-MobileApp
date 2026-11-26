import { t } from '../../i18n/t';
import { AvailabilityBadge } from '../products/badges';
import { Section } from '../products/Section';
import { PrivateReason } from './sceneBadges';
import { imageSrc, type SceneSectionProps } from './sceneEditor';
import { Stage, type Marker } from './Stage';

/**
 * Management preview (CON S66): the Scene as currently composed, with publication and visibility shown separately. It
 * establishes no public eligibility and has no Buyer link, and it shows no deferred module (Similar Finds, Complete the Scene).
 * The tagged Products are an accessible list, because the visual overlay cannot be the only way to reach them (SCN S24).
 */
export function ScenePreview({ scene, localImage }: SceneSectionProps) {
  const src = imageSrc(scene, localImage);
  const markers: Marker[] = scene.tags
    .flatMap((tag) => tag.hotspots.map((h) => ({ id: h.id, title: tag.title, x_norm: h.x_norm, y_norm: h.y_norm, current: false, n: 0 })))
    .map((m, i) => ({ ...m, n: i + 1 }));
  return (
    <Section id="preview" title={t('scenes.preview_title')}>
      <p className="hint">{t('scenes.preview_note')}</p>
      {scene.publication_state === 'PUBLISHED' && scene.visibility === 'PRIVATE' ? <PrivateReason reason={scene.private_reason} /> : null}
      {scene.image ? <Stage aspect={scene.image.aspect} imageName={scene.image.file_name} imageUrl={src.url} measure={src.measure} markers={markers} /> : <p className="empty">{t('scenes.image_empty')}</p>}
      <p>{scene.caption.trim() === '' ? t('scenes.no_caption') : scene.caption}</p>
      <h3>{t('scenes.preview_products')}</h3>
      {scene.tags.length === 0 ? (
        <p className="empty">{t('scenes.tags_empty')}</p>
      ) : (
        <ul className="ledger" aria-label={t('scenes.preview_products')}>
          {scene.tags.map((tag) => (
            <li key={tag.product_id} className="ledger-row">
              <span className="ledger-main">
                <span className="ledger-title">{tag.title}</span>
                <AvailabilityBadge availability={tag.availability} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
