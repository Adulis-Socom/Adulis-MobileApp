import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useRef } from 'react';
import { View } from 'react-native';

import { failureMessage } from '../api/messages';
import { AlertText, StatusText } from '../components/AlertText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';

/**
 * What the Buyer messaging screens need of a paged query (conversation messages, conversation list).
 * `errorUpdatedAt` and `isFetchNextPageError` are TanStack Query's own fields.
 */
export type PagedQuery = {
  isError: boolean;
  errorUpdatedAt: number;
  isFetchNextPageError: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  error: unknown;
  fetchNextPage: () => unknown;
};

/**
 * The kind of the last failure that SETTLED, while the query is in error: an older page that could not be
 * loaded ('next') or a refresh or poll that could not ('refetch'). The query's own flag cannot say: it
 * describes the fetch in flight, so a poll that starts after a failed older page would turn the older
 * page's error into a refresh failure (and announce it) before the poll has answered. The kind is read
 * once per failure (errorUpdatedAt) and dropped when the query is no longer in error.
 */
export function useSettledFailure(q: Pick<PagedQuery, 'isError' | 'errorUpdatedAt' | 'isFetchNextPageError'>): 'next' | 'refetch' | null {
  const seen = useRef<{ at: number; kind: 'next' | 'refetch' | null }>({ at: 0, kind: null });
  if (!q.isError) seen.current = { at: 0, kind: null };
  else if (seen.current.at !== q.errorUpdatedAt) seen.current = { at: q.errorUpdatedAt, kind: q.isFetchNextPageError ? 'next' : 'refetch' };
  return seen.current.kind;
}

/**
 * The control at the end of a Buyer messaging list: "Load earlier messages" / "Load older conversations",
 * the same button while it loads (disabled; "Loading more" is spoken) and after an older page failed (a
 * spoken failure beside it, and the button reads Try again). Nothing else: no end sentence, no count.
 */
export function PagingControl({
  query,
  failure,
  label,
}: {
  query: PagedQuery;
  failure: 'next' | 'refetch' | null;
  label: MobileMessageKey;
}) {
  const t = useT();
  const theme = useTheme();
  const failed = failure === 'next';
  if (!query.hasNextPage && !failed) return null;
  return (
    <View style={{ gap: theme.space.sm }}>
      {failed ? <AlertText>{`${t('buyer.list.more_failed')} ${failureMessage(t, query.error)}`}</AlertText> : null}
      {query.isFetchingNextPage ? <StatusText>{t('buyer.list.loading_more')}</StatusText> : null}
      <Button
        label={t(failed ? 'common.retry' : label)}
        variant="secondary"
        onPress={() => void query.fetchNextPage()}
        disabled={query.isFetchingNextPage}
      />
    </View>
  );
}
