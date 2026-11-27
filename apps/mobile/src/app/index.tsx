// The walking skeleton's only route: it selects the transport once at start and shows an honest state. It has no
// product behaviour. While no business operation exists the live transport is UNAVAILABLE, and that is what is shown.
import { color } from '@adulis/tokens';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { t, type MobileMessageKey } from '../i18n/messages';
import { TransportError, type FixtureUi } from '../transport/port';
import { selectTransport } from '../transport/select';

export default function Index() {
  const [fixtureUi, setFixtureUi] = useState<FixtureUi | null>(null);
  const [problem, setProblem] = useState<MobileMessageKey | null>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      const selection = await selectTransport();
      if (!current) return;
      setFixtureUi(selection.fixtureUi);
      try {
        await selection.transport.request('bootstrap');
      } catch (error) {
        if (current && error instanceof TransportError) setProblem(error.messageKey);
      }
    })();
    return () => {
      current = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: 'center', padding: 16 }}>
      {fixtureUi ? <Text accessibilityRole="alert">{fixtureUi.bannerText}</Text> : null}
      {problem ? <Text accessibilityRole="alert">{t(problem)}</Text> : null}
    </View>
  );
}
