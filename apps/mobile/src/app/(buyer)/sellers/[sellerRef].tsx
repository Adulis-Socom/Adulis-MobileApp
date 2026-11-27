// Seller profile: opens on Scenes. Each tab is its own list; a 404 in any is one neutral state. Reviews are an honest
// unavailable state (no owner for the read projection, GAP-L2-03); no handoff counts, no rates, no review summary, no
// client rule over a status (open/closed is an explicit server flag). Follow arrives with MOB-FE-03.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ProductTile, SceneCardUnit } from '../../../contracts/gap-mob-discovery';
import { PagedList, ProductTileView, SceneCard } from '../../../discovery/components';
import { trustText } from '../../../discovery/format';
import { problemKind, usePaged, useRead } from '../../../discovery/hooks';
import { validRef } from '../../../discovery/params';
import { t, type UiMessageKey } from '../../../i18n/messages';
import { Body, Heading, Screen, StateView } from '../../../ui/components';
import { theme } from '../../../ui/theme';

type Tab = 'scenes' | 'products' | 'reviews' | 'about';
const TABS: readonly { readonly key: Tab; readonly label: UiMessageKey }[] = [
  { key: 'scenes', label: 'mobile.seller.tab.scenes' },
  { key: 'products', label: 'mobile.seller.tab.products' },
  { key: 'reviews', label: 'mobile.seller.tab.reviews' },
  { key: 'about', label: 'mobile.seller.tab.about' },
];

function ScenesTab({ sellerRef }: { readonly sellerRef: string }) {
  const router = useRouter();
  const query = usePaged('seller.scenes.page', { sellerRef }, { scope: 'public' });
  return <PagedList<SceneCardUnit> query={query} keyOf={(s) => s.sceneRef} accept={(s) => s.type === 'SCENE_POST'} renderItem={(scene) => <SceneCard scene={scene} onExplore={() => router.push(`/scenes/${scene.sceneRef}`)} />} />;
}

function ProductsTab({ sellerRef }: { readonly sellerRef: string }) {
  const router = useRouter();
  const query = usePaged('seller.products.page', { sellerRef }, { scope: 'public' });
  return <PagedList<ProductTile> query={query} keyOf={(p) => p.productRef} renderItem={(product) => <ProductTileView product={product} onOpen={() => router.push(`/product/${product.productRef}`)} />} />;
}

export default function SellerProfileRoute() {
  const router = useRouter();
  const { sellerRef } = useLocalSearchParams<{ sellerRef?: string }>();
  const ref = validRef(sellerRef);
  const [tab, setTab] = useState<Tab>('scenes');
  const query = useRead('seller.get', { sellerRef: ref ?? '' }, { enabled: ref !== null });

  if (ref === null || (query.status === 'error' && problemKind(query.error) === 'gone')) {
    return <Screen><StateView kind="not-found" message={t('mobile.seller.gone')} action={{ label: t('mobile.state.go_home'), onPress: () => router.replace('/home') }} /></Screen>;
  }
  if (query.status === 'pending') return <Screen><StateView kind="loading" /></Screen>;
  if (query.status === 'error') return <Screen><StateView kind={problemKind(query.error) === 'offline' ? 'offline' : 'error'} onRetry={() => void query.refetch()} /></Screen>;

  const seller = query.data.seller;
  const trust = trustText(seller.trustLevel);
  return (
    <Screen>
      <Heading>{seller.storeName}</Heading>
      {seller.isOpen === null ? null : <Text style={styles.small}>{t(seller.isOpen ? 'mobile.seller.open' : 'mobile.seller.closed')}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={styles.tabScroll} contentContainerStyle={styles.tabs}>
        {TABS.map(({ key, label }) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityLabel={t(label)} accessibilityState={{ selected: tab === key }} onPress={() => setTab(key)} style={[styles.tab, tab === key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{t(label)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flex: 1 }}>
        {tab === 'scenes' ? <ScenesTab sellerRef={ref} /> : null}
        {tab === 'products' ? <ProductsTab sellerRef={ref} /> : null}
        {tab === 'reviews' ? <StateView kind="empty" message={t('mobile.seller.reviews_unavailable')} /> : null}
        {tab === 'about' ? (
          <View style={{ gap: theme.space.sm }}>
            <Body>{seller.description}</Body>
            {trust ? <Body muted>{trust}</Body> : null}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  small: { ...theme.text.small, color: theme.color.textSecondary },
  tabScroll: { flexGrow: 0 },
  tabs: { gap: theme.space.sm },
  tab: { minHeight: theme.touch, paddingHorizontal: theme.space.md, justifyContent: 'center', borderRadius: theme.radius.full, backgroundColor: theme.color.secondary, borderWidth: 1, borderColor: theme.color.borderStrong },
  tabActive: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  tabText: { ...theme.text.body, color: theme.color.secondaryText },
  tabTextActive: { color: theme.color.primaryText, fontWeight: '600' },
});
