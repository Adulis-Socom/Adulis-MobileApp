import { onlineManager } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';

import { apiOrigin } from '../api/config';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { Screen } from '../components/Screen';
import { MODE_LABEL, useAvailableModes } from '../modes/modes';
import { useUiStore } from '../state/ui-store';
import { sqliteVersion } from '../storage/sqlite';

/*
 * WO-001 foundation diagnostics. Developer-facing, not product UI: its English strings
 * are diagnostics, not catalogue copy. Feature work orders replace this screen.
 * No @adulis/locale import yet: its catalogue carries console billing and tier copy that
 * must never enter the mobile bundle (WO-001 report, conflict C-1).
 */

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const subscribeOnline = (onChange: () => void) => onlineManager.subscribe(onChange);
const isOnline = () => onlineManager.isOnline();

function describe(probe: () => string): string {
  try {
    return probe();
  } catch (error) {
    return `unavailable (${error instanceof Error ? error.message : String(error)})`;
  }
}

export default function FoundationScreen() {
  const router = useRouter();
  const available = useAvailableModes();
  const { session } = useSession();
  const themePreference = useUiStore((state) => state.themePreference);
  const setThemePreference = useUiStore((state) => state.setThemePreference);
  const online = useSyncExternalStore(subscribeOnline, isOnline);
  const [sqlite] = useState(() => describe(sqliteVersion));

  return (
    <Screen>
      <AppText variant="heading" accessibilityRole="header">
        Adulis mobile foundation
      </AppText>
      <AppText>Diagnostic screen (WO-001). Not product UI.</AppText>

      {available.map((mode) => (
        <Button
          key={mode}
          label={`Open ${MODE_LABEL[mode]}`}
          onPress={() => router.push(`/${mode}`)}
        />
      ))}
      {__DEV__ ? (
        <AppText>
          Development build: Seller Companion and Courier are unlocked for foundation diagnostics
          only. Real eligibility comes from the backend.
        </AppText>
      ) : null}

      <ChoiceGroup
        label="Theme"
        options={THEME_OPTIONS}
        value={themePreference}
        onChange={setThemePreference}
      />

      <AppText>Session: {session.status === 'signedIn' ? 'signed in' : 'signed out'}</AppText>
      <AppText>Network: {online ? 'online' : 'offline'}</AppText>
      <AppText>API origin: {describe(apiOrigin)}</AppText>
      <AppText>SQLite: {sqlite}</AppText>
    </Screen>
  );
}
