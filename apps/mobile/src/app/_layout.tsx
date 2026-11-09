import { Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef } from 'react';

import { useBootstrap } from '../api/bootstrap';
import { useSession } from '../auth/session';
import { ErrorState } from '../components/ErrorState';
import { Loading } from '../components/Loading';
import { UpgradeRequired } from '../components/UpgradeRequired';
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

/**
 * Startup (WO-003): restore the stored credential, register the install, bootstrap.
 *
 * The app waits only for the FIRST bootstrap attempt, which the API client bounds with its
 * timeout. A retry, an offline pause or a failure never holds the app: offline, the shell
 * still opens (signed in if a credential is stored - offline is not unauthenticated), and
 * the version verdict arrives when the network does. UPGRADE_REQUIRED replaces the entire
 * navigator, so nothing renders behind it.
 */
function RootStack() {
  const theme = useTheme();
  const navTheme = useMemo(() => navigationTheme(theme), [theme]);
  const { session } = useSession();
  const boot = useBootstrap();

  // Startup only: once the first attempt has settled, a later bootstrap (sign-in, sign-out,
  // refresh) never unmounts the navigator, so nobody loses their place.
  const startedUp = useRef(false);
  const waiting =
    session.status === 'restoring' ||
    (boot.data === undefined && boot.fetchStatus === 'fetching' && boot.failureCount === 0);
  if (!waiting) startedUp.current = true;
  if (waiting && !startedUp.current) return <Loading />;

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      {boot.data?.client_status === 'UPGRADE_REQUIRED' ? (
        <UpgradeRequired onCheckAgain={() => void boot.refetch()} checking={boot.isFetching} />
      ) : (
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.bg } }}
        />
      )}
    </ThemeProvider>
  );
}
