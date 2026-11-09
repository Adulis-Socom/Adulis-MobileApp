import { useT } from '../i18n/i18n';
import { AppText } from './AppText';
import { Button } from './Button';
import { Screen } from './Screen';

/**
 * Bootstrap said UPGRADE_REQUIRED (ADU-MOB-02 v4.3 S85): the whole app is replaced by this
 * screen, so no tab, deep link or cached screen can bypass it. No store link: none is
 * configured, so the wording names the action without inventing a URL. "Check again"
 * re-asks the server, for the case where the floor was lowered or the app was updated.
 */
export function UpgradeRequired({ onCheckAgain, checking }: { onCheckAgain: () => void; checking: boolean }) {
  const t = useT();
  return (
    <Screen centered>
      <AppText variant="heading" accessibilityRole="header" style={{ textAlign: 'center' }}>
        {t('app.upgrade.required.title')}
      </AppText>
      <AppText style={{ textAlign: 'center' }}>{t('app.upgrade.required.body')}</AppText>
      <Button label={t('app.upgrade.check_again')} onPress={onCheckAgain} disabled={checking} variant="secondary" />
    </Screen>
  );
}
