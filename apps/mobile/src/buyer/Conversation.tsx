import { useIsFocused } from 'expo-router/react-navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, ScrollView, View } from 'react-native';

import { ApiError, isTransient, newIdempotencyKey, problemCode } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { keyUsable } from '../api/mutation';
import { useSession } from '../auth/session';
import { AlertText, StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import {
  CONVERSATIONS,
  MESSAGES,
  MESSAGE_MAX,
  acceptedEscalation,
  acceptedMessage,
  escalatableAnswer,
  isConversationRef,
  rereadAfter,
  useConversationMessages,
  useConversations,
} from './chat';
import type { ProductRef } from './MessageSellerButton';
import { MessageBubble } from './MessageBubble';
import { ProductPicker } from './ProductPicker';
import { candidatesFor, captureBaseline, type Baseline } from './pending-match';
import { isPathName } from './public-read';
import { keepIfCurrent, usePrivateApi } from './saved';
import { judgeFailure, type SendStatus } from './send-intent';

/**
 * One Buyer-Seller conversation (WO-013; ADU-CHAT-01 v3.3 S7-S10, ADU-CHATBOT-01 v3.3 S18-S19,
 * ADU-MOB-02 v4.3 S125-S130), the supported subset:
 *
 * - Messages as the server sends them, oldest at the top. Every message names its sender: You, Seller,
 *   Seller team, or "Automated answer" (a bot answer is never drawn as a Seller reply).
 * - Plain text up to 4,000 characters. A message is shown as sent only once the server accepted it:
 *   while sending the draft stays in the box with "Sending your message"; a failure keeps it there
 *   and says it was not sent (connected-only: no queue). One idempotency key per draft, kept across a
 *   lost connection, so a retry never sends twice; a ref blocks a double tap. The key is sent again
 *   only while it is surely inside the server's 24 hour record (23 hours from the first attempt) and
 *   after no key conflict; beyond that the screen offers only an explicit new message. A wait the
 *   server or a gateway asked for (429, 503) holds sending and Ask the Seller until it is over.
 * - While a send is unconfirmed, a message in the history with the same text that is newer than what the
 *   history held before the attempt (pending-match.ts: server times only) is reported as a hint. The
 *   app never settles the send on it: only the server's answer to the same key does, or the person's own
 *   "Clear the message", which sends nothing and claims nothing.
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
 * - Select Product (WO-015; S5): the Buyer can choose a Product of this conversation's Seller from
 *   inside the conversation. The Seller is known only by the handle in the Buyer's own conversation
 *   list (the list parser keeps the handle, not the Seller id), found within the first MAX_LIST_PAGES pages;
 *   if it cannot be found there, Product selection is off and plain messages still work. A chosen
 *   Product becomes the same context as one from Product Detail: read, checked and sent the same way.
 */
/** How many pages of the Buyer's conversation list the screen reads to find its Seller (25 each). */
export const MAX_LIST_PAGES = 4;
/**
 * ON-20261111-164 (WO-016): the history keeps at least this much height, and the composer's
 * content scrolls inside at most COMPOSER_MAX of the screen, with Send fixed under it. Enlarged text
 * and the keyboard can no longer push the conversation off the screen.
 */
const HISTORY_MIN = 120;
const COMPOSER_MAX = '60%';

/**
 * The screen belongs to the session it opened in. This gate holds no data and runs no query: while
 * that session is the signed-in one it shows the conversation, and once it is not (signed out, ended,
 * or another Account) it shows a redirect and the conversation below is unmounted, so a thread kept in
 * the navigation stack asks for nothing under the new credential and its draft, unconfirmed send and
 * Product context are discarded with it. Nothing depends on the server refusing the old conversation.
 */
export function ConversationScreen({ conversationRef, product = null }: { conversationRef: unknown; product?: ProductRef | null }) {
  const t = useT();
  const { session } = useSession();
  const current = session.status === 'signedIn' ? session.token : null;
  const owner = useRef(current);
  if (current === null || current !== owner.current) {
    return (
      <>
        {/* The body set the Seller's store name as the title, and unmounting it does not reset it. */}
        <Stack.Screen options={{ title: t('buyer.chat.title') }} />
        <Redirect href="/messages" />
      </>
    );
  }
  return <OwnedConversation conversationRef={conversationRef} product={product} />;
}

function OwnedConversation({ conversationRef, product }: { conversationRef: unknown; product: ProductRef | null }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const qc = useQueryClient();
  const focused = useIsFocused();
  const api = usePrivateApi();
  const ref = isConversationRef(conversationRef) ? conversationRef : null;
  const messages = useConversationMessages(ref, focused);
  const conversations = useConversations();
  const [draft, setDraft] = useState('');
  // failed: the server refused it; unknown: no answer (it may have been stored); sent: accepted.
  const [state, setState] = useState<SendStatus>('unsent');
  // Unknown, and the same key can no longer be sent again (a key conflict, or older than its safe age).
  const [keyLost, setKeyLost] = useState(false);
  // A wait the server or an intermediary asked for: sending and Ask the Seller stay off until it ends.
  const [hold, setHold] = useState<{ until: number; text: string } | null>(null);
  // A later wait never shortens an earlier one (Send and Ask the Seller can both be in flight).
  const holdFor = (ms: number, text: string) =>
    setHold((current) => {
      const until = Date.now() + ms;
      return current !== null && current.until >= until ? current : { until, text };
    });
  // The answer whose escalation is confirmed, or may be stored and could not be settled from the
  // conversation: Ask the Seller is not offered again for it in this view (the server does not
  // de-duplicate escalations; reopening the conversation reads the server's state afresh).
  const [passedOn, setPassedOn] = useState<{ id: string; confirmed: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ON-20261111-168 (WO-016): one NOT_FOUND covers the conversation and the Product; name neither.
  const [notFound, setNotFound] = useState<'anchored' | 'plain' | null>(null);
  const [asking, setAsking] = useState(false);
  // refused: the API answered no; unknown: no answer, so the question may have been passed on.
  const [askFailed, setAskFailed] = useState<'refused' | 'unknown' | false>(false);
  const sending = useRef(false);
  const askingRef = useRef(false);
  // The idempotency intent is the WHOLE payload: text and Product (or none). `attempts` counts the requests
  // sent under the key; `baseline` is what the history held before the first one (server values only).
  const sendIntent = useRef<{
    text: string;
    productId: string | null;
    key: string;
    startedAt: number;
    attempts: number;
    baseline: Baseline;
  } | null>(null);
  // An unconfirmed message the person chose to edit: kept (this screen only) so that its words can still be
  // recognised in the history while they are in the box again.
  const [watch, setWatch] = useState<{ text: string; aboutProduct: boolean; baseline: Baseline } | null>(null);
  // The next message's Product (lookup keys of a public read), and a refusal from the last check.
  const [context, setContext] = useState<ProductRef | null>(product);
  const [refusal, setRefusal] = useState<'gone' | 'mismatch' | 'unchecked' | null>(null);
  const [picking, setPicking] = useState(false);
  const [entered, setEntered] = useState(product);
  if (entered?.handle !== product?.handle || entered?.slug !== product?.slug) {
    setEntered(product);
    if (!sending.current && !(state === 'unknown' && sendIntent.current !== null)) {
      setContext(product);
      setRefusal(null);
    }
  }
  const contextRead = useQuery({
    queryKey: ['chat-context', context?.handle ?? '', context?.slug ?? ''],
    // A technical re-read (revalidate): opening the composer is not a Product view.
    queryFn: () => keepIfCurrent(api!, (a) => a.product(context!.handle, context!.slug, true)),
    enabled: api !== null && context !== null,
    staleTime: 0,
    gcTime: 0,
    retry: (failures, e) => isTransient(e) && failures < 2,
  });
  const askIntent = useRef<{ forMessage: string; key: string; startedAt: number; attempts: number } | null>(null);

  // Unknown and the same message can no longer be replayed (a key conflict, or past its safe age): the
  // app cannot confirm the outcome and offers no Try sending again, so its sentence does not promise one.
  const withdrawn =
    state === 'unknown' && sendIntent.current !== null && (keyLost || !keyUsable(sendIntent.current, Date.now()));
  // Rows of the history that could be the unconfirmed message (pending-match.ts). A hint for the person
  // and nothing more: a row carries no key, so the app never settles the send on it. Only the server's
  // own answer to the same key does.
  const pendingSend = sendIntent.current;
  const candidates =
    state === 'unknown' && pendingSend !== null
      ? candidatesFor({ text: pendingSend.text, aboutProduct: pendingSend.productId !== null, baseline: pendingSend.baseline }, messages.items)
      : state === 'unsent' && watch !== null && draft.trim() === watch.text
        ? candidatesFor(watch, messages.items)
        : [];
  const hint = candidates.length > 0 ? t('buyer.chat.appears_received') : null;
  useEffect(() => {
    if (hint !== null) AccessibilityInfo.announceForAccessibility(hint);
  }, [hint]);
  // The alert role alone is not spoken on Android: announce what happened to the message. The effect
  // runs when the sentence changes (not at every render, which `t` would cause), and when a key is
  // withdrawn at a press (the state does not change then).
  const announcement =
    state === 'sending'
      ? t('buyer.chat.sending')
      : state === 'unknown'
        ? t(withdrawn ? 'buyer.chat.cannot_confirm' : 'buyer.chat.maybe_not_sent')
        : state === 'failed'
          ? t(notFound === 'anchored' ? 'buyer.chat.not_found_anchored' : notFound === 'plain' ? 'buyer.chat.not_found_plain' : 'buyer.chat.not_sent')
          : null;
  useEffect(() => {
    if (announcement !== null) AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement, keyLost]);
  useEffect(() => {
    if (hold === null) return;
    AccessibilityInfo.announceForAccessibility(hold.text);
    // One timer, no countdown: the controls come back when the wait that was asked for is over.
    const timer = setTimeout(() => setHold(null), Math.max(hold.until - Date.now(), 0));
    return () => clearTimeout(timer);
  }, [hold]);
  const listed = conversations.items.some((c) => c.id === conversationRef);
  const { hasNextPage, isFetching, isError: listFailed, fetchNextPage } = conversations;
  const pagesRead = conversations.data?.pages.length ?? 0;
  // Bounded (WO-015): at most MAX_LIST_PAGES pages, and never again after a failure until Try again.
  const unavailable = messages.isError && problemCode(messages.error) === 'NOT_FOUND';
  const canWalk = ref !== null && !unavailable && !listed && hasNextPage && !listFailed && pagesRead < MAX_LIST_PAGES;
  // pagesRead re-runs it per page: a page's fetching flag can rise and fall within one render.
  useEffect(() => {
    if (canWalk && !isFetching) void fetchNextPage();
  }, [canWalk, isFetching, pagesRead, fetchNextPage]);

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

  const text = draft.trim();
  const tooLong = text.length > MESSAGE_MAX;
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
  };

  // This conversation's Seller, as far as the Buyer's own list can say.
  const seller: 'resolved' | 'resolving' | 'failed' | 'unresolved' =
    conversation !== undefined
      ? 'resolved'
      : listFailed
        ? 'failed'
        : conversations.isPending || canWalk
          ? 'resolving'
          : 'unresolved';
  // What the composer may say about its Product: shown only from a current read whose Seller is
  // this conversation's (never from route parameters, never after a refusal).
  const contextStatus: 'none' | 'checking' | 'ok' | 'gone' | 'mismatch' | 'unchecked' | 'unresolved' =
    context === null
      ? 'none'
      : refusal !== null
        ? refusal
        : contextRead.isError
          ? problemCode(contextRead.error) === 'NOT_FOUND'
            ? 'gone'
            : 'unchecked'
          : contextRead.data === undefined || seller === 'resolving'
            ? 'checking'
            : seller === 'failed'
              ? 'unchecked'
              : seller === 'unresolved' || conversation === undefined
                ? 'unresolved'
                : contextRead.data.seller.handle !== conversation.handle
                  ? 'mismatch'
                  : 'ok';
  // While the outcome of a send is unknown the payload is frozen: a retry must replay the same text,
  // Product and key. "Edit the message instead" gives up that intent explicitly.
  const unconfirmed = sendIntent.current;
  const frozen = state === 'unknown' && unconfirmed !== null;
  // The same message again, under the same key, only while the server can still tell it from a new one.
  const replayable = frozen && !keyLost && keyUsable(unconfirmed, Date.now());
  const abandon = () => {
    if (sending.current) return;
    // The words are in the box again: they stay recognisable in the history, beside Send.
    const given = sendIntent.current;
    if (given !== null) setWatch({ text: given.text, aboutProduct: given.productId !== null, baseline: given.baseline });
    sendIntent.current = null;
    setKeyLost(false);
    setState('unsent');
    setError(null);
    setNotFound(null);
  };
  // After the person has seen the message in the conversation: empties the box and ends the retry. It
  // sends nothing and claims nothing; the message in the list is the server's own.
  const discard = () => {
    if (sending.current) return;
    sendIntent.current = null;
    setWatch(null);
    setDraft('');
    setContext(null);
    setRefusal(null);
    setKeyLost(false);
    setState('unsent');
    setError(null);
    setNotFound(null);
  };
  const removeContext = () => {
    if (sending.current || (state === 'unknown' && sendIntent.current !== null)) return;
    setContext(null);
    setRefusal(null);
  };
  // A Product chosen in the picker: this conversation's Seller handle (from the list) and its slug.
  // Never while a send is in flight or unconfirmed: that payload is frozen.
  const choose = (slug: string) => {
    setPicking(false);
    if (!conversation || !isPathName(conversation.handle) || !isPathName(slug)) return;
    if (sending.current || (state === 'unknown' && sendIntent.current !== null)) return;
    setContext({ handle: conversation.handle, slug });
    setRefusal(null);
    void qc.invalidateQueries({ queryKey: ['chat-context', conversation.handle, slug] });
  };
  const canSelect =
    seller === 'resolved' && conversation !== undefined && isPathName(conversation.handle) && state !== 'sending' && !frozen;

  const send = async () => {
    if (!api || sending.current || hold !== null || text.length === 0 || tooLong) return;
    if (context !== null && contextStatus !== 'ok') return;
    // A refused check sends nothing: an unconfirmed earlier send stays unconfirmed, anything else is unsent.
    const previous = state === 'unknown' ? 'unknown' : 'unsent';
    if (previous === 'unknown' && sendIntent.current !== null && (keyLost || !keyUsable(sendIntent.current, Date.now()))) {
      // Too old to replay without risking a second message: send nothing, look at what the server holds.
      setKeyLost(true);
      void qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
      return;
    }
    sending.current = true;
    setState('sending');
    setError(null);
    setNotFound(null);
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
      if (previous === 'unknown' && sendIntent.current !== null && sendIntent.current.productId !== productId) {
        setRefusal('mismatch');
        setState('unknown');
        return;
      }
      // One key per payload: a retry of the same text and Product replays, never re-sends; a changed
      // text or Product is a new intent.
      if (sendIntent.current?.text !== text || sendIntent.current.productId !== productId) {
        sendIntent.current = {
          text,
          productId,
          key: newIdempotencyKey(),
          startedAt: Date.now(),
          attempts: 0,
          baseline: captureBaseline({ read: messages.data !== undefined, items: messages.items }),
        };
        setKeyLost(false);
        setWatch(null);
      }
      sendIntent.current.attempts += 1;
      const body = await api.sendMessage(ref, text, sendIntent.current.key, productId);
      // An acceptance without a readable message id may still have stored it: unknown.
      if (!acceptedMessage(body)) throw new ApiError({ kind: 'unexpected', status: 201 });
      sendIntent.current = null;
      if (!api.isCurrent()) return;
      setDraft('');
      // The Product described this message only: the next one starts without it.
      setContext(null);
      setRefusal(null);
      setKeyLost(false);
      setState('sent');
      await Promise.all([
        qc.invalidateQueries({ queryKey: [MESSAGES, ref] }),
        qc.invalidateQueries({ queryKey: [CONVERSATIONS] }),
      ]);
    } catch (failure) {
      // The API's own 4xx rejection ends this intent; anything else (offline, a timeout, a gateway
      // answer, any 5xx, a rate limit, an unreadable acceptance, a key conflict) keeps the key, which
      // replays if the message was stored and the key is still safe. The outcome is then unknown: say
      // so, and re-read. A wait that was asked for holds the next attempt.
      const verdict = judgeFailure(failure, sendIntent.current, Date.now());
      const answered = verdict.outcome === 'failed';
      if (answered) sendIntent.current = null;
      if (!api.isCurrent()) return;
      setKeyLost(!answered && !verdict.replay);
      const wait = verdict.holdMs === null ? null : fillSlots(t('common.wait'), { retry_after_seconds: Math.ceil(verdict.holdMs / 1000) });
      if (verdict.holdMs !== null && wait !== null) holdFor(verdict.holdMs, wait);
      if (problemCode(failure) === 'NOT_FOUND') {
        // Not "the Product was removed" and not "the conversation was deleted": a current read of
        // each decides that (a 404 there shows "no longer available" / "not available").
        setNotFound(context !== null ? 'anchored' : 'plain');
        setError(t(context !== null ? 'buyer.chat.not_found_anchored' : 'buyer.chat.not_found_plain'));
        if (context !== null) void contextRead.refetch();
        void qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
      } else {
        // While held, the wait sentence says it: not the same sentence twice.
        setError(wait !== null ? null : failureMessage(t, failure));
      }
      setState(answered ? 'failed' : 'unknown');
      if (verdict.outcome === 'unknown' || rereadAfter(failure)) void qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
    } finally {
      sending.current = false;
    }
  };

  const answer = escalatableAnswer(messages.items);
  const canAsk = answer !== null && answer.id !== passedOn?.id;
  // Ask the Seller is not offered again for this answer, and the history does not show why: say it here.
  const passed = answer !== null && passedOn !== null && answer.id === passedOn.id ? passedOn : null;
  // Read the conversation again; true when that read succeeded (the history is then the truth).
  const readHistory = async () => {
    await qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
    return qc.getQueryState([MESSAGES, ref])?.error === null;
  };
  const ask = async () => {
    if (!api || !answer || askingRef.current || hold !== null) return;
    askingRef.current = true;
    if (askIntent.current?.forMessage !== answer.id) askIntent.current = { forMessage: answer.id, key: newIdempotencyKey(), startedAt: Date.now(), attempts: 0 };
    setAsking(true);
    setAskFailed(false);
    try {
      if (!keyUsable(askIntent.current, Date.now())) {
        // Too old to replay: drop it and let the conversation say whether the question was passed on.
        // If it cannot be read, a new key could escalate twice: not offered again in this view.
        askIntent.current = null;
        if (api.isCurrent() && !(await readHistory())) setPassedOn({ id: answer.id, confirmed: false });
        return;
      }
      askIntent.current.attempts += 1;
      // Only the server's own confirmation counts; a 200 that does not say it is unconfirmed.
      if (!acceptedEscalation(await api.escalateConversation(ref, askIntent.current.key))) throw new ApiError({ kind: 'unexpected', status: 200 });
      askIntent.current = null;
      // Confirmed: remembered here, so a failed re-read cannot bring the control back for a second tap.
      setPassedOn({ id: answer.id, confirmed: true });
      if (api.isCurrent()) await qc.invalidateQueries({ queryKey: [MESSAGES, ref] });
    } catch (failure) {
      // Same rule as a message: the key is kept after an unconfirmed attempt, and ended by the API's
      // own 4xx rejection or when it can no longer be replayed. The conversation is read again either way.
      const verdict = judgeFailure(failure, askIntent.current, Date.now());
      if (verdict.outcome === 'failed' || !verdict.replay) askIntent.current = null;
      if (api.isCurrent()) {
        const wait = verdict.holdMs === null ? null : fillSlots(t('common.wait'), { retry_after_seconds: Math.ceil(verdict.holdMs / 1000) });
        if (verdict.holdMs !== null && wait !== null) holdFor(verdict.holdMs, wait);
        setAskFailed(verdict.outcome === 'failed' ? 'refused' : 'unknown');
        if (verdict.outcome === 'unknown' || rereadAfter(failure)) {
          const read = await readHistory();
          // Unconfirmed, the key cannot be replayed and the history cannot be read: not offered again here.
          if (!read && verdict.outcome === 'unknown' && !verdict.replay) setPassedOn({ id: answer.id, confirmed: false });
        }
      }
    } finally {
      askingRef.current = false;
      setAsking(false);
    }
  };

  const list =
    messages.items.length > 0 ? (
      <FlatList
        inverted
        data={messages.items}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} viewer="buyer" />}
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
          <View style={{ gap: theme.space.sm }}>
            <AlertText>{t('buyer.chat.failed')}</AlertText>
            <AppText style={secondary}>{failureMessage(t, messages.error)}</AppText>
            <Button label={t('common.retry')} onPress={() => void messages.refetch()} />
          </View>
        ) : (
          <AppText style={secondary}>
            {t(messages.fetchStatus === 'paused' && messages.data === undefined ? 'common.offline' : messages.isPending ? 'common.loading' : 'buyer.chat.empty')}
          </AppText>
        )}
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      {header}
      <View style={{ paddingHorizontal: theme.space.lg, paddingTop: theme.space.sm }}>
        <Button label={t('buyer.chat.refresh')} variant="secondary" onPress={refresh} disabled={messages.isFetching} />
      </View>
      <View style={{ flex: 1, minHeight: HISTORY_MIN }}>{list}</View>
      <View style={{ maxHeight: COMPOSER_MAX, borderTopWidth: 1, borderColor: theme.color.border }}>
      <ScrollView
        testID="chat-composer"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: theme.space.lg, paddingBottom: theme.space.sm, gap: theme.space.sm }}
      >
        {canAsk ? (
          <View style={{ gap: theme.space.xs }}>
            <AppText style={secondary}>{t('buyer.chat.ask_seller_hint')}</AppText>
            <Button label={t('buyer.chat.ask_seller')} variant="secondary" onPress={() => void ask()} disabled={asking || hold !== null} />
            {askFailed ? <AlertText>{t(askFailed === 'refused' ? 'buyer.chat.ask_failed' : 'buyer.chat.ask_unconfirmed')}</AlertText> : null}
          </View>
        ) : passed ? (
          passed.confirmed ? (
            <StatusText style={secondary}>{t('buyer.chat.ask_passed_on')}</StatusText>
          ) : (
            <AlertText>{t('buyer.chat.ask_unconfirmed')}</AlertText>
          )
        ) : null}
        <View style={{ gap: theme.space.xs }}>
          <Button
            label={t(context === null ? 'buyer.chat.select_product' : 'buyer.chat.change_product')}
            variant="secondary"
            onPress={() => setPicking(canSelect)}
            disabled={!canSelect}
          />
          {seller === 'unresolved' || seller === 'failed' ? (
            <AppText style={secondary}>{t('buyer.chat.select_unavailable')}</AppText>
          ) : null}
          {seller === 'failed' ? (
            <Button label={t('common.retry')} variant="secondary" onPress={() => void conversations.refetch()} />
          ) : null}
        </View>
        {picking && canSelect && conversation ? (
          <ProductPicker handle={conversation.handle} store={conversation.storeName} onSelect={choose} onCancel={() => setPicking(false)} />
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
              if (listFailed) void conversations.refetch();
            }}
          />
        ) : null}
        <TextField
          label={t('buyer.chat.composer')}
          value={draft}
          onChangeText={(value) => {
            setDraft(value);
            if (state === 'failed' || state === 'sent') setState('unsent');
          }}
          multiline
          editable={state !== 'sending' && !frozen}
          error={tooLong ? (fillSlots(t('buyer.chat.too_long'), { max: MESSAGE_MAX.toLocaleString(locale) }) ?? null) : null}
        />
        {state === 'sending' ? <AppText style={secondary}>{t('buyer.chat.sending')}</AppText> : null}
        {state === 'failed' && notFound !== null ? (
          <View accessibilityRole="alert">
            <AppText>{error}</AppText>
          </View>
        ) : state === 'failed' || state === 'unknown' ? (
          <View accessibilityRole="alert">
            <AppText>{t(state === 'failed' ? 'buyer.chat.not_sent' : withdrawn ? 'buyer.chat.cannot_confirm' : 'buyer.chat.maybe_not_sent')}</AppText>
            {hint !== null && state === 'unknown' ? <AppText>{hint}</AppText> : null}
            {error ? <AppText style={secondary}>{error}</AppText> : null}
          </View>
        ) : null}
        {/* The same words are in the box again (after Edit the message instead): the hint stays above Send, which it never blocks. */}
        {hint !== null && state === 'unsent' ? <AppText>{hint}</AppText> : null}
        {hold !== null ? (
          <View accessibilityRole="alert">
            <AppText>{hold.text}</AppText>
          </View>
        ) : null}
        <AppText style={secondary}>{t('buyer.chat.connected_only')}</AppText>
      </ScrollView>
      <View style={{ paddingHorizontal: theme.space.lg, paddingBottom: theme.space.lg, paddingTop: theme.space.xs, gap: theme.space.sm }}>
        {/* Unconfirmed: the same message again (same text, Product and key), never a new one; withdrawn when the key can no longer be replayed. */}
        {frozen && !replayable ? null : (
          <Button
            label={t(frozen ? 'buyer.chat.retry_send' : 'buyer.chat.send')}
            onPress={() => void send()}
            disabled={state === 'sending' || hold !== null || text.length === 0 || tooLong || (context !== null && contextStatus !== 'ok')}
          />
        )}
        {/* Only once the replay is withdrawn and the message appears: then the person, not the app, decides it is done. */}
        {withdrawn && hint !== null ? <Button label={t('buyer.chat.discard_unconfirmed')} variant="secondary" onPress={discard} /> : null}
        {frozen ? <Button label={t('buyer.chat.edit_unconfirmed')} variant="secondary" onPress={abandon} /> : null}
      </View>
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
  status: 'checking' | 'ok' | 'gone' | 'mismatch' | 'unchecked' | 'unresolved' | 'none';
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
          : status === 'unresolved'
            ? 'buyer.chat.context_unresolved'
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
        <AlertText>{t(refusal)}</AlertText>
      ) : null}
      {status === 'unchecked' ? (
        // Checking again never changes the payload, so it stays available while a send is unconfirmed.
        <Button label={t('common.retry')} variant="secondary" onPress={onRetry} disabled={status !== 'unchecked'} />
      ) : null}
      <Button label={t('buyer.chat.context_remove')} variant="secondary" onPress={onRemove} disabled={locked} />
    </View>
  );
}
