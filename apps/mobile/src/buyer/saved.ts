import { useMutation, useQueries, useQuery, useQueryClient, type Query, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import { createContext, useContext, useMemo, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

import {
  isTransient,
  newIdempotencyKey,
  type AddItemBody,
  type Collection,
  type SavedState,
  type SaveSurface,
  type SaveTarget,
} from '../api/client';
import { SessionChanged, useSession, type BoundApi } from '../auth/session';
import { useT } from '../i18n/i18n';
import { useUiStore } from '../state/ui-store';

/**
 * Saved and Collections (WO-009; ADU-SRC-01 v3.2 S18-S22, ADU-MOB-02 v4.3 S39-S42). Every
 * state shown is the server's: a Save is drawn as saved only once the server has accepted it,
 * and private answers live only in the query cache, which sign-out clears (SessionProvider).
 *
 * WO-009A: discovery cards read saved state one page at a time (one batch per page of results,
 * never one request per card), and every saved-state read, one-tap Save and guest continuation
 * here is bound to the session that started it (SessionProvider.boundApi), so nothing is sent or
 * cached for another Account. WO-010 (ON-112): the Saved and Collection screens and the picker use
 * the same binding (usePrivateApi).
 */

export const SAVED_STATE = 'saved-state';
/** The API's ceiling: POST /v1/collections/saved-state:batch accepts 1 to 60 targets. */
export const SAVED_STATE_MAX = 60;

type SavedItem = SavedState['items'][number];
const targetKey = (t: Pick<SaveTarget, 'type' | 'ref'>) => `${t.type}:${t.ref}`;
const sameTarget = (a: Pick<SaveTarget, 'type' | 'ref'>, b: Pick<SaveTarget, 'type' | 'ref'>) => a.type === b.type && a.ref === b.ref;
const retry = (failures: number, error: unknown) => isTransient(error) && failures < 2;

/** The DEFAULT Collection is identified by kind; its label is ours, localised, never stored. */
export const collectionName = (c: Pick<Collection, 'kind' | 'name'>, t: ReturnType<typeof useT>) =>
  c.kind === 'DEFAULT' || c.name === null ? t('buyer.saved.default_name') : c.name;

export const saveBody = (target: SaveTarget, surface: SaveSurface, sceneRef: string | null): AddItemBody =>
  target.type === 'PRODUCT_POST' && sceneRef ? { target, source_surface: surface, context: { scene_ref: sceneRef } } : { target, source_surface: surface };

/** A private read whose answer is kept only while the session that asked is still the one signed in. */
export async function keepIfCurrent<T>(bound: BoundApi, read: (api: BoundApi) => Promise<T>): Promise<T> {
  const answer = await read(bound);
  if (!bound.isCurrent()) throw new SessionChanged();
  return answer;
}

const readSavedState = (bound: BoundApi, targets: SaveTarget[]) => keepIfCurrent(bound, (a) => a.savedState(targets));

/**
 * The private Collections client for the session on screen (WO-010, ON-20261111-112): every
 * request is bound to that session (SessionProvider.boundApi), so a request started before a
 * sign-out or another sign-in is refused before it is sent. Capture it at the tap, and check
 * `isCurrent()` before acting on an answer. Null for a guest.
 */
export function usePrivateApi(): BoundApi | null {
  const { session, boundApi } = useSession();
  const token = session.status === 'signedIn' ? session.token : null;
  return useMemo(() => (token ? boundApi(token) : null), [token, boundApi]);
}

/** One target's saved state (Product Detail, Scene Explorer, the picker): a batch of one. */
export function useSavedState(target: SaveTarget | null) {
  const { session, boundApi } = useSession();
  const token = session.status === 'signedIn' ? session.token : null;
  return useQuery({
    queryKey: [SAVED_STATE, target?.type ?? '', target?.ref ?? ''],
    queryFn: () => readSavedState(boundApi(token!), [target!]),
    enabled: token !== null && target !== null,
    staleTime: 0,
    gcTime: 60_000,
    retry,
  });
}

const holds = (q: Query, target: SaveTarget) => (q.state.data as SavedState | undefined)?.items.some((i) => sameTarget(i, target)) ?? false;
/** A read still on its way (or with no answer yet) may predate a change: it is sent again. */
const pending = (q: Query) => q.state.fetchStatus === 'fetching' || q.state.data === undefined;

/**
 * The server's answer to a Save or a Remove, drawn wherever this target is shown: the detail
 * screen's own read and every page batch holding it. Only the DEFAULT membership changes; a
 * named Collection's membership is the picker's and stays as the server last said.
 */
function confirm(qc: QueryClient, target: SaveTarget, saved: boolean, itemRef: string | null) {
  qc.setQueriesData<SavedState>({ queryKey: [SAVED_STATE] }, (s) =>
    s?.items.some((i) => sameTarget(i, target))
      ? {
          ...s,
          items: s.items.map((i) =>
            sameTarget(i, target)
              ? {
                  ...i,
                  saved,
                  default_item_ref: itemRef,
                  memberships: [
                    ...i.memberships.filter((m) => m.collection_ref !== s.default_collection_ref),
                    ...(saved && itemRef ? [{ collection_ref: s.default_collection_ref, item_ref: itemRef }] : []),
                  ],
                }
              : i,
          ),
        }
      : s,
  );
}

type ToggleInput = { bound: BoundApi; held: SavedItem | undefined; defaultRef: string };

/**
 * The one-tap Save (S21): Save puts the target in the DEFAULT Collection, Saved removes it from
 * there; named Collections are the picker's. One request at a time per control, even for taps
 * landing in the same frame. Each tap is its own Idempotency-Key: the membership is already
 * idempotent on the server (one row per Collection and target), and a key kept across a lost
 * answer could replay a membership removed since (independent review D3). The request is bound
 * to the session of the tap.
 */
function useSaveMutation(target: SaveTarget, surface: SaveSurface, sceneRef: string | null) {
  const t = useT();
  const qc = useQueryClient();
  const { session, boundApi } = useSession();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn: async ({ bound, held, defaultRef }: ToggleInput) => {
      if (held?.saved && held.default_item_ref) {
        await bound.removeFromCollection(defaultRef, held.default_item_ref);
        return { saved: false, item: null };
      }
      const item = await bound.addToCollection(defaultRef, saveBody(target, surface, sceneRef), newIdempotencyKey());
      return { saved: true, item: item.ref };
    },
    onSuccess: ({ saved, item }, { bound }) => {
      // A late answer for an earlier session changes nothing on screen (that cache was cleared).
      if (!bound.isCurrent()) return;
      confirm(qc, target, saved, item);
      // A read already on its way may predate this change: send it again (independent review R3).
      void qc.invalidateQueries({ queryKey: [SAVED_STATE], predicate: pending });
      AccessibilityInfo.announceForAccessibility(t(saved ? 'buyer.save.added' : 'buyer.save.removed'));
    },
    onError: (_failure, { bound }) => {
      // Refused or unknown: read this target's state again wherever it is shown, nothing else.
      if (bound.isCurrent()) void qc.invalidateQueries({ queryKey: [SAVED_STATE], predicate: (q) => pending(q) || holds(q, target) });
    },
    onSettled: () => {
      inFlight.current = false;
    },
  });
  const toggle = (held: SavedItem | undefined, defaultRef: string | undefined) => {
    if (inFlight.current || session.status !== 'signedIn' || defaultRef === undefined) return;
    inFlight.current = true;
    mutation.mutate({ bound: boundApi(session.token), held, defaultRef });
  };
  return {
    toggle,
    busy: mutation.isPending,
    /** In flight and taking the target out (else putting it in). */
    removing: mutation.isPending && mutation.variables?.held?.saved === true,
    error: mutation.error,
  };
}

/** Product Detail and Scene Explorer: the target's own read and its Save. */
export function useSaveToggle(target: SaveTarget, surface: SaveSurface, sceneRef: string | null) {
  const state = useSavedState(target);
  const save = useSaveMutation(target, surface, sceneRef);
  const held = state.data?.items[0];
  return {
    state,
    saved: held?.saved ?? false,
    busy: save.busy,
    error: save.error,
    toggle: () => save.toggle(held, state.data?.default_collection_ref),
  };
}

// ------------------------------------------------------------------------------------------
// Discovery cards (WO-009A): one saved-state batch per page of results.
// ------------------------------------------------------------------------------------------

/** A page of a list as it arrived; `receivedAt` changes whenever the page is read again. */
export type ListPage<I> = { receivedAt: number; items: readonly I[] };

/**
 * The targets of each page, each once across the whole list, split at the API's ceiling: a
 * page of 20 Products is one batch; the next page is one more; a target already asked for on
 * an earlier page is not asked for again.
 */
export function batchTargets<I>(pages: readonly ListPage<I>[], targetOf: (item: I) => SaveTarget | null) {
  const seen = new Set<string>();
  const batches: Array<{ receivedAt: number; targets: SaveTarget[] }> = [];
  for (const page of pages) {
    const fresh: SaveTarget[] = [];
    for (const item of page.items) {
      const target = targetOf(item);
      if (!target || seen.has(targetKey(target))) continue;
      seen.add(targetKey(target));
      fresh.push(target);
    }
    for (let i = 0; i < fresh.length; i += SAVED_STATE_MAX) {
      batches.push({ receivedAt: page.receivedAt, targets: fresh.slice(i, i + SAVED_STATE_MAX) });
    }
  }
  return batches;
}

export type CardSaveEntry = {
  status: 'loading' | 'ready' | 'error';
  /** The page's batch is being read (again). */
  fetching: boolean;
  item: SavedItem | undefined;
  defaultRef: string | undefined;
  retry: () => void;
};
export type CardSaves = { surface: SaveSurface; entry: (target: SaveTarget) => CardSaveEntry };
/** How a list's items become Save targets, and which surface the list is (source_surface). */
export type ListSaves<I> = { surface: SaveSurface; target: (item: I) => SaveTarget | null };

const LOADING: CardSaveEntry = { status: 'loading', fetching: true, item: undefined, defaultRef: undefined, retry: () => undefined };
// Module-level so TanStack keeps the combined result stable while no batch changes.
const combinePages = (results: UseQueryResult<SavedState>[]) =>
  results.map((r) => ({ data: r.data, failed: r.isError, fetching: r.isFetching, refetch: r.refetch }));

/**
 * The saved state of every card in a list, read once per page of results (PublicListView). A
 * page read again (a pull, a return from the background, a refresh on return) is a new batch;
 * a re-render is not. Guests read nothing. `saves.target` must be a stable function.
 */
export function useCardSaves<I>(pages: readonly ListPage<I>[], saves: ListSaves<I> | undefined): CardSaves | null {
  const { session, boundApi } = useSession();
  const token = session.status === 'signedIn' ? session.token : null;
  const targetOf = saves?.target;
  const surface = saves?.surface;
  const batches = useMemo(() => (targetOf && token ? batchTargets(pages, targetOf) : []), [pages, targetOf, token]);
  const results = useQueries({
    queries: batches.map((b) => ({
      queryKey: [SAVED_STATE, 'page', b.receivedAt, ...b.targets.map(targetKey)],
      queryFn: () => readSavedState(boundApi(token!), b.targets),
      enabled: token !== null,
      // The page decides freshness: a re-read page is a new key; Save and Remove update in place.
      staleTime: Infinity,
      gcTime: 0,
      retry,
    })),
    combine: combinePages,
  });
  return useMemo(() => {
    if (!surface) return null;
    const lookup = new Map<string, CardSaveEntry>();
    batches.forEach((b, n) => {
      const r = results[n];
      if (!r) return;
      const answered = new Map((r.data?.items ?? []).map((i) => [targetKey(i), i]));
      for (const target of b.targets) {
        lookup.set(targetKey(target), {
          status: r.data ? 'ready' : r.failed ? 'error' : 'loading',
          fetching: r.fetching,
          item: answered.get(targetKey(target)),
          defaultRef: r.data?.default_collection_ref,
          retry: () => void r.refetch(),
        });
      }
    });
    return { surface, entry: (target: SaveTarget) => lookup.get(targetKey(target)) ?? LOADING };
  }, [surface, batches, results]);
}

/** Provided by a list whose cards can be saved; a card outside one shows no Save. */
export const CardSavesContext = createContext<CardSaves | null>(null);

/** One card's Save: its page's answer and the shared one-tap mutation. Null outside a list. */
export function useCardSave(target: SaveTarget) {
  const saves = useContext(CardSavesContext);
  const entry = saves?.entry(target) ?? LOADING;
  const save = useSaveMutation(target, saves?.surface ?? 'SAVED', null);
  if (!saves) return null;
  return {
    surface: saves.surface,
    status: entry.status,
    fetching: entry.fetching,
    saved: entry.item?.saved ?? false,
    busy: save.busy,
    removing: save.removing,
    error: save.error,
    retry: entry.retry,
    toggle: () => save.toggle(entry.item, entry.defaultRef),
  };
}

/**
 * Finish a guest's Save after the sign-in it started (S16; WO-009A S9). Any sign-in consumes
 * the armed Save: it is completed only for the nonce that sign-in carried, through a client
 * bound to the credential that sign-in returned, after the server re-checks the target, and
 * dropped otherwise. A session change part-way refuses the next request before it is sent; a
 * refusal (the target is no longer public) saves nothing; the screen then shows the server's state.
 */
export async function completePendingSave(bound: BoundApi, qc: QueryClient, nonce: string | null): Promise<void> {
  const store = useUiStore.getState();
  const armed = store.pendingSave;
  store.setPendingSave(null);
  if (!nonce || armed?.nonce !== nonce) return;
  try {
    const s = await bound.savedState([armed.target]);
    if (!s.items[0]?.saved) {
      await bound.addToCollection(s.default_collection_ref, saveBody(armed.target, armed.surface, armed.sceneRef), newIdempotencyKey());
    }
  } catch (failure) {
    console.warn('[saved] the Save after sign-in was not completed:', failure instanceof Error ? failure.name : 'unknown error');
  } finally {
    // Also every read still on its way: a list re-read at sign-in may have asked before the Save (review R3).
    if (bound.isCurrent()) await qc.invalidateQueries({ queryKey: [SAVED_STATE], predicate: (q) => pending(q) || holds(q, armed.target) });
  }
}
