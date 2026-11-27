// You: the signed-in summary, the mode switcher, account switching and sign-out. A guest sees the sign-in panel.
import { useRouter } from 'expo-router';

import { t } from '../../../i18n/messages';
import { useApp } from '../../../providers/AppProvider';
import { AppNotices } from '../../../ui/AppNotices';
import { Body, Button, Heading, Screen } from '../../../ui/components';
import { Guard } from '../../../ui/Guard';
import { ModeSwitcher } from '../../../ui/ModeSwitcher';

export default function Account() {
  const { signOut } = useApp();
  const router = useRouter();
  return (
    <Screen>
      <AppNotices />
      <Guard template="/account">
        <Heading>{t('mobile.account.title')}</Heading>
        <Body>{t('mobile.account.signed_in')}</Body>
        <ModeSwitcher />
        <Button kind="secondary" label={t('mobile.account.switch')} onPress={() => router.push('/auth/sign-in')} />
        <Button kind="secondary" label={t('mobile.account.sign_out')} onPress={signOut} />
      </Guard>
    </Screen>
  );
}
