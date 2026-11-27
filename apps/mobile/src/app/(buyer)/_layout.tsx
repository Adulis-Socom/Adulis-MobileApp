import { Stack } from 'expo-router';

// The Buyer stack anchors on the tabs, so a link into a detail screen still has Home beneath it.
export const unstable_settings = { anchor: '(tabs)' };

export default function BuyerLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
