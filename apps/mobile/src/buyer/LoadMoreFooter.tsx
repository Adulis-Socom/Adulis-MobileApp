import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, ActivityIndicator, View } from 'react-native';

import { failureMessage, fillSlots } from '../api/messages';
import { AlertText, StatusText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';

export type Paging = {
  /** Items on screen now (after de-duplication). */
  count: number;
  /** Pages loaded: it grows exactly once per page that arrives, however fast the answer. */
  pageCount: number;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  error: unknown;
  /** The next page's read waits for a connection (TanStack paused it): said beside the control, never a spinner (BUY-05B). */
  paused?: boolean;
  loadMore: () => void;
  retryNextPage: () => void;
};

/**
 * The end of a cursor-paged list (WO-018, A-006): an explicit Load more beside the scroll trigger,
 * both calling the same `loadMore`, so there is one pagination state and one request at a time.
 *
 * - The button stays in place while the page loads (disabled and busy) and after a failure (as
 *   Try again): the control the Buyer pressed is never unmounted, so screen-reader focus stays.
 * - "Loading more" and a failure are spoken. A page the Buyer asked for with the button is
 *   followed by how many items it added, "just above": focus is not moved (no jump), and the new
 *   items come just before the button (or the end sentence that replaced it).
 * - At the end, the end sentence replaces the button.
 * - Offline, a page the Buyer asked for waits for the connection and resumes by itself: the offline sentence
 *   is shown beside the button (plain text: the screen's own alert is the one announcement), the button
 *   stays, and nothing spins.
 */
export function LoadMoreFooter({
  paging,
  keys,
}: {
  paging: Paging;
  keys: { load: MobileMessageKey; loading: MobileMessageKey; failed: MobileMessageKey; end: MobileMessageKey };
}) {
  const t = useT();
  const theme = useTheme();
  const { count, pageCount, hasNextPage, isFetchingNextPage, isFetchNextPageError } = paging;
  const waitingForConnection = paging.paused === true && hasNextPage && !isFetchingNextPage && !isFetchNextPageError;
  // Items and pages when the Buyer pressed the button. The in-flight state is not watched: an
  // answer that comes at once can arrive in the same render as the request (never "fetching").
  const asked = useRef<{ from: number; pages: number } | null>(null);
  useEffect(() => {
    const request = asked.current;
    if (!request) return;
    // A failure speaks for itself (AlertText).
    if (isFetchNextPageError) {
      asked.current = null;
      return;
    }
    if (pageCount === request.pages) return;
    asked.current = null;
    // Fewer pages: a refresh replaced the list. A page of items already shown adds nothing to say.
    if (pageCount > request.pages && count > request.from) {
      AccessibilityInfo.announceForAccessibility(fillSlots(t('buyer.list.loaded_more'), { count: count - request.from }) ?? '');
    }
  }, [count, pageCount, isFetchNextPageError, t]);

  const press = (action: () => void) => () => {
    asked.current = { from: count, pages: pageCount };
    action();
  };

  return (
    <View testID="load-more-footer" style={{ paddingVertical: theme.space.lg, paddingHorizontal: theme.space.sm, gap: theme.space.sm, alignItems: 'center' }}>
      {/* Fixed slots: the button keeps its place in the tree, and so its native view, in every state. */}
      {isFetchNextPageError ? (
        <AlertText style={{ textAlign: 'center' }}>{`${t(keys.failed)} ${failureMessage(t, paging.error)}`}</AlertText>
      ) : null}
      {isFetchingNextPage ? (
        <View style={{ alignItems: 'center', gap: theme.space.xs }}>
          <ActivityIndicator color={theme.color.accent} importantForAccessibility="no" accessibilityElementsHidden />
          <StatusText style={{ color: theme.color.textSecondary, textAlign: 'center' }}>{t(keys.loading)}</StatusText>
        </View>
      ) : null}
      {waitingForConnection ? (
        <AppText testID="load-more-offline" style={{ color: theme.color.textSecondary, textAlign: 'center' }}>
          {t('common.offline')}
        </AppText>
      ) : null}
      {hasNextPage ? (
        <View style={{ alignSelf: 'stretch' }} testID="load-more">
          <Button
            label={t(isFetchNextPageError ? 'common.retry' : keys.load)}
            variant="secondary"
            disabled={isFetchingNextPage}
            busy={isFetchingNextPage}
            onPress={press(isFetchNextPageError ? paging.retryNextPage : paging.loadMore)}
          />
        </View>
      ) : (
        <AppText style={{ color: theme.color.textSecondary, textAlign: 'center' }}>{t(keys.end)}</AppText>
      )}
    </View>
  );
}
