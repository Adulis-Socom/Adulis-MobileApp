import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { useSession } from '../../../auth/session';
import { AccountSessions } from '../../../buyer/AccountSessions';
import { SignInRequired } from '../../../buyer/SignInRequired';
import { AppText } from '../../../components/AppText';
import { Button } from '../../../components/Button';
import { ChoiceGroup } from '../../../components/ChoiceGroup';
import { Screen } from '../../../components/Screen';
import { amharicAvailable, useT } from '../../../i18n/i18n';
import { useUiStore } from '../../../state/ui-store';
import { useTheme } from '../../../theme/theme';

/**
 * You (ADU-MOB-02 v4.3 S11, S137; R-11 lists the Account controls), WO-011. Only what works is a
 * control:
 *
 * - Account: that this device is signed in. No profile field is shown or edited: the contract has
 *   no Buyer profile (ON-20261111-132), so nothing is fabricated.
 * - Preferences: Appearance and Language are device settings (a guest has them too), held for this
 *   app run (no approved device storage yet, ON-20261111-133). Amharic is offered in development
 *   builds only (R-19: no unreviewed translation reaches a user).
 * - Security: the Account's live sessions and Sign out (the one revoke a MOBILE session may make).
 * - Privacy: Delete Account, on the existing deletion-ticket flow.
 *
 * Mode switching stays out until a later work order wires account_context, and the developer
 * diagnostics entry exists in development builds only.
 */
export default function You() {
  const t = useT();
  const theme = useTheme();
  const router = useRouter();
  const { session, signOut } = useSession();
  const themePreference = useUiStore((state) => state.themePreference);
  const setThemePreference = useUiStore((state) => state.setThemePreference);
  const locale = useUiStore((state) => state.locale);
  const setLocale = useUiStore((state) => state.setLocale);
  const signedIn = session.status === 'signedIn';
  const [signOutFailed, setSignOutFailed] = useState(false);

  const section = (title: string, children: ReactNode) => (
    <View style={{ gap: theme.space.sm }}>
      <AppText accessibilityRole="header" style={{ fontWeight: theme.fontWeight.semibold }}>
        {title}
      </AppText>
      {children}
    </View>
  );

  return (
    <Screen title={t('buyer.tab.you')} edges={['top', 'left', 'right']}>
      {signedIn
        ? section(
            t('buyer.you.account'),
            <>
              <AppText>{t('buyer.you.signed_in')}</AppText>
              <AppText style={{ color: theme.color.textSecondary }}>{t('buyer.you.more_coming')}</AppText>
            </>,
          )
        : <SignInRequired message={t('buyer.you.signed_out')} returnTo="/account" />}

      {section(
        t('buyer.you.preferences'),
        <>
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
          {amharicAvailable() ? (
            <ChoiceGroup
              label={t('buyer.you.language')}
              value={locale}
              onChange={setLocale}
              options={[
                { value: 'en', label: t('buyer.you.language.en') },
                { value: 'am', label: t('buyer.you.language.am') },
              ]}
            />
          ) : (
            <View style={{ gap: theme.space.xs }}>
              <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{t('buyer.you.language')}</AppText>
              <AppText>{t('buyer.you.language.english_only')}</AppText>
            </View>
          )}
        </>,
      )}

      {signedIn
        ? section(
            t('buyer.you.security'),
            <>
              <AccountSessions />
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
              {signOutFailed ? <AppText accessibilityRole="alert">{t('error.request.internal')}</AppText> : null}
            </>,
          )
        : null}

      {signedIn
        ? section(
            t('buyer.you.privacy'),
            <Button label={t('buyer.you.delete')} variant="secondary" onPress={() => router.push('/account/delete')} />,
          )
        : null}

      {__DEV__ ? <Button label="Developer diagnostics" onPress={() => router.push('/dev')} /> : null}
    </Screen>
  );
}
