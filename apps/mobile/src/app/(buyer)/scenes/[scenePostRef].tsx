// Scene Explorer: the one place hotspots live. Public visibility is a server fact: a 404 on open OR on return clears the
// photo, caption and tags and shows one neutral state, and every feed is refetched so the server decides what remains.
// Hotspot and list stay in sync (selecting a row ringed its hotspot); a hotspot reads "<name>. Open product." and only navigates.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { SceneTag } from '../../../contracts/gap-mob-discovery';
import { Section, MediaImage, SceneCard, TagLine } from '../../../discovery/components';
import { formatPriceRange } from '../../../discovery/format';
import { hotspotPosition, type Box } from '../../../discovery/hotspot';
import { problemKind, useRead } from '../../../discovery/hooks';
import { validRef } from '../../../discovery/params';
import { t } from '../../../i18n/messages';
import { Body, Button, Heading, Screen, StateView } from '../../../ui/components';
import { theme } from '../../../ui/theme';

const FEED_OPS = ['feed.forYou.page', 'feed.following.page', 'search.query', 'seller.scenes.page'];

export default function SceneExplorer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scenePostRef } = useLocalSearchParams<{ scenePostRef?: string }>();
  const ref = validRef(scenePostRef);
  const query = useRead('scene.get', { sceneRef: ref ?? '' }, { enabled: ref !== null });
  const [box, setBox] = useState<Box>({ width: 0, height: 0 });
  const [selected, setSelected] = useState<number | null>(null);
  const gone = ref === null || (query.status === 'error' && problemKind(query.error) === 'gone');

  // Revalidate on return: a Scene withdrawn while the person was in a Product page disappears here, not later.
  useFocusEffect(
    useCallback(() => {
      if (query.data !== undefined) void query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch identity is stable per query; only the presence of data matters
    }, [query.data !== undefined]),
  );
  // The server decided it is gone: refetch every list that might still hold it (no client memory of the hide).
  useEffect(() => {
    if (gone) void queryClient.invalidateQueries({ predicate: (q) => q.queryKey.some((part) => typeof part === 'string' && FEED_OPS.includes(part)) });
  }, [gone, queryClient]);

  if (gone) return <Screen><StateView kind="not-found" message={t('mobile.scene.gone')} action={{ label: t('mobile.state.go_home'), onPress: () => router.replace('/home') }} /></Screen>;
  if (query.status === 'pending') return <Screen><StateView kind="loading" /></Screen>;
  if (query.status === 'error') return <Screen><StateView kind={problemKind(query.error) === 'offline' ? 'offline' : 'error'} onRetry={() => void query.refetch()} /></Screen>;

  const scene = query.data.scene;
  const imageHeight = box.width > 0 ? box.width / scene.image.aspect : 240;
  const onLayout = (event: LayoutChangeEvent) => setBox({ width: event.nativeEvent.layout.width, height: 0 });
  const openProduct = (tag: SceneTag) => router.push(`/product/${tag.productRef}`);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View onLayout={onLayout} testID="scene-photo">
          <MediaImage media={scene.image} height={imageHeight} label />
          {box.width > 0
            ? scene.tags.map((tag) => {
                if (tag.hotspot === null) return null; // a Scene with no hotspot data still works as a list
                const at = hotspotPosition(tag.hotspot, { width: box.width, height: imageHeight }, scene.image.aspect);
                return (
                  <Pressable
                    key={tag.position}
                    accessibilityRole="button"
                    accessibilityLabel={t('mobile.scene.hotspot_label', { name: tag.name })}
                    onPress={() => openProduct(tag)}
                    style={[styles.hotspot, { left: at.left - theme.touch / 2, top: at.top - theme.touch / 2 }, selected === tag.position && styles.hotspotSelected]}
                  >
                    <View style={styles.dot} />
                  </Pressable>
                );
              })
            : null}
        </View>
        <Text style={styles.seller}>{t('mobile.scene.by_seller', { seller: scene.seller.storeName })}</Text>
        <Heading>{scene.caption}</Heading>
        <Section title={t('mobile.scene.in_this_scene')}>
          {scene.tags.map((tag) => (
            <Pressable key={tag.position} accessibilityRole="button" accessibilityLabel={`${tag.name}`} onPress={() => setSelected(tag.position)} style={[styles.row, selected === tag.position && styles.rowSelected]}>
              <TagLine tag={tag} />
              {tag.priceMin && tag.priceMax ? <Body>{formatPriceRange(tag.priceMin, tag.priceMax)}</Body> : null}
              <Button kind="secondary" label={t('mobile.scene.view_product')} onPress={() => openProduct(tag)} />
            </Pressable>
          ))}
        </Section>
        {scene.related.length > 0 ? (
          <Section title={t('mobile.scene.related')}>
            {scene.related.map((related) => (
              <SceneCard key={related.sceneRef} scene={related} onExplore={() => router.push(`/scenes/${related.sceneRef}`)} />
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl },
  seller: { ...theme.text.small, color: theme.color.textSecondary },
  hotspot: { position: 'absolute', width: theme.touch, height: theme.touch, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.full },
  hotspotSelected: { borderWidth: 2, borderColor: theme.color.primary },
  dot: { width: 16, height: 16, borderRadius: theme.radius.full, backgroundColor: theme.color.highlight, borderWidth: 2, borderColor: theme.color.highlightBorder },
  row: { gap: theme.space.xs, padding: theme.space.smd, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface },
  rowSelected: { borderColor: theme.color.primary, borderWidth: 2 },
});
