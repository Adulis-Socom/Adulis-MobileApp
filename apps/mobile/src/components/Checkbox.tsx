import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

/**
 * A checkbox with its label as the touch target; checked is a tick, not only a colour.
 * `disabled` while a change elsewhere is in flight, `busy` while this one's is (WO-018, A-006):
 * both are announced, not only drawn, and a disabled box ignores taps.
 */
export function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  busy = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const theme = useTheme();
  const box = theme.space.lg;
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: off, busy }}
      disabled={off}
      onPress={() => onChange(!checked)}
      style={{ minHeight: theme.touchTarget, flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, opacity: off ? 0.6 : 1 }}
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
