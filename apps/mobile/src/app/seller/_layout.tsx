import { Stack } from 'expo-router';

import { useSession } from '../../auth/session';
import { useT } from '../../i18n/i18n';
import { SellerGate } from '../../seller/SellerGate';
import { SellerProvider } from '../../seller/seller-context';

/**
 * Seller mode (WO-020): behind the server-derived gate, one active-store context per session (a
 * different Account starts with no store), and a stack for Home, notifications and Orders.
 */
export default function SellerLayout() {
  const t = useT();
  const { session } = useSession();
  return (
    <SellerGate>
      <SellerProvider key={session.status === 'signedIn' ? session.token : 'signed-out'}>
        <Stack screenOptions={{ headerShown: true }}>
          <Stack.Screen name="index" options={{ title: t('seller.title') }} />
          <Stack.Screen name="notifications" options={{ title: t('seller.notifications.title') }} />
          <Stack.Screen name="orders/index" options={{ title: t('seller.orders.title') }} />
          <Stack.Screen name="orders/[orderId]" options={{ title: t('seller.order.title') }} />
        </Stack>
      </SellerProvider>
    </SellerGate>
  );
}
