import { Pressable } from 'react-native';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

export function Button({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.touchTarget,
        justifyContent: 'center',
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        borderRadius: theme.radius.md,
        backgroundColor: pressed ? theme.color.accentActive : theme.color.accent,
      })}
    >
      <AppText style={{ color: theme.color.accentText, fontWeight: theme.fontWeight.semibold }}>
        {label}
      </AppText>
    </Pressable>
  );
}
