import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useRef, type ComponentProps } from 'react';
import { Pressable, ScrollView, View, type ScrollViewInstance } from 'react-native';

import { useBootstrap } from '../api/bootstrap';
import { AppText } from '../components/AppText';
import { useUiStore } from '../state/ui-store';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { CHANNELS } from './channels';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * Buyer Home's header, rendered as the channel navigator's tab bar: the Adulis wordmark,
 * the Search and Notifications entries, and the channel tablist (ADU-MOB-02 v4.3 S11).
 * The selected channel is marked by weight and an underline as well as colour, and the
 * bar scrolls sideways so all five channels fit any phone width at any text size.
 */
export function HomeHeader({ state, emitter, navigateToTab, insets }: TabBarProps) {
  const theme = useTheme();
  const t = useT();
  const router = useRouter();
  const bar = useRef<ScrollViewInstance>(null);
  const offsets = useRef<number[]>([]);
  const selected = state.routes[state.index]?.name;
  const recommended = useBootstrap().data?.client_status === 'UPGRADE_RECOMMENDED';
  const noticeDismissed = useUiStore((s) => s.upgradeNoticeDismissed);
  const dismissNotice = useUiStore((s) => s.dismissUpgradeNotice);

  // Keep the selected channel in view (a deep link to Locally Made on a narrow phone): when
  // the selection changes, and when the selected channel is first laid out, because on a
  // deep link the selection arrives before any layout does. Not animated: nothing is gained
  // by motion here, and it respects reduced-motion settings.
  const reveal = (x: number | undefined) => {
    if (x !== undefined) bar.current?.scrollTo({ x: Math.max(0, x - theme.space.lg), animated: false });
  };
  useEffect(() => {
    reveal(offsets.current[CHANNELS.findIndex((c) => c.name === selected)]);
  }, [selected]);

  const iconButton = (label: string, icon: ComponentProps<typeof Ionicons>['name'], href: '/search' | '/notifications') => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      hitSlop={theme.space.xs}
      style={{ minWidth: theme.touchTarget, minHeight: theme.touchTarget, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={theme.fontSize.xl} color={theme.color.text} importantForAccessibility="no" accessibilityElementsHidden />
    </Pressable>
  );

  return (
    <View style={{ paddingTop: insets.top, backgroundColor: theme.color.surface, borderBottomWidth: 1, borderBottomColor: theme.color.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: theme.space.lg, paddingRight: theme.space.sm }}>
        <AppText variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {t('buyer.wordmark')}
        </AppText>
        {iconButton(t('buyer.search'), 'search-outline', '/search')}
        {iconButton(t('buyer.notifications'), 'notifications-outline', '/notifications')}
      </View>
      {/* UPGRADE_RECOMMENDED (ADU-MOB-02 v4.3 S85): dismissible, never blocking. */}
      {recommended && !noticeDismissed ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.space.sm,
            marginHorizontal: theme.space.lg,
            marginBottom: theme.space.sm,
            padding: theme.space.sm,
            borderRadius: theme.radius.md,
            borderWidth: 1,
            borderColor: theme.color.infoBorder,
            backgroundColor: theme.color.infoBg,
          }}
        >
          <AppText style={{ flex: 1 }}>{t('app.upgrade.recommended')}</AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('app.upgrade.dismiss')}
            onPress={dismissNotice}
            style={{ minWidth: theme.touchTarget, minHeight: theme.touchTarget, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={theme.fontSize.xl} color={theme.color.text} importantForAccessibility="no" accessibilityElementsHidden />
          </Pressable>
        </View>
      ) : null}
      {/* The tablist is a plain container, not one accessibility element, so each channel
          stays individually focusable for TalkBack and VoiceOver. */}
      <View accessibilityRole="tablist" accessibilityLabel={t('buyer.home.channels')}>
      <ScrollView
        ref={bar}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: theme.space.sm }}
      >
        {CHANNELS.map((channel, index) => {
          const route = state.routes.find((r) => r.name === channel.name);
          const focused = channel.name === selected;
          return (
            <Pressable
              key={channel.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(channel.label)}
              onLayout={(event) => {
                offsets.current[index] = event.nativeEvent.layout.x;
                if (focused) reveal(event.nativeEvent.layout.x);
              }}
              onPress={() => {
                if (!route) return;
                // The stock tab bar's contract: listeners may prevent the switch.
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigateToTab(route.key);
              }}
              style={{
                minHeight: theme.touchTarget,
                justifyContent: 'center',
                paddingHorizontal: theme.space.md,
                borderBottomWidth: 2,
                borderBottomColor: focused ? theme.color.accent : 'transparent',
              }}
            >
              <AppText
                style={{
                  color: focused ? theme.color.text : theme.color.textSecondary,
                  fontWeight: focused ? theme.fontWeight.semibold : theme.fontWeight.regular,
                }}
              >
                {t(channel.label)}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
      </View>
    </View>
  );
}
