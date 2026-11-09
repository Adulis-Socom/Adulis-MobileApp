import { useSession } from '../../../auth/session';
import { SignInRequired } from '../../../buyer/SignInRequired';
import { Placeholder } from '../../../components/Placeholder';
import { Screen } from '../../../components/Screen';
import { useT } from '../../../i18n/i18n';

/**
 * Orders (ADU-MOB-02 v4.3 S11). Structure only: the legacy order and payment endpoints are
 * deliberately not bound, because WO-PAY-001 replaces that architecture.
 */
export default function Orders() {
  const t = useT();
  const { session } = useSession();
  return (
    <Screen title={t('buyer.tab.orders')} edges={['top', 'left', 'right']} centered>
      {session.status === 'signedIn' ? (
        <Placeholder message={t('buyer.orders.coming')} />
      ) : (
        <SignInRequired message={t('buyer.orders.signed_out')} returnTo="/orders" />
      )}
    </Screen>
  );
}
