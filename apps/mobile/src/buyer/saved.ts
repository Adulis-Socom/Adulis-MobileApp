import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  isTransient,
  newIdempotencyKey,
  wasAnswered,
  type AddItemBody,
  type ApiClient,
  type Collection,
  type SavedState,
  type SaveSurface,
  type SaveTarget,
} from '../api/client';
import { useSession } from '../auth/session';
import { useT } from '../i18n/i18n';
import { useUiStore } from '../state/ui-store';

/**
 * Saved and Collections (WO-009; ADU-SRC-01 v3.2 S18-S22, ADU-MOB-02 v4.3 S39-S42). Every
 * state shown is the server's: a Save is drawn as saved only once the server has accepted it,
 * and private answers live only in the query cache, which sign-out clears (SessionProvider).
 */

export const SAVED_STATE = 'saved-state';

/** The DEFAULT Collection is identified by kind; its label is ours, localised, never stored. */
export const collectionName = (c: Pick<Collection, 'kind' | 'name'>, t: ReturnType<typeof useT>) =>
  c.kind === 'DEFAULT' || c.name === null ? t('buyer.saved.default_name') : c.name;

export const saveBody = (target: SaveTarget, surface: SaveSurface, sceneRef: string | null): AddItemBody =>
  target.type === 'PRODUCT_POST' && sceneRef ? { target, source_surface: surface, context: { scene_ref: sceneRef } } : { target, source_surface: surface };

/** One target's saved state (Product Detail, Scene Explorer, the picker): a batch of one. */
export function useSavedState(target: SaveTarget | null) {
  const { session, api } = useSession();
  return useQuery({
    queryKey: [SAVED_STATE, target?.type ?? '', target?.ref ?? ''],
    queryFn: () => api.savedState([target!]),
    enabled: session.status === 'signedIn' && target !== null,
    staleTime: 0,
    gcTime: 60_000,
    retry: (failures, error) => isTransient(error) && failures < 2,
  });
}

/** The confirmed answer, written only while the session that asked is still the one signed in. */
function confirm(qc: QueryClient, target: SaveTarget, update: (s: SavedState) => SavedState) {
  qc.setQueryData<SavedState>([SAVED_STATE, target.type, target.ref], (s) => (s ? update(s) : s));
}

/**
 * The one-tap Save (S21): Save puts the target in the DEFAULT Collection, Saved removes it from
 * there; named Collections are the picker's. One request at a time; the Save intent keeps its
 * Idempotency-Key across a lost answer and drops it once the server has answered.
 */
export function useSaveToggle(target: SaveTarget, surface: SaveSurface, sceneRef: string | null) {
  const t = useT();
  const { api, session } = useSession();
  const qc = useQueryClient();
  const state = useSavedState(target);
  const intent = useRef<string | null>(null);
  const token = session.status === 'signedIn' ? session.token : null;
  const current = useRef(token);
  current.current = token;

  const mutation = useMutation({
    mutationFn: async (s: SavedState) => {
      const started = current.current;
      const held = s.items[0];
      if (held?.saved && held.default_item_ref) {
        await api.removeFromCollection(s.default_collection_ref, held.default_item_ref);
        // A later Save is a new intent: an old key would replay a membership that no longer exists.
        intent.current = null;
        return { started, saved: false as const, item: null };
      }
      intent.current ??= newIdempotencyKey();
      try {
        const item = await api.addToCollection(s.default_collection_ref, saveBody(target, surface, sceneRef), intent.current);
        intent.current = null;
        return { started, saved: true as const, item: item.ref };
      } catch (failure) {
        if (wasAnswered(failure)) intent.current = null;
        throw failure;
      }
    },
    onSuccess: ({ started, saved, item }) => {
      // A late answer for an earlier session changes nothing on screen (the cache was cleared).
      if (started !== current.current) return;
      confirm(qc, target, (s) => ({
        ...s,
        items: s.items.map((i) => ({
          ...i,
          saved,
          default_item_ref: item,
          memberships: saved
            ? [...i.memberships.filter((m) => m.collection_ref !== s.default_collection_ref), { collection_ref: s.default_collection_ref, item_ref: item! }]
            : i.memberships.filter((m) => m.collection_ref !== s.default_collection_ref),
        })),
      }));
      AccessibilityInfo.announceForAccessibility(t(saved ? 'buyer.save.added' : 'buyer.save.removed'));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [SAVED_STATE] }),
  });

  return {
    state,
    saved: state.data?.items[0]?.saved ?? false,
    busy: mutation.isPending,
    error: mutation.error,
    toggle: () => {
      if (state.data && !mutation.isPending) mutation.mutate(state.data);
    },
  };
}

/**
 * Finish a guest's Save after the sign-in it started (S16): only for the nonce that sign-in
 * carried, in the session that just began, after the server re-checks the target. A refusal
 * (the target is no longer public) saves nothing; the screen then shows the server's state.
 */
export async function completePendingSave(api: ApiClient, qc: QueryClient, nonce: string | null): Promise<void> {
  const store = useUiStore.getState();
  const pending = store.pendingSave;
  if (!nonce || pending?.nonce !== nonce) return;
  store.setPendingSave(null);
  try {
    const s = await api.savedState([pending.target]);
    if (!s.items[0]?.saved) {
      await api.addToCollection(s.default_collection_ref, saveBody(pending.target, pending.surface, pending.sceneRef), newIdempotencyKey());
    }
  } catch (failure) {
    console.warn('[saved] the Save after sign-in was not completed:', failure instanceof Error ? failure.name : 'unknown error');
  } finally {
    await qc.invalidateQueries({ queryKey: [SAVED_STATE] });
  }
}
