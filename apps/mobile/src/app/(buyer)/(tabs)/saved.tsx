import { useSession } from '../../../auth/session';
import { SignInRequired } from '../../../buyer/SignInRequired';
import { Placeholder } from '../../../components/Placeholder';
import { Screen } from '../../../components/Screen';
import { useT } from '../../../i18n/i18n';

/**
 * Saved (ADU-MOB-02 v4.3 S39): private Collections of Products and whole Scenes, which need
 * an Account. Structure only: nothing is read, and nothing is stored on the device.
 */
export default function Saved() {
  const t = useT();
  const { session } = useSession();
  return (
    <Screen title={t('buyer.tab.saved')} edges={['top', 'left', 'right']} centered>
      {session.status === 'signedIn' ? (
        <Placeholder message={t('buyer.saved.coming')} />
      ) : (
        <SignInRequired message={t('buyer.saved.signed_out')} returnTo="/saved" />
      )}
    </Screen>
  );
}
