import { face, family } from '@adulis/tokens/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text as RNText } from 'react-native';

/**
 * The root layout -- the provider stack of ADU-MOB-01 S17.2 (`_layout.tsx:
 * providers: Query, locale, session, bootstrap gate`). At WO-0b it holds the
 * one thing the placeholder needs: the six bundled font files, loaded under the
 * names `typography.face` gives them (ADU-MOB-03 D3). Query, locale, session
 * and the bootstrap gate arrive with WO-1 and WO-2.
 *
 * Assets are `require`d by path -- Metro's documented form, typed by
 * expo/types -- and the ESLint rule allows exactly these extensions, in the
 * shared config rather than as a disable comment.
 *
 * The Ethiopic faces are loaded under `family.ethiopic`, which is the one
 * place that name is written in the token set; no component sets it (D2).
 *
 * A FONT THAT FAILS TO LOAD IS SAID, NOT HIDDEN. If the files did not load the
 * platform would silently substitute a system face, and the tier 0 glyph gate
 * (a person reading the placeholder on a device) could not tell the bundled
 * face from the fallback. So the failure renders as a plain system-font line
 * naming the error -- a developer diagnostic, not product copy.
 */
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    [face.regular]: require('../assets/fonts/Inter-Regular.ttf'),
    [face.medium]: require('../assets/fonts/Inter-Medium.ttf'),
    [face.bold]: require('../assets/fonts/Inter-Bold.ttf'),
    [family.ethiopic]: require('../assets/fonts/NotoSansEthiopic-Regular.ttf'),
    [`${family.ethiopic}-Medium`]: require('../assets/fonts/NotoSansEthiopic-Medium.ttf'),
    [`${family.ethiopic}-Bold`]: require('../assets/fonts/NotoSansEthiopic-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded || error) {
      void SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (error) {
    return <RNText testID="font-load-error">{`font load failed: ${String(error)}`}</RNText>;
  }

  if (!loaded) {
    return null;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
