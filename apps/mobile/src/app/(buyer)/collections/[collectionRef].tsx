// One private Collection: open, rename, delete (with a confirmation), add what this Account saved, remove members. AUTHENTICATED
// and Account-rooted: another Account's Collection, a deleted one and a missing one are the same neutral sentence. A member that
// stopped being public shows one neutral sentence and no name, store, caption or picture, and can still be removed. Every change
// is server-confirmed and re-read; a change that died because the session changed says nothing.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { CollectionItem, CollectionItemRef } from '../../../contracts/gap-mob-engagement';
import { SessionChanged, type MobileOpId, type MobileOps } from '../../../contracts/gap-mob-session';
import { ProductTileView, SceneCard, Section } from '../../../discovery/components';
import { problemKind, useRead } from '../../../discovery/hooks';
import { validRef } from '../../../discovery/params';
import { t } from '../../../i18n/messages';
import { useApp } from '../../../providers/AppProvider';
import { newIntentKey } from '../../../session/intent-key';
import { Body, Button, Field, Heading, Notice, Screen, StateView } from '../../../ui/components';
import { Guard } from '../../../ui/Guard';
import { theme } from '../../../ui/theme';

type Change =
  | { readonly op: 'collection.rename'; readonly input: MobileOps['collection.rename']['in'] }
  | { readonly op: 'collection.delete'; readonly input: MobileOps['collection.delete']['in'] }
  | { readonly op: 'collection.item.add'; readonly input: MobileOps['collection.item.add']['in'] }
  | { readonly op: 'collection.item.remove'; readonly input: MobileOps['collection.item.remove']['in'] };

const keyOf = (item: CollectionItemRef) => `${item.kind}:${item.ref}`;
const refOf = (item: CollectionItem): CollectionItemRef =>
  item.kind === 'SCENE_POST' ? { kind: 'SCENE_POST', ref: item.scene.sceneRef } : item.kind === 'PRODUCT_POST' ? { kind: 'PRODUCT_POST', ref: item.product.productRef } : item.item;

function CollectionContent({ collectionRef }: { readonly collectionRef: string }) {
  const router = useRouter();
  const { runtime } = useApp();
  const client = useQueryClient();
  const collection = useRead('collection.get', { collectionRef }, { scope: 'subject' });
  const saved = useRead('saved.list.get', {}, { scope: 'subject' });
  const [name, setName] = useState('');
  const [confirming, setConfirming] = useState(false);
  const change = useMutation({
    mutationFn: (c: Change) => (runtime as NonNullable<typeof runtime>).session.call(c.op as MobileOpId, c.input as never, { idempotencyKey: newIntentKey() }),
    onSuccess: (_out, c) => {
      if (c.op === 'collection.delete') router.replace('/saved');
      if (c.op === 'collection.rename') setName('');
    },
    onSettled: () => client.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'acct' }),
  });
  const failed = change.isError && !(change.error instanceof SessionChanged);
  const busy = change.isPending;

  if (collection.status === 'pending') return <StateView kind="loading" />;
  if (collection.status === 'error') {
    if (problemKind(collection.error) === 'gone') return <StateView kind="not-found" message={t('mobile.collections.gone')} action={{ label: t('mobile.saved.back'), onPress: () => router.replace('/saved') }} />;
    return <StateView kind="error" onRetry={() => void collection.refetch()} />;
  }

  const { items } = collection.data;
  const members = new Set(items.map((item) => keyOf(refOf(item))));
  const addable: { readonly item: CollectionItemRef; readonly label: string }[] =
    saved.status === 'success'
      ? [
          ...saved.data.scenes.map((s) => ({ item: { kind: 'SCENE_POST' as const, ref: s.sceneRef }, label: s.caption })),
          ...saved.data.products.map((p) => ({ item: { kind: 'PRODUCT_POST' as const, ref: p.productRef }, label: p.name })),
        ].filter((entry) => !members.has(keyOf(entry.item)))
      : [];
  const remove = (item: CollectionItemRef) => change.mutate({ op: 'collection.item.remove', input: { collectionRef, item } });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Heading>{collection.data.collection.name}</Heading>
      {failed ? <Notice tone="warn" text={t('mobile.engagement.not_confirmed')} /> : null}
      {items.length === 0 ? <Body muted>{t('mobile.collections.empty_items')}</Body> : null}
      {items.map((item) => {
        const ref = refOf(item);
        if (item.kind === 'SCENE_POST') {
          return (
            <View key={keyOf(ref)} style={styles.member}>
              <SceneCard scene={item.scene} onExplore={() => router.push(`/scenes/${item.scene.sceneRef}`)} />
              <Button kind="secondary" busy={busy} label={t('mobile.collections.remove', { name: item.scene.caption })} onPress={() => remove(ref)} />
            </View>
          );
        }
        if (item.kind === 'PRODUCT_POST') {
          return (
            <View key={keyOf(ref)} style={styles.member}>
              <ProductTileView product={item.product} onOpen={() => router.push(`/product/${item.product.productRef}`)} />
              <Button kind="secondary" busy={busy} label={t('mobile.collections.remove', { name: item.product.name })} onPress={() => remove(ref)} />
            </View>
          );
        }
        return (
          <View key={keyOf(ref)} style={styles.member}>
            <Body muted>{t('mobile.collections.item_unavailable')}</Body>
            <Button kind="secondary" busy={busy} label={t('mobile.collections.remove_unavailable')} onPress={() => remove(ref)} />
          </View>
        );
      })}
      <Section title={t('mobile.collections.add_from_saved')}>
        {saved.status === 'success' && addable.length === 0 ? <Body muted>{t('mobile.collections.nothing_to_add')}</Body> : null}
        {addable.map((entry) => (
          <Button key={keyOf(entry.item)} kind="secondary" busy={busy} label={t('mobile.collections.add', { name: entry.label })} onPress={() => change.mutate({ op: 'collection.item.add', input: { collectionRef, item: entry.item } })} />
        ))}
      </Section>
      <Section title={t('mobile.collections.rename')}>
        <Field label={t('mobile.collections.name')} value={name} onChangeText={setName} />
        <Button kind="secondary" busy={busy} disabled={name.trim() === ''} label={t('mobile.collections.rename')} onPress={() => change.mutate({ op: 'collection.rename', input: { collectionRef, name } })} />
      </Section>
      {confirming ? (
        <View style={styles.member}>
          <Body>{t('mobile.collections.delete_confirm')}</Body>
          <Button busy={busy} label={t('mobile.collections.delete_yes')} onPress={() => change.mutate({ op: 'collection.delete', input: { collectionRef } })} />
          <Button kind="secondary" label={t('mobile.collections.cancel')} onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <Button kind="secondary" label={t('mobile.collections.delete')} onPress={() => setConfirming(true)} />
      )}
    </ScrollView>
  );
}

export default function CollectionScreen() {
  const router = useRouter();
  const { collectionRef } = useLocalSearchParams<{ collectionRef?: string }>();
  const ref = validRef(collectionRef);
  return (
    <Screen>
      {ref === null ? (
        <StateView kind="not-found" message={t('mobile.collections.gone')} action={{ label: t('mobile.saved.back'), onPress: () => router.replace('/saved') }} />
      ) : (
        <Guard template="/collections/[collectionRef]">
          <CollectionContent collectionRef={ref} />
        </Guard>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl },
  member: { gap: theme.space.sm },
});
