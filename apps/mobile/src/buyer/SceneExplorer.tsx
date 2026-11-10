import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { useBootstrap } from '../api/bootstrap';
import type { PublicScene, SceneProduct } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { formatMinor, useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl } from './for-you-feed';
import { isPublicRef, usePublicRead } from './public-read';
import { ReadStates } from './ReadStates';

/** Until the photo reports its own size: the feed's frame. */
const DEFAULT_ASPECT = 4 / 5;
// A panorama or a strip still gets a usable frame; `contain` never crops or stretches it.
const clampAspect = (aspect: number) => Math.min(2, Math.max(0.5, aspect));

/**
 * Explore the Scene (WO-005; ADU-MOB-02 S11 R-06, the prototype's SceneExplorer): the
 * Scene's current public representation from GET /v1/scene-posts/{publicRef} -- never the
 * feed unit that led here -- with every tagged Product, in the server's order.
 *
 * - The photo, the Seller (name and handle: no trust signal is invented), the whole caption.
 * - NO HOTSPOTS: the contract carries no tag geometry, so none is drawn or guessed. The
 *   numbered list is the whole selection surface, and complete without them.
 * - Choosing a Product selects it (one at a time, announced as checked) and opens its
 *   preview in place: photo, price, availability in words, and View Product. An
 *   unavailable Product stays listed, labelled, and viewable; nothing here buys anything.
 * - Revalidated on opening, on returning from the background (the For You interval), on
 *   coming back from a Product, and on a pull. A 404 at any of those clears the Scene.
 */
export function SceneExplorer({ scenePostRef }: { scenePostRef: unknown }) {
  const { api } = useSession();
  const valid = isPublicRef(scenePostRef);
  const read = usePublicRead(
    ['scene', valid ? scenePostRef : ''],
    valid ? () => api.scene(scenePostRef) : null,
  );

  // Coming back to this screen (from a Product) asks again; the first focus is the opening.
  const { revalidate } = read;
  const opened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (opened.current) revalidate();
      opened.current = true;
    }, [revalidate]),
  );

  // Only a success has a value: a 404 or any failure shows its state, never an older Scene.
  if (read.value === undefined) {
    return (
      <ReadStates read={read} valid={valid} gone="buyer.scene.gone" loading="buyer.scene.loading" />
    );
  }
  return (
    <SceneContent scene={read.value} revalidating={read.revalidating} onRefresh={revalidate} />
  );
}

function SceneContent({
  scene,
  revalidating,
  onRefresh,
}: {
  scene: PublicScene;
  revalidating: boolean;
  onRefresh: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const mediaOrigin = useBootstrap().data?.media_public_origin;
  // By slug: the selection survives a revalidation that reorders, and goes if its Product does.
  const [selected, setSelected] = useState<string | null>(null);
  const store = scene.seller.store_name;

  return (
    <ScrollView
      testID="scene-explorer"
      style={{ backgroundColor: theme.color.bg }}
      contentContainerStyle={{ padding: theme.space.md, gap: theme.space.md }}
      refreshControl={
        <RefreshControl
          refreshing={revalidating}
          onRefresh={onRefresh}
          colors={[theme.color.accent]}
        />
      }
    >
      <View accessible accessibilityLabel={fillSlots(t('buyer.scene.seller'), { store }) ?? store}>
        <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{store}</AppText>
        <AppText style={{ color: theme.color.textSecondary }}>{`@${scene.seller.handle}`}</AppText>
      </View>

      <ScenePhoto
        uri={mediaUrl(mediaOrigin, scene.image.card_key)}
        label={fillSlots(t('buyer.scene.photo'), { store }) ?? store}
      />

      <AppText>{scene.caption}</AppText>

      <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
        {t('buyer.scene.products')}
      </AppText>
      {scene.products.length === 0 ? (
        <AppText style={{ color: theme.color.textSecondary }}>
          {t('buyer.scene.no_products')}
        </AppText>
      ) : (
        <>
          {scene.products.some((p) => p.slug === selected) ? null : (
            <AppText style={{ color: theme.color.textSecondary }}>
              {t('buyer.scene.choose')}
            </AppText>
          )}
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('buyer.scene.products')}
            style={{ gap: theme.space.sm }}
          >
            {scene.products.map((product, index) => (
              <ProductRow
                key={product.slug}
                product={product}
                number={index + 1}
                handle={scene.seller.handle}
                mediaOrigin={mediaOrigin}
                selected={product.slug === selected}
                onSelect={() => setSelected(product.slug)}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/** The Scene photo at its own proportions: never cropped, never stretched. */
function ScenePhoto({ uri, label }: { uri: string | null; label: string }) {
  const t = useT();
  const theme = useTheme();
  // Keyed by the URL, so a revalidated Scene with a new photo starts over.
  const [loaded, setLoaded] = useState<{ uri: string; aspect: number | null } | null>(null);
  const state = loaded?.uri === uri ? loaded : null;

  if (uri === null || (state !== null && state.aspect === null)) {
    return (
      <View
        style={{
          width: '100%',
          aspectRatio: DEFAULT_ASPECT,
          backgroundColor: theme.color.surfaceMuted,
          borderRadius: theme.radius.lg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.space.md,
        }}
      >
        <AppText style={{ color: theme.color.textSecondary, textAlign: 'center' }}>
          {t('buyer.scene.photo_unavailable')}
        </AppText>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      accessible
      accessibilityLabel={label}
      contentFit="contain"
      // Public Scene media only: the one kind allowed on the normal disk cache (MOB-02).
      cachePolicy="disk"
      onLoad={(e) =>
        setLoaded({
          uri,
          aspect:
            e.source.width > 0 && e.source.height > 0
              ? e.source.width / e.source.height
              : DEFAULT_ASPECT,
        })
      }
      onError={() => setLoaded({ uri, aspect: null })}
      style={{
        width: '100%',
        aspectRatio: clampAspect(state?.aspect ?? DEFAULT_ASPECT),
        backgroundColor: theme.color.surfaceMuted,
        borderRadius: theme.radius.lg,
      }}
      testID="scene-explorer-photo"
    />
  );
}

/**
 * One tagged Product: a radio in the list's single selection. Its number matches what a
 * hotspot would carry; its availability is words, not colour. Selected, it previews the
 * Product and offers View Product, which opens the Product and orders nothing.
 */
function ProductRow({
  product,
  number,
  handle,
  mediaOrigin,
  selected,
  onSelect,
}: {
  product: SceneProduct;
  number: number;
  handle: string;
  mediaOrigin: string | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const price = formatMinor(locale, product.base_price_minor, product.base_price_currency);
  const slots = { position: number, name: product.name, price };
  const label = fillSlots(
    t(product.available ? 'buyer.scene.product' : 'buyer.scene.product_unavailable'),
    slots,
  );
  const uri = product.image_key ? mediaUrl(mediaOrigin, product.image_key) : null;

  return (
    <View
      style={{
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? theme.color.accent : theme.color.border,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.color.surface,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label ?? product.name}
        onPress={onSelect}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.space.sm,
          padding: theme.space.sm,
          minHeight: theme.touchTarget,
          backgroundColor: pressed ? theme.color.surfaceMuted : 'transparent',
        })}
      >
        <View
          style={{
            minWidth: 28,
            minHeight: 28,
            borderRadius: 14,
            backgroundColor: selected ? theme.color.accent : theme.color.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText
            style={{
              color: selected ? theme.color.accentText : theme.color.text,
              fontWeight: theme.fontWeight.semibold,
            }}
          >
            {number}
          </AppText>
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{product.name}</AppText>
          <AppText
            style={{ color: product.available ? theme.color.text : theme.color.textSecondary }}
          >
            {price}
          </AppText>
          {product.available ? null : (
            <AppText
              style={{ color: theme.color.textSecondary, fontWeight: theme.fontWeight.semibold }}
            >
              {t('buyer.product.unavailable')}
            </AppText>
          )}
        </View>
      </Pressable>

      {selected ? (
        <View
          style={{
            padding: theme.space.sm,
            gap: theme.space.sm,
            borderTopWidth: 1,
            borderTopColor: theme.color.border,
          }}
        >
          {uri ? (
            <Image
              source={{ uri }}
              contentFit="contain"
              cachePolicy="disk"
              style={{
                width: '100%',
                aspectRatio: 1,
                backgroundColor: theme.color.surfaceMuted,
                borderRadius: theme.radius.md,
              }}
            />
          ) : null}
          <Button
            label={t('buyer.product.view')}
            onPress={() =>
              router.push({
                pathname: '/product/[handle]/[slug]',
                params: { handle, slug: product.slug },
              })
            }
          />
        </View>
      ) : null}
    </View>
  );
}
