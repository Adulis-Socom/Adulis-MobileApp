import { useSession } from '../../auth/session';
import { SignInRequired } from '../../buyer/SignInRequired';
import { Placeholder } from '../../components/Placeholder';
import { Screen } from '../../components/Screen';
import { useT } from '../../i18n/i18n';

/**
 * Notifications. Account-private, so a guest sees why it needs an Account. Structure only:
 * no notification reads and no push provider.
 */
export default function Notifications() {
  const t = useT();
  const { session } = useSession();
  return (
    <Screen edges={['bottom', 'left', 'right']} centered>
      {session.status === 'signedIn' ? (
        <Placeholder message={t('buyer.notifications.coming')} />
      ) : (
        <SignInRequired message={t('buyer.notifications.signed_out')} />
      )}
    </Screen>
  );
}
