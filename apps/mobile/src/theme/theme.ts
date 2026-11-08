import { colorModes, font, radius, space, touchTarget, type ColorMode } from '@adulis/tokens';
import { useColorScheme } from 'react-native';

import { useUiStore, type ThemePreference } from '../state/ui-store';

/**
 * The one theme authority. Screens read semantic roles (`color.text`, `color.danger`...)
 * from here and never a literal, so the brand palette -- not yet final, WO-001 S19 --
 * changes in @adulis/tokens without touching a screen.
 */

const PX_PER_REM = 16;

/** The ONE place a CSS length from @adulis/tokens becomes a React Native dp value. */
export function toDp(length: string): number {
  const match = /^(\d+(?:\.\d+)?)(rem|px)$/.exec(length);
  if (!match) throw new Error(`Token length "${length}" has no dp conversion`);
  const value = Number(match[1]);
  return match[2] === 'rem' ? value * PX_PER_REM : value;
}

function toDpScale<K extends string>(scale: Readonly<Record<K, string>>): Record<K, number> {
  return Object.fromEntries(
    Object.entries<string>(scale).map(([step, length]) => [step, toDp(length)]),
  ) as Record<K, number>;
}

const shared = {
  space: toDpScale(space),
  radius: toDpScale(radius),
  touchTarget: toDp(touchTarget.min),
  fontSize: toDpScale(font.size),
  fontWeight: font.weight,
  /** Multipliers: React Native wants dp, so AppText multiplies by the font size. */
  lineHeight: font.lineHeight,
};

function buildTheme(mode: ColorMode) {
  return { mode, color: colorModes[mode], ...shared };
}

export const themes = { light: buildTheme('light'), dark: buildTheme('dark') };
export type Theme = ReturnType<typeof buildTheme>;

export function resolveColorMode(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorMode {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme(): Theme {
  const preference = useUiStore((state) => state.themePreference);
  return themes[resolveColorMode(preference, useColorScheme())];
}
