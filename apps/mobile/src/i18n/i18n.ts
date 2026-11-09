import { am, en, type MobileMessageKey } from '@adulis/locale/mobile';

import { useUiStore, type Locale } from '../state/ui-store';

/**
 * Strings come from `@adulis/locale/mobile` ONLY - the mobile-safe catalogue, which cannot
 * carry console subscription or billing copy (WO-001A D2). Never import the package root.
 * Both languages carry every key (a compile gate in the package), so there is no fallback:
 * a missing string is a build failure, never English shown in place of Amharic.
 */
const catalogues: Record<Locale, Record<MobileMessageKey, string>> = { en, am };

export function translate(locale: Locale, key: MobileMessageKey): string {
  return catalogues[locale][key];
}

/**
 * AMHARIC IS A DEVELOPMENT-ONLY LANGUAGE until the human translation review (November
 * R-19): its strings are machine-translated placeholders (packages/locale/MT-KEYS.md). A
 * release build renders English whatever the store holds, so no path - a leftover setting,
 * a future control - can show a user unreviewed Amharic. Development builds keep it for QA.
 */
export function amharicAvailable(): boolean {
  return __DEV__;
}

export function useT(): (key: MobileMessageKey) => string {
  const selected = useUiStore((state) => state.locale);
  const locale = amharicAvailable() ? selected : 'en';
  return (key) => translate(locale, key);
}
