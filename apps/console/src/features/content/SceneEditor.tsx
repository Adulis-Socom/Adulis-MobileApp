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
import { SceneImageSection, SceneCaptionSection } from './SceneMedia';
import { ScenePreview } from './ScenePreview';
import { ScenePublication } from './ScenePublication';
import { SceneTagsSection } from './SceneTags';
import { SceneBadges } from './sceneBadges';

function Editor({ sceneId }: { sceneId: string }) {
  const scene = useSellerQuery('scenes.get', { scene_id: sceneId });
  const market = useSellerQuery('market.context.get', {});
  const { sellerId } = useSeller();
  const [detail, setDetail] = useState<SceneDetail | null>(null);
  // Forms re-initialise only when the Seller asked for a reload (a stale version); a quiet refresh never wipes unsaved work.
  const [epoch, setEpoch] = useState(0);
  const reloading = useRef(false);
  const retry = scene.retry;

  useEffect(() => {
    if (scene.state.status !== 'ready' || scene.state.refreshing) return;
    setDetail(scene.state.data);
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
  const shared = { scene: detail, onChange: setDetail, onReload, onRefresh, timezone };
  const heading = detail.caption.trim() === '' ? t('scenes.new_title') : detail.caption;
  return (
    <>
      <PageTitle title={t('scenes.page_title')}>{heading}</PageTitle>
      <p>
        <Link className="btn btn-link" to={sellerPath(sellerId, 'content')}>
          <Icon name="arrow" />
          <span>{t('scenes.back')}</span>
        </Link>
      </p>
      <SceneBadges publication={detail.publication_state} visibility={detail.visibility} moderation={detail.moderation} />
      <SceneImageSection key={`image-${epoch}`} {...shared} />
      <SceneCaptionSection key={`caption-${epoch}`} {...shared} />
      <SceneTagsSection key={`tags-${epoch}`} {...shared} />
      <ScenePreview {...shared} />
      <ScenePublication key={`publication-${epoch}`} {...shared} />
    </>
  );
}

/** The Scene Post editor (CONSOLE-02 S61): image, caption, same-Seller Product tags, hotspots, preview, publish. */
export function SceneEditor() {
  const { postId } = useParams<'postId'>();
  return postId ? <Editor key={postId} sceneId={postId} /> : <NotFoundInSeller />;
}
