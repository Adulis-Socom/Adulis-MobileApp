import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBootstrap } from '../../../api/bootstrap';
import type { ShopProduct } from '../../../api/client';
import { failureMessage } from '../../../api/messages';
import { useSession } from '../../../auth/session';
import { usePublicList } from '../../../buyer/public-list';
import { PublicListView } from '../../../buyer/PublicListView';
import { ProductTile } from '../../../buyer/SellerProfile';
import { AppText } from '../../../components/AppText';
import { useT } from '../../../i18n/i18n';
import { useTheme } from '../../../theme/theme';

const keyOf = (product: ShopProduct) => `${product.seller.handle}/${product.slug}`;

/**
 * Shop (ADU-MOB-02 v4.3 S32; WO-007): Product-oriented browsing of the Buyer's Market -- For You
 * stays Scene-only. One deterministic order, newest first publication, labelled as such: no
 * ranking, personalisation or paid placement. A tile opens the Product; its Seller line opens the
 * Seller Profile. Categories, Locally Made, Discounts and Marketplace Search are not here: no
 * category taxonomy or labels exist yet, and Search is its own work order (the header's Search
 * entry is unchanged).
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
  const list = usePublicList({
    resource: ['shop-products'],
    read: placed ? (cursor) => api.shopProducts(cursor) : null,
    items: (page) => page.data,
    keyOf,
  });
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
          </View>
        }
        empty="buyer.shop.empty"
        loading="buyer.shop.loading"
        blocked={blocked}
        // While blocked, a pull does what the retry does (re-place the device), not a bare re-read.
        onRefresh={blocked?.onRetry}
        testID="shop-products"
        label={t('buyer.shop.products')}
      />
    </SafeAreaView>
  );
}
