import { Pressable } from 'react-native';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

/**
 * The one button. `secondary` is the quieter action beside a primary one (resend, change
 * number). `disabled` is for an action in flight, so a double tap cannot send it twice;
 * the state is announced, not only drawn. `busy` adds that its own action is the one in flight
 * (WO-018: a Load more that stays where the Buyer's focus is while the next page loads).
 */
export function Button({
  label,
  onPress,
  disabled = false,
  busy = false,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  const theme = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={busy ? { disabled, busy } : { disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.touchTarget,
        justifyContent: 'center',
        paddingHorizontal: theme.space.md,
        paddingVertical: theme.space.sm,
        borderRadius: theme.radius.md,
        opacity: disabled ? 0.6 : 1,
        ...(primary
          ? { backgroundColor: pressed ? theme.color.accentActive : theme.color.accent }
          : {
              borderWidth: 1,
              borderColor: theme.color.borderStrong,
              backgroundColor: pressed ? theme.color.surfaceMuted : theme.color.bg,
            }),
      })}
    >
      <AppText
        style={{
          color: primary ? theme.color.accentText : theme.color.text,
          fontWeight: theme.fontWeight.semibold,
          textAlign: 'center',
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
