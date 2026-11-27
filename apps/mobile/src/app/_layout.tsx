// ROOT_GATE: providers, then the AppGate. Before the first settle a neutral loading state; INIT_FAILED and UPGRADE_REQUIRED
// replace the navigator, so no deep link, push or cached screen can bypass them. After the first settle the navigator is never
// unmounted by a background refresh. The fixture banner (null in every release) sits above everything.
import { Stack } from 'expo-router';
import { useRef, type ReactNode } from 'react';
import { View } from 'react-native';

import { t } from '../i18n/messages';
import { AppProvider, useApp } from '../providers/AppProvider';
import { Body, Button, FixtureBanner, Heading, StateView } from '../ui/components';
import { theme } from '../ui/theme';

function Gate() {
  const { gate, fixtureUi, checkAgain } = useApp();
  const started = useRef(false);
  if (gate.kind === 'READY' || gate.kind === 'READY_OFFLINE') started.current = true;

  let body: ReactNode;
  if (gate.kind === 'INIT_FAILED') {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.space.lg, gap: theme.space.md }}>
        <Heading>{t('mobile.gate.init_failed.title')}</Heading>
        <Body>{t('mobile.gate.init_failed.body')}</Body>
      </View>
    );
  } else if (gate.kind === 'UPGRADE_REQUIRED' || (gate.kind === 'BOOTSTRAPPING' && gate.fromUpgrade)) {
    const checking = gate.kind === 'BOOTSTRAPPING';
    body = (
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.space.lg, gap: theme.space.md }}>
        <Heading>{t('mobile.gate.upgrade.title')}</Heading>
        <Body>{t('mobile.gate.upgrade.body')}</Body>
        <Button label={t(checking ? 'mobile.gate.upgrade.checking' : 'mobile.gate.upgrade.check_again')} disabled={checking} busy={checking} onPress={checkAgain} />
      </View>
    );
  } else if (!started.current) {
    body = <StateView kind="loading" message={t('mobile.gate.loading')} />;
  } else {
    body = <Stack screenOptions={{ headerShown: false }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bg }}>
      {fixtureUi ? <FixtureBanner text={fixtureUi.bannerText} /> : null}
      {body}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}
