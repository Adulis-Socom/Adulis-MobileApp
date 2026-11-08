import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useSession } from '../auth/session';
import { Loading } from '../components/Loading';
import { AppProviders } from '../providers/AppProviders';
import { useTheme } from '../theme/theme';

export { ErrorBoundary } from 'expo-router';

export default function RootLayout() {
  return (
    <AppProviders>
      <RootStack />
    </AppProviders>
  );
}

function RootStack() {
  const theme = useTheme();
  const { session } = useSession();
  if (session.status === 'restoring') return <Loading />;
  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}
      />
    </>
  );
}
