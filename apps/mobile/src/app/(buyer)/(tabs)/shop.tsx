import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useBootstrap } from '../../../api/bootstrap';
import type { ShopProduct } from '../../../api/client';
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
  // A new install's device (the guest's Market) is registered by the first bootstrap; reading
  // before it settles gets an empty page that would read as "no Products".
  const bootstrapSettled = !useBootstrap().isPending;
  const list = usePublicList({
    resource: ['shop-products'],
    read: bootstrapSettled ? (cursor) => api.shopProducts(cursor) : null,
    items: (page) => page.data,
    keyOf,
  });
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
        testID="shop-products"
        label={t('buyer.shop.products')}
      />
    </SafeAreaView>
  );
}
