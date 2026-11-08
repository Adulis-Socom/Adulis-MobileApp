import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { AppState } from 'react-native';

// Queries pause while offline and resume on reconnect, instead of burning retries. The
// listener only reports changes, so the starting state is read once (a cold start in
// airplane mode would otherwise count as online); if that read fails, change events still apply.
onlineManager.setEventListener((setOnline) => {
  const subscription = addNetworkStateListener((state) => setOnline(Boolean(state.isConnected)));
  void getNetworkStateAsync().then(
    (state) => setOnline(Boolean(state.isConnected)),
    () => undefined,
  );
  return () => subscription.remove();
});

// "Window focus" on a phone is the app returning to the foreground.
focusManager.setEventListener((setFocused) => {
  const subscription = AppState.addEventListener('change', (status) =>
    setFocused(status === 'active'),
  );
  return () => subscription.remove();
});

/**
 * Server state lives here and only here (WO-001 S15). Render errors are caught by the
 * route's Expo Router ErrorBoundary; query errors stay in query state (`throwOnError`
 * off) for the screen to render.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Metered data on low-end Android: reuse what was just fetched, retry twice at most.
        staleTime: 30_000,
        retry: 2,
      },
      // Mutations keep TanStack's default of no retry: replaying a state-changing request
      // needs an idempotency key, which each feature work order decides.
    },
  });
}
