// Saved: what this Account saved (Scenes and Products) and its private Collections. GUEST_PROMPT: a guest sees the sign-in panel
// and nothing private. Account-rooted reads, so signing out or switching removes them before anyone else can see them.
// A Collection can be created and listed here; renaming, deleting and adding or removing items are a later slice.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { ProductTile, SceneCardUnit } from '../../../contracts/gap-mob-discovery';
import { ProductTileView, SceneCard, Section } from '../../../discovery/components';
import { useRead } from '../../../discovery/hooks';
import { SceneActions } from '../../../engagement/controls';
import { t } from '../../../i18n/messages';
import { useApp } from '../../../providers/AppProvider';
import { newIntentKey } from '../../../session/intent-key';
import { AppNotices } from '../../../ui/AppNotices';
import { Body, Button, Field, Heading, Notice, Screen, StateView } from '../../../ui/components';
import { Guard } from '../../../ui/Guard';
import { theme } from '../../../ui/theme';

function SavedContent() {
  const router = useRouter();
  const { runtime } = useApp();
  const client = useQueryClient();
  const saved = useRead('saved.list.get', {}, { scope: 'subject' });
  const collections = useRead('collections.list.get', {}, { scope: 'subject' });
  const [name, setName] = useState('');
  const create = useMutation({
    mutationFn: () => (runtime as NonNullable<typeof runtime>).session.call('collection.create', { name }, { idempotencyKey: newIntentKey() }),
    onSuccess: () => setName(''),
    onSettled: () => client.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'acct' }),
  });

  if (saved.status === 'pending') return <StateView kind="loading" />;
  if (saved.status === 'error') return <StateView kind="error" onRetry={() => void saved.refetch()} />;
  const scenes: readonly SceneCardUnit[] = saved.data.scenes;
  const products: readonly ProductTile[] = saved.data.products;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      {scenes.length === 0 && products.length === 0 ? <Body muted>{t('mobile.saved.empty')}</Body> : null}
      {scenes.length > 0 ? (
        <Section title={t('mobile.saved.scenes')}>
          {scenes.map((scene) => (
            <SceneCard key={scene.sceneRef} scene={scene} onExplore={() => router.push(`/scenes/${scene.sceneRef}`)} actions={<SceneActions scene={scene} />} />
          ))}
        </Section>
      ) : null}
      {products.length > 0 ? (
        <Section title={t('mobile.saved.products')}>
          {products.map((product) => (
            <ProductTileView key={product.productRef} product={product} onOpen={() => router.push(`/product/${product.productRef}`)} />
          ))}
        </Section>
      ) : null}
      <Section title={t('mobile.collections.title')}>
        {collections.status === 'success' && collections.data.collections.length === 0 ? <Body muted>{t('mobile.collections.empty')}</Body> : null}
        {collections.status === 'success' ? collections.data.collections.map((c) => <Button key={c.collectionRef} kind="secondary" label={c.name} onPress={() => router.push(`/collections/${c.collectionRef}`)} />) : null}
        <Field label={t('mobile.collections.name')} value={name} onChangeText={setName} />
        {create.isError ? <Notice tone="warn" text={t('mobile.engagement.not_confirmed')} /> : null}
        <Button label={t('mobile.collections.create')} disabled={name.trim() === ''} busy={create.isPending} onPress={() => create.mutate()} />
      </Section>
    </ScrollView>
  );
}

export default function Saved() {
  return (
    <Screen>
      <AppNotices />
      <Guard template="/saved">
        <View style={{ flex: 1, gap: theme.space.md }}>
          <Heading>{t('mobile.tab.saved')}</Heading>
          <SavedContent />
        </View>
      </Guard>
    </Screen>
  );
}

const styles = StyleSheet.create({ scroll: { gap: theme.space.md, paddingBottom: theme.space.xl } });
