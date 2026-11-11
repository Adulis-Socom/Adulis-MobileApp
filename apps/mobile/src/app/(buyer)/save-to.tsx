import { useLocalSearchParams } from 'expo-router';

import { useSession } from '../../auth/session';
import { parsePickerParams, SaveToCollection } from '../../buyer/SaveToCollection';
import { SignInRequired } from '../../buyer/SignInRequired';
import { Screen } from '../../components/Screen';
import { useT } from '../../i18n/i18n';

/**
 * /save-to -- Add to collection over the Product or Scene that opened it (WO-009 S15). Without a
 * session it asks for a sign-in instead of reading anything (WO-010 review R1).
 */
export default function SaveToPage() {
  const t = useT();
  const { session } = useSession();
  const params = useLocalSearchParams();
  if (session.status !== 'signedIn') {
    return (
      <Screen edges={['bottom', 'left', 'right']} centered>
        <SignInRequired message={t('buyer.saved.signed_out')} returnTo="/saved" />
      </Screen>
    );
  }
  return <SaveToCollection params={parsePickerParams(params)} />;
}
