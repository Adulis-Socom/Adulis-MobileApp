import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

/** A checkbox with its label as the touch target; checked is a tick, not only a colour. */
export function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const theme = useTheme();
  const box = theme.space.lg;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={{ minHeight: theme.touchTarget, flexDirection: 'row', alignItems: 'center', gap: theme.space.sm }}
    >
      <View
        style={{
          width: box,
          height: box,
          borderRadius: theme.radius.sm,
          borderWidth: 2,
          borderColor: checked ? theme.color.accent : theme.color.borderStrong,
          backgroundColor: checked ? theme.color.accent : theme.color.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <AppText style={{ color: theme.color.accentText, fontWeight: theme.fontWeight.bold, lineHeight: box }}>
            ✓
          </AppText>
        ) : null}
      </View>
      <AppText style={{ flex: 1 }}>{label}</AppText>
    </Pressable>
  );
}
