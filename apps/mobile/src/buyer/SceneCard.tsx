import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { View } from 'react-native';

import type { FypUnit } from '../api/client';
import { fillSlots } from '../api/messages';
import { AppText } from '../components/AppText';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { mediaUrl } from './for-you-feed';

/** Tags named on the card; the rest are counted. The card is a summary, not the Scene. */
const SHOWN_TAGS = 3;
/**
 * The feed frame. MEDIA-01 gives the FYP derivative "a known aspect ratio" but no number,
 * so the frame is fixed and the photo covers it (register: WO-004A).
 */
const PHOTO_ASPECT = 4 / 5;

const initials = (name: string) =>
  Array.from(name.trim().split(/\s+/).slice(0, 2), (word) => Array.from(word)[0] ?? '').join('').toUpperCase();

/**
 * One For You Scene (ADU-MOB-02 S11 R-03: a structured card, not full-screen media),
 * built only from the unit /v1/fyp served:
 *
 * - Seller identity, the photo (no hotspots, R-06), the caption, tagged Product names with
 *   their current availability. No price, stock or internal id is in the unit to show.
 * - NO CONTROLS. Like, Save, Share, Reviews, Follow, More and Explore the Scene have no
 *   backend yet, so none is drawn (WO-004A S3.10); the card does not navigate (Explore is
 *   a later work order). Tags are labels, not purchase authority.
 * - One screen-reader stop per card, in reading order: Seller, caption, tags with their
 *   availability spelled out (never colour alone).
 */
export const SceneCard = memo(function SceneCard({
  unit,
  mediaOrigin,
}: {
  unit: FypUnit;
  mediaOrigin: string | undefined;
}) {
  const t = useT();
  const theme = useTheme();
  // Keyed by the image, so a recycled cell never inherits another Scene's failure.
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const uri = mediaUrl(mediaOrigin, unit.image.card_key);
  const showPhoto = uri !== null && failedKey !== unit.image.card_key;
  const store = unit.seller.store_name;

  const shown = unit.products.slice(0, SHOWN_TAGS);
  const hidden = unit.products.length - shown.length;
  const unavailable = t('buyer.for_you.product_unavailable');
  const tagText = (p: FypUnit['products'][number]) => (p.available ? p.name : `${p.name} (${unavailable})`);
  const more = hidden > 0 ? fillSlots(t('buyer.for_you.products_more'), { count: hidden }) : null;
  const spoken = [
    fillSlots(t('buyer.for_you.card'), { store, caption: unit.caption }) ?? store,
    showPhoto ? null : t('buyer.for_you.photo_unavailable'),
    unit.products.length > 0
      ? `${t('buyer.for_you.products')}: ${unit.products.map(tagText).join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, padding: theme.space.md }}>
        <View
          style={{
            width: theme.touchTarget,
            height: theme.touchTarget,
            borderRadius: theme.touchTarget / 2,
            backgroundColor: theme.color.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{initials(store)}</AppText>
        </View>
        <AppText style={{ flex: 1, fontWeight: theme.fontWeight.semibold }} numberOfLines={2}>
          {store}
        </AppText>
      </View>

      {showPhoto ? (
        <Image
          source={{ uri }}
          recyclingKey={unit.public_ref}
          contentFit="cover"
          // Public Scene media only: the one kind allowed on the normal disk cache (MOB-02).
          cachePolicy="disk"
          onError={() => setFailedKey(unit.image.card_key)}
          style={{ width: '100%', aspectRatio: PHOTO_ASPECT, backgroundColor: theme.color.surfaceMuted }}
          testID="scene-photo"
        />
      ) : (
        <View
          style={{
            width: '100%',
            aspectRatio: PHOTO_ASPECT,
            backgroundColor: theme.color.surfaceMuted,
            alignItems: 'center',
            justifyContent: 'center',
            padding: theme.space.md,
          }}
        >
          <AppText style={{ color: theme.color.textSecondary, textAlign: 'center' }}>
            {t('buyer.for_you.photo_unavailable')}
          </AppText>
        </View>
      )}

      <View style={{ padding: theme.space.md, gap: theme.space.sm }}>
        <AppText numberOfLines={2}>{unit.caption}</AppText>
        {shown.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs }}>
            {shown.map((p) => (
              <View
                key={p.position}
                style={{
                  borderWidth: 1,
                  borderColor: p.available ? theme.color.borderStrong : theme.color.border,
                  borderRadius: theme.radius.md,
                  paddingHorizontal: theme.space.sm,
                  paddingVertical: theme.space.xs,
                }}
              >
                <AppText style={{ color: p.available ? theme.color.text : theme.color.textSecondary }}>
                  {tagText(p)}
                </AppText>
              </View>
            ))}
            {more ? (
              <AppText style={{ color: theme.color.textSecondary, alignSelf: 'center' }}>{more}</AppText>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
});
