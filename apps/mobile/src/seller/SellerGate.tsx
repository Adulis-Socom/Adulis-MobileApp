import { Redirect, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { useBootstrap } from '../api/bootstrap';
import { failureMessage } from '../api/messages';
import { useSession } from '../auth/session';
import { AlertText, StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Loading } from '../components/Loading';
import { Screen } from '../components/Screen';
import { useT } from '../i18n/i18n';
import { useModeActivation } from '../modes/ModeLayout';
import { MODE_HOME } from '../modes/modes';

/**
 * The Seller Companion's door (WO-020). Nothing of Seller mode mounts until the server has said, for
 * the session on screen, that `account_context.seller_companion.available` is true.
 *
 * - A guest never enters: Buyer Home.
 * - Not yet known is not "no": while the bootstrap is being read, or cannot be (offline, a server
 *   error), the screen says so and offers a retry; a network failure is never shown as a revoked
 *   relationship, and the Buyer session is untouched.
 * - Confirmed unavailable (false, or no account_context for this session) fails closed: no Seller
 *   request is made.
 * - Availability lost while inside (a refreshed bootstrap says false) unmounts every Seller screen.
 *
 * The server stays the authority for every Seller read after this: a store the list no longer
 * returns, or a 404 on a store read, closes that store (seller-context.tsx).
 */
export function SellerGate({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const { session } = useSession();
  const boot = useBootstrap();
  const allowed = useModeActivation('seller');

  if (session.status === 'restoring') return <Loading />;
  if (session.status !== 'signedIn') return <Redirect href={MODE_HOME.buyer} />;
  if (allowed) return <>{children}</>;

  const toBuyer = <Button label={t('seller.mode.switch_to_buyer')} variant="secondary" onPress={() => router.replace(MODE_HOME.buyer)} />;
  const known = boot.data !== undefined;
  if (!known && boot.fetchStatus === 'paused') {
    return (
      <Screen centered>
        <AlertText>{t('common.offline')}</AlertText>
        {toBuyer}
      </Screen>
    );
  }
  if (!known && boot.isError) {
    return (
      <Screen centered>
        <AlertText>{failureMessage(t, boot.error)}</AlertText>
        <Button label={t('common.retry')} onPress={() => void boot.refetch()} />
        {toBuyer}
      </Screen>
    );
  }
  if (!known) {
    return (
      <Screen centered>
        <StatusText>{t('seller.gate.checking')}</StatusText>
      </Screen>
    );
  }
  return (
    <Screen centered>
      <AppText>{t('seller.gate.unavailable')}</AppText>
      {toBuyer}
    </Screen>
  );
}
