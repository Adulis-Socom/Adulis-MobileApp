// The Story viewer route: one fresh read per opening (never a cached photo), then StoryViewerBody decides what may be drawn
// (presentation gate, expiry boundary, time left). Closing returns to where the person came from; the Stories row puts focus back
// on the entry that opened it.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';

import { useRead } from '../../../discovery/hooks';
import { validRef } from '../../../discovery/params';
import { t } from '../../../i18n/messages';
import { StoryViewerBody } from '../../../stories/StoryViewerBody';
import { Screen, StateView } from '../../../ui/components';

export default function StoryViewer() {
  const router = useRouter();
  const { sellerRef } = useLocalSearchParams<{ sellerRef?: string }>();
  const ref = validRef(sellerRef);
  const openedAt = useRef(Date.now()).current;
  const read = useRead('stories.group.get', { sellerRef: ref ?? '' }, { enabled: ref !== null, fresh: true });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));

  if (ref === null) return <Screen><StateView kind="not-found" message={t('mobile.stories.gone')} action={{ label: t('mobile.stories.close'), onPress: close }} /></Screen>;
  return (
    <Screen>
      <StoryViewerBody
        read={read}
        openedAt={openedAt}
        onClose={close}
        onOpenTarget={(target) => router.push(target.kind === 'PRODUCT' ? `/product/${target.ref}` : `/scenes/${target.ref}`)}
      />
    </Screen>
  );
}
