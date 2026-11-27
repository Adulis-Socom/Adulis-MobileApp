// Orders: an honest placeholder. Checkout is review-only (Option A) and no Order model exists, so a signed-in person sees
// that this section is not available yet; a guest sees the sign-in panel.
import { t } from '../../../i18n/messages';
import { AppNotices } from '../../../ui/AppNotices';
import { Body, Heading, Screen } from '../../../ui/components';
import { Guard } from '../../../ui/Guard';

export default function Orders() {
  return (
    <Screen>
      <AppNotices />
      <Guard template="/orders">
        <Heading>{t('mobile.tab.orders')}</Heading>
        <Body muted>{t('mobile.state.later')}</Body>
      </Guard>
    </Screen>
  );
}
