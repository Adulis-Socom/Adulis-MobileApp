import { useIsFocused } from 'expo-router/react-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, FlatList, Pressable, ScrollView, View } from 'react-native';

import { problemCode } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { AlertText, StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { MESSAGE_MAX, isConversationRef, messagesKey, useConversationMessages, type ChatScope } from '../buyer/chat';
import { MessageBubble } from '../buyer/MessageBubble';
import { usePublicList } from '../buyer/public-list';
import { PublicListView } from '../buyer/PublicListView';
import { keepIfCurrent, usePrivateApi } from '../buyer/saved';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { parseStoreConversationPage, storeConversationsKey, useStoreReply, type StoreConversation } from './seller-chat';
import { useSellerContext } from './seller-context';
import { WithStore } from './SellerOrders';

/** The role may not read or send messages in this store (or this surface): never a sign-out, never "deleted". */
const DENIED = new Set(['PERMISSION_DENIED', 'AUDIENCE_NOT_PERMITTED']);
const denied = (error: unknown) => DENIED.has(problemCode(error) ?? '');

/**
 * The active store's Buyer conversations (WO-021; GET /v1/conversations?as=seller, X-Adulis-Seller),
 * most recent activity first as the server orders them. A row is "Buyer conversation" and its last
 * activity: no Buyer identity, preview or unread count is published, so none is shown. A 404 means
 * the store is no longer this Account's (the store's relationship check); a 403 is this role.
 */
export function SellerConversations() {
  return <WithStore>{(store) => <ConversationList key={store.id} sellerId={store.id} />}</WithStore>;
}

function ConversationList({ sellerId }: { sellerId: string }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const priv = usePrivateApi();
  const { refused } = useSellerContext();
  const list = usePublicList({
    resource: storeConversationsKey(sellerId),
    read: priv ? async (cursor) => parseStoreConversationPage(await keepIfCurrent(priv, (api) => api.sellerConversations(sellerId, cursor))) : null,
    items: (page) => page.data,
    keyOf: (c: StoreConversation) => c.id,
  });
  useEffect(() => {
    if (list.error) refused(list.error);
  }, [list.error, refused]);
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  const header = (
    <View style={{ gap: theme.space.sm, paddingHorizontal: theme.space.xs, paddingBottom: theme.space.sm }}>
      <AppText style={{ color: theme.color.textSecondary }}>{t('seller.messages.note')}</AppText>
      <Button label={t('seller.messages.refresh')} variant="secondary" onPress={list.refresh} disabled={list.refreshing} />
    </View>
  );
  return (
    <PublicListView
      list={list}
      keyOf={(c) => c.id}
      header={header}
      renderItem={({ item }) => {
        const title = t('seller.messages.conversation');
        const line = item.lastMessageAt
          ? fillSlots(t('seller.messages.last_activity'), { time: when(item.lastMessageAt) })
          : item.startedAt
            ? fillSlots(t('seller.messages.started'), { time: when(item.startedAt) })
            : null;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={line ? `${title}, ${line}` : title}
            accessibilityHint={t('seller.messages.open')}
            onPress={() => router.push({ pathname: '/seller/messages/[conversationId]', params: { conversationId: item.id } })}
            testID="seller-conversation"
            style={({ pressed }) => ({
              minHeight: theme.touchTarget,
              margin: theme.space.xs,
              padding: theme.space.md,
              gap: theme.space.xs,
              borderWidth: 1,
              borderColor: theme.color.border,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.color.surfaceMuted : theme.color.surface,
            })}
          >
            <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{title}</AppText>
            {line ? <AppText style={{ color: theme.color.textSecondary }}>{line}</AppText> : null}
          </Pressable>
        );
      }}
      empty="seller.messages.empty"
      loading="seller.messages.loading"
      testID="seller-conversations"
      label={t('seller.messages.title')}
      blocked={denied(list.error) ? { message: t('seller.messages.unavailable') } : null}
    />
  );
}

const HISTORY_MIN = 120;
const COMPOSER_MAX = '60%';

/**
 * One Buyer conversation, as the active store (WO-021): the messages with their sender categories
 * (Buyer, Store owner, Store team member, Automated answer), "About a Product / an Order" without
 * naming either, re-read on Refresh and every 30 seconds while focused (stopped by a refusal), and a
 * plain-text reply. The route parameter is untrusted: only a conversation id shape is read.
 *
 * A 404 here is this conversation only ("not available"): it never ends the store selection, which
 * the list and Home decide. A 403 is the role. Offline is offline, never "deleted".
 */
export function SellerConversation({ conversationId }: { conversationId: unknown }) {
  const id = isConversationRef(conversationId) ? conversationId : null;
  return <WithStore>{(store) => <StoreConversationView key={store.id} sellerId={store.id} conversationId={id} />}</WithStore>;
}

function StoreConversationView({ sellerId, conversationId }: { sellerId: string; conversationId: string | null }) {
  const t = useT();
  const theme = useTheme();
  const qc = useQueryClient();
  const focused = useIsFocused();
  const scope = useMemo<ChatScope>(() => ({ as: 'seller', sellerId }), [sellerId]);
  const messages = useConversationMessages(conversationId, focused, scope);
  const secondary = { color: theme.color.textSecondary };
  const edges = ['bottom', 'left', 'right'] as const;

  if (conversationId === null || problemCode(messages.error) === 'NOT_FOUND') {
    return (
      <Screen edges={edges}>
        <AlertText>{t('seller.messages.gone')}</AlertText>
      </Screen>
    );
  }
  if (denied(messages.error)) {
    return (
      <Screen edges={edges}>
        <AlertText>{t('seller.messages.unavailable')}</AlertText>
      </Screen>
    );
  }

  const list =
    messages.items.length > 0 ? (
      <FlatList
        inverted
        data={messages.items}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} viewer="seller" />}
        contentContainerStyle={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm }}
        // Inverted: the footer is drawn at the top, above the oldest message.
        ListFooterComponent={
          messages.hasNextPage ? (
            <Button
              label={t('buyer.chat.load_earlier')}
              variant="secondary"
              onPress={() => void messages.fetchNextPage()}
              disabled={messages.isFetchingNextPage}
            />
          ) : undefined
        }
        testID="seller-messages"
      />
    ) : (
      <View style={{ flex: 1, padding: theme.space.lg, gap: theme.space.sm }}>
        {messages.fetchStatus === 'paused' && messages.data === undefined ? (
          <AlertText>{t('common.offline')}</AlertText>
        ) : messages.isError ? (
          <View style={{ gap: theme.space.sm }}>
            <AlertText>{t('seller.messages.failed')}</AlertText>
            <AppText style={secondary}>{failureMessage(t, messages.error)}</AppText>
            <Button label={t('common.retry')} onPress={() => void messages.refetch()} />
          </View>
        ) : (
          <AppText style={secondary}>{t(messages.isPending ? 'common.loading' : 'seller.messages.no_messages')}</AppText>
        )}
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm }}>
        <Button
          label={t('buyer.chat.refresh')}
          variant="secondary"
          onPress={() => void qc.invalidateQueries({ queryKey: messagesKey(scope, conversationId) })}
          disabled={messages.isFetching}
        />
      </View>
      <View style={{ flex: 1, minHeight: HISTORY_MIN }}>{list}</View>
      <StoreReply sellerId={sellerId} conversationId={conversationId} />
    </View>
  );
}

/** The reply composer: text only, sent as the store; shown as sent only once the server accepted it. */
function StoreReply({ sellerId, conversationId }: { sellerId: string; conversationId: string }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const reply = useStoreReply(sellerId, conversationId);
  const [draft, setDraft] = useState('');
  const text = draft.trim();
  const tooLong = text.length > MESSAGE_MAX;
  const secondary = { color: theme.color.textSecondary };
  const code = problemCode(reply.error);
  const refusal = reply.state !== 'failed' ? null : denied(reply.error) ? 'seller.messages.send_unavailable' : code === 'NOT_FOUND' ? 'seller.messages.send_gone' : 'buyer.chat.not_sent';

  // The alert role alone is not spoken on Android: announce what happened to the reply.
  useEffect(() => {
    if (reply.state === 'sending') AccessibilityInfo.announceForAccessibility(t('buyer.chat.sending'));
    if (reply.state === 'unknown') AccessibilityInfo.announceForAccessibility(t('buyer.chat.maybe_not_sent'));
    if (refusal) AccessibilityInfo.announceForAccessibility(t(refusal));
  }, [reply.state, refusal, t]);

  const send = async () => {
    if (await reply.send(text)) setDraft('');
  };

  return (
    <View style={{ maxHeight: COMPOSER_MAX, borderTopWidth: 1, borderColor: theme.color.border }}>
      <ScrollView
        testID="seller-composer"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.space.lg, paddingBottom: theme.space.sm, gap: theme.space.sm }}
      >
        <TextField
          label={t('seller.messages.composer')}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            reply.edited();
          }}
          multiline
          editable={reply.state !== 'sending' && !reply.frozen}
          error={tooLong ? (fillSlots(t('buyer.chat.too_long'), { max: MESSAGE_MAX.toLocaleString(locale) }) ?? null) : null}
        />
        {reply.state === 'sending' ? <StatusText style={secondary}>{t('buyer.chat.sending')}</StatusText> : null}
        {refusal ? (
          <View accessibilityRole="alert">
            <AppText>{t(refusal)}</AppText>
            {refusal === 'buyer.chat.not_sent' ? <AppText style={secondary}>{failureMessage(t, reply.error)}</AppText> : null}
          </View>
        ) : reply.state === 'unknown' ? (
          <View accessibilityRole="alert">
            <AppText>{t('buyer.chat.maybe_not_sent')}</AppText>
            <AppText style={secondary}>{failureMessage(t, reply.error)}</AppText>
          </View>
        ) : null}
        <AppText style={secondary}>{t('buyer.chat.connected_only')}</AppText>
      </ScrollView>
      <View style={{ paddingHorizontal: theme.space.lg, paddingBottom: theme.space.lg, paddingTop: theme.space.xs, gap: theme.space.sm }}>
        {/* Unconfirmed: the same reply again (same text and key), never a new one. */}
        <Button
          label={t(reply.frozen ? 'buyer.chat.retry_send' : 'buyer.chat.send')}
          onPress={() => void send()}
          disabled={reply.state === 'sending' || text.length === 0 || tooLong}
        />
        {reply.frozen ? <Button label={t('buyer.chat.edit_unconfirmed')} variant="secondary" onPress={reply.abandon} /> : null}
      </View>
    </View>
  );
}
