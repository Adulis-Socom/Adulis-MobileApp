import { useRouter } from 'expo-router';

import { t } from '../../i18n/messages';
import { Body, Button, Heading, Screen } from '../../ui/components';

export default function CourierHome() {
  const router = useRouter();
  return (
    <Screen>
      <Heading>{t('mobile.mode.courier')}</Heading>
      <Body muted>{t('mobile.courier.later')}</Body>
      <Button kind="secondary" label={t('mobile.mode.back_to_buyer')} onPress={() => router.replace('/home')} />
    </Screen>
  );
}
