// Shop: Products in the server's order (newest first is the server's rule; the client never sorts). Categories are opaque
// codes the server lists; a category the server refuses falls back to All. PUBLIC: no private request is made.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import type { ProductTile } from '../../../contracts/gap-mob-discovery';
import { PagedList, ProductTileView } from '../../../discovery/components';
import { usePaged, useRead } from '../../../discovery/hooks';
import { t } from '../../../i18n/messages';
import { TransportError } from '../../../transport/port';
import { AppNotices } from '../../../ui/AppNotices';
import { Heading, Notice, Screen } from '../../../ui/components';
import { theme } from '../../../ui/theme';

export default function Shop() {
  const router = useRouter();
  const [category, setCategory] = useState<string | null>(null);
  const categories = useRead('categories.list', {});
  const query = usePaged('shop.products.page', { category }, { scope: 'public' });

  // The server refused this category: fall back to All rather than stay on an empty or error state.
  useEffect(() => {
    if (category !== null && query.status === 'error' && query.error instanceof TransportError && query.error.code === 'VALIDATION_FAILED') setCategory(null);
  }, [category, query.status, query.error]);

  const unresolved = query.data?.pages[0]?.marketState === 'UNRESOLVED';
  const chips: readonly { readonly code: string | null; readonly label: string }[] = [{ code: null, label: t('mobile.shop.all') }, ...(categories.data?.items ?? [])];

  return (
    <Screen>
      <AppNotices />
      <Heading>{t('mobile.tab.shop')}</Heading>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" style={styles.chipScroll} contentContainerStyle={styles.chips}>
        {chips.map((chip) => (
          <Pressable key={chip.code ?? 'all'} accessibilityRole="tab" accessibilityLabel={chip.label} accessibilityState={{ selected: category === chip.code }} onPress={() => setCategory(chip.code)} style={[styles.chip, category === chip.code && styles.chipActive]}>
            <Text style={[styles.chipText, category === chip.code && styles.chipTextActive]}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {unresolved ? <Notice text={t('mobile.market.unresolved')} /> : null}
      <PagedList<ProductTile> query={query} keyOf={(p) => p.productRef} renderItem={(product) => <ProductTileView product={product} onOpen={() => router.push(`/product/${product.productRef}`)} />} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chipScroll: { flexGrow: 0 },
  chips: { gap: theme.space.sm },
  chip: { minHeight: theme.touch, paddingHorizontal: theme.space.md, justifyContent: 'center', borderRadius: theme.radius.full, backgroundColor: theme.color.secondary, borderWidth: 1, borderColor: theme.color.borderStrong },
  chipActive: { backgroundColor: theme.color.primary, borderColor: theme.color.primary },
  chipText: { ...theme.text.body, color: theme.color.secondaryText },
  chipTextActive: { color: theme.color.primaryText, fontWeight: '600' },
});
