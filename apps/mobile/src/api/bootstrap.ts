import { useQuery } from '@tanstack/react-query';

import { useSession } from '../auth/session';
import { isTransient, type AccountContext } from './client';

/** Guest and signed-in bootstraps are different answers, so they are different cache entries. */
export const bootstrapKey = (signedIn: boolean) => ['bootstrap', signedIn ? 'account' : 'guest'] as const;

/**
 * GET /v1/bootstrap (ADU-MOB-02 v4.3 S84): server time, market, locales, feature flags,
 * the client-version verdict and, for a signed-in Buyer, account_context. Server state, so
 * it lives in TanStack Query and nowhere else.
 *
 * The install registers itself first (POST /v1/devices, once), because bootstrap places a
 * REGISTERED device in its market and sign-in needs that market. Sent with the bearer when
 * signed in, bootstrap is also the session check: a dead credential answers 401 and the API
 * client returns the app to the guest state. Network failures retry twice; a server answer
 * never retries.
 */
export function useBootstrap() {
  const { session, api, ensureDeviceRegistered } = useSession();
  return useQuery({
    queryKey: bootstrapKey(session.status === 'signedIn'),
    queryFn: async () => {
      await ensureDeviceRegistered();
      return api.bootstrap();
    },
    enabled: session.status !== 'restoring',
    staleTime: 5 * 60_000,
    retry: (failures, error) => isTransient(error) && failures < 2,
  });
}

/**
 * The server's account_context for the signed-in Account, or null (guest, not loaded yet,
 * or offline). Read as delivered; never computed or completed on the device. WO-003
 * consumes it for nothing user-facing: mode switching is a later work order, Courier is
 * fail-closed, and release builds stay Buyer-only whatever it says.
 */
export function useAccountContext(): AccountContext | null {
  return useBootstrap().data?.account_context ?? null;
}
