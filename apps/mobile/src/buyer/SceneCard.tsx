import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { Pressable, View } from 'react-native';

import type { FypUnit } from '../api/client';
import { fillSlots } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
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
 * - ONE ACTION: Explore the Scene (WO-005), by the photo or the labelled button. It opens
 *   /scenes/{public_ref}, which reads the Scene again; this unit is never its authority.
 *   Like, Save, Share, Reviews, Follow and More have no backend yet, so none is drawn
 *   (WO-004A S3.10). Tags are labels, not purchase authority.
 * - One screen-reader stop for the summary, in reading order: Seller, caption, tags with
 *   their availability spelled out (never colour alone); then the button, its own stop.
 *   The photo's tap is a touch shortcut to the same action, so it adds no extra stop.
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
  const router = useRouter();
  const explore = () => router.push({ pathname: '/scenes/[scenePostRef]', params: { scenePostRef: unit.public_ref } });
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
      style={{
        backgroundColor: theme.color.surface,
        borderColor: theme.color.border,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
      }}
    >
      <View accessible accessibilityLabel={spoken}>
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

        <Pressable onPress={explore} accessible={false} testID="scene-photo-explore">
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
        </Pressable>

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
      <View style={{ paddingHorizontal: theme.space.md, paddingBottom: theme.space.md }}>
        <Button label={t('buyer.scene.explore')} onPress={explore} />
      </View>
    </View>
  );
});
