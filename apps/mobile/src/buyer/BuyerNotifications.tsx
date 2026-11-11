import { FlashList } from '@shopify/flash-list';
import { RefreshControl, View } from 'react-native';

import { failureMessage, fillSlots } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { notificationText, useBuyerNotifications, useMarkNotificationRead, type BuyerNotification } from './notifications';

/** Seven days: the Recent group (presentation only; the design defines no grouping). */
const RECENT_MS = 7 * 24 * 60 * 60 * 1000;

type Row = { kind: 'header'; key: string; title: string } | { kind: 'item'; key: string; n: BuyerNotification };

/**
 * The signed-in Buyer's inbox (WO-012): Recent and Older, newest first; each row says Unread or Read
 * in words (not colour alone), its sentence, when it arrived, and, for an unread row, Mark as read.
 * No row opens anything: the inbox informs, and the server's state elsewhere is the truth.
 */
export function BuyerNotifications() {
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const inbox = useBuyerNotifications();
  const { mark, pending, failed } = useMarkNotificationRead();
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const secondary = { color: theme.color.textSecondary };

  const now = Date.now();
  const recent = inbox.items.filter((n) => now - Date.parse(n.scheduledFor) < RECENT_MS);
  const older = inbox.items.filter((n) => now - Date.parse(n.scheduledFor) >= RECENT_MS);
  const rows: Row[] = [
    ...(recent.length ? [{ kind: 'header' as const, key: 'h-recent', title: t('buyer.notifications.recent') }] : []),
    ...recent.map((n) => ({ kind: 'item' as const, key: n.id, n })),
    ...(older.length ? [{ kind: 'header' as const, key: 'h-older', title: t('buyer.notifications.older') }] : []),
    ...older.map((n) => ({ kind: 'item' as const, key: n.id, n })),
  ];

  const item = (n: BuyerNotification) => {
    const unread = n.readAt === null;
    return (
      <View
        style={{
          gap: theme.space.xs,
          padding: theme.space.md,
          marginBottom: theme.space.sm,
          borderRadius: theme.radius.md,
          borderWidth: unread ? 2 : 1,
          borderColor: unread ? theme.color.accent : theme.color.border,
          backgroundColor: unread ? theme.color.accentSubtle : theme.color.bg,
        }}
      >
        <AppText style={{ fontWeight: theme.fontWeight.semibold, color: unread ? theme.color.accent : theme.color.textSecondary }}>
          {t(unread ? 'buyer.notifications.unread' : 'buyer.notifications.read_state')}
        </AppText>
        <AppText>{notificationText(t, n)}</AppText>
        {n.aboutOrder ? <AppText style={secondary}>{t('buyer.notifications.about_order')}</AppText> : null}
        <AppText style={secondary}>{fillSlots(t('buyer.notifications.received'), { time: when(n.scheduledFor) })}</AppText>
        {unread ? (
          <Button
            label={t('buyer.notifications.mark_read')}
            variant="secondary"
            onPress={() => void mark(n.id)}
            disabled={pending.has(n.id)}
          />
        ) : null}
        {failed.has(n.id) ? <AppText accessibilityRole="alert">{t('buyer.notifications.mark_read_failed')}</AppText> : null}
      </View>
    );
  };

  const footer = inbox.hasNextPage ? (
    <Button
      label={t('buyer.notifications.load_older')}
      variant="secondary"
      onPress={() => void inbox.fetchNextPage()}
      disabled={inbox.isFetchingNextPage}
    />
  ) : inbox.items.length > 0 ? (
    <AppText style={{ ...secondary, textAlign: 'center' }}>{t('buyer.list.end')}</AppText>
  ) : null;

  const empty = inbox.isError ? (
    <View accessibilityRole="alert" style={{ gap: theme.space.sm }}>
      <AppText>{t('buyer.notifications.failed')}</AppText>
      <AppText style={secondary}>{failureMessage(t, inbox.error)}</AppText>
      <Button label={t('common.retry')} onPress={() => void inbox.refetch()} />
    </View>
  ) : inbox.isPending ? (
    <AppText style={secondary}>{t('common.loading')}</AppText>
  ) : (
    <AppText>{t('buyer.notifications.empty')}</AppText>
  );

  return (
    <FlashList
      data={rows}
      keyExtractor={(row) => row.key}
      getItemType={(row) => row.kind}
      renderItem={({ item: row }) =>
        row.kind === 'header' ? (
          <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold, marginVertical: theme.space.sm }}>
            {row.title}
          </AppText>
        ) : (
          item(row.n)
        )
      }
      contentContainerStyle={{ padding: theme.space.lg }}
      refreshControl={
        <RefreshControl refreshing={inbox.isRefetching && !inbox.isFetchingNextPage} onRefresh={() => void inbox.refetch()} colors={[theme.color.accent]} />
      }
      ListHeaderComponent={
        <View style={{ marginBottom: theme.space.sm }}>
          <Button
            label={t('buyer.notifications.refresh')}
            variant="secondary"
            onPress={() => void inbox.refetch()}
            disabled={inbox.isFetching}
          />
        </View>
      }
      ListEmptyComponent={empty}
      ListFooterComponent={<View style={{ paddingVertical: theme.space.md }}>{footer}</View>}
    />
  );
}
