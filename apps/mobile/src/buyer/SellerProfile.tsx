import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBootstrap } from '../api/bootstrap';
import type { SellerProduct, SellerReview, SellerScene, Storefront } from '../api/client';
import { fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { formatPriceSpan, hasMessage, useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl } from './for-you-feed';
import { usePublicList } from './public-list';
import { CardSaveButton } from './CardSaveButton';
import { MessageSellerButton } from './MessageSellerButton';
import { PublicListView, useLargeText } from './PublicListView';
import { isPathName, usePublicRead } from './public-read';
import { GoneState, ReadStates } from './ReadStates';

/**
 * The Buyer Seller Profile (WO-006; ADU-MOB-02 R-09, STOREFRONT-02 S505-S617): the public Seller
 * by handle -- resolved by the server in the requester's Market -- with Scenes, Products, Reviews
 * and About, in that order, opening on Scenes.
 *
 * - Only what the server sends: the Trust level the database holds, completed handoffs, a review
 *   summary with its count (never a bare score), fulfilment methods and the join date. No rates
 *   are shown: their denominators are not public, and a zero rate must not read as perfect
 *   (TRUST-01 S440). Message Seller opens the one Buyer-Seller conversation (WO-013). No Follow,
 *   Share, Cart or review composer: none is built.
 * - Scenes come from the canonical public gate; a PRIVATE Scene is simply absent. Opening one
 *   reuses Explore the Scene; a Product opens the Product detail.
 * - Revalidated on opening, on return to this screen, after the background interval and on a
 *   pull; a 404 anywhere shows only the neutral message.
 */
type Tab = 'scenes' | 'products' | 'reviews' | 'about';
const TABS: readonly Tab[] = ['scenes', 'products', 'reviews', 'about'];

export function SellerProfile({ handle }: { handle: unknown }) {
  const { api } = useSession();
  const valid = isPathName(handle);
  const header = usePublicRead(
    ['storefront', valid ? handle : ''],
    valid ? (revalidation) => api.storefront(handle, revalidation) : null,
  );
  const [tab, setTab] = useState<Tab>('scenes');

  // Back from a Scene or a Product: read the Seller again (the first focus is the opening read).
  const focused = useRef(false);
  const { revalidate } = header;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) revalidate();
      focused.current = true;
    }, [revalidate]),
  );

  if (header.value === undefined) {
    return (
      <ReadStates
        read={header}
        valid={valid}
        gone="buyer.seller.gone"
        loading="buyer.seller.loading"
      />
    );
  }
  const seller = header.value;
  const top = <ProfileHeader seller={seller} tab={tab} onTab={setTab} />;
  if (tab === 'about') {
    return <AboutTab seller={seller} header={top} pulling={header.pulling} onPull={header.pull} />;
  }
  // A pull on a list reads the header again too, so the summary and the list agree.
  const tabProps = { handle: seller.handle, header: top, onPull: revalidate };
  if (tab === 'products') return <ProductsTab {...tabProps} />;
  if (tab === 'reviews') return <ReviewsTab {...tabProps} seller={seller} />;
  return <ScenesTab {...tabProps} />;
}

function ProfileHeader({
  seller,
  tab,
  onTab,
}: {
  seller: Storefront;
  tab: Tab;
  onTab: (t: Tab) => void;
}) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const level = seller.stats ? `buyer.seller.trust.${seller.stats.level}` : null;
  const summary = seller.review_summary;
  return (
    <View
      style={{
        gap: theme.space.xs,
        paddingHorizontal: theme.space.sm,
        paddingBottom: theme.space.sm,
      }}
    >
      <AppText variant="heading" accessibilityRole="header">
        {seller.store_name}
      </AppText>
      <AppText style={{ color: theme.color.textSecondary }}>{`@${seller.handle}`}</AppText>
      {level && hasMessage(level) ? (
        <AppText style={{ fontWeight: theme.fontWeight.semibold }}>
          {fillSlots(t('buyer.seller.trust'), { level: t(level) })}
        </AppText>
      ) : null}
      {seller.stats ? (
        <AppText>
          {fillSlots(t('buyer.seller.handoffs'), { count: seller.stats.completed_handoff_count })}
        </AppText>
      ) : null}
      <AppText style={{ color: theme.color.textSecondary }}>
        {summary.count > 0 && summary.average_rating !== null
          ? fillSlots(t('buyer.seller.rating'), {
              // Rounded once, by the server (one decimal): shown as is.
              average: new Intl.NumberFormat(locale, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 1,
              }).format(summary.average_rating),
              count: summary.count,
            })
          : t('buyer.seller.no_reviews')}
      </AppText>
      <MessageSellerButton sellerId={seller.seller_id} />
      <TabBar tab={tab} onTab={onTab} />
    </View>
  );
}

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('buyer.seller.tabs')}
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: theme.color.border,
        marginTop: theme.space.sm,
      }}
    >
      {TABS.map((key) => {
        const selected = key === tab;
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onTab(key)}
            testID={`seller-tab-${key}`}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomWidth: 2,
              borderColor: selected ? theme.color.accent : 'transparent',
            }}
          >
            <AppText
              style={{
                textAlign: 'center',
                fontWeight: selected ? theme.fontWeight.semibold : undefined,
              }}
            >
              {t(`buyer.seller.tab.${key}`)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type TabProps = { handle: string; header: React.ReactElement; onPull: () => void };

/** Back from a Scene or a Product: read the visible list again (a Scene may have gone PRIVATE). */
function useRefreshOnReturn(refresh: () => void) {
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refresh();
      focused.current = true;
    }, [refresh]),
  );
}

// WO-009A: Save targets, by the public identity the API names (never a handle and slug).
const sceneTarget = (scene: SellerScene) => ({ type: 'SCENE_POST' as const, ref: scene.public_ref });
const productTarget = (product: SellerProduct) => ({ type: 'PRODUCT_POST' as const, ref: product.id });

function ScenesTab({ handle, header, onPull }: TabProps) {
  const { api } = useSession();
  const t = useT();
  const list = usePublicList({
    resource: ['seller-scenes', handle],
    read: (cursor) => api.sellerScenes(handle, cursor),
    items: (page) => page.data,
    keyOf: (scene: SellerScene) => scene.public_ref,
  });
  useRefreshOnReturn(list.refresh);
  if (list.gone) return <GoneState message="buyer.seller.gone" />;
  return (
    <PublicListView
      list={list}
      onRefresh={() => {
        onPull();
        list.refresh();
      }}
      keyOf={(scene) => scene.public_ref}
      renderItem={({ item }) => <SceneTile scene={item} />}
      saves={{ surface: 'SELLER_PROFILE', target: sceneTarget }}
      numColumns={2}
      header={header}
      empty="buyer.seller.scenes.empty"
      loading="buyer.seller.scenes.loading"
      testID="seller-scenes"
      label={t('buyer.seller.tab.scenes')}
    />
  );
}

function SceneTile({ scene }: { scene: SellerScene }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const mediaOrigin = useBootstrap().data?.media_public_origin;
  const uri = mediaUrl(mediaOrigin, scene.image.card_key);
  return (
    <View style={{ flex: 1, margin: theme.space.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          fillSlots(t('buyer.seller.scene'), { caption: scene.caption }) ?? scene.caption
        }
        onPress={() =>
          router.push({
            pathname: '/scenes/[scenePostRef]',
            params: { scenePostRef: scene.public_ref },
          })
        }
        style={{ gap: theme.space.xs }}
        testID="seller-scene"
      >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          cachePolicy="disk"
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.surfaceMuted,
          }}
        />
      ) : (
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: theme.radius.md,
            backgroundColor: theme.color.surfaceMuted,
          }}
        />
      )}
        <AppText numberOfLines={2} style={{ color: theme.color.textSecondary }}>
          {scene.caption}
        </AppText>
      </Pressable>
      <CardSaveButton
        target={sceneTarget(scene)}
        name={scene.caption}
        returnTo={`/scenes/${scene.public_ref}`}
        style={{ position: 'absolute', top: theme.space.xs, right: theme.space.xs }}
      />
    </View>
  );
}

function ProductsTab({ handle, header, onPull }: TabProps) {
  const { api } = useSession();
  const t = useT();
  const list = usePublicList({
    resource: ['seller-products', handle],
    read: (cursor) => api.sellerProducts(handle, cursor),
    items: (page) => page.data,
    // Products come available first, then unavailable (WO-007B). A Product whose availability
    // changes mid-browse can be sent again in the other group: its id keeps it to one tile.
    keyOf: (product: SellerProduct) => product.id,
  });
  useRefreshOnReturn(list.refresh);
  if (list.gone) return <GoneState message="buyer.seller.gone" />;
  return (
    <PublicListView
      list={list}
      onRefresh={() => {
        onPull();
        list.refresh();
      }}
      keyOf={(product) => product.id}
      renderItem={({ item }) => <ProductTile product={item} handle={handle} />}
      saves={{ surface: 'SELLER_PROFILE', target: productTarget }}
      numColumns={2}
      header={header}
      empty="buyer.seller.products.empty"
      loading="buyer.seller.products.loading"
      testID="seller-products"
      label={t('buyer.seller.tab.products')}
    />
  );
}

/** A public Product summary as a grid tile: photo, name, the server's price span, availability in words. */
export function ProductTile({
  product,
  handle,
  seller,
}: {
  product: Pick<
    SellerProduct,
    'id' | 'slug' | 'name' | 'price_min_minor' | 'price_max_minor' | 'price_currency' | 'available'
  > & {
    image_key: string | null;
  };
  handle: string;
  /** Where Products of many Sellers mix (Shop): the Seller, shown as its own link to the profile. */
  seller?: { handle: string; store_name: string };
}) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const largeText = useLargeText();
  const mediaOrigin = useBootstrap().data?.media_public_origin;
  const uri = product.image_key ? mediaUrl(mediaOrigin, product.image_key) : null;
  const price = formatPriceSpan(locale, t, {
    min: product.price_min_minor,
    max: product.price_max_minor,
    currency: product.price_currency,
  });
  const availability = t(
    product.available ? 'buyer.product.available' : 'buyer.product.unavailable',
  );
  const label = [product.name, price, availability].filter(Boolean).join(', ');
  return (
    <View style={{ flex: 1, margin: theme.space.xs, gap: theme.space.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() =>
          router.push({
            pathname: '/product/[handle]/[slug]',
            params: { handle, slug: product.slug },
          })
        }
        style={{ gap: theme.space.xs }}
        testID="product-tile"
      >
        {uri ? (
          <Image
            source={{ uri }}
            contentFit="cover"
            cachePolicy="disk"
            testID="product-photo"
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.surfaceMuted,
            }}
          />
        ) : (
          <View
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.surfaceMuted,
            }}
          />
        )}
        {/* shortcut: two lines in a half-width tile below 130% text, in full at large text where the grid is
            one column (A-006); the full name is always the accessible name and the Product's title. */}
        <AppText numberOfLines={largeText ? undefined : 2} style={{ fontWeight: theme.fontWeight.semibold }}>
          {product.name}
        </AppText>
        {price ? <AppText>{price}</AppText> : null}
        <AppText
          style={{ color: product.available ? theme.color.text : theme.color.textSecondary }}
        >
          {availability}
        </AppText>
      </Pressable>
      {/* WO-009A: over the photo's corner, a sibling of the tile's Pressable, in a list that reads saved state. */}
      <CardSaveButton
        target={{ type: 'PRODUCT_POST', ref: product.id }}
        name={product.name}
        returnTo={`/product/${handle}/${product.slug}`}
        style={{ position: 'absolute', top: theme.space.xs, right: theme.space.xs }}
      />
      {seller ? (
        <Pressable
          accessibilityRole="link"
          // The visible words are the accessible name (label in name), as on the Product.
          accessibilityHint={fillSlots(t('buyer.seller.view'), { store: seller.store_name }) ?? undefined}
          onPress={() =>
            router.push({ pathname: '/sellers/[handle]', params: { handle: seller.handle } })
          }
          style={{ minHeight: theme.touchTarget, justifyContent: 'center' }}
          testID="product-tile-seller"
        >
          {/* The words carry the cue, as on the Product: an underline was dropped by some
              recycled cells (ON-048), and colour alone is not a cue. */}
          <AppText style={{ color: theme.color.textSecondary }}>
            {fillSlots(t('buyer.product.seller'), { store: seller.store_name }) ?? seller.store_name}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function ReviewsTab({ handle, seller, header, onPull }: TabProps & { seller: Storefront }) {
  const { api } = useSession();
  const t = useT();
  const theme = useTheme();
  const list = usePublicList({
    resource: ['seller-reviews', handle],
    read: (cursor) => api.sellerReviews(handle, cursor),
    items: (page) => page.data,
    keyOf: (review: SellerReview) => review.id,
  });
  useRefreshOnReturn(list.refresh);
  if (list.gone) return <GoneState message="buyer.seller.gone" />;
  return (
    <PublicListView
      list={list}
      onRefresh={() => {
        onPull();
        list.refresh();
      }}
      keyOf={(review) => review.id}
      renderItem={({ item }) => <ReviewRow review={item} />}
      header={
        <View>
          {header}
          {seller.review_summary.count > 0 ? (
            <AppText
              style={{ color: theme.color.textSecondary, paddingHorizontal: theme.space.sm }}
            >
              {t('buyer.seller.reviews.note')}
            </AppText>
          ) : null}
        </View>
      }
      empty="buyer.seller.reviews.empty"
      loading="buyer.seller.reviews.loading"
      testID="seller-reviews"
      label={t('buyer.seller.tab.reviews')}
    />
  );
}

function ReviewRow({ review }: { review: SellerReview }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  // The server's evidence basis (REV-01), in words; an unknown future basis shows no label.
  const basis = `buyer.review.basis.${review.evidence_basis}`;
  const rating =
    fillSlots(t('buyer.review.rating'), { rating: review.seller_rating }) ??
    String(review.seller_rating);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(review.published_at),
  );
  return (
    <View
      style={{
        margin: theme.space.xs,
        padding: theme.space.sm,
        gap: theme.space.xs,
        borderWidth: 1,
        borderColor: theme.color.border,
        borderRadius: theme.radius.md,
        backgroundColor: theme.color.surface,
      }}
      testID="seller-review"
    >
      <AppText accessibilityLabel={rating} style={{ fontWeight: theme.fontWeight.semibold }}>
        {`${'★'.repeat(review.seller_rating)}${'☆'.repeat(5 - review.seller_rating)}`}
      </AppText>
      {hasMessage(basis) ? (
        <AppText style={{ color: theme.color.textSecondary }}>{t(basis)}</AppText>
      ) : null}
      <AppText style={{ color: theme.color.textSecondary }}>
        {fillSlots(t('buyer.review.date'), { date })}
      </AppText>
      {review.body ? <AppText>{review.body}</AppText> : null}
    </View>
  );
}

function AboutTab({
  seller,
  header,
  pulling,
  onPull,
}: {
  seller: Storefront;
  header: React.ReactElement;
  pulling: boolean;
  onPull: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const insets = useSafeAreaInsets();
  const level = seller.stats ? `buyer.seller.trust.${seller.stats.level}` : null;
  const methods = seller.fulfilment_methods
    .map((m) => `buyer.seller.about.fulfilment.${m}`)
    .filter(hasMessage)
    .map((key) => t(key));
  const since = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${seller.member_since}T00:00:00Z`),
  );
  return (
    <ScrollView
      testID="seller-about"
      style={{ backgroundColor: theme.color.bg }}
      contentContainerStyle={{
        padding: theme.space.sm,
        paddingBottom: theme.space.md + insets.bottom,
        gap: theme.space.md,
      }}
      refreshControl={
        <RefreshControl refreshing={pulling} onRefresh={onPull} colors={[theme.color.accent]} />
      }
    >
      {header}
      <View style={{ gap: theme.space.md, paddingHorizontal: theme.space.sm }}>
        {seller.description ? (
          <View style={{ gap: theme.space.xs }}>
            <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
              {t('buyer.seller.about.description')}
            </AppText>
            <AppText>{seller.description}</AppText>
          </View>
        ) : null}
        {level && hasMessage(level) ? (
          <AppText>{fillSlots(t('buyer.seller.trust'), { level: t(level) })}</AppText>
        ) : null}
        {seller.availability ? (
          <AppText>
            {t(
              seller.availability.is_open ? 'buyer.seller.about.open' : 'buyer.seller.about.closed',
            )}
          </AppText>
        ) : null}
        {methods.length > 0 ? (
          <View style={{ gap: theme.space.xs }}>
            <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
              {t('buyer.seller.about.fulfilment')}
            </AppText>
            {methods.map((m) => (
              <AppText key={m}>{m}</AppText>
            ))}
          </View>
        ) : null}
        <AppText style={{ color: theme.color.textSecondary }}>
          {fillSlots(t('buyer.seller.about.member_since'), { date: since })}
        </AppText>
      </View>
    </ScrollView>
  );
}
