import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { ApiError, newIdempotencyKey, problemCode, wasAnswered } from '../api/client';
import { failureMessage } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { CONVERSATIONS, conversationIdOf, isConversationRef } from './chat';
import { usePrivateApi } from './saved';

/** The Product a message will be about: its public handle and slug, the lookup keys of a public read. */
export type ProductRef = { handle: string; slug: string };

/**
 * Message Seller (WO-013; ADU-MOB-02 R-09) on the Seller Profile, and Ask Seller About This Product
 * (WO-014; R-07) on Product Detail. Either way it opens the ONE conversation for this Buyer, Seller
 * and Market (POST /v1/conversations, create-or-return, one idempotency key per intent).
 *
 * - From the Seller Profile the Seller is the profile read's `seller_id`.
 * - From a Product, whose read names the Seller only by its public handle, the Seller is resolved
 *   through the public storefront read by that handle (a technical re-read, not a profile view), and
 *   used only if that read answered for the same handle with a well-formed id. The handle is never
 *   used as an id. The conversation then opens with the Product as the composer's next-message
 *   context, passed as its public handle and slug only: the conversation screen reads the Product
 *   itself.
 * - A guest is sent to sign in, returning to where it started; nothing is created for a guest, and
 *   nothing is sent after sign-in.
 */
export function MessageSellerButton(props: { sellerId: string } | { product: ProductRef }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const api = usePrivateApi();
  const opening = useRef(false);
  const intent = useRef<{ seller: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const product = 'product' in props ? props.product : null;
  const profileSeller = 'sellerId' in props ? props.sellerId : null;

  const open = async () => {
    if (!api) {
      const returnTo = product ? (`/product/${product.handle}/${product.slug}` as const) : '/messages';
      router.push({ pathname: '/auth/sign-in', params: { returnTo } });
      return;
    }
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError(null);
    try {
      let sellerId = profileSeller ?? '';
      if (product) {
        const seller = await api.storefront(product.handle, true);
        // The public read must be the Product's Seller (same handle) and name a real id.
        if (seller.handle !== product.handle || !isConversationRef(seller.seller_id)) {
          throw new ApiError({ kind: 'unexpected', status: 200 });
        }
        sellerId = seller.seller_id;
      }
      if (intent.current?.seller !== sellerId) intent.current = { seller: sellerId, key: newIdempotencyKey() };
      const id = conversationIdOf(await api.openConversation(sellerId, intent.current.key));
      intent.current = null;
      if (!api.isCurrent()) return;
      void qc.invalidateQueries({ queryKey: [CONVERSATIONS] });
      router.push({
        pathname: '/chat/[conversationRef]',
        params: product ? { conversationRef: id, productHandle: product.handle, productSlug: product.slug } : { conversationRef: id },
      });
    } catch (failure) {
      if (wasAnswered(failure)) intent.current = null;
      if (api.isCurrent()) {
        const unexpected = failure instanceof ApiError && failure.failure.kind === 'unexpected';
        setError(problemCode(failure) === 'NOT_FOUND' || unexpected ? t('buyer.chat.open_failed') : failureMessage(t, failure));
      }
    } finally {
      opening.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: theme.space.xs, marginVertical: theme.space.xs }}>
      <Button
        label={t(product ? 'buyer.chat.ask_about_product' : 'buyer.chat.message_seller')}
        variant={product ? 'secondary' : 'primary'}
        onPress={() => void open()}
        disabled={busy}
      />
      {error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
    </View>
  );
}
