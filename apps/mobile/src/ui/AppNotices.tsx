// Honest, one-line notices above tab content: offline or unreachable, an update is available, the session ended, a mode ended,
// sign-out did not clear the saved sign-in. Each is derived from state; none is invented.
import { View } from 'react-native';

import { serverText, t } from '../i18n/messages';
import { useApp } from '../providers/AppProvider';
import { Notice } from './components';

const MODE_NAME = { SELLER_COMPANION: 'mobile.mode.seller_companion', COURIER: 'mobile.mode.courier' } as const;

export function AppNotices() {
  const { gate, session, modeEnded, signOutIncomplete } = useApp();
  const end = session.kind === 'GUEST' ? session.lastEnd : null;
  return (
    <View style={{ gap: 8 }}>
      {gate.kind === 'READY_OFFLINE' ? <Notice tone="warn" text={t(gate.cause === 'OFFLINE' ? 'mobile.gate.offline_notice' : 'mobile.gate.unavailable_notice')} /> : null}
      {gate.kind === 'READY' && gate.upgradeRecommended ? <Notice text={t('mobile.gate.upgrade.recommended')} /> : null}
      {end?.reason === 'EXPIRED' || end?.reason === 'REVOKED' ? <Notice text={serverText(end.message, end.reason === 'EXPIRED' ? 'mobile.session.ended.expired' : 'mobile.session.ended.revoked')} /> : null}
      {end?.reason === 'CREDENTIAL_REJECTED' ? <Notice text={t('error.auth.authentication_required')} /> : null}
      {end?.reason === 'ACCOUNT_DELETED' ? <Notice text={t('mobile.session.ended.deleted')} /> : null}
      {modeEnded ? <Notice text={t('mobile.mode.ended_notice', { mode: t(MODE_NAME[modeEnded]) })} /> : null}
      {signOutIncomplete ? <Notice tone="warn" text={t('mobile.session.signout_incomplete')} /> : null}
    </View>
  );
}
