import { face, family, scale, text } from '@adulis/tokens/native';
import { Platform, Text as RNText, type TextProps as RNTextProps } from 'react-native';

/**
 * P1 `Text` -- the only text component (ADU-MOB-03 S3.1). Applies the seven
 * size tokens and carries the two Ge'ez rules in its own body:
 *
 *  D1  `includeFontPadding` appears nowhere. On Android it clips the marks off
 *      Ge'ez in a build that looks perfect in English (grep gate 14).
 *  D2  the default family is the LATIN one. No variant sets an Ethiopic-only
 *      family; the platform's per-glyph fallback supplies Ge'ez.
 *
 * Weight is a FACE NAME, never `fontWeight`: Android selects a custom weight
 * by the name the file was loaded under (typography.ts). Every size token
 * carries its own line height and nothing here overrides it. Font scaling is
 * honoured -- there is no `maxFontSizeMultiplier` -- because a buyer with large
 * text is a real and common user (ADU-MOB-01 S12).
 */
export type TextVariant = keyof typeof scale;
export type TextTone = keyof typeof text;

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
};

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: TextProps) {
  const size = scale[variant];
  const fontFamily =
    variant === 'mono'
      ? Platform.select({ ios: family.mono.ios, default: family.mono.android })
      : face[size.weight];

  return (
    <RNText
      allowFontScaling
      style={[
        {
          fontFamily,
          fontSize: size.size,
          lineHeight: size.lineHeight,
          color: text[tone],
        },
        'tabular' in size ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
