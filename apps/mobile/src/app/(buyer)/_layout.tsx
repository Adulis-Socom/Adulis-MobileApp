import { Stack } from 'expo-router';

import { useT } from '../../i18n/i18n';
import { useModeActivation } from '../../modes/ModeLayout';

// The tabs always sit under Search and Notifications, also when a link opens one of them
// cold: Back then returns to Home instead of leaving the app (ADU-MOB-02 v4.3 S55).
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Buyer mode (ADU-MOB-02 v4.3 S11, S13): the five tabs, with screens that open over them
 * (Search, Notifications, sign-in, Explore the Scene, Product, Seller; later Checkout). Sign-in sits
 * here so finishing it pops straight back to the tab that asked for it. The group adds nothing to
 * URLs: /home/for-you, /shop, /search. Buyer is every Account's base mode, so there is no
 * availability redirect here.
 */
export default function BuyerLayout() {
  useModeActivation('buyer');
  const t = useT();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search" options={{ headerShown: true, title: t('buyer.search') }} />
      <Stack.Screen
        name="notifications"
        options={{ headerShown: true, title: t('buyer.notifications') }}
      />
      {/* One screen per Scene or Product: a double tap cannot stack the same one twice. */}
      <Stack.Screen
        name="scenes/[scenePostRef]"
        options={{ headerShown: true, title: t('buyer.scene.explore') }}
        dangerouslySingular={(_name, params) => String(params.scenePostRef)}
      />
      <Stack.Screen
        name="product/[handle]/[slug]"
        options={{ headerShown: true, title: t('buyer.product.title') }}
        dangerouslySingular={(_name, params) => `${String(params.handle)}/${String(params.slug)}`}
      />
      <Stack.Screen
        name="sellers/[handle]"
        options={{ headerShown: true, title: t('buyer.seller.title') }}
        dangerouslySingular={(_name, params) => String(params.handle)}
      />
      <Stack.Screen name="auth/sign-in" options={{ headerShown: true, title: t('auth.sign_in') }} />
      <Stack.Screen name="auth/verify" options={{ headerShown: true, title: t('auth.verify.title') }} />
    </Stack>
  );
}
