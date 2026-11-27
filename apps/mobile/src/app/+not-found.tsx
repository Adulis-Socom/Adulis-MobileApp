// An unsupported route: one neutral outcome. An Order, delivery, handoff, claim or operator link lands here and is
// indistinguishable from a link that never existed.
import { useRouter } from 'expo-router';

import { t } from '../i18n/messages';
import { Screen, StateView } from '../ui/components';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen>
      <StateView kind="not-found" action={{ label: t('mobile.state.go_home'), onPress: () => router.replace('/home') }} />
    </Screen>
  );
}
