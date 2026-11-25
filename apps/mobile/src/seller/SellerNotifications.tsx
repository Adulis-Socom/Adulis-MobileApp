import { Redirect } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';

import { failureMessage } from '../api/messages';
import { AlertText, StatusText } from '../components/AlertText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { NotificationInbox } from '../buyer/BuyerNotifications';
import { useNotificationInbox, type InboxScope } from '../buyer/notifications';
import { useT } from '../i18n/i18n';
import type { SellerRow } from './seller-api';
import { useSellerContext } from './seller-context';

/**
 * A sub-screen's store: the active one, or, while the Seller list is still being read (a link that
 * opens here directly), a loading or failure state. Only a list that has answered without an active
 * store (several to choose from, none, or this one revoked) sends the Buyer to Seller Home.
 */
export function WithStore({ children }: { children: (store: SellerRow) => ReactNode }) {
  const t = useT();
  const { list, active } = useSellerContext();
  if (active) return <>{children(active)}</>;
  if (list.data !== undefined) return <Redirect href="/seller" />;
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      {list.isError ? (
        <>
          <AlertText>{`${t('seller.chooser.failed')} ${failureMessage(t, list.error)}`}</AlertText>
          <Button label={t('common.retry')} onPress={() => void list.refetch()} />
        </>
      ) : (
        <StatusText>{t(list.fetchStatus === 'paused' ? 'common.offline' : 'seller.chooser.loading')}</StatusText>
      )}
    </Screen>
  );
}

/** The active store's notifications: the shared inbox, scoped to that store (as=seller). */
export function SellerNotifications() {
  return <WithStore>{(store) => <StoreInbox key={store.id} sellerId={store.id} />}</WithStore>;
}

function StoreInbox({ sellerId }: { sellerId: string }) {
  const { refused } = useSellerContext();
  const scope = useMemo<InboxScope>(() => ({ as: 'seller', sellerId }), [sellerId]);
  // The same query the inbox renders (one request): a 404 means the store is no longer this Account's.
  const inbox = useNotificationInbox(scope);
  useEffect(() => {
    if (inbox.error) refused(inbox.error);
  }, [inbox.error, refused]);
  return <NotificationInbox scope={scope} />;
}
