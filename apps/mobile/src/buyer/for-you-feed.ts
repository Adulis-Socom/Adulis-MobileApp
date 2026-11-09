import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { ApiError, isTransient, type FypPage, type FypUnit } from '../api/client';
import { useSession } from '../auth/session';

/**
 * The Buyer For You feed (WO-004A): GET /v1/fyp through TanStack Query, never Zustand.
 *
 * - The key names the subject the server will rank for (guest device or signed-in
 *   Account, never the bearer) and a refresh generation. Signing in or out is a new key,
 *   so a new feed session; a guest-keyed request never carries the bearer, so a guest
 *   cursor is never sent as an Account's.
 * - gcTime 0: a feed nobody shows is dropped, so a remount starts a new session instead of
 *   reviving an old one and continuing its cursor.
 * - Pages chain only through `next_cursor`. Nothing refetches by itself (focus, reconnect,
 *   remount): a silent refetch would restart the session under the Buyer's thumb.
 * - Pull-to-refresh bumps the generation: the first request of the new key carries no
 *   cursor, so the server starts a new session. The previous cards stay visible until it
 *   answers; if it fails they go, so the old session is never continued after a refresh.
 * - feed_session_id, impression_id and algorithm_version stay in the cached pages, as
 *   served, for later telemetry. Nothing here mints one or reports an impression.
 */
export const forYouKey = (subject: 'guest' | 'account', generation: number) =>
  ['fyp', subject, generation] as const;

/**
 * Every loaded page's Scene units, in order, each Scene once. A unit type this build does
 * not know is skipped (the contract may add one), and a Scene repeated by a retried or
 * overlapping page keeps its first position.
 */
export function feedUnits(pages: readonly FypPage[] | undefined): FypUnit[] {
  const seen = new Set<string>();
  const units: FypUnit[] = [];
  for (const page of pages ?? []) {
    for (const unit of page.items) {
      if (unit.type !== 'SCENE_POST' || seen.has(unit.public_ref)) continue;
      seen.add(unit.public_ref);
      units.push(unit);
    }
  }
  return units;
}

/** The server ended this feed session (expired, version retired, Market changed): refresh. */
export function feedSessionEnded(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.failure.kind !== 'problem') return false;
  const { code, slots } = error.failure.problem;
  const reason = (slots as Record<string, unknown> | undefined)?.['reason'];
  return code === 'VALIDATION_FAILED' && (reason === 'CURSOR_EXPIRED' || reason === 'CURSOR_INVALID');
}

// A key is the server's object path: letters, digits and . _ - / only, never a scheme,
// an absolute path or a parent segment.
const OBJECT_KEY = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/**
 * The public URL of a media object, or null when it cannot be built safely: no media
 * origin (object storage not configured), an origin that is not http(s) - https only in a
 * release build - or a key that could escape the origin.
 */
export function mediaUrl(origin: string | undefined, key: string): string | null {
  // No userinfo (`https://a@b`) and no backslash: the authority must be the media host.
  if (!origin || !/^https?:\/\/[^/?#\s@\\]+(?:\/[^?#\s@\\]*)?$/.test(origin)) return null;
  if (!__DEV__ && !origin.startsWith('https://')) return null;
  if (!OBJECT_KEY.test(key) || key.includes('..') || key.includes('//')) return null;
  return `${origin.replace(/\/+$/, '')}/${key}`;
}

export function useForYouFeed() {
  const { session, api, ensureDeviceRegistered } = useSession();
  const subject = session.status === 'signedIn' ? 'account' : 'guest';
  const [generation, setGeneration] = useState(0);

  const query = useInfiniteQuery({
    queryKey: forYouKey(subject, generation),
    queryFn: async ({ pageParam }) => {
      await ensureDeviceRegistered();
      return api.fyp(pageParam, subject === 'guest');
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
    enabled: session.status !== 'restoring',
    staleTime: Infinity,
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // The network may retry; a server answer never does.
    retry: (failures, error) => isTransient(error) && failures < 2,
    // A refresh keeps the same subject's cards on screen while the new session loads.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === subject ? previous : undefined,
  });

  const units = useMemo(() => feedUnits(query.data?.pages), [query.data]);
  const refresh = useCallback(() => setGeneration((g) => g + 1), []);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, fetchNextPage } = query;

  /** Called as the list nears its end: one request at a time, and never into an error. */
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError && !isPlaceholderData) {
      void fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, fetchNextPage]);

  return {
    status: query.status,
    error: query.error,
    units,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    /** A pull-to-refresh is in flight: the old session's cards are still shown. */
    refreshing: isPlaceholderData && query.isFetching,
    retry: () => void query.refetch(),
    retryNextPage: () => void fetchNextPage(),
    loadMore,
    refresh,
  };
}
