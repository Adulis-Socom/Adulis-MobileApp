import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '../theme/theme';

export function Loading() {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.color.bg,
      }}
    >
      <ActivityIndicator color={theme.color.accent} accessibilityLabel="Loading" />
    </View>
  );
}
