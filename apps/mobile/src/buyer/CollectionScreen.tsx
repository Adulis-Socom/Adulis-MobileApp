import { useQueryClient } from '@tanstack/react-query';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, View } from 'react-native';

import { problemCode, type CollectionDetail, type CollectionItem, type ItemFilter } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { AlertText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { usePublicList } from './public-list';
import { PublicListView } from './PublicListView';
import { SavedItemCard } from './SavedItemCard';
import { FilterTabs } from './SavedScreen';
import { SAVED_STATE, collectionName, keepIfCurrent, usePrivateApi } from './saved';

const TABS = [
  { value: 'ALL', key: 'buyer.collection.tab.all' },
  { value: 'PRODUCT_POST', key: 'buyer.saved.tab.products' },
  { value: 'SCENE_POST', key: 'buyer.saved.tab.scenes' },
] as const;

const isRef = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

/**
 * One private Collection (WO-009 S14, S17): its items newest first as the server resolves them
 * now, Remove on each, and -- for a Collection the Buyer named -- Rename and Delete (with a
 * confirmation). Saved, the DEFAULT, can be neither renamed nor deleted. A 404 (deleted here or
 * on another device, or never this Account's) is one neutral state.
 *
 * One change at a time (WO-018, A-006): while a Remove, a Rename or a Delete is in flight the other
 * controls are disabled -- announced, not only dimmed -- and the Remove in flight is busy.
 */
export function CollectionScreen({ collectionRef }: { collectionRef: unknown }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const priv = usePrivateApi();
  const qc = useQueryClient();
  const valid = isRef(collectionRef);
  const [tab, setTab] = useState<ItemFilter>('ALL');
  const [removing, setRemoving] = useState<string | null>(null);
  // One lock for Remove, Rename and Delete, checked first by each (review F3): two taps in one
  // frame both see the state before either, the ref does not.
  const changing = useRef(false);
  // A Rename or Delete in flight (ManageCollection's), for the disabled states.
  const [managing, setManaging] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const list = usePublicList({
    resource: ['collection', valid ? collectionRef : '', tab],
    read: valid && priv ? (cursor) => keepIfCurrent(priv, (a) => a.collection(collectionRef, tab, cursor)) : null,
    items: (page) => page.data,
    keyOf: (i: CollectionItem) => i.ref,
  });
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) list.refresh();
      focused.current = true;
    }, [list.refresh]),
  );
  const collection = (list.firstPage as CollectionDetail | undefined)?.collection;
  const title = collection ? collectionName(collection, t) : '';

  const remove = async (item: CollectionItem) => {
    if (!valid || changing.current || !priv) return;
    changing.current = true;
    setRemoving(item.ref);
    setFailure(null);
    try {
      await priv.removeFromCollection(collectionRef, item.ref);
      // Answered after a sign-out or another sign-in: nothing is read or drawn for that session.
      if (!priv.isCurrent()) return;
      AccessibilityInfo.announceForAccessibility(fillSlots(t('buyer.save.removed_from'), { name: title }) ?? t('buyer.save.removed'));
      list.refresh();
      // Cards in other tabs stay mounted: they read their saved state again (WO-009A).
      void qc.invalidateQueries({ queryKey: [SAVED_STATE] });
    } catch (error) {
      if (priv.isCurrent()) setFailure(`${t('buyer.collection.action_failed')} ${failureMessage(t, error)}`);
    } finally {
      changing.current = false;
      setRemoving(null);
    }
  };

  const header = (
    <View style={{ gap: theme.space.md, paddingHorizontal: theme.space.xs, paddingBottom: theme.space.sm }}>
      {collection ? (
        <>
          <AppText variant="heading" accessibilityRole="header">
            {title}
          </AppText>
          <AppText style={{ color: theme.color.textSecondary }}>
            {`${t('buyer.saved.private')} ${fillSlots(t('buyer.saved.counts'), { products: collection.product_count, scenes: collection.scene_count }) ?? ''}`}
          </AppText>
          {collection.kind === 'USER_CREATED' && valid ? (
            <ManageCollection
              collectionRef={collectionRef}
              name={title}
              onRenamed={list.refresh}
              onDeleted={() => router.back()}
              busy={managing}
              setBusy={setManaging}
              blocked={removing !== null}
              lock={changing}
            />
          ) : null}
        </>
      ) : null}
      {failure ? <AlertText>{failure}</AlertText> : null}
      <FilterTabs tabs={TABS} value={tab} onChange={setTab} label={t('buyer.saved.tabs')} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title }} />
      <PublicListView
        list={list}
        keyOf={(i) => i.ref}
        numColumns={2}
        header={header}
        renderItem={({ item }) => (
          <SavedItemCard item={item} removing={removing === item.ref} disabled={removing !== null || managing} onRemove={() => void remove(item)} />
        )}
        empty="buyer.collection.empty"
        loading="buyer.collection.loading"
        testID="collection-list"
        label={title || t('buyer.saved.collections')}
        blocked={!valid || list.gone ? { message: t('buyer.collection.gone') } : null}
      />
    </>
  );
}

function ManageCollection({
  collectionRef,
  name,
  onRenamed,
  onDeleted,
  busy,
  setBusy,
  blocked,
  lock,
}: {
  collectionRef: string;
  name: string;
  onRenamed: () => void;
  onDeleted: () => void;
  /** Lifted to the screen, so a Remove waits for a Rename or Delete in flight. */
  busy: boolean;
  setBusy: (busy: boolean) => void;
  /** A Remove is in flight. */
  blocked: boolean;
  /** The screen's one-change lock, shared with Remove. */
  lock: { current: boolean };
}) {
  const t = useT();
  const theme = useTheme();
  const priv = usePrivateApi();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const off = busy || blocked;

  const rename = async () => {
    const trimmed = draft.replace(/\s+/g, ' ').trim();
    if (Array.from(trimmed).length < 1 || Array.from(trimmed).length > 60) {
      setError(t('buyer.saved.name_invalid'));
      return;
    }
    if (!priv || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await priv.renameCollection(collectionRef, trimmed);
      if (!priv.isCurrent()) return;
      setRenaming(false);
      onRenamed();
    } catch (failure) {
      if (!priv.isCurrent()) return;
      setError(problemCode(failure) === 'VALIDATION_FAILED' ? t('buyer.saved.name_invalid') : failureMessage(t, failure));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  // The platform's own dialog: announced, focus-managed, and Cancel is the default.
  const confirmDelete = () => {
    if (lock.current) return;
    Alert.alert(fillSlots(t('buyer.collection.delete_title'), { name }) ?? t('buyer.collection.delete'), t('buyer.collection.delete_body'), [
      { text: t('buyer.saved.cancel'), style: 'cancel' },
      {
        text: t('buyer.collection.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          // A change may have started while the dialog was open (or a second dialog was confirmed).
          if (!priv || lock.current) return;
          lock.current = true;
          setBusy(true);
          setError(null);
          try {
            await priv.deleteCollection(collectionRef);
            if (priv.isCurrent()) onDeleted();
          } catch (failure) {
            if (!priv.isCurrent()) return;
            // Already gone (here or on another device): the outcome the Buyer asked for.
            if (problemCode(failure) === 'NOT_FOUND') onDeleted();
            else setError(`${t('buyer.collection.action_failed')} ${failureMessage(t, failure)}`);
          } finally {
            lock.current = false;
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (renaming) {
    return (
      <View style={{ gap: theme.space.sm }} testID="rename-collection">
        <TextField label={t('buyer.saved.name')} value={draft} onChangeText={setDraft} error={error} maxLength={120} autoFocus testID="rename-collection-name" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
          <View style={{ flexGrow: 1 }}>
            <Button label={t('buyer.collection.save_name')} disabled={off} busy={busy} onPress={() => void rename()} />
          </View>
          <View style={{ flexGrow: 1 }}>
            <Button label={t('buyer.saved.cancel')} variant="secondary" disabled={off} onPress={() => { setRenaming(false); setError(null); }} />
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <View style={{ flexGrow: 1 }}>
          <Button label={t('buyer.collection.rename')} variant="secondary" disabled={off} onPress={() => { setDraft(name); setRenaming(true); }} />
        </View>
        <View style={{ flexGrow: 1 }}>
          <Button label={t('buyer.collection.delete')} variant="secondary" disabled={off} busy={busy} onPress={confirmDelete} />
        </View>
      </View>
      {error ? <AlertText>{error}</AlertText> : null}
    </View>
  );
}
