// The Seller Stories row on Home, below the channel row. A separate content row, never a feed unit. One entry per Seller, in the
// server's order, one screen-reader stop each. Empty collapses to nothing; an error or offline row simply is not drawn (an old row
// never stands in), and Home stays usable. No seen state until it is approved (DEC-IJ-S1).
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useRead } from '../discovery/hooks';
import { t } from '../i18n/messages';
import { Button } from '../ui/components';
import { theme } from '../ui/theme';

export function StoriesRow() {
  const router = useRouter();
  const query = useRead('stories.row.get', {});
  const groups = query.status === 'success' ? query.data.groups : [];
  if (groups.length === 0) return null;
  return (
    <View accessibilityLabel={t('mobile.stories.row')}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {groups.map((group) => (
          <Button key={group.seller.sellerRef} kind="secondary" label={t('mobile.stories.entry', { seller: group.seller.storeName })} onPress={() => router.push(`/stories/${group.seller.sellerRef}`)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({ row: { gap: theme.space.sm } });
