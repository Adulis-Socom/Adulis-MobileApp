// The Seller Stories row on Home, below the channel row. A separate content row, never a feed unit. One entry per Seller, in the
// server's order, one screen-reader stop each. Empty collapses to nothing; an error or offline row simply is not drawn (an old row
// never stands in), and Home stays usable. Closing the viewer puts screen-reader focus back on the entry that opened it. No seen
// state: its persistence is an open decision (DEC-IJ-S1).
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useRead } from '../discovery/hooks';
import { t } from '../i18n/messages';
import { Button } from '../ui/components';
import { theme } from '../ui/theme';

/** The entry whose viewer is open, so focus can return to it. Memory only. */
let openedFrom: string | null = null;

export function StoriesRow() {
  const router = useRouter();
  const query = useRead('stories.row.get', {});
  const entries = useRef(new Map<string, ComponentRef<typeof Pressable> | null>());
  const groups = query.status === 'success' ? query.data.groups : [];

  useFocusEffect(
    useCallback(() => {
      if (openedFrom === null) return;
      const node = entries.current.get(openedFrom);
      openedFrom = null;
      const tag = node ? findNodeHandle(node as Parameters<typeof findNodeHandle>[0]) : null;
      if (typeof tag === 'number') AccessibilityInfo.setAccessibilityFocus(tag);
    }, []),
  );

  if (groups.length === 0) return null;
  return (
    <View accessibilityLabel={t('mobile.stories.row')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {groups.map((group) => (
          <Button
            key={group.seller.sellerRef}
            kind="secondary"
            label={t('mobile.stories.entry', { seller: group.seller.storeName })}
            buttonRef={(node: ComponentRef<typeof Pressable> | null) => {
              entries.current.set(group.seller.sellerRef, node);
            }}
            onPress={() => {
              openedFrom = group.seller.sellerRef;
              router.push(`/stories/${group.seller.sellerRef}`);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ row: { gap: theme.space.sm } });
