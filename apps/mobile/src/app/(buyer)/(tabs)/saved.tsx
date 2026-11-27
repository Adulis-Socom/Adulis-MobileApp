// Saved. GUEST_PROMPT: a guest sees the sign-in panel and nothing private. MOB-FE-03 builds the content.
import { t } from '../../../i18n/messages';
import { AppNotices } from '../../../ui/AppNotices';
import { Body, Heading, Screen } from '../../../ui/components';
import { Guard } from '../../../ui/Guard';

export default function Saved() {
  return (
    <Screen>
      <AppNotices />
      <Guard template="/saved">
        <Heading>{t('mobile.tab.saved')}</Heading>
        <Body muted>{t('mobile.state.later')}</Body>
      </Guard>
    </Screen>
  );
}
