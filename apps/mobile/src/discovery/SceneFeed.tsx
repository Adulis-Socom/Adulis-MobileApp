// For You and Following share one list: Scene Posts only, in the server's order, one primary action per card (Explore the Scene).
// A Product Post (or anything the client does not know) is skipped by the backstop and never shown as a feed unit.
import { useRouter } from 'expo-router';

import type { SceneCardUnit } from '../contracts/gap-mob-discovery';
import { t } from '../i18n/messages';
import { PagedList, SceneCard } from './components';
import { usePaged } from './hooks';

export function SceneFeed({ op, empty }: { readonly op: 'feed.forYou.page' | 'feed.following.page'; readonly empty?: string }) {
  const router = useRouter();
  // Both feeds depend on who is asking, so both are rooted at the guest device or the Account.
  const query = usePaged(op, {}, { scope: 'subject' });
  return (
    <PagedList<SceneCardUnit>
      query={query}
      keyOf={(scene) => scene.sceneRef}
      accept={(scene) => scene.type === 'SCENE_POST'}
      empty={empty ?? t('mobile.state.empty')}
      renderItem={(scene) => <SceneCard scene={scene} onExplore={() => router.push(`/scenes/${scene.sceneRef}`)} />}
    />
  );
}
