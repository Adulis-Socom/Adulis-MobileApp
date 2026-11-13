import { am } from '@adulis/locale';
import { bg, space } from '@adulis/tokens/native';
import { StyleSheet, View } from 'react-native';

import { Text } from '../src/components/Text';

/**
 * WO-0b's one route (ADU-MOB-WO-01 v1.2 S0b.2): the wordmark, "TikTok",
 * "Instagram", a figure and a line of Amharic, together -- exactly those five,
 * so the tier 0 device gate can look for a missing-glyph box in the mixed-
 * script render (ADU-PRD-01 S23.1, ADU-MOB-01 B16). It is not MB-00 and does
 * not pretend to be: MB-00 arrives with WO-1.
 *
 * The Amharic line is a catalogue entry rendered from @adulis/locale, not a
 * string typed here (ADU-MOB-02 S16: every string is a catalogue key). It is a
 * machine-translation placeholder like every am.ts entry today (MT-KEYS.md);
 * this screen tests glyphs, not copy. The figure is set in the LATIN family --
 * that is what S23.1 asks to see beside Amharic -- and goes through Intl with
 * Latin digits forced, because a device locale can switch numbering systems;
 * WO-1 formats against the market from /v1/bootstrap (ADU-MOB-02 S4.4).
 */
export default function Placeholder() {
  const figure = new Intl.NumberFormat('en-ET', {
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(1234.5);

  return (
    <View style={styles.screen}>
      <Text variant="display" testID="wordmark">
        Adulis
      </Text>
      <Text variant="body" testID="platform-tiktok">
        TikTok
      </Text>
      <Text variant="body" testID="platform-instagram">
        Instagram
      </Text>
      <Text variant="body" testID="figure">
        {figure}
      </Text>
      <Text variant="body" testID="line-am">
        {am['health.ok']}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: bg.base,
    padding: space[5],
    gap: space[3],
  },
});
