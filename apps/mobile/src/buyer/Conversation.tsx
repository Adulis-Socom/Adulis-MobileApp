import { useIsFocused } from 'expo-router/react-navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, View } from 'react-native';

import { ApiError, isTransient, newIdempotencyKey, problemCode, wasAnswered } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import {
  CONVERSATIONS,
  MESSAGES,
  MESSAGE_MAX,
  acceptedMessage,
  botText,
  escalatableAnswer,
  isConversationRef,
  useConversationMessages,
  useConversations,
  type ChatMessage,
} from './chat';
import type { ProductRef } from './MessageSellerButton';
import { keepIfCurrent, usePrivateApi } from './saved';

/**
 * One Buyer-Seller conversation (WO-013; ADU-CHAT-01 v3.3 S7-S10, ADU-CHATBOT-01 v3.3 S18-S19,
 * ADU-MOB-02 v4.3 S125-S130), the supported subset:
 *
 * - Messages as the server sends them, oldest at the top. Every message names its sender: You, Seller,
 *   Seller team, or "Automated answer" (a bot answer is never drawn as a Seller reply).
 * - Plain text up to 4,000 characters. A message is shown as sent only once the server accepted it:
 *   while sending the draft stays in the box with "Sending your message"; a failure keeps it there
 *   and says it was not sent (connected-only: no queue). One idempotency key per draft, kept across a
 *   lost connection, so a retry never sends twice; a ref blocks a double tap.
 * - "Ask the Seller" after an automated answer, with no promise of a response time.
 * - Re-read on opening, on Refresh, and every 30 seconds while this screen is focused and the app is
 *   in the foreground. No presence, typing or delivery receipts.
 * - The screen belongs to the session it opened in: if that session ends or changes, it leaves, and
 *   the unsent draft goes with it.
 * - Product context (WO-014; ADU-CHAT-01 S4-S5): entering from a Product preselects it for the NEXT
 *   message only. The screen reads the Product itself (public read; route parameters are only its
 *   handle and slug), shows it only while that read is current and its Seller is this
 *   conversation's, reads it again right before sending, sends its id as the message's product_id,
 *   and clears it after the server accepts. The Buyer can remove it; follow-ups carry no anchor.
 */
export function ConversationScreen({ conversationRef, product = null }: { conversationRef: unknown; product?: ProductRef | null }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const qc = useQueryClient();
  const focused = useIsFocused();
  const { session } = useSession();
  const api = usePrivateApi();
  const current = session.status === 'signedIn' ? session.token : null;
  const owner = useRef(current);
  const ref = isConversationRef(conversationRef) ? conversationRef : null;
  const messages = useConversationMessages(ref, focused);
  const conversations = useConversations();
  const [draft, setDraft] = useState('');
  // failed: the server refused it; unknown: no answer (it may have been stored).
  const [state, setState] = useState<'idle' | 'sending' | 'failed' | 'unknown'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askFailed, setAskFailed] = useState(false);
  const sending = useRef(false);
  const askingRef = useRef(false);
  // The idempotency intent is the WHOLE payload: text and Product (or none).
  const sendIntent = useRef<{ text: string; productId: string | null; key: string } | null>(null);
  // The next message's Product (lookup keys of a public read), and a refusal from the last check.
  const [context, setContext] = useState<ProductRef | null>(product);
  const [refusal, setRefusal] = useState<'gone' | 'mismatch' | 'unchecked' | null>(null);
  const contextRead = useQuery({
    queryKey: ['chat-context', context?.handle ?? '', context?.slug ?? ''],
    // A technical re-read (revalidate): opening the composer is not a Product view.
    queryFn: () => keepIfCurrent(api!, (a) => a.product(context!.handle, context!.slug, true)),
    enabled: api !== null && context !== null,
    staleTime: 0,
    gcTime: 0,
    retry: (failures, e) => isTransient(e) && failures < 2,
  });
  const askIntent = useRef<{ forMessage: string; key: string } | null>(null);

  useEffect(() => {
    if (state === 'sending') AccessibilityInfo.announceForAccessibility(t('buyer.chat.sending'));
  }, [state, t]);
  const listed = conversations.items.some((c) => c.id === conversationRef);
  useEffect(() => {
    if (context !== null && !listed && conversations.hasNextPage && !conversations.isFetching) {
      void conversations.fetchNextPage();
    }
  }, [context, listed, conversations]);

  if (current === null || current !== owner.current) return <Redirect href="/messages" />;

  const conversation = conversations.items.find((c) => c.id === ref);
  const title = conversation?.storeName ?? t('buyer.chat.title');
  const header = <Stack.Screen options={{ title }} />;
  const secondary = { color: theme.color.textSecondary };

  if (ref === null || (messages.isError && problemCode(messages.error) === 'NOT_FOUND')) {
    return (
      <View style={{ padding: theme.space.lg }}>
        {header}
        <AppText>{t('buyer.chat.unavailable')}</AppText>
      </View>
    );
  }

  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const text = draft.trim();
  const tooLong = text.length > MESSAGE_MAX;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
  };

  // What the composer may say about its Product: shown only from a current read whose Seller is
  // this conversation's (never from route parameters, never after a refusal).
  const contextStatus: 'none' | 'checking' | 'ok' | 'gone' | 'mismatch' | 'unchecked' =
    context === null
      ? 'none'
      : refusal !== null
        ? refusal
        : contextRead.isError
          ? problemCode(contextRead.error) === 'NOT_FOUND'
            ? 'gone'
            : 'unchecked'
          : contextRead.data === undefined ||
              (conversation === undefined && (conversations.isPending || conversations.hasNextPage))
            ? 'checking'
            : conversation === undefined
              ? 'unchecked'
              : contextRead.data.seller.handle !== conversation.handle
                ? 'mismatch'
                : 'ok';
  // While the outcome of a send is unknown the payload is frozen: a retry must replay the same text,
  // Product and key. "Edit the message instead" gives up that intent explicitly.
  const frozen = state === 'unknown' && sendIntent.current !== null;
  const abandon = () => {
    sendIntent.current = null;
    setState('idle');
    setError(null);
  };
  const removeContext = () => {
    if (sending.current || (state === 'unknown' && sendIntent.current !== null)) return;
    setContext(null);
    setRefusal(null);
  };

  const send = async () => {
    if (!api || sending.current || text.length === 0 || tooLong) return;
    if (context !== null && contextStatus !== 'ok') return;
    // A refused check sends nothing: an unconfirmed earlier send stays unconfirmed, anything else is idle.
    const previous = state === 'unknown' ? 'unknown' : 'idle';
    sending.current = true;
    setState('sending');
    setError(null);
    try {
      let productId: string | null = null;
      if (context !== null) {
        // Read the Product again right before sending: it may have been unpublished or moved since.
        // A refusal here sends nothing; a lost connection is "could not check", never "removed".
        try {
          const fresh = await keepIfCurrent(api, (a) => a.product(context.handle, context.slug, true));
          if (fresh.seller.handle !== conversation?.handle || fresh.id !== contextRead.data?.id) {
            setRefusal('mismatch');
            setState(previous);
            return;
          }
          productId = fresh.id;
        } catch (check) {
          if (!api.isCurrent()) return;
          setRefusal(problemCode(check) === 'NOT_FOUND' ? 'gone' : 'unchecked');
          setState(previous);
          return;
        }
      }
      // One key per payload: a retry of the same text and Product replays, never re-sends; a changed
      // text or Product is a new intent.
      if (sendIntent.current?.text !== text || sendIntent.current.productId !== productId) {
        sendIntent.current = { text, productId, key: newIdempotencyKey() };
      }
      const body = await api.sendMessage(ref, text, sendIntent.current.key, productId);
      // An answer without a message id is an answered failure: its key must not be replayed forever.
      if (!acceptedMessage(body)) throw new ApiError({ kind: 'unexpected', status: 201 });
      sendIntent.current = null;
      if (!api.isCurrent()) return;
      setDraft('');
      // The Product described this message only: the next one starts without it.
      setContext(null);
      setRefusal(null);
      setState('idle');
      await Promise.all([
        qc.invalidateQueries({ queryKey: [MESSAGES, ref] }),
        qc.invalidateQueries({ queryKey: [CONVERSATIONS] }),
      ]);
    } catch (failure) {
      // A server answer ends this intent; offline or a timeout keeps the key for the retry, which
      // replays if the message was stored. The outcome is then unknown: say so, and re-read.
      const answered = wasAnswered(failure);
      if (answered) sendIntent.current = null;
      if (!api.isCurrent()) return;
      if (context !== null && problemCode(failure) === 'NOT_FOUND') setRefusal('gone');
      setState(answered ? 'failed' : 'unknown');
      setError(failureMessage(t, failure));
      if (!answered) void qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
    } finally {
      sending.current = false;
    }
  };

  const answer = escalatableAnswer(messages.items);
  const canAsk = answer !== null;
  const ask = async () => {
    if (!api || !answer || askingRef.current) return;
    askingRef.current = true;
    if (askIntent.current?.forMessage !== answer.id) askIntent.current = { forMessage: answer.id, key: newIdempotencyKey() };
    setAsking(true);
    setAskFailed(false);
    try {
      await api.escalateConversation(ref, askIntent.current.key);
      askIntent.current = null;
      if (api.isCurrent()) await qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
    } catch (failure) {
      if (wasAnswered(failure)) askIntent.current = null;
      if (api.isCurrent()) setAskFailed(true);
    } finally {
      askingRef.current = false;
      setAsking(false);
    }
  };

  const bubble = (m: ChatMessage) => {
    const mine = m.kind === 'BUYER';
    const bot = m.kind === 'BOT';
    const sender = mine
      ? 'buyer.chat.sender.you'
      : bot
        ? 'buyer.chat.sender.bot'
        : m.kind === 'TEAM_MEMBER'
          ? 'buyer.chat.sender.team'
          : 'buyer.chat.sender.seller';
    return (
      <View
        accessible
        style={{
          alignSelf: mine ? 'flex-end' : 'flex-start',
          maxWidth: '88%',
          gap: theme.space.xs,
          padding: theme.space.md,
          marginVertical: theme.space.xs,
          borderRadius: theme.radius.md,
          borderWidth: bot ? 2 : 1,
          borderColor: bot ? theme.color.infoBorder : mine ? theme.color.accent : theme.color.border,
          backgroundColor: bot ? theme.color.infoBg : mine ? theme.color.accentSubtle : theme.color.surface,
        }}
      >
        <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{t(sender)}</AppText>
        <AppText>{bot ? botText(t, m) : m.body}</AppText>
        {m.aboutProduct ? <AppText style={secondary}>{t('buyer.chat.about_product')}</AppText> : null}
        {m.aboutOrder ? <AppText style={secondary}>{t('buyer.chat.about_order')}</AppText> : null}
        <AppText style={secondary}>{fillSlots(t('buyer.chat.sent_at'), { time: when(m.sentAt) })}</AppText>
      </View>
    );
  };

  const list =
    messages.items.length > 0 ? (
      <FlatList
        inverted
        data={messages.items}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => bubble(item)}
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
      />
    ) : (
      <View style={{ flex: 1, padding: theme.space.lg, gap: theme.space.sm }}>
        {messages.isError ? (
          <View accessibilityRole="alert" style={{ gap: theme.space.sm }}>
            <AppText>{t('buyer.chat.failed')}</AppText>
            <AppText style={secondary}>{failureMessage(t, messages.error)}</AppText>
            <Button label={t('common.retry')} onPress={() => void messages.refetch()} />
          </View>
        ) : (
          <AppText style={secondary}>{t(messages.isPending ? 'common.loading' : 'buyer.chat.empty')}</AppText>
        )}
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      {header}
      <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm }}>
        <Button label={t('buyer.chat.refresh')} variant="secondary" onPress={refresh} disabled={messages.isFetching} />
      </View>
      <View style={{ flex: 1 }}>{list}</View>
      <View style={{ padding: theme.space.lg, gap: theme.space.sm, borderTopWidth: 1, borderColor: theme.color.border }}>
        {canAsk ? (
          <View style={{ gap: theme.space.xs }}>
            <AppText style={secondary}>{t('buyer.chat.ask_seller_hint')}</AppText>
            <Button label={t('buyer.chat.ask_seller')} variant="secondary" onPress={() => void ask()} disabled={asking} />
            {askFailed ? <AppText accessibilityRole="alert">{t('buyer.chat.ask_failed')}</AppText> : null}
          </View>
        ) : null}
        {context !== null ? (
          <ProductContext
            status={contextStatus}
            name={contextStatus === 'ok' ? (contextRead.data?.name ?? null) : null}
            available={contextStatus === 'ok' ? (contextRead.data?.available ?? null) : null}
            locked={state === 'sending' || frozen}
            onRemove={removeContext}
            onRetry={() => {
              setRefusal(null);
              void contextRead.refetch();
            }}
          />
        ) : null}
        <TextField
          label={t('buyer.chat.composer')}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (state === 'failed') setState('idle');
          }}
          multiline
          editable={state !== 'sending' && !frozen}
          error={tooLong ? (fillSlots(t('buyer.chat.too_long'), { max: MESSAGE_MAX.toLocaleString(locale) }) ?? null) : null}
        />
        {state === 'sending' ? <AppText style={secondary}>{t('buyer.chat.sending')}</AppText> : null}
        {state === 'failed' || state === 'unknown' ? (
          <View accessibilityRole="alert">
            <AppText>{t(state === 'failed' ? 'buyer.chat.not_sent' : 'buyer.chat.maybe_not_sent')}</AppText>
            {error ? <AppText style={secondary}>{error}</AppText> : null}
          </View>
        ) : null}
        <Button
          label={t('buyer.chat.send')}
          onPress={() => void send()}
          disabled={state === 'sending' || text.length === 0 || tooLong || (context !== null && contextStatus !== 'ok')}
        />
        {frozen ? <Button label={t('buyer.chat.edit_unconfirmed')} variant="secondary" onPress={abandon} /> : null}
        <AppText style={secondary}>{t('buyer.chat.connected_only')}</AppText>
      </View>
    </View>
  );
}

/**
 * The composer's Product (WO-014): "Asking about", the Product's current name and availability from
 * the screen's own read, and Remove Product. Nothing about the Product is drawn unless the read is
 * current and its Seller is this conversation's; a refusal says why without restricted details.
 */
function ProductContext({
  status,
  name,
  available,
  locked,
  onRemove,
  onRetry,
}: {
  status: 'checking' | 'ok' | 'gone' | 'mismatch' | 'unchecked' | 'none';
  name: string | null;
  available: boolean | null;
  locked: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const secondary = { color: theme.color.textSecondary };
  const refusal =
    status === 'gone'
      ? 'buyer.chat.context_gone'
      : status === 'mismatch'
        ? 'buyer.chat.context_mismatch'
        : status === 'unchecked'
          ? 'buyer.chat.context_unchecked'
          : null;
  return (
    <View
      testID="chat-product-context"
      style={{
        gap: theme.space.xs,
        padding: theme.space.sm,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: theme.color.surface,
      }}
    >
      <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{t('buyer.chat.context_title')}</AppText>
      {status === 'ok' && name !== null ? (
        <>
          <AppText>{name}</AppText>
          {available === null ? null : (
            <AppText style={secondary}>{t(available ? 'buyer.product.available' : 'buyer.product.unavailable')}</AppText>
          )}
          <AppText style={secondary}>{t('buyer.chat.context_note')}</AppText>
        </>
      ) : status === 'checking' ? (
        <AppText style={secondary}>{t('buyer.chat.context_checking')}</AppText>
      ) : refusal !== null ? (
        <AppText accessibilityRole="alert">{t(refusal)}</AppText>
      ) : null}
      {status === 'unchecked' ? (
        // Checking again never changes the payload, so it stays available while a send is unconfirmed.
        <Button label={t('common.retry')} variant="secondary" onPress={onRetry} disabled={status !== 'unchecked'} />
      ) : null}
      <Button label={t('buyer.chat.context_remove')} variant="secondary" onPress={onRemove} disabled={locked} />
    </View>
  );
}
