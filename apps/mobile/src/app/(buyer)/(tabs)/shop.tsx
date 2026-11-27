// Shop. MOB-FE-02 builds Shop browsing here. PUBLIC: renders for any session and makes no private request.
import { t } from '../../../i18n/messages';
import { AppNotices } from '../../../ui/AppNotices';
import { Body, Heading, Screen } from '../../../ui/components';

export default function Shop() {
  return (
    <Screen>
      <AppNotices />
      <Heading>{t('mobile.tab.shop')}</Heading>
      <Body muted>{t('mobile.state.later')}</Body>
    </Screen>
  );
}
