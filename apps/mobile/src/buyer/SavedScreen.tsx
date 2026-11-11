import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { newIdempotencyKey, problemCode, wasAnswered, type Collection, type CollectionCreated, type CollectionItem, type ItemFilter } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { usePublicList } from './public-list';
import { PublicListView } from './PublicListView';
import { SavedItemCard } from './SavedItemCard';
import { collectionName } from './saved';

const TABS = [
  { value: 'ALL', key: 'buyer.saved.tab.recent' },
  { value: 'PRODUCT_POST', key: 'buyer.saved.tab.products' },
  { value: 'SCENE_POST', key: 'buyer.saved.tab.scenes' },
] as const;

/**
 * Saved (WO-009 S13; ADU-MOB-02 v4.3 S39): the signed-in Buyer's Collections -- Saved first, then
 * their own -- and below them Recent Saves, Saved Products and Saved Scenes across every
 * Collection, newest first, each target once. All from the server; nothing is kept on the device.
 */
export function SavedScreen() {
  const t = useT();
  const theme = useTheme();
  const { api } = useSession();
  const [tab, setTab] = useState<ItemFilter>('ALL');
  const collections = usePublicList({
    resource: ['collections'],
    read: (cursor) => api.collections(cursor),
    items: (page) => page.data,
    keyOf: (c: Collection) => c.ref,
  });
  const saves = usePublicList({
    resource: ['saved-items', tab],
    read: (cursor) => api.savedItems(tab, cursor),
    items: (page) => page.data,
    keyOf: (i: CollectionItem) => i.ref,
  });
  const refreshAll = useCallback(() => {
    collections.refresh();
    saves.refresh();
  }, [collections.refresh, saves.refresh]);
  // Back from a Product, a Scene, a Collection or the picker: read again (this or another device may have changed it).
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refreshAll();
      focused.current = true;
    }, [refreshAll]),
  );

  const header = (
    <View style={{ gap: theme.space.md, paddingHorizontal: theme.space.xs, paddingTop: theme.space.sm, paddingBottom: theme.space.sm }}>
      <AppText variant="heading" accessibilityRole="header">
        {t('buyer.tab.saved')}
      </AppText>
      <AppText style={{ color: theme.color.textSecondary }}>{t('buyer.saved.private')}</AppText>
      <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
        {t('buyer.saved.collections')}
      </AppText>
      <CollectionsSection list={collections} />
      <NewCollection onCreated={collections.refresh} />
      <FilterTabs tabs={TABS} value={tab} onChange={setTab} label={t('buyer.saved.tabs')} />
    </View>
  );
  return (
    <PublicListView
      list={saves}
      keyOf={(i) => i.ref}
      numColumns={2}
      header={header}
      renderItem={({ item }) => <SavedItemCard item={item} />}
      empty="buyer.saved.empty"
      loading="buyer.saved.loading"
      testID="saved-list"
      label={t('buyer.saved.tabs')}
      onRefresh={refreshAll}
    />
  );
}

function CollectionsSection({ list }: { list: ReturnType<typeof usePublicList<{ next_cursor: string | null }, Collection>> }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  // Every Collection, page by page (50 each): a Buyer chooses among all of them.
  const { hasNextPage, loadMore } = list;
  useEffect(() => {
    if (hasNextPage) loadMore();
  }, [hasNextPage, loadMore, list.items.length]);
  if (list.items.length === 0) {
    if (list.status === 'error' || list.paused) {
      return (
        <View style={{ gap: theme.space.sm }}>
          <AppText accessibilityRole="alert">{`${t('buyer.saved.collections_failed')} ${failureMessage(t, list.error)}`}</AppText>
          <Button label={t('common.retry')} variant="secondary" onPress={list.retry} />
        </View>
      );
    }
    return <ActivityIndicator color={theme.color.accent} accessibilityLabel={t('common.loading')} />;
  }
  return (
    <View style={{ gap: theme.space.sm }} testID="saved-collections">
      {list.items.map((c) => {
        const name = collectionName(c, t);
        const counts = fillSlots(t('buyer.saved.counts'), { products: c.product_count, scenes: c.scene_count }) ?? '';
        return (
          <Pressable
            key={c.ref}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${counts}`}
            accessibilityHint={fillSlots(t('buyer.saved.open'), { name }) ?? undefined}
            onPress={() => router.push({ pathname: '/collections/[collectionRef]', params: { collectionRef: c.ref } })}
            style={{
              minHeight: theme.touchTarget,
              padding: theme.space.md,
              borderWidth: 1,
              borderColor: theme.color.border,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.surface,
              gap: theme.space.xs,
            }}
            testID={`collection-row-${c.kind === 'DEFAULT' ? 'default' : 'named'}`}
          >
            <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{name}</AppText>
            <AppText style={{ color: theme.color.textSecondary }}>{counts}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Create a named Collection (WO-009 S14). The name is checked as the server checks it (1-60
 * characters once trimmed); the server's answer still decides. Returns the new Collection.
 */
export function NewCollection({ onCreated }: { onCreated: (created: CollectionCreated) => void }) {
  const t = useT();
  const theme = useTheme();
  const { api } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const intent = useRef<{ name: string; key: string } | null>(null);
  if (!open) return <Button label={t('buyer.saved.new')} variant="secondary" onPress={() => setOpen(true)} />;
  const create = async () => {
    const trimmed = name.replace(/\s+/g, ' ').trim();
    if (Array.from(trimmed).length < 1 || Array.from(trimmed).length > 60) {
      setError(t('buyer.saved.name_invalid'));
      return;
    }
    if (intent.current?.name !== trimmed) intent.current = { name: trimmed, key: newIdempotencyKey() };
    setBusy(true);
    setError(null);
    try {
      const created = await api.createCollection(trimmed, intent.current.key);
      intent.current = null;
      setOpen(false);
      setName('');
      onCreated(created);
    } catch (failure) {
      if (wasAnswered(failure)) intent.current = null;
      setError(problemCode(failure) === 'VALIDATION_FAILED' ? t('buyer.saved.name_invalid') : failureMessage(t, failure));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: theme.space.sm }} testID="new-collection">
      <TextField label={t('buyer.saved.name')} value={name} onChangeText={setName} error={error} maxLength={120} autoFocus testID="new-collection-name" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <View style={{ flexGrow: 1 }}>
          <Button label={t('buyer.saved.create')} disabled={busy} onPress={() => void create()} />
        </View>
        <View style={{ flexGrow: 1 }}>
          <Button label={t('buyer.saved.cancel')} variant="secondary" disabled={busy} onPress={() => { setOpen(false); setError(null); }} />
        </View>
      </View>
    </View>
  );
}

/** A row of tabs over one list (the Search and Seller Profile pattern). */
export function FilterTabs<V extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: ReadonlyArray<{ value: V; key: Parameters<ReturnType<typeof useT>>[0] }>;
  value: V;
  onChange: (value: V) => void;
  label: string;
}) {
  const t = useT();
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: theme.color.border }}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.value)}
            testID={`filter-tab-${tab.value}`}
            style={{ flex: 1, minHeight: theme.touchTarget, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderColor: selected ? theme.color.accent : 'transparent' }}
          >
            <AppText style={{ textAlign: 'center', fontWeight: selected ? theme.fontWeight.semibold : undefined }}>{t(tab.key)}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
