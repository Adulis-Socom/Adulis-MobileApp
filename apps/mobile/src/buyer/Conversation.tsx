import { useIsFocused } from 'expo-router/react-navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, View } from 'react-native';

import { newIdempotencyKey, problemCode, wasAnswered } from '../api/client';
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
  isConversationRef,
  useConversationMessages,
  useConversations,
  type ChatMessage,
} from './chat';
import { usePrivateApi } from './saved';

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
 */
export function ConversationScreen({ conversationRef }: { conversationRef: unknown }) {
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
  const [state, setState] = useState<'idle' | 'sending' | 'failed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askFailed, setAskFailed] = useState(false);
  const sending = useRef(false);
  const sendIntent = useRef<{ text: string; key: string } | null>(null);
  const askIntent = useRef<{ forMessage: string; key: string } | null>(null);

  useEffect(() => {
    if (state === 'sending') AccessibilityInfo.announceForAccessibility(t('buyer.chat.sending'));
  }, [state, t]);

  if (current === null || current !== owner.current) return <Redirect href="/messages" />;

  const title = conversations.items.find((c) => c.id === ref)?.storeName ?? t('buyer.chat.title');
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

  const send = async () => {
    if (!api || sending.current || text.length === 0 || tooLong) return;
    // One key per draft: a retry of the same text after a lost connection replays, never re-sends.
    if (sendIntent.current?.text !== text) sendIntent.current = { text, key: newIdempotencyKey() };
    sending.current = true;
    setState('sending');
    setError(null);
    try {
      const body = await api.sendMessage(ref, text, sendIntent.current.key);
      if (!acceptedMessage(body)) throw new Error('send answered without a message id');
      sendIntent.current = null;
      if (!api.isCurrent()) return;
      setDraft('');
      setState('idle');
      await Promise.all([
        qc.invalidateQueries({ queryKey: [MESSAGES, ref] }),
        qc.invalidateQueries({ queryKey: [CONVERSATIONS] }),
      ]);
    } catch (failure) {
      // A server answer ends this intent; offline or a timeout keeps the key for the retry.
      if (wasAnswered(failure)) sendIntent.current = null;
      if (!api.isCurrent()) return;
      setState('failed');
      setError(failureMessage(t, failure));
    } finally {
      sending.current = false;
    }
  };

  const latest = messages.items[0];
  const canAsk = latest?.kind === 'BOT' && !latest.escalated && latest.templateKey !== 'chat.bot.escalated';
  const ask = async () => {
    if (!api || !latest || asking) return;
    if (askIntent.current?.forMessage !== latest.id) askIntent.current = { forMessage: latest.id, key: newIdempotencyKey() };
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
        <TextField
          label={t('buyer.chat.composer')}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (state === 'failed') setState('idle');
          }}
          multiline
          editable={state !== 'sending'}
          error={tooLong ? (fillSlots(t('buyer.chat.too_long'), { max: MESSAGE_MAX.toLocaleString(locale) }) ?? null) : null}
        />
        {state === 'sending' ? <AppText style={secondary}>{t('buyer.chat.sending')}</AppText> : null}
        {state === 'failed' ? (
          <View accessibilityRole="alert">
            <AppText>{t('buyer.chat.not_sent')}</AppText>
            {error ? <AppText style={secondary}>{error}</AppText> : null}
          </View>
        ) : null}
        <Button label={t('buyer.chat.send')} onPress={() => void send()} disabled={state === 'sending' || text.length === 0 || tooLong} />
        <AppText style={secondary}>{t('buyer.chat.connected_only')}</AppText>
      </View>
    </View>
  );
}
