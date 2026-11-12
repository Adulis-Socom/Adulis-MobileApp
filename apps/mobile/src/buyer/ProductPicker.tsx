import { Image } from 'expo-image';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useBootstrap } from '../api/bootstrap';
import type { SellerProduct } from '../api/client';
import { fillSlots } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl } from './for-you-feed';
import { usePublicList } from './public-list';
import { PublicListView } from './PublicListView';
import { keepIfCurrent, usePrivateApi } from './saved';

/**
 * Select a Product (WO-015; ADU-CHAT-01 v3.3 S5): the conversation Seller's public Products, page by
 * page (GET /v1/storefronts/{handle}/products), to attach one to the next message.
 *
 * - `handle` is the Seller handle from the Buyer's own authenticated conversation list, never from a
 *   route parameter. Requests go through the session-bound client and a late answer is dropped.
 * - Choosing a Product only hands its slug back: the conversation screen then reads that Product
 *   itself and checks it belongs to this conversation's Seller (the same path as Ask Seller from
 *   Product Detail). Nothing is sent from here.
 * - Loading, empty, offline, error, retry and paging are the shared public list's states. No count
 *   and no search: the API lists pages only.
 */
export function ProductPicker({
  handle,
  store,
  onSelect,
  onCancel,
}: {
  handle: string;
  store: string;
  onSelect: (slug: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const theme = useTheme();
  const api = usePrivateApi();
  const list = usePublicList({
    resource: ['chat-picker', handle],
    read: api ? (cursor) => keepIfCurrent(api, (a) => a.sellerProducts(handle, cursor)) : null,
    items: (page) => page.data,
    keyOf: (product: SellerProduct) => product.id,
  });
  const secondary = { color: theme.color.textSecondary };

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      {/* A modal is its own window, drawn edge to edge: it needs its own safe-area provider (B-005). */}
      <SafeAreaProvider>
      <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: theme.color.bg }}>
        <View style={{ padding: theme.space.md, gap: theme.space.xs, borderBottomWidth: 1, borderColor: theme.color.border }}>
          <AppText variant="heading" accessibilityRole="header">
            {t('buyer.chat.picker_title')}
          </AppText>
          <AppText style={secondary}>{fillSlots(t('buyer.chat.picker_from'), { store }) ?? store}</AppText>
          <AppText style={secondary}>{t('buyer.chat.picker_note')}</AppText>
        </View>
        <View style={{ flex: 1 }}>
          <PublicListView
            list={list}
            keyOf={(product) => product.id}
            renderItem={({ item }) => <PickerRow product={item} onPress={() => onSelect(item.slug)} />}
            empty="buyer.chat.picker_empty"
            loading="buyer.chat.picker_loading"
            testID="chat-product-picker"
            label={t('buyer.chat.picker_title')}
          />
        </View>
        <View style={{ padding: theme.space.md, borderTopWidth: 1, borderColor: theme.color.border }}>
          <Button label={t('buyer.chat.picker_cancel')} variant="secondary" onPress={onCancel} />
        </View>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** One Product: its first photo, its name and its availability in words (the server's). */
function PickerRow({ product, onPress }: { product: SellerProduct; onPress: () => void }) {
  const t = useT();
  const theme = useTheme();
  const mediaOrigin = useBootstrap().data?.media_public_origin;
  const uri = product.image_key ? mediaUrl(mediaOrigin, product.image_key) : null;
  const availability = t(product.available ? 'buyer.product.available' : 'buyer.product.unavailable');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fillSlots(t('buyer.chat.picker_item'), { name: product.name, availability }) ?? product.name}
      onPress={onPress}
      testID="chat-picker-item"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.space.md,
        minHeight: 64,
        padding: theme.space.sm,
        marginBottom: theme.space.xs,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.color.border,
        backgroundColor: pressed ? theme.color.surfaceMuted : theme.color.surface,
      })}
    >
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          cachePolicy="disk"
          accessible={false}
          style={{ width: 56, height: 56, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceMuted }}
        />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceMuted }} />
      )}
      <View style={{ flex: 1, gap: theme.space.xs }}>
        <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{product.name}</AppText>
        <AppText style={{ color: product.available ? theme.color.text : theme.color.textSecondary }}>{availability}</AppText>
      </View>
    </Pressable>
  );
}
