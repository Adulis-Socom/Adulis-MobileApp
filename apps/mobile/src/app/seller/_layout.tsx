import { Stack } from 'expo-router';

import { useT } from '../../i18n/i18n';
import { SellerGate } from '../../seller/SellerGate';
import { SellerProvider } from '../../seller/seller-context';

/**
 * Seller mode (WO-020): behind the server-derived gate, one active-store context (the gate unmounts it
 * when the session ends, so another Account starts with none), and a stack for Home, notifications,
 * messages (WO-021) and Orders.
 */
export default function SellerLayout() {
  const t = useT();
  return (
    <SellerGate>
      <SellerProvider>
        <Stack screenOptions={{ headerShown: true }}>
          <Stack.Screen name="index" options={{ title: t('seller.title') }} />
          <Stack.Screen name="notifications" options={{ title: t('seller.notifications.title') }} />
          <Stack.Screen name="messages/index" options={{ title: t('seller.messages.title') }} />
          <Stack.Screen name="messages/[conversationId]" options={{ title: t('seller.messages.conversation') }} />
          <Stack.Screen name="orders/index" options={{ title: t('seller.orders.title') }} />
          <Stack.Screen name="orders/[orderId]" options={{ title: t('seller.order.title') }} />
        </Stack>
      </SellerProvider>
    </SellerGate>
  );
}
