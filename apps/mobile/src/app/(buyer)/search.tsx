// Marketplace Search: Products, Sellers and Scenes, never anything else. The query is folded to NFKC on the device (Unicode
// search reliability, carried from the archive) and sent as typed text: no suggestions, no history, no telemetry. The length
// limits are PROVISIONAL named constants (launch search settings await the founder, DEC-IJ-09); they guard the request and
// never reject on the server's behalf. A late answer to an older query is never shown: the key carries the query and the type.
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { SearchItem, SearchType } from '../../contracts/gap-mob-discovery';
import { PagedList, ProductTileView, SceneCard } from '../../discovery/components';
import { usePaged } from '../../discovery/hooks';
import { prepareQuery, type QueryProblem } from '../../discovery/search-query';
import { t, type UiMessageKey } from '../../i18n/messages';
import { Body, Button, Field, Heading, Notice, Screen } from '../../ui/components';
import { theme } from '../../ui/theme';

const PROBLEM_TEXT = { too_short: 'mobile.search.too_short', too_long: 'mobile.search.too_long', no_terms: 'mobile.search.no_terms' } as const;

const TABS: readonly { readonly type: SearchType; readonly label: UiMessageKey }[] = [
  { type: 'TOP', label: 'mobile.search.tab.top' },
  { type: 'PRODUCT_POST', label: 'mobile.search.tab.products' },
  { type: 'SCENE_POST', label: 'mobile.search.tab.scenes' },
  { type: 'SELLER', label: 'mobile.search.tab.sellers' },
];

function Results({ q, type }: { readonly q: string; readonly type: SearchType }) {
  const router = useRouter();
  const query = usePaged('search.query', { q, type }, { scope: 'public' });
  const unresolved = query.data?.pages[0]?.marketState === 'UNRESOLVED';
  return (
    <PagedList<SearchItem>
      query={query}
      keyOf={(item) => (item.kind === 'PRODUCT_POST' ? item.product.productRef : item.kind === 'SCENE_POST' ? item.scene.sceneRef : item.seller.sellerRef)}
      empty={t('mobile.search.no_results')}
      header={unresolved ? <Notice text={t('mobile.market.unresolved')} /> : null}
      renderItem={(item) => {
        if (item.kind === 'PRODUCT_POST') return <ProductTileView product={item.product} onOpen={() => router.push(`/product/${item.product.productRef}`)} />;
        if (item.kind === 'SCENE_POST') return <SceneCard scene={item.scene} onExplore={() => router.push(`/scenes/${item.scene.sceneRef}`)} />;
        return <Button kind="secondary" label={item.seller.storeName} onPress={() => router.push(`/sellers/${item.seller.sellerRef}`)} />;
      }}
    />
  );
}

export default function Search() {
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [problem, setProblem] = useState<QueryProblem | null>(null);
  const [type, setType] = useState<SearchType>('TOP');

  const submit = () => {
    const prepared = prepareQuery(draft);
    setProblem(prepared.problem);
    setSubmitted(prepared.problem === null ? prepared.q : null);
  };

  return (
    <Screen>
      <Heading>{t('mobile.search.title')}</Heading>
      <Field label={t('mobile.search.field')} value={draft} onChangeText={setDraft} onSubmitEditing={submit} returnKeyType="search" autoCapitalize="none" />
      <Button label={t('mobile.search.go')} onPress={submit} disabled={draft.trim() === ''} />
      {problem && problem !== 'empty' ? <Notice tone="warn" text={t(PROBLEM_TEXT[problem])} /> : null}
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map(({ type: key, label }) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityLabel={t(label)} accessibilityState={{ selected: type === key }} onPress={() => setType(key)} style={[styles.tab, type === key && styles.tabActive]}>
            <Text style={[styles.tabText, type === key && styles.tabTextActive]}>{t(label)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>{submitted === null ? <Body muted>{t('mobile.search.hint')}</Body> : <Results q={submitted} type={type} />}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm },
  tab: { minHeight: theme.touch, paddingHorizontal: theme.space.md, justifyContent: 'center', borderRadius: theme.radius.full, backgroundColor: theme.color.secondary, borderWidth: 1, borderColor: theme.color.borderStrong },
  tabActive: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  tabText: { ...theme.text.body, color: theme.color.secondaryText },
  tabTextActive: { color: theme.color.primaryText, fontWeight: '600' },
});
