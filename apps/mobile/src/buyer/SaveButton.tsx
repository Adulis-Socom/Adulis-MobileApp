import { uuid } from 'expo';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';

import type { SaveSurface, SaveTarget } from '../api/client';
import { failureMessage } from '../api/messages';
import { useSession } from '../auth/session';
import type { ReturnTo } from '../auth/sign-in-flow';
import { AlertText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useT } from '../i18n/i18n';
import { useUiStore } from '../state/ui-store';
import { useTheme } from '../theme/theme';
import { useSaveToggle } from './saved';

/**
 * Save and Add to collection (WO-009 S15; ADU-SRC-01 v3.2 S21). Signed in: Save puts the target
 * in Saved, Saved takes it out, each drawn only once the server has answered; Add to collection
 * opens the picker. A guest is told why Sign in is needed and chooses it; the Save then finishes
 * in that sign-in only (S16), and nothing is stored on the device.
 */
export function SaveButton({
  target,
  surface,
  sceneRef = null,
  returnTo,
}: {
  target: SaveTarget;
  surface: SaveSurface;
  /** The Scene a Product was opened from; the server records it only if that Scene tags it now. */
  sceneRef?: string | null;
  returnTo: ReturnTo;
}) {
  const { session } = useSession();
  if (session.status !== 'signedIn') return <GuestSave target={target} surface={surface} sceneRef={sceneRef} returnTo={returnTo} />;
  return <SignedInSave target={target} surface={surface} sceneRef={sceneRef} />;
}

function SignedInSave({ target, surface, sceneRef }: { target: SaveTarget; surface: SaveSurface; sceneRef: string | null }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const save = useSaveToggle(target, surface, sceneRef);
  const { refetch } = save.state;
  // Back from the picker or another screen: ask again (another device may have changed it too).
  const opened = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (opened.current) void refetch();
      opened.current = true;
    }, [refetch]),
  );
  const failure = save.error ?? (save.state.status === 'error' ? save.state.error : null);
  return (
    <View style={{ gap: theme.space.sm }} testID="save-controls">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <View style={{ flexGrow: 1 }}>
          <Button
            label={t(save.saved ? 'buyer.save.saved' : 'buyer.save.save')}
            variant={save.saved ? 'secondary' : 'primary'}
            disabled={save.busy || save.state.data === undefined}
            onPress={save.toggle}
          />
        </View>
        <View style={{ flexGrow: 1 }}>
          <Button
            label={t('buyer.save.add')}
            variant="secondary"
            disabled={save.state.data === undefined}
            onPress={() =>
              router.push({
                pathname: '/save-to',
                params: { type: target.type, ref: target.ref, surface, ...(sceneRef ? { scene: sceneRef } : {}) },
              })
            }
          />
        </View>
      </View>
      {failure ? (
        <View style={{ gap: theme.space.xs }}>
          <AlertText>{`${t('buyer.save.failed')} ${failureMessage(t, failure)}`}</AlertText>
          {save.state.status === 'error' ? <Button label={t('common.retry')} variant="secondary" onPress={() => void refetch()} /> : null}
        </View>
      ) : null}
    </View>
  );
}

function GuestSave({ target, surface, sceneRef, returnTo }: { target: SaveTarget; surface: SaveSurface; sceneRef: string | null; returnTo: ReturnTo }) {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  if (!asked) return <Button label={t('buyer.save.save')} onPress={() => setAsked(true)} />;
  return (
    <View style={{ gap: theme.space.sm }} testID="save-sign-in">
      <AppText accessibilityLiveRegion="polite">{t('buyer.save.sign_in')}</AppText>
      <Button label={t('auth.sign_in')} onPress={() => startGuestSave(router, { target, surface, sceneRef }, returnTo)} />
    </View>
  );
}

/**
 * A guest chose Sign in to save (WO-009 S16, and the cards' prompt in WO-009A): the Save is
 * armed in memory for this one sign-in, and its nonce travels with that sign-in and nowhere
 * else. `returnTo` is one of the allowlisted destinations (src/auth/sign-in-flow.ts).
 */
export function startGuestSave(
  router: ReturnType<typeof useRouter>,
  pending: { target: SaveTarget; surface: SaveSurface; sceneRef: string | null },
  returnTo: ReturnTo,
) {
  const nonce = uuid.v4();
  useUiStore.getState().setPendingSave({ nonce, ...pending });
  router.push({ pathname: '/auth/sign-in', params: { returnTo, save: nonce } });
}
