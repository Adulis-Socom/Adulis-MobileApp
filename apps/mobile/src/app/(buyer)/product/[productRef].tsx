// Product detail. Availability is words from the server's flag; there is no stock number, no "only n left", no discount and no
// "was" price. A failed re-read withholds price and options rather than showing what was cached. Save, Add to cart and Share are
// later work orders and are not drawn here. A 404 is one neutral state.
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MediaImage, Section } from '../../../discovery/components';
import { availabilityText, formatMoney, priceOf, trustText } from '../../../discovery/format';
import { problemKind, useRead } from '../../../discovery/hooks';
import { validRef } from '../../../discovery/params';
import { ProductSave } from '../../../engagement/controls';
import { ShareAndReport } from '../../../engagement/ShareAndReport';
import { t } from '../../../i18n/messages';
import { Body, Button, Heading, Screen, StateView } from '../../../ui/components';
import { theme } from '../../../ui/theme';

export default function ProductDetailRoute() {
  const router = useRouter();
  const { productRef } = useLocalSearchParams<{ productRef?: string }>();
  const ref = validRef(productRef);
  const query = useRead('product.get', { productRef: ref ?? '' }, { enabled: ref !== null });

  useFocusEffect(
    useCallback(() => {
      if (query.data !== undefined) void query.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- only the presence of data matters; refetch is stable per query
    }, [query.data !== undefined]),
  );

  if (ref === null || (query.status === 'error' && problemKind(query.error) === 'gone')) {
    return <Screen><StateView kind="not-found" message={t('mobile.product.gone')} action={{ label: t('mobile.state.go_home'), onPress: () => router.replace('/home') }} /></Screen>;
  }
  if (query.status === 'pending') return <Screen><StateView kind="loading" /></Screen>;
  if (query.status === 'error') return <Screen><StateView kind={problemKind(query.error) === 'offline' ? 'offline' : 'error'} onRetry={() => void query.refetch()} /></Screen>;

  const product = query.data.product;
  const trust = trustText(product.trustLevel);
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        {product.image ? <MediaImage media={product.image} height={240} label /> : null}
        <Heading>{product.name}</Heading>
        <Body>{priceOf(product)}</Body>
        <Text style={styles.available}>{availabilityText(product.available)}</Text>
        <ProductSave productRef={product.productRef} />
        <ShareAndReport />
        <Body>{product.description}</Body>
        {product.variants.length > 0 ? (
          <Section title={t('mobile.product.options')}>
            {product.variants.map((variant) => (
              <View key={variant.variantRef} style={styles.variant}>
                <Text style={styles.variantName}>{variant.label}</Text>
                <Body>{formatMoney(variant.price)}</Body>
                <Text style={styles.available}>{availabilityText(variant.available)}</Text>
              </View>
            ))}
          </Section>
        ) : null}
        <Button kind="secondary" label={t('mobile.scene.by_seller', { seller: product.seller.storeName })} onPress={() => router.push(`/sellers/${product.seller.sellerRef}`)} />
        <Button kind="secondary" label={t('mobile.product.reviews')} onPress={() => router.push(`/sellers/${product.seller.sellerRef}?tab=reviews`)} />
        {trust ? <Body muted>{trust}</Body> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: theme.space.md, paddingBottom: theme.space.xl },
  available: { ...theme.text.small, color: theme.color.textSecondary },
  variant: { gap: theme.space.xs, padding: theme.space.smd, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface },
  variantName: { ...theme.text.body, color: theme.color.text, fontWeight: '600' },
});
