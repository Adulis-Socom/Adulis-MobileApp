// One Story, presented: a still photo, optional real text on a solid panel (contrast comes from the panel, not the photo), and at
// most ONE action that only navigates. No reply, comment, reaction, Like, share control, viewer list or count exists here.
import { StyleSheet, Text, View } from 'react-native';

import type { StoryView } from '../contracts/gap-mob-stories';
import { MediaImage } from '../discovery/components';
import { t } from '../i18n/messages';
import { Button } from '../ui/components';
import { theme } from '../ui/theme';

export function StoryCard({ story, sellerName, onOpenTarget }: { readonly story: StoryView; readonly sellerName: string; readonly onOpenTarget: () => void }) {
  return (
    <View style={styles.wrap}>
      <MediaImage media={story.photo} height={360} label />
      {story.text ? (
        <View style={styles.panel}>
          <Text selectable style={styles.text}>
            {story.text}
          </Text>
        </View>
      ) : null}
      {story.target ? <Button label={t(story.target.kind === 'PRODUCT' ? 'mobile.scene.view_product' : 'mobile.scene.explore')} onPress={onOpenTarget} /> : null}
      <Text style={styles.by}>{t('mobile.scene.by_seller', { seller: sellerName })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.md },
  panel: { backgroundColor: theme.color.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, padding: theme.space.md },
  text: { ...theme.text.body, color: theme.color.text },
  by: { ...theme.text.small, color: theme.color.textSecondary },
});
