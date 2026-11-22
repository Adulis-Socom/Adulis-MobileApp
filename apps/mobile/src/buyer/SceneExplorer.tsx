import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBootstrap } from '../api/bootstrap';
import type { PublicScene, SceneProduct } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AlertText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { formatPriceSpan, useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl, withdrawScene } from './for-you-feed';
import { isPublicRef, usePublicRead } from './public-read';
import { ReadStates } from './ReadStates';
import { SaveButton } from './SaveButton';

/** Until the photo reports its own size: the feed's frame. */
const DEFAULT_ASPECT = 4 / 5;
/** The selected Product's photo beside View Product. */
const PREVIEW_SIZE = 72;
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

  // The server's 404 is the authoritative "no longer public": a For You card for this Scene
  // must not outlive it. Any other failure says nothing about the Scene.
  const { gone } = read;
  useEffect(() => {
    if (gone && isPublicRef(scenePostRef)) withdrawScene(scenePostRef);
  }, [gone, scenePostRef]);

  // By slug, and held here rather than in the content: it survives the content being
  // withheld or failing and coming back, goes if its Product does, and follows a reorder.
  const [selected, setSelected] = useState<string | null>(null);

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
    <SceneContent
      scene={read.value}
      receivedAt={read.receivedAt ?? 0}
      pulling={read.pulling}
      offline={read.offline}
      onPull={read.pull}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

function SceneContent({
  scene,
  receivedAt,
  pulling,
  offline,
  onPull,
  selected,
  onSelect,
}: {
  scene: PublicScene;
  receivedAt: number;
  pulling: boolean;
  /** Its re-read waits for a connection: what is shown is the last answer. */
  offline: boolean;
  onPull: () => void;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const mediaOrigin = useBootstrap().data?.media_public_origin;
  const store = scene.seller.store_name;
  const router = useRouter();

  return (
    <ScrollView
      testID="scene-explorer"
      style={{ backgroundColor: theme.color.bg }}
      // The end of the list clears the system navigation bar (edge-to-edge).
      contentContainerStyle={{
        padding: theme.space.md,
        paddingBottom: theme.space.md + insets.bottom,
        gap: theme.space.md,
      }}
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={onPull} colors={[theme.color.accent]} />
      }
    >
      {offline ? <AlertText>{t('common.offline')}</AlertText> : null}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={fillSlots(t('buyer.scene.seller'), { store }) ?? store}
        accessibilityHint={fillSlots(t('buyer.seller.view'), { store }) ?? undefined}
        onPress={() => router.push({ pathname: '/sellers/[handle]', params: { handle: scene.seller.handle } })}
        style={{ minHeight: theme.touchTarget, justifyContent: 'center' }}
        testID="scene-seller"
      >
        <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{store}</AppText>
        <AppText style={{ color: theme.color.textSecondary }}>{`@${scene.seller.handle}`}</AppText>
      </Pressable>

      <ScenePhoto
        uri={mediaUrl(mediaOrigin, scene.image.card_key)}
        label={fillSlots(t('buyer.scene.photo'), { store }) ?? store}
        attempt={receivedAt}
      />

      <AppText>{scene.caption}</AppText>

      {/* The whole Scene, independent of saving any of its Products (WO-009 S10). */}
      <SaveButton target={{ type: 'SCENE_POST', ref: scene.public_ref }} surface="SCENE_EXPLORER" returnTo={`/scenes/${scene.public_ref}`} />

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
                sceneRef={scene.public_ref}
                mediaOrigin={mediaOrigin}
                attempt={receivedAt}
                selected={product.slug === selected}
                onSelect={() => onSelect(product.slug)}
              />
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

/**
 * The Scene photo at its own proportions: never cropped, never stretched. A failure holds
 * for this URL and this answer only: a new answer (`attempt`) tries the photo again.
 */
function ScenePhoto({ uri, label, attempt }: { uri: string | null; label: string; attempt: number }) {
  const t = useT();
  const theme = useTheme();
  const [measured, setMeasured] = useState<{ uri: string; aspect: number } | null>(null);
  const [failed, setFailed] = useState<{ uri: string; attempt: number } | null>(null);
  const aspect = measured?.uri === uri ? measured.aspect : DEFAULT_ASPECT;

  if (uri === null || (failed?.uri === uri && failed.attempt === attempt)) {
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
        setMeasured({
          uri,
          aspect:
            e.source.width > 0 && e.source.height > 0
              ? e.source.width / e.source.height
              : DEFAULT_ASPECT,
        })
      }
      onError={() => setFailed({ uri, attempt })}
      style={{
        width: '100%',
        aspectRatio: clampAspect(aspect),
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
  sceneRef,
  mediaOrigin,
  attempt,
  selected,
  onSelect,
}: {
  product: SceneProduct;
  number: number;
  handle: string;
  /** Passed to the Product as `from`: Save provenance the server verifies (WO-009 S11). */
  sceneRef: string;
  mediaOrigin: string | undefined;
  /** When the shown answer arrived: a new answer lets a failed preview photo try again. */
  attempt: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const router = useRouter();
  // As the Scene photo: a failure holds for this URL and this answer only.
  const [failed, setFailed] = useState<{ uri: string; attempt: number } | null>(null);
  const price = formatPriceSpan(locale, t, {
    min: product.price_min_minor,
    max: product.price_max_minor,
    currency: product.price_currency,
  });
  const label = fillSlots(
    t(
      price === null
        ? 'buyer.scene.product_no_price'
        : product.available
          ? 'buyer.scene.product'
          : 'buyer.scene.product_unavailable',
    ),
    { position: number, name: product.name, price },
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
          {price === null ? null : (
            <AppText
              style={{ color: product.available ? theme.color.text : theme.color.textSecondary }}
            >
              {price}
            </AppText>
          )}
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
        // The preview sits beside its action, as in the prototype: a small photo, then View Product.
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: theme.space.sm,
            gap: theme.space.sm,
            borderTopWidth: 1,
            borderTopColor: theme.color.border,
          }}
        >
          {uri === null ? null : failed?.uri === uri && failed.attempt === attempt ? (
            // The photo's slot, and it grows with the text: never words clipped inside a fixed square.
            <View
              testID="scene-product-photo-unavailable"
              style={{
                minWidth: PREVIEW_SIZE,
                minHeight: PREVIEW_SIZE,
                padding: theme.space.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.color.surfaceMuted,
                borderRadius: theme.radius.md,
              }}
            >
              <AppText style={{ color: theme.color.textSecondary, textAlign: 'center' }}>
                {t('buyer.scene.photo_unavailable')}
              </AppText>
            </View>
          ) : (
            <Image
              source={{ uri }}
              contentFit="contain"
              cachePolicy="disk"
              onError={() => setFailed({ uri, attempt })}
              style={{
                width: PREVIEW_SIZE,
                height: PREVIEW_SIZE,
                backgroundColor: theme.color.surfaceMuted,
                borderRadius: theme.radius.md,
              }}
              testID="scene-product-photo"
            />
          )}
          <View style={{ flexGrow: 1 }}>
            <Button
              label={t('buyer.product.view')}
              onPress={() =>
                router.push({
                  pathname: '/product/[handle]/[slug]',
                  params: { handle, slug: product.slug, from: sceneRef },
                })
              }
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
