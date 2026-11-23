import { Pressable, View } from 'react-native';

import type { CollectionItem } from '../api/client';
import { fillSlots } from '../api/messages';
import { AppText } from '../components/AppText';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { SearchSceneTile } from './SearchResults';
import { ProductTile } from './SellerProfile';

/**
 * One saved item as the server resolved it NOW (WO-009 S17): a visible Product or Scene uses the
 * Shop and Search tiles; anything else is one neutral sentence with no name, image, price,
 * caption or reason -- private, moderated, deleted and unknown look the same. Remove, where
 * offered, works on every state. `removing`: this item's Remove is in flight; `disabled`: another
 * change is (WO-018, A-006). Both are announced, not only dimmed.
 */
export function SavedItemCard({
  item,
  onRemove,
  removing = false,
  disabled = false,
}: {
  item: CollectionItem;
  onRemove?: () => void;
  removing?: boolean;
  disabled?: boolean;
}) {
  const t = useT();
  const theme = useTheme();
  // The resolved state decides, not the nullable fields: an UNAVAILABLE item never draws what a payload carries (design S40).
  const visible = item.state === 'VISIBLE';
  const product = visible ? item.product : null;
  const scene = visible ? item.scene : null;
  const name = product?.name ?? scene?.caption ?? null;
  return (
    <View style={{ flex: 1 }} testID={`saved-item-${visible ? 'visible' : 'unavailable'}`}>
      {product ? (
        <ProductTile product={product} handle={product.seller.handle} seller={product.seller} />
      ) : scene ? (
        <SearchSceneTile scene={scene} />
      ) : (
        <View style={{ flex: 1, margin: theme.space.xs, gap: theme.space.xs }}>
          <View
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: theme.radius.md,
              backgroundColor: theme.color.surfaceMuted,
            }}
          />
          <AppText style={{ color: theme.color.textSecondary }}>
            {t(
              item.target_type === 'PRODUCT_POST'
                ? 'buyer.saved.product_unavailable'
                : 'buyer.saved.scene_unavailable',
            )}
          </AppText>
        </View>
      )}
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            name
              ? (fillSlots(t('buyer.collection.remove_label'), { name }) ??
                t('buyer.collection.remove'))
              : t('buyer.collection.remove_unavailable')
          }
          accessibilityState={{ disabled: removing || disabled, busy: removing }}
          disabled={removing || disabled}
          onPress={onRemove}
          style={{
            minHeight: theme.touchTarget,
            justifyContent: 'center',
            marginHorizontal: theme.space.xs,
            opacity: removing || disabled ? 0.6 : 1,
          }}
          testID="saved-item-remove"
        >
          <AppText style={{ color: theme.color.accent, fontWeight: theme.fontWeight.semibold }}>
            {t('buyer.collection.remove')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
