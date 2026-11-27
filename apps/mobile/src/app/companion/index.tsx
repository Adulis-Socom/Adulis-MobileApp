import { useRouter } from 'expo-router';

import { t } from '../../i18n/messages';
import { Body, Button, Heading, Screen } from '../../ui/components';

export default function CompanionHome() {
  const router = useRouter();
  return (
    <Screen>
      <Heading>{t('mobile.mode.seller_companion')}</Heading>
      <Body muted>{t('mobile.companion.later')}</Body>
      <Button kind="secondary" label={t('mobile.mode.back_to_buyer')} onPress={() => router.replace('/home')} />
    </Screen>
  );
}
