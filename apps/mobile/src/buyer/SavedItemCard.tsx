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
  const name = item.product?.name ?? item.scene?.caption ?? null;
  return (
    <View style={{ flex: 1 }} testID={`saved-item-${item.state === 'VISIBLE' ? 'visible' : 'unavailable'}`}>
      {item.product ? (
        <ProductTile product={item.product} handle={item.product.seller.handle} seller={item.product.seller} />
      ) : item.scene ? (
        <SearchSceneTile scene={item.scene} />
      ) : (
        <View style={{ flex: 1, margin: theme.space.xs, gap: theme.space.xs }}>
          <View style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceMuted }} />
          <AppText style={{ color: theme.color.textSecondary }}>
            {t(item.target_type === 'PRODUCT_POST' ? 'buyer.saved.product_unavailable' : 'buyer.saved.scene_unavailable')}
          </AppText>
        </View>
      )}
      {onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            name
              ? (fillSlots(t('buyer.collection.remove_label'), { name }) ?? t('buyer.collection.remove'))
              : t('buyer.collection.remove_unavailable')
          }
          accessibilityState={{ disabled: removing || disabled, busy: removing }}
          disabled={removing || disabled}
          onPress={onRemove}
          style={{ minHeight: theme.touchTarget, justifyContent: 'center', marginHorizontal: theme.space.xs, opacity: removing || disabled ? 0.6 : 1 }}
          testID="saved-item-remove"
        >
          <AppText style={{ color: theme.color.accent, fontWeight: theme.fontWeight.semibold }}>{t('buyer.collection.remove')}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
