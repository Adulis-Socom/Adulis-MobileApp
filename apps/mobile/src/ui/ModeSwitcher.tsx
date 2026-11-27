// The mode switcher: Buyer, Seller Companion and Courier as capability-gated entries of ONE app and ONE Account. Which entries
// show, and which work, is the server's answer (eligibility) and nothing the client computes. A switch never re-authenticates
// and never creates an Account.
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { GATED_MODES, type GatedMode, type Mode } from '../contracts/gap-mob-session';
import { serverText, t, type UiMessageKey } from '../i18n/messages';
import { useApp } from '../providers/AppProvider';
import { Body, Button, Heading } from './components';

const NAME: Record<Mode, UiMessageKey> = { BUYER: 'mobile.mode.buyer', SELLER_COMPANION: 'mobile.mode.seller_companion', COURIER: 'mobile.mode.courier' };
const HOME: Record<GatedMode, string> = { SELLER_COMPANION: '/companion', COURIER: '/courier' };

export function ModeSwitcher() {
  const { eligibility, activeMode, enterMode, session } = useApp();
  const router = useRouter();

  const go = (mode: Mode) => {
    const outcome = enterMode(mode);
    if (outcome.kind !== 'ENTERED') return;
    router.replace(mode === 'BUYER' ? '/home' : HOME[mode]);
  };

  return (
    <View style={{ gap: 8 }}>
      <Heading>{t('mobile.account.modes')}</Heading>
      <Button label={t('mobile.mode.buyer')} kind={activeMode === 'BUYER' ? 'primary' : 'secondary'} selected={activeMode === 'BUYER'} onPress={() => go('BUYER')} />
      {eligibility === null || eligibility.epoch !== session.epoch ? <Body muted>{t('mobile.mode.checking')}</Body> : null}
      {eligibility !== null && eligibility.epoch === session.epoch
        ? GATED_MODES.map((mode) => {
            const answer = eligibility.modes[mode];
            // NOT_ELIGIBLE and REVOKED have no entry at all: the screen does not reveal why.
            if (answer.status === 'NOT_ELIGIBLE' || answer.status === 'REVOKED') return null;
            const usable = answer.status === 'AVAILABLE';
            return (
              <View key={mode} style={{ gap: 4 }}>
                <Button
                  label={usable && activeMode !== mode ? t('mobile.mode.switch_to', { mode: t(NAME[mode]) }) : t(NAME[mode])}
                  kind={activeMode === mode ? 'primary' : 'secondary'}
                  selected={activeMode === mode}
                  disabled={!usable}
                  onPress={() => go(mode)}
                />
                {answer.status === 'PENDING' ? <Body muted>{serverText(answer.message, 'mobile.mode.pending')}</Body> : null}
                {answer.status === 'RESTRICTED' ? <Body muted>{serverText(answer.message, 'mobile.mode.restricted')}</Body> : null}
              </View>
            );
          })
        : null}
    </View>
  );
}
