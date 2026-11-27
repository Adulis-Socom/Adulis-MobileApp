// The Story viewer. Opening needs a FRESH successful read of the group (never a cached photo). A 404 anywhere (expired,
// withdrawn, restricted Seller, private target, unknown) clears photo, text and link at once and shows one neutral state with a
// way out. When the server-authored expiry arrives the viewer re-reads and shows what the server answers: it never ends or extends
// a Story itself. Next, Previous and Close are real controls; there is no auto-advance and no gesture is the only way to move.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { problemKind, useRead } from '../../../discovery/hooks';
import { validRef } from '../../../discovery/params';
import { t } from '../../../i18n/messages';
import { msUntilReread, step } from '../../../stories/viewer-state';
import { StoryCard } from '../../../stories/StoryCard';
import { Button, Screen, StateView } from '../../../ui/components';
import { theme } from '../../../ui/theme';

export default function StoryViewer() {
  const router = useRouter();
  const { sellerRef } = useLocalSearchParams<{ sellerRef?: string }>();
  const ref = validRef(sellerRef);
  const query = useRead('stories.group.get', { sellerRef: ref ?? '' }, { enabled: ref !== null, fresh: true });
  const [index, setIndex] = useState(0);
  const gone = ref === null || (query.status === 'error' && problemKind(query.error) === 'gone');
  const stories = query.status === 'success' ? query.data.stories : [];
  const current = stories[Math.min(index, Math.max(0, stories.length - 1))];

  // Ask again when the server-authored expiry of the story on screen arrives; show whatever the server then answers.
  const expiresAt = current?.expiresAt;
  const refetch = query.refetch;
  useEffect(() => {
    if (expiresAt === undefined) return undefined;
    const ms = msUntilReread(expiresAt, Date.now());
    if (ms === null) return undefined;
    const timer = setTimeout(() => void refetch(), ms);
    return () => clearTimeout(timer);
  }, [expiresAt, refetch]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/home'));
  if (gone || (query.status === 'success' && stories.length === 0)) {
    return <Screen><StateView kind="not-found" message={t('mobile.stories.gone')} action={{ label: t('mobile.stories.close'), onPress: close }} /></Screen>;
  }
  if (query.status === 'pending') return <Screen><StateView kind="loading" /></Screen>;
  if (query.status === 'error') return <Screen><StateView kind={problemKind(query.error) === 'offline' ? 'offline' : 'error'} onRetry={() => void query.refetch()} action={{ label: t('mobile.stories.close'), onPress: close }} /></Screen>;
  if (current === undefined) return <Screen><StateView kind="loading" /></Screen>;

  const position = Math.min(index, stories.length - 1);
  const openTarget = () => {
    if (current.target) router.push(current.target.kind === 'PRODUCT' ? `/product/${current.target.ref}` : `/scenes/${current.target.ref}`);
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text accessibilityRole="header" style={styles.position}>
          {t('mobile.stories.position', { n: position + 1, total: stories.length })}
        </Text>
        <StoryCard story={current} sellerName={query.data.seller.storeName} onOpenTarget={openTarget} />
        <View style={styles.controls}>
          <Button kind="secondary" label={t('mobile.stories.previous')} disabled={position === 0} onPress={() => setIndex(step(position, stories.length, 'previous'))} />
          <Button kind="secondary" label={t('mobile.stories.next')} disabled={position >= stories.length - 1} onPress={() => setIndex(step(position, stories.length, 'next'))} />
          <Button label={t('mobile.stories.close')} onPress={close} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl },
  position: { ...theme.text.heading, color: theme.color.text },
  controls: { gap: theme.space.sm },
});
