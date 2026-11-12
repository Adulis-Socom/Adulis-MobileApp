import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { newIdempotencyKey, problemCode, type Collection, type SaveSurface, type SaveTarget } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { AlertText } from '../components/AlertText';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { isPublicRef } from './public-read';
import { usePublicList } from './public-list';
import { NewCollection } from './SavedScreen';
import { SAVED_STATE, collectionName, keepIfCurrent, saveBody, usePrivateApi, useSavedState } from './saved';

const SURFACES: readonly SaveSurface[] = ['PRODUCT_DETAIL', 'SCENE_EXPLORER', 'SEARCH', 'SHOP', 'SELLER_PROFILE', 'FOR_YOU', 'SAVED'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The route's parameters are untrusted: a target is typed and shaped, or nothing is shown. */
export function parsePickerParams(p: { type?: unknown; ref?: unknown; surface?: unknown; scene?: unknown }) {
  const target: SaveTarget | null =
    p.type === 'PRODUCT_POST' && typeof p.ref === 'string' && UUID.test(p.ref)
      ? { type: 'PRODUCT_POST', ref: p.ref }
      : p.type === 'SCENE_POST' && isPublicRef(p.ref)
        ? { type: 'SCENE_POST', ref: p.ref }
        : null;
  const surface = SURFACES.find((s) => s === p.surface) ?? null;
  return target && surface ? { target, surface, sceneRef: isPublicRef(p.scene) ? p.scene : null } : null;
}

/**
 * Add to collection (WO-009 S15; ADU-SRC-01 v3.2 S21): every Collection of the Buyer with a tick
 * where the target already is -- Saved and the Buyer's own -- and a new Collection made and filled
 * in one step. Each tick changes on the server first and is drawn from the server's answer; a
 * target may sit in several Collections independently.
 *
 * One change at a time (WO-018, A-006): while a tick is in flight every box and New collection are
 * disabled -- announced, not only dimmed -- the box in flight is busy, and the result is spoken.
 */
export function SaveToCollection({ params }: { params: ReturnType<typeof parsePickerParams> }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const priv = usePrivateApi();
  const state = useSavedState(params?.target ?? null);
  const collections = usePublicList({
    resource: ['collections'],
    read: params && priv ? (cursor) => keepIfCurrent(priv, (a) => a.collections(cursor)) : null,
    items: (page) => page.data,
    keyOf: (c: Collection) => c.ref,
  });
  const { hasNextPage, loadMore } = collections;
  useEffect(() => {
    if (hasNextPage) loadMore();
  }, [hasNextPage, loadMore, collections.items.length]);
  const [busy, setBusy] = useState<string | null>(null);
  // A ref as well as the state: two taps in one frame both see busy=null.
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  if (!params) {
    return (
      <View style={{ flex: 1, padding: theme.space.lg, backgroundColor: theme.color.bg }}>
        <AlertText>{t('buyer.save.target_gone')}</AlertText>
      </View>
    );
  }
  const memberships = state.data?.items[0]?.memberships ?? [];

  // Bound to the session of the tick (WO-010, ON-112): after a sign-out or another sign-in nothing
  // more is sent, read or drawn for it.
  const toggle = async (collectionRef: string, add: boolean, name: string) => {
    if (inFlight.current || !priv) return;
    inFlight.current = true;
    setBusy(collectionRef);
    setError(null);
    let changed = false;
    try {
      if (add) {
        // Each tick its own key: the membership itself is idempotent on the server (review D3).
        await priv.addToCollection(collectionRef, saveBody(params.target, params.surface, params.sceneRef), newIdempotencyKey());
      } else {
        const held = memberships.find((m) => m.collection_ref === collectionRef);
        if (held) await priv.removeFromCollection(collectionRef, held.item_ref);
      }
      changed = true;
    } catch (failure) {
      if (priv.isCurrent()) {
        setError(problemCode(failure) === 'NOT_FOUND' ? t('buyer.save.target_gone') : `${t('buyer.save.failed')} ${failureMessage(t, failure)}`);
      }
    } finally {
      if (priv.isCurrent()) {
        await qc.invalidateQueries({ queryKey: [SAVED_STATE] });
        collections.refresh();
        // After the re-read, so the tick the Buyer hears about is the one now drawn.
        if (changed) AccessibilityInfo.announceForAccessibility(fillSlots(t(add ? 'buyer.save.added_to' : 'buyer.save.removed_from'), { name }) ?? '');
      }
      inFlight.current = false;
      setBusy(null);
    }
  };

  const loading = state.data === undefined || (collections.items.length === 0 && collections.status === 'pending');
  const readFailure = state.status === 'error' ? state.error : collections.status === 'error' ? collections.error : null;
  return (
    <ScrollView
      testID="save-to-collection"
      style={{ backgroundColor: theme.color.bg }}
      contentContainerStyle={{ padding: theme.space.md, paddingBottom: theme.space.md + insets.bottom, gap: theme.space.md }}
      keyboardShouldPersistTaps="handled"
    >
      {readFailure ? (
        <View style={{ gap: theme.space.sm }}>
          <AlertText>{failureMessage(t, readFailure)}</AlertText>
          <Button label={t('common.retry')} onPress={() => { void state.refetch(); collections.retry(); }} />
        </View>
      ) : loading ? (
        <ActivityIndicator color={theme.color.accent} accessibilityLabel={t('common.loading')} />
      ) : (
        <View style={{ gap: theme.space.xs }} testID="picker-collections">
          {collections.items.map((c) => {
            const held = memberships.some((m) => m.collection_ref === c.ref);
            const name = collectionName(c, t);
            return (
              <View key={c.ref} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}>
                <View style={{ flex: 1 }}>
                  <Checkbox
                    label={name}
                    checked={held}
                    disabled={busy !== null}
                    busy={busy === c.ref}
                    onChange={(next) => void toggle(c.ref, next, name)}
                  />
                </View>
                {/* Drawn only: the box itself says it is busy. */}
                {busy === c.ref ? <ActivityIndicator color={theme.color.accent} importantForAccessibility="no" accessibilityElementsHidden /> : null}
              </View>
            );
          })}
        </View>
      )}
      {error ? <AlertText>{error}</AlertText> : null}
      <NewCollection disabled={busy !== null} onCreated={(created, name) => void toggle(created.ref, true, name)} />
      <Button label={t('buyer.save.done')} variant="secondary" onPress={() => router.back()} />
    </ScrollView>
  );
}
