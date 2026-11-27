// Home: five channels in a fixed order, For You first. A channel the server says is not available (and the three whose product
// rules are still open: Nearby, Discounts, Locally Made) shows an honest state and requests nothing: no location permission, no
// discount arithmetic, no membership guess. Following is for signed-in people; a guest sees sign-in and no request is made.
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ChannelKey, ChannelState } from '../../../contracts/gap-mob-discovery';
import { SceneFeed } from '../../../discovery/SceneFeed';
import { useRead } from '../../../discovery/hooks';
import { t, type UiMessageKey } from '../../../i18n/messages';
import { useApp } from '../../../providers/AppProvider';
import { AppNotices } from '../../../ui/AppNotices';
import { Button, Heading, Screen, StateView } from '../../../ui/components';
import { theme } from '../../../ui/theme';

const ORDER: readonly ChannelKey[] = ['FOR_YOU', 'FOLLOWING', 'NEARBY', 'DISCOUNTS', 'LOCALLY_MADE'];
const LABEL: Record<ChannelKey, UiMessageKey> = {
  FOR_YOU: 'mobile.home.channel.for_you',
  FOLLOWING: 'mobile.home.channel.following',
  NEARBY: 'mobile.home.channel.nearby',
  DISCOUNTS: 'mobile.home.channel.discounts',
  LOCALLY_MADE: 'mobile.home.channel.locally_made',
};

export default function Home() {
  const router = useRouter();
  const { session } = useApp();
  const [active, setActive] = useState<ChannelKey>('FOR_YOU');
  const channels = useRead('home.channels.get', {}, { scope: 'subject' });

  // Until the server has answered, only For You is shown as available; the others say loading, not "no".
  const stateOf = (key: ChannelKey): ChannelState | 'LOADING' => {
    const answer = channels.data?.channels.find((channel) => channel.key === key);
    if (answer) return answer.state;
    return key === 'FOR_YOU' ? 'AVAILABLE' : channels.status === 'error' ? 'NOT_AVAILABLE' : 'LOADING';
  };

  let content: ReactNode;
  const state = stateOf(active);
  if (active === 'FOLLOWING' && session.kind !== 'AUTHENTICATED') {
    content = session.kind === 'GUEST' ? <StateView kind="unauthorized" message={t('error.auth.authentication_required')} action={{ label: t('mobile.auth.sign_in'), onPress: () => router.push('/auth/sign-in') }} /> : <StateView kind="loading" />;
  } else if (state === 'LOADING') content = <StateView kind="loading" />;
  else if (state === 'SIGN_IN_REQUIRED') content = <StateView kind="unauthorized" message={t('error.auth.authentication_required')} action={{ label: t('mobile.auth.sign_in'), onPress: () => router.push('/auth/sign-in') }} />;
  else if (state === 'NOT_AVAILABLE') content = <StateView kind="empty" message={t('mobile.home.channel_unavailable')} />;
  else if (active === 'FOR_YOU') content = <SceneFeed op="feed.forYou.page" />;
  else if (active === 'FOLLOWING') content = <SceneFeed op="feed.following.page" empty={t('mobile.home.following_empty')} />;
  else content = <StateView kind="empty" message={t('mobile.home.channel_unavailable')} />;

  return (
    <Screen>
      <AppNotices />
      <View style={styles.header}>
        <Heading>{t('mobile.home.title')}</Heading>
        <Button kind="secondary" label={t('mobile.home.search')} onPress={() => router.push('/search')} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={styles.tabs} style={styles.tabScroll}>
        {ORDER.map((key) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityLabel={t(LABEL[key])} accessibilityState={{ selected: active === key }} onPress={() => setActive(key)} style={[styles.tab, active === key && styles.tabActive]}>
            <Text style={[styles.tabText, active === key && styles.tabTextActive]}>{t(LABEL[key])}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.content}>{content}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.md },
  tabScroll: { flexGrow: 0 },
  tabs: { gap: theme.space.sm },
  tab: { minHeight: theme.touch, paddingHorizontal: theme.space.md, justifyContent: 'center', borderRadius: theme.radius.full, backgroundColor: theme.color.secondary, borderWidth: 1, borderColor: theme.color.borderStrong },
  tabActive: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  tabText: { ...theme.text.body, color: theme.color.secondaryText },
  tabTextActive: { color: theme.color.primaryText, fontWeight: '600' },
  content: { flex: 1 },
});
