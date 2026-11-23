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
  // Nothing to say, nothing drawn: a sentence whose slot was null (fillSlots) must not leave an empty line in a gap.
  if (props.children === null || props.children === undefined || props.children === false) return null;
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
