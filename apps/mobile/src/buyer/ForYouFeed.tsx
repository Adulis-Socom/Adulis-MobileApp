import { FlashList } from '@shopify/flash-list';
import { useCallback } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, View } from 'react-native';

import { useBootstrap } from '../api/bootstrap';
import type { FypUnit } from '../api/client';
import { failureMessage } from '../api/messages';
import { AlertText, StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { feedSessionEnded, useForYouFeed } from './for-you-feed';
import { LoadMoreFooter } from './LoadMoreFooter';
import { SceneCard } from './SceneCard';

/**
 * Buyer Home's For You channel (WO-004A): the real /v1/fyp Scene feed in a FlashList.
 * Every state is its own, and none is filled with content the server did not send: a
 * failure is a message and a retry, an empty feed says so, the end of the feed says so.
 * The card renders from the unit alone (no per-row request); the photo origin is the
 * bootstrap's media_public_origin. More Scenes come on scrolling or from Load more (WO-018): the
 * same request, in the same order, from the same cursor.
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
  // background, say): say so rather than spin. TanStack resumes it by itself on reconnect;
  // no Retry button, because refetching a paused query asks nothing while offline.
  if (feed.status === 'pending' && feed.paused) {
    return (
      <Centered>
        <AlertText style={{ textAlign: 'center' }}>
          {t('common.offline')}
        </AlertText>
      </Centered>
    );
  }

  if (feed.status === 'pending') {
    return (
      <Centered>
        <ActivityIndicator color={theme.color.accent} importantForAccessibility="no" accessibilityElementsHidden />
        <StatusText style={{ color: theme.color.textSecondary }}>
          {t('buyer.for_you.loading')}
        </StatusText>
      </Centered>
    );
  }

  // A failed first read. (A failed NEXT page with nothing shown stays beside its own control, below.)
  if (feed.status === 'error' && feed.units.length === 0 && !feed.isFetchNextPageError) {
    return (
      <Centered refreshing={feed.refreshing} onRefresh={feed.refresh}>
        <AlertText style={{ textAlign: 'center' }}>
          {failureMessage(t, feed.error)}
        </AlertText>
        <Button label={t('common.retry')} onPress={feed.retry} />
      </Centered>
    );
  }

  // The server ended this session (expired, version retired, Market changed): its cards go
  // with it, rather than staying on screen as if they were current.
  if (feed.isFetchNextPageError && feedSessionEnded(feed.error)) {
    return (
      <Centered refreshing={feed.refreshing} onRefresh={feed.refresh}>
        <AlertText style={{ textAlign: 'center' }}>
          {t('buyer.for_you.session_ended')}
        </AlertText>
        <Button label={t('buyer.for_you.refresh')} onPress={feed.refresh} />
      </Centered>
    );
  }

  // Nothing this build can show, but the server says more pages follow: not an empty feed. The hook walks a bounded
  // number of pages by itself; Load more (and Try again for a failed page) is the Buyer's after that (BUY-05E).
  if (feed.units.length === 0 && (feed.hasNextPage || feed.isFetchNextPageError)) {
    return (
      <Centered refreshing={feed.refreshing} onRefresh={feed.refresh}>
        {feed.paused ? <AlertText style={{ textAlign: 'center' }}>{t('common.offline')}</AlertText> : null}
        <LoadMoreFooter
          paging={{ ...feed, count: 0, pageCount: feed.pageCount }}
          keys={{ load: 'buyer.for_you.load_more', loading: 'buyer.for_you.loading_more', failed: 'buyer.for_you.more_failed', end: 'buyer.for_you.end' }}
        />
        <Button label={t('buyer.for_you.refresh')} onPress={feed.refresh} variant="secondary" />
      </Centered>
    );
  }

  if (feed.units.length === 0) {
    return (
      <Centered refreshing={feed.refreshing} onRefresh={feed.refresh}>
        {/* A pull that waits for a connection is answered here too, as with cards on screen (BUY-05D). */}
        {feed.paused ? <AlertText style={{ textAlign: 'center' }}>{t('common.offline')}</AlertText> : null}
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
        // Cards are on screen and the feed's read waits for a connection (a pull, or Load more, made offline):
        // say so rather than leave the gesture without an answer. TanStack resumes it on reconnect (B23-009).
        ListHeaderComponent={
          feed.paused ? (
            <AlertText style={{ textAlign: 'center', paddingBottom: theme.space.md }}>{t('common.offline')}</AlertText>
          ) : null
        }
        // While a pull's new session is pending the old cards stand in for it, and it has no next
        // page of its own: the footer says nothing about the end of the feed until it answers
        // (BUY-05D; the pending state itself is the spinner, or the header's offline line).
        ListFooterComponent={
          feed.refreshPending ? null : (
            <LoadMoreFooter
              paging={{ ...feed, count: feed.units.length, pageCount: feed.pageCount }}
              keys={{ load: 'buyer.for_you.load_more', loading: 'buyer.for_you.loading_more', failed: 'buyer.for_you.more_failed', end: 'buyer.for_you.end' }}
            />
          )
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
