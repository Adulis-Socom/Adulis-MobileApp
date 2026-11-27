// The governing tabs: Home | Shop | Saved | Orders | You. Labels come from the catalogue; the tab bar is the navigation a screen
// reader walks, so every tab has a name and a role.
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { t } from '../../../i18n/messages';
import { theme } from '../../../ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;
// The tab bar colours come from our own tokens, so they are always strings; anything else falls back to the icon default.
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={typeof color === 'string' ? color : undefined} size={size} />;
  };

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.color.text, tabBarInactiveTintColor: theme.color.textMuted, tabBarStyle: { backgroundColor: theme.color.surface, borderTopColor: theme.color.border } }}>
      <Tabs.Screen name="home" options={{ title: t('mobile.tab.home'), tabBarIcon: icon('home-outline') }} />
      <Tabs.Screen name="shop" options={{ title: t('mobile.tab.shop'), tabBarIcon: icon('bag-outline') }} />
      <Tabs.Screen name="saved" options={{ title: t('mobile.tab.saved'), tabBarIcon: icon('bookmark-outline') }} />
      <Tabs.Screen name="orders" options={{ title: t('mobile.tab.orders'), tabBarIcon: icon('receipt-outline') }} />
      <Tabs.Screen name="account" options={{ title: t('mobile.tab.account'), tabBarIcon: icon('person-outline') }} />
    </Tabs>
  );
}
