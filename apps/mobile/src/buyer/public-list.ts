import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { isTransient } from '../api/client';
import { useSession } from '../auth/session';
import { useForegroundRevalidation } from './for-you-feed';
import { isGone } from './public-read';

/**
 * One cursor-paginated public list (WO-006 Seller Scenes/Products/Reviews, WO-007 Shop), on the
 * For You feed's rules (WO-004A, WO-DISC-002A):
 *
 * - The key names the resource, the subject (guest or Account: the server resolves the Market
 *   from it, so a sign-in or sign-out may change the answer) and a generation.
 * - gcTime 0 and no automatic refetch: the screen decides. Pages load one at a time, never into
 *   an error, and items are de-duplicated across pages (a page boundary can move under live data).
 * - A pull starts a new generation and keeps the previous items on screen while it loads; a
 *   return from the background after the freshness interval starts one that WITHHOLDS them
 *   (they may no longer be public). A 404 is `gone`: nothing earlier stays on screen.
 */
export function usePublicList<P extends { next_cursor: string | null }, I>({
  resource,
  read,
  items,
  keyOf,
}: {
  resource: readonly string[];
  /** Null when the route parameters are malformed: nothing is requested. */
  read: ((cursor: string | null) => Promise<P>) | null;
  items: (page: P) => readonly I[];
  keyOf: (item: I) => string;
}) {
  const { session } = useSession();
  const subject = session.status === 'signedIn' ? 'account' : 'guest';
  const [list, setList] = useState({ generation: 0, withhold: false });
  const depth = resource.length;

  const query = useInfiniteQuery({
    queryKey: [...resource, subject, list.generation],
    queryFn: async ({ pageParam }) => ({ page: await read!(pageParam), receivedAt: Date.now() }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.page.next_cursor,
    enabled: read !== null && session.status !== 'restoring',
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // The network may retry; a server answer never does.
    retry: (failures, error) => isTransient(error) && failures < 2,
    // Only the immediately previous generation of the same subject stands in while a pull loads.
    placeholderData: (previous, previousQuery) =>
      !list.withhold &&
      previousQuery?.queryKey[depth] === subject &&
      previousQuery.queryKey[depth + 1] === list.generation - 1
        ? previous
        : undefined,
  });

  const { all, pages } = useMemo(() => {
    const seen = new Set<string>();
    const out: I[] = [];
    // Each page's own new items as it arrived (WO-009A: one saved-state batch per page).
    const byPage: Array<{ receivedAt: number; items: I[] }> = [];
    for (const loaded of query.data?.pages ?? []) {
      const fresh: I[] = [];
      for (const item of items(loaded.page)) {
        const key = keyOf(item);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
        fresh.push(item);
      }
      byPage.push({ receivedAt: loaded.receivedAt, items: fresh });
    }
    return { all: out, pages: byPage };
    // `items` and `keyOf` are pure projections of the page: the data alone decides.
  }, [query.data]);

  const oldest = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    oldest.current = query.data?.pages[0]?.receivedAt;
  });
  useForegroundRevalidation(
    () => oldest.current,
    () => setList((l) => ({ generation: l.generation + 1, withhold: true })),
  );

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, fetchNextPage, refetch } = query;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError && !isPlaceholderData) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, fetchNextPage]);
  const refresh = useCallback(
    () => setList((l) => ({ generation: l.generation + 1, withhold: oldest.current === undefined })),
    [],
  );
  const retry = useCallback(() => void refetch(), [refetch]);

  return {
    status: query.status,
    error: query.error,
    gone: isGone(query.error),
    items: all,
    /** The same items grouped by the page that brought them, with when it arrived. */
    pages,
    /** The first page as the server sent it (for a list-level fact such as the Shop's market_resolved). */
    firstPage: query.data?.pages[0]?.page,
    /** Nothing to show yet and the request waits for a connection. */
    paused: query.fetchStatus === 'paused' && query.data === undefined,
    /** A pull is in flight; the previous items are still shown. */
    refreshing: isPlaceholderData && query.isFetching,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    loadMore,
    retryNextPage: () => void fetchNextPage(),
    refresh,
    retry,
  };
}
