import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { failureMessage, fillSlots } from '../api/messages';
import { problemCode } from '../api/client';
import { AlertText, StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { NotificationInbox } from '../buyer/BuyerNotifications';
import { useNotificationInbox, type InboxScope } from '../buyer/notifications';
import { usePublicList } from '../buyer/public-list';
import { PublicListView } from '../buyer/PublicListView';
import { FilterTabs } from '../buyer/SavedScreen';
import { keepIfCurrent, usePrivateApi } from '../buyer/saved';
import { formatPriceSpan, useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { BUCKETS, SELLER_ID, parseOrder, parseOrderPage, type Bucket, type Money, type OrderRow, type SellerRow } from './seller-api';
import { SELLER, sellerRetry, useSellerContext } from './seller-context';

type T = (key: MobileMessageKey) => string;

// The server's nine Order states (core.order_state). An unknown one reads neutrally; nothing is inferred.
const STATE: Record<string, MobileMessageKey> = {
  CREATED: 'seller.order.state.CREATED',
  NOTIFIED: 'seller.order.state.NOTIFIED',
  PAYMENT_SUBMITTED: 'seller.order.state.PAYMENT_SUBMITTED',
  PAYMENT_CONFIRMED: 'seller.order.state.PAYMENT_CONFIRMED',
  HANDED_OFF: 'seller.order.state.HANDED_OFF',
  COMPLETED: 'seller.order.state.COMPLETED',
  CANCELLED_BY_BUYER: 'seller.order.state.CANCELLED_BY_BUYER',
  CANCELLED_BY_SELLER: 'seller.order.state.CANCELLED_BY_SELLER',
  EXPIRED_UNCLAIMED: 'seller.order.state.EXPIRED_UNCLAIMED',
};
export const stateLabel = (t: T, state: string) => t(Object.hasOwn(STATE, state) ? STATE[state]! : 'seller.order.state.other');

const TABS = BUCKETS.map((value) => ({ value, key: `seller.orders.bucket.${value}` as const }));

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

/** The lines an Order shows, in list and detail alike: only fields the server sent. */
function orderLines(t: T, locale: ReturnType<typeof useLocale>, o: OrderRow) {
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const total = (m: Money) => formatPriceSpan(locale, t, { min: m.amountMinor, max: m.amountMinor, currency: m.currency });
  const price = o.total ? total(o.total) : null;
  return [
    fillSlots(t('seller.orders.placed'), { time: when(o.createdAt) }),
    price ? fillSlots(t('seller.orders.total'), { total: price }) : null,
    o.lineCount !== null ? fillSlots(t('seller.orders.products'), { count: o.lineCount }) : null,
    o.expiresAt ? fillSlots(t('seller.orders.expires'), { time: when(o.expiresAt) }) : null,
    o.readyAt ? fillSlots(t('seller.orders.ready'), { time: when(o.readyAt) }) : null,
  ].filter((line): line is string => typeof line === 'string' && line !== '');
}

/**
 * The active store's Orders, read-only (WO-020; GET /v1/seller/orders, seller.orders:read, MOBILE):
 * the server's four buckets (membership is the server's, ADU-API-01 S15.0a), cursor paged with Load
 * more. Each row opens the read-only detail. No Order action exists here: payment, ready, cancel and
 * refund stay with the Seller Console.
 */
export function SellerOrders() {
  return <WithStore>{(store) => <OrdersList key={store.id} seller={store} />}</WithStore>;
}

function OrdersList({ seller }: { seller: SellerRow }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const priv = usePrivateApi();
  const { refused } = useSellerContext();
  const [bucket, setBucket] = useState<Bucket>('needs_action');
  const list = usePublicList({
    resource: [SELLER, seller.id, 'orders', bucket],
    read: priv ? async (cursor) => parseOrderPage(await keepIfCurrent(priv, (api) => api.sellerOrders(seller.id, bucket, cursor))) : null,
    items: (page) => page.data,
    keyOf: (o: OrderRow) => o.id,
  });
  useEffect(() => {
    if (list.error) refused(list.error);
  }, [list.error, refused]);

  const header = (
    <View style={{ gap: theme.space.sm, paddingHorizontal: theme.space.xs, paddingBottom: theme.space.sm }}>
      <AppText style={{ color: theme.color.textSecondary }}>{t('seller.orders.read_only')}</AppText>
      <FilterTabs tabs={TABS} value={bucket} onChange={setBucket} label={t('seller.orders.tabs')} />
    </View>
  );
  return (
    <PublicListView
      list={list}
      keyOf={(o) => o.id}
      header={header}
      renderItem={({ item }) => {
        const lines = orderLines(t, locale, item);
        const state = stateLabel(t, item.state);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={[state, ...lines].join(', ')}
            accessibilityHint={t('seller.orders.open')}
            onPress={() => router.push({ pathname: '/seller/orders/[orderId]', params: { orderId: item.id } })}
            testID="seller-order"
            style={({ pressed }) => ({
              minHeight: theme.touchTarget,
              margin: theme.space.xs,
              padding: theme.space.md,
              gap: theme.space.xs,
              borderWidth: 1,
              borderColor: theme.color.border,
              borderRadius: theme.radius.md,
              backgroundColor: pressed ? theme.color.surfaceMuted : theme.color.surface,
            })}
          >
            <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{state}</AppText>
            {lines.map((line) => (
              <AppText key={line} style={{ color: theme.color.textSecondary }}>
                {line}
              </AppText>
            ))}
          </Pressable>
        );
      }}
      empty="seller.orders.empty"
      loading="seller.orders.loading"
      testID="seller-orders"
      label={t('seller.orders.title')}
      blocked={problemCode(list.error) === 'PERMISSION_DENIED' ? { message: t('seller.orders.unavailable') } : null}
    />
  );
}

/**
 * One Order, read-only (GET /v1/seller/orders/{id}). Its state is the server's; the products are
 * counted, not listed (their shape was not observable); payment submissions, history and
 * allowed_actions are not read, and no control acts on the Order.
 */
export function SellerOrderDetail({ orderId }: { orderId: unknown }) {
  const id = typeof orderId === 'string' && SELLER_ID.test(orderId) ? orderId : null;
  return <WithStore>{(store) => <OrderDetail key={store.id} seller={store} orderId={id} />}</WithStore>;
}

function OrderDetail({ seller, orderId }: { seller: SellerRow; orderId: string | null }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const priv = usePrivateApi();
  const order = useQuery({
    queryKey: [SELLER, seller.id, 'order', orderId ?? ''],
    queryFn: async () => parseOrder(await keepIfCurrent(priv!, (api) => api.sellerOrder(seller.id, orderId!))),
    enabled: priv !== null && orderId !== null,
    gcTime: 0,
    retry: sellerRetry,
  });
  const edges = ['bottom', 'left', 'right'] as const;
  if (orderId === null || problemCode(order.error) === 'NOT_FOUND') {
    return (
      <Screen edges={edges}>
        <AlertText>{t('seller.order.gone')}</AlertText>
      </Screen>
    );
  }
  if (!order.data) {
    return (
      <Screen edges={edges}>
        {order.isError ? (
          problemCode(order.error) === 'PERMISSION_DENIED' ? (
            <AppText>{t('seller.orders.unavailable')}</AppText>
          ) : (
            <>
              <AlertText>{failureMessage(t, order.error)}</AlertText>
              <Button label={t('common.retry')} onPress={() => void order.refetch()} />
            </>
          )
        ) : (
          <StatusText>{t(order.fetchStatus === 'paused' ? 'common.offline' : 'seller.orders.loading')}</StatusText>
        )}
      </Screen>
    );
  }
  const o = order.data;
  return (
    <Screen edges={edges}>
      <AppText variant="heading" accessibilityRole="header">
        {fillSlots(t('seller.order.status'), { state: stateLabel(t, o.state) })}
      </AppText>
      {orderLines(t, locale, { ...o, lineCount: null }).map((line) => (
        <AppText key={line}>{line}</AppText>
      ))}
      {o.lineCount !== null ? <AppText>{fillSlots(t('seller.order.lines'), { count: o.lineCount })}</AppText> : null}
      <AppText style={{ color: theme.color.textSecondary }}>{t('seller.orders.read_only')}</AppText>
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
