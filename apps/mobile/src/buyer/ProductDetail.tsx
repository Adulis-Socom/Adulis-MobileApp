import { Image } from 'expo-image';
import { useState } from 'react';
import { RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBootstrap } from '../api/bootstrap';
import type { StorefrontProduct } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { formatMinor, formatPriceSpan, useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl } from './for-you-feed';
import { isPathName, usePublicRead } from './public-read';
import { ReadStates } from './ReadStates';

/**
 * The bounded Product read (WO-005): GET /v1/storefronts/{handle}/products/{slug}, the
 * Product as published now. Name, photos, price, availability in words, the Seller, the
 * description, and the options (Variants) with their own prices.
 *
 * - NO PURCHASE, CART, SAVE, ASK SELLER, REVIEWS OR SHARE: none is in scope, so none is
 *   drawn. An unavailable Product says "Currently unavailable" and offers nothing more.
 * - Attributes are not shown: the read carries their codes, not catalogue labels, and a
 *   code is not Buyer copy (register: WO-005).
 * - Revalidated on opening, on returning from the background and on a pull; a 404 clears it.
 */
export function ProductDetail({ handle, slug }: { handle: unknown; slug: unknown }) {
  const { api } = useSession();
  const valid = isPathName(handle) && isPathName(slug);
  const read = usePublicRead(
    ['product', valid ? handle : '', valid ? slug : ''],
    valid ? () => api.product(handle, slug) : null,
  );
  if (read.value === undefined) {
    return (
      <ReadStates
        read={read}
        valid={valid}
        gone="buyer.product.gone"
        loading="buyer.product.loading"
      />
    );
  }
  return (
    <ProductContent
      product={read.value}
      receivedAt={read.receivedAt ?? 0}
      pulling={read.pulling}
      onPull={read.pull}
    />
  );
}

function ProductContent({
  product,
  receivedAt,
  pulling,
  onPull,
}: {
  product: StorefrontProduct;
  receivedAt: number;
  pulling: boolean;
  onPull: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const locale = useLocale();
  const money = (minor: number, currency: string) => formatMinor(locale, minor, currency);
  // The Variants' prices (only ACTIVE ones are listed), never the base-price seed.
  const prices = product.variants.map((v) => v.price_minor);
  const price = formatPriceSpan(locale, t, {
    min: prices.length ? Math.min(...prices) : null,
    max: prices.length ? Math.max(...prices) : null,
    currency: product.variants[0]?.price_currency ?? null,
  });
  const availability = (available: boolean) =>
    t(available ? 'buyer.product.available' : 'buyer.product.unavailable');

  return (
    <ScrollView
      testID="product-detail"
      style={{ backgroundColor: theme.color.bg }}
      // The end of the page clears the system navigation bar (edge-to-edge).
      contentContainerStyle={{
        padding: theme.space.md,
        paddingBottom: theme.space.md + insets.bottom,
        gap: theme.space.md,
      }}
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={onPull} colors={[theme.color.accent]} />
      }
    >
      <ProductPhotos product={product} attempt={receivedAt} />

      <AppText variant="heading" accessibilityRole="header">
        {product.name}
      </AppText>
      {price === null ? null : (
        <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{price}</AppText>
      )}
      <AppText
        style={{
          color: product.available ? theme.color.text : theme.color.textSecondary,
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        {availability(product.available)}
      </AppText>
      <AppText style={{ color: theme.color.textSecondary }}>
        {fillSlots(t('buyer.product.seller'), { store: product.seller.store_name }) ??
          product.seller.store_name}
      </AppText>

      {product.description ? (
        <View style={{ gap: theme.space.xs }}>
          <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('buyer.product.description')}
          </AppText>
          <AppText>{product.description}</AppText>
        </View>
      ) : null}

      {product.variants.length > 0 ? (
        <View style={{ gap: theme.space.xs }}>
          <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('buyer.product.options')}
          </AppText>
          {product.variants.map((v) => {
            const price = money(v.price_minor, v.price_currency);
            // Only ACTIVE Variants are listed; an option is available when it is in stock AND
            // the Product is (which also carries the Seller's gate): never more than the Product.
            const optionAvailable = product.available && v.stock_count > 0;
            const state = availability(optionAvailable);
            return (
              <View
                key={v.variant_key}
                accessible
                accessibilityLabel={
                  fillSlots(t('buyer.product.option'), {
                    option: v.variant_key,
                    price,
                    availability: state,
                  }) ?? v.variant_key
                }
                style={{
                  borderWidth: 1,
                  borderColor: theme.color.border,
                  borderRadius: theme.radius.md,
                  padding: theme.space.sm,
                  backgroundColor: theme.color.surface,
                }}
              >
                <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{v.variant_key}</AppText>
                <AppText>{price}</AppText>
                <AppText
                  style={{
                    color: optionAvailable ? theme.color.text : theme.color.textSecondary,
                  }}
                >
                  {state}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** The Product's photos in order, one page each, at their own proportions in a square frame. */
function ProductPhotos({ product, attempt }: { product: StorefrontProduct; attempt: number }) {
  const t = useT();
  const theme = useTheme();
  const mediaOrigin = useBootstrap().data?.media_public_origin;
  const width = useWindowDimensions().width - theme.space.md * 2;
  // Failures hold for this answer only: a new answer (`attempt`) tries the photos again.
  const [failures, setFailures] = useState({ attempt, keys: new Set<string>() as ReadonlySet<string> });
  const failed = failures.attempt === attempt ? failures.keys : new Set<string>();
  const photos = product.images
    .map((image) => ({ key: image.card_key, uri: mediaUrl(mediaOrigin, image.card_key) }))
    .filter((p): p is { key: string; uri: string } => p.uri !== null && !failed.has(p.key));

  if (photos.length === 0) {
    return (
      <View
        style={{
          width,
          aspectRatio: 1,
          backgroundColor: theme.color.surfaceMuted,
          borderRadius: theme.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText style={{ color: theme.color.textSecondary }}>
          {t('buyer.scene.photo_unavailable')}
        </AppText>
      </View>
    );
  }
  return (
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width }}>
      {photos.map((photo, index) => (
        <Image
          key={photo.key}
          source={{ uri: photo.uri }}
          accessible
          accessibilityLabel={
            fillSlots(t('buyer.product.photo'), {
              index: index + 1,
              count: photos.length,
              name: product.name,
            }) ?? product.name
          }
          contentFit="contain"
          cachePolicy="disk"
          onError={() =>
            setFailures((f) => ({
              attempt,
              keys: new Set(f.attempt === attempt ? f.keys : []).add(photo.key),
            }))
          }
          style={{
            width,
            aspectRatio: 1,
            backgroundColor: theme.color.surfaceMuted,
            borderRadius: theme.radius.lg,
          }}
          testID="product-photo"
        />
      ))}
    </ScrollView>
  );
}
