import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../../auth/session';
import { SavedScreen } from '../../../buyer/SavedScreen';
import { SignInRequired } from '../../../buyer/SignInRequired';
import { Screen } from '../../../components/Screen';
import { useT } from '../../../i18n/i18n';
import { useTheme } from '../../../theme/theme';

/**
 * Saved (ADU-MOB-02 v4.3 S39, WO-009): private Collections of Products and whole Scenes, which
 * need an Account. A guest is told so and chooses Sign in; nothing is stored on the device.
 */
export default function Saved() {
  const t = useT();
  const theme = useTheme();
  const { session } = useSession();
  if (session.status === 'signedIn') {
    // One virtualised list owns the scrolling (the Shop pattern): its header carries the title.
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.color.bg }}>
        <SavedScreen />
      </SafeAreaView>
    );
  }
  return (
    <Screen title={t('buyer.tab.saved')} edges={['top', 'left', 'right']} centered>
      <SignInRequired message={t('buyer.saved.signed_out')} returnTo="/saved" />
    </Screen>
  );
}
