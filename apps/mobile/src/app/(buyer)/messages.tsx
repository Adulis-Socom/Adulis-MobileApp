import { useSession } from '../../auth/session';
import { Conversations } from '../../buyer/Conversations';
import { SignInRequired } from '../../buyer/SignInRequired';
import { Screen } from '../../components/Screen';
import { useT } from '../../i18n/i18n';

/** Messages (WO-013): the signed-in Buyer's conversations; a guest sees why it needs an Account. */
export default function Messages() {
  const t = useT();
  const { session } = useSession();
  if (session.status === 'signedIn') return <Conversations />;
  return (
    <Screen edges={['bottom', 'left', 'right']} centered>
      <SignInRequired message={t('buyer.messages.signed_out')} returnTo="/messages" />
    </Screen>
  );
}
