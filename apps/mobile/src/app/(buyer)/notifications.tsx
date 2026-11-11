import { useSession } from '../../auth/session';
import { BuyerNotifications } from '../../buyer/BuyerNotifications';
import { SignInRequired } from '../../buyer/SignInRequired';
import { Screen } from '../../components/Screen';
import { useT } from '../../i18n/i18n';

/**
 * Notifications (WO-012): the signed-in Buyer's in-app inbox. Account-private, so a guest sees why it
 * needs an Account. No push: no permission is asked and no token is registered (out of scope).
 */
export default function Notifications() {
  const t = useT();
  const { session } = useSession();
  if (session.status === 'signedIn') return <BuyerNotifications />;
  return (
    <Screen edges={['bottom', 'left', 'right']} centered>
      <SignInRequired message={t('buyer.notifications.signed_out')} returnTo="/notifications" />
    </Screen>
  );
}
