import { onlineManager } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';

import { apiOrigin } from '../api/config';
import { useSession } from '../auth/session';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { ChoiceGroup } from '../components/ChoiceGroup';
import { Screen } from '../components/Screen';
import { useT } from '../i18n/i18n';
import { MODE_LABEL, useAvailableModes } from '../modes/modes';
import { useUiStore } from '../state/ui-store';
import { sqliteVersion } from '../storage/sqlite';

/*
 * Foundation diagnostics (WO-001, WO-001A). Developer-facing, not product UI: its English
 * strings are diagnostics, not catalogue copy, and the language choice is a rendering check,
 * not the Settings UX. Catalogue samples come from @adulis/locale/mobile, never invented.
 */

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'Amharic' },
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

const runProbes = () => ({ api: describe(apiOrigin), sqlite: describe(sqliteVersion) });

export default function FoundationScreen() {
  const router = useRouter();
  const available = useAvailableModes();
  const { session } = useSession();
  const t = useT();
  const themePreference = useUiStore((state) => state.themePreference);
  const setThemePreference = useUiStore((state) => state.setThemePreference);
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  const online = useSyncExternalStore(subscribeOnline, isOnline);
  const [probes, setProbes] = useState(runProbes);

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
      <ChoiceGroup
        label="Language (foundation diagnostic, not Settings)"
        options={LOCALE_OPTIONS}
        value={locale}
        onChange={setLocale}
      />
      <AppText>{t('health.degraded')}</AppText>
      <AppText>{t('obligation.payment_awaiting_confirmation.consequence')}</AppText>

      <AppText>Session: {session.status === 'signedIn' ? 'signed in' : 'signed out'}</AppText>
      <AppText>Network: {online ? 'online' : 'offline'}</AppText>
      <AppText>API origin: {probes.api}</AppText>
      <AppText>SQLite: {probes.sqlite}</AppText>
      <Button label={t('common.retry')} onPress={() => setProbes(runProbes())} />
    </Screen>
  );
}
