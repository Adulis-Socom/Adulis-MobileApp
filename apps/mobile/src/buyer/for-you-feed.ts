import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError, isTransient, type FypPage, type FypUnit } from '../api/client';
import { useSession } from '../auth/session';

/**
 * FOREGROUND FRESHNESS (WO-DISC-002A, OVN-055). ADU-MOB-02 S185: "After a meaningful
 * background interval, create/refetch the FYP session according to configuration rather
 * than assuming old Scene Post eligibility remains current." No document sets the
 * interval, so this one value is it, and it is not the server's feed-session lifetime
 * (that ends a session; this decides when cards on screen stop being trusted):
 *
 * - development builds: 5 minutes, a PROVISIONAL technical value for testing;
 * - release builds: 0 -- every return from the background revalidates -- the fail-closed
 *   policy until the founder approves an interval (FYP_FOUNDER_DECISIONS OVN-055).
 */
export const freshnessIntervalMs = (developmentBuild: boolean): number =>
  developmentBuild ? 5 * 60_000 : 0;
export const FOREGROUND_REVALIDATE_AFTER_MS = freshnessIntervalMs(__DEV__);

/** A page as cached: the server's page plus when it arrived (its eligibility check). */
export type LoadedFypPage = FypPage & { readonly receivedAt: number };

/**
 * Whether the cards on screen must be revalidated on returning to the foreground: they
 * were checked before the app went to the background, and it stayed there at least
 * `thresholdMs`. Cards that arrived while backgrounded are as fresh as the background.
 */
export function needsForegroundRevalidation(args: {
  backgroundedAt: number;
  now: number;
  oldestReceivedAt: number | undefined;
  thresholdMs: number;
}): boolean {
  const { backgroundedAt, now, oldestReceivedAt, thresholdMs } = args;
  return (
    oldestReceivedAt !== undefined &&
    oldestReceivedAt <= backgroundedAt &&
    now - backgroundedAt >= thresholdMs
  );
}

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
 * - Returning from the background after FOREGROUND_REVALIDATE_AFTER_MS also starts a new
 *   session, but WITHHOLDS the old cards meanwhile: a Scene may have gone PRIVATE while the
 *   app slept (ADU-MOB-02 S185), so they are not shown as current. A failure or an offline
 *   return then shows as such, never the old cards. One revalidation at a time; a late
 *   answer for an old session lands in that session's key, never the new one.
 * - feed_session_id, serve_id and algorithm_version stay in the cached pages, as served,
 *   for later telemetry. Nothing here mints an id or reports an impression: a qualified
 *   impression is a separate, later observation (ADU-ANL-01 S331).
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
  // `withhold`: this generation was started because the old cards stopped being trusted,
  // so they must not stand in while it loads.
  const [feed, setFeed] = useState({ generation: 0, withhold: false });

  const query = useInfiniteQuery({
    queryKey: forYouKey(subject, feed.generation),
    queryFn: async ({ pageParam }): Promise<LoadedFypPage> => {
      await ensureDeviceRegistered();
      const page = await api.fyp(pageParam, subject === 'guest');
      return { ...page, receivedAt: Date.now() };
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
    // A refresh keeps the same subject's cards on screen while the new session loads;
    // a foreground revalidation does not.
    placeholderData: (previous, previousQuery) =>
      !feed.withhold && previousQuery?.queryKey[1] === subject ? previous : undefined,
  });

  const units = useMemo(() => feedUnits(query.data?.pages), [query.data]);
  const refresh = useCallback(() => setFeed((f) => ({ generation: f.generation + 1, withhold: false })), []);
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, isPlaceholderData, fetchNextPage } = query;

  // Read by the AppState listener at the moment of return, not captured when it subscribed.
  const shown = useRef({ oldest: undefined as number | undefined, live: false });
  shown.current = {
    oldest: query.data?.pages[0]?.receivedAt,
    // Cards of THIS generation on screen. While a new session loads (or failed) there is
    // nothing stale to revalidate, which is also what keeps rapid returns to one refresh.
    live: query.data !== undefined && !isPlaceholderData,
  };

  useEffect(() => {
    // 'background', not merely 'inactive': an iOS control-centre pull is not a background
    // interval. The first background event of a stay is the one that counts.
    let backgroundedAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt ??= Date.now();
        return;
      }
      if (state !== 'active' || backgroundedAt === null) return;
      const since = backgroundedAt;
      backgroundedAt = null;
      const { oldest, live } = shown.current;
      if (
        live &&
        needsForegroundRevalidation({
          backgroundedAt: since,
          now: Date.now(),
          oldestReceivedAt: oldest,
          thresholdMs: FOREGROUND_REVALIDATE_AFTER_MS,
        })
      ) {
        setFeed((f) => ({ generation: f.generation + 1, withhold: true }));
      }
    });
    return () => subscription.remove();
  }, []);

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
    /** Nothing to show yet and the request waits for a connection (TanStack paused it). */
    paused: query.fetchStatus === 'paused',
    /** A pull-to-refresh is in flight: the old session's cards are still shown. */
    refreshing: isPlaceholderData && query.isFetching,
    retry: () => void query.refetch(),
    retryNextPage: () => void fetchNextPage(),
    loadMore,
    refresh,
  };
}
