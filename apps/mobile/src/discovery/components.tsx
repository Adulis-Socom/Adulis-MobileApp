// Shared discovery presentation: the media seam, Scene card, Product tile, tag rows and the paged list. No ranking cue, no count,
// no discount, no stock number. Availability is words. The photo area is a neutral placeholder until the media seam has an
// origin (GAP-L2-02): a fixture opens no network and a live origin is not invented.
import type { ReactNode } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { MediaRef, ProductTile, SceneCardUnit, SceneTag } from '../contracts/gap-mob-discovery';
import { t } from '../i18n/messages';
import { Body, Button, Notice, StateView } from '../ui/components';
import { useMediaResolver } from '../ui/media';
import { theme } from '../ui/theme';
import { availabilityText, priceOf } from './format';
import { problemKind } from './hooks';

/**
 * One picture through the media seam (ui/media.ts). A resolved picture is drawn whole (contain, so nothing the Seller composed is
 * cropped) with its description; an unresolved one is the neutral placeholder. Never a guessed URL.
 */
export function MediaImage({ media, height, label }: { readonly media: MediaRef; readonly height: number; readonly label?: boolean }) {
  const source = useMediaResolver()(media.ref);
  if (source !== null) {
    return <Image source={source} resizeMode="contain" accessible accessibilityRole="image" accessibilityLabel={media.alt} style={[styles.media, { height, width: '100%' }]} />;
  }
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={media.alt} style={[styles.media, { height }]}>
      {label ? <Text style={styles.mediaText}>{t('mobile.media.unavailable')}</Text> : null}
    </View>
  );
}

export function TagLine({ tag }: { readonly tag: Pick<SceneTag, 'name' | 'available'> }) {
  return (
    <Text style={styles.tag}>
      {tag.name}. {availabilityText(tag.available)}
    </Text>
  );
}

/** The For You / Following card: photo, caption, tags in words, ONE primary action. No hotspot, no overlay, no Like count. */
export function SceneCard({ scene, onExplore, actions }: { readonly scene: SceneCardUnit; readonly onExplore: () => void; readonly actions?: ReactNode }) {
  return (
    <View style={styles.card}>
      <Pressable accessible={false} onPress={onExplore}>
        <MediaImage media={scene.image} height={220} />
      </Pressable>
      <Text style={styles.seller}>{t('mobile.scene.by_seller', { seller: scene.seller.storeName })}</Text>
      <Text numberOfLines={3} style={styles.caption}>
        {scene.caption}
      </Text>
      {scene.tags.map((tag) => (
        <TagLine key={tag.position} tag={tag} />
      ))}
      <Button label={t('mobile.scene.explore')} onPress={onExplore} />
      {actions}
    </View>
  );
}

export function ProductTileView({ product, onOpen }: { readonly product: ProductTile; readonly onOpen: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${product.name}. ${priceOf(product)}. ${availabilityText(product.available)}`} onPress={onOpen} style={styles.tile}>
      {product.image ? <MediaImage media={product.image} height={120} /> : null}
      <Text style={styles.tileName}>{product.name}</Text>
      <Text style={styles.tilePrice}>{priceOf(product)}</Text>
      <Text style={styles.tag}>{availabilityText(product.available)}</Text>
    </Pressable>
  );
}

/** A paged list with every state honest: loading, empty, offline, error, gone, retry, and a visible "Load more" that always works. */
export function PagedList<T>({
  query,
  keyOf,
  accept,
  renderItem,
  empty,
  header,
}: {
  readonly query: {
    readonly data: { readonly pages: readonly { readonly items: readonly T[] }[] } | undefined;
    readonly status: 'pending' | 'error' | 'success';
    readonly error: unknown;
    readonly isFetchingNextPage: boolean;
    readonly hasNextPage: boolean;
    readonly isRefetching: boolean;
    readonly fetchNextPage: () => unknown;
    readonly refetch: () => unknown;
  };
  readonly keyOf: (item: T) => string;
  /** Backstop for a unit the client does not know (a Product Post in a Scene feed is skipped, never shown). */
  readonly accept?: (item: T) => boolean;
  readonly renderItem: (item: T) => ReactNode;
  readonly empty?: string;
  readonly header?: ReactNode;
}) {
  if (query.status === 'pending') return <StateView kind="loading" />;
  const hasItems = (query.data?.pages ?? []).some((page) => page.items.length > 0);
  // A failed refresh or next page over items already on screen keeps them and says so at the foot (recovered from the
  // archived list-refresh / load-more-offline regressions): only a failure with nothing to show replaces the list.
  const footerProblem = query.status === 'error' && hasItems ? problemKind(query.error) : null;
  if (query.status === 'error' && !hasItems) {
    const kind = problemKind(query.error);
    if (kind === 'session') return <StateView kind="loading" />; // an old session's failure is not shown to the new one
    return <StateView kind={kind === 'offline' ? 'offline' : kind === 'gone' ? 'not-found' : 'error'} onRetry={() => void query.refetch()} />;
  }
  // The server's order, flattened; a repeat across pages is shown once (the first place the server put it).
  const seen = new Set<string>();
  const items = (query.data?.pages ?? []).flatMap((page) => page.items).filter((item) => accept === undefined || accept(item)).filter((item) => (seen.has(keyOf(item)) ? false : (seen.add(keyOf(item)), true)));
  return (
    <FlatList
      data={items}
      keyExtractor={keyOf}
      renderItem={({ item }) => <View style={styles.row}>{renderItem(item)}</View>}
      ListHeaderComponent={header ? <View>{header}</View> : undefined}
      ListEmptyComponent={<StateView kind="empty" message={empty ?? t('mobile.state.empty')} />}
      ListFooterComponent={
        footerProblem !== null && footerProblem !== 'session' ? (
          <View style={styles.row}>
            <Notice tone="warn" text={t(footerProblem === 'offline' ? 'mobile.state.offline' : 'error.request.internal')} />
            <Button kind="secondary" label={t('mobile.state.retry')} onPress={() => void query.refetch()} />
          </View>
        ) : query.hasNextPage ? (
          <View style={styles.row}>
            <Button kind="secondary" label={t('mobile.list.load_more')} busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} />
          </View>
        ) : undefined
      }
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
      onEndReachedThreshold={0.5}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={() => void query.refetch()}
      contentContainerStyle={styles.list}
    />
  );
}

export const Section = ({ title, children }: { readonly title: string; readonly children: ReactNode }) => (
  <View style={{ gap: theme.space.sm }}>
    <Text accessibilityRole="header" style={styles.section}>
      {title}
    </Text>
    {children}
  </View>
);

export { Body };

const styles = StyleSheet.create({
  media: { backgroundColor: theme.color.surfaceSunk, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  mediaText: { ...theme.text.small, color: theme.color.textMuted },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.md, gap: theme.space.sm },
  seller: { ...theme.text.small, color: theme.color.textSecondary },
  caption: { ...theme.text.body, color: theme.color.text },
  tag: { ...theme.text.small, color: theme.color.textSecondary },
  tile: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.smd, gap: theme.space.xs, minHeight: theme.touch },
  tileName: { ...theme.text.body, color: theme.color.text, fontWeight: '600' },
  tilePrice: { ...theme.text.body, color: theme.color.text },
  section: { ...theme.text.heading, color: theme.color.text },
  list: { paddingBottom: theme.space.xl },
  row: { marginBottom: theme.space.md },
});
