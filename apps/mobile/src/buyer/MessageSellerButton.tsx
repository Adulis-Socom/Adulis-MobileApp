import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { newIdempotencyKey, problemCode, wasAnswered } from '../api/client';
import { failureMessage } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { CONVERSATIONS, conversationIdOf } from './chat';
import { usePrivateApi } from './saved';

/**
 * Message Seller (WO-013; ADU-MOB-02 R-09) on the Seller Profile. The Seller is the one the public
 * profile read named by its `seller_id` (never a handle or a name). POST /v1/conversations creates
 * or returns the one conversation for this Buyer, Seller and Market, under one idempotency key per
 * intent; a guest is sent to sign in first.
 */
export function MessageSellerButton({ sellerId }: { sellerId: string }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const api = usePrivateApi();
  const opening = useRef(false);
  const intent = useRef<{ seller: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    if (!api) {
      router.push({ pathname: '/auth/sign-in', params: { returnTo: '/messages' } });
      return;
    }
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError(null);
    if (intent.current?.seller !== sellerId) intent.current = { seller: sellerId, key: newIdempotencyKey() };
    try {
      const id = conversationIdOf(await api.openConversation(sellerId, intent.current.key));
      intent.current = null;
      if (!api.isCurrent()) return;
      void qc.invalidateQueries({ queryKey: [CONVERSATIONS] });
      router.push({ pathname: '/chat/[conversationRef]', params: { conversationRef: id } });
    } catch (failure) {
      if (wasAnswered(failure)) intent.current = null;
      if (api.isCurrent()) setError(problemCode(failure) === 'NOT_FOUND' ? t('buyer.chat.open_failed') : failureMessage(t, failure));
    } finally {
      opening.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: theme.space.xs, marginVertical: theme.space.xs }}>
      <Button label={t('buyer.chat.message_seller')} onPress={() => void open()} disabled={busy} />
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    </View>
  );
}
