import { View } from 'react-native';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

/**
 * The one placeholder for a destination whose domain is not built yet, or that needs a
 * signed-in Account. Text only: it never offers an action that does not work, and its
 * wording never claims the Buyer has nothing (no "You have no orders").
 */
export function Placeholder({ message, note }: { message: string; note?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.space.sm, alignItems: 'center' }}>
      <AppText style={{ textAlign: 'center' }}>{message}</AppText>
      {note ? (
        <AppText style={{ textAlign: 'center', color: theme.color.textSecondary }}>{note}</AppText>
      ) : null}
    </View>
  );
}
