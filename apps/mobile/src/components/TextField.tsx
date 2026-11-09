import { useEffect } from 'react';
import { AccessibilityInfo, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme/theme';
import { AppText } from './AppText';

/**
 * A labelled text input with an optional hint and an inline error. The label is visible
 * (not a placeholder that disappears) and is also the field's accessibility label; the
 * error is announced when it appears and marked by text and a thicker border, not colour alone.
 */
export function TextField({
  label,
  hint,
  error,
  ...input
}: Omit<TextInputProps, 'style'> & { label: string; hint?: string; error?: string | null }) {
  const theme = useTheme();
  // The alert role alone is not spoken on Android or iOS: announce each new error.
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  return (
    <View style={{ gap: theme.space.xs }}>
      <AppText style={{ fontWeight: theme.fontWeight.semibold }}>{label}</AppText>
      {hint ? <AppText style={{ color: theme.color.textSecondary }}>{hint}</AppText> : null}
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={theme.color.textMuted}
        style={{
          minHeight: theme.touchTarget,
          paddingHorizontal: theme.space.md,
          paddingVertical: theme.space.sm,
          borderRadius: theme.radius.md,
          borderWidth: error ? 2 : 1,
          borderColor: error ? theme.color.danger : theme.color.borderStrong,
          backgroundColor: theme.color.bg,
          color: theme.color.text,
          fontSize: theme.fontSize.lg,
        }}
      />
      {error ? (
        <AppText accessibilityRole="alert" style={{ color: theme.color.danger }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
