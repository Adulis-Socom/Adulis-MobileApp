import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useRef, type ComponentProps } from 'react';
import { ActivityIndicator, Alert, Pressable, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';

import type { SaveTarget } from '../api/client';
import { failureMessage, fillSlots } from '../api/messages';
import { SessionChanged, useSession } from '../auth/session';
import { parseReturnTo } from '../auth/sign-in-flow';
import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { CardSavesContext, useCardSave } from './saved';
import { startGuestSave } from './SaveButton';

type Props = {
  target: SaveTarget;
  /** The card's public name (Product name, Scene caption) for the screen-reader label. */
  name: string;
  /** Where a guest's sign-in returns: the target's own screen (a path checked by parseReturnTo). */
  returnTo: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * The Save on a discovery card (WO-009A S7; ADU-SRC-01 v3.2 S21): a bookmark that is filled
 * once the server holds the target in Saved and outlined otherwise, so the state never rests on
 * colour. A sibling of the card's own Pressable, never inside it: a tap saves and never opens
 * the card, and a screen reader reaches both. Shown only in a list that reads saved state.
 */
export function CardSaveButton(props: Props) {
  const { session } = useSession();
  const saves = useContext(CardSavesContext);
  if (!saves) return null;
  // FlashList recycles cells across items: keyed by target, a recycled cell never inherits
  // another item's in-flight Save (a mutation already sent still confirms its own target).
  const key = `${props.target.type}:${props.target.ref}`;
  return session.status === 'signedIn' ? <SignedInCardSave key={key} {...props} /> : <GuestCardSave key={key} {...props} surface={saves.surface} />;
}

function useLook() {
  const theme = useTheme();
  // The icon grows with the text size; the round target never drops below the touch minimum.
  const icon = Math.round(22 * Math.min(useWindowDimensions().fontScale, 2));
  const size = Math.max(theme.touchTarget, icon + 20);
  const round: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  };
  return { theme, icon, round };
}

type IconName = ComponentProps<typeof Ionicons>['name'];

function SignedInCardSave({ target, name, style }: Props) {
  const t = useT();
  const { theme, icon, round } = useLook();
  const save = useCardSave(target)!;

  // A refused or lost Save says why, once per failure (independent review R1: this effect also
  // runs on unrelated re-renders while the failure is still held); the bookmark keeps showing
  // the server's state. A request refused because the session changed says nothing.
  const said = useRef<unknown>(null);
  useEffect(() => {
    if (!save.error || save.error === said.current || save.error instanceof SessionChanged) return;
    said.current = save.error;
    Alert.alert(t('buyer.save.failed'), failureMessage(t, save.error));
  }, [save.error, t]);

  if (save.status === 'error' && !save.busy) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fillSlots(t('buyer.save.card.retry'), { name }) ?? t('common.retry')}
        accessibilityState={{ busy: save.fetching, disabled: save.fetching }}
        // One read again at a time: a tap while it is on its way sends nothing more.
        disabled={save.fetching}
        onPress={save.retry}
        style={[round, { opacity: save.fetching ? 0.5 : 1 }, style]}
        testID="card-save-retry"
      >
        <Ionicons name="refresh" size={icon} color={theme.color.text} />
      </Pressable>
    );
  }

  const loading = save.status === 'loading';
  const label = save.busy
    ? fillSlots(t(save.removing ? 'buyer.save.card.removing' : 'buyer.save.card.saving'), { name })
    : fillSlots(t('buyer.save.card.label'), { name });
  const glyph: IconName = save.saved ? 'bookmark' : 'bookmark-outline';
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={label ?? t('buyer.save.save')}
      accessibilityState={{ checked: save.saved, busy: save.busy || loading, disabled: save.busy || loading }}
      disabled={save.busy || loading}
      onPress={save.toggle}
      style={[round, { opacity: loading ? 0.5 : 1 }, style]}
      testID="card-save"
    >
      {save.busy ? (
        <ActivityIndicator color={theme.color.accent} />
      ) : (
        <Ionicons name={glyph} size={icon} color={save.saved ? theme.color.accent : theme.color.text} />
      )}
    </Pressable>
  );
}

function GuestCardSave({ target, name, returnTo, style, surface }: Props & { surface: Parameters<typeof startGuestSave>[1]['surface'] }) {
  const t = useT();
  const router = useRouter();
  const { theme, icon, round } = useLook();
  return (
    <Pressable
      // A button, not a toggle: for a guest it opens the sign-in prompt and holds no state.
      accessibilityRole="button"
      accessibilityLabel={fillSlots(t('buyer.save.card.label'), { name }) ?? t('buyer.save.save')}
      onPress={() =>
        // Nothing is saved for a guest: the reason, then Sign in or Cancel. Sign in opens the
        // target's own screen and the sign-in over it (as from Product Detail), so the finished
        // sign-in returns there, Back returns to this list, and the Save completes in the new
        // session only (independent review R2).
        Alert.alert(t('buyer.saved.signed_out'), t('buyer.save.card.sign_in'), [
          { text: t('buyer.saved.cancel'), style: 'cancel' },
          {
            text: t('auth.sign_in'),
            onPress: () => {
              const back = parseReturnTo(returnTo);
              if (back !== '/account') router.push(back);
              startGuestSave(router, { target, surface, sceneRef: null }, back);
            },
          },
        ])
      }
      style={[round, style]}
      testID="card-save"
    >
      <Ionicons name="bookmark-outline" size={icon} color={theme.color.text} />
    </Pressable>
  );
}
