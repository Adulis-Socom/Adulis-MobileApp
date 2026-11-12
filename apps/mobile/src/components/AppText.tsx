import type { ComponentProps } from 'react';
import { Text } from 'react-native';

import { useTheme } from '../theme/theme';

/**
 * Themed text. Line height comes from the token multipliers (generous for tall Ge'ez
 * glyphs) and no height is ever fixed, so longer Amharic strings wrap instead of clipping.
 */
export function AppText({
  variant = 'body',
  style,
  ...props
}: ComponentProps<typeof Text> & { variant?: 'body' | 'heading' }) {
  const theme = useTheme();
  const heading = variant === 'heading';
  const fontSize = heading ? theme.fontSize.xl : theme.fontSize.base;
  return (
    <Text
      {...props}
      style={[
        {
          color: theme.color.text,
          fontSize,
          lineHeight: Math.round(
            fontSize * (heading ? theme.lineHeight.heading : theme.lineHeight.base),
          ),
          fontWeight: heading ? theme.fontWeight.semibold : theme.fontWeight.regular,
        },
        style,
      ]}
    />
  );
}
