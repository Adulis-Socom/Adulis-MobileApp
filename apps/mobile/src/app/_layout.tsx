import { Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { Loading } from '../components/Loading';
import { AppProviders } from '../providers/AppProviders';
import { navigationTheme, useTheme } from '../theme/theme';

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ErrorState retry={retry} />;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootStack />
    </AppProviders>
  );
}

function RootStack() {
  const theme = useTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);
  const { session } = useSession();
  if (session.status === 'restoring') return <Loading />;
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}
      />
    </ThemeProvider>
  );
}
