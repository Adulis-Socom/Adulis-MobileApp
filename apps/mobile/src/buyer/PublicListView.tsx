import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { failureMessage } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import type { usePublicList } from './public-list';

/**
 * A public list's every state in one FlashList (WO-006, WO-007): the header (a profile, a title)
 * stays above whatever the list is doing, so a failure, an empty answer or the end of the list
 * is shown under it and nothing the server did not send is drawn. Pull to refresh everywhere.
 */
export function PublicListView<I>({
  list,
  renderItem,
  keyOf,
  header,
  numColumns = 1,
  empty,
  loading,
  testID,
  label,
  onRefresh,
  blocked,
}: {
  list: ReturnType<typeof usePublicList<{ next_cursor: string | null }, I>>;
  renderItem: ListRenderItem<I>;
  keyOf: (item: I) => string;
  header?: ReactElement | null;
  numColumns?: number;
  empty: MobileMessageKey;
  loading: MobileMessageKey;
  testID: string;
  label: string;
  /** What a pull does; the list's own refresh by default. */
  onRefresh?: () => void;
  /** Why the list cannot be read at all (the screen's precondition failed): shown instead of any list state. */
  blocked?: { message: string; onRetry?: () => void } | null;
}) {
  const t = useT();
  const theme = useTheme();

  const state = (() => {
    if (list.items.length > 0) return null;
    if (blocked) {
      return (
        <>
          <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
            {blocked.message}
          </AppText>
          {blocked.onRetry ? <Button label={t('common.retry')} onPress={blocked.onRetry} /> : null}
        </>
      );
    }
    if (list.paused) return <AppText accessibilityRole="alert">{t('common.offline')}</AppText>;
    if (list.status === 'pending') {
      return (
        <>
          <ActivityIndicator color={theme.color.accent} />
          <AppText accessibilityLiveRegion="polite" style={{ color: theme.color.textSecondary }}>
            {t(loading)}
          </AppText>
        </>
      );
    }
    if (list.status === 'error') {
      return (
        <>
          <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
            {failureMessage(t, list.error)}
          </AppText>
          <Button label={t('common.retry')} onPress={list.retry} />
        </>
      );
    }
    return <AppText style={{ textAlign: 'center', color: theme.color.textSecondary }}>{t(empty)}</AppText>;
  })();

  return (
    <FlashList
      testID={testID}
      accessibilityLabel={label}
      data={list.items}
      numColumns={numColumns}
      keyExtractor={keyOf}
      renderItem={renderItem}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      style={{ backgroundColor: theme.color.bg }}
      contentContainerStyle={{ padding: theme.space.sm }}
      refreshControl={
        <RefreshControl refreshing={list.refreshing} onRefresh={onRefresh ?? list.refresh} colors={[theme.color.accent]} />
      }
      ListHeaderComponent={
        <View>
          {header}
          {state ? (
            <View style={{ padding: theme.space.lg, gap: theme.space.md, alignItems: 'center' }}>{state}</View>
          ) : null}
        </View>
      }
      ListFooterComponent={
        list.items.length === 0 ? null : (
          <View style={{ paddingVertical: theme.space.lg, gap: theme.space.sm, alignItems: 'center' }}>
            {list.isFetchingNextPage ? (
              <ActivityIndicator color={theme.color.accent} accessibilityLabel={t('buyer.list.loading_more')} />
            ) : list.isFetchNextPageError ? (
              <>
                <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
                  {`${t('buyer.list.more_failed')} ${failureMessage(t, list.error)}`}
                </AppText>
                <Button label={t('common.retry')} onPress={list.retryNextPage} />
              </>
            ) : !list.hasNextPage ? (
              <AppText style={{ color: theme.color.textSecondary, textAlign: 'center' }}>{t('buyer.list.end')}</AppText>
            ) : null}
          </View>
        )
      }
    />
  );
}
