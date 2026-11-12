import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { failureMessage, fillSlots } from '../api/messages';
import { problemCode } from '../api/client';
import { AlertText, StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { keepIfCurrent, usePrivateApi } from '../buyer/saved';
import { useLocale, useT } from '../i18n/i18n';
import { MODE_HOME } from '../modes/modes';
import { useTheme } from '../theme/theme';
import { isRestricted, parseOverview, type SellerRow } from './seller-api';
import { SELLER, sellerRetry, useSellerContext } from './seller-context';

type T = (key: MobileMessageKey) => string;

// Explicit maps: a value the server adds later is shown neutrally, never through some other key.
const ROLE: Record<string, MobileMessageKey> = {
  OWNER: 'seller.role.OWNER',
  ADMIN: 'seller.role.ADMIN',
  SALES_SUPPORT: 'seller.role.SALES_SUPPORT',
  INVENTORY: 'seller.role.INVENTORY',
  ANALYST: 'seller.role.ANALYST',
  CAMPAIGN_MANAGER: 'seller.role.CAMPAIGN_MANAGER',
};
const STATUS: Record<string, MobileMessageKey> = {
  ACTIVE: 'seller.status.ACTIVE',
  DRAFT: 'seller.status.DRAFT',
  CLOSING: 'seller.status.CLOSING',
};
export const roleLabel = (t: T, role: string) => t(Object.hasOwn(ROLE, role) ? ROLE[role]! : 'seller.role.other');
// Every suspension reads the same: which kind is the Seller Console's to explain.
export const statusLabel = (t: T, status: string) =>
  t(status.endsWith('_SUSPENDED') ? 'seller.status.suspended' : Object.hasOwn(STATUS, status) ? STATUS[status]! : 'seller.status.other');

/**
 * Seller Companion Home (WO-020): the store chooser when the Account holds several stores, else the
 * active store, its basic overview, and the way to its notifications and Orders. Everything shown
 * comes from GET /v1/seller/list and the overview; nothing is computed or filled in.
 */
export function SellerHome() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { list, sellers, active, choose, change } = useSellerContext();
  const toBuyer = (
    <Button label={t('seller.mode.switch_to_buyer')} variant="secondary" onPress={() => router.replace(MODE_HOME.buyer)} />
  );
  const edges = ['bottom', 'left', 'right'] as const;

  if (list.data === undefined) {
    return (
      <Screen edges={edges}>
        {list.isError ? (
          <>
            <AlertText>{`${t('seller.chooser.failed')} ${failureMessage(t, list.error)}`}</AlertText>
            <Button label={t('common.retry')} onPress={() => void list.refetch()} />
          </>
        ) : (
          <StatusText>{t(list.fetchStatus === 'paused' ? 'common.offline' : 'seller.chooser.loading')}</StatusText>
        )}
        {toBuyer}
      </Screen>
    );
  }
  if (sellers.length === 0) {
    return (
      <Screen edges={edges}>
        <AppText>{t('seller.chooser.empty')}</AppText>
        {toBuyer}
      </Screen>
    );
  }
  if (!active) {
    return (
      <Screen edges={edges} title={t('seller.chooser.title')}>
        <View style={{ gap: theme.space.sm }} testID="seller-chooser">
          {sellers.map((s) => (
            <StoreRow key={s.id} seller={s} onPress={() => choose(s.id)} />
          ))}
        </View>
        {toBuyer}
      </Screen>
    );
  }

  return (
    <Screen edges={edges}>
      <View style={{ gap: theme.space.xs }}>
        <AppText style={{ color: theme.color.textSecondary }}>{t('seller.home.store')}</AppText>
        <AppText variant="heading" accessibilityRole="header">
          {active.storeName}
        </AppText>
        <AppText style={{ color: theme.color.textSecondary }}>{`@${active.handle}`}</AppText>
        <AppText>{fillSlots(t('seller.home.role'), { role: roleLabel(t, active.role) })}</AppText>
        <AppText>{fillSlots(t('seller.home.status'), { status: statusLabel(t, active.status) })}</AppText>
        {isRestricted(active.status) ? <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{t('seller.status.restricted')}</AppText> : null}
      </View>
      {sellers.length > 1 ? <Button label={t('seller.home.change_store')} variant="secondary" onPress={change} /> : null}
      <SellerOverview seller={active} />
      <Button label={t('seller.notifications.title')} onPress={() => router.push('/seller/notifications')} />
      <Button label={t('seller.orders.title')} onPress={() => router.push('/seller/orders')} />
      {toBuyer}
    </Screen>
  );
}

function StoreRow({ seller, onPress }: { seller: SellerRow; onPress: () => void }) {
  const t = useT();
  const theme = useTheme();
  const role = roleLabel(t, seller.role);
  const status = statusLabel(t, seller.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fillSlots(t('seller.chooser.store'), { store: seller.storeName, role, status }) ?? seller.storeName}
      onPress={onPress}
      testID="seller-chooser-store"
      style={({ pressed }) => ({
        minHeight: theme.touchTarget,
        padding: theme.space.md,
        gap: theme.space.xs,
        borderWidth: 1,
        borderColor: theme.color.border,
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.color.surfaceMuted : theme.color.surface,
      })}
    >
      <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{seller.storeName}</AppText>
      {/* Two stores can share a name: the handle tells them apart (review F6). */}
      <AppText style={{ color: theme.color.textSecondary }}>{`@${seller.handle}`}</AppText>
      <AppText style={{ color: theme.color.textSecondary }}>{role}</AppText>
      <AppText style={{ color: theme.color.textSecondary }}>{status}</AppText>
    </Pressable>
  );
}

/**
 * The basic overview (GET /v1/seller/analytics/overview, seller.analytics.basic:read, MOBILE). Only
 * the counts the server returned. Published Products is a current total and is labelled "now";
 * Orders follows the reporting window and is labelled with it. The API does not say whether the
 * other three follow the window, so none of them claims a range (contract gap, WO-020).
 */
function SellerOverview({ seller }: { seller: SellerRow }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const priv = usePrivateApi();
  const { refused } = useSellerContext();
  const overview = useQuery({
    queryKey: [SELLER, seller.id, 'overview'],
    queryFn: async () => parseOverview(await keepIfCurrent(priv!, (api) => api.sellerOverview(seller.id))),
    enabled: priv !== null,
    gcTime: 0,
    retry: sellerRetry,
  });
  useEffect(() => {
    if (overview.error) refused(overview.error);
  }, [overview.error, refused]);
  const number = (n: number) => new Intl.NumberFormat(locale).format(n);
  const day = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

  let body: ReactNode;
  const data = overview.data;
  if (data) {
    const metrics: Array<[string, number | null]> = [
      [t('seller.overview.products_published'), data.productsPublished],
      [data.window ? (fillSlots(t('seller.overview.orders'), { from: day(data.window.from), to: day(data.window.to) }) ?? '') : '', data.window ? data.orders : null],
      [t('seller.overview.active_reservations'), data.activeReservations],
      [t('seller.overview.completed_handoffs'), data.completedHandoffs],
      [t('seller.overview.followers'), data.followers],
    ];
    body = metrics
      .filter((m): m is [string, number] => m[1] !== null && m[0] !== '')
      .map(([label, value]) => <AppText key={label}>{fillSlots(t('seller.overview.metric'), { label, value: number(value) })}</AppText>);
  } else if (overview.fetchStatus === 'paused') {
    // Waiting for a connection: said as offline, ahead of an earlier error it may be retrying.
    body = <StatusText>{t('common.offline')}</StatusText>;
  } else if (overview.isError) {
    body =
      problemCode(overview.error) === 'PERMISSION_DENIED' ? (
        <AppText>{t('seller.overview.unavailable')}</AppText>
      ) : (
        <>
          <AlertText>{`${t('seller.overview.failed')} ${failureMessage(t, overview.error)}`}</AlertText>
          <Button label={t('common.retry')} variant="secondary" onPress={() => void overview.refetch()} />
        </>
      );
  } else {
    body = <StatusText>{t('seller.overview.loading')}</StatusText>;
  }

  return (
    <View
      testID="seller-overview"
      style={{ gap: theme.space.xs, padding: theme.space.md, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md }}
    >
      <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
        {t('seller.overview.title')}
      </AppText>
      {body}
    </View>
  );
}
