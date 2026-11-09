import { useRouter } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { useSession } from '../../../auth/session';
import { SignInRequired } from '../../../buyer/SignInRequired';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { ChoiceGroup } from '../../../components/ChoiceGroup';
import { Screen } from '../../../components/Screen';
import { useT } from '../../../i18n/i18n';
import { useUiStore } from '../../../state/ui-store';
import { useTheme } from '../../../theme/theme';

/**
 * You (ADU-MOB-02 v4.3 S11; R-11 lists the Account controls). Only what works is shown as
 * a control: Appearance (a device setting, so a guest has it too) and Sign out. The other
 * Account sections are named in one line until their work orders build them; nothing here
 * looks tappable and does nothing. Mode switching stays out until a later work order wires
 * account_context, and the developer diagnostics entry exists in development builds only.
 */
export default function You() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { session, signOut } = useSession();
  const themePreference = useUiStore((state) => state.themePreference);
  const setThemePreference = useUiStore((state) => state.setThemePreference);
  const signedIn = session.status === 'signedIn';
  const [signOutFailed, setSignOutFailed] = useState(false);

  return (
    <Screen title={t('buyer.tab.you')} edges={['top', 'left', 'right']}>
      {signedIn ? null : <SignInRequired message={t('buyer.you.signed_out')} />}

      <ChoiceGroup
        label={t('buyer.you.appearance')}
        value={themePreference}
        onChange={setThemePreference}
        options={[
          { value: 'system', label: t('buyer.you.appearance.system') },
          { value: 'light', label: t('buyer.you.appearance.light') },
          { value: 'dark', label: t('buyer.you.appearance.dark') },
        ]}
      />

      {signedIn ? (
        <View style={{ gap: theme.space.sm }}>
          <AppText accessibilityRole="header" style={{ color: theme.color.textSecondary }}>
            {t('buyer.you.account')}
          </AppText>
          <AppText style={{ color: theme.color.textSecondary }}>{t('buyer.you.more_coming')}</AppText>
          <Button
            label={t('common.signOut')}
            onPress={() => {
              setSignOutFailed(false);
              signOut().then(
                // The button disappears with the session; say what happened instead of
                // leaving a screen reader's focus on nothing.
                () => AccessibilityInfo.announceForAccessibility(t('buyer.you.signed_out')),
                // The device could not forget the credential: still signed in, and says so.
                () => setSignOutFailed(true),
              );
            }}
          />
          {signOutFailed ? (
            <AppText accessibilityRole="alert">{t('error.request.internal')}</AppText>
          ) : null}
        </View>
      ) : null}

      {__DEV__ ? (
        <Button label="Developer diagnostics" onPress={() => router.push('/dev')} />
      ) : null}
    </Screen>
  );
}
