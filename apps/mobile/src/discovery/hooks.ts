// Discovery reads over the one session boundary. Every read goes through session.call (the stamp and late-response commit
// point), and every query key is rooted so the identity purge removes what is private: public reads are `public`, anything
// that depends on who is asking is rooted at the guest device or the Account. The order of every list is the server's.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import type { DiscoveryOps } from '../contracts/gap-mob-discovery';
import { SessionChanged, type MobileOps } from '../contracts/gap-mob-session';
import { useApp } from '../providers/AppProvider';
import { TransportError } from '../transport/port';

type PagedOp = { [K in keyof DiscoveryOps]: DiscoveryOps[K]['out'] extends { nextCursor: string | null } ? K : never }[keyof DiscoveryOps];
type ReadOp = Exclude<keyof DiscoveryOps | 'stories.row.get' | 'stories.group.get' | 'saved.list.get' | 'collections.list.get', PagedOp>;

/** How a failure is shown: offline and gone are different states, and neither is a reason the client invents. */
export type ProblemKind = 'offline' | 'gone' | 'unavailable' | 'session';
export function problemKind(error: unknown): ProblemKind {
  if (error instanceof SessionChanged) return 'session';
  if (error instanceof TransportError) {
    if (error.code === 'NETWORK' || error.code === 'TIMEOUT') return 'offline';
    if (error.code === 'NOT_FOUND') return 'gone'; // the single 404 answer: private, removed and missing look the same
  }
  return 'unavailable';
}

/** `public` for reads anyone may make; otherwise rooted at who is asking, so a switch can never show the other Account's list. */
function useRoot(scope: 'public' | 'subject') {
  const { runtime, session, gate } = useApp();
  const ready = runtime !== null && (gate.kind === 'READY' || gate.kind === 'READY_OFFLINE') && (session.kind === 'GUEST' || session.kind === 'AUTHENTICATED');
  const subject = session.kind === 'AUTHENTICATED' ? (['acct', session.accountRef] as const) : (['guest', runtime?.device.context().deviceId ?? ''] as const);
  const root = scope === 'public' ? (['public'] as const) : subject;
  return { runtime, ready, root, epoch: session.epoch };
}

export function usePaged<K extends PagedOp>(op: K, input: Omit<MobileOps[K]['in'], 'cursor'>, options: { readonly scope: 'public' | 'subject'; readonly enabled?: boolean }) {
  const { runtime, ready, root, epoch } = useRoot(options.scope);
  return useInfiniteQuery({
    queryKey: [...root, op, epoch, JSON.stringify(input)],
    enabled: ready && (options.enabled ?? true),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => (runtime as NonNullable<typeof runtime>).session.call(op, { ...input, cursor: pageParam } as unknown as MobileOps[K]['in']),
    getNextPageParam: (last: MobileOps[K]['out']) => (last as { nextCursor: string | null }).nextCursor ?? undefined,
    retry: false,
  });
}

export function useRead<K extends ReadOp>(op: K, input: MobileOps[K]['in'], options: { readonly scope?: 'public' | 'subject'; readonly enabled?: boolean; readonly fresh?: boolean } = {}) {
  const { runtime, ready, root, epoch } = useRoot(options.scope ?? 'public');
  return useQuery({
    queryKey: [...root, op, epoch, JSON.stringify(input)],
    enabled: ready && (options.enabled ?? true),
    queryFn: () => (runtime as NonNullable<typeof runtime>).session.call(op, input),
    retry: false,
    // `fresh`: never serve this from a cache. Opening a Story viewer needs a new successful read, not a remembered photo.
    ...(options.fresh ? { gcTime: 0, staleTime: 0, refetchOnMount: 'always' as const } : {}),
  });
}
