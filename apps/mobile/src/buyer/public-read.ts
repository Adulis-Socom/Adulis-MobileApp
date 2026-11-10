import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { ApiError, isTransient } from '../api/client';
import { useForegroundRevalidation } from './for-you-feed';

/** A Scene's public reference: the server's PUBLIC_REF_RE (22 base64url characters). */
export const isPublicRef = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{22}$/.test(value);

/**
 * A Seller handle or a Product slug as the server mints them: lowercase letters, digits and
 * hyphens. Checked before the value becomes a path segment, so a deep link can never put a
 * dot segment, a slash or an encoded character into a request path.
 */
export const isPathName = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);

/** The server's own 404: the resource is not public (gone, private, never existed -- one answer). */
export function isGone(error: unknown): boolean {
  return (
    error instanceof ApiError && error.failure.kind === 'problem' && error.failure.status === 404
  );
}

/**
 * One public read that a screen shows only while its latest answer stands (WO-005):
 *
 * - The key names the resource and a generation, so a late answer can only land in the
 *   resource and generation that asked for it, never in another Scene or Product.
 * - gcTime 0: a screen that closes drops its copy; opening the resource again asks again.
 *   Nothing refetches by itself (focus, reconnect): the screen decides when.
 * - Returning from the background after the WO-DISC-002A interval starts a new generation:
 *   what was shown is WITHHELD until the server answers again, as the For You feed does.
 * - `revalidate` asks again keeping the content on screen (a pull, a return from another
 *   screen). Only a success shows content: a 404 is `gone` whatever was shown before, and
 *   any other failure is an error, never the previous answer standing in for the current one.
 *
 * `read` is null when the route parameters are malformed: nothing is requested. It is told
 * whether the request is a REVALIDATION: true once this screen has had an answer (a pull, a
 * return from the background or from another screen, a new generation), false for the
 * opening -- a screen opened again is a new mount and a new opening (OVN-073).
 */
export function usePublicRead<T>(
  resource: readonly string[],
  read: ((revalidation: boolean) => Promise<T>) | null,
) {
  const [generation, setGeneration] = useState(0);
  const answered = useRef(false);
  const query = useQuery({
    queryKey: [...resource, generation],
    queryFn: async () => {
      const value = await read!(answered.current);
      answered.current = true;
      return { value, receivedAt: Date.now() };
    },
    enabled: read !== null,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // The network may retry; a server answer never does.
    retry: (failures, error) => isTransient(error) && failures < 2,
  });

  useForegroundRevalidation(
    () => (query.status === 'success' ? query.data.receivedAt : undefined),
    () => setGeneration((g) => g + 1),
  );

  const { refetch } = query;
  // Stable (the observer's refetch is), so a focus effect can depend on it. A request already
  // in flight -- a withheld revalidation started while the screen was covered -- answers it.
  const revalidate = useCallback(() => void refetch({ cancelRefetch: false }), [refetch]);
  // Only the Buyer's own pull shows the pull spinner: a revalidation the screen starts by
  // itself must not move the list (iOS offsets it for a programmatic refresh).
  const [pulling, setPulling] = useState(false);
  const pull = useCallback(() => {
    setPulling(true);
    void refetch({ cancelRefetch: false }).finally(() => setPulling(false));
  }, [refetch]);
  return {
    /** Shown only when the latest answer was a success. */
    value: query.status === 'success' ? query.data.value : undefined,
    /** When the shown answer arrived: a new one lets failed photos try again. */
    receivedAt: query.status === 'success' ? query.data.receivedAt : undefined,
    status: query.status,
    error: query.error,
    gone: isGone(query.error),
    /** Nothing to show and the request waits for a connection. */
    paused: query.fetchStatus === 'paused' && query.status !== 'success',
    revalidating: query.isRefetching,
    revalidate,
    pulling,
    pull,
  };
}
