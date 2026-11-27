// The Story viewer route: one fresh read per opening (never a cached photo), then StoryViewerBody decides what may be drawn
// (presentation gate, expiry boundary, time left). Closing returns to where the person came from; the Stories row puts focus back
// on the entry that opened it.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useRead } from '../../../discovery/hooks';
import { validRef } from '../../../discovery/params';
import { t } from '../../../i18n/messages';
import { StoryViewerBody } from '../../../stories/StoryViewerBody';
import { Screen, StateView } from '../../../ui/components';

export default function StoryViewer() {
  const router = useRouter();
  const { sellerRef } = useLocalSearchParams<{ sellerRef?: string }>();
  const ref = validRef(sellerRef);
  const read = useRead('stories.group.get', { sellerRef: ref ?? '' }, { enabled: ref !== null, fresh: true });
  // One VIEWING SESSION per time this screen is in front. A reopened destination that is already deeper in the stack is the
  // same route instance, and a retained instance is not proof that the Story is still public (ISS-041): the instant it is
  // left, nothing it holds may be drawn (openedAt = never), and when it comes back the instant is renewed and the server is
  // asked again; the body draws nothing from an answer received before that instant.
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const away = useRef(false);
  const refetch = useRef(read.refetch);
  refetch.current = read.refetch;
  useFocusEffect(
    useCallback(() => {
      if (away.current) {
        away.current = false;
        setOpenedAt(Date.now());
        void refetch.current();
      }
      return () => {
        away.current = true;
        setOpenedAt(Number.POSITIVE_INFINITY);
      };
    }, []),
  );
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
