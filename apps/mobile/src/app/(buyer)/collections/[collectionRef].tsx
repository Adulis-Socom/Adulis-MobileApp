import { useLocalSearchParams } from 'expo-router';

import { useSession } from '../../../auth/session';
import { CollectionScreen } from '../../../buyer/CollectionScreen';
import { SignInRequired } from '../../../buyer/SignInRequired';
import { Screen } from '../../../components/Screen';
import { useT } from '../../../i18n/i18n';

/**
 * /collections/:collectionRef -- one of the signed-in Buyer's private Collections (WO-009). Without
 * a session (signed out, or the session ended while this screen was open) it asks for a sign-in
 * instead of reading anything (WO-010 review R1).
 */
export default function CollectionPage() {
  const t = useT();
  const { session } = useSession();
  const { collectionRef } = useLocalSearchParams();
  if (session.status !== 'signedIn') {
    return (
      <Screen edges={['bottom', 'left', 'right']} centered>
        <SignInRequired message={t('buyer.saved.signed_out')} returnTo="/saved" />
      </Screen>
    );
  }
  return <CollectionScreen collectionRef={collectionRef} />;
}
