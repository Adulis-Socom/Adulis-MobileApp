import { Image } from 'expo-image';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBootstrap } from '../api/bootstrap';
import type { StorefrontProduct } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { formatMinor, formatPriceSpan, hasMessage, useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl } from './for-you-feed';
import { MessageSellerButton } from './MessageSellerButton';
import { isPathName, isPublicRef, usePublicRead } from './public-read';
import { ReadStates } from './ReadStates';
import { SaveButton } from './SaveButton';

/**
 * The bounded Product read (WO-005, WO-CAT-001): GET /v1/storefronts/{handle}/products/{slug},
 * the Product as published now. Name, photos, the price span, availability in words, the
 * Seller, the description, readable attributes, and the options (Variants) with their own
 * prices and availability.
 *
 * - The price span and every availability are the SERVER's (the public Catalogue
 *   projection): nothing here derives them from prices or stock counts.
 * - Save and Add to collection (WO-009): private, never a purchase, a hold or a price freeze.
 * - Ask Seller About This Product (WO-014, R-07): opens the one conversation with this Product's
 *   Seller, the Product preselected for the next message. Offered even when it is unavailable.
 * - NO PURCHASE, CART, REVIEWS OR SHARE: none is in scope, so none is drawn. An unavailable
 *   Product says "Currently unavailable" and can still be saved.
 * - An attribute shows only when the catalogue can say it in words (OVN-075): a code is
 *   never Buyer copy.
 * - Revalidated on opening, on returning from the background and on a pull; a 404 clears it.
 *   Only the opening counts as a view (OVN-073).
 */
export function ProductDetail({ handle, slug, from }: { handle: unknown; slug: unknown; from?: unknown }) {
  const { api } = useSession();
  const valid = isPathName(handle) && isPathName(slug);
  const read = usePublicRead(
    ['product', valid ? handle : '', valid ? slug : ''],
    valid ? (revalidation) => api.product(handle, slug, revalidation) : null,
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
      route={`/product/${handle as string}/${slug as string}`}
      sceneRef={isPublicRef(from) ? from : null}
      receivedAt={read.receivedAt ?? 0}
      pulling={read.pulling}
      onPull={read.pull}
    />
  );
}

function ProductContent({
  product,
  route,
  sceneRef,
  receivedAt,
  pulling,
  onPull,
}: {
  product: StorefrontProduct;
  /** This screen's own path: where a guest's sign-in returns (WO-009 S16). */
  route: `/product/${string}/${string}`;
  sceneRef: string | null;
  receivedAt: number;
  pulling: boolean;
  onPull: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const locale = useLocale();
  const router = useRouter();
  const money = (minor: number, currency: string) => formatMinor(locale, minor, currency);
  // The server's span of the ACTIVE Variants' prices; null is "no current price", never the seed.
  const price = formatPriceSpan(locale, t, {
    min: product.price_min_minor,
    max: product.price_max_minor,
    currency: product.price_currency,
  });
  const details = readableAttributes(product.attributes, t);
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
      <SaveButton target={{ type: 'PRODUCT_POST', ref: product.id }} surface="PRODUCT_DETAIL" sceneRef={sceneRef} returnTo={route} />
      <Pressable
        accessibilityRole="link"
        accessibilityHint={fillSlots(t('buyer.seller.view'), { store: product.seller.store_name }) ?? undefined}
        onPress={() => router.push({ pathname: '/sellers/[handle]', params: { handle: product.seller.handle } })}
        style={{ minHeight: 44, justifyContent: 'center' }}
        testID="product-seller"
      >
        <AppText style={{ color: theme.color.textSecondary }}>
          {fillSlots(t('buyer.product.seller'), { store: product.seller.store_name }) ??
            product.seller.store_name}
        </AppText>
      </Pressable>
      {/* WO-014 (R-07): an unavailable Product can still be asked about; the server decides visibility. */}
      <MessageSellerButton product={{ handle: product.seller.handle, slug: product.slug }} />

      {product.description ? (
        <View style={{ gap: theme.space.xs }}>
          <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('buyer.product.description')}
          </AppText>
          <AppText>{product.description}</AppText>
        </View>
      ) : null}

      {details.length > 0 ? (
        <View style={{ gap: theme.space.xs }}>
          <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('buyer.product.details')}
          </AppText>
          {details.map((d) => (
            <AppText key={d.key}>
              {fillSlots(t('buyer.product.attribute'), { name: d.name, value: d.value }) ?? d.value}
            </AppText>
          ))}
        </View>
      ) : null}

      {product.variants.length > 0 ? (
        <View style={{ gap: theme.space.xs }}>
          <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
            {t('buyer.product.options')}
          </AppText>
          {product.variants.map((v) => {
            const price = money(v.price_minor, v.price_currency);
            // The server's per-option answer (OVN-074): never true while the Product is not.
            const optionAvailable = v.available;
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

/**
 * The attributes the catalogue can say in words (OVN-075). The name needs its label key in the
 * catalogue. ENUM values need their option's label key; TEXT is the Seller's own words, shown as
 * written. NUMBER and BOOLEAN are omitted: no governed copy exists for units or yes/no yet.
 */
export function readableAttributes(
  attributes: StorefrontProduct['attributes'],
  t: ReturnType<typeof useT>,
): Array<{ key: string; name: string; value: string }> {
  return attributes.flatMap((a) => {
    if (!hasMessage(a.label_key)) return [];
    const value =
      a.data_type === 'ENUM'
        ? hasMessage(a.value_label_key)
          ? t(a.value_label_key)
          : null
        : a.data_type === 'TEXT'
          ? a.value
          : null;
    return value ? [{ key: a.attribute, name: t(a.label_key), value }] : [];
  });
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
