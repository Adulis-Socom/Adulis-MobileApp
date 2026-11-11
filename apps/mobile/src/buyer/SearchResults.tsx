import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useBootstrap } from '../api/bootstrap';
import type { SearchItem, SearchPage, SearchType } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { formatPriceSpan, hasMessage, useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl } from './for-you-feed';
import { usePublicList } from './public-list';
import { PublicListView } from './PublicListView';
import { ProductTile } from './SellerProfile';

/** One result, as a stable key: a type and its public identity. */
export const searchKey = (item: SearchItem) =>
  item.type === 'PRODUCT_POST'
    ? `PRODUCT_POST:${item.payload.id}`
    : item.type === 'SELLER'
      ? `SELLER:${item.payload.handle}`
      : `SCENE_POST:${item.payload.public_ref}`;

/**
 * The results of one query in one tab (WO-008): Top is one bounded mixed page; Products and
 * Scenes are two-column grids; Sellers a list -- each paged by the server's query-bound cursor.
 * The list is keyed by tab and query, so a late answer to an older query lands in a list nobody
 * shows. Read only once a bootstrap has placed the device in its Market, as the Shop does.
 */
export function SearchResults({ query, tab }: { query: string; tab: SearchType }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { api } = useSession();
  const bootstrap = useBootstrap();
  const placed = bootstrap.data !== undefined;
  const list = usePublicList({
    resource: ['search', tab, query],
    read: placed ? (cursor) => api.search(query, tab, cursor) : null,
    items: (page: SearchPage) => page.items,
    keyOf: searchKey,
  });
  const blocked = placed
    ? list.firstPage?.market_resolved === false
      ? { message: t('buyer.search.no_market'), onRetry: () => void bootstrap.refetch().then(() => list.refresh()) }
      : null
    : bootstrap.fetchStatus === 'paused'
      ? { message: t('common.offline') }
      : bootstrap.isError && !bootstrap.isFetching
        ? { message: failureMessage(t, bootstrap.error), onRetry: () => void bootstrap.refetch() }
        : null;
  const grid = tab === 'PRODUCT_POST' || tab === 'SCENE_POST';
  return (
    <PublicListView
      list={list}
      keyOf={searchKey}
      renderItem={({ item }) =>
        tab === 'PRODUCT_POST' && item.type === 'PRODUCT_POST' ? (
          <ProductTile product={item.payload} handle={item.payload.seller.handle} seller={item.payload.seller} />
        ) : tab === 'SCENE_POST' && item.type === 'SCENE_POST' ? (
          <SearchSceneTile scene={item.payload} />
        ) : (
          <SearchRow item={item} />
        )
      }
      numColumns={grid ? 2 : 1}
      empty="buyer.search.loading"
      emptyState={
        <View style={{ gap: theme.space.md, alignItems: 'center' }}>
          <AppText style={{ textAlign: 'center', color: theme.color.textSecondary }}>
            {fillSlots(t('buyer.search.empty'), { query }) ?? query}
          </AppText>
          <Button label={t('buyer.search.go_shop')} onPress={() => router.navigate('/shop')} />
          <Button label={t('buyer.search.go_home')} onPress={() => router.navigate('/home/for-you')} />
        </View>
      }
      loading="buyer.search.loading"
      testID={`search-results-${tab}`}
      label={t('buyer.search.results')}
      blocked={blocked}
      onRefresh={blocked?.onRetry}
    />
  );
}

/** A compact result row (Top, Sellers): every type, opening its existing screen. */
function SearchRow({ item }: { item: SearchItem }) {
  const t = useT();
  const theme = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const mediaOrigin = useBootstrap().data?.media_public_origin;
  const row = { flexDirection: 'row' as const, gap: theme.space.sm, padding: theme.space.sm, minHeight: theme.touchTarget, alignItems: 'center' as const };
  const thumb = (key: string | null) => {
    const uri = key ? mediaUrl(mediaOrigin, key) : null;
    const style = { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceMuted };
    return uri ? <Image source={{ uri }} contentFit="cover" cachePolicy="disk" style={style} /> : <View style={style} />;
  };

  if (item.type === 'PRODUCT_POST') {
    const p = item.payload;
    const price = formatPriceSpan(locale, t, { min: p.price_min_minor, max: p.price_max_minor, currency: p.price_currency });
    const availability = t(p.available ? 'buyer.product.available' : 'buyer.product.unavailable');
    const label = [p.name, price, availability].filter(Boolean).join(', ');
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => router.push({ pathname: '/product/[handle]/[slug]', params: { handle: p.seller.handle, slug: p.slug } })}
        style={row}
        testID="search-product"
      >
        {thumb(p.image_key)}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText numberOfLines={2} style={{ fontWeight: theme.fontWeight.semibold }}>
            {p.name}
          </AppText>
          {price ? <AppText>{price}</AppText> : null}
          <AppText style={{ color: p.available ? theme.color.text : theme.color.textSecondary }}>{availability}</AppText>
          <AppText style={{ color: theme.color.textSecondary }}>
            {fillSlots(t('buyer.product.seller'), { store: p.seller.store_name }) ?? p.seller.store_name}
          </AppText>
        </View>
      </Pressable>
    );
  }
  if (item.type === 'SELLER') {
    const s = item.payload;
    const level = s.trust_level ? `buyer.seller.trust.${s.trust_level}` : null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fillSlots(t('buyer.search.seller'), { store: s.store_name, handle: s.handle }) ?? s.store_name}
        onPress={() => router.push({ pathname: '/sellers/[handle]', params: { handle: s.handle } })}
        style={row}
        testID="search-seller"
      >
        <View style={{ flex: 1, gap: 2 }}>
          <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{s.store_name}</AppText>
          <AppText style={{ color: theme.color.textSecondary }}>{`@${s.handle}`}</AppText>
          {level && hasMessage(level) ? <AppText>{fillSlots(t('buyer.seller.trust'), { level: t(level) })}</AppText> : null}
        </View>
      </Pressable>
    );
  }
  const scene = item.payload;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fillSlots(t('buyer.seller.scene'), { caption: scene.caption }) ?? scene.caption}
      onPress={() => router.push({ pathname: '/scenes/[scenePostRef]', params: { scenePostRef: scene.public_ref } })}
      style={row}
      testID="search-scene"
    >
      {thumb(scene.image.thumb_key)}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={2}>{scene.caption}</AppText>
        <AppText style={{ color: theme.color.textSecondary }}>
          {fillSlots(t('buyer.search.scene_by'), { store: scene.seller.store_name }) ?? scene.seller.store_name}
        </AppText>
      </View>
    </Pressable>
  );
}

/** A Scene in the Scenes grid: image, caption summary, Seller attribution; opens Explore the Scene. */
function SearchSceneTile({ scene }: { scene: Extract<SearchItem, { type: 'SCENE_POST' }>['payload'] }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const uri = mediaUrl(useBootstrap().data?.media_public_origin, scene.image.card_key);
  const square = { width: '100%' as const, aspectRatio: 1, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceMuted };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fillSlots(t('buyer.seller.scene'), { caption: scene.caption }) ?? scene.caption}
      onPress={() => router.push({ pathname: '/scenes/[scenePostRef]', params: { scenePostRef: scene.public_ref } })}
      style={{ flex: 1, margin: theme.space.xs, gap: theme.space.xs }}
      testID="search-scene-tile"
    >
      {uri ? <Image source={{ uri }} contentFit="cover" cachePolicy="disk" style={square} /> : <View style={square} />}
      <AppText numberOfLines={2}>{scene.caption}</AppText>
      <AppText numberOfLines={1} style={{ color: theme.color.textSecondary }}>
        {fillSlots(t('buyer.search.scene_by'), { store: scene.seller.store_name }) ?? scene.seller.store_name}
      </AppText>
    </Pressable>
  );
}
