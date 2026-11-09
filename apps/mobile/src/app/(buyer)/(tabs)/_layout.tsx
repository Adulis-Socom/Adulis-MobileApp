import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useT } from '../../../i18n/i18n';
import { useTheme, type Theme } from '../../../theme/theme';

// Home is the tab under anything a link opens cold (Search, Notifications), so Back lands there.
export const unstable_settings = { anchor: 'home' };

type IconName = ComponentProps<typeof Ionicons>['name'];

// Filled when selected, outlined otherwise: the state is carried by shape, not colour alone.
function tabIcon(theme: Theme, selected: IconName, idle: IconName) {
  return ({ focused, size }: { focused: boolean; size: number }) => (
    <Ionicons
      name={focused ? selected : idle}
      color={focused ? theme.color.accent : theme.color.textSecondary}
      size={size}
    />
  );
}

/**
 * Buyer bottom navigation, exactly Home | Shop | Saved | Orders | You (ADU-MOB-02 v4.3 S11).
 * Each tab's accessibility label is its catalogue name: the navigator's default appends
 * English ("tab, 1 of 5") that a screen reader would speak in every language.
 * No Seller Companion or Courier entry ever appears here (S12). Back from any tab returns
 * to Home, then leaves the app; each tab keeps its own state while another is open.
 */
export default function BuyerTabs() {
  const theme = useTheme();
  const t = useT();
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.textSecondary,
        tabBarStyle: { backgroundColor: theme.color.surface, borderTopColor: theme.color.border },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t('buyer.tab.home'), tabBarAccessibilityLabel: t('buyer.tab.home'), tabBarIcon: tabIcon(theme, 'home', 'home-outline') }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: t('buyer.tab.shop'), tabBarAccessibilityLabel: t('buyer.tab.shop'), tabBarIcon: tabIcon(theme, 'storefront', 'storefront-outline') }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: t('buyer.tab.saved'), tabBarAccessibilityLabel: t('buyer.tab.saved'), tabBarIcon: tabIcon(theme, 'heart', 'heart-outline') }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: t('buyer.tab.orders'), tabBarAccessibilityLabel: t('buyer.tab.orders'), tabBarIcon: tabIcon(theme, 'receipt', 'receipt-outline') }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: t('buyer.tab.you'), tabBarAccessibilityLabel: t('buyer.tab.you'), tabBarIcon: tabIcon(theme, 'person', 'person-outline') }}
      />
    </Tabs>
  );
}
