import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBootstrap } from '../../../api/bootstrap';
import type { ShopProduct } from '../../../api/client';
import { failureMessage } from '../../../api/messages';
import { useSession } from '../../../auth/session';
import { CategoryTabs, categoryRefused, useCategories, useCategoryStillOffered } from '../../../buyer/categories';
import { usePublicList } from '../../../buyer/public-list';
import { PublicListView } from '../../../buyer/PublicListView';
import { ProductTile } from '../../../buyer/SellerProfile';
import { AppText } from '../../../components/AppText';
import { useT } from '../../../i18n/i18n';
import { useTheme } from '../../../theme/theme';

const keyOf = (product: ShopProduct) => `${product.seller.handle}/${product.slug}`;
// WO-009A: a Product's Save target is its id, never its handle and slug.
const saveTarget = (product: ShopProduct) => ({ type: 'PRODUCT_POST' as const, ref: product.id });

/**
 * Shop (ADU-MOB-02 v4.3 S32; WO-007): Product-oriented browsing of the Buyer's Market -- For You
 * stays Scene-only. One deterministic order, newest first publication, labelled as such: no
 * ranking, personalisation or paid placement. A tile opens the Product; its Seller line opens the
 * Seller Profile. WO-010: All Products (default) or one category the server enables in this Market,
 * filtered on the server in the same order. Locally Made, Discounts and New Drops are not here: no
 * membership rule is approved. Marketplace Search is its own screen (the header's Search entry).
 *
 * The Market is the server's; the list is keyed by the subject (a sign-in or sign-out reads it
 * again), revalidated after the background interval and on a pull. The tab stays mounted, so the
 * scroll position survives a trip to a Product or a Seller and back.
 */
export default function Shop() {
  const t = useT();
  const theme = useTheme();
  const { api } = useSession();
  const bootstrap = useBootstrap();
  // The Market comes from a successful bootstrap (it registers a new install's device). Until one
  // succeeds there is no Market to browse, so nothing is read: an empty page would read as
  // "no Products" when the truth is "no Market" (ON-043). Never another Market's Products.
  const placed = bootstrap.data !== undefined;
  // WO-010: All Products (the default) or one category the server enables in this Market,
  // filtered on the server; each choice is its own list and cursor.
  const [category, setCategory] = useState<string | null>(null);
  const categories = useCategories(placed);
  const list = usePublicList({
    // '' (never a category code) for All, so a category coded ALL could never share its list.
    resource: ['shop-products', category ?? ''],
    read: placed ? (cursor) => api.shopProducts(cursor, category) : null,
    items: (page) => page.data,
    keyOf,
  });
  // The server stopped offering the chosen category: back to All, and read the categories again.
  const { refetch: refetchCategories } = categories;
  useEffect(() => {
    if (categoryRefused(list.error)) {
      setCategory(null);
      void refetchCategories();
    }
  }, [list.error, refetchCategories]);
  const choose = useCallback((code: string | null) => setCategory(code), []);
  const toAll = useCallback(() => setCategory(null), []);
  useCategoryStillOffered(category, categories, toAll);
  const blocked = placed
    ? list.firstPage?.market_resolved === false
      ? {
          message: t('buyer.shop.no_market'),
          onRetry: () => void bootstrap.refetch().then(() => list.refresh()),
        }
      : null
    : bootstrap.fetchStatus === 'paused'
      ? // Offline: the bootstrap resumes by itself when the connection returns.
        { message: t('common.offline') }
      : bootstrap.isError && !bootstrap.isFetching // a retry in flight shows the loading state
        ? { message: failureMessage(t, bootstrap.error), onRetry: () => void bootstrap.refetch() }
        : null;
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.color.bg }}
    >
      <PublicListView
        list={list}
        keyOf={keyOf}
        renderItem={({ item }) => (
          // The card derivative, as on the Seller Profile: never the full-size image.
          <ProductTile product={item} handle={item.seller.handle} seller={item.seller} />
        )}
        numColumns={2}
        saves={{ surface: 'SHOP', target: saveTarget }}
        header={
          <View
            style={{
              paddingHorizontal: theme.space.sm,
              paddingTop: theme.space.sm,
              gap: theme.space.xs,
            }}
          >
            <AppText variant="heading" accessibilityRole="header">
              {t('buyer.tab.shop')}
            </AppText>
            <AppText style={{ color: theme.color.textSecondary }}>{t('buyer.shop.order')}</AppText>
            {placed && !blocked && (categories.categories.length > 0 || categories.isError) ? (
              <CategoryTabs
                categories={categories.categories}
                value={category}
                onChange={choose}
                failed={categories.isError && !categories.isFetching}
                onRetry={() => void refetchCategories()}
              />
            ) : null}
          </View>
        }
        empty={category ? 'buyer.shop.category_empty' : 'buyer.shop.empty'}
        loading="buyer.shop.loading"
        blocked={blocked}
        // While blocked, a pull does what the retry does (re-place the device), not a bare re-read;
        // otherwise it reads the list and the categories again.
        onRefresh={
          blocked?.onRetry ??
          (() => {
            list.refresh();
            void refetchCategories();
          })
        }
        testID="shop-products"
        label={t('buyer.shop.products')}
      />
    </SafeAreaView>
  );
}
