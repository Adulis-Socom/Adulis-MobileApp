import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { SceneDetail } from '../../contracts/gap-sc-content';
import { Icon } from '../../components/Icon';
import { PageTitle } from '../../components/PageTitle';
import { Skeleton } from '../../components/Skeleton';
import { StatePanel } from '../../components/StatePanel';
import { t } from '../../i18n/t';
import { sellerPath } from '../../seller/access';
import { useSeller } from '../../seller/context';
import { useSellerQuery } from '../../seller/useSellerQuery';
import { NotFoundInSeller } from '../unavailable/NotFound';
import { fresher, tick, type Held } from '../../seller/freshness';
import { DirtyProvider, UnsavedNote } from '../shared/dirty';
import { SceneImageSection, SceneCaptionSection } from './SceneMedia';
import { ScenePreview } from './ScenePreview';
import { ScenePublication } from './ScenePublication';
import { SceneTagsSection } from './SceneTags';
import { SceneBadges } from './sceneBadges';
import { SectionNav } from '../shared/SectionNav';

function Editor({ sceneId }: { sceneId: string }) {
  const scene = useSellerQuery('scenes.get', { scene_id: sceneId });
  const market = useSellerQuery('market.context.get', {});
  const { sellerId } = useSeller();
  const [held, setHeld] = useState<Held<SceneDetail> | null>(null);
  const detail = held?.value ?? null;
  // Forms re-initialise only when the Seller asked for a reload (a stale version); a quiet refresh never wipes unsaved work.
  const [epoch, setEpoch] = useState(0);
  const reloading = useRef(false);
  const retry = scene.retry;
  // The Seller's own selected image, kept only in browser memory: replaced or dropped means revoked, and closing the editor revokes it too.
  const [local, setLocal] = useState<{ name: string; url: string } | null>(null);
  const localUrl = useRef<string | null>(null);
  const onLocalImage = useCallback((file: File | null) => {
    if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    localUrl.current = file ? URL.createObjectURL(file) : null;
    setLocal(file && localUrl.current ? { name: file.name, url: localUrl.current } : null);
  }, []);
  useEffect(
    () => () => {
      if (localUrl.current) URL.revokeObjectURL(localUrl.current);
    },
    [],
  );

  useEffect(() => {
    if (scene.state.status !== 'ready' || scene.state.refreshing) return;
    const incoming = { value: scene.state.data, stamp: scene.state.issued };
    setHeld((prev) => fresher(prev, incoming));
    if (reloading.current) {
      reloading.current = false;
      setEpoch((n) => n + 1);
    }
  }, [scene.state]);

  const onReload = useCallback(() => {
    reloading.current = true;
    retry();
  }, [retry]);
  const onRefresh = useCallback(() => retry(), [retry]);

  if (scene.state.status === 'error') {
    // A Scene of another Seller and one that does not exist are the same answer: existence is never disclosed.
    const notFound = scene.state.error.code === 'NOT_FOUND' || scene.state.error.code === 'PERMISSION_DENIED';
    return notFound ? (
      <NotFoundInSeller />
    ) : (
      <StatePanel
        kind="danger"
        alert
        title={t('scenes.editor_error')}
        actions={
          <button type="button" className="btn btn-primary" onClick={retry}>
            {t('state.retry')}
          </button>
        }
      >
        <p>{t('state.transport_error_body')}</p>
      </StatePanel>
    );
  }
  if (!detail) return <Skeleton rows={6} />;

  const timezone = market.state.status === 'ready' ? market.state.data.timezone : undefined;
  const adopt = (next: SceneDetail) => {
    const acknowledged = { value: next, stamp: tick() };
    setHeld((prev) => fresher(prev, acknowledged));
  };
  const shared = { scene: detail, onChange: adopt, onReload, onRefresh, timezone, localImage: local, onLocalImage };
  const heading = detail.caption.trim() === '' ? t('scenes.new_title') : detail.caption;
  return (
    <DirtyProvider>
      <PageTitle title={t('scenes.page_title')}>{heading}</PageTitle>
      <UnsavedNote />
      <p>
        <Link className="btn btn-link" to={sellerPath(sellerId, 'content')}>
          <span className="flip" aria-hidden="true"><Icon name="arrow" /></span>
          <span>{t('scenes.back')}</span>
        </Link>
      </p>
      <SceneBadges publication={detail.publication_state} visibility={detail.visibility} moderation={detail.moderation} />
      <SectionNav
        links={[
          { id: 'image', label: t('onpage.scene_image') },
          { id: 'caption-section', label: t('onpage.scene_caption') },
          { id: 'tags', label: t('onpage.scene_tags') },
          { id: 'preview', label: t('onpage.scene_preview') },
          { id: 'publication', label: t('onpage.publication') },
        ]}
      />
      <SceneImageSection key={`image-${epoch}`} {...shared} />
      <SceneCaptionSection key={`caption-${epoch}`} {...shared} />
      <SceneTagsSection key={`tags-${epoch}`} {...shared} />
      <ScenePreview {...shared} />
      <ScenePublication key={`publication-${epoch}`} {...shared} />
    </DirtyProvider>
  );
}

/** The Scene Post editor (CONSOLE-02 S61): image, caption, same-Seller Product tags, hotspots, preview, publish. */
export function SceneEditor() {
  const { postId } = useParams<'postId'>();
  return postId ? <Editor key={postId} sceneId={postId} /> : <NotFoundInSeller />;
}
