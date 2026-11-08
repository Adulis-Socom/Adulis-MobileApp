import { Pressable, View } from 'react-native';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

/**
 * A single-choice radio group. The selection reads without colour: a check mark, a
 * heavier border and weight, and `checked` state for screen readers.
 */
export function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: theme.space.sm }}>
      <AppText style={{ color: theme.color.textSecondary }}>{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(option.value)}
              style={{
                minHeight: theme.touchTarget,
                minWidth: theme.touchTarget,
                justifyContent: 'center',
                paddingHorizontal: theme.space.md,
                borderRadius: theme.radius.md,
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? theme.color.accent : theme.color.borderStrong,
                backgroundColor: selected ? theme.color.accentSubtle : theme.color.bg,
              }}
            >
              <AppText style={selected ? { fontWeight: theme.fontWeight.semibold } : undefined}>
                {selected ? `✓ ${option.label}` : option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
