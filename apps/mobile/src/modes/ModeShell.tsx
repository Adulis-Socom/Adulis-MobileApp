import { useRouter } from 'expo-router';

import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { useUiStore } from '../state/ui-store';
import { MODE_LABEL, useAvailableModes, type Mode } from './modes';

/** Foundation diagnostic shell for one mode. Not a product screen; feature WOs replace it. */
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
            onPress={() => router.replace(`/${other}`)}
          />
        ))}
      <Button label="Back to foundation" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}
