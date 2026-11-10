import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { failureMessage } from '../api/messages';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useT } from '../i18n/i18n';
import type { MobileMessageKey } from '@adulis/locale/mobile';
import { useTheme } from '../theme/theme';
import type { usePublicRead } from './public-read';

/** The neutral "no longer available" screen with a way out (founder ruling OVN-081). */
export function GoneState({ message }: { message: MobileMessageKey }) {
  const t = useT();
  const router = useRouter();
  return (
    <Screen centered edges={['bottom', 'left', 'right']}>
      <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
        {t(message)}
      </AppText>
      <Button
        label={t('buyer.scene.go_back')}
        // A cold launch into the screen may have nothing under it: go Home instead.
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </Screen>
  );
}

/**
 * The states of a public read before its content can be shown (WO-005), or null when the
 * content can be. Gone comes first: after a 404 nothing earlier is shown, and the message
 * is neutral -- no reason (private, removed, never existed) is told, and a way out is.
 */
export function ReadStates({
  read,
  valid,
  gone,
  loading,
}: {
  read: ReturnType<typeof usePublicRead>;
  /** The route parameters are well-formed (otherwise nothing was requested: gone). */
  valid: boolean;
  gone: MobileMessageKey;
  loading: MobileMessageKey;
}) {
  const t = useT();
  const theme = useTheme();

  if (!valid || read.gone) return <GoneState message={gone} />;
  // Waiting for a connection: say so rather than spin. TanStack resumes it on reconnect.
  if (read.paused) {
    return (
      <Screen centered edges={['bottom', 'left', 'right']}>
        <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {t('common.offline')}
        </AppText>
      </Screen>
    );
  }
  if (read.status === 'pending') {
    return (
      <Screen centered edges={['bottom', 'left', 'right']}>
        <ActivityIndicator color={theme.color.accent} />
        <AppText
          accessibilityLiveRegion="polite"
          style={{ color: theme.color.textSecondary, textAlign: 'center' }}
        >
          {t(loading)}
        </AppText>
      </Screen>
    );
  }
  if (read.value === undefined) {
    return (
      <Screen centered edges={['bottom', 'left', 'right']}>
        <AppText accessibilityRole="alert" style={{ textAlign: 'center' }}>
          {failureMessage(t, read.error)}
        </AppText>
        <Button label={t('common.retry')} onPress={read.revalidate} disabled={read.revalidating} />
      </Screen>
    );
  }
  return null;
}
