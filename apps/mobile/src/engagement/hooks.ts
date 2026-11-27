// Engagement over the one session boundary. Reads are Account-rooted queries; writes are SERVER-CONFIRMED: a control shows a
// pending state, then whatever the server says (a re-read), and never flips on its own. Each tap gets its own idempotency key and
// carries the DESIRED state, so a replay is safe. A guest's tap goes to sign-in and returns to the same screen; nothing is
// replayed after sign-in (whether an intent is auto-replayed is a product decision, not made here).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'expo-router';
import { AccessibilityInfo } from 'react-native';

import type { MobileOps } from '../contracts/gap-mob-session';
import { t } from '../i18n/messages';
import { matchRoute, pathOf } from '../modes/routes';
import { useApp } from '../providers/AppProvider';
import { newIntentKey } from '../session/intent-key';

export interface Refs {
  readonly sceneRefs?: readonly string[];
  readonly productRefs?: readonly string[];
  readonly sellerRefs?: readonly string[];
}

export function useEngagementState(refs: Refs) {
  const { runtime, session, gate } = useApp();
  const input = { sceneRefs: refs.sceneRefs ?? [], productRefs: refs.productRefs ?? [], sellerRefs: refs.sellerRefs ?? [] };
  const account = session.kind === 'AUTHENTICATED' ? session.accountRef : null;
  return useQuery({
    // Account-rooted: the identity purge removes it, and a late answer for another Account can never land here.
    queryKey: ['acct', account ?? '', 'engagement', session.epoch, JSON.stringify(input)],
    enabled: account !== null && runtime !== null && (gate.kind === 'READY' || gate.kind === 'READY_OFFLINE'),
    queryFn: () => (runtime as NonNullable<typeof runtime>).session.call('engagement.state.get', input),
    retry: false,
  });
}

export type Write =
  | { readonly op: 'scene.like.set'; readonly input: MobileOps['scene.like.set']['in'] }
  | { readonly op: 'scene.save.set'; readonly input: MobileOps['scene.save.set']['in'] }
  | { readonly op: 'product.save.set'; readonly input: MobileOps['product.save.set']['in'] }
  | { readonly op: 'seller.follow.set'; readonly input: MobileOps['seller.follow.set']['in'] };

/** One request in flight per control, keyed by what it changes. */
export const writeKey = (w: Write): string => `${w.op}:${JSON.stringify(w.input).replace(/,?"(liked|saved|following)":(true|false)/, '')}`;

export function useEngagementWrite() {
  const { runtime } = useApp();
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (w: Write) => (runtime as NonNullable<typeof runtime>).session.call(w.op, w.input as never, { idempotencyKey: newIntentKey() }),
    // The server's state is what is drawn after every attempt, success or not: a failed write is said, then re-read.
    onError: () => void AccessibilityInfo.announceForAccessibility(t('mobile.engagement.not_confirmed')),
    onSettled: () => client.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'acct' && q.queryKey[2] === 'engagement' }),
  });
  return {
    send: (w: Write) => (mutation.isPending ? undefined : mutation.mutate(w)),
    pendingKey: mutation.isPending && mutation.variables ? writeKey(mutation.variables) : null,
    failed: mutation.isError,
  };
}

/** Runs `action` for an Account; a guest goes to sign-in and comes back here. Settling states do nothing (unknown is not "guest"). */
export function useRequireAccount() {
  const { session } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  return (action: () => void) => {
    if (session.kind === 'AUTHENTICATED') return action();
    if (session.kind !== 'GUEST') return undefined;
    const here = matchRoute(pathname); // allowlist: only a known route is carried as returnTo
    router.push(here ? `/auth/sign-in?returnTo=${encodeURIComponent(pathOf(here))}` : '/auth/sign-in');
    return undefined;
  };
}
