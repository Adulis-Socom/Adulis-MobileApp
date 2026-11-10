import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { useBootstrap } from '../api/bootstrap';
import type { FypUnit } from '../api/client';
import { failureMessage } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { feedSessionEnded, useForYouFeed } from './for-you-feed';
import { SceneCard } from './SceneCard';

/**
 * Buyer Home's For You channel (WO-004A): the real /v1/fyp Scene feed in a FlashList.
 * Every state is its own, and none is filled with content the server did not send: a
 * failure is a message and a retry, an empty feed says so, the end of the feed says so.
 * The card renders from the unit alone (no per-row request); the photo origin is the
 * bootstrap's media_public_origin.
 */
export function ForYouFeed() {
  const t = useT();
  const theme = useTheme();
  const feed = useForYouFeed();
  const mediaOrigin = useBootstrap().data?.media_public_origin;

  const renderItem = useCallback(
    ({ item }: { item: FypUnit }) => <SceneCard unit={item} mediaOrigin={mediaOrigin} />,
    [mediaOrigin],
  );

  // Nothing to show and the request waits for a connection (an offline return from the
  // background, say): say so rather than spin. TanStack resumes it on reconnect; Retry is
  // what the message asks for, and asks again at once.
  if (feed.status === 'pending' && feed.paused) {
    return (
      <Centered>
        <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {t('common.offline')}
        </AppText>
        <Button label={t('common.retry')} onPress={feed.retry} />
      </Centered>
    );
  }

  if (feed.status === 'pending') {
    return (
      <Centered>
        <ActivityIndicator color={theme.color.accent} />
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.color.textSecondary }}>
          {t('buyer.for_you.loading')}
        </AppText>
      </Centered>
    );
  }

  if (feed.status === 'error' && feed.units.length === 0) {
    return (
      <Centered refreshing={feed.refreshing} onRefresh={feed.refresh}>
        <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {failureMessage(t, feed.error)}
        </AppText>
        <Button label={t('common.retry')} onPress={feed.retry} />
      </Centered>
    );
  }

  // The server ended this session (expired, version retired, Market changed): its cards go
  // with it, rather than staying on screen as if they were current.
  if (feed.isFetchNextPageError && feedSessionEnded(feed.error)) {
    return (
      <Centered refreshing={feed.refreshing} onRefresh={feed.refresh}>
        <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {t('buyer.for_you.session_ended')}
        </AppText>
        <Button label={t('buyer.for_you.refresh')} onPress={feed.refresh} />
      </Centered>
    );
  }

  if (feed.units.length === 0) {
    return (
      <Centered refreshing={feed.refreshing} onRefresh={feed.refresh}>
        <AppText style={{ textAlign: 'center' }}>{t('buyer.for_you.empty')}</AppText>
        <Button label={t('buyer.for_you.refresh')} onPress={feed.refresh} variant="secondary" />
      </Centered>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <FlashList
        data={feed.units}
        // A Scene appears once per feed session (server rule, and feedUnits enforces it).
        keyExtractor={(unit) => unit.public_ref}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        onEndReached={feed.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            onRefresh={feed.refresh}
            colors={[theme.color.accent]}
          />
        }
        contentContainerStyle={{ padding: theme.space.md }}
        accessibilityLabel={t('buyer.for_you.feed')}
        testID="for-you-list"
        ListFooterComponent={
          <View style={{ paddingVertical: theme.space.lg, gap: theme.space.sm, alignItems: 'center' }}>
            {feed.isFetchingNextPage ? (
              <>
                <ActivityIndicator color={theme.color.accent} />
                <AppText accessibilityLiveRegion="polite" style={{ color: theme.color.textSecondary }}>
                  {t('buyer.for_you.loading_more')}
                </AppText>
              </>
            ) : feed.isFetchNextPageError ? (
              <>
                <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
                  {`${t('buyer.for_you.more_failed')} ${failureMessage(t, feed.error)}`}
                </AppText>
                <Button label={t('common.retry')} onPress={feed.retryNextPage} />
              </>
            ) : !feed.hasNextPage ? (
              <AppText style={{ color: theme.color.textSecondary, textAlign: 'center' }}>
                {t('buyer.for_you.end')}
              </AppText>
            ) : null}
          </View>
        }
      />
    </View>
  );
}

function Separator() {
  const theme = useTheme();
  return <View style={{ height: theme.space.md }} />;
}

/** A short state in the middle of the panel; pull-to-refresh still works where offered. */
function Centered({
  children,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      testID="for-you-state"
      style={{ backgroundColor: theme.color.bg }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.space.lg,
        gap: theme.space.md,
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            colors={[theme.color.accent]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}
