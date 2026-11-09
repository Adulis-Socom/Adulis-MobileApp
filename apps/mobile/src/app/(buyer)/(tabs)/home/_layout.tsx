import { Tabs } from 'expo-router';

import { CHANNELS, DEFAULT_CHANNEL } from '../../../../buyer/channels';
import { HomeHeader } from '../../../../buyer/HomeHeader';

// For You is the default channel, including when the Home tab is opened as /home, and it
// sits under a channel a link opens directly.
export const unstable_settings = { anchor: DEFAULT_CHANNEL };

/**
 * Home's channels as a navigator of their own, drawn at the top by HomeHeader: each
 * channel is a deep-linkable route (/home/nearby) and keeps its state while another is
 * shown; Back from another channel returns to For You. Screens mount on first visit only.
 */
export default function HomeLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      tabBar={(props) => <HomeHeader {...props} />}
      screenOptions={{ headerShown: false, tabBarPosition: 'top', lazy: true }}
    >
      {CHANNELS.map((channel) => (
        <Tabs.Screen key={channel.name} name={channel.name} />
      ))}
    </Tabs>
  );
}
