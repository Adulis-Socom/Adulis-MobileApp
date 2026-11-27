import { Stack } from 'expo-router';

import { theme } from '../../ui/theme';

// The Buyer stack anchors on the tabs, so a link into a detail screen still has Home beneath it. Every screen pushed over the tabs
// shows a header with a visible, labelled Back control (no gesture is the only way back); the tabs themselves have none.
export const unstable_settings = { anchor: '(tabs)' };

export default function BuyerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: '',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.color.bg },
        headerTintColor: theme.color.text,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
