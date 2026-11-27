// Home. MOB-FE-02 builds the feed here. Until then: an honest placeholder, public for any session, no private request.
import { t } from '../../../i18n/messages';
import { AppNotices } from '../../../ui/AppNotices';
import { Body, Heading, Screen } from '../../../ui/components';

export default function Home() {
  return (
    <Screen>
      <AppNotices />
      <Heading>{t('mobile.home.title')}</Heading>
      <Body muted>{t('mobile.home.later')}</Body>
    </Screen>
  );
}
