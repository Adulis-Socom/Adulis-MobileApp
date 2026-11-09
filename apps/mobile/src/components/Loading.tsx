import { ActivityIndicator, View } from 'react-native';

import { useT } from '../i18n/i18n';
import { useTheme } from '../theme/theme';

export function Loading() {
  const theme = useTheme();
  const t = useT();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.bg,
      }}
    >
      <ActivityIndicator color={theme.color.accent} accessibilityLabel={t('common.loading')} />
    </View>
  );
}
