import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';

import { failureMessage, fillSlots } from '../api/messages';
import { AlertText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { useConversations, type Conversation } from './chat';
import { LoadMoreFooter, type Paging } from './LoadMoreFooter';

/**
 * The signed-in Buyer's conversations (WO-013): GET /v1/conversations?as=buyer, newest activity
 * first, with the Seller's public store name. No unread count: the API provides none.
 */
export function Conversations() {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const list = useConversations();
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const secondary = { color: theme.color.textSecondary };

  const row = (c: Conversation) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={c.storeName}
      accessibilityHint={fillSlots(t('buyer.messages.last'), { time: when(c.lastMessageAt) }) ?? undefined}
      onPress={() => router.push({ pathname: '/chat/[conversationRef]', params: { conversationRef: c.id } })}
      style={({ pressed }) => ({
        gap: theme.space.xs,
        padding: theme.space.md,
        marginBottom: theme.space.sm,
        minHeight: theme.touchTarget,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: pressed ? theme.color.surfaceMuted : theme.color.bg,
      })}
    >
      <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{c.storeName}</AppText>
      <AppText style={secondary}>{`@${c.handle}`}</AppText>
      <AppText style={secondary}>{fillSlots(t('buyer.messages.last'), { time: when(c.lastMessageAt) })}</AppText>
    </Pressable>
  );

  const empty = list.isError ? (
    <View style={{ gap: theme.space.sm }}>
      <AlertText>{t('buyer.messages.failed')}</AlertText>
      <AppText style={secondary}>{failureMessage(t, list.error)}</AppText>
      <Button label={t('common.retry')} onPress={() => void list.refetch()} />
    </View>
  ) : (
    <AppText style={list.isPending ? secondary : undefined}>
      {t(list.fetchStatus === 'paused' && list.data === undefined ? 'common.offline' : list.isPending ? 'common.loading' : 'buyer.messages.empty')}
    </AppText>
  );

  // The same end of a paged list as every other list: Load older, Loading more, a failure with Try again, the end.
  const paging: Paging = {
    count: list.items.length,
    pageCount: list.data?.pages.length ?? 0,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    isFetchNextPageError: list.isFetchNextPageError,
    error: list.error,
    loadMore: () => void list.fetchNextPage(),
    retryNextPage: () => void list.fetchNextPage(),
  };
  const footer =
    list.items.length > 0 || list.hasNextPage ? (
      <LoadMoreFooter
        paging={paging}
        keys={{ load: 'buyer.messages.load_older', loading: 'buyer.list.loading_more', failed: 'buyer.list.more_failed', end: 'buyer.list.end' }}
      />
    ) : null;

  return (
    <FlashList
      data={list.items}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => row(item)}
      contentContainerStyle={{ padding: theme.space.lg }}
      refreshControl={
        <RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => void list.refetch()} colors={[theme.color.accent]} />
      }
      ListHeaderComponent={
        <View style={{ gap: theme.space.sm, marginBottom: theme.space.sm }}>
          <Button label={t('buyer.messages.refresh')} variant="secondary" onPress={() => void list.refetch()} disabled={list.isFetching} />
          {/* A refresh that failed leaves the rows as they were, and says so; an older page says it in the footer, and an empty list in its own block. */}
          {list.isRefetchError && !list.isFetchNextPageError && list.items.length > 0 ? (
            <AlertText>{`${t('buyer.messages.failed')} ${failureMessage(t, list.error)}`}</AlertText>
          ) : null}
        </View>
      }
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
    />
  );
}
