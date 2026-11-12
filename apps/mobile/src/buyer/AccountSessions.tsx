import { View } from 'react-native';

import { failureMessage, fillSlots } from '../api/messages';
import type { AccountSession } from '../api/client';
import { AlertText } from '../components/AlertText';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { useLocale, useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';
import { sessionDeviceKey, useAccountSessions } from './account';

/**
 * Signed-in sessions (WO-011; ADU-AUTH-02 v3.3 S38, S118): what GET /v1/auth/sessions says, and
 * nothing it does not. The current session is the server's `current` flag; a location appears
 * only when the server recorded one. No revoke control: a MOBILE session may revoke only itself
 * (Sign out, below this list); another session needs the console and a step-up, which Mobile
 * never reaches.
 */
export function AccountSessions() {
  const t = useT();
  const locale = useLocale();
  const theme = useTheme();
  const sessions = useAccountSessions();
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const secondary = { color: theme.color.textSecondary };

  const row = (s: AccountSession) => (
    <View
      key={s.id}
      accessible
      style={{ gap: theme.space.xs, padding: theme.space.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border }}
    >
      <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{t(sessionDeviceKey(s))}</AppText>
      {s.current ? <AppText style={{ color: theme.color.accent }}>{t('buyer.you.session.current')}</AppText> : null}
      <AppText style={secondary}>
        {t(s.audience === 'CONSOLE' ? 'buyer.you.session.surface.console' : 'buyer.you.session.surface.mobile')}
      </AppText>
      <AppText style={secondary}>{fillSlots(t('buyer.you.session.last_active'), { time: when(s.last_activity_at) })}</AppText>
      <AppText style={secondary}>{fillSlots(t('buyer.you.session.first_seen'), { time: when(s.first_seen_at) })}</AppText>
      {s.approx_location?.trim() ? (
        <AppText style={secondary}>{fillSlots(t('buyer.you.session.location'), { location: s.approx_location.trim() })}</AppText>
      ) : null}
    </View>
  );

  return (
    <View style={{ gap: theme.space.sm }}>
      <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{t('buyer.you.sessions')}</AppText>
      {sessions.data ? (
        sessions.data.length > 0 ? sessions.data.map(row) : <AppText style={secondary}>{t('buyer.you.sessions.empty')}</AppText>
      ) : sessions.isError ? (
        <View>
          <AlertText>{t('buyer.you.sessions.failed')}</AlertText>
          <AppText style={secondary}>{failureMessage(t, sessions.error)}</AppText>
        </View>
      ) : (
        <AppText style={secondary}>{t(sessions.fetchStatus === 'paused' ? 'common.offline' : 'common.loading')}</AppText>
      )}
      <Button
        label={sessions.isError && !sessions.data ? t('common.retry') : t('buyer.you.sessions.refresh')}
        variant="secondary"
        onPress={() => void sessions.refetch()}
        disabled={sessions.isFetching}
      />
      <AppText style={secondary}>{t('buyer.you.sessions.others')}</AppText>
    </View>
  );
}
