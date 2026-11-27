// The Share and Report entries (MOB-FE-03). Both are HONEST UNAVAILABLE states: the owner of the public link and domain is
// unresolved (GAP-L2-05, FD-M08), and no authoritative reporting contract or moderation scope exists. Pressing either says so in
// one sentence. Nothing is sent, no link is built, no domain is named and no moderation action exists behind these buttons.
import { useState } from 'react';
import { View } from 'react-native';

import { t } from '../i18n/messages';
import { Button, Notice } from '../ui/components';
import { theme } from '../ui/theme';

type Entry = 'share' | 'report';

export function ShareAndReport() {
  const [shown, setShown] = useState<Entry | null>(null);
  return (
    <View style={{ gap: theme.space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        <Button kind="secondary" label={t('mobile.share.entry')} onPress={() => setShown('share')} />
        <Button kind="secondary" label={t('mobile.report.entry')} onPress={() => setShown('report')} />
      </View>
      {shown === null ? null : <Notice text={t(shown === 'share' ? 'mobile.share.unavailable' : 'mobile.report.unavailable')} />}
    </View>
  );
}
