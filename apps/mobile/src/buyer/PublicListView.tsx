import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import type { ReactElement } from 'react';
import { ActivityIndicator, RefreshControl, View, useWindowDimensions } from 'react-native';

import { failureMessage } from '../api/messages';
import { AlertText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { LoadMoreFooter } from './LoadMoreFooter';
import type { usePublicList } from './public-list';
import { CardSavesContext, useCardSaves, type ListSaves } from './saved';

/**
 * Large text (WO-018, A-006): from Android's 130% font size up, grids become one column and
 * Product names are shown in full, rather than cut to two lines in half the screen.
 */
export const LARGE_TEXT_SCALE = 1.3;
export function useLargeText() {
  return useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
}

/**
 * A public list's every state in one FlashList (WO-006, WO-007): the header (a profile, a title)
 * stays above whatever the list is doing, so a failure, an empty answer or the end of the list
 * is shown under it and nothing the server did not send is drawn. Pull to refresh everywhere, and
 * Load more beside the scroll trigger (WO-018). A grid (`numColumns` > 1) is one column at large text.
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
  emptyState,
  saves,
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
  onRefresh?: (() => void) | undefined;
  /** Why the list cannot be read at all (the screen's precondition failed): shown instead of any list state. */
  blocked?: { message: string; onRetry?: () => void } | null;
  /** What an empty answer shows instead of the `empty` sentence (e.g. a slotted message with actions). */
  emptyState?: ReactElement | null;
  /**
   * Cards that can be saved (WO-009A): how an item becomes a Save target (a stable function)
   * and the list's surface. Saved state is then read once per page and given to the cards.
   */
  saves?: ListSaves<I>;
}) {
  const t = useT();
  const theme = useTheme();
  const cardSaves = useCardSaves(list.pages, saves);
  const largeText = useLargeText();
  const columns = numColumns > 1 && largeText ? 1 : numColumns;

  const state = (() => {
    if (list.items.length > 0) return null;
    if (blocked) {
      return (
        <>
          <AlertText style={{ textAlign: 'center' }}>
            {blocked.message}
          </AlertText>
          {blocked.onRetry ? <Button label={t('common.retry')} onPress={blocked.onRetry} /> : null}
        </>
      );
    }
    if (list.paused) return <AlertText>{t('common.offline')}</AlertText>;
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
          <AlertText style={{ textAlign: 'center' }}>
            {failureMessage(t, list.error)}
          </AlertText>
          <Button label={t('common.retry')} onPress={list.retry} />
        </>
      );
    }
    return emptyState ?? <AppText style={{ textAlign: 'center', color: theme.color.textSecondary }}>{t(empty)}</AppText>;
  })();

  return (
    <CardSavesContext.Provider value={cardSaves}>
    <FlashList
      // A column change re-lays the list out from scratch.
      key={columns}
      testID={testID}
      accessibilityLabel={label}
      data={list.items}
      numColumns={columns}
      keyExtractor={keyOf}
      renderItem={renderItem}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      // A list under a text field (Search): a drag puts the keyboard away; a tap on a result still lands.
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
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
          <LoadMoreFooter
            paging={{ ...list, count: list.items.length, pageCount: list.pages.length }}
            keys={{ load: 'buyer.list.load_more', loading: 'buyer.list.loading_more', failed: 'buyer.list.more_failed', end: 'buyer.list.end' }}
          />
        )
      }
    />
    </CardSavesContext.Provider>
  );
}
