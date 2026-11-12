import { useRouter } from 'expo-router';

import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useUiStore } from '../state/ui-store';
import { useAvailableModes } from './ModeLayout';
import { MODE_HOME, MODE_LABEL, type Mode } from './modes';

/**
 * Foundation diagnostic shell for the Seller Companion and Courier modes (development
 * builds only). Not a product screen; their feature work orders replace it.
 */
export function ModeShell({ mode }: { mode: Mode }) {
  const router = useRouter();
  const available = useAvailableModes();
  const activeMode = useUiStore((state) => state.activeMode);
  const { session } = useSession();

  return (
    <Screen>
      <AppText variant="heading" accessibilityRole="header">
        {MODE_LABEL[mode]} foundation ready
      </AppText>
      <AppText>Diagnostic shell. No {MODE_LABEL[mode]} features are built yet.</AppText>
      <AppText>Active mode: {activeMode ? MODE_LABEL[activeMode] : 'none'}</AppText>
      <AppText>Session: {session.status === 'signedIn' ? 'signed in' : 'signed out'}</AppText>
      {available
        .filter((other) => other !== mode)
        .map((other) => (
          <Button
            key={other}
            label={`Switch to ${MODE_LABEL[other]}`}
            onPress={() => router.replace(MODE_HOME[other])}
          />
        ))}
      <Button label="Back to diagnostics" onPress={() => router.dismissTo('/dev')} />
    </Screen>
  );
}
