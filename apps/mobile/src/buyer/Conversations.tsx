import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';

import { failureMessage, fillSlots } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { useConversations, type Conversation } from './chat';

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
    <View accessibilityRole="alert" style={{ gap: theme.space.sm }}>
      <AppText>{t('buyer.messages.failed')}</AppText>
      <AppText style={secondary}>{failureMessage(t, list.error)}</AppText>
      <Button label={t('common.retry')} onPress={() => void list.refetch()} />
    </View>
  ) : (
    <AppText style={list.isPending ? secondary : undefined}>{t(list.isPending ? 'common.loading' : 'buyer.messages.empty')}</AppText>
  );

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
        <View style={{ marginBottom: theme.space.sm }}>
          <Button label={t('buyer.messages.refresh')} variant="secondary" onPress={() => void list.refetch()} disabled={list.isFetching} />
        </View>
      }
      ListEmptyComponent={empty}
      ListFooterComponent={
        list.hasNextPage ? (
          <Button
            label={t('buyer.messages.load_older')}
            variant="secondary"
            onPress={() => void list.fetchNextPage()}
            disabled={list.isFetchingNextPage}
          />
        ) : null
      }
    />
  );
}
